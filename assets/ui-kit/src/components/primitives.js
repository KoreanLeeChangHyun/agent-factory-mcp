// Agent Factory-owned native components. Text inputs never accept HTML strings.
let nextId = 0;
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
export function button({ label, variant = 'secondary', compact = false, disabled = false, onClick } = {}) {
  if (!label) throw new Error('Button requires a label.');
  const node = element('button', 'ui-button', label);
  node.type = 'button';
  if (!['secondary','primary','danger','link'].includes(variant)) throw new Error('Invalid button variant.');
  if (variant !== 'secondary') node.classList.add('ui-button--' + variant);
  if (compact) node.classList.add('ui-button--compact');
  node.disabled = disabled;
  let priorDisabled = disabled;
  node.setBusy = busy => {
    if (busy && node.getAttribute('aria-busy') !== 'true') priorDisabled = node.disabled;
    node.setAttribute('aria-busy',String(busy));
    node.disabled = busy || priorDisabled;
    node.setAttribute('aria-label',busy ? label + ' (처리 중)' : label);
  };
  if (onClick) node.addEventListener('click', onClick);
  return node;
}
export function field({ label, type = 'text', value, help = '', required = false, disabled = false, options = [] } = {}) {
  if (!label) throw new Error('Field requires a label.');
  const control = element(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input', 'af-input');
  if (control.tagName === 'INPUT') control.type = type;
  if (type === 'select') options.forEach(option => { const item = element('option', '', option.label); item.value = option.value; control.append(item); });
  if (value != null) control.value = value; control.required = required; control.disabled = disabled;
  return fieldFor({ label, control, help });
}
// Keep the owner's live control, listeners, name and native validation intact.
export function fieldFor({ label, control, help = '' } = {}) {
  if (!label || !control || !['INPUT','SELECT','TEXTAREA'].includes(control.tagName)) throw new Error('Field requires a label and native control.');
  const id = control.id || 'af-field-' + ++nextId;
  control.id = id;
  control.classList.add('af-input');
  const root = element('div', 'af-field');
  const caption = element('label', '', label);
  caption.htmlFor = id;
  const descriptions = control.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) || [];
  const hint = element('div', 'af-muted', help);
  hint.id = id + '-help'; hint.hidden = !help;
  const error = element('div', 'ui-message ui-message--error');
  error.id = id + '-error'; error.hidden = true;
  const describe = message => control.setAttribute('aria-describedby', [...descriptions, ...(help ? [hint.id] : []), ...(message ? [error.id] : [])].join(' '));
  describe('');
  root.append(caption, control, hint, error);
  return {
    root, control,
    setError(message = '') {
      error.textContent = message; error.hidden = !message;
      control.setAttribute('aria-invalid', String(!!message));
      describe(message);
    },
  };
}
export function toggle({ label, type = 'checkbox', checked = false, disabled = false, name, value } = {}) {
  if (!label || !['checkbox','radio','switch'].includes(type)) throw new Error('Toggle requires a label and supported type.');
  const root = element('label', 'af-toggle');
  const control = element('input');
  control.type = type === 'switch' ? 'checkbox' : type;
  if (type === 'switch') control.setAttribute('role','switch');
  control.checked = checked; control.disabled = disabled;
  if (name) control.name = name;
  if (value != null) control.value = value;
  root.append(control, element('span', '', label));
  return { root, control };
}
export function status({ kind = 'info', text } = {}) {
  if (!text || !['info','success','warning','error','loading','empty','permission'].includes(kind)) throw new Error('Status requires explicit kind and text.');
  const root = element('div');
  return setStatus(root, {kind, text});
}
/** Update a live region without replacing owner selectors or held references. */
export function setStatus(root, {kind = 'info', text = ''} = {}) {
  if (!root || !['info','success','warning','error','loading','empty','permission'].includes(kind)) throw new Error('Invalid status.');
  root.classList.add('af-status');
  root.textContent = text;
  root.hidden = !text;
  root.dataset.kind = kind;
  root.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  if (kind === 'loading' && text) root.setAttribute('aria-busy','true');
  else root.removeAttribute('aria-busy');
  return root;
}
export function badge(text, kind = 'neutral') {
  const node = element('span','af-badge',text);
  node.dataset.kind = kind;
  return node;
}
export function skeleton({ label = '불러오는 중', lines = 3 } = {}) {
  const node = element('div','af-skeleton');
  node.setAttribute('role','status'); node.setAttribute('aria-label',label);
  for (let i = 0; i < Math.max(1, Math.min(10, lines)); i++) {
    const line = element('span'); line.setAttribute('aria-hidden','true'); node.append(line);
  }
  return node;
}
export function sectionHeader(title, action) {
  const node = element('header','af-section-header');
  node.append(element('h2','',title));
  if (action) node.append(action);
  return node;
}
