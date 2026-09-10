import { icons } from '../../generated/icons.js';
export const iconNames = Object.freeze(Object.keys(icons));
export function icon(name, { size = 16 } = {}) {
  if (!Object.hasOwn(icons,name)) throw new Error('Unknown icon: ' + name);
  if (![14,16,24].includes(size)) throw new Error('Icon size must be 14, 16 or 24.');
  const parsed = new DOMParser().parseFromString(icons[name],'image/svg+xml');
  const svg = document.importNode(parsed.documentElement,true);
  svg.classList.add('af-icon');
  svg.setAttribute('width',String(size)); svg.setAttribute('height',String(size));
  svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false');
  return svg;
}
export function iconButton(name, label, onClick) {
  if (!label) throw new Error('Icon button requires an accessible label.');
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'ui-button ui-button--icon af-icon-button';
  button.title = label; button.setAttribute('aria-label',label);
  button.append(icon(name));
  if (onClick) button.addEventListener('click',onClick);
  return button;
}
