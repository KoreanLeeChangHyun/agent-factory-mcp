import {computePosition, flip, shift, autoUpdate} from '@floating-ui/dom';

/** Fixed context menu. Return cleanup immediately so scope reset wins async work. */
export function positionMenu(content, {origin, x, y}) {
  let disposed = false, revision = 0;
  const reference = Number.isFinite(x) && Number.isFinite(y)
    ? {contextElement:origin, getBoundingClientRect:() => ({x,y,left:x,right:x,top:y,bottom:y,width:0,height:0})}
    : origin;
  content.style.maxWidth = 'calc(100vw - 16px)';
  content.style.maxHeight = 'calc(100vh - 16px)';
  content.style.overflow = 'auto';
  const update = async () => {
    const current = ++revision;
    const result = await computePosition(reference,content,{
      strategy:'fixed',placement:'bottom-start',middleware:[flip(),shift({padding:8,crossAxis:true})],
    });
    if (!disposed && current === revision) {
      content.style.left = result.x + 'px'; content.style.top = result.y + 'px';
    }
  };
  const cleanup = autoUpdate(reference,content,() => {
    void update().catch(() => {if (!disposed) content.dataset.positionError = 'true';});
  });
  return () => {disposed = true; revision++; cleanup(); delete content.dataset.positionError;};
}
