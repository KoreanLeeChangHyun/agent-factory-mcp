// Imported upstream behavior. Project adapters live separately.
import { registerIconLibrary } from '@awesome.me/webawesome/dist/components/icon/library.js';
import { icons } from '../generated/icons.js';
// Some fallback icons instantiate even when a custom slot is supplied.
// Resolve all default-library requests locally; never contact Font Awesome CDN.
registerIconLibrary('default', {
  resolver: name => {
    const aliases = { bars:'menu-2', 'xmark':'x', 'chevron-down':'chevron-down', 'chevron-right':'chevron-right' };
    const svg = icons[aliases[name] ?? name] ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  },
  mutator: svg => svg.setAttribute('stroke-width','1.4'),
});
import '@awesome.me/webawesome/dist/styles/themes/default.css';
import 'tom-select/dist/css/tom-select.css';
import '@awesome.me/webawesome/dist/components/split-panel/split-panel.js';
import '@awesome.me/webawesome/dist/components/dialog/dialog.js';
import '@awesome.me/webawesome/dist/components/drawer/drawer.js';
import '@awesome.me/webawesome/dist/components/tooltip/tooltip.js';
import '@github/relative-time-element';
export { default as TomSelect } from 'tom-select';
export { default as Uppy } from '@uppy/core';
export { default as XHRUpload } from '@uppy/xhr-upload';
export { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
export * as splitter from '@zag-js/splitter';
export * as toast from '@zag-js/toast';
export { computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/dom';
