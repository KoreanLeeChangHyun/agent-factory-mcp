from __future__ import annotations

import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import PurePosixPath

import yaml

from .errors import KnowledgeValidationError
from .packages import digest, safe_package_path


@dataclass(frozen=True, slots=True)
class PairReview:
    reviewer: str
    evidence: str
    authority_reference: str
    ai_sha256: str
    human_sha256: str
    verdict: str


@dataclass(frozen=True, slots=True)
class SpecificationPair:
    specification_id: str
    ai_root: str
    human_root: str
    git_repository: str
    git_commit: str
    review: PairReview


class _CoverageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.language: str | None = None
        self.meta: dict[str, str | None] = {}
        self.sources: dict[str, dict[str, object]] = {}
        self.stack: list[tuple[str, str | None, dict[str, object] | None]] = []
        self.placeholder = False

    def handle_starttag(self, tag: str, attributes: list[tuple[str, str | None]]) -> None:
        attrs = dict(attributes)
        if tag == "html":
            self.language = attrs.get("lang")
        if "data-template-placeholder" in attrs:
            self.placeholder = True
        if tag == "meta" and attrs.get("name", "").startswith("agent-factory:"):
            name = str(attrs["name"])
            if name in self.meta:
                self._invalid("pair_binding_mismatch")
            self.meta[name] = attrs.get("content")
        source = next((source for _, source, _ in reversed(self.stack) if source), None)
        block = next((block for _, _, block in reversed(self.stack) if block), None)
        if "data-ai-source" in attrs:
            source = str(attrs["data-ai-source"])
            if source in self.sources:
                self._invalid("duplicate_pair_source")
            self.sources[source] = {"hash": attrs.get("data-ai-sha256"), "blocks": []}
        if "data-source-lines" in attrs:
            if source is None or source not in self.sources:
                self._invalid("pair_coverage_missing")
            assert source is not None
            block = {
                "range": attrs["data-source-lines"],
                "hash": attrs.get("data-source-sha256"),
                "text": [],
            }
            blocks = self.sources[source]["blocks"]
            assert isinstance(blocks, list)
            blocks.append(block)
        if tag not in {
            "meta",
            "link",
            "br",
            "hr",
            "img",
            "input",
            "source",
            "area",
            "base",
            "embed",
            "param",
            "track",
            "wbr",
        }:
            self.stack.append((tag, source, block))

    def handle_endtag(self, tag: str) -> None:
        if tag in {
            "meta",
            "link",
            "br",
            "hr",
            "img",
            "input",
            "source",
            "area",
            "base",
            "embed",
            "param",
            "track",
            "wbr",
        }:
            return
        if not self.stack or self.stack[-1][0] != tag:
            self._invalid("malformed_pair_html")
        self.stack.pop()

    def handle_data(self, data: str) -> None:
        if (
            self.stack
            and self.stack[-1][2] is not None
            and not any(tag in {"script", "style", "head", "template"} for tag, _, _ in self.stack)
        ):
            values = self.stack[-1][2]["text"]
            assert isinstance(values, list)
            values.append(data)

    @staticmethod
    def _invalid(code: str) -> None:
        raise KnowledgeValidationError(code, "Specification pair is invalid")


def _tree_hash(files: dict[str, bytes], root: str) -> str:
    values = {
        path[len(root) + 1 :]: digest(content)
        for path, content in sorted(files.items())
        if path.startswith(root + "/")
    }
    return digest(json.dumps(values, sort_keys=True, separators=(",", ":")).encode())


def validate_specification_pair(
    files: dict[str, bytes], pair: SpecificationPair, slug: str
) -> dict[str, object]:
    ai_root, human_root = safe_package_path(pair.ai_root), safe_package_path(pair.human_root)
    if (
        ai_root == human_root
        or ai_root.startswith(human_root + "/")
        or human_root.startswith(ai_root + "/")
    ):
        raise KnowledgeValidationError("pair_roots_overlap", "Specification pair roots overlap")
    ai_entry, human_entry = f"{ai_root}/SKILL.md", f"{human_root}/index.html"
    required = {ai_entry, human_entry, f"{human_root}/styles.css", f"{human_root}/app.js"}
    if pair.specification_id != slug or not required.issubset(files):
        raise KnowledgeValidationError(
            "pair_incomplete", "Specification pair identity or files are incomplete"
        )
    if any(not path.startswith((ai_root + "/", human_root + "/")) for path in files):
        raise KnowledgeValidationError(
            "pair_incomplete", "Specification pair has files outside its roots"
        )
    try:
        skill = files[ai_entry].decode()
        parts = skill.split("---", 2)
        header = yaml.safe_load(parts[1])
        metadata = header["metadata"]
        if (
            len(parts) != 3
            or parts[0].strip()
            or header["name"] != slug
            or metadata["specification-id"] != slug
            or metadata["ai-root"].rstrip("/") != ai_root
            or metadata["human-entry"] != human_entry
        ):
            raise KnowledgeValidationError("pair_binding_mismatch", "Pair metadata does not match")
        html = files[human_entry].decode()
        parser = _CoverageParser()
        parser.feed(html)
        parser.close()
        if parser.stack or parser.placeholder or "[[" in html or parser.language != "ko":
            raise KnowledgeValidationError(
                "pair_human_incomplete", "Human representation is incomplete"
            )
        expected_meta = {
            "agent-factory:specification-id": slug,
            "agent-factory:ai-root": ai_root + "/",
            "agent-factory:ai-binding-entry": ai_entry,
        }
        if any(parser.meta.get(key) != value for key, value in expected_meta.items()):
            raise KnowledgeValidationError("pair_binding_mismatch", "Human metadata does not match")
        names = sorted(
            (
                path
                for path in files
                if path.startswith(ai_root + "/")
                and (
                    path.lower().endswith(".md")
                    or (
                        PurePosixPath(path).parent.name == "agents"
                        and PurePosixPath(path).suffix.lower() in {".yaml", ".yml"}
                    )
                )
            ),
            key=lambda path: (path != ai_entry, path),
        )
        if list(parser.sources) != names:
            raise KnowledgeValidationError(
                "pair_coverage_missing", "AI sources are not fully mapped"
            )
        for path in names:
            source = parser.sources[path]
            if source["hash"] != digest(files[path]):
                raise KnowledgeValidationError(
                    "pair_source_hash_mismatch", "AI source hash differs"
                )
            lines = files[path].decode().splitlines(keepends=True)
            next_line = 1
            blocks = source["blocks"]
            assert isinstance(blocks, list)
            for block in blocks:
                assert isinstance(block, dict)
                match = re.fullmatch(r"([1-9][0-9]*)-([1-9][0-9]*)", str(block["range"]))
                if not match:
                    raise KnowledgeValidationError(
                        "pair_coverage_missing", "Source range is invalid"
                    )
                start, end = map(int, match.groups())
                if start != next_line or end < start or end > len(lines):
                    raise KnowledgeValidationError(
                        "pair_coverage_missing", "Source ranges are not contiguous"
                    )
                if block["hash"] != digest("".join(lines[start - 1 : end]).encode()):
                    raise KnowledgeValidationError(
                        "pair_source_hash_mismatch", "Source block hash differs"
                    )
                rendered = "".join(str(value) for value in block["text"]).strip()
                if not rendered or not re.search(r"[가-힣]", rendered):
                    raise KnowledgeValidationError(
                        "pair_human_incomplete", "Human mapping lacks Korean content"
                    )
                next_line = end + 1
            if next_line != len(lines) + 1:
                raise KnowledgeValidationError(
                    "pair_coverage_missing", "AI source coverage is incomplete"
                )
        if (
            pair.review.verdict != "aligned"
            or pair.review.ai_sha256 != _tree_hash(files, ai_root)
            or pair.review.human_sha256 != _tree_hash(files, human_root)
        ):
            raise KnowledgeValidationError("pair_review_stale", "Review is stale or not aligned")
    except KnowledgeValidationError:
        raise
    except (UnicodeError, ValueError, KeyError, TypeError, yaml.YAMLError, RecursionError) as error:
        raise KnowledgeValidationError("pair_invalid", "Specification pair is invalid") from error
    return {
        "coverage": "complete",
        "sources": names,
        "semantic_alignment": "review_attested",
        "specification_id": pair.specification_id,
        "ai_root": ai_root,
        "human_root": human_root,
        "git_repository": pair.git_repository,
        "git_commit": pair.git_commit,
        "reviewer": pair.review.reviewer,
        "authority_reference": pair.review.authority_reference,
    }
