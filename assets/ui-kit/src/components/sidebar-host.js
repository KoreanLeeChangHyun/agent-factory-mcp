const sharedParts = [
  ['.app-sidebar__section','af-sidebar-section'],
  ['.app-sidebar__section-header','af-sidebar-section__header'],
  ['.app-sidebar__section-content','af-sidebar-section__content'],
  ['.app-sidebar__nav','af-sidebar-navigation'],
  ['.app-sidebar__row','af-sidebar-navigation__item'],
  ['.app-sidebar__state','af-sidebar-state'],
];

const adoptSharedParts = root => sharedParts.forEach(([selector,className]) => {
  if (root.matches?.(selector)) root.classList.add(className);
  root.querySelectorAll?.(selector).forEach(element => element.classList.add(className));
});

const adoptNavigationRows = root => {
  const rows = [];
  if (root.matches?.('.app-sidebar__nav > .app-sidebar__row')) rows.push(root);
  root.querySelectorAll?.('.app-sidebar__nav > .app-sidebar__row').forEach(row=>rows.push(row));
  rows.forEach(row => {
    if (row.querySelector(':scope > .af-sidebar-navigation__marker')) return;
    const marker = document.createElement('span');
    marker.className = 'af-sidebar-navigation__marker'; marker.setAttribute('aria-hidden','true');
    row.append(marker);
  });
};

const adoptSidebarContent = root => {
  adoptSharedParts(root);
  adoptNavigationRows(root);
};

/** Bind and adopt multiple domain views into one shared Primary Sidebar asset. */
export function bindSidebarHost(host, {header, body, title, items, defaultTitle = ''} = {}) {
  if (![host,header,body,title].every(element=>element instanceof Element) || !Array.isArray(items)) {
    throw new Error('Sidebar host requires host, header, body, title, and items.');
  }
  const ids = new Set();
  const views = items.map(item => {
    if (!item?.id || ids.has(item.id) || !(item.element instanceof Element)) {
      throw new Error('Sidebar views require unique ids and elements.');
    }
    ids.add(item.id);
    item.element.classList.add('af-sidebar-view');
    adoptSidebarContent(item.element);
    return {...item, title:item.title || item.id};
  });
  host.classList.add('af-kit','af-sidebar-host');
  header.classList.add('af-sidebar-host__header');
  body.classList.add('af-sidebar-host__body');
  title.classList.add('af-sidebar-host__title');
  const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node instanceof Element) adoptSidebarContent(node);
  })));
  observer.observe(body,{childList:true,subtree:true});
  let selected = views.find(item => !item.element.hidden)?.id ?? null;
  const select = id => {
    if (id !== null && !ids.has(id)) throw new Error(`Unknown sidebar view: ${id}`);
    selected = id;
    views.forEach(item => { item.element.hidden = item.id !== id; });
    title.textContent = views.find(item => item.id === id)?.title || defaultTitle;
  };
  return {
    host,
    views:views.map(item => item.element),
    select,
    get selected() { return selected; },
    destroy() {
      observer.disconnect();
      host.classList.remove('af-kit','af-sidebar-host');
      header.classList.remove('af-sidebar-host__header');
      body.classList.remove('af-sidebar-host__body');
      title.classList.remove('af-sidebar-host__title');
      views.forEach(item => item.element.classList.remove('af-sidebar-view'));
      sharedParts.forEach(([,className]) => host.querySelectorAll(`.${className}`).forEach(element => element.classList.remove(className)));
      host.querySelectorAll('.af-sidebar-navigation__marker').forEach(marker => marker.remove());
    },
  };
}
