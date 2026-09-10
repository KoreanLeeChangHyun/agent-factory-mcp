/** Pixel resize interaction. Owner keeps sizing limits, layout, ARIA value and persistence. */
export function bindResizeHandle(handle, {getValue, onChange, onDragging = () => {}, axis = 'horizontal', step = 16} = {}) {
  if (!handle || typeof getValue !== 'function' || typeof onChange !== 'function' ||
      !['horizontal','vertical'].includes(axis) || !Number.isFinite(step) || step <= 0) throw new Error('Invalid resize handle contract.');
  const coordinate = event => axis === 'horizontal' ? event.clientX : event.clientY;
  let drag = null, disposed = false;
  const stop = () => {
    if (!drag) return;
    const pointerId = drag.id; drag = null;
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    handle.classList.remove('is-dragging'); onDragging(false);
  };
  const down = event => {
    if (disposed || drag || event.button !== 0 || event.isPrimary === false) return;
    const value = getValue(); if (!Number.isFinite(value)) return;
    handle.setPointerCapture(event.pointerId);
    drag = {id:event.pointerId, coordinate:coordinate(event), value};
    event.preventDefault(); handle.classList.add('is-dragging'); onDragging(true);
  };
  const move = event => {
    if (drag && event.pointerId === drag.id) onChange(drag.value + coordinate(event) - drag.coordinate);
  };
  const end = event => { if (drag && event.pointerId === drag.id) stop(); };
  const keydown = event => {
    const keys = axis === 'horizontal' ? ['ArrowLeft','ArrowRight'] : ['ArrowUp','ArrowDown'];
    const direction = keys.indexOf(event.key);
    if (disposed || direction < 0 || event.defaultPrevented) return;
    const value = getValue(); if (!Number.isFinite(value)) return;
    event.preventDefault(); onChange(value + (direction === 0 ? -step : step));
  };
  const listeners = {pointerdown:down,pointermove:move,pointerup:end,pointercancel:end,lostpointercapture:end,keydown};
  for (const [type,listener] of Object.entries(listeners)) handle.addEventListener(type,listener);
  return {cancel:stop, destroy() {
    if (disposed) return;
    disposed = true; stop();
    for (const [type,listener] of Object.entries(listeners)) handle.removeEventListener(type,listener);
  }};
}
