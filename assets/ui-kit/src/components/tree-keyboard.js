/** Native tree behavior adapter. Items are the owner's visible, depth-first rows. */
export function bindTreeKeyboard(root, {items, isExpanded, onToggle, onActivate,
  onToggleSelection, onSelectAll, onContextMenu, onMove = () => {}}) {
  const keydown = event => {
    if (event.defaultPrevented || event.isComposing) return;
    const rows=items(), index=rows.findIndex(row=>row.element===event.target);
    if(index<0)return;
    const row=rows[index];let next;
    if(event.key==='ArrowDown')next=rows[index+1];
    else if(event.key==='ArrowUp')next=rows[index-1];
    else if(event.key==='Home')next=rows[0];
    else if(event.key==='End')next=rows.at(-1);
    else if(event.key==='ArrowRight' && row.folder) {
      if(!isExpanded(row))onToggle(row);
      else if(rows[index+1]?.parentKey===row.key)next=rows[index+1];
    } else if(event.key==='ArrowLeft') {
      if(row.folder && isExpanded(row))onToggle(row);
      else next=rows.find(item=>item.key===row.parentKey);
    } else if(event.key==='Enter') {
      if(row.folder)onToggle(row);else onActivate(row,event);
    } else if(event.key===' ') {
      if(row.folder)onToggle(row);else onToggleSelection(row,event);
    } else if((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='a')onSelectAll(rows,event);
    else if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10'))onContextMenu(row,event);
    else return;
    event.preventDefault();event.stopPropagation();
    if(next){next.element.focus();onMove(next,event);}
  };
  root.addEventListener('keydown',keydown);
  return {destroy(){root.removeEventListener('keydown',keydown);}};
}
