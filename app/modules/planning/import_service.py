"""Deterministic preview and atomic apply; no model or source-provider calls."""

import hashlib
import json
from types import SimpleNamespace
from uuid import UUID, uuid4

from sqlalchemy import select

from app.common.errors import ApplicationError, ConflictError, NotFoundError
from app.modules.auth.authorization import require_context, require_workspace_id
from app.modules.planning.import_models import PlanImport, PlanSourceLink
from app.modules.planning.import_schemas import ImportApply, ImportProposal
from app.modules.planning.models import PlanItem
from app.modules.planning.repository import PlanningRepository
from app.modules.planning.schemas import ItemFields, ItemResponse
from app.modules.planning.service import domain_projection, validate_level

FIELDS = set(ItemFields.model_fields)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def build_preview(proposal, rows, links):
    """Resolve source identities before validating order-independent parent references."""
    existing = {str(row.id): row for row in rows}
    linked = {link.source_id: str(link.item_id) for link in links}
    errors, warnings, operations = [], [], []
    identities, seen_targets = {}, set()
    if not proposal.source.complete:
        errors.append(
            "원본 읽기가 완료되지 않았습니다. 지정한 범위를 모두 읽은 뒤 다시 제출하세요."
        )
    for entry in proposal.items:
        if entry.source_id in identities:
            errors.append(f"중복 원본 식별자: {entry.source_id}")
        mapped = linked.get(entry.source_id)
        explicit = str(entry.existing_id) if entry.existing_id else None
        if mapped and explicit and mapped != explicit:
            errors.append(f"{entry.name}: 기존 원본 연결과 대상 작업이 다릅니다.")
        target = mapped or explicit or str(uuid4())
        if explicit and explicit not in existing:
            errors.append(f"{entry.name}: 대상 작업을 찾을 수 없습니다.")
        if target in seen_targets:
            errors.append(f"{entry.name}: 같은 작업을 여러 번 수정할 수 없습니다.")
        seen_targets.add(target)
        identities[entry.source_id] = target
    proposed_kinds = {identities[e.source_id]: e.kind for e in proposal.items}
    for entry in proposal.items:
        target = identities[entry.source_id]
        current = existing.get(target)
        parent = str(entry.parent_id) if entry.parent_id else None
        if parent and entry.parent_source_id:
            errors.append(f"{entry.name}: 상위 작업 참조는 하나만 지정하세요.")
        if entry.parent_source_id:
            parent = identities.get(entry.parent_source_id) or linked.get(entry.parent_source_id)
            if not parent:
                errors.append(f"{entry.name}: 상위 원본 작업을 찾을 수 없습니다.")
        parent_kind = proposed_kinds.get(parent)
        if parent_kind is None and parent in existing:
            parent_kind = existing[parent].kind
        expected = {"feature": "domain", "issue": "feature"}.get(entry.kind)
        if (entry.kind == "domain" and parent) or (
            entry.kind != "domain" and (not parent or parent_kind != expected)
        ):
            errors.append(f"{entry.name}: 작업의 상하 관계가 3단계 구조와 맞지 않습니다.")
        if current and (
            current.kind != entry.kind or str(current.parent_id or "") != str(parent or "")
        ):
            errors.append(f"{entry.name}: 기존 작업의 종류와 상위 작업은 변경할 수 없습니다.")
        try:
            validate_level(entry.kind, entry)
        except ApplicationError as exc:
            errors.append(f"{entry.name}: {exc.message}")
        errors.extend(f"{entry.name}: 확인 필요 — {q}" for q in entry.questions)
        if entry.kind != "domain" and not entry.target_date:
            warnings.append(f"{entry.name}: 목표일 미정")
        if entry.corrections:
            warnings.append(f"{entry.name}: 원본 보정 {len(entry.corrections)}건")
        after = entry.model_dump(mode="json", include=FIELDS)
        before = (
            ItemResponse.model_validate(current).model_dump(mode="json", include=FIELDS)
            if current
            else None
        )
        operations.append(
            {
                "source_id": entry.source_id,
                "id": target,
                "kind": entry.kind,
                "parent_id": parent,
                "action": "unchanged" if before == after else "update" if current else "create",
                "before": before,
                "after": after,
                "source_location": entry.source_location,
                "original_values": entry.original_values,
                "corrections": [c.model_dump() for c in entry.corrections],
                "questions": entry.questions,
            }
        )
    projected = {
        str(r.id): SimpleNamespace(**ItemResponse.model_validate(r).model_dump()) for r in rows
    }
    for operation in operations:
        projected[operation["id"]] = SimpleNamespace(
            id=operation["id"],
            parent_id=operation["parent_id"],
            kind=operation["kind"],
            **ItemFields.model_validate(operation["after"]).model_dump(),
        )
    for record in list(projected.values()):
        if record.kind == "domain":
            summary = domain_projection(
                record, [r for r in projected.values() if str(r.parent_id) == str(record.id)]
            )
            if summary["period_conflict"]:
                warnings.append(f"{record.name}: 직접 지정한 날짜와 집계한 날짜의 기간 확인 필요")
            record.start_date, record.target_date = summary["start_date"], summary["target_date"]
    for record in projected.values():
        parent_record = projected.get(str(record.parent_id))
        if parent_record and any(
            (parent_record.start_date and d < parent_record.start_date)
            or (parent_record.target_date and d > parent_record.target_date)
            for d in (record.start_date, record.target_date)
            if d
        ):
            warnings.append(f"{record.name}: 상위 작업 기간 밖")
    return {
        "operations": operations,
        "errors": errors,
        "warnings": warnings,
        "can_apply": not errors,
        "source": proposal.source.model_dump(),
    }


class PlanningImportService:
    def __init__(self, session, context):
        self.session = session
        self.context = context
        self.workspace_id = require_workspace_id(context)
        self.repository = PlanningRepository(session)

    async def lock(self):
        await self.repository.lock(self.context.scope.organization_id, self.workspace_id)

    async def state(self):
        rows = await self.repository.list(self.workspace_id)
        links = list(
            await self.session.scalars(
                select(PlanSourceLink).where(PlanSourceLink.workspace_id == self.workspace_id)
            )
        )
        baseline = digest(
            {
                "items": sorted((str(r.id), r.revision) for r in rows),
                "links": sorted((l.provider, l.source, l.source_id, str(l.item_id)) for l in links),
            }
        )
        return rows, links, baseline

    def response(self, record):
        return {
            "id": str(record.id),
            "preview_digest": record.digest,
            "status": "applied" if record.result is not None else "preview",
            "created_at": record.created_at.isoformat(),
            **record.preview,
            "result": record.result,
        }

    async def get(self, import_id):
        require_context(self.context, "planning.read")
        record = await self.session.scalar(
            select(PlanImport).where(
                PlanImport.workspace_id == self.workspace_id, PlanImport.id == import_id
            )
        )
        if record is None:
            raise NotFoundError("plan_import_not_found", "가져오기 내역을 찾을 수 없습니다.")
        return record

    async def list(self):
        require_context(self.context, "planning.read")
        records = await self.session.scalars(
            select(PlanImport)
            .where(PlanImport.workspace_id == self.workspace_id)
            .order_by(PlanImport.created_at.desc())
            .limit(50)
        )
        return [
            {
                "id": str(r.id),
                "source": r.preview["source"],
                "status": "applied" if r.result is not None else "preview",
                "created_at": r.created_at.isoformat(),
                "can_apply": r.preview["can_apply"],
            }
            for r in records
        ]

    async def preview(self, proposal: ImportProposal):
        require_context(self.context, "planning.import")
        await self.lock()
        payload = proposal.model_dump(mode="json")
        prior = await self.session.scalar(
            select(PlanImport).where(
                PlanImport.workspace_id == self.workspace_id,
                PlanImport.request_key == proposal.request_key,
            )
        )
        if prior:
            if prior.proposal != payload:
                raise ConflictError(
                    "import_request_conflict",
                    "같은 요청 키에 다른 내용이 제출되었습니다. 새 요청 키를 사용하세요.",
                )
            return self.response(prior)
        rows, links, baseline = await self.state()
        source_links = [
            l
            for l in links
            if l.provider == proposal.source.provider and l.source == proposal.source.external_id
        ]
        preview = build_preview(proposal, rows, source_links)
        record = PlanImport(
            id=uuid4(),
            workspace_id=self.workspace_id,
            request_key=proposal.request_key,
            proposal=payload,
            preview=preview,
            baseline=baseline,
            digest=digest({"preview": preview, "baseline": baseline}),
        )
        self.session.add(record)
        await self.session.commit()
        return self.response(record)

    async def apply(self, import_id: UUID, payload: ImportApply):
        require_context(self.context, "planning.import")
        await self.lock()
        record = await self.get(import_id)
        if record.digest != payload.preview_digest:
            raise ConflictError("import_digest_conflict", "검토한 미리보기와 요청이 다릅니다.")
        if record.result is not None:
            return self.response(record)
        if not record.preview["can_apply"]:
            raise ApplicationError(
                "import_invalid", "오류와 확인 필요 항목을 해결한 변환안을 다시 제출하세요.", 422
            )
        if record.preview["warnings"] and not payload.acknowledge_warnings:
            raise ApplicationError(
                "import_review_required", "미정 날짜와 원본 보정 내용을 확인하세요.", 422
            )
        rows, links, baseline = await self.state()
        if baseline != record.baseline:
            raise ConflictError(
                "import_stale",
                "검토 이후 일정이 변경되었습니다. 새 요청 키로 미리보기를 다시 만드세요.",
            )
        existing = {str(r.id): r for r in rows}
        source = record.proposal["source"]
        mapped = {
            l.source_id
            for l in links
            if l.provider == source["provider"] and l.source == source["external_id"]
        }
        operations = sorted(
            record.preview["operations"],
            key=lambda o: {"domain": 0, "feature": 1, "issue": 2}[o["kind"]],
        )
        for operation in operations:
            values = ItemFields.model_validate(operation["after"]).model_dump()
            if operation["action"] == "create":
                self.session.add(
                    PlanItem(
                        id=UUID(operation["id"]),
                        workspace_id=self.workspace_id,
                        kind=operation["kind"],
                        parent_id=UUID(operation["parent_id"]) if operation["parent_id"] else None,
                        **values,
                    )
                )
            elif operation["action"] == "update":
                item = existing[operation["id"]]
                for key, value in values.items():
                    setattr(item, key, value)
                item.revision += 1
            # Flush each level before dependent rows; all rows remain one transaction.
            await self.session.flush()
            if operation["source_id"] not in mapped:
                self.session.add(
                    PlanSourceLink(
                        workspace_id=self.workspace_id,
                        provider=source["provider"],
                        source=source["external_id"],
                        source_id=operation["source_id"],
                        item_id=UUID(operation["id"]),
                    )
                )
        record.result = {
            "items": [
                {"source_id": o["source_id"], "id": o["id"], "action": o["action"]}
                for o in operations
            ]
        }
        await self.session.commit()
        return self.response(record)
