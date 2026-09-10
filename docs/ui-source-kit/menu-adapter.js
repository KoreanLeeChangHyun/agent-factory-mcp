// Project-authored adaptation. Vendor positioning code remains unmodified.
// Scope: one flat, enabled action menu anchored to a button.
function attachActionMenu(trigger, menu, onAction) {
  const { computePosition, offset, flip, shift, autoUpdate } = window.FloatingUIDOM;
  const listeners = new AbortController();
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  let cleanup = null;
  let generation = 0;
  let prefix = '';
  let typedAt = 0;
  function close(restore = false) {
    generation += 1;
    cleanup?.();
    cleanup = null;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    prefix = '';
    if (restore) trigger.focus();
  }
  function open(index = 0) {
    if (!menu.hidden) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    const current = ++generation;
    const update = async () => {
      const position = await computePosition(trigger, menu, {
        strategy: 'fixed', placement: 'bottom-end',
        middleware: [offset(4), flip(), shift({ padding: 8 })],
      });
      if (generation !== current || menu.hidden) return;
      Object.assign(menu.style, { left: position.x + 'px', top: position.y + 'px' });
    };
    cleanup = autoUpdate(trigger, menu, update);
    items[index]?.focus();
  }
  function listen(target, name, fn) {
    target.addEventListener(name, fn, { signal: listeners.signal });
  }
  listen(trigger, 'click', () => menu.hidden ? open() : close(true));
  listen(trigger, 'keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(event.key === 'ArrowUp' ? items.length - 1 : 0);
    }
  });
  listen(menu, 'keydown', event => {
    const index = items.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next !== undefined) { event.preventDefault(); items[next].focus(); }
    else if (event.key === 'Escape') { event.preventDefault(); close(true); }
    else if (event.key === 'Tab') {
      // Restore the anchor before native Tab advances in document order.
      close(true);
    } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = performance.now();
      prefix = now - typedAt > 600 ? event.key : prefix + event.key;
      typedAt = now;
      const match = items.find(item => item.textContent.trim().toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()));
      if (match) { event.preventDefault(); match.focus(); }
    }
  });
  listen(menu, 'click', event => {
    const item = event.target.closest('[role="menuitem"]');
    if (!items.includes(item)) return;
    close(true);
    onAction(item.dataset.action);
  });
  listen(document, 'pointerdown', event => {
    if (!menu.hidden && !menu.contains(event.target) && !trigger.contains(event.target)) close();
  });
  listen(document, 'focusin', event => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== trigger) close();
  });
  return { open, close, destroy() { close(); listeners.abort(); } };
}
