from __future__ import annotations

import io
import zipfile

import pytest
from agent_factory_core.knowledge.errors import KnowledgeValidationError
from agent_factory_core.knowledge.packages import (
    STANDALONE_PACKAGE_LIMITS,
    PackageLimits,
    cloud_package_limits,
    extract_text,
    unpack_package,
)

LIMITS = PackageLimits(1024 * 1024, 1024 * 1024, 512 * 1024, 20, 100)


def test_standalone_package_defaults_remain_bounded() -> None:
    assert STANDALONE_PACKAGE_LIMITS == PackageLimits(
        4 * 1024 * 1024,
        4 * 1024 * 1024,
        4 * 1024 * 1024,
        256,
        100,
    )
    assert unpack_package(b"text", "text/plain", "source.txt") == {"source.txt": b"text"}


def archive(files: dict[str, bytes]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as package:
        for path, content in files.items():
            package.writestr(path, content)
    return output.getvalue()


def test_package_rejects_escape_collision_and_excessive_expansion() -> None:
    with pytest.raises(KnowledgeValidationError, match="unsafe"):
        unpack_package(archive({"../secret": b"x"}), "application/zip", "package.zip", LIMITS)
    with pytest.raises(KnowledgeValidationError, match="collide"):
        unpack_package(
            archive({"Folder/file.md": b"a", "folder/FILE.md": b"b"}),
            "application/zip",
            "package.zip",
            LIMITS,
        )
    with pytest.raises(KnowledgeValidationError, match="bounds"):
        unpack_package(
            archive({"large.md": b"x" * 600_000}),
            "application/zip",
            "package.zip",
            LIMITS,
        )


def test_html_projection_excludes_script_and_style_bodies() -> None:
    chunks = extract_text(
        {"index.html": b"<p>visible identifier_1</p><script>secret</script><style>hidden</style>"}
    )
    assert chunks == [("index.html", "visible identifier_1")]


def test_cloud_package_limits_use_defaults_and_clamp_hard_caps() -> None:
    defaults = cloud_package_limits(upload_bytes=25 * 1024 * 1024)
    assert defaults == PackageLimits(
        25 * 1024 * 1024,
        64 * 1024 * 1024,
        16 * 1024 * 1024,
        2_048,
        200,
    )
    capped = cloud_package_limits(
        upload_bytes=512 * 1024 * 1024,
        expanded_bytes=512 * 1024 * 1024,
        member_bytes=128 * 1024 * 1024,
        entries=20_000,
        ratio=5_000,
    )
    assert capped == PackageLimits(
        128 * 1024 * 1024,
        256 * 1024 * 1024,
        64 * 1024 * 1024,
        8_192,
        1_000,
    )


@pytest.mark.parametrize("value", [0, -1])
def test_cloud_package_limits_reject_nonpositive_values(value: int) -> None:
    with pytest.raises(ValueError, match="positive"):
        cloud_package_limits(upload_bytes=1, expanded_bytes=value)


@pytest.mark.parametrize("value", [True, 1.5, "12"])
def test_cloud_package_limits_reject_noninteger_values(value: object) -> None:
    with pytest.raises(TypeError, match="integer"):
        cloud_package_limits(upload_bytes=1, ratio=value)
