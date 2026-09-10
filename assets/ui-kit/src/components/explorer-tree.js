import { renderNativeTree } from './native-tree.js';
import { bindTreeKeyboard } from './tree-keyboard.js';
import { selectKeys } from './selection.js';
import { icon } from './icons.js';
import { materialResourceIcon } from './material-icons.js';

/** Compact native hierarchy explorer. Data, icons, and item activation remain caller-owned. */
export function explorerTree({label, items, onSelect = () => {}, onActivate = () => {}, renderIcon = materialResourceIcon}) {
  if (!label || !Array.isArray(items)) throw new Error('Explorer requires a label and items.');
  if (typeof renderIcon !== 'function') throw new Error('Explorer icon renderer must be a function.');
  const root = document.createElement('div');
  root.className = 'af-explorer-tree'; root.setAttribute('aria-label',label);
  root.setAttribute('aria-multiselectable','true');
  const keys = new Set(), expanded = new Set(), initialSelected = new Set();
  const normalize = entries => entries.map(entry => {
    if (!entry.id || keys.has(entry.id) || !entry.label) throw new Error('Invalid explorer item.');
    keys.add(entry.id);
    if (entry.expanded) expanded.add(entry.id);
    if (entry.selected && !entry.disabled) initialSelected.add(entry.id);
    return {...entry,key:entry.id,folder:Array.isArray(entry.children),children:normalize(entry.children || [])};
  });
  const entries = normalize(items);
  let rows = [], selected = initialSelected, anchor = null;
  const select = (row,event = {}) => {
    if (row.disabled) return;
    ({selected,anchor} = selectKeys({keys:rows.filter(item=>!item.disabled).map(item=>item.key),
      selected,anchor,key:row.key,range:!!event.shiftKey,toggle:!!(event.ctrlKey||event.metaKey)}));
    render(row.key); onSelect([...selected]);
  };
  const toggle = row => {
    if (row.disabled) return;
    if (expanded.has(row.key)) expanded.delete(row.key); else expanded.add(row.key);
    render(row.key);
  };
  function render(focusKey) {
    rows = renderNativeTree(root,{entries,childrenOf:row=>row.children,
      isExpanded:row=>expanded.has(row.key),focusKey,groupClass:'af-explorer-group',
      renderRow(row,{level,expanded:open}) {
        const element = document.createElement('div');
        element.className = 'af-explorer-item';
        element.style.setProperty('--tree-depth',level-1);
        element.setAttribute('aria-label',row.label);
        element.setAttribute('aria-selected',String(selected.has(row.key)));
        if (row.disabled) element.setAttribute('aria-disabled','true');
        const line = document.createElement('div'); line.className = 'af-explorer-row af-explorer-line';
        const disclosure = document.createElement('span'); disclosure.className = 'af-explorer-disclosure';
        if (row.folder) disclosure.append(icon(open?'chevron-down':'chevron-right',{size:14}));
        const iconSlot = document.createElement('span'); iconSlot.className = 'af-explorer-icon-slot';
        const itemIcon = renderIcon(row,open); if (itemIcon) iconSlot.append(itemIcon);
        const name = document.createElement('span'); name.className = 'af-explorer-name';
        name.textContent = row.label; line.title = row.label;
        line.append(disclosure,iconSlot,name); element.append(line);
        line.addEventListener('click',event=>{
          element.focus();
          if (row.folder && (disclosure.contains(event.target) || (!event.ctrlKey&&!event.metaKey&&!event.shiftKey))) toggle(row);
          select(row,event);
        });
        line.addEventListener('dblclick',()=>{if (!row.folder&&!row.disabled) onActivate(row.key);});
        return element;
      }});
  }
  render();
  const keyboard = bindTreeKeyboard(root,{items:()=>rows,isExpanded:row=>expanded.has(row.key),
    onToggle:toggle,onActivate:row=>{if(!row.disabled)onActivate(row.key);},
    onToggleSelection:(row,event)=>select(row,{shiftKey:event.shiftKey,ctrlKey:true}),
    onSelectAll:()=>{
      selected = new Set(rows.filter(row=>!row.disabled).map(row=>row.key));
      render(); onSelect([...selected]);
    },onContextMenu:()=>{},onMove:(row,event)=>{
      if ((!event.ctrlKey&&!event.metaKey)||event.shiftKey) select(row,event);
    }});
  return {root,destroy(){keyboard.destroy();root.remove();}};
}
