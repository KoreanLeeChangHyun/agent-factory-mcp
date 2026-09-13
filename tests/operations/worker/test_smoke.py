from tests.operations.fixtures.worker_reference import smoke


def test_smoke_validates_reference_fixture() -> None:
    assert smoke() == {"status": "ok", "workbench": "documents"}
