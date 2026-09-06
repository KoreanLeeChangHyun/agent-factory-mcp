/* Trusted wrapper. Never insert a package node into this document. */
(() => {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.title = '명세 문서 내용';
  document.body.append(frame);
  const files = packageData.files, urls = new Map(), active = new Set();
  const bytes = path => Uint8Array.from(atob(files[path]), c => c.charCodeAt(0));
  const text = path => new TextDecoder('utf-8', { fatal: true }).decode(bytes(path));
  const resolve = (base, value) => {
    if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(value) || /[\\\x00-\x1f]/.test(value)) return null;
    try {
      const url = new URL(value, 'https://package.invalid/' + base);
      const path = decodeURIComponent(url.pathname.slice(1));
      return Object.hasOwn(files, path) ? { path, hash: url.hash } : null;
    } catch { return null; }
  };
  const mime = path => ({css:'text/css', js:'text/javascript', mjs:'text/javascript', png:'image/png',
    jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml',
    woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', otf:'font/otf'})[path.split('.').pop().toLowerCase()] || 'application/octet-stream';
  const inlineCSS = (css, path) => css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_, q, value) => {
    if (value.startsWith('#')) return `url("${value.replace(/"/g, '')}")`;
    const target = resolve(path, value);
    return `url("${target ? resource(target.path) + target.hash : 'data:,'}")`;
  });
  const resource = path => {
    if (urls.has(path)) return urls.get(path);
    if (active.has(path)) return 'data:,';
    active.add(path);
    let url;
    if (mime(path) === 'text/css') {
      let css = text(path);
      css = css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_, q, value) => {
        if (value.startsWith('#')) return `url("${value.replace(/"/g, '')}")`;
        const target = resolve(path, value);
        return `url("${target ? resource(target.path) + target.hash : 'data:,'}")`;
      });
      css = css.replace(/@import\s+(['"])(.*?)\1/gi, (_, q, value) => {
        const target = resolve(path, value);
        return `@import "${target ? resource(target.path) : 'data:,'}"`;
      });
      // Avoid argument-count limits for multi-megabyte vendor stylesheets.
      const encoded = new TextEncoder().encode(css); let binary = '';
      for (let i = 0; i < encoded.length; i += 8192) binary += String.fromCharCode(...encoded.subarray(i, i + 8192));
      url = 'data:text/css;base64,' + btoa(binary);
    } else {
      // Data URLs carry validated bytes across the two distinct opaque origins.
      // Wrapper-owned blob URLs cannot be loaded by the sandboxed child. Keeping
      // script src (rather than inlining code) preserves native order/defer/async.
      url = 'data:' + mime(path) + ';base64,' + files[path];
    }
    active.delete(path); urls.set(path, url); return url;
  };
  const render = (path, hash = '') => {
    const parsed = new DOMParser().parseFromString(text(path), 'text/html');
    parsed.querySelectorAll('base,meta[http-equiv],iframe,frame,object,embed').forEach(el => el.remove());
    parsed.documentElement.dataset.agentFactoryWorkspaceEmbedded = 'true';
    for (const el of parsed.querySelectorAll('*')) {
      el.removeAttribute('srcset'); el.removeAttribute('ping'); el.removeAttribute('target');
      el.removeAttribute('action'); el.removeAttribute('formaction');
      if (el.localName === 'style') el.textContent = inlineCSS(el.textContent, path);
      if (el.hasAttribute('style')) el.setAttribute('style', inlineCSS(el.getAttribute('style'), path));
      // CSS in style elements/attributes may retain fragment references; CSP blocks
      // unresolved network URLs. Local inline CSS uses the same controlled resolver.
      for (const attr of ['src', 'href', 'poster', 'xlink:href']) {
        if (!el.hasAttribute(attr)) continue;
        const value = el.getAttribute(attr);
        if (el.localName === 'a' && attr === 'href') {
          if (value.startsWith('#')) continue;
          const target = resolve(path, value);
          el.setAttribute('href', '#');
          if (target) el.dataset.packageTarget = target.path + target.hash;
          continue;
        }
        if (value.startsWith('#')) continue;
        const target = resolve(path, value);
        el.setAttribute(attr, target ? resource(target.path) + target.hash : 'data:,');
        el.removeAttribute('integrity'); el.removeAttribute('crossorigin');
      }
    }
    const bridge = parsed.createElement('script');
    bridge.textContent = `document.addEventListener('click', e => {const a=e.target.closest('a'); if(a && a.dataset.packageTarget){e.preventDefault();parent.postMessage({packageLink:a.dataset.packageTarget}, '*');}}, true);`;
    parsed.head.prepend(bridge);
    if (hash) {
      const scroll = parsed.createElement('script');
      scroll.textContent = `addEventListener('load',()=>document.getElementById(${JSON.stringify(decodeURIComponent(hash.slice(1)))})?.scrollIntoView());`;
      parsed.body.append(scroll);
    }
    frame.srcdoc = '<!doctype html>' + parsed.documentElement.outerHTML;
  };
  addEventListener('message', event => {
    if (event.source !== frame.contentWindow || typeof event.data?.packageLink !== 'string') return;
    const value = event.data.packageLink;
    const split = value.indexOf('#'), path = split < 0 ? value : value.slice(0, split);
    if (Object.hasOwn(files, path) && /\.html?$/i.test(path)) render(path, split < 0 ? '' : value.slice(split));
  });
  render(packageData.entry);
})();
