import {materialIcons,materialMappings} from '../../generated/material-icons.js';

/** Official Material Icon Theme filename associations, limited to the bundled subset. */
export function materialResourceIcon({label,folder},open=false) {
  const name=label.toLowerCase();
  let key;
  if(folder) key=materialMappings[open?'folderNamesExpanded':'folderNames'][name] || (open?'folder-open':'folder');
  else {
    key=materialMappings.fileNames[name];
    const pieces=name.split('.');
    for(let index=1;!key&&index<pieces.length;index++)key=materialMappings.fileExtensions[pieces.slice(index).join('.')];
    key ||= 'file';
  }
  const documentSVG=new DOMParser().parseFromString(materialIcons[key],'image/svg+xml');
  const svg=document.importNode(documentSVG.documentElement,true);
  svg.classList.add('af-explorer-icon');
  svg.setAttribute('width','16');svg.setAttribute('height','16');
  svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  svg.dataset.materialIcon=key;
  return svg;
}
