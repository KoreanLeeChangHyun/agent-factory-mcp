"""Workspace UI, discovery API, and bounded document projection routes."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response

from app.core.config import settings
from app.core.paths import STATIC_ROOT
from app.infrastructure.workspace import runtime

router = APIRouter(tags=["workspace"])
WORKSPACE_ASSET_ROOT = STATIC_ROOT / "workspace"


def _project_root() -> Path:
    override = str(settings.project_root) if settings.project_root is not None else None
    try:
        return runtime.resolve_project_root(override)
    except runtime.ViewerError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _served_roots(project_root: Path) -> dict[str, Path]:
    candidates = {
        "workspace": WORKSPACE_ASSET_ROOT,
        "planning": project_root / runtime.HUMAN_SPECIFICATION_RELATIVE_PATH,
        "processed": project_root / runtime.PROCESSED_DOCUMENT_RELATIVE_PATH,
        "explorer": project_root / runtime.WORKSPACE_RELATIVE_PATH / "explorer",
        "skills": project_root / runtime.WORKSPACE_RELATIVE_PATH / "skills",
        "project-skills": project_root / runtime.PROJECT_SKILLS_RELATIVE_PATH,
    }
    return {
        prefix: path
        for prefix, path in candidates.items()
        if path.exists() and path.is_dir() and not path.is_symlink()
    }


def _file_response(project_root: Path, request_target: str) -> Response:
    roots = _served_roots(project_root)
    try:
        candidate, trailing_slash = runtime.resolve_request_path(roots, request_target)
    except (OSError, runtime.ViewerError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if candidate.is_dir():
        if not trailing_slash:
            return RedirectResponse(f"{request_target}/", status_code=307)
        candidate = candidate / "index.html"

    try:
        resolved_file = candidate.resolve(strict=True)
    except (FileNotFoundError, OSError) as exc:
        raise HTTPException(status_code=404, detail="Workspace file not found") from exc
    if not resolved_file.is_file():
        raise HTTPException(status_code=404, detail="Workspace file not found")

    return FileResponse(
        resolved_file,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse("/workspace/", status_code=307)


@router.get("/api/processed-documents")
async def processed_documents() -> dict[str, object]:
    try:
        return {"processedDocuments": runtime.discover_processed_documents(_project_root())}
    except (OSError, runtime.ViewerError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/specifications")
async def specifications() -> dict[str, object]:
    try:
        return {"specifications": runtime.discover_specifications(_project_root())}
    except (OSError, runtime.ViewerError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/explorer-tree")
async def explorer_tree() -> dict[str, object]:
    try:
        return runtime.discover_explorer_trees(_project_root())
    except (OSError, runtime.ViewerError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/project-skills")
async def project_skills() -> dict[str, object]:
    try:
        return {"skills": runtime.discover_project_skills(_project_root())}
    except (OSError, runtime.ViewerError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.api_route("/workspace/{asset_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def workspace_asset(request: Request, asset_path: str) -> Response:
    del asset_path
    return _file_response(_project_root(), request.url.path)


@router.api_route("/planning/{asset_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def specification_asset(request: Request, asset_path: str) -> Response:
    del asset_path
    return _file_response(_project_root(), request.url.path)


@router.api_route("/processed/{asset_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def processed_asset(request: Request, asset_path: str) -> Response:
    del asset_path
    return _file_response(_project_root(), request.url.path)
