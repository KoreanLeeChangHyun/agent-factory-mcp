# 문서 탐색기와 에디터

가공·명세 문서는 하나의 읽기 전용 에디터를 공유한다. 개요와 원본 문서 검색은
별도 화면이며 화면 전환은 열린 탭·분할을 제거하지 않는다. 다른 조직이나
작업공간으로 전환하면 탭, 선택, 요청, Blob URL을 모두 정리한다.

## 문서 경로와 API

기존 Document API의 `metadata.path`에 `설계/API/인증.md` 같은 상대 경로를 저장한다.
응답에서는 `document_metadata.path`로 전달된다. 폴더는 이 경로의 공통 접두사로
구성되며 별도 파일 시스템이나 폴더 저장소를 만들지 않는다. 경로가 없으면 제목을
최상위 파일 이름으로 사용한다. 식별자는 경로가 아닌 Document UUID이므로 같은
이름의 문서도 별개로 열린다. 빈 폴더 생성과 실제 문서 이동·삭제는 범위 밖이다.

경로는 최대 1024자·32단계이며 절대 경로, 빈 구성 요소, `.`·`..`, 역슬래시,
제어 문자는 허용하지 않는다. 기존의 부적합한 메타데이터는 최상위 제목으로 표시한다.
파일이 존재하지만 버전이 없으면 목록에서 내용 없음으로 표시하고 열지 않는다.

목록은 기존 테넌트별 `/documents`, 내용은 인증된
`/documents/{id}/revisions/{revision_number}/content`를 사용한다. 본문을 직접
다운로드하는 응답은 유지하고 브라우저에서는 fetch로 읽는다. 텍스트·Markdown·CSV는
원문, JSON은 들여쓰기된 텍스트, PNG·JPEG·GIF·WebP는 이미지, PDF는 PDF.js로
페이지를 그려 표시한다. DOCX·ZIP은 다운로드 동작을 제공한다. HTML을 애플리케이션 DOM에
삽입하지 않는다. 본문 오류와 권한 오류는 해당 탭에서 표시하고 재시도할 수 있다.

PDF.js 6.3.289의 호환성(legacy) 빌드를 로컬 배포하며 본문은 기존 인증된 다운로드 API로 읽는다.
페이지 이동·확대·축소·다운로드를 제공하고 한 페이지의 캔버스를 최대 800만 픽셀로
제한한다. 문서의 스크립트를 실행하지 않고 PDF.js의 eval·WASM 사용도 비활성화한다.
탭을 닫으면 PDF 작업과 워커를 정리한다. 외부 CDN이나 브라우저 내장 PDF 뷰어를
요구하지 않는다. 라이선스는 `static/vendor/pdfjs/6.3.289/LICENSE`에 포함되어 있다.

## 조작

- 탐색기: 펼치기·접기, 검색, Ctrl/Cmd·Shift 다중 선택, 우클릭 열기·옆에 열기.
  가공·명세 헤더는 제목(펼치기·접기), 검색 입력, 모두 접기, 개요 차트 SVG 순서다.
  개요·탐색기 별도 행 없이 파일 트리가 헤더 바로 아래에 나타난다.
  접힌 그룹에서도 검색할 수 있으며 입력하면 검색 결과 영역을 펼친다.
  모두 접기는 검색을 지우고 해당 종류의 모든 폴더를 접는다. 문서나 열린 탭은 닫지 않는다.
  개요는 텍스트 행 대신 접근 가능한 이름과 툴팁을 가진 차트 아이콘으로 연다.
  원본 문서는 헤더 검색 영역 없이 제목·테이블 SVG·개요만 표시한다.
  테이블 아이콘은 기존 메타데이터 표를 열고, 표 내부 검색·필터는 유지한다.
  세 헤더는 같은 열 너비를 사용한다. 원본의 테이블 아이콘은 모두 접기 열에,
  개요 아이콘은 공통 마지막 열에 맞춘다. 빈 접기 컨트롤은 만들지 않는다.
- 키보드: 방향키·Home·End 탐색, Enter 열기, Ctrl/Cmd+Enter 옆에 열기,
  Space 선택, Ctrl/Cmd+A 전체 선택, Shift+F10 메뉴.
- 한 번 클릭은 그룹별 미리보기 탭 재사용, 더블클릭·Enter는 탭 유지.
- 탭 메뉴: 고정, 닫기, 다른 탭·오른쪽 탭·전체 탭 닫기, 네 방향 분할,
  탐색기에 표시. 고정 탭은 일반 일괄 닫기에서 보호한다.
- 그룹 메뉴: 아래 분할, 확대·복원, 그룹 닫기, 전체 에디터 닫기.
- 탭 방향키·Home·End 전환, Ctrl/Cmd+Tab 순환, F6/Shift+F6 그룹 순환,
  Ctrl/Cmd+W 닫기, Ctrl/Cmd+Shift+W 일반 탭 일괄 닫기,
  Ctrl/Cmd+백슬래시 좌우 분할, Shift를 추가하면 상하 분할.
  브라우저가 선점하는 단축키는 버튼과 메뉴로도 실행할 수 있다.
- 탐색기 파일 드롭은 열기, 탭 드롭은 이동, Ctrl 또는 Alt를 누른 탭 드롭은 복사.
  중앙 드롭은 해당 그룹, 가장자리 드롭은 새 분할, 탭 바 드롭은 순서 지정.
- 경계선 드래그·방향키로 크기 조절, 더블클릭으로 균등 분할.
- 활성 탭을 닫으면 오른쪽 이웃, 없으면 왼쪽 이웃을 활성화한다. 비활성 그룹을
  닫아도 기존 활성 그룹은 유지한다. 빈 그룹은 제거하며 마지막 빈 그룹만 남긴다.

별도 브라우저 창과 레이아웃 저장·복원은 이번 구현 범위에 포함하지 않는다.

## 검증

`tests/knowledge/browser/document-editor.cjs`는 실제 Chromium에서 정적 셸을 로드하고 테넌트
API 응답을 고정 fixture로 제공한다. 탐색기, 탭, 분할, 포인터 DND, 권한 오류·재시도,
작업공간 전환, 좁은 화면을 검증한다. 실서비스 연결 검증을 대신하지 않는다.

```sh
DOCUMENT_HEADERS_ONLY=1 NODE_PATH=/tmp/af-pw/node_modules node tests/knowledge/browser/document-editor.cjs
NODE_PATH=/tmp/af-pw/node_modules node tests/knowledge/browser/document-editor.cjs
.venv/bin/python -m pytest tests/knowledge/regression/test_document_paths.py tests/knowledge/regression/test_documents.py tests/workspaces/regression/test_workspace_ui.py
```
