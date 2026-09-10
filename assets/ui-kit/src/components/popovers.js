import { computePosition, offset, flip, shift, autoUpdate } from '../../generated/vendors.js';
import { menuKeyboard } from './menu-keyboard.js';
let serial = 0;
/** Nonmodal anchored surface; native popover supplies top-layer/light-dismiss. */
export function createPopover(trigger, content, { menu = false } = {}) {
  const abort = new AbortController();
  const old = { id:content.id, role:content.getAttribute('role'), popover:content.getAttribute('popover') };
  content.id ||= 'af-popover-' + ++serial;
  content.classList.add('af-popover');
  content.setAttribute('popover','auto');
  if (menu) content.setAttribute('role','menu');
  trigger.setAttribute('aria-controls',content.id);
  trigger.setAttribute('aria-expanded','false');
  if (menu) trigger.setAttribute('aria-haspopup','menu');
  let cleanup, generation = 0;
  const items = () => [...content.querySelectorAll('[role=menuitem]')].filter(item => !item.disabled && item.getAttribute('aria-disabled') !== 'true' && !item.hidden);
  const listen = (target,event,fn) => target.addEventListener(event,fn,{ signal:abort.signal });
  function close(restore = false) { if (content.matches(':popover-open')) content.hidePopover(); if (restore) trigger.focus(); }
  function open(last = false) {
    if (!content.matches(':popover-open')) content.showPopover();
    if (menu) (last ? items().at(-1) : items()[0])?.focus();
  }
  listen(content,'toggle',event => {
    cleanup?.(); cleanup = null;
    const current = ++generation;
    const active = event.newState === 'open';
    trigger.setAttribute('aria-expanded',String(active));
    if (!active) return;
    cleanup = autoUpdate(trigger,content,async () => {
      const result = await computePosition(trigger,content,{ strategy:'fixed',placement:'bottom-end',middleware:[offset(4),flip(),shift({ padding:8 })] });
      if (current === generation) Object.assign(content.style,{ left:result.x + 'px',top:result.y + 'px' });
    });
  });
  listen(trigger,'click',() => content.matches(':popover-open') ? close(true) : open());
  listen(trigger,'keydown',event => {
    if (menu && ['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); open(event.key === 'ArrowUp'); }
  });
  const handleMenuKey = menuKeyboard({items,close});
  listen(content,'keydown',event => {
    if (menu) handleMenuKey(event);
    else if (event.key === 'Escape') {event.preventDefault(); close(true);}
  });
  listen(content,'click',event => { if (menu && items().includes(event.target.closest('[role=menuitem]'))) close(true); });
  return { open, close, destroy() {
    close(); generation++; cleanup?.(); abort.abort();
    trigger.removeAttribute('aria-controls'); trigger.removeAttribute('aria-expanded'); trigger.removeAttribute('aria-haspopup');
    for (const [key,value] of Object.entries(old)) value == null || value === '' ? content.removeAttribute(key) : content.setAttribute(key,value);
    content.classList.remove('af-popover'); content.style.removeProperty('left'); content.style.removeProperty('top');
  } };
}
