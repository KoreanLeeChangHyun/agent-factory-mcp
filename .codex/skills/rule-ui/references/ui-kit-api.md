# 공통 에셋 사용 계약

이 키트는 제품 적용 전 독립 에셋이다. 현재 검증 범위는 [SCOPE.md](../../../../docs/ui-kit/SCOPE.md)와 `assets/ui-kit/tests/verify-*.cjs`에 기록한다. 생성 함수의 존재만으로 모든 상태가 검증됐다고 해석하지 않는다.

## 로딩과 소유권

1. static/css/ui.css
2. assets/ui-kit/generated/vendors.css
3. assets/ui-kit/styles/theme.css
4. `assets/ui-kit/src/components/`의 필요한 프로젝트 ES module

소유 컨테이너에 af-kit을 지정한다. 기존 공통 버튼·입력 스타일 범위를 사용하는 경우 workspace-shell도 함께 지정한다. 외부 native/reset CSS는 사용하지 않는다. 컴포넌트 데이터·권한·네트워크 작업은 호출자가 소유한다.

## 기본 컨트롤

- primitives.js: button({label,variant,compact,disabled,onClick}) → button DOM. variant는 secondary/primary/danger/link.
- 반환한 버튼의 setBusy(boolean)은 크기와 원래 비활성 상태를 보존하면서 aria-busy·처리 중 표시를 전환한다.
- field({label,type,value,help,required,disabled,options}) → {root,control,setError(message)}. type textarea/select는 해당 native 요소를 생성한다.
- toggle({label,type,checked,disabled,name,value}) → {root,control}. type checkbox/radio/switch.
- status({kind,text}), badge(text,kind), skeleton({label,lines}), sectionHeader(title,action) → DOM.
- icons.js: icon(name,{size}) → 장식용 SVG. size 14/16/24. iconButton(name,label,onClick)은 접근 가능한 이름과 title을 가진 버튼이다.
- navigation.js: buttonGroup(label,...buttons) → 이름 있는 액션 그룹. roving tabindex toolbar가 아니라 일반 Tab 순서다.

## 레이아웃

layouts.js 함수는 외부 HTML 문자열이 아닌 DOM 노드를 받는다.

- stack/inline/grid(...children), divider()
- pageLayout({title,description,actions,content})
- listDetailLayout({list,detail})
- collectionLayout({header,filters,content,pagination})
- settingsLayout({navigation,form,actions})
- metadataList([[label,value],...]), resourceRow({title,description,action})
- `af-workbench-panel`은 기본 사이드바와 메인 작업영역이 공유하는 셸 표면이다.
  고정 헤더는 `af-workbench-panel__header`, 독립 스크롤 본문은
  `af-workbench-panel__body`를 함께 사용한다. 간격과 모서리는
  `--ui-workbench-panel-gap`, `--ui-workbench-panel-radius` 토큰을 따른다.
- sidebar-host.js `bindSidebarHost(host,{header,body,title,items,defaultTitle})` →
  `{host,views,select,selected,destroy}`. 하나의 기본 사이드바 호스트 안에서 도메인별
  뷰를 전환하고 제목과 `hidden` 상태를 함께 갱신한다. 각 item은 고유 id/title/element를
  제공한다. 호스트에는 공통 `af-kit`·`af-sidebar-host`, 뷰에는 `af-sidebar-view`를
  적용한다. 기존 사이드바의 섹션·섹션 헤더·본문·탐색·행·상태는 대응하는
  `af-sidebar-*` 공통 요소로 채택하며, 이후 동적으로 렌더되는 항목도 같은 계약을 따른다.
  평면 탐색 행은 오른쪽 공통 탐색 표시 슬롯을 사용하고, 상태 문구는 공통 상태 표면으로
  표시한다. 기존 버튼 노드와 이벤트·데이터 속성은 교체하지 않는다.
  데이터 조회와 도메인별 헤더 동작은 호출자가 소유한다.

## 입력·탐색

- explorer-tree.js `explorerTree({label,items,multiSelect,onSelect,onActivate,onToggle,onRender,renderIcon})` → `{root,destroy}`.
  계층 탐색의 우선 공통 에셋이다. 22px 행·12px 들여쓰기·항목 아이콘·긴 이름
  말줄임·계층 안내선을 사용한다. item은 고유 id/label, 선택적 children/expanded/disabled/selected다.
  기본 renderIcon은 Material Icon Theme 5.38.1 원본이며 공식 파일명·확장자·폴더명 매핑을 사용한다.
  다른 리소스 계층은 renderIcon 콜백으로 항목 종류에 맞는 Node를 제공하거나 아이콘을 생략할 수 있다.
  현재 묶음에서 지원하지 않는 이름에는 공식 기본 file/folder 아이콘을 사용한다.
  선택 행은 회색 배경, 포커스 행은 파란 테두리로 표시하고 초기 selected는 콜백을 호출하지 않는다.
  children이 있으면 폴더다. 폴더의 `toggleOnClick=false`는 행/Enter 선택과 disclosure
  토글을 분리한다. 방향키·Home/End·Enter·Space, Ctrl/Meta 다중 선택,
  Shift 범위 선택을 제공한다. 권한 없는 항목은 선택/활성화하지 않는다.
  `multiSelect=false`는 단일 선택 트리로 사용하며, `selectable=false`인 폴더는 펼침만 허용한다.
  onSelect는 선택 ID 배열, onActivate는 활성화할 항목 ID를 받으며 네트워크 요청을 수행하지 않는다.
  onToggle은 항목 ID와 펼침 상태를 받고, onRender는 렌더링할 때마다 현재 행을 받아
  소유자가 드래그·메뉴 같은 도메인 동작을 다시 연결할 수 있게 한다.
  데이터 갱신 시 소유자가 destroy 후 새 투영을 생성한다. 기존 renderNativeTree와
  bindTreeKeyboard를 재사용한다. 원본 아이콘의 색상·도형과 MIT 고지를 보존한다.

- components.js createCombobox(labelledSelect,{multiple,load,onError,...settings}) → {control,setDisabled,setInvalid,destroy}. load(query,{signal})은 [{value,text}]를 반환하는 Promise다. 옵션 텍스트는 이스케이프한다.
- createSplitPane(root,{id,size,orientation,onResize,storageKey,label,keyboardResizeBy}) → {machine,setSizes,destroy}. root 직계 자식으로 data-af-panel 2개와 data-af-resizer 1개를 제공한다. id는 인스턴스별 고유해야 한다. 저장은 선택적이며 권한·데이터 상태를 저장하지 않는다.
- tabs({label,items,onChange}) → {root,select(index),selected}. 각 item은 id/label/content/disabled다. 수평·자동 활성화 탭이며 방향키·Home/End가 비활성 항목을 건너뛴다.
- breadcrumb([{label,href},...]) → nav. 마지막 항목은 현재 페이지다.
- pagination({total,pageSize,page,onChange}) → {root,setPage,setTotal,page}. 서버 데이터 요청은 호출자 책임이다.
- searchField({label,onSearch}) → field 계약. IME 조합 중간값은 검색 콜백으로 보내지 않는다.

## 오버레이·알림

compositions.js의 resourceCollection({rows,pageSize})는 검색·유형 필터·목록/상세·페이지 이동을 조합한다. row는 id/title/kind/description이며 kind는 document/connection이다. setRows로 소유 데이터의 새 투영을 전달한다.

settingsForm({initial,save})은 save(value,{signal})의 성공 응답을 받은 뒤에만 저장된 기준값을 갱신한다. 취소는 마지막 승인값으로 되돌린다. destroy는 미완료 저장을 취소한다.

- popovers.js createPopover(trigger,content,{menu}) → {open,close,destroy}. native popover top layer와 Floating UI 위치 계산을 사용한다. menu=true면 평면 menuitem 버튼을 제공해야 한다. 중첩 메뉴는 별도 범위다.
- overlays.js await createOverlay(waDialogOrDrawer) → {element,open(trigger),close,destroy}. 요소에 label이 필요하다.
- await createConfirmDialog(host,{title,message,confirmLabel,destructive}) → {element,ask(trigger),destroy}. ask는 명시적 승인만 true, 취소/Escape는 false를 반환한다. 동시에 두 요청을 열지 않는다.
- toasts.js createToastManager(host,{id,max}) → {show,update,dismiss,destroy,store}. show는 id를 반환한다. 같은 id는 갱신하며 오류/진행은 기본 지속, 나머지는 기본 5초다. 완료 전 상태를 success로 갱신하지 않는다.
- Tooltip은 wa-tooltip for="trigger-id"로 연결한다. 상호작용 가능한 내용은 Tooltip이 아니라 Popover를 사용한다.

## 업로드·시간

- uploads.js createUploadQueue(host,{transport,maxFileSize,maxNumberOfFiles,allowedFileTypes}) → {uppy,add,destroy}.
- transport(file,{signal,onProgress})은 실제 서버 수락 후 resolve, 실패 시 reject해야 한다. onProgress(bytesUploaded,bytesTotal)를 호출하고 signal 취소를 준수한다.
- 카탈로그의 transport는 명시적인 로컬 시뮬레이션이며 제품 전송기로 사용하지 않는다.
- transport.js의 xhrTransport({endpoint,fieldName,headers,withCredentials,timeout})은 명시적으로 전달한 HTTP(S) 주소에 multipart POST를 수행한다. 기본 withCredentials는 false이고, 성공 JSON/빈 응답만 resolve한다. HTTP 오류·잘못된 JSON·시간초과·취소는 reject한다. 제품 CSRF/인증·저장 계약은 호출자 소유다.
- relative-time은 ISO datetime을 받고, 옆의 time 요소로 절대 시각을 함께 제공한다. 상대 시각은 연결 상태·실행 성공의 근거가 아니다.

## 정리와 라이선스

web-components.js는 tooltip(trigger,text)을 제공하며 destroy로 제거한다. Web Awesome 기본 아이콘 공급원은 CDN 대신 키트의 로컬 SVG data URL로 고정했다.

아이콘 추가: vendor/tabler에 같은 고정 커밋의 검토된 SVG를 넣고 npm run build를 실행한다. 다른 출처/버전을 추가할 때는 build.mjs의 provenance 생성도 해당 출처에 맞춰 확장해야 한다. 원 저작권 고지는 유지한다.

DOM 소유 화면을 제거할 때 제공되는 destroy를 호출한다. 운영 코드에 연결할 때 실제 화면 재진입·교체·중첩 모달·권한 변화 회귀 검증이 필요하다. generated/licenses, vendor/tabler/LICENSE, 생성 번들의 legal notices와 provenance를 함께 배포한다.
# 제품용 경량 어댑터

`resourceTable({headers, rows, emptyText})`는 스크롤 래퍼와 semantic table을 반환한다.
headers는 열 제목, rows는 셀 배열이다. Node 셀은 그대로 이동하여 이벤트를 보존하고,
그 외 값은 text node로 표시한다. 정렬·페이지·가상화·권한 판단은 소유자 책임이다.

`menuKeyboard({items, close})`는 keydown 핸들러를 반환한다. items()는 현재 메뉴
항목 DOM 배열, close(true)는 닫기 및 원래 포커스 복귀를 소유자에게 요청한다.
위치 계산·클릭·DOM 제거·listener 설치/해제는 소유자 책임이다.

`setStatus(element, {kind, text})`는 기존 live region 노드의 참조와 data 속성을
유지하면서 공통 상태 스타일·role·busy를 갱신한다. 빈 text는 숨기며 loading을
벗어나면 aria-busy를 제거한다. kind 판단은 호출자가 서버 응답에 따라 명시한다.
`af-metadata-grid`는 기존 dl > div > dt/dd용 3열/좁은 폭 1열 공통 레이아웃이다.

`bindTabs({list, items, onChange, initial, notifyInitial})`는 기존 DOM을 유지한다.
items는 `{id, button, panel}` 배열이다. `select(index, focus, notify)`,
`selected`, `destroy()`를 제공한다. destroy는 이벤트만 해제하고 DOM은 소유자가
관리한다. 기본 초기 바인딩은 onChange를 호출하지 않는다. 수평 단일 tablist용이다.

`fieldFor({label, control, help})`는 기존 native input/select/textarea를 이동하여
라벨·도움말·오류를 연결한다. `control`의 name/value/검증/이벤트와 기존
aria-describedby를 보존한다. 반환값은 `{root, control, setError(message)}`.

`createNativeConfirm(host, {title, message, confirmLabel, destructive})`는
`{element, ask(trigger), destroy()}`를 반환한다. `ask`는 명시적 승인만 true,
취소/Escape/destroy는 false다. 동시 ask와 destroy 이후 ask는 허용하지 않는다.
소유자는 화면 전환 때 destroy하고, await 뒤 scope 유효성을 재검사해야 한다.
Web Awesome과 무관한 경량 native dialog 버전이며 공유 theme.css를 사용한다.

`bindCodeOperation({root, header, label, control, help})`는 기존 코드/비밀 값 영역에
공통 배치를 연결한다. root가 header와 id 있는 native input/textarea를 포함하고,
header가 label을 포함해야 한다. label 연결과 도움말 aria-describedby를 설정하며
기존 설명 ID를 보존한다. 반환값은 `{root, control}`이다. 입력 값, readonly,
password type, 버튼 이벤트, 복사·보안 처리와 표시/숨김은 소유자가 유지한다.
DOM을 복제하거나 값을 HTML로 직렬화하지 않으며 이벤트/관찰자를 설치하지 않는다.

`metadataGrid(entries)`는 `[label, value]` 배열을 `dl > div > dt/dd`로 생성한다.
모든 값은 텍스트로 출력하고 null/undefined는 `—`로 표시한다. `af-metadata-grid`
공유 스타일은 데스크톱 3열, 700px 이하 1열이다. 기존 DOM에 같은 클래스를
적용해도 되며 데이터 의미·정렬·갱신 시점은 호출자가 소유한다.

`af-status--inline`은 `status`/`setStatus` 결과에 추가하는 압축 표시 변형이다.
role·kind·busy 의미는 그대로 두고 테두리·내부 여백만 제거한다. 폼 내부 오류나
이미 공간을 예약한 작업 결과 메시지에 사용하며 색상은 공통 상태 토큰을 따른다.

`bindNativeDialog(dialog)`는 기존 dialog에 af-dialog/af-kit을 적용하고
`{element, open({initialFocus}), close(value), destroy()}`를 반환한다.
open 시 연결된 DOM과 접근성 이름을 요구하며 initialFocus는 dialog 내부 요소여야
한다. 모달 focus·Escape·close 이벤트는 브라우저가 소유한다. destroy는 닫고
재개를 차단하지만 소유자의 DOM/폼/이벤트를 제거하지 않는다. 기존 native close도
사용할 수 있다. 입력값·검증·저장·scope 전환 정책은 호출자가 유지한다.

`bindResizeHandle(handle, {getValue, onChange, onDragging, axis, step})`는 픽셀 단위
리사이저의 pointer capture/방향키를 공유한다. 기본 axis는 horizontal, step은 16이다.
크기 제한·ARIA value·레이아웃·저장은 호출자가 소유한다. `{cancel, destroy}`를
반환하며 cancel은 현재 드래그만 끝내고 destroy는 이벤트까지 해제한다. 다른 포인터와
오른쪽 버튼은 드래그를 시작하지 않는다. lostpointercapture도 종료 처리한다.

`bindTreeKeyboard(root, {items, isExpanded, onToggle, onActivate, onToggleSelection,
onSelectAll, onContextMenu, onMove})`는 소유자가 제공하는 현재 보이는 depth-first
행 목록에 키보드 계약을 적용한다. 행은 `{key, parentKey, folder, element}`다.
방향키/Home/End는 focus, Enter/Space/전체 선택/메뉴는 콜백으로 전달한다.
onMove에는 Shift 상태가 포함된 원래 이벤트가 전달된다. IME 조합과 이미 처리된
이벤트는 무시한다. destroy는 키보드 리스너만 해제하고 DOM/선택은 제거하지 않는다.

`renderNativeTree(root, {entries, childrenOf, isExpanded, renderRow, groupClass, focusKey})`
는 native tree DOM을 생성하고 `{...entry, element, parentKey}` visible row 배열을
반환한다. entry의 key는 고유해야 하며 folder가 true인 항목만 펼침 상태를 갖는다.
renderRow(entry, {level, expanded})는 소유한 콘텐츠/이벤트를 담은 요소를 반환한다.
공통 렌더러가 tree/treeitem/group ARIA, 형제 내 위치, roving tabindex와 focus 복원을
담당한다. 중복 키는 기존 DOM을 교체하기 전에 거부한다. 정렬·검색·선택·문서 액션은
소유자 계약이다.

`selectKeys({keys, selected, anchor, key, range, toggle})`는 새 `{selected:Set, anchor}`를
반환하는 순수 다중 선택 계산이다. keys는 현재 보이는 선택 가능 항목 순서다.
range는 양 끝을 포함하며 toggle보다 우선한다. 기준 항목이 필터로 사라지면 대상
하나를 새 기준으로 선택한다. 없는 대상은 기존 선택을 보존하고 입력 Set을 변경하지 않는다.
