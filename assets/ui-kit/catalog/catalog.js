import { createCombobox, createSplitPane } from '../src/components/components.js';
import { explorerTree } from '../src/components/explorer-tree.js';
import { createToastManager } from '../src/components/toasts.js';
import { createOverlay, createConfirmDialog } from '../src/components/overlays.js';
import { createUploadQueue } from '../src/components/uploads.js';
import { resourceCollection, settingsForm } from '../src/components/compositions.js';
import { tabs, breadcrumb, pagination, searchField, buttonGroup } from '../src/components/navigation.js';
import { createPopover } from '../src/components/popovers.js';
import { icon, iconNames, iconButton } from '../src/components/icons.js';
import { button, field, toggle, status, badge, skeleton, element } from '../src/components/primitives.js';
import { grid, stack, inline } from '../src/components/layouts.js';
document.body.classList.toggle('is-embedded', window.self !== window.top);
const notifications = createToastManager(document.body);
const explorer = explorerTree({label:'탐색 트리',items:[
  {id:'workspace',label:'agent-factory',expanded:true,children:[
    {id:'docs',label:'docs',expanded:true,children:[
      {id:'readme',label:'README.md'},
      {id:'design',label:'공통 에셋 디자인 가이드.md'},
      {id:'long',label:'아주 긴 한국어 문서 이름과 컴포넌트 적용 범위 검토 기록.md'},
    ]},
    {id:'src',label:'src',children:[{id:'main',label:'main.js'}]},
    {id:'tests',label:'tests',expanded:true,children:[
      {id:'benchmarks',label:'benchmarks',children:[]},
      {id:'contracts',label:'contracts',children:[]},
      {id:'integration',label:'integration',children:[]},
      {id:'runtime',label:'runtime',children:[]},
      {id:'support',label:'support',children:[]},
    ]},
    {id:'locked-file',label:'비공개 문서.md',disabled:true},
  ]},
],onSelect:ids=>{document.getElementById('explorer-result').textContent=`${ids.length}개 선택`;},
onActivate:()=>{document.getElementById('explorer-result').textContent='항목 열기 예제';}});
document.getElementById('explorer-example').append(explorer.root);
document.getElementById('icon-example').append(...iconNames.map(name => stack(inline(icon(name,{size:14}),icon(name)),element('code','',name))),iconButton('plus','추가 예제'));
const fields = [
  field({ label:'워크스페이스 이름', help:'한글·영문 이름을 입력하세요.' }),
  field({ label:'설명', type:'textarea' }),
  field({ label:'환경', type:'select', options:[{ label:'개발',value:'dev' },{ label:'운영',value:'production' }] }),
  field({ label:'권한 없는 입력', disabled:true, value:'읽기 전용 예제' }),
];
fields[0].setError('오류 상태 예제: 이름을 입력하세요.');
document.getElementById('primitive-example').append(
  inline(...['secondary','primary','danger','link'].map(variant => button({ label:variant, variant }))),
  grid(...fields.map(item => item.root)),
  inline(toggle({ label:'선택' }).root, toggle({ label:'알림 사용',type:'switch' }).root,
    toggle({ label:'개발',type:'radio',name:'env',checked:true }).root, toggle({ label:'운영',type:'radio',name:'env' }).root),
  inline(badge('활성','success'), badge('주의','warning')),
  grid(...['loading','empty','success','error','permission','warning'].map(kind => status({ kind,text:kind + ' 상태 예제' }))),
  skeleton(),
);
const busyExample = button({label:'저장 중'}); busyExample.setBusy(true);
document.getElementById('primitive-example').append(inline(button({label:'비활성 작업',disabled:true}),busyExample));
document.querySelectorAll('[data-demo-toast]').forEach(button => button.addEventListener('click', () => {
  const type = button.dataset.demoToast;
  notifications.show({ id:'demo-' + type, type, title:button.textContent, description:'알림 예제입니다. 실제 작업 상태가 아닙니다.' });
}));
const disposables = [
  createCombobox(document.getElementById('workspace-choice')),
  createCombobox(document.getElementById('team-choice')),
  createSplitPane(document.getElementById('split-example'), { id:'catalog-split', storageKey:'af-kit:demo-split' }),
  explorer,
];
const remoteStatus = document.getElementById('remote-status');
const remote = createCombobox(document.getElementById('remote-choice'), {
  loadThrottle:0,
  onError:error => { remoteStatus.textContent = error.message; },
  load:async (query,{signal}) => {
    remoteStatus.textContent = '검색 중 (로컬 예제)';
    await new Promise((resolve,reject) => {
      const timer = setTimeout(resolve,150);
      if (signal.aborted) { clearTimeout(timer); reject(new DOMException('취소됨','AbortError')); return; }
      signal.addEventListener('abort',() => { clearTimeout(timer); reject(new DOMException('취소됨','AbortError')); },{once:true});
    });
    if (query === '실패') throw new Error('검색 실패 예제');
    const rows = ['디자인','개발','운영'].filter(text => text.includes(query)).map(text => ({value:text,text}));
    remoteStatus.textContent = rows.length ? rows.length + '개 결과 (로컬 예제)' : '검색 결과 없음';
    return rows;
  },
});
disposables.push(remote);
const drawer = await createOverlay(document.getElementById('demo-drawer'));
const confirm = await createConfirmDialog(document.body, { title:'예제 삭제 확인', message:'데모 확인창입니다. 실제 데이터는 삭제하지 않습니다.', confirmLabel:'삭제', destructive:true });
disposables.push(drawer, confirm);
const collection = resourceCollection({rows:Array.from({length:12},(_,index) => ({id:String(index),title:'예제 리소스 ' + (index + 1),kind:index % 2 ? 'document' : 'connection',description:'로컬 카탈로그 데이터'}))});
document.getElementById('collection-example').append(collection.root);
const settings = settingsForm({initial:'예제 이름',save:async (value,{signal}) => {
  await new Promise((resolve,reject) => {
    const timer = setTimeout(resolve,250);
    signal.addEventListener('abort',() => { clearTimeout(timer); reject(new DOMException('취소됨','AbortError')); },{once:true});
  });
  if (value === '실패') throw new Error('예제에서 만든 저장 실패');
  return value;
}});
document.getElementById('settings-example').append(settings.root);
disposables.push(settings);
const navHost = document.getElementById('navigation-example');
const demoTabs = tabs({ label:'에셋 분류',items:[
  { id:'layout',label:'레이아웃',content:element('p','','레이아웃 예제') },
  { id:'control',label:'컨트롤',content:element('p','','컨트롤 예제') },
  { id:'disabled',label:'준비 중',disabled:true,content:element('p','','준비 중') },
] });
const queryResult = element('p','','검색어 없음'); queryResult.setAttribute('role','status');
const search = searchField({ onSearch:value => { queryResult.textContent = value || '검색어 없음'; } });
navHost.append(breadcrumb([{ label:'에셋',href:'#' },{ label:'탐색' }]),demoTabs.root,
  pagination({ total:25,pageSize:10 }).root, search.root,queryResult,
  buttonGroup('저장 작업',button({ label:'저장',variant:'primary' }),button({ label:'취소' })));
const menu = createPopover(document.getElementById('menu-button'),document.getElementById('menu-surface'),{ menu:true });
const popover = createPopover(document.getElementById('popover-button'),document.getElementById('popover-surface'));
disposables.push(menu,popover);
const attempts = new Map();
const uploads = createUploadQueue(document.getElementById('upload-example'), {
  maxFileSize:1024 * 1024,
  transport: (file, { signal, onProgress }) => new Promise((resolve, reject) => {
    const attempt = (attempts.get(file.name) ?? 0) + 1;
    attempts.set(file.name, attempt);
    let bytes = 0;
    const timer = setInterval(() => {
      bytes = Math.min(file.size, bytes + Math.max(1, Math.ceil(file.size / 10)));
      onProgress(bytes, file.size);
      if (bytes >= file.size) {
        clearInterval(timer);
        signal.removeEventListener('abort', abort);
        if (file.name.startsWith('fail') && attempt === 1) reject(new Error('데모에서 만든 첫 시도 실패'));
        else resolve({ demo:true });
      }
    }, 80);
    function abort() { clearInterval(timer); reject(new DOMException('취소됨', 'AbortError')); }
    signal.addEventListener('abort', abort, { once:true });
  }),
});
disposables.push(uploads);
document.getElementById('open-drawer').addEventListener('click', event => drawer.open(event.currentTarget));
document.getElementById('close-drawer').addEventListener('click', () => drawer.close());
document.getElementById('open-confirm').addEventListener('click', async event => {
  const accepted = await confirm.ask(event.currentTarget);
  document.getElementById('confirm-result').textContent = accepted ? '확인 선택 (데모)' : '취소 선택 (데모)';
});
window.afCatalog = { disposables, notifications, uploads, destroy() { notifications.destroy(); disposables.forEach(item => item.destroy()); } };
