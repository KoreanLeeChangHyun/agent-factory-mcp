import { element, button, field, status } from './primitives.js';
import { inline, stack, collectionLayout, listDetailLayout, settingsLayout, metadataList } from './layouts.js';
import { searchField, pagination } from './navigation.js';

/** Local collection projection; owner supplies authoritative rows. */
export function resourceCollection({ rows = [], pageSize = 5 } = {}) {
  let query = '', kind = '', selected = null;
  const list = element('div','af-stack');
  const detail = element('div','af-stack');
  const summary = element('p','af-muted'); summary.setAttribute('role','status');
  const search = searchField({ label:'리소스 검색',onSearch:value => { query = value; pages.setPage(1); render(); } });
  const filter = field({ label:'유형 필터',type:'select',options:[{label:'전체',value:''},{label:'문서',value:'document'},{label:'연결',value:'connection'}] });
  filter.control.addEventListener('change',() => { kind = filter.control.value; pages.setPage(1); render(); });
  const reset = button({label:'필터 초기화',onClick:() => { query = ''; kind = ''; search.control.value = ''; filter.control.value = ''; pages.setPage(1); render(); }});
  const pages = pagination({ total:rows.length,pageSize,onChange:() => render() });
  const filters = inline(search.root,filter.root,reset);
  filters.classList.add('af-filter-bar');
  const root = collectionLayout({ filters,content:stack(summary,listDetailLayout({list,detail})),pagination:pages.root });
  function render() {
    const filtered = rows.filter(row => (!kind || row.kind === kind) && row.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    pages.setTotal(filtered.length);
    summary.textContent = filtered.length + '개 리소스';
    list.replaceChildren();
    const slice = filtered.slice((pages.page - 1) * pageSize,pages.page * pageSize);
    slice.forEach(row => {
      const select = button({ label:row.title,onClick:() => { selected = row.id; renderDetail(); syncSelection(); } });
      select.classList.add('af-resource-select'); select.dataset.resourceId = row.id;
      list.append(select);
    });
    if (!filtered.length) list.append(status({kind:'empty',text:'검색 조건에 맞는 리소스가 없습니다.'}));
    if (!filtered.some(row => row.id === selected)) selected = null;
    renderDetail(); syncSelection();
  }
  function syncSelection() {
    list.querySelectorAll('[data-resource-id]').forEach(node => node.setAttribute('aria-pressed',String(node.dataset.resourceId === selected)));
  }
  function renderDetail() {
    const row = rows.find(row => row.id === selected);
    detail.replaceChildren(row ? metadataList([['이름',row.title],['유형',row.kind],['설명',row.description ?? '']]) : status({kind:'empty',text:'목록에서 리소스를 선택하세요.'}));
  }
  render();
  return { root,setRows(value) { rows = value; render(); } };
}

/** Owner-injected persistence. Cancel restores the last acknowledged values. */
export function settingsForm({ initial = '', save } = {}) {
  if (typeof save !== 'function') throw new Error('Settings requires a save function.');
  let persisted = initial, disposed = false, pending = null;
  const name = field({label:'표시 이름',value:initial,required:true});
  const form = element('form','af-stack');
  const feedback = element('p'); feedback.setAttribute('role','status');
  const submit = button({label:'저장',variant:'primary'}); submit.type = 'submit';
  const cancel = button({label:'취소',onClick:() => { name.control.value = persisted; name.setError(''); feedback.textContent = '변경을 취소했습니다.'; }});
  form.append(name.root,inline(submit,cancel),feedback);
  const listener = new AbortController();
  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (pending) return;
    const value = name.control.value.trim();
    if (!value) { name.setError('이름을 입력하세요.'); name.control.focus(); return; }
    pending = new AbortController();
    submit.disabled = cancel.disabled = name.control.disabled = true;
    form.setAttribute('aria-busy','true'); feedback.textContent = '저장 중'; name.setError('');
    try {
      const accepted = await save(value,{signal:pending.signal});
      if (disposed) return;
      persisted = typeof accepted === 'string' ? accepted : value;
      name.control.value = persisted; feedback.textContent = '저장했습니다.';
    } catch(error) {
      if (!disposed) { name.setError(error.message); feedback.textContent = '저장하지 못했습니다.'; }
    } finally {
      pending = null;
      if (!disposed) { submit.disabled = cancel.disabled = name.control.disabled = false; form.removeAttribute('aria-busy'); }
    }
  },{signal:listener.signal});
  const nav = element('a','','일반 설정'); name.control.id ||= 'settings-name'; nav.href = '#' + name.control.id;
  return { root:settingsLayout({navigation:nav,form}),destroy() { disposed = true; pending?.abort(); listener.abort(); } };
}
