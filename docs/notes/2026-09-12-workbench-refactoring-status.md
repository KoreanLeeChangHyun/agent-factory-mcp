# Workbench 리팩터링 작업 현황

기준일: 2026-09-12

이 문서는 [목표 아키텍처](2026-09-11-greenfield-workbench-architecture.md)와
[상세 목표 구조](2026-09-12-target-directory-structure.md)를 실제 코드로 옮기는 작업을
추적한다. `docs/notes/`의 날짜별 현황 기록이며 제품 계약을 대신하지 않는다.

## 상태 기준

| 상태      | 의미                                                              |
| --------- | ----------------------------------------------------------------- |
| 완료      | 목표 구조와 완료 조건을 충족하고 해당 검증 근거가 있다.           |
| 부분 완료 | 재사용할 현행 구현이나 문서는 있지만 목표 경계로 이전되지 않았다. |
| 미착수    | 목표 파일·계약·실행 경로가 아직 없다.                             |
| 후순위    | 선행 vertical slice 또는 실제 고객 사례가 확인된 뒤 진행한다.     |

상태는 소스 트리와 기존 기록을 바탕으로 판정했다. 이번 현황표 작성 과정에서는 제품
테스트, 브라우저 테스트, PostgreSQL 통합 테스트, 빌드 또는 배포를 다시 실행하지 않았다.

## 실행 방식

전체 리팩터링은 한 번의 사용자 요청으로 연속 실행한다. 아래 단계와 선행 관계는 작업
순서를 정하는 장치이며 사용자 승인 대기 지점이 아니다. 구현 중 필요한 기술 선택은 목표
아키텍처, 현재 제품 계약과 테스트 증거에 따라 결정하고 ADR에 바로 기록한다. 각 단계의
검증이 통과하면 다음 단계로 계속 진행하며, 복구할 수 없는 외부 상태 변경이나 현재 환경으로
해결할 수 없는 실제 차단 조건이 생긴 경우에만 사용자 입력을 요청한다.

## 전체 현황

| 영역                  | 현재 상태 | 현재 근거                                                                                                        | 다음 완료 지점                                              |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 목표 아키텍처         | 부분 완료 | 모노레포·Workbench·포팅 방향과 [ADR-001~010](../adr/) 적용 결정 존재                                             | 신규 apps/packages 의존성 규칙 자동 검사                    |
| 현행 서비스 경계      | 부분 완료 | Stage 7 identity/authorization 및 Stage 8 organization/Workspace/account backend·B101 closure 독립 pass; Stage 9 administrator backend 작성     | Stage 9 독립 검증 후 이후 도메인 경계를 순차 포팅    |
| 모노레포 골격         | 완료      | Stage 1 독립 Verification에서 frozen install, 공통 gate, worker smoke, web/Python build와 no-cleanup 재실행 통과 | 후속 slice에서 같은 gate 유지                               |
| 공통 UI 기반          | 완료      | Stage 2 독립 Verification에서 17 design-system tests, Chromium matrix와 10 screenshots 통과                      | 후속 소비자 전환 동안 같은 catalog gate 유지                |
| 작업 목록 에셋        | 완료      | 16개 versioned React SVG와 상태·provenance가 Stage 2 독립 catalog/Chromium gate 통과                             | 후속 registry/runtime 소비에서 호환성 유지                  |
| 사이드바 에셋         | 완료      | 단일 host의 7개 조합과 keyboard/width behavior가 Stage 2 독립 gate 통과                                          | 작성기와 표준 Workbench에서 같은 registry 사용              |
| 패널 레이아웃         | 완료      | 9개 React 조합과 responsive split/remount behavior가 Stage 2 독립 gate 통과                                      | 작성기와 표준 Workbench에서 같은 registry 사용              |
| 사용자 테마           | 부분 완료 | Stage 3 독립 Verification에서 DB/RLS/concurrency/audit와 Chromium context/theme gate 통과                        | legacy 소비자 전환                                          |
| Workbench 계약        | 완료      | 닫힌 schema, 제한, 예제, 생성 Python/TypeScript 패키지가 Stage 1 parity/codegen gate 통과                        | Stage 2 확장 enum 재검증 및 이후 호환성 유지                |
| Workbench runtime     | 완료      | Stage 4 registry/renderer/binding/action/view-state 독립 package/browser gate 통과                               | 후속 server-backed 소비자에서 같은 gate 유지                |
| 사용자 작성기         | 완료      | Stage 5 최종 독립 Verification에서 실제 DB-backed 저장·게시·release·reload browser gate 통과                     | 후속 표준 작업 포팅에서 같은 작성/게시 계약 유지            |
| Workbench 도메인      | 완료      | Stage 5 최종 독립 Verification에서 0026, transaction/RBAC/RLS/HTTP·MCP parity와 불변 release 통과                | 후속 binding/표준 작업 소비에서 같은 계약 유지              |
| React Workbench shell | 완료      | Stage 6 독립 Verification에서 production route·DB·browser·양방향 rollback 통과                                   | 후속 표준 작업 포팅 동안 같은 production gate 유지          |
| 표준 작업 포팅        | 부분 완료 | Stage 6 Documents 대표 범위 작성; 전체 Documents와 나머지 표준 작업은 legacy 유지                                | RF-801 전체 Documents parity와 RF-800/802~804 순차 전환     |
| MCP App host          | 후순위    | Document preview sandbox는 있으나 MCP AppBridge host는 없음                                                      | 실제 사례 후 CSP·capability·message·teardown 보안 gate 통과 |
| 전환·제거             | 후순위    | production shadow route와 즉시 legacy rollback은 검증됨; 실제 rollout 관측과 제거 조건은 미충족                  | 관측·rollback 조건 충족 후 legacy 경로 제거                 |

## 단계별 작업 현황표

### 0. 결정과 기준선

| ID     | 작업                                         | 상태      | 남은 작업                                                                                                                           | 완료 조건                                                                                                    |
| ------ | -------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| RF-000 | 목표 아키텍처와 상세 디렉터리 구조 작성      | 완료      | 변경 시 유지관리 구조 계약과 동기화                                                                                                 | 목표 문서와 구조 계약이 같은 경계·명칭 사용                                                                  |
| RF-001 | 다중 공통 에셋과 사용자별 테마를 범위에 포함 | 완료      | 구현 ADR과 schema에서 구체화                                                                                                        | 작업 목록·사이드바·패널 카탈로그와 `ThemeProfile`이 계획·완료 조건에 존재                                    |
| RF-002 | ADR-001~010 작성                             | 완료      | 후속 구현과 실제 결과가 결정을 변경하면 같은 ADR의 상태·결과 갱신                                                                   | `docs/adr/`에 결정·대안·결과·계약 소유·rollout과 적용 상태 기록                                              |
| RF-003 | 현행 핵심 흐름 characterization 기준선       | 부분 완료 | [실행 계획](2026-09-12-workbench-baseline.md)의 fixture/API·browser·disposable DB matrix를 독립 Verification에서 실행하고 결과 기록 | 조직·작업공간·문서·일정·에이전트·연동·MCP 핵심 흐름 기준선 통과                                              |
| RF-004 | 현행 파일의 목표 소유자 매핑                 | 완료      | 실제 포팅 때 tracked inventory 변화와 removal checkpoint를 행별 갱신                                                                | [migration map](2026-09-12-workbench-migration-map.md)에 모든 포팅 대상의 목표 경로·호환 경계·제거 조건 존재 |

### 1. 계약과 의존성 기반

| ID     | 작업                          | 상태 | 선행       | 완료 조건                                                       |
| ------ | ----------------------------- | ---- | ---------- | --------------------------------------------------------------- |
| RF-100 | Workbench JSON Schema v1      | 완료 | RF-002     | Stage 1 독립 parity·제한 검증 통과; 후속 확장 재검증 유지       |
| RF-101 | 공통 에셋 descriptor schema   | 완료 | RF-002     | 닫힌 descriptor와 catalog 계약 독립 검증 통과                   |
| RF-102 | 사용자 `ThemeProfile` schema  | 완료 | RF-002     | allowlist schema·거부 fixture 독립 parity 통과                  |
| RF-103 | Python·TypeScript 생성 패키지 | 완료 | RF-100~102 | frozen install, codegen byte check와 두 생성 package build 통과 |
| RF-104 | schema 호환성 정책과 CI       | 완료 | RF-100~103 | compatibility fixture와 dedicated Workbench gate 통과           |
| RF-105 | 목표 의존 방향 검사           | 완료 | RF-002     | Python/TS·manifest·generated-output 경계 검증 통과              |

### 2. 최소 모노레포 골격

| ID     | 작업                                              | 상태      | 선행       | 완료 조건                                                                          |
| ------ | ------------------------------------------------- | --------- | ---------- | ---------------------------------------------------------------------------------- |
| RF-200 | pnpm workspace와 루트 TypeScript 구성             | 완료      | RF-002     | pnpm 10.15.1 frozen install, gate와 Vite build 통과                                |
| RF-201 | uv Python workspace와 공통 lock                   | 완료      | RF-002     | uv 0.8.15 frozen sync와 여섯 Python package build 통과                             |
| RF-202 | `apps/web`, `apps/api`, `apps/worker` 최소 실행점 | 완료      | RF-200~201 | health/readiness 계약, worker smoke와 web build 통과                               |
| RF-203 | `packages/*`와 `contracts/*` 최소 실제 slice      | 완료      | RF-100~103 | validated Documents fixture가 package test/build 경로에서 통과                     |
| RF-204 | 공통 `make check` 확장                            | 부분 완료 | RF-200~203 | `make workbench-check`는 반복 통과; root legacy Ruff·pytest prerequisite 제한 유지 |

### 3. Design System과 공통 에셋 카탈로그

| ID     | 작업                                                | 상태 | 선행           | 완료 조건                                                             |
| ------ | --------------------------------------------------- | ---- | -------------- | --------------------------------------------------------------------- |
| RF-300 | 기존 UI kit 자산·라이선스·검증 포팅 계획            | 완료 | RF-004         | Stage 2 독립 frozen install, provenance/catalog 및 Chromium gate 통과 |
| RF-301 | semantic token과 기본 dark/light/high-contrast 테마 | 완료 | RF-200         | 세 foundation과 React 소비가 독립 component/visual gate 통과          |
| RF-302 | 작업 목록 SVG 카탈로그                              | 완료 | RF-101, RF-300 | 16개 React SVG와 상태가 catalog/Chromium matrix 통과                  |
| RF-303 | 사이드바 에셋 카탈로그                              | 완료 | RF-101, RF-300 | 단일 host 7개 조합과 폭·키보드 검증 통과                              |
| RF-304 | 패널 레이아웃 카탈로그                              | 완료 | RF-101, RF-300 | 9개 조합과 responsive split/remount 검증 통과                         |
| RF-305 | 기본 입력·표시·피드백 컴포넌트                      | 완료 | RF-101, RF-300 | 공통 component와 상태의 접근성 test 통과                              |
| RF-306 | 카탈로그 metadata와 미리보기                        | 완료 | RF-302~305     | 단일 registry와 `/catalog` production Chromium preview 통과           |
| RF-307 | 중복·폐기 정책                                      | 완료 | RF-306         | alias/descriptor/compatibility gate 통과                              |
| RF-308 | 접근성·반응형·visual gate                           | 완료 | RF-302~306     | 180/268/520px, 390px, focus와 10 screenshots 검증 통과                |

### 4. 사용자별 테마

| ID     | 작업                                         | 상태      | 선행               | 완료 조건                                                                  |
| ------ | -------------------------------------------- | --------- | ------------------ | -------------------------------------------------------------------------- |
| RF-400 | `ThemeProfile` 도메인과 PostgreSQL migration | 완료      | RF-102, RF-201     | Stage 3 독립 clean migration·forced RLS·concurrency gate 통과              |
| RF-401 | 테마 조회·저장 API와 권한                    | 완료      | RF-400             | Stage 3 독립 session/CAS/audit/audit-failure gate 통과                     |
| RF-402 | 테마 해석·검증기                             | 완료      | RF-102, RF-301     | Stage 3 독립 Python/TypeScript allowlist·contrast gate 통과                |
| RF-403 | 초기 렌더링과 브라우저 캐시                  | 완료      | RF-401~402         | Stage 3 독립 browser context/stale/second-context gate 통과                |
| RF-404 | Theme editor와 전체 적용                     | 부분 완료 | RF-306, RF-401~403 | React shell/editor preview 구현; legacy 전체 소비자 전환은 RF-800~804 의존 |
| RF-405 | 접근성 우선순위                              | 완료      | RF-402~404         | Stage 3 독립 고대비/reduced motion/keyboard/focus gate 통과                |

### 5. Workbench runtime과 작성기

| ID     | 작업                                        | 상태 | 선행                   | 완료 조건                                                     |
| ------ | ------------------------------------------- | ---- | ---------------------- | ------------------------------------------------------------- |
| RF-500 | Component/Layout/Icon registry              | 완료 | RF-101, RF-302~306     | Stage 4 독립 Verification 통과                                |
| RF-501 | sidebar/panel renderer                      | 완료 | RF-100, RF-500         | Stage 4 package/browser gate 통과                             |
| RF-502 | Binding client와 입출력 검증                | 완료 | RF-100, RF-103         | cancel/cache/closed I/O gate 통과                             |
| RF-503 | 제한된 Action registry                      | 완료 | RF-100, RF-500         | 실제 refresh와 중복 실행 gate 통과                            |
| RF-504 | view state와 복원                           | 완료 | RF-100, RF-501         | theme/keyboard/state/remount/390px gate 통과                  |
| RF-505 | runtime 보안 제한                           | 완료 | RF-100~104             | schema와 runtime rejection gate 통과                          |
| RF-506 | AssetCatalog·ComponentPalette·LayoutPalette | 완료 | RF-306, RF-500         | asset별 접근 가능한 삽입 이름 포함 gate 통과                  |
| RF-507 | Property·Binding·Theme editor               | 완료 | RF-404, RF-502, RF-506 | exact preview/import/undo editor gate 통과                    |
| RF-508 | draft→preview→validate→publish UX           | 완료 | RF-600~604             | Stage 5 실제 API 저장·게시·reload DB-backed browser 검증 통과 |

### 6. 서버 도메인과 adapter

| ID     | 작업                                           | 상태      | 선행           | 완료 조건                                                                |
| ------ | ---------------------------------------------- | --------- | -------------- | ------------------------------------------------------------------------ |
| RF-600 | `WorkbenchDefinition` aggregate                | 완료      | RF-100, RF-201 | Stage 5 독립 core 전이·stale·archive/restore 검증 통과                   |
| RF-601 | immutable `WorkbenchRelease`                   | 완료      | RF-600         | Stage 5 독립 transaction snapshot/digest/DB mutation 거부 검증 통과      |
| RF-602 | Workbench repository port와 PostgreSQL adapter | 완료      | RF-600~601     | Stage 5 독립 0026 migration·forced RLS·동시성 PostgreSQL 검증 통과       |
| RF-603 | Workbench command/query use case               | 완료      | RF-602         | Stage 5 독립 권한·CAS·idempotency·transaction failure 검증 통과          |
| RF-604 | 얇은 HTTP·MCP adapter                          | 완료      | RF-603         | Stage 5 독립 인증 HTTP/MCP 결과·오류 parity 검증 통과                    |
| RF-605 | 기존 도메인의 `platform-core` 포팅             | 부분 완료 | RF-201, RF-004 | Stage 8 독립 pass; Stage 9 administration core 작성·독립 검증 대기, 나머지 도메인 필요 |
| RF-606 | 기존 외부 구현의 `platform-adapters` 포팅      | 부분 완료 | RF-201, RF-004 | Stage 8 독립 pass; Stage 9 administration PostgreSQL adapter 작성·독립 검증 대기 |
| RF-607 | API/worker composition 분리                    | 부분 완료 | RF-605~606     | Stage 8 독립 pass; Stage 9 admin API composition 작성·독립 검증과 worker/나머지 도메인 필요 |

### 7. React shell과 첫 vertical slice

| ID     | 작업                                        | 상태      | 선행                               | 완료 조건                                                                        |
| ------ | ------------------------------------------- | --------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| RF-700 | Vite React shadow route                     | 완료      | RF-200, RF-202                     | Stage 6 독립 production deep-link/manifest/package/CSP gate 통과                  |
| RF-701 | 작업 목록｜사이드바｜패널 shell             | 완료      | RF-700, RF-302~304                 | Stage 6 독립 shell/resize/keyboard/390px/theme gate 통과                          |
| RF-702 | 표준·고객 단일 WorkbenchRegistry            | 완료      | RF-500, RF-603                     | Stage 6 독립 authorized projection/isolation/collision gate 통과                  |
| RF-703 | 대표 vertical slice로 `문서` 작업 범위 고정 | 완료      | RF-002, RF-004                     | 대표 범위와 RF-801 잔여 inventory를 Stage 6 evidence에 고정                       |
| RF-704 | 대표 vertical slice 구현                    | 완료      | RF-501~505, RF-603~604, RF-701~703 | Stage 6 실제 DB-backed create/read/edit/conflict/revision/preview gate 통과       |
| RF-705 | feature flag와 rollback                     | 완료      | RF-700, RF-704                     | Stage 6 one-shot legacy 복귀와 React 재진입 양방향 gate 통과                      |

### 8. 표준 작업 순차 포팅

| ID     | 작업                       | 상태   | 선행       | 완료 조건                                                          |
| ------ | -------------------------- | ------ | ---------- | ------------------------------------------------------------------ |
| RF-800 | 작업공간·조직·계정·관리자  | 부분 완료 | RF-704~705 | Stage 8 독립 pass; Stage 9 관리자 backend 작성·독립 검증 대기, 표준 UI 포팅 필요 |
| RF-801 | 문서·검색·지식             | 미착수 | RF-704~705 | tree/editor/preview/revision/provenance와 전달 흐름 회귀           |
| RF-802 | 일정                       | 미착수 | RF-704~705 | tree/timeline/today/kanban, 생성·수정·복원 회귀                    |
| RF-803 | 에이전트·보고·로그·테스트  | 미착수 | RF-704~705 | 계층·실행 상태·증거 표시와 장시간 갱신 회귀                        |
| RF-804 | 연동·MCP 연결·데이터베이스 | 미착수 | RF-704~705 | credential 비노출, OAuth, 연결 증거, 설정 전달과 권한 회귀         |
| RF-805 | legacy UI 제거 후보 확인   | 후순위 | RF-800~804 | 실제 사용자·route·asset 참조가 없고 관측 기간과 rollback 기준 충족 |

### 9. MCP Apps host

| ID     | 작업                                     | 상태   | 선행               | 완료 조건                                                             |
| ------ | ---------------------------------------- | ------ | ------------------ | --------------------------------------------------------------------- |
| RF-900 | 실제 외부 UI 사례와 capability 범위 확인 | 후순위 | RF-704             | native renderer로 부족한 사례를 확인하고 최소 capability를 ADR에 기록 |
| RF-901 | sandbox iframe과 CSP 교집합              | 후순위 | RF-900             | opaque/별도 origin, 최소 sandbox와 네트워크 정책 보안 테스트          |
| RF-902 | AppBridge lifecycle과 messaging          | 후순위 | RF-900             | exact origin/source/schema, pending request와 teardown 검증           |
| RF-903 | 읽기 전용 theme context                  | 후순위 | RF-404, RF-901~902 | 계산된 token만 전달하고 host storage·credential 접근 차단             |

### 10. 검증·배포·전환

| ID      | 작업                                     | 상태      | 선행                     | 완료 조건                                                           |
| ------- | ---------------------------------------- | --------- | ------------------------ | ------------------------------------------------------------------- |
| RF-1000 | package별 unit 및 root contract gate     | 미착수    | RF-103, RF-200~204       | Python/TS validator parity, package unit, cross-boundary test 통과  |
| RF-1001 | tenant·RLS·schema·SSRF·sandbox 보안 gate | 부분 완료 | 관련 slice               | 현행 보안 테스트를 목표 경계로 포팅하고 새 제한 검증                |
| RF-1002 | 브라우저·접근성·visual gate              | 부분 완료 | RF-308, RF-701           | 데스크톱/좁은 폭, keyboard, 복원, theme, 권한과 모든 상태 통과      |
| RF-1003 | migration·build·image·smoke gate         | 부분 완료 | RF-201~204, DB 변경      | clean DB head, immutable build, staging smoke와 rollback rehearsal  |
| RF-1004 | 관측과 단계적 기본 경로 전환             | 후순위    | RF-800~804, RF-1000~1003 | 오류율·binding latency·publish rollback·sandbox violation 기준 충족 |
| RF-1005 | compatibility adapter와 legacy 경로 제거 | 후순위    | RF-1004                  | 사용자 잔존 없음 확인, 제거 후 전체 gate 및 복구 절차 검증          |

## 현재 재사용 가능한 기반

| 현행 자산                                  | 목표 사용                                           | 주의점                                                             |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------ |
| `assets/ui-kit/src/components/`            | design-system primitive·navigation·layout 포팅 입력 | vanilla DOM 계약을 React 공개 API로 그대로 간주하지 않는다.        |
| `assets/ui-kit/vendor/`와 provenance       | 아이콘·외부 소스의 출처 및 라이선스 입력            | 생성물과 editable source를 분리하고 고지를 보존한다.               |
| `static/ui/`                               | 전환 기간 legacy runtime                            | 목표 design-system의 편집 원본으로 직접 수정하지 않는다.           |
| `static/css/ui.css`                        | semantic token과 공통 상태의 현행 기준              | 사용자 테마와 React용 token build 계약이 추가로 필요하다.          |
| `template/workspace/index.html` inline SVG | 작업 목록 아이콘 inventory                          | stable ID와 manifest로 이동 후 compatibility route에서만 유지한다. |
| `tests/test_architecture_boundaries.py`    | 목표 dependency 검사 출발점                         | Python legacy 경계 외에 TS와 apps/packages 방향을 추가한다.        |
| `tests/browser/*.cjs`                      | 현행 사용자 흐름 characterization                   | mocked API 범위와 실제 DB/브라우저 범위를 구분한다.                |
| `app/modules/*` 서비스·repository          | `platform-core`/`platform-adapters` 포팅 입력       | 파일 이동과 도메인 의미 변경을 같은 단계에서 수행하지 않는다.      |
| `app/worker`, `app/scheduler`              | `apps/worker`와 execution use case 포팅 입력        | durable Job 권위와 payload 재검증을 유지한다.                      |
| `app/db/migrations`                        | 루트 `migrations` 전환 입력                         | 배포된 revision history를 다시 쓰지 않고 append-only로 유지한다.   |

## 진행 순서

```text
RF-002~004
    ↓
RF-100~105
    ↓
RF-200~204
    ↓
RF-300~308 ──→ RF-400~405
    ↓                 ↓
RF-500~507 ←──────────┘
    ↓
RF-600~607
    ↓
RF-700~705
    ↓
RF-800~805
    ↓
RF-1000~1005
```

MCP Apps host(RF-900~903)는 대표 native Workbench가 완성되고 실제 외부 UI 사례가 확인된
뒤 병행할 수 있다. 각 단계는 기존 경로의 rollback 가능성을 유지하며, 파일 이동·renderer
교체·API 의미 변경을 하나의 변경 묶음에서 동시에 수행하지 않는다.

## 현 시점의 다음 작업

1. Stage 9 administrator backend의 독립 검증을 완료한 뒤 RF-605~607의 나머지
   도메인·PostgreSQL/provider adapter와 API composition을 vertical slice로 순차 포팅한다.
2. RF-003: 전체 legacy [기준선 matrix](2026-09-12-workbench-baseline.md)의 fixture/API,
   browser와 disposable infrastructure 범위를 별도 실행하고 전역 제한을 해소한다.
3. RF-801 전체 Documents parity와 RF-800/802~805 표준 기능 포팅은 후속 slice로 유지한다.

단순 디렉터리 생성만으로 상태를 완료로 바꾸지 않는다. 각 행의 완료 조건과 해당 검증이
함께 충족된 경우에만 완료로 갱신한다.
