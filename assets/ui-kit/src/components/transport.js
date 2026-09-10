/** Explicit endpoint only. No credential discovery or implicit cloud upload. */
export function xhrTransport({ endpoint, fieldName = 'file', headers = {}, withCredentials = false, timeout = 30000 } = {}) {
  if (!endpoint) throw new Error('Upload endpoint is required.');
  const url = new URL(endpoint,location.href);
  if (!['http:','https:'].includes(url.protocol)) throw new Error('Invalid upload protocol.');
  return (file,{signal,onProgress}) => new Promise((resolve,reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const done = (fn,value) => { signal?.removeEventListener('abort',abort); fn(value); };
    if (signal?.aborted) { reject(new DOMException('취소됨','AbortError')); return; }
    xhr.open('POST',url.href);
    xhr.withCredentials = withCredentials; xhr.timeout = timeout;
    for (const [name,value] of Object.entries(headers)) xhr.setRequestHeader(name,value);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded,event.total); };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) { done(reject,new Error('업로드 실패 (HTTP ' + xhr.status + ')')); return; }
      try { done(resolve,xhr.responseText ? JSON.parse(xhr.responseText) : {}); }
      catch { done(reject,new Error('서버 응답 형식이 올바르지 않습니다.')); }
    };
    xhr.onerror = () => done(reject,new Error('업로드 네트워크 오류'));
    xhr.ontimeout = () => done(reject,new Error('업로드 시간 초과'));
    xhr.onabort = () => done(reject,new DOMException('취소됨','AbortError'));
    signal?.addEventListener('abort',abort,{once:true});
    const body = new FormData(); body.append(fieldName,file,file.name);
    xhr.send(body);
  });
}
