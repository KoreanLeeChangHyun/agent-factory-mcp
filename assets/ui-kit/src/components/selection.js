/** Immutable native multi-selection. Owner supplies visible selectable keys in order. */
export function selectKeys({keys, selected = new Set(), anchor = null, key, range = false, toggle = false}) {
  if (!keys.includes(key)) return {selected:new Set(selected),anchor};
  if (range) {
    const start=keys.indexOf(anchor), end=keys.indexOf(key);
    // A filtered-out anchor must not silently select from the first visible item.
    if (start < 0) return {selected:new Set([key]),anchor:key};
    return {selected:new Set(keys.slice(Math.min(start,end),Math.max(start,end)+1)),anchor};
  }
  if (toggle) {
    const next=new Set(selected);
    if(next.has(key))next.delete(key);else next.add(key);
    return {selected:next,anchor:key};
  }
  return {selected:new Set([key]),anchor:key};
}
