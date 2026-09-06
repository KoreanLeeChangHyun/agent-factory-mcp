/* Shared, read-only document workbench. Layout is transient and tenant scoped. */
(() => {
  "use strict";
  const kinds = ["processed", "specification"];
  const labels = { processed: "가공 문서", specification: "명세 문서" };
  const iconPaths = {
    file: "M3 1.5h6l4 4V14H3ZM9 1.5V6h4",
    folder: "M1.5 4h5l1.5 2h6.5v7h-13Z",
    collapse: "M5 2h9v9M2 5h9v9H2ZM4 9h5",
    close: "m4 4 8 8M12 4l-8 8",
    split: "M2 2h12v12H2ZM8 2v12",
    down: "m4 6 4 4 4-4",
    right: "m6 4 4 4-4 4",
    left: "m10 4-4 4 4 4",
    minus: "M3 8h10",
    plus: "M3 8h10M8 3v10",
    pin: "M5 2h6M6 2v4l-2 3h8l-2-3V2M8 9v5",
    expand: "M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4",
    more: "M3 8h.1M8 8h.1M13 8h.1",
  };
  const node = (tag, className, text) => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  };
  const icon = (name) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", iconPaths[name] || iconPaths.file);
    svg.append(path);
    return svg;
  };
  const button = (label, symbol, action) => {
    const result = node("button", "de-button");
    result.type = "button";
    result.title = label;
    result.setAttribute("aria-label", label);
    result.append(icon(symbol));
    result.addEventListener("click", (event) => { event.stopPropagation(); action(event); });
    return result;
  };
  let serial = 0;
  class DocumentEditor {
    constructor({ host, reveal, onSelection, rootPath }) {
      Object.assign(this, { host, reveal, onSelection, rootPath });
      this.docs = new Map();
      this.groups = new Map();
      this.trees = new Map();
      this.menu = node("div", "de-menu");
      this.menu.setAttribute("role", "menu");
      this.menu.hidden = true;
      document.body.append(this.menu);
      for (const kind of kinds) this.setupTree(kind);
      this.reset();
      document.addEventListener("pointerdown", (event) => {
        if (!this.menu.contains(event.target)) this.closeMenu(false);
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { this.closeMenu(); this.clearDrag(); }
      });
      window.addEventListener("blur", () => this.clearDrag());
      document.addEventListener("dragend", () => this.clearDrag());
      document.addEventListener("drop", () => this.clearDrag());
      this.host.addEventListener("keydown", (event) => this.editorKey(event));
    }

    reset() {
      this.clearDrag();
      this.closeMenu(false);
      for (const group of this.groups.values()) {
        group.resizeObserver?.disconnect();
        for (const tab of group.tabs) this.disposeTab(tab);
      }
      this.groups.clear(); this.docs.clear(); this.maximized = null;
      for (const tree of this.trees.values()) {
        tree.selected.clear(); tree.collapsed.clear(); tree.query.value = ""; tree.rows = [];
        tree.list.replaceChildren(); tree.status.textContent = "";
      }
      const group = this.makeGroup();
      this.layout = { group: group.id }; this.active = group.id;
      this.renderLayout();
    }

    setDocuments(records, base) {
      const next = new Map();
      for (const record of records) {
        if (!kinds.includes(record.document_type)) continue;
        const metadata = record.document_metadata || {};
        const path = typeof metadata.path === "string" ? metadata.path : record.title;
        const parts = String(path).split("/").length > 32 ? [String(record.title)] : String(path).split("/");
        const safe = parts.every((part) => part && part !== "." && part !== ".." && !/[\\\x00-\x1f]/.test(part));
        next.set(String(record.id), {
          id: String(record.id), kind: record.document_type, title: String(record.title),
          parts: safe ? parts : [String(record.title)], path: safe ? path : record.title,
          href: record.current_revision_number > 0
            ? `${base}/${encodeURIComponent(record.id)}/revisions/${record.current_revision_number}/content` : null,
        });
      }
      this.docs = next;
      for (const tree of this.trees.values()) {
        tree.list.hidden = false; tree.status.hidden = true;
      }
      this.renderTrees();
    }

    setupTree(kind) {
      const list = document.querySelector(`[data-${kind}-list]`);
      const status = document.getElementById(`${kind}-tree-state`);
      const query = node("input"); query.type = "search";
      query.className = "de-document-search";
      query.placeholder = "검색"; query.title = `${labels[kind]} 파일 이름 검색`;
      query.setAttribute("aria-label", query.title);
      const collapse = button(`${labels[kind]} 모두 접기`, "collapse", () => {
        const tree = this.trees.get(kind);
        tree.query.value = "";
        for (const doc of this.docs.values()) {
          if (doc.kind !== kind) continue;
          doc.parts.slice(0, -1).forEach((_, index) => tree.collapsed.add(doc.parts.slice(0, index + 1).join("/")));
        }
        this.renderTree(kind);
      });
      const header = list.closest(".document-group").querySelector(".de-document-header");
      const toggle = header.querySelector("[data-document-group-toggle]");
      toggle.after(query);
      header.querySelector('[data-document-target]').before(collapse);
      list.setAttribute("aria-multiselectable", "true");
      list.classList.add("de-tree");
      const tree = { list, status, query, selected: new Set(), collapsed: new Set(), rows: [], anchor: null };
      this.trees.set(kind, tree);
      query.addEventListener("input", () => {
        if (toggle.getAttribute("aria-expanded") === "false") toggle.click();
        this.renderTree(kind);
      });
      query.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); list.querySelector('[role="treeitem"]')?.focus(); }
        if (event.key === "Escape") { query.value = ""; this.renderTree(kind); }
      });
      list.addEventListener("keydown", (event) => this.treeKey(kind, event));
    }

    renderTrees() { for (const kind of kinds) this.renderTree(kind); }

    renderTree(kind, focusKey) {
      const tree = this.trees.get(kind);
      const root = { children: new Map() };
      const query = tree.query.value.trim().toLocaleLowerCase();
      for (const doc of this.docs.values()) {
        if (doc.kind !== kind || (query && !doc.path.toLocaleLowerCase().includes(query))) continue;
        let parent = root;
        doc.parts.slice(0, -1).forEach((name, index) => {
          const key = doc.parts.slice(0, index + 1).join("/");
          if (!parent.children.has(`folder:${name}`)) parent.children.set(`folder:${name}`, { name, key, folder: true, children: new Map() });
          parent = parent.children.get(`folder:${name}`);
        });
        parent.children.set(`file:${doc.id}`, { name: doc.parts.at(-1), key: doc.id, doc });
      }
      const oldFocus = focusKey || tree.list.querySelector(":focus")?.dataset.key;
      tree.list.replaceChildren(); tree.rows = [];
      const walk = (parent, container, level, parentKey) => {
        const entries = [...parent.children.values()].sort((a, b) => Number(!!b.folder) - Number(!!a.folder) || a.name.localeCompare(b.name));
        entries.forEach((entry, index) => {
          const row = node("div", "de-tree-row");
          row.setAttribute("role", "treeitem"); row.tabIndex = -1;
          row.setAttribute("aria-level", String(level));
          row.setAttribute("aria-posinset", String(index + 1)); row.setAttribute("aria-setsize", String(entries.length));
          row.dataset.key = entry.key; row.style.setProperty("--depth", level - 1);
          row.title = entry.folder ? entry.key : `${entry.doc.title}\n${entry.doc.path}`;
          const expanded = query || !tree.collapsed.has(entry.key);
          const marker = icon(entry.folder ? (expanded ? "down" : "right") : "file");
          row.append(marker, ...(entry.folder ? [icon("folder")] : []), node("span", "de-tree-name", entry.name));
          if (entry.folder) row.setAttribute("aria-expanded", String(!!expanded));
          else {
            row.dataset[`${kind}Link`] = entry.doc.id;
            row.draggable = !!entry.doc.href;
            if (!entry.doc.href) { row.setAttribute("aria-disabled", "true"); row.title += " · 내용 없음"; }
          }
          const item = { ...entry, element: row, parentKey };
          tree.rows.push(item); container.append(row);
          row.addEventListener("focus", () => {
            tree.rows.forEach((value) => { value.element.tabIndex = value === item ? 0 : -1; });
          });
          row.addEventListener("click", (event) => {
            row.focus();
            if (entry.folder) { this.toggleFolder(kind, entry.key); return; }
            this.selectTree(kind, entry.key, event);
            if (!event.ctrlKey && !event.metaKey && !event.shiftKey) this.open(entry.key, { preview: event.detail < 2, focus: false });
          });
          row.addEventListener("dblclick", () => { if (!entry.folder) this.open(entry.key, { preview: false }); });
          row.addEventListener("contextmenu", (event) => {
            event.preventDefault(); row.focus();
            if (entry.folder) this.showMenu(event, [[expanded ? "폴더 접기" : "폴더 펼치기", () => this.toggleFolder(kind, entry.key)]], row);
            else {
              if (!tree.selected.has(entry.key)) this.selectTree(kind, entry.key, {});
              this.treeMenu(kind, event, row);
            }
          });
          row.addEventListener("dragstart", (event) => {
            event.stopPropagation();
            if (entry.folder || !entry.doc.href) { event.preventDefault(); return; }
            const ids = tree.selected.has(entry.key) ? [...tree.selected] : [entry.key];
            this.startDrag(event, { ids, kind: "tree" });
          });
          if (entry.folder && expanded) {
            const children = node("div", "de-tree-children"); children.setAttribute("role", "group");
            row.append(children); // Tree hierarchy remains semantic; children don't inherit parent clicks.
            children.addEventListener("click", (event) => event.stopPropagation());
            children.addEventListener("dblclick", (event) => event.stopPropagation());
            children.addEventListener("contextmenu", (event) => event.stopPropagation());
            walk(entry, children, level + 1, entry.key);
          }
        });
      };
      walk(root, tree.list, 1, null);
      tree.rows.find((row) => row.key === oldFocus)?.element.focus();
      if (!tree.rows.some((row) => row.element.tabIndex === 0) && tree.rows[0]) tree.rows[0].element.tabIndex = 0;
      tree.status.hidden = !query || tree.rows.length > 0;
      tree.status.textContent = tree.status.hidden ? "" : "일치하는 파일이 없습니다.";
      this.syncSelection();
    }

    toggleFolder(kind, key) {
      const tree = this.trees.get(kind);
      if (tree.collapsed.has(key)) tree.collapsed.delete(key); else tree.collapsed.add(key);
      this.renderTree(kind, key);
    }

    selectTree(kind, key, event) {
      const tree = this.trees.get(kind);
      if (event.shiftKey && tree.anchor) {
        const files = tree.rows.filter((row) => !row.folder);
        const a = files.findIndex((row) => row.key === tree.anchor), b = files.findIndex((row) => row.key === key);
        tree.selected = new Set(files.slice(Math.max(0, Math.min(a, b)), Math.max(a, b) + 1).map((row) => row.key));
      } else if (event.ctrlKey || event.metaKey) {
        if (tree.selected.has(key)) tree.selected.delete(key); else tree.selected.add(key);
        tree.anchor = key;
      } else { tree.selected = new Set([key]); tree.anchor = key; }
      this.syncSelection();
    }

    treeKey(kind, event) {
      const tree = this.trees.get(kind), index = tree.rows.findIndex((row) => row.element === event.target);
      if (index < 0) return;
      const row = tree.rows[index];
      let next;
      if (event.key === "ArrowDown") next = tree.rows[index + 1];
      else if (event.key === "ArrowUp") next = tree.rows[index - 1];
      else if (event.key === "Home") next = tree.rows[0];
      else if (event.key === "End") next = tree.rows.at(-1);
      else if (event.key === "ArrowRight" && row.folder) {
        if (tree.collapsed.has(row.key)) this.toggleFolder(kind, row.key); else next = tree.rows[index + 1];
      } else if (event.key === "ArrowLeft") {
        if (row.folder && !tree.collapsed.has(row.key)) this.toggleFolder(kind, row.key);
        else next = tree.rows.find((item) => item.key === row.parentKey);
      } else if (event.key === "Enter") {
        if (row.folder) this.toggleFolder(kind, row.key);
        else if (event.ctrlKey || event.metaKey) this.openSide([row.key], "right");
        else this.open(row.key, { preview: false });
      } else if (event.key === " ") {
        if (row.folder) this.toggleFolder(kind, row.key); else this.selectTree(kind, row.key, { ctrlKey: true });
      } else if ((event.ctrlKey || event.metaKey) && event.key === "a") {
        tree.selected = new Set(tree.rows.filter((item) => !item.folder).map((item) => item.key)); this.syncSelection();
      } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        if (!row.folder) { if (!tree.selected.has(row.key)) this.selectTree(kind, row.key, {}); this.treeMenu(kind, event, row.element); }
      } else return;
      event.preventDefault(); event.stopPropagation();
      if (next) { next.element.focus(); if (event.shiftKey && !next.folder) this.selectTree(kind, next.key, event); }
    }

    treeMenu(kind, event, origin) {
      const ids = [...this.trees.get(kind).selected].filter((id) => this.docs.get(id)?.href);
      this.showMenu(event, [
        ["열기", () => ids.forEach((id) => this.open(id))],
        ["오른쪽에 열기", () => this.openSide(ids, "right")],
        ["아래에 열기", () => this.openSide(ids, "bottom")],
      ], origin);
    }

    makeGroup() {
      const id = `de-group-${++serial}`, element = node("section", "de-group"); element.dataset.groupId = id;
      element.setAttribute("aria-label", "문서 에디터 그룹");
      const header = node("header", "de-header"), tabsElement = node("div", "de-tabs");
      tabsElement.setAttribute("role", "tablist"); tabsElement.setAttribute("aria-label", "열린 문서");
      const actions = node("div", "de-actions"), body = node("div", "de-body");
      const group = { id, element, tabsElement, body, tabs: [], active: null };
      group.resizeObserver = new ResizeObserver(() => this.positionPins(group));
      group.resizeObserver.observe(tabsElement);
      actions.append(
        button("오른쪽으로 분할", "split", () => this.splitActive(group, "right")),
        button("그룹 확대·복원", "expand", () => { this.maximized = this.maximized === id ? null : id; this.active = id; this.renderLayout(); }),
        button("그룹 메뉴", "more", (event) => this.groupMenu(group, event)),
      );
      header.append(tabsElement, actions); element.append(header, body);
      element.addEventListener("pointerdown", () => this.activateGroup(group));
      element.addEventListener("focusin", () => this.activateGroup(group));
      body.addEventListener("dragover", (event) => this.dragOver(event, group));
      body.addEventListener("dragleave", (event) => { if (!body.contains(event.relatedTarget)) delete body.dataset.drop; });
      body.addEventListener("drop", (event) => this.drop(event, group));
      tabsElement.addEventListener("dragover", (event) => this.dragOver(event, group, true));
      tabsElement.addEventListener("dragleave", (event) => { if (!tabsElement.contains(event.relatedTarget)) tabsElement.querySelectorAll("[data-insert]").forEach((item) => delete item.dataset.insert); });
      tabsElement.addEventListener("drop", (event) => this.drop(event, group, true));
      this.groups.set(id, group); return group;
    }

    activateGroup(group) {
      this.active = group.id;
      for (const item of this.groups.values()) item.element.classList.toggle("is-active", item === group);
      this.syncSelection();
    }

    open(id, { group = this.groups.get(this.active), preview = false, focus = true, index } = {}) {
      const doc = this.docs.get(id);
      if (!doc?.href || !group) return;
      this.reveal();
      let tab = group.tabs.find((item) => item.doc.id === id);
      if (!tab) {
        const previous = preview ? group.tabs.find((item) => item.preview && !item.pinned) : null;
        if (previous) { group.tabs.splice(group.tabs.indexOf(previous), 1); this.disposeTab(previous); }
        tab = this.makeTab(doc, preview);
        group.tabs.splice(index ?? group.tabs.length, 0, tab);
      } else if (!preview) tab.preview = false;
      group.active = tab.id; this.activateGroup(group); this.renderGroup(group);
      this.revealFile(doc);
      if (focus) tab.button.focus();
      this.onSelection?.(doc);
      return tab;
    }

    makeTab(doc, preview) {
      const id = `de-tab-${++serial}`, panel = node("div", "de-panel"); panel.id = `${id}-panel`;
      panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", id); panel.tabIndex = 0;
      const tab = { id, doc, preview, pinned: false, panel, controller: new AbortController(), urls: [] };
      this.loadContent(tab);
      return tab;
    }

    async loadContent(tab) {
      const { panel, doc, controller } = tab;
      panel.replaceChildren(node("p", "de-status", "문서를 불러오는 중입니다.")); panel.setAttribute("aria-busy", "true");
      try {
        const url = new URL(doc.href, location.href);
        if (url.origin !== location.origin || !url.pathname.startsWith(`${this.rootPath}/api/organizations/`)) throw new Error("허용되지 않은 문서 주소입니다.");
        const response = await fetch(url, { credentials: "same-origin", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "문서에 접근할 권한이 없습니다." : `문서를 불러오지 못했습니다. (${response.status})`);
        const media = (response.headers.get("content-type") || "").split(";")[0];
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        panel.replaceChildren();
        if (media.startsWith("text/") || media === "application/json") {
          let text = await blob.text();
          if (controller.signal.aborted) return;
          if (media === "application/json") { try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* Preserve invalid source text. */ } }
          // Source is always text, never HTML injected into the application origin.
          const content = node("pre", "de-text", text); content.setAttribute("aria-label", doc.title); panel.append(content);
        } else if (media === "application/zip") {
          await this.renderPackage(tab, url);
        } else if (media === "application/pdf") {
          await this.renderPDF(tab, blob);
        } else if (["image/png", "image/jpeg", "image/gif", "image/webp"].includes(media)) {
          const url = URL.createObjectURL(blob); tab.urls.push(url);
          const image = node("img", "de-image"); image.src = url; image.alt = doc.title; panel.append(image);
        } else panel.append(node("p", "de-status", "이 파일 형식은 다운로드하여 열 수 있습니다."), this.downloadLink(doc));
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = node("p", "de-status", error.message); message.setAttribute("role", "alert");
        const retry = node("button", "de-retry", "다시 시도"); retry.type = "button";
        retry.addEventListener("click", () => this.loadContent(tab)); panel.replaceChildren(message, retry);
      } finally { if (!controller.signal.aborted) panel.removeAttribute("aria-busy"); }
    }

    async renderPackage(tab, contentURL) {
      const match = contentURL.pathname.match(/^(.*)\/documents\/([^/]+)\/revisions\/(\d+)\/content$/);
      if (!match) throw new Error("패키지 리비전 주소를 확인할 수 없습니다.");
      const base = `${match[1]}/cloud-documents/${match[2]}/revisions/${match[3]}/package`;
      const response = await fetch(base, { credentials: "same-origin", signal: tab.controller.signal });
      if (!response.ok) throw new Error(`패키지를 불러오지 못했습니다. (${response.status})`);
      const manifest = await response.json();
      if (tab.controller.signal.aborted) return;
      if (manifest.human_entry) {
        const frame = node("iframe", "de-package-preview");
        frame.title = tab.doc.title; frame.setAttribute("sandbox", "allow-scripts");
        frame.referrerPolicy = "no-referrer"; frame.src = `${base}/preview`;
        tab.panel.append(frame);
      } else tab.panel.append(node("p", "de-status", "이 패키지에는 HTML 시작 문서가 없습니다."));
      const files = node("details", "de-package-files");
      files.append(node("summary", "", "패키지 파일"));
      for (const member of manifest.members) {
        const link = node("a", "de-download", member.path);
        link.href = `${base}/member?path=${encodeURIComponent(member.path)}`; link.download = "";
        files.append(link);
      }
      files.append(this.downloadLink(tab.doc)); tab.panel.append(files);
    }

    async renderPDF(tab, blob) {
      const base = `${this.rootPath}/static/vendor/pdfjs/6.3.289/`;
      const pdfjs = await import(`${base}legacy/build/pdf.mjs`);
      if (tab.controller.signal.aborted) return;
      pdfjs.GlobalWorkerOptions.workerSrc = `${base}legacy/build/pdf.worker.mjs`;
      const data = new Uint8Array(await blob.arrayBuffer());
      if (tab.controller.signal.aborted) return;
      tab.pdfTask = pdfjs.getDocument({ data, cMapUrl: `${base}cmaps/`, cMapPacked: true,
        standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/`,
        isEvalSupported: false, useWasm: false, disableFontFace: true });
      const pdf = await tab.pdfTask.promise;
      if (tab.controller.signal.aborted) return;
      const toolbar = node("div", "de-pdf-toolbar"), status = node("span");
      status.setAttribute("role", "status");
      const canvas = node("canvas", "de-pdf-page"); canvas.setAttribute("role", "img");
      const text = node("pre", "sr-only");
      let pageNumber = 1, zoom = 1, rendering = false;
      const draw = async () => {
        if (rendering || tab.controller.signal.aborted) return;
        rendering = true;
        controls.forEach(control => { control.disabled = true; });
        try {
          const page = await pdf.getPage(pageNumber);
          if (tab.controller.signal.aborted) return;
          const viewport = page.getViewport({ scale: zoom });
          // Bound canvas memory even for unusually large page dimensions.
          const scale = Math.min(devicePixelRatio || 1, 2, Math.sqrt(8000000 / (viewport.width * viewport.height)));
          canvas.width = Math.max(1, Math.floor(viewport.width * scale));
          canvas.height = Math.max(1, Math.floor(viewport.height * scale));
          canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
          tab.pdfRender = page.render({ canvasContext: canvas.getContext("2d"), viewport, transform: [scale, 0, 0, scale, 0, 0] });
          await tab.pdfRender.promise;
          if (tab.controller.signal.aborted) return;
          const content = await page.getTextContent();
          if (tab.controller.signal.aborted) return;
          text.textContent = content.items.map(item => item.str || "").join(" ");
          status.textContent = `${pageNumber} / ${pdf.numPages} · ${Math.round(zoom * 100)}%`;
          canvas.setAttribute("aria-label", `${tab.doc.title} ${pageNumber}페이지`);
          canvas.dataset.rendered = String(pageNumber);
        } catch (error) {
          if (!tab.controller.signal.aborted) status.textContent = `페이지를 표시하지 못했습니다: ${error.message}`;
        } finally {
          rendering = false;
          previous.disabled = pageNumber === 1; next.disabled = pageNumber === pdf.numPages;
          smaller.disabled = zoom <= 0.5; larger.disabled = zoom >= 2;
        }
      };
      const previous = button("이전 페이지", "left", () => { pageNumber--; void draw(); });
      const next = button("다음 페이지", "right", () => { pageNumber++; void draw(); });
      const smaller = button("PDF 축소", "minus", () => { zoom = Math.max(0.5, zoom - 0.25); void draw(); });
      const larger = button("PDF 확대", "plus", () => { zoom = Math.min(2, zoom + 0.25); void draw(); });
      const controls = [previous, next, smaller, larger];
      toolbar.append(previous, status, next, smaller, larger, this.downloadLink(tab.doc));
      tab.panel.replaceChildren(toolbar, canvas, text);
      await draw();
    }

    downloadLink(doc) { const link = node("a", "de-download", "파일 다운로드"); link.href = doc.href; link.download = ""; return link; }
    disposeTab(tab) {
      tab.controller.abort(); tab.pdfRender?.cancel(); void tab.pdfTask?.destroy().catch(() => {});
      tab.urls.forEach((url) => URL.revokeObjectURL(url)); tab.panel.remove();
    }

    renderGroup(group) {
      group.tabsElement.replaceChildren();
      group.tabs.forEach((tab) => {
        const wrap = node("div", "de-tab"); wrap.dataset.tabId = tab.id; wrap.draggable = true;
        wrap.classList.toggle("is-preview", tab.preview); wrap.classList.toggle("is-pinned", tab.pinned);
        wrap.classList.toggle("is-selected", group.active === tab.id);
        const select = node("button", "de-tab-select"); select.type = "button"; select.id = tab.id;
        select.setAttribute("role", "tab"); select.setAttribute("aria-controls", tab.panel.id);
        select.setAttribute("aria-selected", String(group.active === tab.id)); select.tabIndex = group.active === tab.id ? 0 : -1;
        select.title = `${tab.doc.title}\n${tab.doc.path}`; select.setAttribute("aria-label", tab.doc.title);
        select.append(icon("file"), node("span", "de-tab-name", tab.doc.parts.at(-1)));
        select.addEventListener("click", () => { group.active = tab.id; this.activateGroup(group); this.renderGroup(group); this.revealFile(tab.doc); tab.button.focus(); this.onSelection?.(tab.doc); });
        select.addEventListener("dblclick", () => { tab.preview = false; this.renderGroup(group); tab.button.focus(); });
        select.addEventListener("keydown", (event) => {
          const index = group.tabs.indexOf(tab);
          const target = { ArrowLeft: (index + group.tabs.length - 1) % group.tabs.length, ArrowRight: (index + 1) % group.tabs.length, Home: 0, End: group.tabs.length - 1 }[event.key];
          if (target !== undefined) { event.preventDefault(); event.stopPropagation(); group.tabs[target].button.click(); }
        });
        tab.button = select;
        const close = button(tab.pinned ? `${tab.doc.title} 고정 해제` : `${tab.doc.title} 닫기`, tab.pinned ? "pin" : "close", () => tab.pinned ? this.pin(group, tab) : this.closeTabs(group, [tab]));
        close.addEventListener("pointerdown", (event) => event.stopPropagation());
        close.addEventListener("focusin", (event) => event.stopPropagation());
        close.draggable = false;
        wrap.append(select, close);
        wrap.addEventListener("auxclick", (event) => { if (event.button === 1) { event.preventDefault(); this.closeTabs(group, [tab]); } });
        wrap.addEventListener("contextmenu", (event) => { event.preventDefault(); this.tabMenu(group, tab, event, select); });
        wrap.addEventListener("dragstart", (event) => this.startDrag(event, { kind: "tab", ids: [tab.doc.id], groupId: group.id, tabId: tab.id }));
        group.tabsElement.append(wrap);
        tab.panel.hidden = group.active !== tab.id;
        if (tab.panel.parentElement !== group.body) {
          if (group.body.moveBefore && group.body.isConnected && tab.panel.isConnected) group.body.moveBefore(tab.panel, null);
          else group.body.append(tab.panel);
        }
      });
      group.body.querySelector(".de-empty")?.remove();
      if (!group.tabs.length) group.body.append(node("p", "de-empty", "탐색기에서 문서를 열거나 여기에 끌어 놓으세요."));
      this.positionPins(group);
      this.syncSelection();
    }

    positionPins(group) {
      let offset = 0;
      for (const item of group.tabsElement.children) {
        if (!item.classList.contains("is-pinned")) continue;
        item.style.left = `${offset}px`; offset += item.offsetWidth;
      }
    }

    pin(group, tab) {
      tab.pinned = !tab.pinned; tab.preview = false;
      group.tabs.sort((a, b) => Number(b.pinned) - Number(a.pinned)); this.renderGroup(group); tab.button.focus();
    }

    closeTabs(group, tabs) {
      const originalIndex = group.tabs.findIndex((tab) => tab.id === group.active);
      const before = group.tabs.slice();
      group.tabs = group.tabs.filter((tab) => !tabs.includes(tab));
      tabs.forEach((tab) => this.disposeTab(tab));
      if (!group.tabs.some((tab) => tab.id === group.active)) {
        group.active = (before.slice(originalIndex + 1).find((tab) => group.tabs.includes(tab)) || before.slice(0, originalIndex).reverse().find((tab) => group.tabs.includes(tab)))?.id || null;
      }
      this.clearDrag(); this.normalize(); this.renderLayout();
      const active = this.groups.get(this.active);
      active?.tabs.find((tab) => tab.id === active.active)?.button.focus();
    }

    normalize() {
      const leaves = (branch) => branch.group ? [branch.group] : [...leaves(branch.first), ...leaves(branch.second)];
      const order = leaves(this.layout), previous = order.indexOf(this.active);
      const surviving = order.filter((id) => this.groups.get(id).tabs.length);
      const keep = surviving.length ? new Set(surviving) : new Set([this.active]);
      const prune = (branch) => {
        if (branch.group) {
          if (keep.has(branch.group)) return branch;
          this.groups.get(branch.group).resizeObserver?.disconnect();
          this.groups.get(branch.group).element.remove(); this.groups.delete(branch.group); return null;
        }
        const first = prune(branch.first), second = prune(branch.second);
        if (first && second) { branch.first = first; branch.second = second; return branch; }
        return first || second;
      };
      this.layout = prune(this.layout);
      if (!this.groups.has(this.active)) this.active = order.slice(previous + 1).find((id) => keep.has(id)) || order.slice(0, previous).reverse().find((id) => keep.has(id));
      if (!this.groups.has(this.maximized)) this.maximized = null;
    }

    split(group, edge) {
      this.maximized = null;
      const next = this.makeGroup();
      const insert = (branch) => {
        if (branch.group === group.id) {
          const newLeaf = { group: next.id }, before = edge === "left" || edge === "top";
          return { axis: edge === "left" || edge === "right" ? "horizontal" : "vertical", ratio: 0.5, first: before ? newLeaf : branch, second: before ? branch : newLeaf };
        }
        if (!branch.group) { branch.first = insert(branch.first); branch.second = insert(branch.second); }
        return branch;
      };
      this.layout = insert(this.layout); return next;
    }

    openSide(ids, edge, source = this.groups.get(this.active)) {
      ids = ids.filter((id) => this.docs.get(id)?.href);
      if (!ids.length) return;
      const group = source.tabs.length ? this.split(source, edge) : source;
      ids.forEach((id) => this.open(id, { group })); this.renderLayout(); group.tabs.find((tab) => tab.id === group.active)?.button.focus();
    }
    splitActive(group, edge) { const tab = group.tabs.find((item) => item.id === group.active); if (tab) this.openSide([tab.doc.id], edge, group); }

    renderLayout() {
      const move = (parent, child, before = null) => {
        if (child.parentElement === parent && child.nextSibling === before) return;
        if (parent.moveBefore && parent.isConnected && child.isConnected) parent.moveBefore(child, before);
        else parent.insertBefore(child, before);
      };
      const build = (branch, parent) => {
        if (branch.group) {
          const group = this.groups.get(branch.group);
          move(parent, group.element);
          this.renderGroup(group);
          return group.element;
        }
        if (!branch.element) {
          branch.element = node("div", `de-split de-split--${branch.axis}`);
          const sash = node("div", "de-sash"); branch.sash = sash;
          sash.tabIndex = 0; sash.setAttribute("role", "separator"); sash.setAttribute("aria-label", "문서 분할 크기 조절");
          sash.setAttribute("aria-orientation", branch.axis === "horizontal" ? "vertical" : "horizontal");
          sash.setAttribute("aria-valuemin", "10"); sash.setAttribute("aria-valuemax", "90");
          branch.resize = (ratio) => {
            branch.ratio = Math.max(0.1, Math.min(0.9, ratio));
            branch.firstElement.style.flex = `${branch.ratio} 1 0px`;
            branch.secondElement.style.flex = `${1 - branch.ratio} 1 0px`;
            sash.setAttribute("aria-valuenow", String(Math.round(branch.ratio * 100)));
          };
          sash.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            event.preventDefault(); sash.setPointerCapture(event.pointerId); sash.focus(); this.host.classList.add("is-resizing");
          });
          sash.addEventListener("pointermove", (event) => {
            if (!sash.hasPointerCapture(event.pointerId)) return;
            const rect = branch.element.getBoundingClientRect();
            branch.resize(branch.axis === "horizontal" ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height);
          });
          const stop = () => this.host.classList.remove("is-resizing");
          sash.addEventListener("pointerup", stop); sash.addEventListener("pointercancel", stop); sash.addEventListener("lostpointercapture", stop);
          sash.addEventListener("dblclick", () => branch.resize(0.5));
          sash.addEventListener("keydown", (event) => {
            const delta = branch.axis === "horizontal" ? { ArrowLeft: -0.05, ArrowRight: 0.05 } : { ArrowUp: -0.05, ArrowDown: 0.05 };
            if (delta[event.key] !== undefined) { event.preventDefault(); branch.resize(branch.ratio + delta[event.key]); }
            if (event.key === "Home" || event.key === "End") { event.preventDefault(); branch.resize(event.key === "Home" ? 0.1 : 0.9); }
          });
        }
        move(parent, branch.element);
        branch.firstElement = build(branch.first, branch.element);
        branch.secondElement = build(branch.second, branch.element);
        move(branch.element, branch.sash, branch.secondElement);
        // Remove obsolete wrappers only after surviving panes have moved out.
        for (const child of [...branch.element.children]) {
          if (![branch.firstElement, branch.sash, branch.secondElement].includes(child)) child.remove();
        }
        branch.resize(branch.ratio);
        return branch.element;
      };
      const root = build(this.layout, this.host);
      root.style.flex = "1 1 0px";
      for (const child of [...this.host.children]) if (child !== root) child.remove();
      const applyMaximized = (branch) => {
        if (branch.group) {
          const group = this.groups.get(branch.group);
          group.element.hidden = !!this.maximized && branch.group !== this.maximized;
          return !group.element.hidden;
        }
        const first = applyMaximized(branch.first), second = applyMaximized(branch.second);
        branch.element.hidden = !first && !second;
        branch.sash.hidden = !!this.maximized;
        return first || second;
      };
      applyMaximized(this.layout);
      this.activateGroup(this.groups.get(this.active));
      const activeGroup = this.groups.get(this.active);
      activeGroup.tabs.find((tab) => tab.id === activeGroup.active)?.button.focus();
    }

    revealFile(doc) {
      const tree = this.trees.get(doc.kind); tree.query.value = "";
      doc.parts.slice(0, -1).forEach((_, index) => tree.collapsed.delete(doc.parts.slice(0, index + 1).join("/")));
      tree.selected = new Set([doc.id]); tree.anchor = doc.id;
      const groupToggle = tree.list.closest(".document-group")?.querySelector("[data-document-group-toggle]");
      if (groupToggle?.getAttribute("aria-expanded") === "false") groupToggle.click();
      this.renderTree(doc.kind);
      tree.rows.find((row) => row.key === doc.id)?.element.scrollIntoView({ block: "nearest" });
    }

    syncSelection() {
      const group = this.groups.get(this.active), active = group?.tabs.find((tab) => tab.id === group.active)?.doc.id;
      for (const tree of this.trees.values()) for (const row of tree.rows) {
        if (row.folder) continue;
        row.element.setAttribute("aria-selected", String(tree.selected.has(row.key)));
        row.element.classList.toggle("is-active-file", row.key === active);
        if (row.key === active) row.element.setAttribute("aria-current", "page"); else row.element.removeAttribute("aria-current");
      }
    }

    showMenu(event, items, origin) {
      this.closeMenu(false); this.menuOrigin = origin || event.currentTarget;
      this.menu.replaceChildren();
      items.forEach(([label, action]) => {
        const entry = node("button", "", label); entry.type = "button"; entry.setAttribute("role", "menuitem");
        entry.addEventListener("click", () => { this.closeMenu(false); action(); }); this.menu.append(entry);
      });
      this.menu.hidden = false;
      const rect = this.menuOrigin?.getBoundingClientRect();
      this.menu.style.left = `${Math.max(4, Math.min(event.clientX || rect?.left || 4, innerWidth - this.menu.offsetWidth - 4))}px`;
      this.menu.style.top = `${Math.max(4, Math.min(event.clientY || rect?.bottom || 4, innerHeight - this.menu.offsetHeight - 4))}px`;
      this.menu.onkeydown = (keyEvent) => {
        const entries = [...this.menu.children], index = entries.indexOf(document.activeElement);
        const target = { ArrowDown: (index + 1) % entries.length, ArrowUp: (index + entries.length - 1) % entries.length, Home: 0, End: entries.length - 1 }[keyEvent.key];
        if (target !== undefined) { keyEvent.preventDefault(); entries[target].focus(); }
        if (keyEvent.key === "Tab") this.closeMenu();
      };
      this.menu.firstElementChild?.focus();
    }
    closeMenu(focus = true) { if (!this.menu || this.menu.hidden) return; this.menu.hidden = true; if (focus && this.menuOrigin?.isConnected) this.menuOrigin.focus(); }
    tabMenu(group, tab, event, origin) {
      this.showMenu(event, [
        [tab.pinned ? "고정 해제" : "탭 고정", () => this.pin(group, tab)],
        ["탭 닫기", () => this.closeTabs(group, [tab])],
        ["다른 탭 닫기", () => this.closeTabs(group, group.tabs.filter((item) => item !== tab && !item.pinned))],
        ["오른쪽 탭 닫기", () => this.closeTabs(group, group.tabs.slice(group.tabs.indexOf(tab) + 1).filter((item) => !item.pinned))],
        ["모든 탭 닫기", () => this.closeTabs(group, group.tabs.filter((item) => !item.pinned))],
        ...["left", "right", "top", "bottom"].map((edge, index) => [["왼쪽으로 분할", "오른쪽으로 분할", "위로 분할", "아래로 분할"][index], () => this.openSide([tab.doc.id], edge, group)]),
        ["탐색기에 표시", () => { this.revealFile(tab.doc); this.trees.get(tab.doc.kind).rows.find((row) => row.key === tab.doc.id)?.element.focus(); }],
      ], origin);
    }
    groupMenu(group, event) {
      this.showMenu(event, [
        ["아래로 분할", () => this.splitActive(group, "bottom")],
        ["그룹 확대·복원", () => { this.maximized = this.maximized === group.id ? null : group.id; this.active = group.id; this.renderLayout(); }],
        ["그룹 닫기", () => this.closeTabs(group, [...group.tabs])],
        ["전체 에디터 닫기", () => {
          for (const value of this.groups.values()) { value.tabs.forEach((tab) => this.disposeTab(tab)); value.tabs = []; value.active = null; }
          this.clearDrag(); this.normalize(); this.renderLayout();
        }],
      ], event.currentTarget);
    }

    editorKey(event) {
      const group = this.groups.get(this.active); if (!group) return;
      if (event.key === "F6") {
        event.preventDefault(); const groups = [...this.groups.values()], offset = event.shiftKey ? groups.length - 1 : 1;
        const next = groups[(groups.indexOf(group) + offset) % groups.length];
        this.activateGroup(next); next.tabs.find((tab) => tab.id === next.active)?.button.focus();
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === "\\") { event.preventDefault(); this.splitActive(group, event.shiftKey ? "bottom" : "right"); }
      if (event.key === "w") { event.preventDefault(); this.closeTabs(group, event.shiftKey ? group.tabs.filter((tab) => !tab.pinned) : group.tabs.filter((tab) => tab.id === group.active)); }
      if (event.key === "Tab") { event.preventDefault(); const index = group.tabs.findIndex((tab) => tab.id === group.active); group.tabs[(index + (event.shiftKey ? group.tabs.length - 1 : 1)) % group.tabs.length]?.button.click(); }
    }

    startDrag(event, drag) {
      this.clearDrag(); this.drag = drag;
      event.dataTransfer.setData("application/x-agent-factory-document", "internal");
      event.dataTransfer.effectAllowed = drag.kind === "tab" ? "copyMove" : "copy";
      this.host.classList.add("is-dragging");
      event.currentTarget.classList.add("is-dragging");
      if (drag.kind === "tree") this.reveal();
    }
    clearDrag() {
      document.querySelectorAll(".de-tab.is-dragging, .de-tree-row.is-dragging").forEach((item) => item.classList.remove("is-dragging"));
      this.drag = null; this.host?.classList.remove("is-dragging", "is-resizing");
      this.host?.querySelectorAll("[data-drop], [data-insert]").forEach((item) => { delete item.dataset.drop; delete item.dataset.insert; });
    }
    dragOver(event, group, tabs = false) {
      if (!this.drag) return;
      event.preventDefault(); event.stopPropagation();
      event.dataTransfer.dropEffect = this.drag.kind === "tree" || event.ctrlKey || event.altKey ? "copy" : "move";
      if (tabs) {
        const target = event.target.closest("[data-tab-id]");
        group.tabsElement.querySelectorAll("[data-insert]").forEach((item) => delete item.dataset.insert);
        if (target) target.dataset.insert = event.clientX < target.getBoundingClientRect().left + target.offsetWidth / 2 ? "before" : "after";
      } else {
        const rect = group.body.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
        group.body.dataset.drop = x < 0.23 ? "left" : x > 0.77 ? "right" : y < 0.23 ? "top" : y > 0.77 ? "bottom" : "center";
      }
    }
    drop(event, target, tabs = false) {
      if (!this.drag) return;
      event.preventDefault(); event.stopPropagation();
      const drag = this.drag, copy = drag.kind === "tree" || event.ctrlKey || event.altKey;
      const edge = tabs ? "center" : target.body.dataset.drop || "center";
      const targetTab = tabs ? event.target.closest("[data-tab-id]") : null;
      const index = targetTab ? target.tabs.findIndex((tab) => tab.id === targetTab.dataset.tabId) + (targetTab.dataset.insert === "after" ? 1 : 0) : target.tabs.length;
      this.clearDrag();
      const source = this.groups.get(drag.groupId), moving = source?.tabs.find((tab) => tab.id === drag.tabId);
      if (edge !== "center" && source === target && source.tabs.length === 1 && !copy) return;
      const destination = edge === "center" ? target : this.split(target, edge);
      if (moving && !copy) {
        const originalIndex = source.tabs.indexOf(moving);
        source.tabs.splice(originalIndex, 1); moving.preview = false;
        const duplicate = destination.tabs.find((tab) => tab.doc.id === moving.doc.id);
        if (duplicate) { destination.active = duplicate.id; duplicate.preview = false; this.disposeTab(moving); }
        else {
          const insertion = Math.max(0, index - (source === destination && originalIndex < index ? 1 : 0));
          destination.tabs.splice(edge === "center" ? insertion : destination.tabs.length, 0, moving);
          destination.tabs.sort((a, b) => Number(b.pinned) - Number(a.pinned)); destination.active = moving.id;
        }
        if (source !== destination && source.active === moving.id) source.active = source.tabs[Math.min(originalIndex, source.tabs.length - 1)]?.id || null;
        this.active = destination.id;
        if (source === destination && edge === "center") this.renderGroup(destination);
        else { this.normalize(); this.renderLayout(); }
        const active = destination.tabs.find((tab) => tab.id === destination.active); if (active) { active.button.focus(); this.revealFile(active.doc); }
      } else { drag.ids.forEach((id, offset) => this.open(id, { group: destination, index: index + offset })); this.renderLayout(); }
    }
  }
  window.AgentFactoryDocumentEditor = DocumentEditor;
})();
