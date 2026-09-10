/** Native tree renderer with owner-provided row content/actions and expansion state. */
export function renderNativeTree(root, {entries, childrenOf, isExpanded, renderRow, groupClass = '', focusKey} = {}) {
  if (!root || !Array.isArray(entries) || ![childrenOf,isExpanded,renderRow].every(fn=>typeof fn==='function')) throw new Error('Invalid native tree renderer.');
  const oldFocus=focusKey ?? root.querySelector(':focus')?.dataset.key;
  const fragment=document.createDocumentFragment(), rows=[], keys=new Set();
  const walk=(entries,container,level,parentKey)=>entries.forEach((entry,index)=>{
    if (!entry.key || keys.has(entry.key)) throw new Error('Tree keys must be nonempty and unique.');
    keys.add(entry.key);
    const expanded=!!entry.folder && !!isExpanded(entry);
    const element=renderRow(entry,{level,expanded});
    element.setAttribute('role','treeitem');element.tabIndex=-1;element.dataset.key=entry.key;
    element.setAttribute('aria-level',String(level));
    element.setAttribute('aria-posinset',String(index+1));element.setAttribute('aria-setsize',String(entries.length));
    if(entry.folder)element.setAttribute('aria-expanded',String(expanded));
    const row={...entry,element,parentKey};rows.push(row);container.append(element);
    element.addEventListener('focus',()=>rows.forEach(item=>{item.element.tabIndex=item===row?0:-1;}));
    if(expanded){
      const group=document.createElement('div');group.className=groupClass;group.setAttribute('role','group');
      // Child row actions must not invoke the containing folder's actions.
      for(const type of ['click','dblclick','contextmenu'])group.addEventListener(type,event=>event.stopPropagation());
      element.append(group);walk(childrenOf(entry),group,level+1,entry.key);
    }
  });
  walk(entries,fragment,1,null);
  root.setAttribute('role','tree');root.replaceChildren(fragment);
  rows.find(row=>row.key===oldFocus)?.element.focus();
  if(rows.length && !rows.some(row=>row.element.tabIndex===0))rows[0].element.tabIndex=0;
  return rows;
}
