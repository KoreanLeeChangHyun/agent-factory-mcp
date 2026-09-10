/** Adopt a live form dialog. Native modal focus/escape semantics remain authoritative. */
export function bindNativeDialog(element) {
  if (element?.tagName !== 'DIALOG') throw new Error('Native dialog requires a dialog element.');
  element.classList.add('af-dialog','af-kit');
  let disposed = false;
  return {
    element,
    open({initialFocus} = {}) {
      if (disposed || !element.isConnected) throw new Error('Dialog is unavailable.');
      if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) throw new Error('Dialog requires an accessible name.');
      if (initialFocus && !element.contains(initialFocus)) throw new Error('Initial focus must belong to the dialog.');
      if (!element.open) element.showModal();
      initialFocus?.focus();
    },
    close(value = '') { if (element.open) element.close(value); },
    destroy() { if (element.open) element.close(); disposed = true; },
  };
}
