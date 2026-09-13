from api.http.routes.connections.router import create_provider_collections_router
from fastapi import FastAPI


def test_provider_collection_router_exposes_inspection_drive_and_results_contracts() -> None:
    router = create_provider_collections_router(lambda: object(), lambda: object(), lambda: None)
    app = FastAPI()
    app.include_router(router)

    operations = {
        (route.path, method)
        for route in router.routes
        for method in getattr(route, "methods", set())
    }
    workspace = "/api/organizations/{organization_id}/workspaces/{workspace_id}"
    assert (f"{workspace}/provider-connections/{{connection_id}}/inspect", "GET") in operations
    assert (
        f"{workspace}/provider-connections/{{connection_id}}/drive-sources",
        "GET",
    ) in operations
    assert (f"{workspace}/provider-collections/runs/{{run_id}}/results", "GET") in operations
