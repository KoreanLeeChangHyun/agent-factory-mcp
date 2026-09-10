import { Uppy } from '../../generated/vendors.js';

/**
 * File queue backed by Uppy. transport(file, {signal,onProgress}) must resolve
 * only after the server accepts the upload. No production endpoint is assumed.
 */
export function createUploadQueue(host, { transport, maxFileSize = 10 * 1024 * 1024, maxNumberOfFiles = 10, allowedFileTypes } = {}) {
  if (typeof transport !== 'function') throw new Error('Upload transport is required.');
  const uppy = new Uppy({ autoProceed:false, restrictions:{ maxFileSize, maxNumberOfFiles, allowedFileTypes } });
  const controller = new AbortController();
  const active = new Map();
  const picker = document.createElement('input');
  picker.type = 'file'; picker.multiple = true;
  picker.setAttribute('aria-label','업로드할 파일 선택');
  if (allowedFileTypes) picker.accept = allowedFileTypes.join(',');
  const status = document.createElement('p');
  status.setAttribute('role','status');
  const list = document.createElement('ul');
  list.className = 'af-upload-list';
  const start = document.createElement('button');
  start.type = 'button'; start.className = 'ui-button ui-button--primary'; start.textContent = '업로드';
  const hint = document.createElement('p');
  hint.textContent = '파일을 선택하거나 이 영역에 놓으세요.';
  host.classList.add('af-upload');
  host.append(hint, picker, list, start, status);
  let disposed = false;
  function add(files) {
    for (const data of files) {
      try { uppy.addFile({ name:data.name, type:data.type, data }); }
      catch (error) { status.textContent = error.message; }
    }
  }
  function render() {
    if (disposed) return;
    const focused = list.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
    list.replaceChildren();
    const files = uppy.getFiles();
    start.disabled = !files.some(file => !file.progress.uploadComplete && !active.has(file.id));
    for (const file of files) {
      const row = document.createElement('li');
      row.className = 'af-resource-row';
      const label = document.createElement('span');
      const phase = file.error ? '실패' : file.progress.uploadComplete ? '완료' : active.has(file.id) ? '업로드 중' : '대기';
      label.textContent = file.name + ' — ' + phase;
      const progress = document.createElement('progress');
      progress.max = 100; progress.value = file.progress.percentage ?? 0;
      progress.setAttribute('aria-label', file.name + ' 업로드 진행률');
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'ui-button ui-button--compact';
      remove.dataset.focusKey = file.id + ':remove';
      remove.textContent = active.has(file.id) ? '취소' : '제거';
      remove.addEventListener('click', () => { active.get(file.id)?.abort(); uppy.removeFile(file.id); });
      row.append(label, progress, remove);
      if (file.error) {
        const retry = document.createElement('button');
        retry.type = 'button'; retry.className = 'ui-button ui-button--compact'; retry.textContent = '재시도';
        retry.dataset.focusKey = file.id + ':retry';
        retry.addEventListener('click', () => { void uppy.retryUpload(file.id).catch(error => { status.textContent = error.message; }); });
        row.append(retry);
      }
      list.append(row);
    }
    if (focused) {
      const replacement = [...list.querySelectorAll('[data-focus-key]')].find(item => item.dataset.focusKey === focused);
      (replacement ?? picker).focus();
    }
  }
  const uploader = async ids => {
    await Promise.all(ids.map(async id => {
      const file = uppy.getFile(id);
      if (!file || file.progress.uploadComplete) return;
      const abort = new AbortController();
      active.set(id, abort); render();
      const uploadStarted = Date.now();
      try {
        const response = await transport(file.data, {
          signal:abort.signal,
          onProgress(bytesUploaded, bytesTotal = file.size) {
            if (disposed || abort.signal.aborted || !uppy.getFile(id)) return;
            uppy.emit('upload-progress', uppy.getFile(id), { uploadStarted, bytesUploaded, bytesTotal });
          },
        });
        if (!disposed && !abort.signal.aborted && uppy.getFile(id)) uppy.emit('upload-success', uppy.getFile(id), { status:200, body:response ?? {} });
      } catch (error) {
        if (!disposed && !abort.signal.aborted && uppy.getFile(id)) uppy.emit('upload-error', uppy.getFile(id), error);
      } finally { active.delete(id); render(); }
    }));
  };
  uppy.addUploader(uploader);
  uppy.on('state-update', render);
  uppy.on('file-removed', file => active.get(file.id)?.abort());
  picker.addEventListener('change', () => { add(picker.files); picker.value = ''; }, { signal:controller.signal });
  host.addEventListener('dragover', event => event.preventDefault(), { signal:controller.signal });
  host.addEventListener('drop', event => { event.preventDefault(); add(event.dataTransfer.files); }, { signal:controller.signal });
  start.addEventListener('click', () => { void uppy.upload().catch(error => { status.textContent = error.message; }); }, { signal:controller.signal });
  render();
  return { uppy, add, destroy() { disposed = true; controller.abort(); active.forEach(abort => abort.abort()); active.clear(); uppy.destroy(); host.replaceChildren(); } };
}
