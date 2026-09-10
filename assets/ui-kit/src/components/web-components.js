import '../../generated/vendors.js';
let serial = 0;
export function tooltip(trigger,text) {
  if (!text) throw new Error('Tooltip text is required.');
  const previousId = trigger.id;
  trigger.id ||= 'af-tooltip-trigger-' + ++serial;
  const root = document.createElement('wa-tooltip');
  root.for = trigger.id; root.textContent = text; root.showDelay = 300;
  trigger.after(root);
  return { root,destroy() { root.remove(); if (!previousId) trigger.removeAttribute('id'); } };
}
