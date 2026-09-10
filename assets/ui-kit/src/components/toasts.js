import { toast, VanillaMachine, normalizeProps, spreadProps } from '../../generated/vendors.js';

/** One manager per shell; texts are always rendered with textContent. */
export function createToastManager(host, { id = 'af-notifications', max = 4 } = {}) {
  const store = toast.createStore({ placement:'bottom-end', max, gap:8, offsets:'16px', removeDelay:0, pauseOnPageIdle:true });
  const group = new VanillaMachine(toast.group.machine, { id, store });
  const region = document.createElement('div');
  region.className = 'af-toast-region';
  host.append(region);
  const children = new Map();
  let disposed = false, pending = false;
  let regionCleanup = () => {};
  const childProps = (data, index) => ({ ...data, index, parent:group.service, translations:{ closeTriggerLabel:'알림 닫기' } });
  function mount(data, index) {
    const root = document.createElement('div');
    root.className = 'af-toast';
    const title = document.createElement('strong');
    const description = document.createElement('div');
    const close = document.createElement('button');
    const action = document.createElement('button');
    for (const button of [close, action]) { button.className = 'ui-button ui-button--compact'; button.type = 'button'; }
    close.textContent = '닫기';
    root.append(title, description, action, close);
    region.append(root);
    const machine = new VanillaMachine(toast.machine, childProps(data, index));
    let cleanups = [];
    const render = () => {
      cleanups.forEach(fn => fn());
      const api = toast.connect(machine.service, normalizeProps);
      title.textContent = api.title ?? '';
      description.textContent = api.description ?? '';
      const current = machine.service.prop('action');
      action.textContent = current?.label ?? '';
      action.hidden = !current;
      close.hidden = !api.closable;
      cleanups = [
        spreadProps(root, api.getRootProps()), spreadProps(title, api.getTitleProps()),
        spreadProps(description, api.getDescriptionProps()), spreadProps(close, api.getCloseTriggerProps()),
        spreadProps(action, api.getActionTriggerProps()),
      ];
    };
    render();
    const unsubscribe = machine.subscribe(render);
    machine.start();
    return { data, index, machine, destroy() { unsubscribe(); machine.stop(); cleanups.forEach(fn => fn()); root.remove(); } };
  }
  function render() {
    if (disposed) return;
    regionCleanup();
    const api = toast.group.connect(group.service, normalizeProps);
    regionCleanup = spreadProps(region, { ...api.getGroupProps(), 'aria-label':'알림 (Alt+T)' });
    const data = api.getToasts();
    const ids = new Set(data.map(item => item.id));
    for (const [id, child] of children) if (!ids.has(id)) { children.delete(id); child.destroy(); }
    data.forEach((item, index) => {
      const child = children.get(item.id);
      if (!child) children.set(item.id, mount(item, index));
      else if (child.data !== item || child.index !== index) {
        child.data = item; child.index = index;
        child.machine.updateProps(childProps(item, index));
      }
    });
  }
  function schedule() {
    if (pending || disposed) return;
    pending = true;
    queueMicrotask(() => { pending = false; render(); });
  }
  render();
  const unsubscribe = group.subscribe(schedule);
  group.start();
  return {
    store,
    show({ type = 'info', duration, ...options }) {
      if (disposed) throw new Error('Toast manager is destroyed.');
      if (!['info','success','warning','error','loading'].includes(type)) throw new Error('Unknown toast type.');
      return store.create({ ...options, type, closable:true, duration:duration ?? (['error','loading'].includes(type) ? Infinity : 5000) });
    },
    update(id, options) { return store.update(id, options); },
    dismiss(id) { store.dismiss(id); },
    destroy() {
      disposed = true; unsubscribe(); group.stop();
      children.forEach(child => child.destroy()); children.clear();
      store.remove(); regionCleanup(); region.remove();
    },
  };
}
