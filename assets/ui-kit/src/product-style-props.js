import {spreadProps as spread} from '@zag-js/vanilla';

// Product CSP permits CSSOM property updates, not style attribute injection.
export function spreadProps(node, props) {
  const {style, ...attributes} = props;
  const restore=[];
  for (const declaration of String(style || '').split(';')) {
    const colon=declaration.indexOf(':'); if (colon < 0) continue;
    const name=declaration.slice(0,colon).trim(), value=declaration.slice(colon+1).trim();
    restore.push([name,node.style.getPropertyValue(name),node.style.getPropertyPriority(name)]);
    node.style.setProperty(name,value);
  }
  const cleanup=spread(node,attributes);
  return () => {cleanup(); for (const [name,value,priority] of restore) {
    if(value) node.style.setProperty(name,value,priority); else node.style.removeProperty(name);
  }};
}
