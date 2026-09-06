"""Embedding-independent literal substring search over authorized reporting rows."""

from datetime import UTC, datetime

from sqlalchemy import String, cast, func, or_, select

from app.common.errors import PermissionDeniedError
from app.modules.reporting.models import ReportAgent, ReportResult, ReportTask, TaskReport
from app.modules.reporting.schemas import SearchQuery


def search_statement(workspace_id, request: SearchQuery):
    models = {
        "agent": (ReportAgent, "name", "responsibilities", ("role", "parent_id")),
        "task": (ReportTask, "name", "description", ("agent_id", "parent_id", "runtime_binding")),
        "report": (TaskReport, "status", "message", ("task_id",)),
        "result": (ReportResult, "label", "summary", ("report_id", "document_id", "url")),
    }
    model, title, body, extra = models[request.kind]
    fields = [model.id, getattr(model, title), getattr(model, body)]
    fields.extend(getattr(model, name) for name in extra)
    # contains(autoescape=True) treats %, _, and the escape character as data.
    predicate = or_(
        *(cast(field, String).contains(request.query, autoescape=True) for field in fields)
    )
    query = select(
        model.id,
        func.substr(getattr(model, title), 1, 200).label("title"),
        func.substr(getattr(model, body), 1, 1000).label("excerpt"),
        *[getattr(model, name) for name in extra],
    ).where(model.workspace_id == workspace_id, predicate)
    if request.after_id is not None:
        query = query.where(model.id > request.after_id)
    return query.order_by(model.id).limit(request.limit + 1)


async def search_reports(session, context, request: SearchQuery):
    if "agent.read" not in context.permissions:
        raise PermissionDeniedError("permission_required", "Permission required: agent.read")
    rows = (await session.execute(search_statement(context.scope.workspace_id, request))).mappings().all()
    page = rows[:request.limit]
    return {
        "kind": request.kind,
        "query": request.query,
        "items": [
            {key: str(value) if hasattr(value, "hex") else value for key, value in row.items()}
            for row in page
        ],
        "next_after_id": str(page[-1]["id"]) if len(rows) > request.limit else None,
        "server_time": datetime.now(UTC).isoformat(),
        "stale_after_seconds": 300,
    }
