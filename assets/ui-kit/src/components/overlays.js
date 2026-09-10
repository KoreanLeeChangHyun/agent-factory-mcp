import '../../generated/vendors.js';

/** Web Awesome dialog/drawer binding. Owner supplies labelled content. */
export async function createOverlay(element) {
  if (!['wa-dialog','wa-drawer'].includes(element.localName)) throw new Error('Expected a dialog or drawer.');
  await customElements.whenDefined(element.localName);
  if (!element.label && !element.getAttribute('aria-label')) throw new Error('Overlay requires an accessible label.');
  const listeners = new AbortController();
  let opener = null;
  let disposed = false;
  element.addEventListener('wa-after-hide', event => {
    if (event.target === element && opener?.isConnected) opener.focus();
  }, { signal:listeners.signal });
  return {
    element,
    open(trigger = document.activeElement) {
      if (disposed) throw new Error('Overlay is destroyed.');
      opener = trigger;
      element.open = true;
    },
    close() { element.open = false; },
    destroy() {
      element.open = false;
      listeners.abort();
      if (opener?.isConnected) opener.focus();
      disposed = true;
    },
  };
}

/** Confirm resolves true only for explicit acceptance; Escape/close resolves false. */
export async function createConfirmDialog(host, { title = '작업 확인', message = '계속하시겠습니까?', confirmLabel = '확인', destructive = false } = {}) {
  const element = document.createElement('wa-dialog');
  element.label = title;
  const body = document.createElement('p');
  body.textContent = message;
  const cancel = document.createElement('button');
  const accept = document.createElement('button');
  for (const button of [cancel, accept]) { button.type = 'button'; button.slot = 'footer'; button.className = 'ui-button'; }
  cancel.textContent = '취소';
  cancel.autofocus = true;
  accept.textContent = confirmLabel;
  accept.classList.add(destructive ? 'ui-button--danger' : 'ui-button--primary');
  element.append(body, cancel, accept);
  host.append(element);
  const overlay = await createOverlay(element);
  let settle = null;
  let accepted = false;
  const controller = new AbortController();
  cancel.addEventListener('click', () => overlay.close(), { signal:controller.signal });
  accept.addEventListener('click', () => { accepted = true; overlay.close(); }, { signal:controller.signal });
  element.addEventListener('wa-after-hide', event => {
    if (event.target !== element) return;
    settle?.(accepted); settle = null;
  }, { signal:controller.signal });
  return {
    element,
    ask(trigger) {
      if (settle) throw new Error('Confirmation already open.');
      accepted = false;
      return new Promise(resolve => { settle = resolve; overlay.open(trigger); });
    },
    destroy() { settle?.(false); settle = null; controller.abort(); overlay.destroy(); element.remove(); },
  };
}
