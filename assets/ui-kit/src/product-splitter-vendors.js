export {spreadProps} from './product-style-props.js';
import * as upstream from '@zag-js/splitter';
export { VanillaMachine, normalizeProps } from '@zag-js/vanilla';

const machine={...upstream.machine,implementations:{...upstream.machine.implementations,actions:{
  ...upstream.machine.implementations.actions,
  setGlobalCursor({scope,prop}) {
    const root=scope.getDoc().documentElement;
    root.dataset.afSplitCursor=prop('orientation'); root.dataset.afSplitOwner=prop('id');
  },
  clearGlobalCursor({scope,prop}) {
    const root=scope.getDoc().documentElement;
    if(root.dataset.afSplitOwner===prop('id')) {delete root.dataset.afSplitCursor;delete root.dataset.afSplitOwner;}
  },
}}};
export const splitter={...upstream,machine};
