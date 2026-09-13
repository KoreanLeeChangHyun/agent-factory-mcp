"""Isolated real Chromium rendering/navigation. No production login changes.

.venv/bin/python -m pytest -q tests/reporting/browser/reporting.py
"""

import json
import threading
from datetime import UTC, datetime, timedelta
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[3]


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/workspace/":
            self.path = "/template/workspace/index.html"
        super().do_GET()

    def log_message(self, *args):
        pass


def test_reporting_browser():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            aid, bid, tid, other_task, plan_domain, plan_feature, plan_issue, doc_id = [
                str(uuid4()) for _ in range(8)
            ]
            stale = (datetime.now(UTC) - timedelta(minutes=10)).isoformat()
            agents = [
                {
                    "id": aid,
                    "workspace_id": "one",
                    "parent_id": None,
                    "name": "Main <script>bad()</script>",
                    "role": "Coordinator",
                    "responsibilities": "Review & report",
                    "owner_user_id": "user",
                    "revision": 1,
                    "last_report_at": stale,
                },
                {
                    "id": bid,
                    "workspace_id": "one",
                    "parent_id": aid,
                    "name": "Worker",
                    "role": "Work",
                    "responsibilities": "Implement",
                    "owner_user_id": "user",
                    "revision": 1,
                    "last_report_at": None,
                },
            ]
            task = {
                "id": tid,
                "agent_id": aid,
                "parent_id": None,
                "name": "Linked task",
                "description": "Actual reported work",
                "status": "in_progress",
                "progress": None,
                "last_report_at": stale,
                "started_at": stale,
                "finished_at": None,
                "revision": 2,
                "plan_item_id": plan_issue,
            }
            tasks = [
                task,
                {
                    "id": other_task,
                    "agent_id": bid,
                    "parent_id": tid,
                    "name": "Queued task",
                    "description": "Waiting",
                    "status": "pending",
                    "progress": None,
                    "last_report_at": None,
                    "started_at": None,
                    "finished_at": None,
                    "revision": 1,
                    "plan_item_id": None,
                },
            ]
            report = {
                "id": "report-1",
                "task_id": tid,
                "status": "in_progress",
                "revision": 2,
                "reporter_user_id": "user",
                "connection_id": "connection-1",
                "received_at": stale,
                "message": "Reviewed <img src=x onerror=bad()> safely",
            }
            detail = {
                "task": task,
                "reports": [report],
                "results": [
                    {
                        "report_id": "report-1",
                        "label": "Result document",
                        "summary": "Recorded result",
                        "document_id": doc_id,
                    },
                    {
                        "report_id": "report-1",
                        "label": "External result",
                        "summary": "Safe link",
                        "url": "https://example.com/result",
                    },
                    {
                        "report_id": "report-1",
                        "label": "Unsafe fixture",
                        "summary": "must not link",
                        "url": "javascript:bad()",
                    },
                ],
                "logs": [
                    {
                        "id": "audit-1",
                        "occurred_at": stale,
                        "action": "external_report.report",
                        "outcome": "success",
                        "actor_user_id": "user",
                    }
                ],
                "next_before_revision": None,
            }
            controls = {
                "fail": False,
                "hold_detail": False,
                "hold_snapshot": False,
                "held": None,
                "held_snapshot": None,
            }
            plans = [
                {
                    "id": plan_domain,
                    "kind": "domain",
                    "parent_id": None,
                    "name": "Plan domain",
                    "status": "pending",
                },
                {
                    "id": plan_feature,
                    "kind": "feature",
                    "parent_id": plan_domain,
                    "name": "Correct feature",
                    "status": "pending",
                },
                {
                    "id": plan_issue,
                    "kind": "issue",
                    "parent_id": plan_feature,
                    "name": "Correct issue",
                    "description": "Exact linked issue description",
                    "status": "pending",
                },
            ]

            def route_request(route):
                p = route.request.url.split("/api/", 1)[1]

                def reply(data, status=200):
                    route.fulfill(
                        status=status, content_type="application/json", body=json.dumps(data)
                    )

                if p == "auth/me":
                    return reply(
                        {
                            "user": {
                                "id": "user",
                                "display_name": "Tester",
                                "email": "test@example.test",
                                "is_platform_admin": False,
                            }
                        }
                    )
                if p == "account/organizations":
                    return reply([{"id": "org", "name": "Test", "is_personal": True}])
                if p.endswith("/workspaces"):
                    return reply(
                        [
                            {
                                "id": "one",
                                "organization_id": "org",
                                "name": "Reports",
                                "status": "active",
                            },
                            {
                                "id": "two",
                                "organization_id": "org",
                                "name": "Empty workspace",
                                "status": "active",
                            },
                        ]
                    )
                if p.endswith(("/recent", "/workspaces/groups")):
                    return reply([])
                if p.endswith("/visits"):
                    return route.fulfill(status=204)
                if p.endswith("/mcp-connections"):
                    return reply({"state": "verified", "connections": []})
                if p.endswith("/plan"):
                    return reply({"items": plans, "settings": {}, "can_edit": False})
                if p.endswith("/documents"):
                    return reply(
                        [
                            {
                                "id": doc_id,
                                "document_type": "processed",
                                "title": "Result Document",
                                "current_revision_number": 1,
                                "document_metadata": {},
                            }
                        ]
                    )
                if "/revisions/1/content" in p:
                    return route.fulfill(
                        content_type="text/plain", body="Actual immutable document body"
                    )
                if p.endswith("/reporting"):
                    assert route.request.method == "GET"
                    if controls["hold_snapshot"] and "/one/" in p:
                        controls["held_snapshot"] = route
                        return
                    if controls["fail"]:
                        return reply({"error": {"message": "Connection unavailable"}}, 503)
                    return reply(
                        {
                            "agents": [] if "/two/" in p else agents,
                            "tasks": [] if "/two/" in p else tasks,
                            "truncated": False,
                        }
                    )
                if "/reporting/tasks/" in p:
                    if controls["hold_detail"]:
                        controls["held"] = route
                        return
                    return reply(
                        detail
                        if p.endswith(tid)
                        else {
                            "task": tasks[1],
                            "reports": [],
                            "results": [],
                            "logs": [],
                            "next_before_revision": None,
                        }
                    )
                return reply({})

            page.route("**/api/**", route_request)
            base = f"http://127.0.0.1:{server.server_port}"
            page.goto(base + "/workspace/")
            page.locator('[data-workspace-list] [data-workspace-id="one"]').click()
            page.locator('[data-activity="agents"]').click()
            panel = page.locator("[data-reporting-panel]")
            sidebar = page.locator("[data-reporting-sidebar]")
            expect(panel.get_by_role("heading", name="전체 에이전트", exact=True)).to_be_visible()
            expect(
                sidebar.get_by_role(
                    "button", name="Main <script>bad()</script> Coordinator", exact=False
                )
            ).to_be_visible()
            expect(
                panel.get_by_text("보고 오래됨 · 마지막 상태 유지", exact=False).first
            ).to_be_visible()
            expect(sidebar.get_by_text("Queued task · 대기", exact=False)).to_be_visible()
            sidebar.get_by_role(
                "button", name="Main <script>bad()</script> Coordinator", exact=False
            ).click()
            agent_metadata = panel.locator(":scope > .af-metadata-grid")
            assert agent_metadata.locator("dt").all_text_contents()[:5] == [
                "역할",
                "책임",
                "범위: 현재 워크스페이스",
                "구성 수정",
                "보고 소유자",
            ]
            panel.get_by_role("button", name="Linked task", exact=True).click()
            expect(panel.locator(".reporting-detail .af-metadata-grid")).to_be_visible()
            assert panel.locator(".reporting-detail .af-metadata-grid dt").all_text_contents() == [
                "시작",
                "종료",
                "수정",
            ]
            assert panel.locator(".reporting-tasks .af-badge").count() > 0
            expect(panel.get_by_text("진행률 보고 없음", exact=True)).to_be_visible()
            expect(
                panel.get_by_text("Reviewed <img src=x onerror=bad()> safely", exact=True)
            ).to_be_visible()
            assert panel.locator("img,script").count() == 0
            assert panel.locator('a[href^="javascript:"]').count() == 0
            link = panel.get_by_role("link", name="결과 링크 열기")
            expect(link).to_have_attribute("rel", "noopener noreferrer")
            panel.get_by_role("button", name="관련 MCP 보고 로그", exact=True).click()
            expect(panel.get_by_text("기록 audit-1 · 보고자 user")).to_be_visible()
            panel.get_by_role("button", name="연결된 일정 항목 열기", exact=True).click()
            expect(
                page.locator('[data-workspace-view="schedule"]').get_by_text(
                    "Exact linked issue description"
                )
            ).to_be_visible()
            page.locator('[data-activity="agents"]').click()
            panel.get_by_role("button", name="문서 열기", exact=True).click()
            expect(page.locator('[data-activity="documents"]')).to_have_attribute(
                "aria-pressed", "true"
            )
            expect(page.get_by_role("tab", name="Result Document", exact=False)).to_be_visible()
            page.locator('[data-activity="agents"]').click()
            # Selection epochs discard a task response arriving after another agent is selected.
            controls["hold_detail"] = True
            panel.get_by_role("button", name="Linked task", exact=True).click()
            expect(panel.get_by_text("작업 보고 불러오는 중…")).to_be_visible()
            sidebar.get_by_role("button", name="Worker Work", exact=False).click()
            controls["held"].fulfill(content_type="application/json", body=json.dumps(detail))
            controls["hold_detail"] = False
            expect(panel.get_by_role("heading", name="Worker", exact=True)).to_be_visible()
            assert panel.locator(".reporting-detail").count() == 0
            # Refresh errors keep explicit last-snapshot context; retry recovers.
            controls["fail"] = True
            panel.get_by_role("button", name="새로고침", exact=True).click()
            expect(panel.get_by_role("alert")).to_contain_text("보고를 불러오지 못했습니다")
            controls["fail"] = False
            task.update(status="completed", progress=70, finished_at=datetime.now(UTC).isoformat())
            sidebar.get_by_role("button", name="전체 에이전트", exact=True).click()
            panel.get_by_role("button", name="새로고침", exact=True).click()
            expect(panel.get_by_role("alert")).to_have_count(0)
            expect(panel.get_by_text("보고된 진행률 70%", exact=False)).to_be_visible()
            assert panel.get_by_role("button", name="Linked task", exact=True).count() == 1
            # Late workspace snapshot must not populate the newly selected workspace.
            controls["hold_snapshot"] = True
            panel.get_by_role("button", name="새로고침", exact=True).click()
            expect(panel.get_by_text("불러오는 중…", exact=True)).to_be_visible()
            page.evaluate(
                "window.agentFactoryReporting.open({api: async path => (await fetch(path)).json(), organizationId:'org', workspaceId:'two', navigate:async()=>{}})"
            )
            expect(sidebar.get_by_text("등록된 에이전트 없음", exact=True)).to_be_visible()
            controls["held_snapshot"].fulfill(
                content_type="application/json", body=json.dumps({"agents": agents, "tasks": tasks})
            )
            controls["hold_snapshot"] = False
            expect(sidebar.get_by_text("등록된 에이전트 없음", exact=True)).to_be_visible()
            assert sidebar.get_by_role("button", name="Worker Work", exact=False).count() == 0
            # Keyboard activation and narrow layout remain usable after a browser reload.
            page.reload()
            page.locator('[data-activity="agents"]').click()
            expect(panel.get_by_role("button", name="Linked task", exact=True)).to_be_visible()
            panel.get_by_role("button", name="Linked task", exact=True).focus()
            page.keyboard.press("Enter")
            expect(panel.locator(".reporting-detail")).to_be_visible()
            page.set_viewport_size({"width": 600, "height": 800})
            assert (
                panel.locator(".reporting-detail .af-metadata-grid").evaluate(
                    "el => getComputedStyle(el).gridTemplateColumns.split(' ').length"
                )
                == 1
            )
            assert panel.evaluate("el => el.scrollWidth <= el.clientWidth")
            expect(
                panel.get_by_role("button", name="관련 MCP 보고 로그", exact=True)
            ).to_be_visible()
            assert not errors, errors
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
