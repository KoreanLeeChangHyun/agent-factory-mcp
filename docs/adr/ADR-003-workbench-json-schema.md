# ADR-003: JSON Schema 기반 Workbench 계약 v1

- 상태: 적용됨
- 결정일: 2026-09-12
- 적용 범위: Workbench 정의·release·descriptor·view state·appearance

## 맥락

Python 서버와 TypeScript renderer가 고객 정의를 같은 방식으로 거부하거나 수용해야 한다.
언어별 모델을 원본으로 사용하면 드리프트가 생기고 고객 정의에 실행 코드가 들어갈 위험이 있다.

## 결정

`contracts/schemas/`의 JSON Schema를 유일한 실행 계약 원본으로 사용한다. v1은 definition,
release, descriptor, sidebar, panel, component, binding, action, view-state와 ThemeProfile을
각각 닫힌 객체로 정의한다. 외부 `$ref`, 재귀, executable expression, raw CSS/SVG, import
경로, credential, raw header, 임의 URL을 금지한다. JSON 크기·깊이·컴포넌트 수·문자열 길이와
검증 시간을 제한한다. 공개 component/action/binding은 versioned ID만 참조한다.

Python과 TypeScript 타입 및 validator는 생성물이며 직접 수정하지 않는다. 같은 valid/invalid/
compatibility fixture에 같은 판정을 해야 한다. minor 호환 변경과 major breaking 변경을 fixture로
구분하고 schema digest를 release에 고정한다.

## 대안

- Pydantic 또는 TypeScript 타입 원본: 다른 언어를 종속시키므로 제외한다.
- 자유 형식 JSON과 런타임 관용 처리: 보안·호환성 실패가 늦게 드러나므로 제외한다.
- 고객 React 코드: 신뢰 경계와 배포 재현성을 깨므로 제외한다.

## 결과와 적용

RF-100~104에서 source schema, 생성기와 parity gate를 함께 추가한다. Documents fixture가
첫 실제 소비자다. 현행 HTTP/MCP Pydantic schema는 해당 endpoint가 새 계약 adapter로
전환될 때까지 유지한다. 제품별 권한·문서·연동 의미는 `spec-platform`에 남고 이 schema에
복사하지 않는다. v1 제거는 새 major renderer와 저장된 모든 release의 호환/마이그레이션
증거 및 rollback 기간이 확보된 뒤에만 가능하다.
