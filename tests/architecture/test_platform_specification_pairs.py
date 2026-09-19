from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
DOCUMENTS = ROOT.parent / "docs"
PLATFORM_SPECIFICATIONS = ("info-platform", "design-platform", "rule-platform")


def _skill_frontmatter(path: Path) -> dict[str, object]:
    _, frontmatter, _ = path.read_text().split("---", 2)
    parsed = yaml.safe_load(frontmatter)
    assert isinstance(parsed, dict)
    return parsed


def test_platform_specifications_use_only_the_three_categories() -> None:
    assert {path.name for path in DOCUMENTS.iterdir()} == {"original", "processed", "skills"}
    assert not (DOCUMENTS / "skills/spec-platform").exists()
    assert {name.split("-", 1)[0] for name in PLATFORM_SPECIFICATIONS} == {
        "info", "design", "rule"
    }


def test_platform_specifications_have_one_editable_source() -> None:
    for name in PLATFORM_SPECIFICATIONS:
        package = DOCUMENTS / "skills" / name
        metadata = _skill_frontmatter(package / "SKILL.md")["metadata"]
        assert metadata["document-type"] == "specification"
        assert metadata["category"] == name.split("-", 1)[0]
        assert metadata["name"] == "platform"
        assert "counterpart" not in metadata
        assert "projection" not in metadata
        assert {path.name for path in package.iterdir()} <= {"SKILL.md", "assets"}
        assert metadata["provenance"]["merged-from"]


def test_product_overview_keeps_authority_and_unresolved_scope() -> None:
    source = (DOCUMENTS / "skills/design-platform/SKILL.md").read_text()
    for requirement in (
        'id="product-overview"',
        "화면 작성의 유일한 형식이 아니다",
        "임의 사용자 서버 함수 지원은 포함하지 않는다",
        "개수 구간과 가격은 미확정",
        "상시 구독",
        "자동 초과 과금",
    ):
        assert requirement in source
