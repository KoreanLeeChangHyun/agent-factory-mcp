# ADR-006: PostgreSQL 권위 데이터, pgvector 검색, Workspace RLS

- 상태: 적용됨
- 결정일: 2026-09-12
- 적용 범위: 모든 서버 도메인과 Workbench/ThemeProfile 영속성

## 맥락

현재 서비스의 authoritative relational state, revision, Job, audit 및 검색 projection이
PostgreSQL을 기준으로 설계되어 있다. 포팅 중 개발 fixture나 browser storage를 새 권위로
오인하면 tenant 격리와 복구 계약이 약해진다.

## 결정

PostgreSQL만 권위 관계형 저장소로 사용하고 pgvector는 재구축 가능한 검색 projection에
사용한다. tenant row는 `organization_id` 또는 `workspace_id`를 갖고 RLS를 활성화한다.
애플리케이션 RBAC를 먼저 적용하고 transaction-local tenant context와 RLS를 방어 계층으로
함께 쓴다. UUID, timezone timestamp, mutable aggregate revision과 append-only migration 원칙을
유지한다. Redis/queue, object storage와 browser cache는 각자의 delivery/body/cache 책임만 가진다.

## 대안

- SQLite를 운영 authority로 유지: RLS와 현행 운영 계약을 충족하지 못해 제외한다.
- 브라우저에 theme/view authority 저장: 사용자 전환·기기 간 복원에 부적합하여 제외한다.
- 검색 store를 문서 원본으로 사용: 재구축 가능한 projection 원칙에 어긋나 제외한다.

## 결과와 적용

현행 `app/db/migrations/versions/0001`~`0024`는 배포 이력이므로 수정하지 않고 루트
`migrations/`로 이관할 때 byte/history를 보존한다. Workbench와 ThemeProfile은 새 append-only
revision을 추가한다. `platform-core`는 repository port만 알고 SQLAlchemy는 adapter에 둔다.
database/search/security 계약은 `spec-platform`이 계속 소유한다. 실제 DB gate는 명시적인
일회용 PostgreSQL만 사용하며 `.env` DB에 자동 연결하지 않는다. legacy DB 경로 제거는 clean
upgrade, RLS cross-tenant, backup/restore 및 이전 이미지 호환이 검증된 뒤 가능하다.
