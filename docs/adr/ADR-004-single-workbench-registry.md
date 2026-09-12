# ADR-004: 표준·고객 작업의 단일 WorkbenchRegistry

- 상태: 적용됨
- 결정일: 2026-09-12
- 적용 범위: 작업 목록, 선택, 권한 필터, 상태 복원

## 맥락

표준 화면과 고객 화면이 별도 navigation을 가지면 순서, 표시, 권한 및 복원 규칙이 이중화된다.
현재 서버 템플릿의 activity 목록은 포팅 입력이지만 고객 정의의 영구 API가 될 수 없다.

## 결정

`apps/web/src/registry/WorkbenchRegistry`가 code-owned 표준 descriptor, server-owned 고객
release descriptor와 MCP App descriptor를 한 목록으로 조합한다. 세 종류는 동일한 stable ID,
표시 순서, 허용 여부, render mode, selection 및 view-state key 계약을 쓴다. 표준 작업은 제품
코드가 정의하고 고객은 이를 덮어쓰거나 필수 권한을 변경할 수 없다. 서버가 권한을 판정하며
UI 필터는 권한 경계가 아니다.

내부에서 작업 목록 항목은 `WorkbenchDefinition`, 게시 snapshot은 `WorkbenchRelease`, 장시간
실행은 `Job`이라 부른다. 사용자 UI 용어는 `작업`을 사용한다.

## 대안

- 표준 작업 hard-coded navigation 유지: 상태·권한이 중복되어 제외한다.
- 모든 표준 화면을 즉시 고객 JSON으로 변환: 기능별 projection과 안정화 순서를 무시하므로 제외한다.

## 결과와 적용

Documents를 첫 표준 descriptor로 등록하고 compatibility adapter로 현행 데이터를 읽는다.
이후 workspace/admin, knowledge, schedule, agent/reporting, integration/MCP 순으로 결과를 비교한다.
현행 `template/workspace/index.html`과 `static/js/workspace.js` navigation은 전환 기간에만 유지한다.
권한/Workspace 계약은 `spec-platform`이 소유한다. 제거 조건은 모든 표준 작업의 descriptor,
권한·복원 browser gate, 잔존 route/asset 참조 부재 및 Workspace별 rollback 관측 기간이다.
