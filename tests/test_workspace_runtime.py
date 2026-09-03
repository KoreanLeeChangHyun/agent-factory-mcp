from __future__ import annotations

import functools
import http.client
import importlib.util
import json
import os
import stat
import subprocess
import tempfile
import threading
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SERVER_PATH = ROOT / "app" / "infrastructure" / "workspace" / "runtime.py"
LAUNCHER_PATH = ROOT / "deploy" / "workspace.sh"
ASSET_ROOT = ROOT / "static" / "workspace"
PACKAGED_BROWSER_ASSETS = (
    Path("index.html"),
    Path("styles.css"),
    Path("app.js"),
    Path("THIRD_PARTY_NOTICES.txt"),
    Path("vendor/tabulator/6.5.2/tabulator.min.js"),
    Path("vendor/tabulator/6.5.2/tabulator.min.css"),
    Path("vendor/tabulator/6.5.2/LICENSE"),
)
ORIGINAL_SEARCH_COLUMNS = (
    "문서 분류",
    "출처",
    "태그",
    "문서 이름",
    "확장자",
    "수정 일자",
)

SPEC = importlib.util.spec_from_file_location("workspace_serve", SERVER_PATH)
assert SPEC is not None and SPEC.loader is not None
SERVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVER)


class WorkspaceBrowserServerTests(unittest.TestCase):
    def test_workspace_uses_readable_korean_font_stacks(self) -> None:
        styles = (ASSET_ROOT / "styles.css").read_text(encoding="utf-8")

        self.assertIn("--font-sans:", styles)
        self.assertIn('"Noto Sans CJK KR"', styles)
        self.assertIn('"Malgun Gothic"', styles)
        self.assertIn("font-family: var(--font-sans)", styles)
        self.assertIn("--font-mono:", styles)
        self.assertIn('"Noto Sans Mono CJK KR"', styles)
        self.assertIn("font: 13px/1.55 var(--font-mono)", styles)
        self.assertNotIn("Inter", styles)
        self.assertNotIn("font-size: 11px", styles)

    @staticmethod
    def _tree_names(nodes: list[dict[str, object]]) -> set[str]:
        names: set[str] = set()
        for node in nodes:
            names.add(str(node["name"]))
            names.update(
                WorkspaceBrowserServerTests._tree_names(
                    node.get("children", [])  # type: ignore[arg-type]
                )
            )
        return names

    @staticmethod
    def _create_servable_workspace(project_root: Path) -> Path:
        workspace_root = project_root / SERVER.WORKSPACE_RELATIVE_PATH
        for activity in ("common", *SERVER.ACTIVITY_DIRECTORIES):
            (workspace_root / activity).mkdir(parents=True, exist_ok=True)
        (project_root / SERVER.HUMAN_SPECIFICATION_RELATIVE_PATH).mkdir(parents=True)
        return workspace_root

    @staticmethod
    def _create_specification_pair(
        project_root: Path, specification_id: str, title: str
    ) -> tuple[Path, Path]:
        skill_root = project_root / "skills" / specification_id
        human_root = project_root / SERVER.HUMAN_SPECIFICATION_RELATIVE_PATH / specification_id
        skill_root.mkdir(parents=True)
        human_root.mkdir(parents=True)
        skill_entry = skill_root / "SKILL.md"
        human_entry = human_root / "index.html"
        skill_entry.write_text(
            "\n".join(
                (
                    "---",
                    f"name: {specification_id}",
                    "metadata:",
                    f"  specification-id: {specification_id}",
                    f"  human-entry: .agent-factory/document/specification/{specification_id}/index.html",
                    f"  ai-root: skills/{specification_id}/",
                    "---",
                    "",
                )
            ),
            encoding="utf-8",
        )
        human_entry.write_text(
            "".join(
                (
                    '<!doctype html><html lang="ko"><head>',
                    f'<meta name="agent-factory:specification-id" content="{specification_id}">',
                    f'<meta name="agent-factory:ai-root" content="skills/{specification_id}/">',
                    f'<meta name="agent-factory:ai-binding-entry" content="skills/{specification_id}/SKILL.md">',
                    f"<title>{title}</title></head><body></body></html>",
                )
            ),
            encoding="utf-8",
        )
        return skill_entry, human_entry

    def test_launcher_is_regular_and_executable(self) -> None:
        self.assertTrue(LAUNCHER_PATH.is_file())
        self.assertFalse(LAUNCHER_PATH.is_symlink())
        self.assertTrue(LAUNCHER_PATH.stat().st_mode & stat.S_IXUSR)
        self.assertTrue(os.access(LAUNCHER_PATH, os.X_OK))
        self.assertIn(
            'self.send_header("Cache-Control", "no-store")',
            LAUNCHER_PATH.read_text(encoding="utf-8"),
        )

    def test_launcher_resolves_its_physical_file_and_is_self_contained(self) -> None:
        launcher = LAUNCHER_PATH.read_text(encoding="utf-8")
        self.assertIn("link_limit=40", launcher)
        self.assertIn('while [ -L "$script_path" ]; do', launcher)
        self.assertIn("too many symbolic links while resolving launcher", launcher)
        self.assertIn('link_target=$(readlink "$script_path")', launcher)
        self.assertIn("/*) script_path=$link_target", launcher)
        self.assertIn('script_path=$(dirname "$script_path")/$link_target', launcher)
        self.assertIn("link_limit=$((link_limit - 1))", launcher)
        self.assertIn(
            'script_dir=$(CDPATH= cd -P "$(dirname "$script_path")" && pwd)',
            launcher,
        )
        self.assertIn('exec python3 - "$project_root" "$port" <<\'PY\'', launcher)
        self.assertNotIn("serve.py", launcher)

    def test_launcher_is_loopback_only_and_opens_common_by_default(self) -> None:
        launcher = LAUNCHER_PATH.read_text(encoding="utf-8")
        self.assertIn('ThreadingHTTPServer(("127.0.0.1", 0), Handler)', launcher)
        self.assertIn("candidate.server_address[1] != forbidden_port", launcher)
        self.assertIn("publish_port_state(server.server_address[1])", launcher)
        self.assertIn('/common/"', launcher)
        self.assertNotIn("allow-non-loopback", launcher)

    def test_launcher_accepts_named_port_and_rejects_invalid_arguments(self) -> None:
        launcher = LAUNCHER_PATH.read_text(encoding="utf-8")
        for contract in (
            "port=",
            "-p|--port)",
            "-h|--help)",
            'if [ "$#" -lt 2 ]',
            "case $2 in",
            "-[0-9]*) ;;",
            "-*)",
            "*)",
            "usage >&2",
            "exit 0",
            "exit 2",
            "port 8000 is reserved and cannot be used",
            'exec python3 - "$project_root" "$port"',
        ):
            with self.subTest(contract=contract):
                self.assertIn(contract, launcher)

    def test_launcher_refuses_missing_tree_and_prevents_symlink_escape(self) -> None:
        launcher = LAUNCHER_PATH.read_text(encoding="utf-8")
        self.assertIn("Workspace tree is missing", launcher)
        self.assertIn("workspace_root.relative_to(project_root)", launcher)
        self.assertIn("candidate.relative_to(root)", launcher)

    def test_packaged_assets_form_one_workspace_shell(self) -> None:
        self.assertEqual(set(PACKAGED_BROWSER_ASSETS), SERVER.PACKAGED_BROWSER_ASSET_PATHS)
        for relative_path in PACKAGED_BROWSER_ASSETS:
            self.assertTrue((ASSET_ROOT / relative_path).is_file())
        script = (ASSET_ROOT / "app.js").read_text(encoding="utf-8")
        self.assertNotIn('fetch("/api/explorer-tree"', script)
        self.assertNotIn('fetch("/api/project-skills"', script)

    def test_primary_sidebar_hosts_the_selected_activity_view(self) -> None:
        html = (ASSET_ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("data-sidebar-host", html)
        self.assertEqual(SERVER.ACTIVITY_DIRECTORIES, ("explorer", "skills"))
        activities = (
            ("schedule", "일정"),
            ("agents", "에이전트"),
            ("documents", "문서"),
            ("external-integrations", "외부연동"),
            ("logs", "로그"),
            ("tests", "테스트"),
        )
        positions = []
        for activity, label in activities:
            self.assertIn(f'data-activity="{activity}"', html)
            self.assertIn(f'aria-label="{label}"', html)
            self.assertIn(f'data-sidebar-view="{activity}"', html)
            self.assertIn(f'data-workspace-view="{activity}"', html)
            positions.append(html.index(f'data-activity="{activity}"'))
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(html.count('data-activity="'), 6)
        self.assertGreaterEqual(html.count("정의 대기"), 8)
        self.assertNotIn('data-activity="roadmap"', html)
        self.assertNotIn('data-activity="explorer"', html)
        self.assertNotIn('data-activity="skills"', html)
        self.assertNotIn('data-activity="planning"', html)
        self.assertEqual(2, html.count('role="tree"'))
        self.assertNotIn("목차", html)

    def test_document_sidebar_has_decided_groups_and_navigation(self) -> None:
        html = (ASSET_ROOT / "index.html").read_text(encoding="utf-8")
        group_labels = (
            '<span id="original-group-label">원본 문서</span>',
            '<span id="processed-group-label">가공 문서</span>',
            '<span id="specification-group-label">명세 문서</span>',
        )
        positions = [html.index(label) for label in group_labels]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(3, html.count("data-document-group-toggle"))
        self.assertEqual(2, html.count("data-document-tree-toggle"))
        self.assertEqual(5, html.count('aria-expanded="true"'))
        self.assertEqual(2, html.count("<span>탐색기</span>"))
        self.assertIn('aria-label="원본 문서 보기"', html)
        self.assertIn('data-document-target="original-overview">', html)
        self.assertIn('data-document-target="original-search">문서검색</a>', html)
        self.assertIn('aria-label="가공 문서 보기"', html)
        self.assertIn('data-document-target="processed-overview">', html)
        self.assertIn('aria-label="명세 문서 보기"', html)
        self.assertIn('data-document-target="specification-overview">', html)
        self.assertEqual(3, html.count("<span>개요</span>"))
        self.assertGreaterEqual(html.count('aria-hidden="true" focusable="false"'), 5)
        self.assertNotIn("명세문서 보기", html)

        document_sidebar_start = html.index('<div class="sidebar-view document-sidebar"')
        document_sidebar_end = html.index(
            '<section class="sidebar-view external-integration-sidebar" '
            'data-sidebar-view="external-integrations"',
            document_sidebar_start,
        )
        document_sidebar = html[document_sidebar_start:document_sidebar_end]
        self.assertEqual(2, document_sidebar.count('role="region"'))
        self.assertEqual(0, document_sidebar.count('role="treeitem"'))
        self.assertEqual(2, document_sidebar.count("aria-describedby="))
        self.assertIn('id="processed-tree-state"', document_sidebar)
        self.assertIn('id="specification-tree-state"', document_sidebar)
        self.assertNotIn(
            "문서 연결 방식은 Human 결정을 기다리고 있습니다",
            document_sidebar,
        )
        self.assertIn("가공 문서를 불러오는 중입니다.", document_sidebar)
        self.assertIn("data-processed-document-list", document_sidebar)
        self.assertIn("명세 문서를 불러오는 중입니다.", document_sidebar)
        self.assertIn("data-specification-list", document_sidebar)
        specification_group = document_sidebar[
            document_sidebar.index('id="specification-group-content"') :
        ]
        nested_positions = [
            specification_group.index('data-document-target="specification-overview"'),
            specification_group.index("data-document-tree-toggle"),
            specification_group.index('id="specification-tree-content"'),
            specification_group.index("data-specification-list"),
        ]
        self.assertEqual(nested_positions, sorted(nested_positions))
        self.assertNotIn("legacy-inquery", document_sidebar)
        self.assertNotIn("notes.md", document_sidebar)

    def test_original_document_views_have_compact_overview_and_search_shapes(self) -> None:
        html = (ASSET_ROOT / "index.html").read_text(encoding="utf-8")
        search_start = html.index('id="document-original-search"')
        search_end = html.index("</article>", search_start)
        search_view = html[search_start:search_end]
        overview_start = html.index('id="document-original-overview"')
        overview_end = html.index("</article>", overview_start)
        overview_view = html[overview_start:overview_end]
        for original_view in (overview_view, search_view):
            self.assertNotIn('class="editor-header"', original_view)
            self.assertNotIn('class="editor-header__tab"', original_view)
        self.assertIn("<table", search_view)
        self.assertIn("<caption>", search_view)
        heading_positions = [
            search_view.index(f'<th scope="col">{heading}</th>')
            for heading in ORIGINAL_SEARCH_COLUMNS
        ]
        self.assertEqual(heading_positions, sorted(heading_positions))
        self.assertEqual(6, search_view.count('<th scope="col">'))
        self.assertIn('type="search"', search_view)
        self.assertIn("data-original-global-search", search_view)
        self.assertIn("disabled data-original-global-search", search_view)
        self.assertIn("data-original-table-fallback", search_view)
        self.assertIn("data-original-table", search_view)
        self.assertNotIn(
            "원본 문서 본문을 변경하거나 복제하지 않는 메타데이터·출처 링크 보기입니다.",
            search_view,
        )
        self.assertNotIn("<select", search_view)
        self.assertNotIn("<button", search_view)
        self.assertIn("데이터 연결 대기", search_view)

    def test_specification_workspace_is_the_only_initial_document_view(self) -> None:
        html = (ASSET_ROOT / "index.html").read_text(encoding="utf-8")
        document_view_openings = [
            line.strip() for line in html.splitlines() if "data-document-view=" in line
        ]
        self.assertEqual(6, len(document_view_openings))
        self.assertEqual(
            5,
            sum(" hidden" in opening for opening in document_view_openings),
        )
        self.assertNotIn(" hidden", document_view_openings[-1])
        self.assertIn(
            'data-document-view="original-overview" hidden',
            document_view_openings[0],
        )
        self.assertIn(
            'class="activity-button is-active" type="button" aria-label="문서" aria-pressed="true"',
            html,
        )

        styles = (ASSET_ROOT / "styles.css").read_text(encoding="utf-8")
        self.assertIn("--primary-sidebar-width: 252px", styles)
        self.assertIn(".document-group__toggle", styles)
        self.assertIn("height: 22px", styles)
        self.assertIn(".document-navigation__item.is-selected:focus", styles)
        self.assertIn(".editor-header__tab", styles)
        self.assertEqual(3, html.count('class="editor-header__tab"'))
        self.assertIn("가공 문서 / 개요", html)
        self.assertIn("명세 문서 / 개요", html)
        self.assertIn(".document-view__canvas", styles)
        self.assertNotIn("linear-gradient", styles)
        self.assertNotIn("box-shadow", styles)

    def test_document_separators_preserve_internal_borders_and_omit_terminal_divider(
        self,
    ) -> None:
        styles = (ASSET_ROOT / "styles.css").read_text(encoding="utf-8")
        self.assertIn(
            ".document-group {\n  border-bottom: 1px solid var(--region-border);\n}",
            styles,
        )
        self.assertIn(
            ".document-sidebar > .document-group:last-child {\n  border-bottom: 0;\n}",
            styles,
        )
        self.assertIn(
            ".primary-sidebar {\n  min-width: 0;\n  overflow: hidden;\n"
            "  border: 1px solid var(--region-border);\n"
            "  border-radius: var(--surface-radius);\n"
            "  background: var(--primary-sidebar-background);",
            styles,
        )
        self.assertIn(
            ".primary-sidebar__header {\n"
            "  display: flex;\n"
            "  height: 27px;\n"
            "  align-items: center;\n"
            "  padding-inline: 20px;\n"
            "  border-bottom: 1px solid var(--region-border);",
            styles,
        )
        self.assertIn(
            ".primary-sidebar__content {\n"
            "  height: calc(100% - 27px);\n"
            "  overflow-x: hidden;\n"
            "  overflow-y: auto;\n}",
            styles,
        )
        self.assertIn(
            ".original-search .tabulator .tabulator-header {\n  border-bottom: 1px solid #3c3c3c;",
            styles,
        )

    def test_document_group_icons_are_decorative_svg_and_controls_are_named(self) -> None:
        html = (ASSET_ROOT / "index.html").read_text(encoding="utf-8")
        self.assertEqual(3, html.count("data-document-group-toggle"))
        for label_id, label in (
            ("original-group-label", "원본 문서"),
            ("processed-group-label", "가공 문서"),
            ("specification-group-label", "명세 문서"),
        ):
            label_position = html.index(f'<span id="{label_id}">{label}</span>')
            toggle_start = html.rfind(
                '<button class="document-group__toggle primary-sidebar-group-row"',
                0,
                label_position,
            )
            toggle_end = html.index("</button>", label_position)
            self.assertGreaterEqual(toggle_start, 0)
            toggle = html[toggle_start:toggle_end]
            self.assertIn('type="button"', toggle)
            self.assertIn('aria-expanded="true"', toggle)
            self.assertIn("<svg", toggle)
            self.assertIn('aria-hidden="true"', toggle)
            self.assertIn('focusable="false"', toggle)

    def test_only_original_document_views_use_the_compact_workspace_inset(self) -> None:
        styles = (ASSET_ROOT / "styles.css").read_text(encoding="utf-8")
        compact_rule = """.document-view[data-document-view="original-overview"] .document-view__canvas,
.document-view[data-document-view="original-search"] .document-view__canvas {
  max-width: none;
  padding: var(--compact-workspace-inset);
}"""
        self.assertIn("--compact-workspace-inset: 12px", styles)
        self.assertEqual(1, styles.count(compact_rule))
        self.assertNotIn(
            'data-document-view="processed-overview"] .document-view__canvas',
            styles,
        )
        self.assertNotIn(
            'data-document-view="specification-overview"] .document-view__canvas',
            styles,
        )
        self.assertIn(
            "padding: 24px clamp(24px, 5vw, 56px) 40px",
            styles,
        )

    def test_activity_icons_are_distinct_accessible_inline_svg(self) -> None:
        html = (ASSET_ROOT / "index.html").read_text(encoding="utf-8")
        nav_start = html.index('<nav class="activity-bar"')
        nav_end = html.index("</nav>", nav_start) + len("</nav>")
        activity_bar = ET.fromstring(html[nav_start:nav_end])
        buttons = activity_bar.findall("./button")
        expected = (
            ("schedule", "일정"),
            ("agents", "에이전트"),
            ("documents", "문서"),
            ("external-integrations", "외부연동"),
            ("logs", "로그"),
            ("tests", "테스트"),
        )

        signatures = []
        icons_by_activity = {}
        for button, (activity, label) in zip(buttons, expected, strict=True):
            self.assertEqual(activity, button.attrib["data-activity"])
            self.assertEqual(label, button.attrib["aria-label"])
            self.assertEqual(label, "".join(button.itertext()).strip())

            visible_label = button.find("span")
            self.assertIsNotNone(visible_label)
            assert visible_label is not None
            self.assertEqual("activity-button__label", visible_label.attrib["class"])
            self.assertEqual(label, visible_label.text)

            svg = button.find("svg")
            self.assertIsNotNone(svg)
            assert svg is not None
            self.assertEqual("0 0 24 24", svg.attrib["viewBox"])
            self.assertEqual("true", svg.attrib["aria-hidden"])
            self.assertEqual("false", svg.attrib["focusable"])
            icons_by_activity[activity] = svg

            elements = tuple(svg.iter())[1:]
            self.assertTrue(elements)
            self.assertFalse(
                {"text", "image", "foreignObject"} & {element.tag for element in elements}
            )
            signatures.append(
                tuple((element.tag, tuple(sorted(element.attrib.items()))) for element in elements)
            )

        self.assertEqual(len(expected), len(buttons))
        self.assertEqual(len(expected), len(set(signatures)))
        self.assertNotIn("<img", html[nav_start:nav_end].lower())

        document_tags = tuple(
            element.tag for element in tuple(icons_by_activity["documents"].iter())[1:]
        )
        log_icon = icons_by_activity["logs"]
        log_tags = tuple(element.tag for element in tuple(log_icon.iter())[1:])
        self.assertNotIn("rect", document_tags)
        self.assertEqual(["path", "path"], [child.tag for child in log_icon])
        document_path_data = {
            child.attrib["d"] for child in icons_by_activity["documents"] if child.tag == "path"
        }
        log_path_data = {child.attrib["d"] for child in log_icon}
        self.assertNotEqual(document_path_data, log_path_data)
        self.assertEqual(
            {"M12 8l0 4l2 2", "M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"},
            log_path_data,
        )
        self.assertNotIn("g", log_tags)
        self.assertNotIn("rect", log_tags)
        self.assertNotIn("polyline", log_tags)
        self.assertNotIn("circle", log_tags)
        self.assertIn("Tabler History", html)
        self.assertIn("THIRD_PARTY_NOTICES.txt", html)
        self.assertNotIn("Lucide", html)

        notice = (ASSET_ROOT / "THIRD_PARTY_NOTICES.txt").read_text(encoding="utf-8")
        normalized_notice = " ".join(notice.split())
        for required_notice_text in (
            "Copyright (c) 2020-2026 Paweł Kuna",
            "Permission is hereby granted, free of charge",
            "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell",
            "this permission notice shall be included in all",
            'THE SOFTWARE IS PROVIDED "AS IS"',
            "WITHOUT WARRANTY OF ANY KIND",
            "IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE",
            "https://tabler.io/icons/icon/history",
            "https://github.com/tabler/tabler-icons/blob/main/LICENSE",
            "Tabulator 6.5.2",
            "https://registry.npmjs.org/tabulator-tables/-/tabulator-tables-6.5.2.tgz",
            "Copyright (c) 2015-2026 Oli Folkerd",
            "vendor/tabulator/6.5.2/tabulator.min.js",
            "vendor/tabulator/6.5.2/tabulator.min.css",
        ):
            self.assertIn(required_notice_text, normalized_notice)
        self.assertNotIn("Lucide", normalized_notice)
        self.assertNotIn("ISC License", normalized_notice)

        styles = (ASSET_ROOT / "styles.css").read_text(encoding="utf-8")
        self.assertEqual(2, styles.count("--activity-bar-width: 68px"))
        self.assertIn("--activity-bar-background: #181818", styles)
        self.assertIn("--activity-item-hover-background: #2a2d2e", styles)
        self.assertIn("--activity-item-active-background: #1f1f1f", styles)
        self.assertIn("--activity-item-active-border: #0078d4", styles)
        self.assertIn("--primary-sidebar-background: #181818", styles)
        self.assertIn("--workspace-background: #1f1f1f", styles)
        self.assertIn("--region-border: #2b2b2b", styles)
        self.assertIn("--focus-border: #0078d4", styles)
        self.assertIn(".activity-button__label", styles)
        activity_button_start = styles.index(".activity-button {")
        activity_button_end = styles.index("}", activity_button_start)
        activity_button_rule = styles[activity_button_start:activity_button_end]
        self.assertIn("flex-direction: column", activity_button_rule)
        self.assertIn("justify-content: center", activity_button_rule)
        activity_hover_start = styles.index(".activity-button:hover {")
        activity_hover_end = styles.index("}", activity_hover_start)
        activity_hover_rule = styles[activity_hover_start:activity_hover_end]
        self.assertIn(
            "background: var(--activity-item-hover-background)",
            activity_hover_rule,
        )
        activity_active_start = styles.index(".activity-button.is-active {")
        activity_active_end = styles.index("}", activity_active_start)
        activity_active_rule = styles[activity_active_start:activity_active_end]
        self.assertIn(
            "background: var(--activity-item-active-background)",
            activity_active_rule,
        )
        activity_label_start = styles.index(".activity-button__label {")
        activity_label_end = styles.index("}", activity_label_start)
        activity_label_rule = styles[activity_label_start:activity_label_end]
        self.assertIn("width: 100%", activity_label_rule)
        self.assertIn("text-align: center", activity_label_rule)
        self.assertIn("white-space: nowrap", activity_label_rule)
        self.assertNotIn("text-overflow", activity_label_rule)
        self.assertIn(".activity-button:focus-visible", styles)
        self.assertIn("outline: 1px solid var(--focus-border)", styles)
        self.assertIn(".activity-button.is-active", styles)
        self.assertIn("stroke: currentColor", styles)
        self.assertNotIn(".activity-button::before", styles)
        self.assertNotIn(".activity-button::after", styles)
        forbidden_assets = ("icon-font", ".png", ".jpg", ".jpeg", ".gif", ".webp")
        for forbidden in forbidden_assets:
            self.assertNotIn(forbidden, styles.lower())

    def test_external_integration_is_a_regular_activity(self) -> None:
        html = (ASSET_ROOT / "index.html").read_text(encoding="utf-8")
        script = (ASSET_ROOT / "app.js").read_text(encoding="utf-8")
        styles = (ASSET_ROOT / "styles.css").read_text(encoding="utf-8")

        self.assertEqual(6, html.count('data-activity="'))
        self.assertIn('data-activity="external-integrations"', html)
        self.assertIn('aria-label="외부연동"', html)
        self.assertIn('data-sidebar-view="external-integrations"', html)
        self.assertIn('data-workspace-view="external-integrations"', html)
        self.assertIn("외부연동 상태 연결 대기", html)
        self.assertNotIn("m.leechanghyun@gmail.com", html)

        sidebar_start = html.index('data-sidebar-view="external-integrations"')
        sidebar_end = html.index("</section>", sidebar_start)
        sidebar = html[sidebar_start:sidebar_end]
        categories = (
            "웹·리서치",
            "문서·파일",
            "메일·메시지",
            "일정·회의",
            "지식·업무관리",
            "개발·운영",
            "데이터·비즈니스",
        )
        positions = [sidebar.index(category) for category in categories]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(
            7,
            sidebar.count('class="external-integration-category primary-sidebar-group-row"'),
        )
        self.assertEqual(10, html.count("primary-sidebar-group-row"))
        self.assertNotIn("<button", sidebar)
        self.assertNotIn("<a ", sidebar)
        self.assertNotIn("연동 분류</h2>", sidebar)
        self.assertIn('aria-label="외부연동 대분류"', sidebar)

        activity_start = html.index('aria-label="외부연동"')
        activity_end = html.index("</button>", activity_start)
        activity = html[activity_start:activity_end]
        self.assertIn("<svg", activity)
        self.assertIn('aria-hidden="true"', activity)
        self.assertIn('focusable="false"', activity)
        self.assertIn('<span class="activity-button__label">외부연동</span>', activity)

        self.assertNotIn(".activity-bar__utility", styles)
        self.assertNotIn(".external-integration-panel", styles)
        self.assertIn(".external-integration-view", styles)
        self.assertIn(".external-integration-categories", styles)
        self.assertIn(".primary-sidebar-group-row", styles)
        self.assertIn("height: 22px", styles)
        self.assertNotIn(".external-integration-sidebar__title", styles)

        self.assertIn("externalIntegrationAdapter.externalIntegrations", script)
        self.assertIn("replaceItems: replaceExternalIntegrations", script)
        self.assertIn("stable integrationIdentity", script)
        self.assertIn("integrationIdentity는 항목마다 고유", script)
        self.assertNotIn("externalIntegrationPanel", script)
        self.assertNotIn("closeExternalIntegrations", script)

    def test_shell_uses_spaced_rounded_bordered_surfaces_at_supported_widths(
        self,
    ) -> None:
        styles = (ASSET_ROOT / "styles.css").read_text(encoding="utf-8")
        for token in (
            "--shell-inset: 4px",
            "--shell-gap: 4px",
            "--surface-radius: 8px",
            "--shell-background: #141414",
        ):
            self.assertIn(token, styles)

        shell_rule = styles[
            styles.index(".workspace-shell {") : styles.index(
                "}", styles.index(".workspace-shell {")
            )
        ]
        self.assertIn("gap: var(--shell-gap)", shell_rule)
        self.assertIn("padding: var(--shell-inset)", shell_rule)
        self.assertIn("background: var(--shell-background)", shell_rule)

        for selector in (".activity-bar {", ".primary-sidebar {", ".workspace {"):
            rule_start = styles.index(selector)
            rule = styles[rule_start : styles.index("}", rule_start)]
            self.assertIn("border: 1px solid var(--region-border)", rule)
            self.assertIn("border-radius: var(--surface-radius)", rule)

        activity_rule_start = styles.index(".activity-button {")
        activity_rule = styles[activity_rule_start : styles.index("}", activity_rule_start)]
        self.assertIn("width: calc(100% - 8px)", activity_rule)
        self.assertIn("border-radius: 6px", activity_rule)
        self.assertIn("margin-top: 3px", activity_rule)
        self.assertIn("@media (max-width: 720px)", styles)
        self.assertIn("grid-row: 1 / -1", styles)
        self.assertIn("height: 100%;\n  min-height: 100%", styles)
        self.assertNotIn("height: 100vh", styles)

    def test_activity_behavior_switches_sidebar_and_workspace_context(self) -> None:
        script = (ASSET_ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn("const selectActivity", script)
        self.assertIn('button.setAttribute("aria-pressed", String(isActive))', script)
        self.assertIn("view.dataset.sidebarView !== activity", script)
        self.assertIn("view.dataset.workspaceView !== activity", script)
        self.assertIn("sidebarTitle.textContent = activityTitles[activity]", script)
        self.assertIn('schedule: "일정"', script)
        self.assertIn('agents: "에이전트"', script)
        self.assertIn('tests: "테스트"', script)
        self.assertNotIn("roadmap:", script)
        self.assertNotIn("explorer:", script)
        self.assertNotIn("skills:", script)
        self.assertIn('fetch("/api/specifications"', script)
        self.assertIn('fetch("/api/processed-documents"', script)
        self.assertIn("loadSpecifications();", script)
        self.assertIn("loadProcessedDocuments();", script)
        self.assertIn("compactDocumentTitle", script)
        self.assertIn('target !== "processed-document"', script)
        self.assertIn("const selectDocumentView", script)
        self.assertIn('item.setAttribute("aria-current", "page")', script)
        self.assertIn("view.hidden = view !== nextView", script)
        self.assertIn('toggle.setAttribute("aria-expanded", String(!isExpanded))', script)
        self.assertIn("content.hidden = isExpanded", script)
        self.assertIn('selectDocumentView("specification-document")', script)
        self.assertIn("initializeOriginalSearch();", script)

    def test_original_search_uses_pinned_local_tabulator_and_safe_read_only_adapter(self) -> None:
        html = (ASSET_ROOT / "index.html").read_text(encoding="utf-8")
        script = (ASSET_ROOT / "app.js").read_text(encoding="utf-8")
        styles = (ASSET_ROOT / "styles.css").read_text(encoding="utf-8")
        self.assertIn("./vendor/tabulator/6.5.2/tabulator.min.css", html)
        self.assertIn("./vendor/tabulator/6.5.2/tabulator.min.js", html)
        self.assertNotIn("unpkg.com", html)
        self.assertNotIn("cdn", html.lower())
        for title in ORIGINAL_SEARCH_COLUMNS:
            self.assertIn(f'title: "{title}"', script)
        self.assertEqual(3, script.count("...listFilter"))
        self.assertEqual(3, script.count("...textFilter"))
        self.assertIn("movableColumns: true", script)
        self.assertIn('layout: "fitColumns"', script)
        self.assertEqual(6, script.count("widthGrow:"))
        self.assertIn('field: "name", minWidth: 220, widthGrow: 2', script)
        self.assertIn("resizable: true", script)
        self.assertIn(".document-table-wrap {\n  margin-top: 8px;\n  overflow-x: auto;", styles)
        self.assertIn(".original-search .tabulator {\n  min-width: 900px;", styles)
        self.assertIn('document.createElement("a")', script)
        self.assertIn("link.textContent = name", script)
        self.assertIn('resolved.protocol === "http:" || resolved.protocol === "https:"', script)
        self.assertIn('link.rel = "noopener noreferrer"', script)
        self.assertIn('icon.setAttribute("aria-hidden", "true")', script)
        self.assertIn('icon.setAttribute("focusable", "false")', script)
        self.assertIn("window.agentFactoryWorkspace.originalSearch.replaceRows(rows)", script)
        self.assertNotIn('fetch("/api/original', script)

    def test_explorer_projection_separates_project_and_classified_documents(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            (project_root / "src").mkdir()
            (project_root / "src" / "main.py").write_text("private contents", encoding="utf-8")
            documents = project_root / SERVER.DOCUMENT_RELATIVE_PATH
            original = documents / "original" / "research-1"
            processed = documents / "processed"
            original.mkdir(parents=True)
            processed.mkdir(parents=True)
            (original / "source.bin").write_bytes(b"source contents")
            (processed / "notes.md").write_text("derived contents", encoding="utf-8")
            agent_runtime = project_root / ".agent-factory" / "agent" / "session"
            agent_runtime.mkdir(parents=True)
            (agent_runtime / "secret.json").write_text("runtime", encoding="utf-8")
            git_root = project_root / ".git"
            git_root.mkdir()
            (git_root / "config").write_text("sensitive", encoding="utf-8")
            codex_root = project_root / ".codex"
            codex_root.mkdir()
            (codex_root / "config.toml").write_text("control", encoding="utf-8")

            payload = SERVER.discover_explorer_trees(project_root)
            project_tree, document_tree = payload["trees"]
            self.assertEqual(("project", "evidence"), (project_tree["role"], document_tree["role"]))
            self.assertIn("main.py", self._tree_names(project_tree["children"]))
            self.assertNotIn("secret.json", self._tree_names(project_tree["children"]))
            self.assertNotIn("config", self._tree_names(project_tree["children"]))
            self.assertNotIn("config.toml", self._tree_names(project_tree["children"]))
            document_names = self._tree_names(document_tree["children"])
            self.assertIn("source.bin", document_names)
            self.assertIn("notes.md", document_names)
            serialized = json.dumps(payload, ensure_ascii=False)
            self.assertNotIn("private contents", serialized)
            self.assertNotIn("source contents", serialized)
            self.assertNotIn("derived contents", serialized)

    def test_explorer_projection_skips_symlinks_and_reports_missing_documents(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            outside = project_root.parent / f"{project_root.name}-outside"
            outside.mkdir()
            try:
                os.symlink(outside, project_root / "escape")
            except OSError as exc:
                outside.rmdir()
                self.skipTest(f"symlinks unavailable: {exc}")
            try:
                payload = SERVER.discover_explorer_trees(project_root)
                project_tree, document_tree = payload["trees"]
                self.assertNotIn("escape", self._tree_names(project_tree["children"]))
                self.assertEqual("missing", document_tree["state"])
            finally:
                (project_root / "escape").unlink()
                outside.rmdir()

    def test_explorer_projection_rejects_document_root_symlink_escape(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            outside = project_root.parent / f"{project_root.name}-document-outside"
            outside.mkdir()
            (outside / "secret.md").write_text("not visible", encoding="utf-8")
            document_path = project_root / SERVER.DOCUMENT_RELATIVE_PATH
            document_path.parent.mkdir(parents=True)
            try:
                os.symlink(outside, document_path)
            except OSError as exc:
                (outside / "secret.md").unlink()
                outside.rmdir()
                self.skipTest(f"symlinks unavailable: {exc}")
            try:
                document_tree = SERVER.discover_explorer_trees(project_root)["trees"][1]
                self.assertEqual("error", document_tree["state"])
                self.assertEqual([], document_tree["children"])
            finally:
                document_path.unlink()
                (outside / "secret.md").unlink()
                outside.rmdir()

    def test_explorer_projection_has_deterministic_entry_and_response_bounds(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            for index in range(12):
                (project_root / f"file-{index:02d}.txt").write_text("x", encoding="utf-8")
            with mock.patch.object(SERVER, "TREE_MAX_ENTRIES", 4):
                payload = SERVER.discover_explorer_trees(project_root)
            project_tree = payload["trees"][0]
            self.assertLessEqual(len(self._tree_names(project_tree["children"])), 4)
            self.assertTrue(payload["truncated"])
            self.assertLessEqual(
                len(SERVER._json_response_bytes(payload)), SERVER.TREE_MAX_RESPONSE_BYTES
            )
            with mock.patch.object(SERVER, "TREE_MAX_RESPONSE_BYTES", 8):
                with self.assertRaises(SERVER.ViewerError):
                    SERVER._json_response_bytes(payload)

    def test_explorer_tree_api_returns_metadata_only(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            common = project_root / "common"
            common.mkdir()
            (project_root / "visible.txt").write_text("not returned", encoding="utf-8")
            handler = functools.partial(
                SERVER.WorkspaceRequestHandler,
                served_roots={"common": common},
                project_root=project_root,
            )
            server = SERVER.ThreadingHTTPServer(("127.0.0.1", 0), handler)
            thread = threading.Thread(target=server.serve_forever)
            thread.start()
            try:
                connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1])
                connection.request("GET", "/api/explorer-tree")
                response = connection.getresponse()
                body = response.read()
                connection.close()
                self.assertEqual(200, response.status)
                self.assertEqual("nosniff", response.getheader("X-Content-Type-Options"))
                self.assertIn("visible.txt", body.decode("utf-8"))
                self.assertNotIn("not returned", body.decode("utf-8"))
                self.assertLessEqual(len(body), SERVER.TREE_MAX_RESPONSE_BYTES)
            finally:
                server.shutdown()
                thread.join()
                server.server_close()

    def test_project_skill_discovery_uses_only_actual_direct_skill_entries(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            skill_root = project_root / ".codex" / "skills"
            actual = skill_root / "domain-orders"
            actual.mkdir(parents=True)
            (actual / "SKILL.md").write_text("---\nname: domain-orders\n---\n", encoding="utf-8")
            (skill_root / "not-a-skill").mkdir()
            (skill_root / "loose.md").write_text("ignored", encoding="utf-8")

            self.assertEqual(
                SERVER.discover_project_skills(project_root),
                [
                    {
                        "name": "domain-orders",
                        "href": "/project-skills/domain-orders/SKILL.md",
                    }
                ],
            )

    def test_specification_discovery_requires_reciprocal_pair_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            self._create_specification_pair(project_root, "domain-orders", "주문 도메인 명세")
            _, misaligned_human = self._create_specification_pair(
                project_root, "domain-payments", "결제 도메인 명세"
            )
            misaligned_human.write_text(
                misaligned_human.read_text(encoding="utf-8").replace(
                    'content="skills/domain-payments/"',
                    'content="skills/wrong/"',
                ),
                encoding="utf-8",
            )
            missing_skill = project_root / "skills" / "domain-missing"
            missing_skill.mkdir(parents=True)
            (missing_skill / "SKILL.md").write_text(
                "\n".join(
                    (
                        "---",
                        "name: domain-missing",
                        "metadata:",
                        "  specification-id: domain-missing",
                        "  human-entry: .agent-factory/document/specification/domain-missing/index.html",
                        "  ai-root: skills/domain-missing/",
                        "---",
                    )
                ),
                encoding="utf-8",
            )

            specifications = {
                item["id"]: item for item in SERVER.discover_specifications(project_root)
            }
            self.assertEqual("paired", specifications["domain-orders"]["status"])
            self.assertEqual(
                "/planning/domain-orders/index.html",
                specifications["domain-orders"]["href"],
            )
            self.assertEqual("주문 도메인 명세", specifications["domain-orders"]["name"])
            self.assertEqual("misaligned", specifications["domain-payments"]["status"])
            self.assertIsNone(specifications["domain-payments"]["href"])
            self.assertEqual("missing-human", specifications["domain-missing"]["status"])
            self.assertIsNone(specifications["domain-missing"]["href"])

    def test_specification_api_returns_bound_human_documents(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            common = self._create_servable_workspace(project_root) / "common"
            self._create_specification_pair(project_root, "domain-orders", "주문 도메인 명세")
            handler = functools.partial(
                SERVER.WorkspaceRequestHandler,
                served_roots={
                    "common": common,
                    "planning": project_root / SERVER.HUMAN_SPECIFICATION_RELATIVE_PATH,
                },
                project_root=project_root,
            )
            server = SERVER.ThreadingHTTPServer(("127.0.0.1", 0), handler)
            thread = threading.Thread(target=server.serve_forever)
            thread.start()
            try:
                connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1])
                connection.request("GET", "/api/specifications")
                response = connection.getresponse()
                payload = json.loads(response.read().decode("utf-8"))
                connection.close()
                self.assertEqual(200, response.status)
                self.assertEqual("nosniff", response.getheader("X-Content-Type-Options"))
                self.assertIsNone(response.getheader("Cache-Control"))
                self.assertEqual(
                    [
                        {
                            "id": "domain-orders",
                            "name": "주문 도메인 명세",
                            "href": "/planning/domain-orders/index.html",
                            "status": "paired",
                        }
                    ],
                    payload["specifications"],
                )
            finally:
                server.shutdown()
                thread.join()
                server.server_close()

    def test_processed_document_discovery_and_api_expose_browser_packages(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            common = self._create_servable_workspace(project_root) / "common"
            processed_root = project_root / SERVER.PROCESSED_DOCUMENT_RELATIVE_PATH
            ready = processed_root / "research-summary"
            legacy = processed_root / "legacy-inquery-notes"
            ready.mkdir(parents=True)
            legacy.mkdir()
            (ready / "index.html").write_text(
                "<!doctype html><title>리서치 요약 문서</title><main>요약</main>",
                encoding="utf-8",
            )
            (legacy / "notes.md").write_text("legacy", encoding="utf-8")

            discovered = {
                item["id"]: item for item in SERVER.discover_processed_documents(project_root)
            }
            self.assertEqual("ready", discovered["research-summary"]["status"])
            self.assertEqual("리서치 요약 문서", discovered["research-summary"]["name"])
            self.assertEqual(
                "/processed/research-summary/index.html",
                discovered["research-summary"]["href"],
            )
            self.assertEqual("missing-entry", discovered["legacy-inquery-notes"]["status"])
            self.assertIsNone(discovered["legacy-inquery-notes"]["href"])

            handler = functools.partial(
                SERVER.WorkspaceRequestHandler,
                served_roots={"common": common, "processed": processed_root},
                project_root=project_root,
            )
            server = SERVER.ThreadingHTTPServer(("127.0.0.1", 0), handler)
            thread = threading.Thread(target=server.serve_forever)
            thread.start()
            try:
                connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1])
                connection.request("GET", "/api/processed-documents")
                response = connection.getresponse()
                payload = json.loads(response.read().decode("utf-8"))
                connection.close()
                self.assertEqual(200, response.status)
                self.assertEqual(2, len(payload["processedDocuments"]))
            finally:
                server.shutdown()
                thread.join()
                server.server_close()

    def test_static_workspace_and_specification_responses_are_no_store(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            common = self._create_servable_workspace(project_root) / "common"
            (common / "styles.css").write_text("body {}", encoding="utf-8")
            self._create_specification_pair(project_root, "domain-orders", "주문 도메인 명세")
            handler = functools.partial(
                SERVER.WorkspaceRequestHandler,
                served_roots={
                    "common": common,
                    "planning": project_root / SERVER.HUMAN_SPECIFICATION_RELATIVE_PATH,
                },
                project_root=project_root,
            )
            server = SERVER.ThreadingHTTPServer(("127.0.0.1", 0), handler)
            thread = threading.Thread(target=server.serve_forever)
            thread.start()
            try:
                for method, path, expected_body in (
                    ("GET", "/common/styles.css", b"body {}"),
                    ("HEAD", "/planning/domain-orders/index.html", b""),
                ):
                    with self.subTest(method=method, path=path):
                        connection = http.client.HTTPConnection(
                            "127.0.0.1", server.server_address[1]
                        )
                        connection.request(method, path)
                        response = connection.getresponse()
                        body = response.read()
                        connection.close()
                        self.assertEqual(200, response.status)
                        self.assertEqual(expected_body, body)
                        self.assertEqual("nosniff", response.getheader("X-Content-Type-Options"))
                        self.assertEqual("no-store", response.getheader("Cache-Control"))
                connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1])
                connection.request("GET", "/")
                response = connection.getresponse()
                response.read()
                connection.close()
                self.assertEqual(302, response.status)
                self.assertIsNone(response.getheader("Cache-Control"))
            finally:
                server.shutdown()
                thread.join()
                server.server_close()

    def test_workspace_renders_discovered_specification_in_same_origin_frame(self) -> None:
        html = (ASSET_ROOT / "index.html").read_text(encoding="utf-8")
        script = (ASSET_ROOT / "app.js").read_text(encoding="utf-8")
        styles = (ASSET_ROOT / "styles.css").read_text(encoding="utf-8")
        close_contract_start = script.index("const closeSpecificationTab =")
        close_contract_end = script.index("const openSpecificationTab =", close_contract_start)
        close_contract = script[close_contract_start:close_contract_end]
        split_contract_start = script.index("const specificationGroupAtSubtreeEdge =")
        split_contract_end = script.index("const closeSpecificationTab =", split_contract_start)
        split_contract = script[split_contract_start:split_contract_end]
        drag_reset_start = script.index("const resetSpecificationDragState =")
        drag_reset_end = script.index("const draggedSpecification =", drag_reset_start)
        drag_reset_contract = script[drag_reset_start:drag_reset_end]
        tab_move_start = script.index("const reorderSpecificationTab =")
        tab_move_end = script.index("const createSpecificationGroup =", tab_move_start)
        tab_move_contract = script[tab_move_start:tab_move_end]
        empty_group_style_start = styles.index(".specification-group-empty {")
        empty_group_style_end = styles.index(
            ".specification-group-empty[hidden]", empty_group_style_start
        )
        empty_group_style = styles[empty_group_style_start:empty_group_style_end]
        self.assertIn("data-specification-list", html)
        self.assertIn('aria-label="작업 표시줄"', html)
        self.assertIn('aria-label="기본 사이드바"', html)
        self.assertIn('aria-label="작업 영역"', html)
        self.assertIn('data-document-view="specification-document"', html)
        self.assertIn("data-specification-group-template", html)
        self.assertIn("data-specification-group", html)
        self.assertIn('role="tablist"', html)
        self.assertIn("data-specification-tab-list", html)
        self.assertIn("data-specification-tab-panels", html)
        self.assertIn("data-specification-group-empty hidden", html)
        self.assertNotIn('<span class="editor-header__tab">명세 문서 편집기</span>', html)
        self.assertIn('fetch("/api/specifications"', script)
        self.assertIn("resolved.origin !== window.location.origin", script)
        self.assertIn("/^\\/planning\\/([a-z0-9]+(?:-[a-z0-9]+)*)\\/index\\.html$/", script)
        self.assertIn("(expectedId !== null && pathMatch[1] !== expectedId)", script)
        self.assertIn("resolved.username", script)
        self.assertIn("resolved.password", script)
        self.assertIn("resolved.search", script)
        self.assertIn("resolved.hash", script)
        self.assertIn('selectDocumentView("specification-document")', script)
        self.assertIn("const displayName = item.name || item.id", script)
        self.assertIn(
            'tab.append(createPlainText(displayName, "specification-tab__label"))',
            script,
        )
        self.assertIn("tabChrome.append(tab, closeButton)", script)
        self.assertIn("tabList.append(tabChrome)", script)
        self.assertIn("panels.append(panel)", script)
        self.assertNotIn("tabList.replaceChildren", script)
        self.assertNotIn("panels.replaceChildren", script)
        self.assertIn(
            'tab.addEventListener("click", () => activateSpecificationTab(group, item.id))',
            script,
        )
        self.assertIn(
            'tab.addEventListener("keydown", (event) => handleSpecificationTabKeydown(group, event))',
            script,
        )
        self.assertIn('tabChrome.addEventListener("dragstart", (event) => {', script)
        self.assertIn(
            'tabChrome.addEventListener("dragend", resetSpecificationDragState)',
            script,
        )
        self.assertIn('closeButton.addEventListener("click", (event) => {', script)
        self.assertIn("tabChrome.draggable = true", script)
        self.assertIn("tabChrome.dataset.specificationTabChrome = item.id", script)
        self.assertIn("event.dataTransfer?.setData(specificationTabDragType, groupId)", script)
        self.assertIn('event.dataTransfer.effectAllowed = "move"', script)
        self.assertIn("const reorderSpecificationTab =", tab_move_contract)
        self.assertIn("const moveSpecificationTab =", tab_move_contract)
        self.assertIn("event.clientX < bounds.left + bounds.width / 2", tab_move_contract)
        self.assertIn(
            "tabList.insertBefore(tab, insertBeforeTarget ? target : target.nextSibling)",
            tab_move_contract,
        )
        self.assertIn('sourceGroup === targetGroup && zone === "tabs"', tab_move_contract)
        self.assertIn(
            'placeSpecificationGroup(targetGroup, item, zone === "tabs" ? "center" : zone)',
            tab_move_contract,
        )
        self.assertIn("closeSpecificationTab(sourceGroup, item.id)", tab_move_contract)
        self.assertNotIn("tab.append(closeButton)", script)
        self.assertIn('target !== "specification-document"', script)
        self.assertIn("documentTreeToggles.forEach", script)
        self.assertIn('documentWorkspace?.addEventListener("dragover"', script)
        self.assertIn('group.addEventListener("dragover"', script)
        self.assertIn('group.addEventListener("drop"', script)
        self.assertIn("placeSpecificationGroup(group, droppedItem, zone)", script)
        self.assertIn('zone === "left" || zone === "right"', script)
        self.assertIn('zone === "left" || zone === "top"', script)
        self.assertIn("targetGroup.replaceWith(split)", script)
        self.assertIn("activeSpecificationGroup", script)
        self.assertIn("group.dataset.activeSpecificationId", script)
        self.assertIn(
            'specificationEditorLayout.querySelector("[data-specification-group]")', script
        )
        self.assertIn("if (activateSpecificationTab(group, item.id)) return true", script)
        self.assertIn('tab.setAttribute("role", "tab")', script)
        self.assertIn('panel.setAttribute("role", "tabpanel")', script)
        self.assertIn('tab.setAttribute("aria-selected", "false")', script)
        self.assertIn('tab.setAttribute("aria-controls", panelId)', script)
        self.assertIn('panel.setAttribute("aria-labelledby", tabId)', script)
        self.assertIn('tab.setAttribute("aria-label", displayName)', script)
        self.assertIn("tab.title = displayName", script)
        self.assertIn("frame.title = `${displayName} 명세 문서`", script)
        self.assertIn("const applySpecificationFrameProjection = (frame)", script)
        self.assertIn(
            "frame.contentWindow?.location.origin !== window.location.origin",
            script,
        )
        self.assertIn(
            'frameDocument.documentElement.dataset.agentFactoryWorkspaceEmbedded = "true"',
            script,
        )
        self.assertIn('scrollbarStyle.id = "agent-factory-workspace-scrollbars"', script)
        self.assertIn("*::-webkit-scrollbar { width: 6px; height: 6px; }", script)
        self.assertIn("frameDocument.head?.append(scrollbarStyle)", script)
        self.assertIn(
            'frame.addEventListener("load", () => applySpecificationFrameProjection(frame))',
            script,
        )
        self.assertIn('closeButton.type = "button"', script)
        self.assertIn("closeButton.title = `${displayName} 닫기`", script)
        self.assertIn(
            'closeButton.setAttribute("aria-label", `${displayName} 닫기`)',
            script,
        )
        self.assertIn("closeButton.dataset.specificationTabClose = item.id", script)
        self.assertIn('group.addEventListener("focusin", (event) => {', script)
        self.assertIn(
            'if (event.target.closest("[data-specification-tab-close]")) return;',
            script,
        )
        self.assertIn('icon.setAttribute("aria-hidden", "true")', script)
        self.assertIn('icon.setAttribute("focusable", "false")', script)
        self.assertIn('path.setAttribute("d", "M4 4l8 8m0-8-8 8")', script)
        self.assertIn("event.stopPropagation()", script)
        self.assertIn("const closeSpecificationTab = (group, specificationId)", script)
        self.assertIn("const activateSpecificationTabLocally =", script)
        self.assertIn("const previouslyActiveGroup = activeSpecificationGroup", close_contract)
        self.assertIn(
            "const targetGroupWasActive = previouslyActiveGroup === group", close_contract
        )
        self.assertIn(
            'group.querySelector(`[data-specification-panel="${specificationId}"]`)',
            script,
        )
        self.assertIn(
            "const wasActive = group.dataset.activeSpecificationId === specificationId", script
        )
        self.assertIn("if (!wasActive)", script)
        self.assertIn("remainingTabs[Math.min(closingIndex, remainingTabs.length - 1)]", script)
        self.assertIn("if (targetGroupWasActive)", close_contract)
        self.assertIn(
            "return activateSpecificationTabLocally(group, nextTab.dataset.specificationTab);",
            close_contract,
        )
        self.assertIn(
            "else if (activeSpecificationGroup !== previouslyActiveGroup)",
            close_contract,
        )
        self.assertIn("setActiveSpecificationGroup(previouslyActiveGroup)", close_contract)
        self.assertIn('closingTab.closest(".specification-tab")?.remove()', script)
        self.assertIn("panel?.remove()", script)
        self.assertIn("delete group.dataset.activeSpecificationId", script)
        self.assertIn("resetSpecificationDragState()", close_contract)
        self.assertIn("updateSpecificationGroupEmptyState(group)", script)
        self.assertIn("return activateSpecificationTab(group, item.id)", script)
        self.assertIn("const normalizeSpecificationSplitTree =", split_contract)
        self.assertIn('.querySelectorAll(".specification-split")', split_contract)
        self.assertIn(").reverse()", split_contract)
        self.assertIn("if (children.length === 0)", split_contract)
        self.assertIn("else if (children.length === 1)", split_contract)
        self.assertIn("split.replaceWith(children[0])", split_contract)
        self.assertIn("const removeEmptySpecificationGroup =", split_contract)
        self.assertIn(
            "const groupWasFirst = parentSplit.firstElementChild === group", split_contract
        )
        self.assertIn(
            "const survivorRoot = groupWasFirst ? siblings[0] : siblings.at(-1)", split_contract
        )
        self.assertIn('groupWasFirst ? "first" : "last"', split_contract)
        self.assertIn("group.remove()", split_contract)
        self.assertIn("normalizeSpecificationSplitTree()", split_contract)
        self.assertIn("const activateSurvivingSpecificationGroup =", split_contract)
        self.assertIn("targetTab.dataset.specificationTab, true", split_contract)
        self.assertIn("const survivingGroups = specificationEditorLayout", close_contract)
        self.assertIn(".filter((candidate) => candidate !== group)", close_contract)
        self.assertIn("if (survivingGroups.length > 0)", close_contract)
        self.assertIn(
            "const closestSurvivor = removeEmptySpecificationGroup(group)", close_contract
        )
        self.assertIn(
            "if (targetGroupWasActive) activateSurvivingSpecificationGroup(closestSurvivor)",
            close_contract,
        )
        self.assertIn("updateSpecificationGroupEmptyState(group)", close_contract)
        self.assertIn('group.querySelectorAll("[data-specification-tab]")', close_contract)
        self.assertNotIn("document.querySelector", close_contract)
        self.assertIn("panel.hidden = panel.dataset.specificationPanel !== specificationId", script)
        for key in ("ArrowLeft", "ArrowRight", "Home", "End"):
            self.assertIn(f'event.key === "{key}"', script)
        self.assertIn('event.key !== "Enter"', script)
        self.assertIn('event.key !== " "', script)
        self.assertIn("link.title = fullName", script)
        self.assertIn('createPlainText(displayName, "document-navigation__label")', script)
        self.assertIn(
            "state.title = `${fullName} · ${specificationStatusLabel(item.status)}`", script
        )
        self.assertIn("data-specification-editor-empty", html)
        self.assertIn("frame.dataset.specificationFrame", script)
        self.assertIn(".specification-document-frame", styles)
        self.assertIn("background: var(--workspace-background)", styles)
        self.assertIn(".specification-tab-list", styles)
        self.assertIn(".specification-tab.is-active", styles)
        self.assertIn(".specification-tab.is-dragging", styles)
        self.assertIn('data-drop-zone="tabs"', styles)
        self.assertIn(".specification-tab__activation", styles)
        self.assertIn(".specification-tab__close", styles)
        self.assertIn("flex: 0 0 22px", styles)
        self.assertIn(".specification-tab__close:focus-visible", styles)
        self.assertIn(".specification-tab:focus-within .specification-tab__close", styles)
        self.assertIn(".specification-tab__close svg", styles)
        self.assertIn(".specification-group-empty[hidden]", styles)
        self.assertIn("inset: 27px 0 0", empty_group_style)
        self.assertIn("place-items: center", empty_group_style)
        self.assertNotIn("max-width", empty_group_style)
        self.assertNotIn("border:", empty_group_style)
        self.assertNotIn("background:", empty_group_style)
        self.assertNotIn("inset: 25%", styles)
        self.assertIn(
            "body.is-dragging-specification .specification-editor-layout.is-drop-target",
            styles,
        )
        self.assertIn(
            "body.is-dragging-specification .specification-editor-group[data-drop-zone]::after",
            styles,
        )
        self.assertIn(
            'body.is-dragging-specification .specification-editor-group[data-drop-zone="center"]::after {\n'
            "  inset: 27px 0 0;",
            styles,
        )
        for zone in ("left", "right", "top", "bottom"):
            self.assertIn(
                "body.is-dragging-specification "
                f'.specification-editor-group[data-drop-zone="{zone}"]::after',
                styles,
            )
        self.assertNotIn(
            "\n.specification-editor-group[data-drop-zone]::after",
            styles,
        )
        self.assertIn("draggedSpecificationId = null", drag_reset_contract)
        self.assertIn("draggedSpecificationTab = null", drag_reset_contract)
        self.assertIn(".specification-tab.is-dragging", drag_reset_contract)
        self.assertIn(
            'document.body.classList.remove("is-dragging-specification")',
            drag_reset_contract,
        )
        self.assertIn("clearSpecificationDropIndicators()", drag_reset_contract)
        self.assertIn(
            "if (!droppedItem) {\n      resetSpecificationDragState();",
            script,
        )
        self.assertIn(
            "if (!item) {\n    resetSpecificationDragState();",
            script,
        )
        self.assertIn(
            'link.addEventListener("dragend", resetSpecificationDragState)',
            script,
        )
        self.assertIn(
            'document.addEventListener("dragend", resetSpecificationDragState)',
            script,
        )
        self.assertIn(
            'document.addEventListener("drop", resetSpecificationDragState)',
            script,
        )
        self.assertIn(
            'window.addEventListener("blur", resetSpecificationDragState)',
            script,
        )
        self.assertIn('if (event.key === "Escape" && draggedSpecificationId)', script)
        self.assertIn('if (activity !== "documents") resetSpecificationDragState()', script)
        self.assertIn(
            'if (target !== "specification-document") resetSpecificationDragState()',
            script,
        )
        self.assertIn(".specification-tab-panel[hidden]", styles)
        self.assertIn("text-overflow: ellipsis", styles)
        self.assertIn(".is-dragging-specification .specification-document-frame", styles)
        self.assertIn("pointer-events: none", styles)
        self.assertIn(".specification-split--horizontal", styles)
        self.assertIn(".specification-split--vertical", styles)
        self.assertIn(".document-tree__toggle", styles)
        self.assertIn(".document-tree__content[hidden]", styles)
        self.assertIn(".document-navigation__item > span", styles)
        self.assertIn(
            ".document-navigation__item.is-selected:focus {\n"
            "  background: var(--explorer-row-active-selected);",
            styles,
        )
        self.assertNotIn(
            ".document-navigation:focus-within .document-navigation__item.is-selected",
            styles,
        )
        self.assertIn('link.className = "document-navigation__item"', script)
        self.assertIn("text-overflow: ellipsis", styles)
        self.assertIn("white-space: nowrap", styles)
        self.assertIn("overflow-x: hidden", styles)
        self.assertIn(
            ".document-tree__list {\n"
            "  width: 100%;\n"
            "  margin: 0;\n"
            "  overflow: hidden;\n"
            "  padding-block: 2px 6px;\n"
            "  padding-inline: 0;\n"
            "  list-style: none;\n}",
            styles,
        )
        self.assertIn("--document-tree-child-icon-inset: 22px", styles)
        self.assertIn(
            "padding-inline-start: var(--document-tree-child-icon-inset);",
            styles,
        )
        self.assertNotIn("--document-tree-parent-label-inset", styles)
        self.assertNotIn("--document-tree-level-indent", styles)
        self.assertNotIn("40px logical inset", styles)
        self.assertNotIn("padding-inline-start: 38px", styles)
        self.assertNotIn("padding-left: 38px", styles)

    def test_launcher_exposes_project_skill_projection(self) -> None:
        launcher = LAUNCHER_PATH.read_text(encoding="utf-8")
        self.assertIn('project_skills_path = project_root / ".codex" / "skills"', launcher)
        self.assertIn('"/api/project-skills"', launcher)
        self.assertIn('"/api/explorer-tree"', launcher)
        self.assertIn('"/api/specifications"', launcher)
        self.assertIn('"project-skills"', launcher)

    def test_init_creates_empty_activity_directories_and_preserves_content(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            asset_root = project_root / "packaged-assets"
            asset_root.mkdir()
            (asset_root / "index.html").write_text("asset", encoding="utf-8")
            workspace_root = project_root / SERVER.WORKSPACE_RELATIVE_PATH
            existing = workspace_root / "planning"
            existing.mkdir(parents=True)
            preserved = existing / "existing.html"
            preserved.write_text("preserve", encoding="utf-8")

            SERVER.install_assets(project_root, asset_root, False)

            for name in SERVER.ACTIVITY_DIRECTORIES:
                self.assertTrue((project_root / SERVER.WORKSPACE_RELATIVE_PATH / name).is_dir())
            specification_root = project_root / ".agent-factory" / "document" / "specification"
            self.assertTrue(specification_root.is_dir())
            self.assertFalse((specification_root / "human").exists())
            self.assertEqual("preserve", preserved.read_text(encoding="utf-8"))
            self.assertEqual(
                "/port.json\n",
                (workspace_root / ".gitignore").read_text(encoding="utf-8"),
            )

    def test_init_materializes_packaged_browser_files_byte_identically(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)

            SERVER.install_assets(project_root, ASSET_ROOT, False)

            installed_root = project_root / SERVER.WORKSPACE_RELATIVE_PATH / "common"
            for relative_path in PACKAGED_BROWSER_ASSETS:
                self.assertTrue((installed_root / relative_path).is_file())
                self.assertEqual(
                    (ASSET_ROOT / relative_path).read_bytes(),
                    (installed_root / relative_path).read_bytes(),
                )

    def test_normal_init_flow_has_no_catalog_side_effect(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            with (
                mock.patch.object(SERVER, "resolve_project_root", return_value=project_root),
                mock.patch.object(
                    SERVER, "install_assets", return_value=(4, 0, True)
                ) as install_assets,
            ):
                self.assertEqual(0, SERVER.main(["--project-root", str(project_root), "init"]))
            install_assets.assert_called_once_with(project_root, ASSET_ROOT, False)
            self.assertFalse((project_root / ".agent-factory" / "db.sqlite").exists())
            self.assertFalse(hasattr(SERVER, "initialize_catalog"))

    def test_init_rejects_activity_file_conflicts_before_copy(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            asset_root = project_root / "packaged-assets"
            asset_root.mkdir()
            (asset_root / "index.html").write_text("asset", encoding="utf-8")
            workspace_root = project_root / SERVER.WORKSPACE_RELATIVE_PATH
            workspace_root.mkdir(parents=True)
            (workspace_root / "skills").write_text("conflict", encoding="utf-8")

            with self.assertRaises(SERVER.ViewerError):
                SERVER.install_assets(project_root, asset_root, False)

            self.assertFalse((workspace_root / "common").exists())

    def test_init_rejects_activity_symlink_conflicts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            asset_root = project_root / "packaged-assets"
            asset_root.mkdir()
            (asset_root / "index.html").write_text("asset", encoding="utf-8")
            workspace_root = project_root / SERVER.WORKSPACE_RELATIVE_PATH
            workspace_root.mkdir(parents=True)
            outside = project_root / "outside"
            outside.mkdir()
            try:
                os.symlink(outside, workspace_root / "skills")
            except OSError as exc:
                self.skipTest(f"symlinks unavailable: {exc}")

            with self.assertRaises(SERVER.ViewerError):
                SERVER.install_assets(project_root, asset_root, False)

    def test_init_requires_force_before_replacing_a_changed_file(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            asset_root = project_root / "packaged"
            asset_root.mkdir()
            (asset_root / "index.html").write_text("packaged", encoding="utf-8")
            installed = project_root / ".agent-factory" / "workspace" / "common" / "index.html"
            installed.parent.mkdir(parents=True)
            installed.write_text("project change", encoding="utf-8")

            with self.assertRaises(SERVER.ViewerError):
                SERVER.install_assets(project_root, asset_root, force=False)
            self.assertEqual("project change", installed.read_text(encoding="utf-8"))

            copied, unchanged, _launcher_installed = SERVER.install_assets(
                project_root, asset_root, force=True
            )
            self.assertEqual((1, 0), (copied, unchanged))
            self.assertEqual("packaged", installed.read_text(encoding="utf-8"))

    def test_init_copies_launcher_once_with_executable_mode_and_never_overwrites(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            asset_root = project_root / "packaged-assets"
            asset_root.mkdir()
            (asset_root / "index.html").write_text("asset", encoding="utf-8")
            launcher_source = project_root / "packaged-workspace.sh"
            launcher_source.write_text("packaged launcher", encoding="utf-8")

            _copied, _unchanged, installed = SERVER.install_assets(
                project_root, asset_root, False, launcher_source
            )
            root_launcher = project_root / "workspace.sh"
            self.assertTrue(installed)
            self.assertEqual("packaged launcher", root_launcher.read_text(encoding="utf-8"))
            self.assertEqual(0o755, stat.S_IMODE(root_launcher.stat().st_mode))

            root_launcher.write_text("project launcher", encoding="utf-8")
            os.chmod(root_launcher, 0o600)
            _copied, _unchanged, installed = SERVER.install_assets(
                project_root, asset_root, True, launcher_source
            )
            self.assertFalse(installed)
            self.assertEqual("project launcher", root_launcher.read_text(encoding="utf-8"))
            self.assertEqual(0o600, stat.S_IMODE(root_launcher.stat().st_mode))

    def test_launcher_and_asset_conflicts_are_preflighted_before_any_copy(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            asset_root = project_root / "packaged-assets"
            asset_root.mkdir()
            (asset_root / "index.html").write_text("packaged", encoding="utf-8")
            launcher_source = project_root / "packaged-workspace.sh"
            launcher_source.write_text("launcher", encoding="utf-8")
            installed_asset = (
                project_root / SERVER.WORKSPACE_RELATIVE_PATH / "common" / "index.html"
            )
            installed_asset.parent.mkdir(parents=True)
            installed_asset.write_text("conflict", encoding="utf-8")

            with self.assertRaises(SERVER.ViewerError):
                SERVER.install_assets(project_root, asset_root, False, launcher_source)
            self.assertFalse((project_root / "workspace.sh").exists())

    def test_request_path_rejects_traversal(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            served_root = Path(temporary_directory)
            served_roots = {"common": served_root}
            for target in (
                "/common/../outside",
                "/common/%2e%2e/outside",
                "//outside",
            ):
                with self.subTest(target=target):
                    with self.assertRaises(SERVER.ViewerError):
                        SERVER.resolve_request_path(served_roots, target)

    def test_request_path_rejects_symlink_escape(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            workspace = Path(temporary_directory)
            served_root = workspace / "served"
            outside = workspace / "outside"
            served_root.mkdir()
            outside.mkdir()
            try:
                os.symlink(outside, served_root / "escape")
            except OSError as exc:
                self.skipTest(f"symlinks unavailable: {exc}")

            with self.assertRaises(SERVER.ViewerError):
                SERVER.resolve_request_path({"common": served_root}, "/common/escape/file.html")

    def test_non_loopback_hosts_require_the_explicit_override_contract(self) -> None:
        parser = SERVER.build_parser()
        args = parser.parse_args(["serve", "--host", "0.0.0.0"])
        self.assertFalse(args.allow_non_loopback)
        args = parser.parse_args(["serve", "--host", "0.0.0.0", "--allow-non-loopback"])
        self.assertTrue(args.allow_non_loopback)

    def test_automatic_port_is_persisted_and_reused(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            self._create_servable_workspace(project_root)
            with mock.patch.object(
                SERVER.ThreadingHTTPServer,
                "serve_forever",
                side_effect=KeyboardInterrupt,
            ):
                SERVER.serve(project_root, "127.0.0.1", None, False, False)
            state_path = project_root / SERVER.PORT_STATE_RELATIVE_PATH
            first = json.loads(state_path.read_text(encoding="utf-8"))["port"]
            self.assertIn(first, range(1, 65536))
            self.assertNotEqual(SERVER.FORBIDDEN_PORT, first)

            with mock.patch.object(
                SERVER.ThreadingHTTPServer,
                "serve_forever",
                side_effect=KeyboardInterrupt,
            ):
                SERVER.serve(project_root, "127.0.0.1", None, False, False)
            self.assertEqual(
                first,
                json.loads(state_path.read_text(encoding="utf-8"))["port"],
            )

    def test_occupied_saved_port_is_reassigned_after_successful_bind(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            self._create_servable_workspace(project_root)
            blocker = SERVER.socket.socket(SERVER.socket.AF_INET, SERVER.socket.SOCK_STREAM)
            blocker.bind(("127.0.0.1", 0))
            blocker.listen()
            occupied = blocker.getsockname()[1]
            (project_root / SERVER.PORT_STATE_RELATIVE_PATH).write_text(
                json.dumps({"version": SERVER.PORT_STATE_VERSION, "port": occupied}),
                encoding="utf-8",
            )
            try:
                with mock.patch.object(
                    SERVER.ThreadingHTTPServer,
                    "serve_forever",
                    side_effect=KeyboardInterrupt,
                ):
                    SERVER.serve(project_root, "127.0.0.1", None, False, False)
            finally:
                blocker.close()
            reassigned = json.loads(
                (project_root / SERVER.PORT_STATE_RELATIVE_PATH).read_text(encoding="utf-8")
            )["port"]
            self.assertNotEqual(occupied, reassigned)
            self.assertNotEqual(SERVER.FORBIDDEN_PORT, reassigned)

    def test_explicit_port_persists_and_8000_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            self._create_servable_workspace(project_root)
            probe = SERVER.socket.socket(SERVER.socket.AF_INET, SERVER.socket.SOCK_STREAM)
            probe.bind(("127.0.0.1", 0))
            explicit = probe.getsockname()[1]
            probe.close()
            if explicit == SERVER.FORBIDDEN_PORT:
                self.skipTest("operating system selected the reserved port for the probe")
            with mock.patch.object(
                SERVER.ThreadingHTTPServer,
                "serve_forever",
                side_effect=KeyboardInterrupt,
            ):
                SERVER.serve(project_root, "127.0.0.1", explicit, False, False)
            self.assertEqual(explicit, SERVER._read_port_state(project_root))
            with self.assertRaisesRegex(SERVER.ViewerError, "reserved"):
                SERVER.serve(project_root, "127.0.0.1", 8000, False, False)

    def test_port_state_rejects_malformed_and_symlinked_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            state_path = project_root / SERVER.PORT_STATE_RELATIVE_PATH
            state_path.parent.mkdir(parents=True)
            state_path.write_text("not-json", encoding="utf-8")
            with self.assertRaisesRegex(SERVER.ViewerError, "malformed"):
                SERVER._read_port_state(project_root)
            state_path.unlink()
            target = project_root / "state-target.json"
            target.write_text(
                json.dumps({"version": SERVER.PORT_STATE_VERSION, "port": 9000}),
                encoding="utf-8",
            )
            try:
                os.symlink(target, state_path)
            except OSError as exc:
                self.skipTest(f"symlinks unavailable: {exc}")
            with self.assertRaisesRegex(SERVER.ViewerError, "regular file"):
                SERVER._read_port_state(project_root)

    def test_port_state_rejects_boolean_version(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            state_path = project_root / SERVER.PORT_STATE_RELATIVE_PATH
            state_path.parent.mkdir(parents=True)
            state_path.write_text(
                json.dumps({"version": True, "port": 9000}),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(SERVER.ViewerError, "invalid data"):
                SERVER._read_port_state(project_root)

    def test_installed_launcher_rejects_boolean_state_version(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            SERVER.install_assets(project_root, ASSET_ROOT, False)
            state_path = project_root / SERVER.PORT_STATE_RELATIVE_PATH
            state_path.write_text(
                json.dumps({"version": True, "port": 9000}),
                encoding="utf-8",
            )

            completed = subprocess.run(
                [str(project_root / "workspace.sh")],
                cwd=project_root,
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(0, completed.returncode)
            self.assertIn("contains invalid data", completed.stderr)


if __name__ == "__main__":
    unittest.main()
