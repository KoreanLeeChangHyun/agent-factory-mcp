# ADR-005: native allowlist renderer와 MCP App sandbox 분리

- 상태: 적용됨
- 결정일: 2026-09-12
- 적용 범위: 고객 선언형 Workbench와 외부 MCP UI

## 맥락

대부분의 고객 작업은 일관된 공통 에셋으로 표현할 수 있지만, 외부 공급자의 특수 UI에는
실행 코드가 필요할 수 있다. 두 경로를 같은 DOM 신뢰 수준으로 처리할 수 없다.

## 결정

고객 선언형 Workbench는 `workbench-runtime`이 검증된 component/action/binding ID만 native
React로 렌더링한다. 외부 HTML·JavaScript는 `mcp-app-host`만 로드하며 별도/opaque origin의
iframe, 최소 sandbox attribute, host/resource CSP 교집합, capability negotiation, 정확한
origin/source/message schema 검증, 제한된 download/link 정책과 완전한 teardown을 적용한다.
host cookie, storage와 credential 접근은 기본 거부한다. 모든 tool 호출은 서버에서 Workspace
권한과 connection scope를 다시 검사한다.

## 대안

- `dangerouslySetInnerHTML` 또는 same-origin script: 데이터 노출과 실행 제어 상실 때문에 제외한다.
- 모든 고객 UI를 iframe으로 처리: native 카탈로그의 접근성·일관성 이점을 잃으므로 제외한다.
- MCP App을 먼저 구현: 실제 외부 UI 사례 없이 capability를 과도하게 열 수 있어 후순위로 둔다.

## 결과와 적용

Documents native slice와 broad asset catalog가 먼저다. MCP App host는 실제 사례가 확인된 RF-900
이후 별도 보안 gate와 함께 도입한다. 외부 App에는 계산된 read-only theme context만 제공한다.
현행 Document package preview sandbox는 보존하며 MCP AppBridge 구현으로 간주하지 않는다.
보안·MCP 제품 계약은 `spec-platform`이 소유한다. 외부 UI 경로의 기본 활성화 조건은 CSP,
postMessage, capability, teardown, SSRF와 fallback 검증이며 native 경로 rollback과 독립적이다.
