# ADR-010: broad 공통 에셋 카탈로그와 사용자별 semantic-token 테마

- 상태: 적용됨
- 결정일: 2026-09-12
- 적용 범위: design-system, authoring catalog, ThemeProfile

## 맥락

첫 Documents 화면에 필요한 한두 컴포넌트만 제공하면 고객이 일반적인 SaaS 작업을 조합할 수
없다. 반대로 자유 CSS, SVG와 컴포넌트별 색상은 제품 일관성, 접근성 및 보안 검증을 깨뜨린다.
현행 UI kit, inline SVG와 고정 token은 유용한 포팅 입력이지만 사용자별 테마 authority가 없다.

## 결정

`packages/design-system`만 foundations, reviewed assets, primitives, navigation, data-display,
layout, patterns, shell surfaces, content와 accessibility를 소유한다. 초기 공개 catalog에는 다수의
작업 아이콘과 flat/group/tree/search/filter/detail-row 사이드바 조합, detail/list-detail/collection/
settings/dashboard/document/split/timeline/kanban 패널, 입력·표·상태·dialog·toast와 loading/empty/
stale/error/permission 상태를 포함한다. 각 항목은 stable version ID, allowed region, prop schema,
binding I/O, state/action, 접근성, provenance/license, 예제와 interactive preview를 가진다.

모든 공개 에셋은 semantic token만 소비한다. 서버 저장 `ThemeProfile`은 사용자 소유 revision,
dark/light/high-contrast 기반과 allowlisted color/density override만 허용한다. 저장 전에 contrast와
focus visibility를 검증한다. 서버가 기기 간 authority이고 user/organization/workspace가 분리된
browser cache는 초기 paint만 보조한다. 로그아웃/사용자 전환 시 격리하며 reduced motion과
high-contrast 접근성 선택이 조직/Workspace 기본보다 우선한다. 임의 CSS, raw SVG, React import와
per-component color override는 금지한다.

## 대안

- 현행 CSS를 그대로 공개 API화: vanilla DOM과 생성물 계약을 고정하므로 제외한다.
- fixture 최소 catalog: 고객 조합성 요구를 충족하지 못해 제외한다.
- arbitrary theming: contrast와 일관성을 검증할 수 없어 제외한다.

## 결과와 적용

`assets/ui-kit/src`는 editable 포팅 입력, `static/ui`는 legacy 생성 runtime, vendor/provenance와
license는 보존 대상으로 분리한다. 기능 전용 chart 좌표나 document preview는 해당 feature에
남긴다. catalog descriptor는 ADR-003 schema를 소비하고 authoring surface도 같은 registry를 쓴다.
UI 행동 계약은 `rule-ui`, 제품별 행동은 `info-platform`/`design-platform`/`rule-platform`, 목표 배치는 `rule-workbench-structure`가
소유한다. legacy asset 제거 조건은 byte/provenance 비교, public ID/state/accessibility/visual gate,
모든 소비자 전환과 rollback 관측 기간의 완료다.

Stage 3에서 `ThemeProfile`의 core port/use case, PostgreSQL adapter와 forced user RLS,
revision `0` 기본값에서 시작하는 compare-and-set 저장, semantic palette 검증기,
인증 HTTP compatibility mount 및 React cache/bootstrap/editor 경계를 구현했다. 현행
vanilla Workspace 전체 소비자 전환은 RF-800~804와 RF-1004, sandboxed MCP App theme
context는 RF-903 이후 완료 대상으로 유지한다.
