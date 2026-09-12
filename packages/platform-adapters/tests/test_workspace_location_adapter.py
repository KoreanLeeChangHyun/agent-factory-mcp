from pathlib import Path

import pytest
from agent_factory_adapters.workspaces import canonical_local_repository
from agent_factory_core.shared.errors import ApplicationError


def test_local_resolution_stays_inside_adapter_root(tmp_path: Path) -> None:
    inside = tmp_path / "repositories" / "example"
    assert canonical_local_repository(str(inside), root=tmp_path) == str(inside.resolve())
    with pytest.raises(ApplicationError, match="repository_path_outside_root"):
        canonical_local_repository(str(tmp_path.parent), root=tmp_path)
