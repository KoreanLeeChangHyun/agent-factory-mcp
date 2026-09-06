"""External AI import tools, backed by the same planning owner as the browser."""

from importlib.resources import files
from uuid import UUID

from fastapi.encoders import jsonable_encoder

from app.modules.planning.import_schemas import ImportApply, ImportProposal
from app.modules.planning.import_service import PlanningImportService
from app.modules.planning.repository import PlanningRepository
from app.modules.planning.service import PlanningService


def install_planning(server, authorize):
    @server.resource("agent-factory://planning/import-guide", name="planning-import-guide")
    async def guide() -> str:
        return files("app.resources").joinpath("planning-import.md").read_text(encoding="utf-8")

    @server.tool(
        name="planning_schema",
        description="Read the development planning import schema and rules. No AI or source connectors are hosted here.",
    )
    async def schema() -> dict:
        return {
            "schema": ImportProposal.model_json_schema(),
            "guide": "agent-factory://planning/import-guide",
            "levels": ["domain", "feature", "issue"],
            "rules": [
                "Kinds and parents are immutable.",
                "Domain dates are optional explicit overrides; each null date derives from children. Status remains derived. On read, start_date/target_date are effective; use configured_start_date/configured_target_date when preserving domain input. Mixed effective dates may conflict; display period_conflict without inventing dates.",
                "Issues have target dates, not start dates or acceptance fields.",
                "Preserve source IDs across imports. Read the entire declared source scope.",
                "Never invent missing dates. Submit unresolved questions; they block apply.",
                "Review preview before apply. Use a new request key when correcting or refreshing a proposal.",
            ],
        }

    @server.tool(
        name="planning_read",
        description="Read development plan and source mappings, or a saved import preview. Distinct from background schedules.",
    )
    async def read(
        import_id: str | None = None,
        organization_id: str | None = None,
        workspace_id: str | None = None,
    ) -> dict:
        session, context = await authorize(
            organization_id, workspace_id, "schedule:read", "planning.read"
        )
        async with session:
            imports = PlanningImportService(session, context)
            if import_id:
                return imports.response(await imports.get(UUID(import_id)))
            result = await PlanningService(PlanningRepository(session)).list(context)
            _, links, _ = await imports.state()
            result["source_links"] = [
                {
                    "provider": l.provider,
                    "source": l.source,
                    "source_id": l.source_id,
                    "item_id": str(l.item_id),
                }
                for l in links
            ]
            return jsonable_encoder(result)

    @server.tool(
        name="planning_import_preview",
        description="Validate and persist a proposed import without changing schedule items. Read the import guide first.",
    )
    async def preview(
        proposal: ImportProposal,
        organization_id: str | None = None,
        workspace_id: str | None = None,
    ) -> dict:
        session, context = await authorize(
            organization_id, workspace_id, "schedule:write", "planning.import"
        )
        async with session:
            return await PlanningImportService(session, context).preview(proposal)

    @server.tool(
        name="planning_import_apply",
        description="Apply a reviewed import atomically. Requires its exact preview digest; replay returns the saved result. Confirm ambiguous source mappings with the user before submission.",
    )
    async def apply(
        import_id: str,
        review: ImportApply,
        organization_id: str | None = None,
        workspace_id: str | None = None,
    ) -> dict:
        session, context = await authorize(
            organization_id, workspace_id, "schedule:write", "planning.import"
        )
        async with session:
            return await PlanningImportService(session, context).apply(UUID(import_id), review)
