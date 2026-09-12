# ADR-002: FastAPI 제어면, React Workbench, Python worker

- 상태: 적용됨
- 결정일: 2026-09-12
- 적용 범위: `apps/web`, `apps/api`, `apps/worker`

## 맥락

고객 정의 화면과 작성기는 복잡한 브라우저 상태를 요구하지만 문서 처리, 검색 및 durable
Job 구현은 Python에 있다. 현행 router, MCP tool, worker handler에 규칙을 반복하면 HTTP,
MCP와 예약 실행의 의미가 갈라진다.

## 결정

React·TypeScript는 브라우저 Workbench host와 작성기를 소유한다. FastAPI는 HTTP와 MCP
composition root 및 얇은 adapter를 소유한다. Python worker와 scheduler는 별도 process와
container command로 실행하지만 API와 동일한 `platform-core` use case를 조립한다.
`platform-core`에는 FastAPI, Celery, SQLAlchemy, Redis, MCP 또는 provider SDK import를
허용하지 않는다. API/worker에서 기술 구현은 `platform-adapters`의 port 구현으로 주입한다.

## 대안

- 서버 템플릿과 직접 DOM 조작만 확장: 작성기와 선언형 renderer의 결합 비용 때문에 제외한다.
- Node 전체 스택: Python 기능 재작성 비용 때문에 제외한다.
- 초기부터 마이크로서비스: 계약과 트랜잭션 경계가 변하는 단계의 운영 비용 때문에 제외한다.

## 결과와 적용

`app/main.py`, `app/router`, `app/mcp`, `app/worker`, `app/scheduler`는 기능 플래그가 있는
compatibility 경로로 유지한다. Documents slice에서 같은 use case를 새 HTTP/MCP/worker
composition이 호출한 뒤 도메인별로 이동한다. framework 독립성은 금지 import 검사로
강제한다. 인증·CSRF·RBAC·RLS의 현행 의미는 adapter 이동으로 변경하지 않는다.

배치와 권한 계약은 `spec-platform`의 authentication, authorization, workers, operations가
계속 소유한다. 기존 entrypoint 제거 조건은 API 결과 비교, worker idempotency/cancellation,
MCP schema, image/smoke 및 즉시 rollback 검증이 모두 통과하는 것이다.
