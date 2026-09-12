# ADR-001: Python·TypeScript 모노레포와 잠금 파일

- 상태: 적용됨
- 결정일: 2026-09-12
- 적용 범위: RF-100 이후의 신규 Workbench 코드와 순차 포팅

## 맥락

React 렌더러와 Python 도메인이 같은 JSON Schema를 소비해야 하며, 현행 단일 Python
패키지의 배포 동작은 포팅 동안 유지해야 한다. 언어별 변경을 별도 저장소로 나누면 계약
변경을 한 검증 단위에서 고정하기 어렵고, 반대로 모든 코드를 한 패키지에 두면 실행 단위와
의존 경계가 흐려진다.

## 결정

하나의 저장소 안에 `apps/`, `packages/`, `contracts/`를 둔다. TypeScript는 pnpm
workspace와 루트 `pnpm-lock.yaml`, Python은 uv workspace와 루트 `uv.lock`을 각각
사용한다. 내부 JavaScript 의존성은 `workspace:` 범위로 제한한다. 언어 중립 schema는
`contracts/`만 원본이며 생성된 Python·TypeScript 파일은 각각 `packages/contracts-py`,
`packages/contracts-ts`에 둔다. 루트 `Makefile`은 두 생태계의 재현 가능한 공통 gate를
호출하되 각 앱과 패키지가 자체 단위 테스트를 소유한다.

## 대안

- 저장소 분리: 계약 원자성과 포팅 추적성이 약해져 제외한다.
- Node 백엔드로 통일: 현행 Python 문서·검색·worker 자산을 불필요하게 재작성하므로 제외한다.
- 기존 단일 `pyproject.toml`에 프런트 자산만 추가: 배포·재사용 경계를 표현하지 못해
  전환 호환 경로로만 유지한다.

## 결과와 적용

첫 scaffold는 Documents vertical slice에 필요한 앱·패키지만 만든다. 빈 최종 트리를 먼저
만들지 않는다. 현행 `pyproject.toml`, wheel, `Dockerfile`은 새 API/worker 이미지가 같은
행동을 검증할 때까지 유지한다. 잠금 파일 생성은 RF-200~203에서 실제 의존성과 함께 수행한다.

계약 소유자는 `.codex/skills/rule-workbench-structure/references/target-structure.md`이며,
현재 제품 행동은 계속 `.codex/skills/spec-platform/references/`가 소유한다. 본 ADR은 그
요구사항을 복제하지 않는다. 제거 기준은 새 공통 gate, wheel/image 비교, rollback 경로가
통과하고 현행 단일 패키지 소비자가 없다는 참조 검사가 완료되는 것이다.
