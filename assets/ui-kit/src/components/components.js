import { TomSelect } from '../../generated/vendors.js';

/**
 * Enhance a labelled native select. Caller owns options and API authorization.
 * Remote loader: async (query, {signal}) => [{value, text}].
 * No arbitrary HTML from remote option labels is rendered.
 */
export function createCombobox(select, { multiple = select.multiple, load, onError = () => {}, ...settings } = {}) {
  if (!select.id || !select.labels?.length) throw new Error('Combobox requires an id and visible label.');
  let request = null;
  let sequence = 0;
  let disposed = false;
  let loadFailed = false;
  const control = new TomSelect(select, {
    ...settings,
    maxItems: multiple ? null : 1,
    create: false,
    plugins: multiple ? ['remove_button'] : [],
    render: {
      option: (item, escape) => '<div>' + escape(item.text) + '</div>',
      item: (item, escape) => '<div>' + escape(item.text) + '</div>',
      no_results: () => '<div class="no-results">' + (loadFailed ? '검색하지 못했습니다.' : '검색 결과가 없습니다.') + '</div>',
      loading: () => '<div class="spinner">검색 중입니다.</div>',
    },
    ...(load ? { load(query, callback) {
      request?.abort();
      loadFailed = false;
      request = new AbortController();
      const signal = request.signal;
      const current = ++sequence;
      Promise.resolve().then(() => load(query, { signal })).then(rows => {
        if (disposed) return;
        if (current !== sequence) { callback(); return; }
        callback(rows);
      }).catch(error => {
        if (disposed) return;
        if (current === sequence && error.name !== 'AbortError') loadFailed = true;
        callback();
        if (error.name !== 'AbortError' && current === sequence) onError(error);
      });
    } } : {}),
  });
  return {
    control,
    setDisabled(value) { value ? control.disable() : control.enable(); },
    setInvalid(value) {
      control.wrapper.classList.toggle('af-invalid', value);
      control.control_input.setAttribute('aria-invalid', String(value));
    },
    destroy() { disposed = true; sequence++; request?.abort(); control.destroy(); },
  };
}

/** Bind an existing flat pair of panels without replacing their contents. */
export { createSplitPane } from './splitter.js';
