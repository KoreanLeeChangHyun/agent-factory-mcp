// Adopt an owner's live code/secret controls; never copy their values into markup.
export function bindCodeOperation({root, header, label, control, help} = {}) {
  if (!root || !header || label?.tagName !== 'LABEL' || !control?.id ||
      !['INPUT','TEXTAREA'].includes(control.tagName) || !root.contains(header) ||
      !header.contains(label) || !root.contains(control) || (help && !root.contains(help))) {
    throw new Error('Code operation requires an owned header, label and identified native control.');
  }
  root.classList.add('af-code-operation');
  header.classList.add('af-code-operation__header');
  control.classList.add('af-code-value');
  label.htmlFor = control.id;
  if (help) {
    help.classList.add('af-code-operation__help');
    help.id ||= control.id + '-help';
    const descriptions = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    descriptions.add(help.id);
    control.setAttribute('aria-describedby', [...descriptions].join(' '));
  }
  return {root, control};
}
