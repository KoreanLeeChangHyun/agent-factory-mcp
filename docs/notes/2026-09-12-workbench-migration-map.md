# Workbench 리팩터링 RF-004 현행→목표 소유자 매핑

기준일: 2026-09-12

## 범위와 판정 규칙

이 문서는 `git ls-files` 기준의 현행 application, template, static, UI kit, migration,
test, deploy, script와 configuration 소유자를 목표 구조에 빠짐없이 연결한다. 동일한 규칙으로
관리되는 vendor 개별 파일은 root와 tracked 개수로 묶었으며 임의 vendor dump를 복사하지 않았다.

| 현행 root | tracked 수 | 이 문서의 coverage |
| --- | ---: | --- |
| `app/` | 211 | composition, domain, adapter, MCP, worker, resources 및 25개 migration 파일 |
| `template/` | 4 | login/join/Workspace entry와 placeholder |
| `static/` | 267 | CSS 7, image 7, JS 12, UI runtime 36, vendor 204, placeholder 1 |
| `assets/ui-kit/` | 1,370 | authoring source/build/test/catalog/generated 99와 vendor 1,271 |
| `tests/` | 66 | Python/API 44, browser 16, support 5, integration migration 1 |
| `deploy/` | 10 | compose/proxy/database/release/smoke/backup와 placeholder |
| `scripts/` | 6 | disposable verification harness |
| `config/` | 2 | Alembic 설정과 placeholder |

`docs/notes/`는 구현 사실과 migration evidence이고 제품 계약이 아니다. maintained 제품 계약은
의도적으로 `.codex/skills/spec-platform/references/`에 남긴다. 목표 문서 트리로 옮길 때까지
`docs/specs`를 새 계약 원본으로 만들거나 같은 요구사항을 복제하지 않는다.

각 행은 다음 호환 규칙을 공유한다.

1. 새 owner가 현행 결과·권한·tenant·failure semantics를 characterization test로 비교할 때까지
   현행 파일은 compatibility 경로로 유지한다.
2. 파일 이동과 행동 변경을 같은 slice에서 수행하지 않는다.
3. 제거에는 새 경로 gate 통과, 기존/신규 결과 비교, `git grep` 소비자 부재, feature flag
   rollback 관측 기간이 모두 필요하다.
4. migration, immutable revision, vendor license/provenance와 사용자 데이터는 다시 쓰지 않는다.

## Application composition과 공통 기반

| 현행 소유자 | 목표 소유자 | 포팅/호환 경계 | 제거 기준 |
| --- | --- | --- | --- |
| `app/main.py`, `app/api/*`, `app/router/health.py`, `app/router/readiness.py` | `apps/api/src/agent_factory_api/{main,lifespan,health,http}` | root path, middleware, liveness/readiness와 router registration 결과 유지 | 새 API image 및 proxy smoke 통과 후 old composition 무참조 |
| `app/router/{account,auth}.py` | `apps/api/.../http/routes/sessions.py` + `platform-core/identity` + auth adapter | opaque session, cookie path, CSRF, OAuth callback와 기존 사용자 로그인 보존 | auth/API/browser/security 및 rollback 통과 |
| `app/core/{config,paths,urls}.py` | 앱별 settings + 공유 값 객체(`platform-core/shared`) | 환경 alias와 fail-closed production validation 유지 | API/worker별 settings parity와 package/image gate |
| `app/core/{logging,middleware,observability,request_context,security}.py`, `app/api/errors.py`, `app/common/*` | `apps/api/.../middleware,presenters` 및 필요한 framework-independent shared type | request ID, CSP, rate limit, safe error와 audit 의미 유지 | security/observability API 비교 통과 |
| `app/core/ui_catalog.py`, `app/build_assets.py` | `packages/design-system/catalog,scripts` + `apps/web` manifest loader | 현행 admin catalog와 packaged static fallback 유지 | versioned public catalog와 Vite manifest/package gate 통과 |
| `app/db/{base,models,session,tenant}.py` | `packages/platform-adapters/postgres/{session,tenant_context,unit_of_work,repositories}` | 현행 ORM table/history와 transaction-local RLS 유지 | 모든 core가 port만 import하고 RLS/integration 통과 |
| `app/infrastructure/email.py` | `packages/platform-adapters`의 notification/email adapter | SMTP 설정과 post-commit invitation retry 의미 유지 | 조직 use case가 port 사용, mail fixture/ops gate 통과 |
| `app/infrastructure/{embeddings,job_queue,object_storage,secret_encryption}.py` | `platform-adapters/{embeddings,redis,object_storage,secrets}` | provider, queue, S3와 ciphertext 형식 호환 | 새 adapter integration 및 기존 데이터 read/rollback 통과 |
| `app/resources/*` | owning package resource: Documents→`platform-core/knowledge`/`apps/api`; runtime preview→Documents web feature; guide→API package | wheel에서 checkout 없이 byte-equivalent resource를 읽게 함 | wheel/image inventory와 license/hash 비교 통과 |

## 서버 도메인, HTTP와 MCP

| 현행 도메인과 adapter | 목표 core owner | 목표 transport/adapter | compatibility 및 제거 조건 |
| --- | --- | --- | --- |
| `app/modules/auth/*`, `identity/*`; routers `auth`, `account` | `platform-core/identity` | API session dependencies + PostgreSQL/OAuth/crypto adapters | Stage 7에서 core lifecycle·PostgreSQL/crypto/OAuth adapter·API composition과 legacy bridge 작성; auth/DB/browser 독립 gate 후 기존 schema·cookie 호환 확정 |
| `app/modules/organization/*`; routers `organizations`, `workspace_management`, `account` | `platform-core/organizations` 및 `workspaces` | API routes + PostgreSQL/email | Stage 7에서 permission catalog와 authorization context/policy를 core로 이동하고 호환 import 유지; 나머지 owner/delegation/team/invitation/audit와 조직 RLS gate 후 제거 |
| `app/modules/workspace/*`; routers `workspace`, `workspace_management` | `platform-core/workspaces` | API routes/repositories; `apps/web/standard/workspace` | selection/revision/recent visit/repository identity와 live state 유지; API/browser/RLS 비교 후 제거 |
| `app/modules/admin/*`; router `admin` | `platform-core/identity,organizations,workspaces,executions,audit`의 admin queries | `apps/api/http/routes/admin` + `apps/web/standard/admin` | tenant와 분리된 platform-admin principal, safe config/health/flags 보존; fail-closed gate 후 제거 |
| `app/modules/document/*`; routers `documents`, `cloud_documents`, `search` | `platform-core/knowledge` | PostgreSQL/pgvector/object storage adapters, API/MCP document tools, `apps/web/standard/documents` | Original/Processed/Specification, revisions, package pair, preview sandbox, lexical/vector search 모두 Documents slice로 비교; 첫 slice 완료 전 제거 금지 |
| `app/modules/schedule/*`; router `scheduling`; `app/scheduler/*` | `platform-core/executions` schedule use cases | `apps/worker/scheduler.py`, API routes | cron/timezone/actor/authorization/Job authority 유지; Beat/disposable DB/browser 통과 |
| `app/modules/planning/*`; router `planning`; `app/mcp/planning.py` | `platform-core/executions`의 planning vertical slice | API/MCP adapter + `apps/web/standard/jobs` 또는 planning feature | domain→feature→issue, preview/apply/idempotency/date provenance 보존; fixture+DB+browser 후 제거 |
| `app/modules/agent/*`; router `agents` | `platform-core/executions`의 agent definitions/runs | API/MCP adapter + `apps/web/standard/jobs` | immutable version, run/Job transaction, cancel/retry/events/cost/artifacts 보존 |
| `app/modules/reporting/*`; router/MCP `reporting` | `platform-core/executions` + `audit` | API/MCP reporting adapter + agent reporting Workbench | self-report/evidence 구분, owner/revision/idempotency/runtime binding/search 보존; guide byte parity 및 DB/browser gate |
| `app/modules/integration/*`; routers `integrations`, `integration_oauth`; `app/mcp/integrations.py` | `platform-core/connections,knowledge,executions` | provider/OAuth/HTTP/secrets adapters + API/MCP + `apps/web/standard/connections` | content/reference collection, bounds, cursor, retry/cancel, credential redaction 보존; fixture+cloud harness 후 제거 |
| `app/modules/mcp_connection/*`; router `mcp_connections`; `app/mcp/auth.py` | `platform-core/connections,identity` | API token/MCP auth adapter + connection Workbench | existing hash-only token을 자동 교체하지 않고 encrypted retrievable token/expiry/revoke/purge 보존 |
| `app/modules/audit/*`, router `audit` | `platform-core/audit` | PostgreSQL append-only adapter + API query/export + audit Workbench | immutable audit와 200-row export/secret redaction 유지 |
| `app/modules/log/*` | `platform-core/audit`의 diagnostic projection 또는 API telemetry | log Workbench projection | audit와 diagnostic log를 합치지 않음; 기존 log resource 결과 비교 후 제거 |
| `app/modules/test/*` | 해당 실행 엔진이 생길 때 `platform-core/executions`; 현재 descriptor only | tests Workbench read adapter | `test.execute` 미구현/부여 불가 상태를 그대로 표시; 가짜 실행 경로를 만들지 않음 |
| `app/mcp/{server,scoped}.py`, `app/mcp/documents.py`, 위 domain MCP files | `apps/api/.../mcp/{server,context,resources,tools}` | 같은 core use case를 HTTP와 공유 | `/factory/mcp`, stateless HTTP, scope∩RBAC, 6 resource와 versioned schema 비교 후 제거 |
| `app/worker/{authority,celery_app,handlers,integration_handlers,tasks}.py` | `apps/worker` composition/claim/handlers + `platform-core/executions` | Redis/Celery 및 provider adapters | durable Job 재조회, payload tenant 불신, cancellation/retry/claim/outbox gate 후 제거 |

`app/modules/__init__.py`, 각 도메인의 `__init__.py`, `app/__init__.py`, `app/db/__init__.py`,
`app/infrastructure/__init__.py`, `app/router/__init__.py`, `app/mcp/__init__.py`,
`app/worker/__init__.py`는 소유 구현과 함께 이동하는 package marker다. 별도 행동 owner가 아니다.

## Browser template, static과 UI kit

| 현행 파일 집합 | 목표 소유자 | 호환/보존 | 제거 기준 |
| --- | --- | --- | --- |
| `template/login/index.html`, `template/join/index.html` | `apps/web/auth` 또는 API가 제공하는 최소 auth entry | JavaScript 전 로그인/가입 접근성과 server redirect 보존 | 새 auth browser flow와 production static smoke 통과 |
| `template/workspace/index.html` | `apps/web/index.html`, `app/shell`, `registry`, standard Workbenches | Vite shadow route와 legacy server template 병행; inline 작업 SVG를 inventory로만 포팅 | 모든 standard 작업과 responsive/state restoration 전환 후 제거 |
| `template/.gitkeep`, `static/.gitkeep` | 없음(디렉터리 placeholder) | 실제 파일이 owner를 만들면 의미 없음 | legacy root가 비고 package 참조가 없을 때 제거 |
| `static/css/ui.css` | `design-system/foundations,primitives,patterns,shell` | semantic token/state의 현재 비교 기준; 직접 새 기능 추가 금지 | React 소비자, dark/light/high-contrast, contrast/visual gate |
| `static/css/{login,workspace,organizations,document-editor,planning,agent-reporting}.css` | 각 `apps/web/auth` 또는 `standard/*` feature style; 공유 규칙은 design-system | feature-only layout/preview는 feature에 유지, raw 공통 token은 승격 | 대응 browser visual/interaction 비교 후 개별 제거 |
| `static/js/{login,workspace,organizations,organization-invitation,document-editor,planning,agent-reporting,admin}.js` | `apps/web/auth,shell,standard/*` | API shape와 late-response/disposal semantics 보존 | 해당 standard Workbench E2E 및 flag rollback 통과 |
| `static/js/{integrations,mcp-clients,mcp-connection,mcp-handoff}.js` | `apps/web/standard/connections` + API clients | 13 client/18 environment config, ZIP/secret 규칙 보존 | MCP/connection browser+DB+config parity 통과 |
| `static/images/agent-factory.svg` | `design-system/assets/brand` | byte/provenance와 accessible usage 보존 | manifest/version/license 검증 후 legacy ref 없음 |
| `static/images/planning-explorer/*.svg` | feature-owned planning visuals 또는 reviewed `design-system/assets/icons` | task/subtask meaning을 stable ID로 심사 | registry/preview와 planning browser 통과 |
| `static/images/workspace-explorer/*.svg` | `design-system/assets/icons` + Workspace feature mapping | group/group-open/workspace state를 versioned ID로 포팅 | byte/visual/provenance 및 consumer 전환 |
| `static/ui/*` (36) | legacy generated runtime; source target은 `design-system` | source로 직접 수정하지 않음; JS/CSS, provenance와 26 license 파일 함께 유지 | 새 catalog build가 소비자를 대체하고 legal inventory 일치 |
| `static/vendor/pdfjs/6.3.289/**` (199) 및 notices | Documents feature runtime vendor | exact version, CMap/font/WASM/license, CSP/eval 제한 보존; broad design-system으로 이동하지 않음 | 새 document viewer package byte/behavior/package gate |
| `static/vendor/tabulator/6.5.2/**` (4) | Documents/data-table feature vendor 또는 vetted design-system Table dependency | notices/license와 current export behavior 보존 | 대체 table 기능/라이선스/Document regression 통과 |
| `assets/ui-kit/src/components/*.js` (25) | 대응 `design-system` primitive/navigation/layout/pattern/accessibility | vanilla DOM API는 공개 React API가 아니라 포팅 입력 | versioned descriptor, unit/a11y/visual, 실제 2개 이상 소비자 |
| `assets/ui-kit/src/product-*.js`, `vendors.js` (7) | design-system build adapters 또는 feature compatibility | positioning/splitter/toast/auth의 provenance 경계 유지 | React implementation과 package build parity |
| `assets/ui-kit/styles/theme.css` | design-system semantic foundations/themes | 고정 현행 token을 baseline으로만 사용 | ThemeProfile dark/light/high-contrast 및 no-raw-color gate |
| `assets/ui-kit/catalog/*`, `index.html`, `README.md` | `design-system/catalog`과 authoring `AssetCatalog` | interactive preview와 usage 설명으로 포팅 | 모든 public ID의 metadata/state/example가 검색 가능 |
| `assets/ui-kit/scripts/*` (7), `package*.json` | design-system scripts/package; lock은 root pnpm workspace로 재생성 | generated/source/provenance 경계 유지 | reproducible pnpm build, clean generated diff |
| `assets/ui-kit/tests/*` (9) | design-system package unit/contract/a11y tests | 현재 composition/layout/state/input/navigation/upload 행동 characterization | React counterpart와 catalog gate 통과 |
| `assets/ui-kit/generated/*` (43) | transitional generated input; 새 output은 design-system build output | generated JS/CSS, provenance와 licenses를 한 inventory로 비교 | 새 build reproducibility 및 runtime consumer 없음 |
| `assets/ui-kit/vendor/**` (1,271) | design-system vetted source/vendor inventory | `material-icon-theme` 1,254 files와 `tabler` 17 files를 license/provenance와 함께 일괄 보존; 전체를 공개 task catalog로 자동 노출하지 않음 | 선택된 broad catalog manifest, unused vendor 정책, license/provenance 검증 후만 정리 |

## Migration 0001~0024

현행 `app/db/migrations/{env.py,script.py.mako,versions/__init__.py}`는 목표
`migrations/`의 Alembic runtime/history로 이동한다. 각 revision 파일은 다음 owner의 PostgreSQL
adapter schema를 구현하지만 published revision ID와 down_revision은 변경하지 않는다.

| revision | 도메인 owner | 목표 위치/조건 |
| --- | --- | --- |
| `0001_enable_extensions` | platform-adapters/postgres·pgvector | root `migrations/versions`; extension gate 유지 |
| `0002_multitenancy` | organizations/workspaces | tenant base와 RLS history 보존 |
| `0003_authentication` | identity | existing session/credential row 호환 |
| `0004_workspace_management` | workspaces | ownership/repository revision 보존 |
| `0005_documents`, `0006_document_search` | knowledge | Document authority와 search projection 보존 |
| `0007_agents` | executions | version/run/Job 이력 보존 |
| `0008_integrations` | connections | encrypted credentials/webhook 보존 |
| `0009_scheduling` | executions | schedule/Job authority 보존 |
| `0010_admin` | identity/admin projection | platform principal 분리 유지 |
| `0011_account_discovery` | identity/workspaces | first-login/personal ownership 호환 |
| `0012_audit` | audit | append-only trigger/policy 유지 |
| `0013_development_planning` | executions/planning | 계획 3단계 의미 보존 |
| `0014_mcp_connections` | connections | token binding/history 보존 |
| `0015_external_reporting` | executions/reporting | immutable report stream 보존 |
| `0016_planning_imports` | executions/planning | preview/apply/idempotency 보존 |
| `0017_mcp_token_retrieval` | identity/connections | hash-only legacy와 encrypted token 모두 읽기 |
| `0018_cloud_documents`, `0021_cloud_document_delivery` | knowledge | import/package/upload/pair 및 RLS 보존 |
| `0019_cloud_collections`, `0023_drive_reference_collections` | connections/knowledge/executions | content/reference mapping, run/cursor 보존 |
| `0020_cloud_reporting_bindings` | executions/reporting | runtime binding/heartbeat immutability 보존 |
| `0022_organization_management`, `0024_workspace_groups` | organizations/workspaces | detailed roles/team/group/RLS 보존 |

새 Workbench/ThemeProfile table은 `0024` 이후의 append-only revision으로 추가한다. legacy history를
합치거나 번호를 다시 매기지 않는다. clean head, upgrade compatibility, NOSUPERUSER RLS와 이전
image 호환이 통과하기 전에는 migration runtime 위치를 전환하지 않는다.

## Test 소유자 전체 매핑

| 현행 test 집합 | 목표 소유자 | 처리 |
| --- | --- | --- |
| `tests/test_{authentication,authorization,personal_workspaces,personal_workspaces_integration,workspace_management,workspace_ui,organization_management,admin}.py` | `platform-core` identity/organizations/workspaces unit + `apps/api` HTTP; UI는 web package/root E2E | 단위와 transport를 분리한 뒤 root에는 cross-boundary/RLS만 유지 |
| `tests/test_{documents,document_paths,document_search,document_template,legacy_document_import,cloud_documents,cloud_document_delivery,cloud_document_delivery_http}.py` | platform-core knowledge, adapters, API; browser는 root E2E | Documents 첫 slice characterization로 선행 유지 |
| `tests/test_{agents,scheduling,planning,planning_calendar,planning_import,planning_import_integration,planning_integration,reporting,reporting_integration,reporting_runtime,cloud_reporting}.py` | platform-core executions/audit, worker/API package; DB/process는 root integration | self-report와 Agent run을 별도 계약으로 유지 |
| `tests/test_{integrations,cloud_integrations_collections,cloud_integrations_packaging,cloud_integrations_providers}.py` | platform-core connections/knowledge + adapters/API; provider fixture는 adapter package | live provider로 재분류하지 않음 |
| `tests/test_{mcp_server,mcp_connections,mcp_connections_integration}.py` | apps/api MCP package + root MCP integration | HTTP/MCP가 같은 use case를 호출하는지 유지 |
| `tests/test_{architecture_boundaries,cloud_platform_integration,cloud_platform_packaging,cloud_source_inventory,database_foundation,multitenancy,security,observability,health,deployment}.py` | root `tests/{contracts,integration,security,e2e}` | cross-package/import/build/deploy/RLS gate로 유지·확장 |
| `tests/browser/{workspace-start,organizations,document-editor,cloud-document-delivery,planning,reporting,admin-assets,cloud-platform,mcp-clients,mcp-handoff,mcp-onboarding,auth-assets,ui-boundaries,ui-components,ui-screens}.cjs` 및 `reporting.py` | root `tests/e2e`, feature별 Playwright specs | fixture browser임을 metadata로 표시; actual DB E2E와 분리 |
| `tests/browser/cloud-document-delivery.fixture.py` | Documents E2E support | package generator로 test 옆에 유지 |
| `tests/support/{auth,fastapi,inventory,mcp}.py`, `__init__.py` | API/root shared test support | production package에서 import 금지 |
| `tests/integration/test_migrations.py` | root `tests/integration/postgres` | explicit disposable URL marker 유지 |

위 brace 목록은 현재 tracked 66개 파일을 모두 분류한다. 새 package로 복사한 뒤 원본을 바로
삭제하지 않고, 같은 test ID를 이중 실행하지 않도록 gate 전환 commit에서 owner를 하나로 고정한다.

## Deploy, scripts와 configuration

| 현행 집합 | 목표 소유자 | compatibility/제거 기준 |
| --- | --- | --- |
| `Dockerfile`, `.dockerignore`, `MANIFEST.in`, `pyproject.toml` | root workspace + `apps/{api,worker,web}` Dockerfile/package | 현행 wheel/image/static fallback을 새 immutable images가 대체할 때까지 유지 |
| `deploy/compose.yaml`, `compose.production.yaml` | `deploy/compose/{compose.dev,compose.production}.yml` | API/worker/scheduler/Postgres/Redis/object-store service, secret와 health ordering 보존 |
| `deploy/Caddyfile`, `caddy-factory-headers.patch` | `deploy/proxy/` | `/factory`, callback query privacy, readiness와 security header 보존 |
| `deploy/postgres/{roles.sql,init/001-extensions.sql}` | `deploy/compose` init 또는 `deploy/kubernetes` migration role assets | API/worker/migration role 분리와 RLS 권한 검증 후 이동 |
| `deploy/{release,smoke,backup}.sh` | `deploy/{smoke,backup}`와 release runbook | SHA image, migration one-shot, staging smoke, recoverable backup 계약 유지; 실행은 별도 권한 |
| `deploy/.gitkeep` | 없음 | 실제 target dirs가 생기면 제거 |
| `scripts/verify-{cloud-platform,mcp-handoff,organizations,planning-import,reporting,reporting-runtime}.sh` | `scripts/`의 bounded cross-boundary verification | 고유 container/random loopback/no volume/targeted cleanup 유지; package unit test로 이동하지 않음 |
| `config/alembic.ini`, `config/.gitkeep` | root `migrations` configuration | 기존 CLI가 새 root history를 읽고 clean DB gate 통과 후 legacy config 제거 |
| `.env.example`, `.env.production.example` | root/deploy documented non-secret settings | 새 앱별 settings alias와 OAuth/theme/storage 항목 동기화; 실제 secret 금지 |
| `.github/workflows/ci.yml`, `Makefile` | root cross-language gate | pnpm/uv/schema/codegen/dependency checks를 추가하되 현행 Python gate를 green 상태로 유지 |
| `.codex/config.toml`, `.vscode/mcp.json` | developer tooling | SaaS runtime package에 포함하지 않음; 비밀/개인 token 금지 |
| `.codex/skills/rule-*` | maintained repository convention | target placement/UI 규칙의 owner로 유지 |
| `.codex/skills/spec-platform` | maintained product/domain contract | deliberate contract migration 전까지 유일한 제품 계약 source; `docs/specs` 복제 금지 |
| `README.md`, `docs/` | service entry documentation 및 dated evidence/ADR/runbook | README link를 새 entrypoint에 맞춰 갱신; dated note를 normative contract로 승격하지 않음 |

## Slice 순서와 제거 checkpoint

1. 계약/의존 검사: schema와 generated package가 legacy 행동을 아직 호출하지 않는다.
2. Documents: icon→tree→binding→panel→theme의 첫 실제 slice를 shadow route에서 완성한다.
3. identity/organization/workspace/admin을 현행 opaque session과 함께 포팅한다.
4. schedule/planning, agent/reporting, integration/MCP를 각각 core port와 adapter로 분리한다.
5. 모든 standard descriptor와 browser state가 registry를 사용한 뒤 legacy template/static을 제거
   후보로 표시한다.
6. migration/image/proxy/backup/smoke와 관측/rollback이 통과한 뒤에만 실제 제거한다.

RF-004는 이 ownership map 작성으로 완료 처리한다. 이는 파일이 이동되었거나 새 architecture가
구동된다는 뜻이 아니다. 각 실제 이동 상태는 해당 RF 단계와 독립 Verification evidence가 소유한다.
