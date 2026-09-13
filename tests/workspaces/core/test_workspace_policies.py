import pytest
from agent_factory_core.shared.errors import ApplicationError, ConflictError
from agent_factory_core.workspaces.policies import (
    canonical_remote_repository,
    normalize_group_name,
    require_unique_group_name,
)


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("https://GitHub.COM/acme/repo.git", "https://github.com/acme/repo"),
        ("git@GitHub.COM:acme/repo.git", "ssh://git@github.com/acme/repo"),
        ("ssh://git@GitHub.COM/acme/repo/", "ssh://git@github.com/acme/repo"),
        ("git://GitHub.COM/acme/repo.git", "git://github.com/acme/repo"),
    ],
)
def test_remote_repository_identity_is_canonical(source: str, expected: str) -> None:
    assert canonical_remote_repository(source) == expected


def test_remote_repository_rejects_local_and_control_character_paths() -> None:
    for source in ("/srv/repository", "https://example.com/repo\nsecret"):
        with pytest.raises(ApplicationError):
            canonical_remote_repository(source)


def test_group_names_are_user_local_normalized_and_unique() -> None:
    assert normalize_group_name("  Active   work ") == "Active work"
    with pytest.raises(ConflictError, match="workspace_group_name_exists"):
        require_unique_group_name(" ACTIVE WORK ", ["Active work"])
