# ADR-009: feature flag, compatibility adapter와 rollback

- 상태: 적용됨
- 결정일: 2026-09-12
- 적용 범위: 모든 표준 작업의 단계적 포팅과 legacy 제거

## 맥락

파일 이동, renderer 교체와 API 의미 변경을 동시에 수행하면 회귀의 원인을 분리하기 어렵고
복구 경로가 사라진다. 현행 server template과 API에는 admin, planning/reporting, Documents,
integration 및 MCP의 다수 행동이 있다.

## 결정

Documents를 첫 vertical slice로 고정한다. 새 React shell은 shadow route로 배포하고 Workspace
단위 feature flag가 legacy/new 경로를 선택한다. compatibility adapter는 현행 API 결과를 새
Workbench binding 형태로 번역하되 도메인 의미를 바꾸지 않는다. 각 표준 작업은 characterization
기준선, API 결과 비교, 권한/tenant, browser state와 운영 계측을 통과한 뒤 개별 전환한다.

rollback은 이전 이미지뿐 아니라 같은 배포에서 legacy route로 즉시 복귀하고 새 state key를
안전하게 무시/변환할 수 있어야 한다. 오류율, binding latency, publish rollback, stale/error 상태를
관측한다. 제거는 참조 검색, 사용자 잔존 부재, 관측 기간과 복구 연습을 증거로 판단한다.

## 대안

- 빅뱅 이동: 회귀 격리와 rollback이 불가능해 제외한다.
- 무기한 이중 구현: 드리프트 비용 때문에 제거 기준을 반드시 둔다.
- Documents가 아닌 가상 Stocks 구현: 실제 제품 행동을 검증하지 못해 제외한다.

## 결과와 적용

순서는 Documents, workspace/organization/admin, knowledge, schedule/planning, agent/reporting,
integration/MCP이며 공유 기반은 먼저 포팅할 수 있다. 현행 인증 방식, URL/cookie/CSRF 계약과
published migration은 flag와 무관하게 보존한다. 제품 행동의 소유자는 계속 `info-platform`/`design-platform`/`rule-platform`이고
포팅 상태/증거는 날짜가 있는 `docs/processed/notes/`가 소유한다. 어떤 legacy 경로도 관련 제거 조건이
충족되기 전에 삭제하지 않는다.
