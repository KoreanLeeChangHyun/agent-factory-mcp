"""Canonical Workspace browser assets served by the MCP application."""

from pathlib import Path, PurePosixPath

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, RedirectResponse

from app.core.paths import STATIC_ROOT

router = APIRouter(tags=["workspace"])
WORKSPACE_ASSET_ROOT = (STATIC_ROOT / "workspace").resolve()


def _asset_file(asset_path: str) -> Path:
    relative = PurePosixPath(asset_path or "index.html")
    if relative.is_absolute() or any(part in {"", ".", ".."} for part in relative.parts):
        raise HTTPException(status_code=400, detail="Invalid Workspace asset path")
    unresolved = WORKSPACE_ASSET_ROOT.joinpath(*relative.parts)
    current = WORKSPACE_ASSET_ROOT
    for part in relative.parts:
        current /= part
        if current.is_symlink():
            raise HTTPException(status_code=404, detail="Workspace asset not found")
    try:
        candidate = unresolved.resolve(strict=True)
        candidate.relative_to(WORKSPACE_ASSET_ROOT)
    except (FileNotFoundError, OSError, ValueError) as exc:
        raise HTTPException(status_code=404, detail="Workspace asset not found") from exc
    if not candidate.is_file() or candidate.is_symlink():
        raise HTTPException(status_code=404, detail="Workspace asset not found")
    return candidate


@router.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse("/workspace/", status_code=307)


@router.api_route("/workspace/{asset_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def workspace_asset(asset_path: str) -> FileResponse:
    return FileResponse(
        _asset_file(asset_path),
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
