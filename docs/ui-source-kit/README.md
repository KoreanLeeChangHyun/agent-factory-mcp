# SaaS 공통 UI 소스 조사·도입 키트

확인일: 2026-09-08 · 대상: 현재 HTML/CSS/vanilla JavaScript Workspace · 상태: 검토용, 운영 미연결

## 결론

**Tabler 아이콘과 Floating UI 위치 계산 코드부터 재사용한다.** 완성형 디자인 시스템을 추가하기보다 기존 `static/css/ui.css`의 색상·크기·상태 표현을 유지하고, 외부 소스는 아이콘 및 동작 계층에 제한하는 것이 현재 구조에 적합하다. 이는 아래 공식 자료와 로컬 코드를 비교한 설계 판단이다.

실제 가져온 파일은 SVG 15개, JavaScript 2개, MIT 라이선스 전문 3개다. 버전·원본 URL·파일별 SHA-256은 [manifest.json](manifest.json)에 기록했다. 외부 원본과 프로젝트 가공 코드는 분리했다.

## 후보 비교

| 우선순위 | 후보 | 공식 근거와 적합성 | 결정 / 가공 범위 |
|---|---|---|---|
| P0 | Tabler Outline 3.46.0 | [공식 배포](https://github.com/tabler/tabler-icons/releases/tag/v3.46.0), [MIT 원문](vendor/tabler/LICENSE). 24px 좌표·currentColor·stroke 방식 | 15개 수입. 원본은 유지하고 데모에서는 inline SVG, 14/16px, stroke 1.4로 가공 |
| P0 | Floating UI Core + DOM 1.8.0 | [공식 Vanilla/UMD 사용법](https://floating-ui.com/docs/getting-started). 두 UMD 파일 합계 22,594 bytes, 압축 전 전송 파일 크기 | 수입. 메뉴·팝오버 위치 계산만 사용. 키보드·포커스는 별도 어댑터 |
| P1 | WAI-ARIA APG | [메뉴 버튼 패턴](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/examples/menu-button-actions/). 예제는 production-ready가 아니라고 명시 | 소스 복사 없이 동작 계약 참고. 실제 보조기술 검증 필요 |
| P1 | Native dialog / popover | [HTML dialog 표준](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element), [popover 표준](https://html.spec.whatwg.org/multipage/popover.html) | 현재 showModal 유지. popover는 메뉴 키보드 구현을 대신하지 않음 |
| P2 | GitHub relative-time-element 5.3.1 | [공식 저장소](https://github.com/github/relative-time-element), [배포](https://github.com/github/relative-time-element/releases). 프레임워크 없이 상대 시각 표시 | 조사만. 로그에 실제 필요할 때 도입하며 절대 시각도 제공. 실행 상태 판정용으로 사용하지 않음 |
| P2 | focus-trap 8.2.2 + tabbable 6.5.0 | [공식 UMD·제약](https://github.com/focus-trap/focus-trap#umd). 별도 tabbable 로드 필요 | 보류. native dialog에 중복 도입하지 않음. 커스텀 모달이 필요할 때 검토 |
| P2 | Web Awesome Core | [공식 사용법](https://webawesome.com/docs/), [Core MIT](https://webawesome.com/license), [Pro 별도 라이선스](https://webawesome.com/license/pro) | 개별 Web Component 후보. 테마·Shadow DOM 접점 및 유료 컴포넌트 경계를 검증한 뒤 도입 |
| 참고 | Radix / Base UI | [Radix](https://www.radix-ui.com/primitives/docs/overview/introduction), [Base UI](https://base-ui.com/react/overview/quick-start). React 기반 | 인터랙션 참고만. 공통 버튼 때문에 React 도입하지 않음 |
| 대안 | Lucide | [라이선스](https://lucide.dev/license). ISC와 Feather 유래 MIT 고지를 함께 확인해야 함 | 기술적으로 적합하지만 Tabler와 혼용하지 않음 |
| 제외 | Codicons | [공식 Legal notices](https://github.com/microsoft/vscode-codicons#legal-notices). 아이콘 CC-BY-4.0 / 코드 MIT 구분 | 기존 stroke SVG와 시각 체계가 다름. VS Code형 레이아웃이 아이콘 복제까지 의미하지 않음 |
| 참고 | Cloudscape | [공식 개발 가이드](https://cloudscape.design/get-started/for-developers/using-cloudscape-components/). React 컴포넌트 및 자체 스타일 | 콘텐츠 구조만 참고. 프로젝트 디자인 스킬에 따라 패키지는 도입하지 않음 |

## 현재 코드에 연결할 범위

1. **아이콘 레지스트리**: 기존 인라인 SVG 중 같은 의미가 중복된 항목을 정리한 후 15개 원본을 하나의 레지스트리에 연결한다. 장식용 SVG는 aria-hidden, 아이콘 버튼의 이름은 버튼이 소유한다. img로 삽입하면 부모 currentColor를 상속하지 않으므로 inline 방식을 사용한다.
2. **메뉴 위치 어댑터**: `static/js/workspace.js:426`, `:622`, `static/js/document-editor.js:672`의 수동 좌표 보정이 우선 대상이다. 버튼 기준 메뉴와 우클릭 좌표 기준 메뉴는 구분한다. 후자는 Floating UI virtual reference가 추가로 필요하다.
3. **상태·키보드 계약**: Enter/Space, 방향키, Home/End, Escape, Tab, 외부 클릭, 포커스 복원과 요소 제거 시 정리를 공통화한다. [autoUpdate](https://floating-ui.com/docs/autoupdate)는 열려 있을 때만 실행하고 닫을 때 정리한다.
4. **기존 컨트롤 유지**: 버튼·입력·탭·상태 표시는 기존 ui.css를 사용한다. 표·문서 편집기 전체 교체, 프레임워크 이전, 백엔드 변경은 이번 범위에서 제외한다.

## 로컬 미리보기

저장소 루트에서:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:8765/docs/ui-source-kit/`를 연다. CDN 요청 없이 로컬 파일만으로 동작한다. 외부 출처 링크를 클릭하는 경우에만 웹으로 이동한다.

[데모](index.html)는 현재 ui.css를 직접 사용한다. [menu-adapter.js](menu-adapter.js)는 프로젝트 작성 코드이며 vendor 원본이 아니다. 단일 버튼 액션 메뉴용 검토 예제다. 중첩 메뉴·비활성 메뉴 항목·동적 제거·우클릭 virtual reference·모바일 보조기술까지 검증한 범용 제품 컴포넌트로 간주하지 않는다.

## 라이선스와 검증 한계

검증 완료: Chromium 1280px / 390px에서 가로 넘침, SVG 30개 표시, 방향키·Home/End·Escape·Tab, 액션 선택, 외부 클릭 닫기, 화면 끝 flip/shift, destroy 정리, 외부 런타임 요청 부재를 확인했다. 20개 원본 파일의 SHA-256이 manifest와 일치한다. 재현 스크립트는 [verify.cjs](verify.cjs)다. 서버를 실행한 상태에서 Playwright가 설치된 환경의 Node.js로 실행한다.

MIT 원문을 각각 vendor 디렉터리에 보존했다. 재배포 시 원 저작권·허가 고지도 함께 유지한다. 해시는 수입 파일의 동일성을 확인하는 수단이며 취약점 감사나 배포자 서명 검증을 대신하지 않는다. 유료 제품과 상표 에셋은 가져오지 않았다.

조사는 공식 문서, 공식 저장소·배포 및 npm 메타데이터를 중심으로 수행했다. 다운로드 가능한 최소 의존성, 기존 시각 체계 적합성, 라이선스 경계가 확인되어 탐색을 종료했다. 최종 제품 도입 전 Firefox/Safari, 화면 낭독기, 실제 기능별 회귀 테스트가 남아 있다.
