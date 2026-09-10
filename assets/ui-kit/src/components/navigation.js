import { element, button, field } from './primitives.js';
let serial = 0;
/** Bind live product nodes without replacing their data attributes or controls. */
export function bindTabs({list, items, onChange = () => {}, initial = 0, notifyInitial = false}) {
  if (!list || !items.length) throw new Error('Tabs require a list and items.');
  const id = 'af-tabs-' + ++serial, events = new AbortController();
  let selected = -1, disposed = false;
  list.setAttribute('role','tablist');
  function select(index, focus = false, notify = true) {
    if (disposed || !Number.isInteger(index) || !items[index] || items[index].button.disabled) return;
    selected = index;
    items.forEach((item,i) => {
      item.button.setAttribute('aria-selected',String(i === index));
      item.button.tabIndex = i === index ? 0 : -1;
      item.button.classList.toggle('is-active',i === index);
      item.panel.hidden = i !== index;
    });
    if (focus) items[index].button.focus();
    if (notify) onChange(items[index].id);
  }
  items.forEach((item,index) => {
    const node = item.button, panel = item.panel;
    node.id ||= id + '-tab-' + index;
    panel.id ||= id + '-panel-' + index;
    node.setAttribute('role','tab'); node.setAttribute('aria-controls',panel.id);
    node.setAttribute('aria-selected','false'); node.tabIndex = -1;
    node.classList.remove('is-active'); panel.hidden = true;
    panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby',node.id);
    panel.tabIndex = 0;
    node.addEventListener('click',() => select(index),{signal:events.signal});
    node.addEventListener('keydown',event => {
      const enabled = items.map((item,i) => item.button.disabled ? -1 : i).filter(i => i >= 0);
      let target;
      if (event.key === 'Home') target = enabled[0];
      if (event.key === 'End') target = enabled.at(-1);
      if (event.key === 'ArrowRight') target = enabled[(enabled.indexOf(index) + 1) % enabled.length];
      if (event.key === 'ArrowLeft') target = enabled[(enabled.indexOf(index) - 1 + enabled.length) % enabled.length];
      if (target !== undefined) { event.preventDefault(); select(target,true); }
    },{signal:events.signal});
  });
  const first = Number.isInteger(initial) && items[initial] && !items[initial].button.disabled
    ? initial : items.findIndex(item => !item.button.disabled);
  select(first,false,notifyInitial);
  return {select, get selected() {return items[selected]?.id;}, destroy() {disposed = true; events.abort();}};
}
export function tabs({ label, items, onChange = () => {} }) {
  if (!label || !items.length) throw new Error('Tabs require a label and items.');
  const root = element('div','af-stack'), list = element('div','ui-tabs');
  list.setAttribute('aria-label',label);
  const bindings = items.map(item => {
    const node = button({label:item.label,disabled:item.disabled}); node.className = 'ui-tab';
    const panel = element('div','af-tab-panel');
    if (item.content) panel.append(item.content);
    list.append(node);
    return {id:item.id,button:node,panel};
  });
  root.append(list,...bindings.map(item => item.panel));
  const binding = bindTabs({list,items:bindings,onChange,notifyInitial:true});
  return {root,select:binding.select,destroy:binding.destroy,get selected() {return binding.selected;}};
}
export function breadcrumb(items) {
  const nav = element('nav','af-breadcrumb'); nav.setAttribute('aria-label','현재 위치');
  const list = element('ol','af-inline');
  items.forEach((item,index) => {
    const li = element('li');
    const node = element(index === items.length - 1 ? 'span' : 'a','',item.label);
    if (node.tagName === 'A') {
      const url = new URL(item.href,location.href);
      if (!['http:','https:'].includes(url.protocol)) throw new Error('Unsafe breadcrumb URL.');
      node.href = url.href;
    } else node.setAttribute('aria-current','page');
    li.append(node); list.append(li);
  });
  nav.append(list); return nav;
}
export function pagination({ total = 0, pageSize = 10, page = 1, onChange = () => {} } = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Invalid page size.');
  const root = element('nav','af-inline'); root.setAttribute('aria-label','페이지 이동');
  const label = element('span'); label.setAttribute('role','status');
  const previous = button({ label:'이전', onClick:() => set(page - 1,true) });
  const next = button({ label:'다음', onClick:() => set(page + 1,true) });
  function set(value, notify = false) {
    const pages = Math.max(1,Math.ceil(total / pageSize));
    page = Math.min(pages,Math.max(1,Math.trunc(value) || 1));
    label.textContent = page + ' / ' + pages + ' 페이지 · ' + total + '개';
    previous.disabled = page <= 1; next.disabled = page >= pages;
    if (notify) onChange(page);
  }
  root.append(previous,label,next); set(page);
  return { root, setPage:set, setTotal(value) { total = Math.max(0,Math.trunc(value) || 0); set(page); }, get page() { return page; } };
}
export function searchField({ label = '검색', onSearch = () => {} } = {}) {
  const input = field({ label, type:'search' });
  let composing = false;
  input.control.addEventListener('compositionstart', () => { composing = true; });
  input.control.addEventListener('compositionend', () => { composing = false; onSearch(input.control.value); });
  input.control.addEventListener('input', event => { if (!composing && !event.isComposing) onSearch(input.control.value); });
  return input;
}
export function buttonGroup(label, ...buttons) {
  if (!label) throw new Error('Button group requires a label.');
  const root = element('div','af-inline'); root.setAttribute('role','group'); root.setAttribute('aria-label',label); root.append(...buttons); return root;
}
