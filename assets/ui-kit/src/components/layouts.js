import { element } from './primitives.js';

/** Layouts accept DOM nodes; caller retains navigation and data authority. */
export function stack(...children) { const root = element('div','af-stack'); root.append(...children); return root; }
export function inline(...children) { const root = element('div','af-inline'); root.append(...children); return root; }
export function grid(...children) { const root = element('div','af-grid'); root.append(...children); return root; }
export function divider() { return element('hr','af-divider'); }
export function pageLayout({ title, description, actions, content }) {
  const root = element('div','af-page-layout');
  const header = element('header','af-page-header');
  header.append(element('h1','',title));
  if (actions) header.append(actions);
  const body = element('div','af-page-content');
  if (description) body.append(element('p','af-muted',description));
  if (content) body.append(content);
  root.append(header, body);
  return root;
}
export function listDetailLayout({ list, detail }) {
  const root = element('div','af-list-detail');
  const left = element('div','af-list-pane');
  const right = element('div','af-detail-pane');
  left.append(list); right.append(detail); root.append(left, right);
  return root;
}
export function collectionLayout({ header, filters, content, pagination }) {
  const root = element('div','af-collection af-stack');
  for (const item of [header, filters, content, pagination]) if (item) root.append(item);
  return root;
}
export function settingsLayout({ navigation, form, actions }) {
  const root = element('div','af-settings');
  const nav = element('nav','af-settings-nav'); nav.setAttribute('aria-label','설정 탐색');
  nav.append(navigation);
  const content = element('div','af-stack');
  content.append(form);
  if (actions) content.append(actions);
  root.append(nav, content);
  return root;
}
export function metadataList(entries) {
  const root = element('dl','af-metadata');
  entries.forEach(([label, value]) => root.append(element('dt','',label),element('dd','',value)));
  return root;
}
export function metadataGrid(entries) {
  const root = element('dl','af-metadata-grid');
  entries.forEach(([label, value]) => {
    const item = element('div');
    item.append(element('dt','',label),element('dd','',value ?? '—'));
    root.append(item);
  });
  return root;
}
export function resourceRow({ title, description, action }) {
  const root = element('div','af-resource-row');
  const identity = stack(element('strong','',title));
  if (description) identity.append(element('span','af-muted',description));
  root.append(identity);
  if (action) root.append(action);
  return root;
}
