"""Package-relative Specification identity and full ordered source coverage."""
import json
import re
from html.parser import HTMLParser
from pathlib import PurePosixPath
import yaml
from app.modules.document.package import digest, invalid, safe_path

class CoverageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.sources = {}
        self.stack = []
        self.language = None
        self.placeholder = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html": self.language = attrs.get("lang")
        if "data-template-placeholder" in attrs: self.placeholder = True
        if tag == "meta" and attrs.get("name", "").startswith("agent-factory:"):
            name = attrs["name"]
            if name in self.meta: invalid("pair_binding_mismatch")
            self.meta[name] = attrs.get("content")
        source = next((s for _, s, _ in reversed(self.stack) if s), None)
        block = next((b for _, _, b in reversed(self.stack) if b is not None), None)
        if "data-ai-source" in attrs:
            source = attrs["data-ai-source"]
            if source in self.sources: invalid("duplicate_pair_source")
            self.sources[source] = {"hash": attrs.get("data-ai-sha256"), "blocks": []}
        if "data-source-lines" in attrs:
            if source not in self.sources: invalid("pair_coverage_missing")
            block = {"range": attrs["data-source-lines"], "hash": attrs.get("data-source-sha256"), "text": []}
            self.sources[source]["blocks"].append(block)
        if tag not in {"meta", "link", "br", "hr", "img", "input", "source", "area", "base", "embed", "param", "track", "wbr"}:
            self.stack.append((tag, source, block))
    def handle_endtag(self, tag):
        if tag in {"meta", "link", "br", "hr", "img", "input", "source", "area", "base", "embed", "param", "track", "wbr"}:
            return
        if not self.stack or self.stack[-1][0] != tag:
            invalid("malformed_pair_html")
        self.stack.pop()
    def handle_data(self, data):
        if self.stack and self.stack[-1][2] is not None and not any(
            tag in {"script", "style", "head", "template"} for tag, _, _ in self.stack
        ):
            self.stack[-1][2]["text"].append(data)

def tree_hash(files, root):
    manifest = {name[len(root) + 1:]: digest(raw) for name, raw in sorted(files.items()) if name.startswith(root + "/")}
    return digest(json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode())

def validate_pair(files, pair, slug):
    ai = safe_path(pair.ai_root)
    human = safe_path(pair.human_root)
    if ai == human or ai.startswith(human + "/") or human.startswith(ai + "/"):
        invalid("pair_roots_overlap")
    if pair.specification_id != slug:
        invalid("pair_identity_mismatch")
    entry = ai + "/SKILL.md"
    human_entry = human + "/index.html"
    required = {entry, human_entry, human + "/styles.css", human + "/app.js"}
    if not required.issubset(files) or any(not name.startswith((ai + "/", human + "/")) for name in files):
        invalid("pair_incomplete")
    try:
        skill = files[entry].decode("utf-8")
        parts = skill.split("---", 2)
        if len(parts) != 3 or parts[0].strip(): invalid("pair_binding_mismatch")
        header = yaml.safe_load(parts[1])
        metadata = header["metadata"]
        if header["name"] != slug or metadata["specification-id"] != slug or metadata["ai-root"].rstrip("/") != ai or metadata["human-entry"] != human_entry:
            invalid("pair_binding_mismatch")
        html = files[human_entry].decode("utf-8")
        parser = CoverageParser()
        parser.feed(html)
        parser.close()
        if parser.stack or parser.placeholder or "[[" in html or parser.language != "ko":
            invalid("pair_human_incomplete")
        expected_meta = {"agent-factory:specification-id": slug, "agent-factory:ai-root": ai + "/", "agent-factory:ai-binding-entry": entry}
        if any(parser.meta.get(k) != v for k, v in expected_meta.items()):
            invalid("pair_binding_mismatch")
        names = sorted((name for name in files if name.startswith(ai + "/") and
                        (name.lower().endswith(".md") or (PurePosixPath(name).parent.name == "agents" and PurePosixPath(name).suffix.lower() in {".yaml", ".yml"}))),
                       key=lambda name: (name != entry, name))
        if list(parser.sources) != names: invalid("pair_coverage_missing")
        for name in names:
            source = parser.sources[name]
            if source["hash"] != digest(files[name]): invalid("pair_source_hash_mismatch")
            lines = files[name].decode("utf-8").splitlines(keepends=True)
            next_line = 1
            if not source["blocks"]: invalid("pair_coverage_missing")
            for block in source["blocks"]:
                match = re.fullmatch(r"([1-9][0-9]*)-([1-9][0-9]*)", block["range"] or "")
                if not match: invalid("pair_coverage_missing")
                start, end = map(int, match.groups())
                if start != next_line or end < start or end > len(lines): invalid("pair_coverage_missing")
                if block["hash"] != digest("".join(lines[start-1:end]).encode()): invalid("pair_source_hash_mismatch")
                rendered = "".join(block["text"]).strip()
                if not rendered or not re.search(r"[가-힣]", rendered): invalid("pair_human_incomplete")
                next_line = end + 1
            if next_line != len(lines) + 1: invalid("pair_coverage_missing")
        if pair.review.ai_sha256 != tree_hash(files, ai) or pair.review.human_sha256 != tree_hash(files, human):
            invalid("pair_review_stale")
        return {"coverage": "complete", "sources": names, "semantic_alignment": "review_attested", **pair.model_dump(mode="json")}
    except (UnicodeError, ValueError, KeyError, TypeError, AttributeError, yaml.YAMLError, RecursionError):
        invalid("pair_invalid")
