# Agent Factory UI Assets

전사 적용의 기준으로 제작한 공통 에셋 키트다. 초기 독립 키트 준비는 완료했고,
현재 저장소 제품 화면에 단계적으로 연결 중이다. 실제 운영 서버 배포 완료를 뜻하지 않는다.
적용 범위·제품 검증·남은 작업은 [제품 적용 기록](../../docs/ui-asset-rollout.md)을 따른다.
제품 산출물은 `node assets/ui-kit/scripts/build-product.mjs`, 동기화는 같은 명령의 `--check`로 검증한다.
범위별 검증 증거와 한계는 [ACCEPTANCE.md](../../docs/ui-kit/ACCEPTANCE.md), 사용 계약은 [ui-kit-api.md](../../.codex/skills/rule-ui/references/ui-kit-api.md)에 있다.

제품에서 검토: **슈퍼 관리자 → 공통 에셋**. 화면 안에서 카탈로그를 조작하거나
새 탭으로 열 수 있다. `/admin/assets/`와 하위 카탈로그 파일은 세션의
`is_platform_admin` 권한을 서버에서 검사한다. 조직 관리자 권한만으로는 열 수 없다.
설치 경로가 `/factory`이면 `/factory/admin/assets/`를 사용한다.
카탈로그는 데모 데이터를 사용하며 이 메뉴 추가는 전체 제품 에셋 전환 완료를 뜻하지 않는다.

파일/폴더 아이콘은 공식 Material Icon Theme 5.38.1을 사용한다.
`vendor/material-icon-theme/`에 npm 배포본의 원본 SVG 1,251개, 공식 매핑,
MIT 라이선스와 파일별 SHA-256/배포본 SHA-512를 보관한다.
`build-material-icons.mjs`가 원본 무결성을 검사하고 현재 탐색기에 쓰는 26개를
로컬 레지스트리로 생성한다. 지원하는 파일명/확장자/폴더명은 공식 매핑을 따르고,
그 외에는 원본 기본 file/folder 아이콘을 사용한다. 외부 CDN 요청은 없다.
액션 버튼·펼침 화살표는 기존 Tabler 아이콘을 유지한다.

[독립 전달 묶음](release/agent-factory-ui-assets.tar.gz)에는 소스·가공 코드·카탈로그·공통 CSS·라이선스·파일별 해시를 포함했다.

## 구조

- package.json / package-lock.json: 버전·배포 무결성 고정
- src/components/: 제품 소유 공통 컴포넌트와 동작 어댑터
- src/product-*.js: 제품 번들의 작은 진입점
- catalog/: 개발자 검토 카탈로그의 동작과 전용 밀도 스타일. 예제는 기반,
  입력·작업, 탐색, 피드백·오버레이, 레이아웃, 리소스 조합 도메인으로 분류한다.
- scripts/: 빌드·무결성·패키징 실행 파일
- tests/: 독립 카탈로그 브라우저 검증
- styles/theme.css: 기존 static/css/ui.css를 소비하는 프로젝트 테마
- ../../docs/ui-kit/: 사용 계약, 인수 기준, 제작 범위(소스 저장소 전용)
- vendor/: 고정 외부 원본과 라이선스
- generated/: 브라우저용 로컬 파일과 36개 포함 패키지의 고지
- index.html: 실제 동작을 확인하는 카탈로그 진입점

## 개발

빌드 환경은 Node.js 22 이상이다. Uppy의 일부 전이 의존성이 Node 22를 요구한다. Node 22.23.2에서 npm ci --ignore-scripts 후 전체 번들·라이선스 생성이 성공했다.

이 디렉터리에서:

```sh
npm ci --ignore-scripts
npm run build
npx playwright install chromium
npm run verify
npm run package
npm run verify:package
```

저장소 루트에서:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

`http://127.0.0.1:8765/assets/ui-kit/`로 확인한다.

## 현재 증거 / 남은 작업

초기 Chromium 확인: 모듈 로딩 오류 없음, 검색형 선택 2개 초기화, 분할 패널 ArrowRight 조작으로 35→36 변경, 390px에서 가로 넘침 없음, 초기 화면 외부 런타임 요청 없음.

추가 구현: 알림/오버레이/업로드, 기본 컨트롤/아이콘, 탐색과 목록·설정 조합. 사용 계약은 [ui-kit-api.md](../../.codex/skills/rule-ui/references/ui-kit-api.md)에 있다.

- `tests/verify-interactions.cjs`: 알림, 확인창, Drawer, 포커스와 제거.
- `tests/verify-uploads.cjs`: 업로드 실패/재시도/완료/취소/제한/제거.
- `tests/verify-navigation.cjs`: 탭·페이지 이동·메뉴·팝오버.
- `tests/verify-compositions.cjs`: 목록 필터/검색/상세/초기화, 설정 저장 성공/실패/취소.
- `tests/verify-inputs.cjs`: 비동기 선택 성공/오류/빈 결과, IME 검색, 아이콘, Switch.
- `tests/verify-states.cjs`: 다중 선택, 응답 경합/취소, 오류/비활성/제거, 분할, 시각 및 상태 의미.
- `tests/verify-http.cjs`: 임시 loopback 서버를 사용한 multipart 업로드/드롭/서버 오류/취소.
- `tests/verify-web-components.cjs`: Tree/Tooltip/Page와 외부 런타임 요청 부재.
- `scripts/verify-provenance.mjs`: 고정 버전, 잠금 파일, 라이선스와 번들/SVG 해시.

서버 실행 후 Playwright가 설치된 환경에서 각 CJS를 실행한다. 테스트용 Node 경로를 지정해야 하는 환경에서는 NODE_PATH를 해당 Playwright node_modules 위치로 설정한다.

위 검증은 독립 에셋 범위를 대상으로 한다. 실제 제품 API·권한·화면 교체와 전사 화면 회귀 테스트, Firefox/Safari 및 화면 낭독기 인증을 대신하지 않는다.

외부 저작권은 원 저작자에게 남으며, 프로젝트 테마와 어댑터를 가공했다고 해서 vendor 코드를 자체 창작물로 재표시하지 않는다. 배포 시 generated/licenses 및 linked legal notices를 보존한다.
