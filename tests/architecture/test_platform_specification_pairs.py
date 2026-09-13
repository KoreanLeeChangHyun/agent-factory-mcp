from html.parser import HTMLParser
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
PLATFORM_SPECIFICATIONS = ("info-platform", "design-platform", "rule-platform")


class _MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.metadata: dict[str, str] = {}
        self.clauses: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "meta" and values.get("name", "").startswith("agent-factory:"):
            self.metadata[values["name"].removeprefix("agent-factory:")] = values.get(
                "content", ""
            )
        if clause_id := values.get("data-clause-id"):
            self.clauses.add(clause_id)


def _skill_frontmatter(path: Path) -> dict[str, object]:
    source = path.read_text()
    _, frontmatter, _ = source.split("---", 2)
    parsed = yaml.safe_load(frontmatter)
    assert isinstance(parsed, dict)
    return parsed


def test_platform_specifications_use_only_the_three_categories() -> None:
    assert not (ROOT / ".codex/skills/spec-platform").exists()
    assert {name.split("-", 1)[0] for name in PLATFORM_SPECIFICATIONS} == {
        "info",
        "design",
        "rule",
    }


def test_platform_skills_and_human_specifications_are_synchronized_pairs() -> None:
    for name in PLATFORM_SPECIFICATIONS:
        skill_path = ROOT / ".codex/skills" / name / "SKILL.md"
        frontmatter = _skill_frontmatter(skill_path)
        metadata = frontmatter["metadata"]
        assert isinstance(metadata, dict)

        human_path = ROOT / str(metadata["counterpart"])
        parser = _MetadataParser()
        parser.feed(human_path.read_text())

        assert metadata["specification-id"] == name
        assert parser.metadata == {
            "specification-id": name,
            "specification-version": str(metadata["specification-version"]),
            "projection": "human",
            "language": "ko",
            "counterpart": f".codex/skills/{name}/",
            "semantic-revision": str(metadata["semantic-revision"]),
            "sync-base-revision": str(metadata["sync-base-revision"]),
            "modified-at": str(metadata["modified-at"]),
        }

        skill_source = skill_path.read_text()
        skill_clauses = {
            line.split("clause-id: ", 1)[1].split(" -->", 1)[0]
            for line in skill_source.splitlines()
            if "clause-id: " in line
        }
        assert skill_clauses
        assert parser.clauses == skill_clauses
