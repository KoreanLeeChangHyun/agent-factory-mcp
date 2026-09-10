/** Shared flat-menu keyboard behavior; owner retains positioning and lifecycle. */
export function menuKeyboard({items, close}) {
  let prefix = '', lastTyped = 0;
  return event => {
    if (event.key === 'Escape') {event.preventDefault(); close(true); return;}
    const enabled = items().filter(item => !item.disabled && item.getAttribute('aria-disabled') !== 'true' && !item.hidden);
    const index = enabled.indexOf(document.activeElement);
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1
      : event.key === 'ArrowDown' ? (index + 1) % enabled.length
      : event.key === 'ArrowUp' ? (index - 1 + enabled.length) % enabled.length : null;
    if (target !== null) {event.preventDefault(); enabled[target]?.focus();}
    if (event.key === 'Tab') close(true);
    if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) {
      const now = performance.now(); prefix = now - lastTyped > 600 ? event.key : prefix + event.key; lastTyped = now;
      enabled.find(item => item.textContent.trim().toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()))?.focus();
    }
  };
}
