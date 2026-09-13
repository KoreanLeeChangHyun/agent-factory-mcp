from agent_factory_core import GetReferenceWorkbench
from .workbench_repository import FixtureWorkbenchRepository


def smoke() -> dict[str, object]:
    definition = GetReferenceWorkbench(FixtureWorkbenchRepository()).execute()
    return {"status": "ok", "workbench": definition["descriptor"]["id"]}

