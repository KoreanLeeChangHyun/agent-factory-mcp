import { VanillaMachine, normalizeProps, spreadProps, splitter } from '../../generated/vendors.js';
export function createSplitPane(root, { id, size = [35, 65], orientation = 'horizontal', onResize, storageKey, label = '패널 크기 조절', keyboardResizeBy } = {}) {
  if (!id) throw new Error('SplitPane requires a stable unique id.');
  const panels = [...root.querySelectorAll(':scope > [data-af-panel]')];
  const handle = root.querySelector(':scope > [data-af-resizer]');
  if (panels.length !== 2 || !handle) throw new Error('SplitPane requires two panels and a resize handle.');
  if (storageKey) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (Array.isArray(saved) && saved.length === 2 && saved.every(n => Number.isFinite(n) && n >= 10 && n <= 90) && Math.abs(saved[0] + saved[1] - 100) < .1) size = saved;
    } catch { /* Storage is optional. */ }
  }
  const machine = new VanillaMachine(splitter.machine, {
    id, orientation, defaultSize: size, keyboardResizeBy,
    panels: [{ id:'start', minSize:10 }, { id:'end', minSize:10 }],
    onResize(details) { onResize?.(details.size); },
    onResizeEnd(details) { if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(details.size)); } catch { /* Optional. */ } } },
  });
  let cleanups = [];
  const render = service => {
    cleanups.forEach(cleanup => cleanup());
    const api = splitter.connect(service, normalizeProps);
    cleanups = [
      spreadProps(root, api.getRootProps()),
      spreadProps(panels[0], api.getPanelProps({ id:'start' })),
      spreadProps(handle, { ...api.getResizeTriggerProps({ id:'start:end' }), 'aria-label':label }),
      spreadProps(panels[1], api.getPanelProps({ id:'end' })),
    ];
  };
  render(machine.service);
  const unsubscribe = machine.subscribe(render);
  machine.start();
  return {
    machine,
    setSizes(size) { splitter.connect(machine.service,normalizeProps).setSizes(size); },
    destroy() { unsubscribe(); machine.stop(); cleanups.forEach(cleanup => cleanup()); },
  };
}
