# Workbench 리팩터링 작업 현황

기준일: 2026-09-12

이 문서는 [목표 아키텍처](2026-09-11-greenfield-workbench-architecture.md)와
[상세 목표 구조](2026-09-12-target-directory-structure.md)를 실제 코드로 옮기는 작업을
추적한다. `docs/notes/`의 날짜별 현황 기록이며 제품 계약을 대신하지 않는다.

## 상태 기준

| 상태 | 의미 |
| --- | --- |
| 완료 | 목표 구조와 완료 조건을 충족하고 해당 검증 근거가 있다. |
| 부분 완료 | 재사용할 현행 구현이나 문서는 있지만 목표 경계로 이전되지 않았다. |
| 미착수 | 목표 파일·계약·실행 경로가 아직 없다. |
| 후순위 | 선행 vertical slice 또는 실제 고객 사례가 확인된 뒤 진행한다. |

상태는 소스 트리와 기존 기록을 바탕으로 판정했다. 이번 현황표 작성 과정에서는 제품
테스트, 브라우저 테스트, PostgreSQL 통합 테스트, 빌드 또는 배포를 다시 실행하지 않았다.

## 실행 방식

전체 리팩터링은 한 번의 사용자 요청으로 연속 실행한다. 아래 단계와 선행 관계는 작업
순서를 정하는 장치이며 사용자 승인 대기 지점이 아니다. 구현 중 필요한 기술 선택은 목표
아키텍처, 현재 제품 계약과 테스트 증거에 따라 결정하고 ADR에 바로 기록한다. 각 단계의
검증이 통과하면 다음 단계로 계속 진행하며, 복구할 수 없는 외부 상태 변경이나 현재 환경으로
해결할 수 없는 실제 차단 조건이 생긴 경우에만 사용자 입력을 요청한다.

## 전체 현황

| 영역 | 현재 상태 | 현재 근거 | 다음 완료 지점 |
| --- | --- | --- | --- |
| 목표 아키텍처 | 부분 완료 | 모노레포·Workbench·포팅 방향 문서 존재 | ADR-001~010 기록 및 의존성 규칙 자동 검사 |
| 현행 서비스 경계 | 부분 완료 | `app/modules`, 얇은 router를 검사하는 architecture test, 공유 서비스 일부 존재 | core port와 adapter 경계를 목표 패키지에서 강제 |
| 모노레포 골격 | 미착수 | 루트 `apps/`, `packages/`, `contracts/`, pnpm/uv workspace 없음 | 최소 앱·패키지·계약 fixture가 한 공통 gate에서 동작 |
| 공통 UI 기반 | 부분 완료 | `assets/ui-kit`, `static/ui`, `ui.css`, 제품 적용·브라우저 검증 기록 존재 | `packages/design-system`으로 포팅하고 공개 카탈로그 계약 제공 |
| 작업 목록 에셋 | 부분 완료 | 현재 작업 아이콘은 템플릿 inline SVG와 일부 Tabler SVG로 분산 | 다수 SVG를 출처·버전·상태가 있는 작업 아이콘 registry로 제공 |
| 사이드바 에셋 | 부분 완료 | `bindSidebarHost`, `explorerTree`, native tree, 상태·리사이저 어댑터 존재 | 여러 조합을 versioned asset으로 등록하고 작성기에서 선택 가능 |
| 패널 레이아웃 | 부분 완료 | vanilla UI 키트에 page/list-detail/collection/settings layout 존재 | 여러 React 레이아웃과 schema·상태·미리보기 카탈로그 제공 |
| 사용자 테마 | 미착수 | 고정 공통 토큰과 단일 제품 테마만 존재 | 서버 저장 `ThemeProfile`, 검증, 캐시와 전체 화면 적용 |
| Workbench 계약 | 미착수 | `contracts/`와 생성된 Python/TypeScript 계약 패키지 없음 | 닫힌 JSON Schema, 제한, 예제와 validator parity 통과 |
| Workbench runtime | 미착수 | component/action/binding registry와 선언형 renderer 없음 | 등록 에셋만으로 대표 정의를 안전하게 렌더링 |
| 사용자 작성기 | 미착수 | React editor, asset/layout palette, theme editor 없음 | 편집→검증→상태별 미리보기→게시 흐름 통과 |
| Workbench 도메인 | 미착수 | `WorkbenchDefinition`, `WorkbenchRelease` 모델·migration 없음 | draft/publish/archive, immutable release, RBAC/RLS 통과 |
| React Workbench shell | 미착수 | 현재 HTML/CSS/vanilla shell만 존재 | shadow route에서 작업 목록｜사이드바｜패널 및 복원 동작 통과 |
| 표준 작업 포팅 | 미착수 | 표준 화면은 현행 template/static JS에 결합 | 작업별 compatibility adapter와 feature flag로 순차 전환 |
| MCP App host | 후순위 | Document preview sandbox는 있으나 MCP AppBridge host는 없음 | 실제 사례 후 CSP·capability·message·teardown 보안 gate 통과 |
| 전환·제거 | 후순위 | 신규 경로가 없어 시작할 수 없음 | 관측·rollback 조건 충족 후 legacy 경로 제거 |

## 단계별 작업 현황표

### 0. 결정과 기준선

| ID | 작업 | 상태 | 남은 작업 | 완료 조건 |
| --- | --- | --- | --- | --- |
| RF-000 | 목표 아키텍처와 상세 디렉터리 구조 작성 | 완료 | 변경 시 유지관리 구조 계약과 동기화 | 목표 문서와 구조 계약이 같은 경계·명칭 사용 |
| RF-001 | 다중 공통 에셋과 사용자별 테마를 범위에 포함 | 완료 | 구현 ADR과 schema에서 구체화 | 작업 목록·사이드바·패널 카탈로그와 `ThemeProfile`이 계획·완료 조건에 존재 |
| RF-002 | ADR-001~010 작성 | 미착수 | 모노레포, 계약, registry, sandbox, persistence, rollback, theme 결정을 구현과 함께 기록 | `docs/adr/`에 결정·대안·결과와 적용 상태 기록 |
| RF-003 | 현행 핵심 흐름 characterization 기준선 | 부분 완료 | 기존 테스트를 선별해 깨끗한 환경에서 재실행하고 결과 기록 | 조직·작업공간·문서·일정·에이전트·연동·MCP 핵심 흐름 기준선 통과 |
| RF-004 | 현행 파일의 목표 소유자 매핑 | 미착수 | `app`, `template`, `static`, UI kit, migration별 이동/잔류/폐기 표 작성 | 모든 포팅 대상에 목표 경로·호환 경계·제거 조건 존재 |

### 1. 계약과 의존성 기반

| ID | 작업 | 상태 | 선행 | 완료 조건 |
| --- | --- | --- | --- | --- |
| RF-100 | Workbench JSON Schema v1 | 미착수 | RF-002 | definition/release/descriptor/sidebar/panel/component/binding/action/view-state schema와 제한 fixture 통과 |
| RF-101 | 공통 에셋 descriptor schema | 미착수 | RF-002 | 버전 ID, 허용 영역, props, binding, state, action, 접근성 metadata 검증 |
| RF-102 | 사용자 `ThemeProfile` schema | 미착수 | RF-002 | 기본 테마·허용 token·밀도·revision 계약 및 임의 CSS 거부 fixture 통과 |
| RF-103 | Python·TypeScript 생성 패키지 | 미착수 | RF-100~102 | 같은 fixture에 두 validator가 같은 판정, 생성 후 clean diff |
| RF-104 | schema 호환성 정책과 CI | 미착수 | RF-100~103 | minor/major 호환성 fixture와 size/depth/time limit gate 통과 |
| RF-105 | 목표 의존 방향 검사 | 부분 완료 | RF-002 | 현행 router 경계 검사는 존재; 새 apps/packages의 금지 import까지 자동 검사 |

### 2. 최소 모노레포 골격

| ID | 작업 | 상태 | 선행 | 완료 조건 |
| --- | --- | --- | --- | --- |
| RF-200 | pnpm workspace와 루트 TypeScript 구성 | 미착수 | RF-002 | lockfile 고정, workspace-only 내부 의존성, format/lint/type/test 명령 동작 |
| RF-201 | uv Python workspace와 공통 lock | 미착수 | RF-002 | api/worker/core/adapters/contracts 패키지가 하나의 lock과 gate 사용 |
| RF-202 | `apps/web`, `apps/api`, `apps/worker` 최소 실행점 | 미착수 | RF-200~201 | web health 화면, API liveness/readiness, worker 시작 검증 |
| RF-203 | `packages/*`와 `contracts/*` 최소 실제 slice | 미착수 | RF-100~103 | 빈 디렉터리가 아닌 fixture 검증과 호출 경로 존재 |
| RF-204 | 공통 `make check` 확장 | 부분 완료 | RF-200~203 | 현재 Python gate에 TS, schema, codegen-diff, dependency 검사를 포함 |

### 3. Design System과 공통 에셋 카탈로그

| ID | 작업 | 상태 | 선행 | 완료 조건 |
| --- | --- | --- | --- | --- |
| RF-300 | 기존 UI kit 자산·라이선스·검증 포팅 계획 | 부분 완료 | RF-004 | 소스/생성물/라이선스별 목표 경로와 byte/provenance 비교 기준 확정 |
| RF-301 | semantic token과 기본 dark/light/high-contrast 테마 | 부분 완료 | RF-200 | 현행 토큰을 이전하고 모든 React 에셋이 raw 색상 없이 소비 |
| RF-302 | 작업 목록 SVG 카탈로그 | 부분 완료 | RF-101, RF-300 | 여러 작업 범주의 SVG, manifest, stable ID, 선택·비활성·알림 상태와 미리보기 통과 |
| RF-303 | 사이드바 에셋 카탈로그 | 부분 완료 | RF-101, RF-300 | 평면 목록·그룹·트리·검색·필터·상세 행·상태·하단 동작 조합 제공 |
| RF-304 | 패널 레이아웃 카탈로그 | 부분 완료 | RF-101, RF-300 | 상세·목록-상세·컬렉션·설정·대시보드·문서·분할·타임라인·칸반 제공 |
| RF-305 | 기본 입력·표시·피드백 컴포넌트 | 부분 완료 | RF-101, RF-300 | 버튼·필드·선택·표·차트 frame·코드·Markdown·dialog·toast·공통 상태 제공 |
| RF-306 | 카탈로그 metadata와 미리보기 | 미착수 | RF-302~305 | 모든 공개 ID에 schema, 예제, 상태 matrix, 접근성 설명과 interactive preview 존재 |
| RF-307 | 중복·폐기 정책 | 미착수 | RF-306 | 의미가 겹치는 alias 방지, deprecation과 major-version 전환 계약 존재 |
| RF-308 | 접근성·반응형·visual gate | 부분 완료 | RF-302~306 | 180/268/520px 사이드바, 390px 화면, 키보드, focus, contrast, 주요 상태 검증 |

### 4. 사용자별 테마

| ID | 작업 | 상태 | 선행 | 완료 조건 |
| --- | --- | --- | --- | --- |
| RF-400 | `ThemeProfile` 도메인과 PostgreSQL migration | 미착수 | RF-102, RF-201 | 사용자 소유, revision, 기본값과 RLS가 있는 append-only migration 통과 |
| RF-401 | 테마 조회·저장 API와 권한 | 미착수 | RF-400 | 현재 사용자만 조회·수정하고 optimistic conflict와 감사 정책 처리 |
| RF-402 | 테마 해석·검증기 | 미착수 | RF-102, RF-301 | token allowlist, 색상 형식, contrast와 focus 가시성 검증 |
| RF-403 | 초기 렌더링과 브라우저 캐시 | 미착수 | RF-401~402 | 깜박임을 줄이는 캐시, 서버 권위 재조정, 로그아웃·사용자 전환 격리 |
| RF-404 | Theme editor와 전체 적용 | 미착수 | RF-306, RF-401~403 | shell·작성기·native Workbench가 즉시 미리보기하고 저장 후 기기 간 복원 |
| RF-405 | 접근성 우선순위 | 미착수 | RF-402~404 | 사용자 고대비·reduced motion 설정이 조직/Workspace 기본값보다 우선 |

### 5. Workbench runtime과 작성기

| ID | 작업 | 상태 | 선행 | 완료 조건 |
| --- | --- | --- | --- | --- |
| RF-500 | Component/Layout/Icon registry | 미착수 | RF-101, RF-302~306 | stable ID를 구현에 연결하고 unknown/version mismatch를 안전하게 표시 |
| RF-501 | sidebar/panel renderer | 미착수 | RF-100, RF-500 | 닫힌 schema로 검증된 component tree만 렌더링 |
| RF-502 | Binding client와 입출력 검증 | 미착수 | RF-100, RF-103 | transport 독립 port, 취소·경합·cache·output mismatch 처리 |
| RF-503 | 제한된 Action registry | 미착수 | RF-100, RF-500 | select/refresh/submit/navigate 등 allowlist action만 실행 |
| RF-504 | view state와 복원 | 미착수 | RF-100, RF-501 | 사용자·조직·Workspace·Workbench별 선택/접힘/너비 격리와 stale ID 정리 |
| RF-505 | runtime 보안 제한 | 미착수 | RF-100~104 | raw CSS/SVG/import/expression/secret/arbitrary URL과 과도한 정의 거부 |
| RF-506 | AssetCatalog·ComponentPalette·LayoutPalette | 미착수 | RF-306, RF-500 | 사용자가 여러 에셋을 검색·선택·배치하고 허용 위치만 조합 |
| RF-507 | Property·Binding·Theme editor | 미착수 | RF-404, RF-502, RF-506 | schema 기반 편집, 진단과 상태별 미리보기 제공 |
| RF-508 | draft→preview→validate→publish UX | 미착수 | RF-600~604 | 권한과 revision을 지키며 전체 작성 흐름 E2E 통과 |

### 6. 서버 도메인과 adapter

| ID | 작업 | 상태 | 선행 | 완료 조건 |
| --- | --- | --- | --- | --- |
| RF-600 | `WorkbenchDefinition` aggregate | 미착수 | RF-100, RF-201 | draft/update/archive 상태 전이, Workspace 소유와 optimistic revision |
| RF-601 | immutable `WorkbenchRelease` | 미착수 | RF-600 | 게시가 새 snapshot과 digest를 만들고 기존 release 수정 금지 |
| RF-602 | Workbench repository port와 PostgreSQL adapter | 미착수 | RF-600~601 | core가 SQLAlchemy를 import하지 않고 RLS 격리 통합 테스트 통과 |
| RF-603 | Workbench command/query use case | 미착수 | RF-602 | 권한·transaction·오류 의미를 HTTP/MCP 밖에서 소유 |
| RF-604 | 얇은 HTTP·MCP adapter | 미착수 | RF-603 | 같은 publish/read use case를 호출하고 transport별 표현만 담당 |
| RF-605 | 기존 도메인의 `platform-core` 포팅 | 부분 완료 | RF-201, RF-004 | 도메인별 vertical slice와 port로 이동, framework/DB/provider import 차단 |
| RF-606 | 기존 외부 구현의 `platform-adapters` 포팅 | 부분 완료 | RF-201, RF-004 | PostgreSQL·Redis·storage·MCP·HTTP·embedding·secret adapter 경계 완성 |
| RF-607 | API/worker composition 분리 | 부분 완료 | RF-605~606 | 별도 entrypoint가 같은 core use case를 조립하고 모델을 복사하지 않음 |

### 7. React shell과 첫 vertical slice

| ID | 작업 | 상태 | 선행 | 완료 조건 |
| --- | --- | --- | --- | --- |
| RF-700 | Vite React shadow route | 미착수 | RF-200, RF-202 | 기존 경로와 병행 배포되고 manifest 기반 production asset 로딩 |
| RF-701 | 작업 목록｜사이드바｜패널 shell | 부분 완료 | RF-700, RF-302~304 | 현행 UX를 characterization 기준으로 보존한 React shell과 반응형 동작 |
| RF-702 | 표준·고객 단일 WorkbenchRegistry | 미착수 | RF-500, RF-603 | 동일 descriptor로 순서·표시·선택·권한·복원 처리 |
| RF-703 | 대표 vertical slice로 `문서` 작업 범위 고정 | 미착수 | RF-002, RF-004 | 문서 아이콘, 사이드바 tree, 선택, binding, 패널 문서 layout과 fixture 범위 기록 |
| RF-704 | 대표 vertical slice 구현 | 미착수 | RF-501~505, RF-603~604, RF-701~703 | 아이콘→사이드바 선택→binding→패널 렌더→상태·테마 복원을 종단 검증 |
| RF-705 | feature flag와 rollback | 미착수 | RF-700, RF-704 | Workspace 단위 전환, 즉시 legacy 복귀, state key migration 검증 |

### 8. 표준 작업 순차 포팅

| ID | 작업 | 상태 | 선행 | 완료 조건 |
| --- | --- | --- | --- | --- |
| RF-800 | 작업공간·조직·계정·관리자 | 미착수 | RF-704~705 | 권한·선택·조직 전환·위험 작업 회귀와 API 결과 비교 |
| RF-801 | 문서·검색·지식 | 미착수 | RF-704~705 | tree/editor/preview/revision/provenance와 전달 흐름 회귀 |
| RF-802 | 일정 | 미착수 | RF-704~705 | tree/timeline/today/kanban, 생성·수정·복원 회귀 |
| RF-803 | 에이전트·보고·로그·테스트 | 미착수 | RF-704~705 | 계층·실행 상태·증거 표시와 장시간 갱신 회귀 |
| RF-804 | 연동·MCP 연결·데이터베이스 | 미착수 | RF-704~705 | credential 비노출, OAuth, 연결 증거, 설정 전달과 권한 회귀 |
| RF-805 | legacy UI 제거 후보 확인 | 후순위 | RF-800~804 | 실제 사용자·route·asset 참조가 없고 관측 기간과 rollback 기준 충족 |

### 9. MCP Apps host

| ID | 작업 | 상태 | 선행 | 완료 조건 |
| --- | --- | --- | --- | --- |
| RF-900 | 실제 외부 UI 사례와 capability 범위 확인 | 후순위 | RF-704 | native renderer로 부족한 사례를 확인하고 최소 capability를 ADR에 기록 |
| RF-901 | sandbox iframe과 CSP 교집합 | 후순위 | RF-900 | opaque/별도 origin, 최소 sandbox와 네트워크 정책 보안 테스트 |
| RF-902 | AppBridge lifecycle과 messaging | 후순위 | RF-900 | exact origin/source/schema, pending request와 teardown 검증 |
| RF-903 | 읽기 전용 theme context | 후순위 | RF-404, RF-901~902 | 계산된 token만 전달하고 host storage·credential 접근 차단 |

### 10. 검증·배포·전환

| ID | 작업 | 상태 | 선행 | 완료 조건 |
| --- | --- | --- | --- | --- |
| RF-1000 | package별 unit 및 root contract gate | 미착수 | RF-103, RF-200~204 | Python/TS validator parity, package unit, cross-boundary test 통과 |
| RF-1001 | tenant·RLS·schema·SSRF·sandbox 보안 gate | 부분 완료 | 관련 slice | 현행 보안 테스트를 목표 경계로 포팅하고 새 제한 검증 |
| RF-1002 | 브라우저·접근성·visual gate | 부분 완료 | RF-308, RF-701 | 데스크톱/좁은 폭, keyboard, 복원, theme, 권한과 모든 상태 통과 |
| RF-1003 | migration·build·image·smoke gate | 부분 완료 | RF-201~204, DB 변경 | clean DB head, immutable build, staging smoke와 rollback rehearsal |
| RF-1004 | 관측과 단계적 기본 경로 전환 | 후순위 | RF-800~804, RF-1000~1003 | 오류율·binding latency·publish rollback·sandbox violation 기준 충족 |
| RF-1005 | compatibility adapter와 legacy 경로 제거 | 후순위 | RF-1004 | 사용자 잔존 없음 확인, 제거 후 전체 gate 및 복구 절차 검증 |

## 현재 재사용 가능한 기반

| 현행 자산 | 목표 사용 | 주의점 |
| --- | --- | --- |
| `assets/ui-kit/src/components/` | design-system primitive·navigation·layout 포팅 입력 | vanilla DOM 계약을 React 공개 API로 그대로 간주하지 않는다. |
| `assets/ui-kit/vendor/`와 provenance | 아이콘·외부 소스의 출처 및 라이선스 입력 | 생성물과 editable source를 분리하고 고지를 보존한다. |
| `static/ui/` | 전환 기간 legacy runtime | 목표 design-system의 편집 원본으로 직접 수정하지 않는다. |
| `static/css/ui.css` | semantic token과 공통 상태의 현행 기준 | 사용자 테마와 React용 token build 계약이 추가로 필요하다. |
| `template/workspace/index.html` inline SVG | 작업 목록 아이콘 inventory | stable ID와 manifest로 이동 후 compatibility route에서만 유지한다. |
| `tests/test_architecture_boundaries.py` | 목표 dependency 검사 출발점 | Python legacy 경계 외에 TS와 apps/packages 방향을 추가한다. |
| `tests/browser/*.cjs` | 현행 사용자 흐름 characterization | mocked API 범위와 실제 DB/브라우저 범위를 구분한다. |
| `app/modules/*` 서비스·repository | `platform-core`/`platform-adapters` 포팅 입력 | 파일 이동과 도메인 의미 변경을 같은 단계에서 수행하지 않는다. |
| `app/worker`, `app/scheduler` | `apps/worker`와 execution use case 포팅 입력 | durable Job 권위와 payload 재검증을 유지한다. |
| `app/db/migrations` | 루트 `migrations` 전환 입력 | 배포된 revision history를 다시 쓰지 않고 append-only로 유지한다. |

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

1. RF-002: ADR-001~010을 구현 판단과 적용 상태를 담은 실제 문서로 만든다.
2. RF-003: 리팩터링 전 핵심 흐름의 실행 가능한 기준선과 결과를 기록한다.
3. RF-004: 현행 파일을 목표 소유자에 매핑해 첫 이동 범위를 고정한다.
4. RF-100~105: Workbench·에셋·테마 계약과 의존성 검사를 먼저 구현한다.
5. RF-200~204: 계약 fixture가 실제로 동작하는 최소 모노레포 골격을 만든다.

단순 디렉터리 생성만으로 상태를 완료로 바꾸지 않는다. 각 행의 완료 조건과 해당 검증이
함께 충족된 경우에만 완료로 갱신한다.
