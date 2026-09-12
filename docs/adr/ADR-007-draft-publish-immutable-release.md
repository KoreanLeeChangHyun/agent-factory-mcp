# ADR-007: draft/publish와 불변 WorkbenchRelease

- 상태: 적용됨
- 결정일: 2026-09-12
- 적용 범위: WorkbenchDefinition 생명주기와 게시

## 맥락

고객이 편집 중인 정의와 실제 사용자가 실행하는 정의를 같은 mutable row로 제공하면 동시 편집,
감사, rollback 및 실행 재현성이 깨진다.

## 결정

`WorkbenchDefinition`은 Workspace 소유 aggregate로 draft/update/archive와 optimistic revision을
가진다. publish는 현재 draft를 완전히 검증한 뒤 schema version, canonical digest, asset version과
actor를 포함한 새 `WorkbenchRelease` snapshot을 한 transaction에서 생성한다. 게시 release는
수정하거나 덮어쓰지 않는다. 변경은 새 definition revision과 새 release를 만든다. preview 권한과
publish 권한을 분리하며 표준 code-owned descriptor는 같은 읽기 projection을 제공하되 고객이
변경할 수 없다.

## 대안

- 하나의 mutable JSON row: 실행 이력과 rollback을 재현할 수 없어 제외한다.
- 파일 기반 고객 정의: Workspace RBAC/RLS, 동시성 및 감사 경계를 제공하지 못해 제외한다.

## 결과와 적용

RF-600~604에서 core 상태 전이, repository port, PostgreSQL adapter와 HTTP/MCP 표현을 순서대로
구현한다. 삭제는 즉시 물리 삭제가 아니라 계약에 맞는 archive/retention 흐름으로 다룬다.
정의/release의 제품 권한과 영속성 계약은 향후 `spec-platform`의 owning reference에서 관리한다.
전환 중에는 feature flag가 선택한 release만 새 renderer로 보내며 legacy 화면은 원본 데이터에
대한 rollback 경로로 남긴다. rollback 기간과 release 참조가 끝나기 전에는 snapshot을 제거하지 않는다.
