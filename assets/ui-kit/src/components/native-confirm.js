import { button, element } from './primitives.js';
let serial = 0;

/** Lightweight native counterpart of the WA confirmation adapter. */
export function createNativeConfirm(host, {title = '작업 확인', message, confirmLabel = '확인', destructive = false} = {}) {
  const root = element('dialog', 'af-confirm af-kit');
  const heading = element('h2', '', title);
  heading.id = 'af-confirm-' + ++serial;
  const body = element('p', '', message);
  body.id = heading.id + '-message';
  root.setAttribute('aria-labelledby', heading.id);
  root.setAttribute('aria-describedby', body.id);
  let settle, opener, disposed = false;
  function finish(accepted) {
    const resolve = settle; settle = null;
    if (root.open) root.close();
    if (opener?.isConnected && !opener.disabled) opener.focus();
    resolve?.(accepted);
  }
  const cancel = button({label:'취소', onClick:() => finish(false)});
  cancel.autofocus = true;
  const accept = button({label:confirmLabel, variant:destructive ? 'danger' : 'primary', onClick:() => finish(true)});
  const footer = element('footer','af-inline'); footer.append(cancel,accept);
  root.append(heading,body,footer); host.append(root);
  root.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
  root.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    (document.activeElement === cancel ? accept : cancel).focus();
  });
  root.addEventListener('close', () => { if (!root.open) finish(false); });
  return {
    element:root,
    ask(trigger = document.activeElement) {
      if (disposed || settle) throw new Error('Confirmation unavailable.');
      opener = trigger;
      return new Promise((resolve,reject) => {
        settle = resolve;
        try { root.showModal(); } catch (error) { settle = null; reject(error); }
      });
    },
    destroy() { disposed = true; finish(false); root.remove(); },
  };
}
