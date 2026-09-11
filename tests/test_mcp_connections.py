import pytest
from pydantic import ValidationError

from app.router.mcp_connections import ConnectionCreate


def test_connection_create_requires_trimmed_token_name() -> None:
    assert ConnectionCreate(name="  개인 노트북  ").name == "개인 노트북"

    with pytest.raises(ValidationError):
        ConnectionCreate(name="   ")
    with pytest.raises(ValidationError):
        ConnectionCreate(name="가" * 121)
    with pytest.raises(ValidationError):
        ConnectionCreate()
