var agentFactoryUI = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/product-core.js
  var product_core_exports = {};
  __export(product_core_exports, {
    badge: () => badge,
    bindCodeOperation: () => bindCodeOperation,
    bindNativeDialog: () => bindNativeDialog,
    bindResizeHandle: () => bindResizeHandle,
    bindTabs: () => bindTabs,
    bindTreeKeyboard: () => bindTreeKeyboard,
    button: () => button,
    createNativeConfirm: () => createNativeConfirm,
    explorerTree: () => explorerTree,
    fieldFor: () => fieldFor,
    grid: () => grid,
    icon: () => icon,
    iconButton: () => iconButton,
    inline: () => inline,
    menuKeyboard: () => menuKeyboard,
    metadataGrid: () => metadataGrid,
    metadataList: () => metadataList,
    renderNativeTree: () => renderNativeTree,
    resourceTable: () => resourceTable,
    sectionHeader: () => sectionHeader,
    selectKeys: () => selectKeys,
    setStatus: () => setStatus,
    status: () => status,
    tabs: () => tabs
  });

  // src/components/primitives.js
  var nextId = 0;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function button({ label, variant = "secondary", compact = false, disabled = false, onClick } = {}) {
    if (!label) throw new Error("Button requires a label.");
    const node = element("button", "ui-button", label);
    node.type = "button";
    if (!["secondary", "primary", "danger", "link"].includes(variant)) throw new Error("Invalid button variant.");
    if (variant !== "secondary") node.classList.add("ui-button--" + variant);
    if (compact) node.classList.add("ui-button--compact");
    node.disabled = disabled;
    let priorDisabled = disabled;
    node.setBusy = (busy) => {
      if (busy && node.getAttribute("aria-busy") !== "true") priorDisabled = node.disabled;
      node.setAttribute("aria-busy", String(busy));
      node.disabled = busy || priorDisabled;
      node.setAttribute("aria-label", busy ? label + " (\uCC98\uB9AC \uC911)" : label);
    };
    if (onClick) node.addEventListener("click", onClick);
    return node;
  }
  function fieldFor({ label, control, help = "" } = {}) {
    if (!label || !control || !["INPUT", "SELECT", "TEXTAREA"].includes(control.tagName)) throw new Error("Field requires a label and native control.");
    const id = control.id || "af-field-" + ++nextId;
    control.id = id;
    control.classList.add("af-input");
    const root = element("div", "af-field");
    const caption = element("label", "", label);
    caption.htmlFor = id;
    const descriptions = control.getAttribute("aria-describedby")?.split(/\s+/).filter(Boolean) || [];
    const hint = element("div", "af-muted", help);
    hint.id = id + "-help";
    hint.hidden = !help;
    const error = element("div", "ui-message ui-message--error");
    error.id = id + "-error";
    error.hidden = true;
    const describe = (message) => control.setAttribute("aria-describedby", [...descriptions, ...help ? [hint.id] : [], ...message ? [error.id] : []].join(" "));
    describe("");
    root.append(caption, control, hint, error);
    return {
      root,
      control,
      setError(message = "") {
        error.textContent = message;
        error.hidden = !message;
        control.setAttribute("aria-invalid", String(!!message));
        describe(message);
      }
    };
  }
  function status({ kind = "info", text } = {}) {
    if (!text || !["info", "success", "warning", "error", "loading", "empty", "permission"].includes(kind)) throw new Error("Status requires explicit kind and text.");
    const root = element("div");
    return setStatus(root, { kind, text });
  }
  function setStatus(root, { kind = "info", text = "" } = {}) {
    if (!root || !["info", "success", "warning", "error", "loading", "empty", "permission"].includes(kind)) throw new Error("Invalid status.");
    root.classList.add("af-status");
    root.textContent = text;
    root.hidden = !text;
    root.dataset.kind = kind;
    root.setAttribute("role", kind === "error" ? "alert" : "status");
    if (kind === "loading" && text) root.setAttribute("aria-busy", "true");
    else root.removeAttribute("aria-busy");
    return root;
  }
  function badge(text, kind = "neutral") {
    const node = element("span", "af-badge", text);
    node.dataset.kind = kind;
    return node;
  }
  function sectionHeader(title, action) {
    const node = element("header", "af-section-header");
    node.append(element("h2", "", title));
    if (action) node.append(action);
    return node;
  }

  // src/components/navigation.js
  var serial = 0;
  function bindTabs({ list, items, onChange = () => {
  }, initial = 0, notifyInitial = false }) {
    if (!list || !items.length) throw new Error("Tabs require a list and items.");
    const id = "af-tabs-" + ++serial, events = new AbortController();
    let selected = -1, disposed = false;
    list.setAttribute("role", "tablist");
    function select(index, focus = false, notify = true) {
      if (disposed || !Number.isInteger(index) || !items[index] || items[index].button.disabled) return;
      selected = index;
      items.forEach((item, i) => {
        item.button.setAttribute("aria-selected", String(i === index));
        item.button.tabIndex = i === index ? 0 : -1;
        item.button.classList.toggle("is-active", i === index);
        item.panel.hidden = i !== index;
      });
      if (focus) items[index].button.focus();
      if (notify) onChange(items[index].id);
    }
    items.forEach((item, index) => {
      const node = item.button, panel = item.panel;
      node.id ||= id + "-tab-" + index;
      panel.id ||= id + "-panel-" + index;
      node.setAttribute("role", "tab");
      node.setAttribute("aria-controls", panel.id);
      node.setAttribute("aria-selected", "false");
      node.tabIndex = -1;
      node.classList.remove("is-active");
      panel.hidden = true;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", node.id);
      panel.tabIndex = 0;
      node.addEventListener("click", () => select(index), { signal: events.signal });
      node.addEventListener("keydown", (event) => {
        const enabled = items.map((item2, i) => item2.button.disabled ? -1 : i).filter((i) => i >= 0);
        let target;
        if (event.key === "Home") target = enabled[0];
        if (event.key === "End") target = enabled.at(-1);
        if (event.key === "ArrowRight") target = enabled[(enabled.indexOf(index) + 1) % enabled.length];
        if (event.key === "ArrowLeft") target = enabled[(enabled.indexOf(index) - 1 + enabled.length) % enabled.length];
        if (target !== void 0) {
          event.preventDefault();
          select(target, true);
        }
      }, { signal: events.signal });
    });
    const first = Number.isInteger(initial) && items[initial] && !items[initial].button.disabled ? initial : items.findIndex((item) => !item.button.disabled);
    select(first, false, notifyInitial);
    return { select, get selected() {
      return items[selected]?.id;
    }, destroy() {
      disposed = true;
      events.abort();
    } };
  }
  function tabs({ label, items, onChange = () => {
  } }) {
    if (!label || !items.length) throw new Error("Tabs require a label and items.");
    const root = element("div", "af-stack"), list = element("div", "ui-tabs");
    list.setAttribute("aria-label", label);
    const bindings = items.map((item) => {
      const node = button({ label: item.label, disabled: item.disabled });
      node.className = "ui-tab";
      const panel = element("div", "af-tab-panel");
      if (item.content) panel.append(item.content);
      list.append(node);
      return { id: item.id, button: node, panel };
    });
    root.append(list, ...bindings.map((item) => item.panel));
    const binding = bindTabs({ list, items: bindings, onChange, notifyInitial: true });
    return { root, select: binding.select, destroy: binding.destroy, get selected() {
      return binding.selected;
    } };
  }

  // src/components/layouts.js
  function inline(...children) {
    const root = element("div", "af-inline");
    root.append(...children);
    return root;
  }
  function grid(...children) {
    const root = element("div", "af-grid");
    root.append(...children);
    return root;
  }
  function metadataList(entries) {
    const root = element("dl", "af-metadata");
    entries.forEach(([label, value]) => root.append(element("dt", "", label), element("dd", "", value)));
    return root;
  }
  function metadataGrid(entries) {
    const root = element("dl", "af-metadata-grid");
    entries.forEach(([label, value]) => {
      const item = element("div");
      item.append(element("dt", "", label), element("dd", "", value ?? "\u2014"));
      root.append(item);
    });
    return root;
  }

  // src/components/native-confirm.js
  var serial2 = 0;
  function createNativeConfirm(host, { title = "\uC791\uC5C5 \uD655\uC778", message, confirmLabel = "\uD655\uC778", destructive = false } = {}) {
    const root = element("dialog", "af-confirm af-kit");
    const heading = element("h2", "", title);
    heading.id = "af-confirm-" + ++serial2;
    const body = element("p", "", message);
    body.id = heading.id + "-message";
    root.setAttribute("aria-labelledby", heading.id);
    root.setAttribute("aria-describedby", body.id);
    let settle, opener, disposed = false;
    function finish(accepted) {
      const resolve = settle;
      settle = null;
      if (root.open) root.close();
      if (opener?.isConnected && !opener.disabled) opener.focus();
      resolve?.(accepted);
    }
    const cancel = button({ label: "\uCDE8\uC18C", onClick: () => finish(false) });
    cancel.autofocus = true;
    const accept = button({ label: confirmLabel, variant: destructive ? "danger" : "primary", onClick: () => finish(true) });
    const footer = element("footer", "af-inline");
    footer.append(cancel, accept);
    root.append(heading, body, footer);
    host.append(root);
    root.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    root.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      (document.activeElement === cancel ? accept : cancel).focus();
    });
    root.addEventListener("close", () => {
      if (!root.open) finish(false);
    });
    return {
      element: root,
      ask(trigger = document.activeElement) {
        if (disposed || settle) throw new Error("Confirmation unavailable.");
        opener = trigger;
        return new Promise((resolve, reject) => {
          settle = resolve;
          try {
            root.showModal();
          } catch (error) {
            settle = null;
            reject(error);
          }
        });
      },
      destroy() {
        disposed = true;
        finish(false);
        root.remove();
      }
    };
  }

  // generated/icons.js
  var icons = { "alert-triangle": '<!--\ntags: [warning, danger, caution, risk, alert, triangle, control, operation, function, interface]\ncategory: System\nversion: "1.0"\nunicode: "ea06"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 9v4" />\n  <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" />\n  <path d="M12 16h.01" />\n</svg>\n', "check": '<!--\ntags: [tick, "yes", confirm, check, control, operation, approve, function, interface, management]\ncategory: System\nversion: "1.0"\nunicode: "ea5e"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M5 12l5 5l10 -10" />\n</svg>\n', "chevron-down": '<!--\ntags: [move, next, swipe, bottom, chevron, down, decrease, navigation, flow, fall]\ncategory: Arrows\nversion: "1.0"\nunicode: "ea5f"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M6 9l6 6l6 -6" />\n</svg>\n', "chevron-right": '<!--\ntags: [move, checklist, next, chevron, right, navigation, flow, movement, route, path]\ncategory: Arrows\nversion: "1.0"\nunicode: "ea61"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M9 6l6 6l-6 6" />\n</svg>\n', "copy": '<!--\ntags: [clipboard, clone, duplicate, copy, typography, writing, font, character, word]\ncategory: Text\nversion: "1.0"\nunicode: "ea7a"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" />\n  <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />\n</svg>\n', "dots": '<!--\ntags: [hellip, more, ellipsis, dots, control, operation, function, interface, management]\ncategory: System\nversion: "1.0"\nunicode: "ea95"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />\n  <path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />\n  <path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />\n</svg>\n', "external-link": '<!--\ntags: [connection, outbound, redirect, new tab, tab, square, arrow, external, link, control]\ncategory: System\nversion: "1.0"\nunicode: "ea99"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />\n  <path d="M11 13l9 -9" />\n  <path d="M15 4h5v5" />\n</svg>\n', "history": '<!--\ntags: [search, see, past, card, website, history, control, operation, function, interface]\ncategory: System\nversion: "1.7"\nunicode: "ebea"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 8l0 4l2 2" />\n  <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />\n</svg>\n', "loader-2": '<!--\ntags: [process, download, upload, loader, loading, control, operation, function, interface, management]\ncategory: System\nversion: "1.72"\nunicode: "f226"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 3a9 9 0 1 0 9 9" />\n</svg>\n', "menu-2": '<!--\ntags: [bars, hamburger, navigation, burger, menu, control, operation, function, interface, management]\ncategory: System\nversion: "1.11"\nunicode: "ec42"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M4 6l16 0" />\n  <path d="M4 12l16 0" />\n  <path d="M4 18l16 0" />\n</svg>\n', "plus": '<!--\ntags: [add, create, new, "+", plus, calculation, equation, more, increase, positive]\ncategory: Math\nversion: "1.0"\nunicode: "eb0b"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 5l0 14" />\n  <path d="M5 12l14 0" />\n</svg>\n', "refresh": '<!--\ntags: [synchronization, reload, restart, spinner, loader, ajax, update, arrows, refresh, navigation]\ncategory: Arrows\nversion: "1.0"\nunicode: "eb13"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />\n  <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />\n</svg>\n', "search": '<!--\ncategory: System\ntags: [find, magnifier, magnifying glass, search, look, seek, query, browse]\nversion: "1.0"\nunicode: "eb1c"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />\n  <path d="M21 21l-6 -6" />\n</svg>\n', "settings": '<!--\ntags: [cog, edit, gear, preferences, tools, settings, config, options, control, operation]\ncategory: System\nversion: "1.0"\nunicode: "eb20"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" />\n  <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />\n</svg>\n', "trash": '<!--\ntags: [garbage, delete, remove, bin, ash-bin, uninstall, dustbin, trash, control, operation]\ncategory: System\nversion: "1.0"\nunicode: "eb41"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M4 7l16 0" />\n  <path d="M10 11l0 6" />\n  <path d="M14 11l0 6" />\n  <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />\n  <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />\n</svg>\n', "x": '<!--\ncategory: System\ntags: [cancel, remove, delete, empty, close, x]\nversion: "1.0"\nunicode: "eb55"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M18 6l-12 12" />\n  <path d="M6 6l12 12" />\n</svg>\n' };

  // src/components/icons.js
  var iconNames = Object.freeze(Object.keys(icons));
  function icon(name, { size = 16 } = {}) {
    if (!Object.hasOwn(icons, name)) throw new Error("Unknown icon: " + name);
    if (![14, 16, 24].includes(size)) throw new Error("Icon size must be 14, 16 or 24.");
    const parsed = new DOMParser().parseFromString(icons[name], "image/svg+xml");
    const svg = document.importNode(parsed.documentElement, true);
    svg.classList.add("af-icon");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    return svg;
  }
  function iconButton(name, label, onClick) {
    if (!label) throw new Error("Icon button requires an accessible label.");
    const button2 = document.createElement("button");
    button2.type = "button";
    button2.className = "ui-button ui-button--icon af-icon-button";
    button2.title = label;
    button2.setAttribute("aria-label", label);
    button2.append(icon(name));
    if (onClick) button2.addEventListener("click", onClick);
    return button2;
  }

  // src/components/menu-keyboard.js
  function menuKeyboard({ items, close }) {
    let prefix = "", lastTyped = 0;
    return (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      const enabled = items().filter((item) => !item.disabled && item.getAttribute("aria-disabled") !== "true" && !item.hidden);
      const index = enabled.indexOf(document.activeElement);
      const target = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : event.key === "ArrowDown" ? (index + 1) % enabled.length : event.key === "ArrowUp" ? (index - 1 + enabled.length) % enabled.length : null;
      if (target !== null) {
        event.preventDefault();
        enabled[target]?.focus();
      }
      if (event.key === "Tab") close(true);
      if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) {
        const now = performance.now();
        prefix = now - lastTyped > 600 ? event.key : prefix + event.key;
        lastTyped = now;
        enabled.find((item) => item.textContent.trim().toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()))?.focus();
      }
    };
  }

  // src/components/table.js
  function resourceTable({ headers, rows, emptyText = "\uD45C\uC2DC\uD560 \uD56D\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }) {
    const root = element("div", "af-table-scroll");
    const table = element("table", "af-table"), head = element("thead"), titles = element("tr");
    headers.forEach((label) => {
      const th = element("th", "", label);
      th.scope = "col";
      titles.append(th);
    });
    head.append(titles);
    table.append(head);
    const body = element("tbody");
    rows.forEach((cells) => {
      const row = element("tr");
      cells.forEach((value) => {
        const cell = element("td");
        cell.append(value instanceof Node ? value : document.createTextNode(String(value ?? "\u2014")));
        row.append(cell);
      });
      body.append(row);
    });
    if (!rows.length) {
      const row = element("tr"), cell = element("td", "", emptyText);
      cell.colSpan = Math.max(1, headers.length);
      row.append(cell);
      body.append(row);
    }
    table.append(body);
    root.append(table);
    return root;
  }

  // src/components/code-operation.js
  function bindCodeOperation({ root, header, label, control, help } = {}) {
    if (!root || !header || label?.tagName !== "LABEL" || !control?.id || !["INPUT", "TEXTAREA"].includes(control.tagName) || !root.contains(header) || !header.contains(label) || !root.contains(control) || help && !root.contains(help)) {
      throw new Error("Code operation requires an owned header, label and identified native control.");
    }
    root.classList.add("af-code-operation");
    header.classList.add("af-code-operation__header");
    control.classList.add("af-code-value");
    label.htmlFor = control.id;
    if (help) {
      help.classList.add("af-code-operation__help");
      help.id ||= control.id + "-help";
      const descriptions = new Set((control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
      descriptions.add(help.id);
      control.setAttribute("aria-describedby", [...descriptions].join(" "));
    }
    return { root, control };
  }

  // src/components/native-dialog.js
  function bindNativeDialog(element2) {
    if (element2?.tagName !== "DIALOG") throw new Error("Native dialog requires a dialog element.");
    element2.classList.add("af-dialog", "af-kit");
    let disposed = false;
    return {
      element: element2,
      open({ initialFocus } = {}) {
        if (disposed || !element2.isConnected) throw new Error("Dialog is unavailable.");
        if (!element2.getAttribute("aria-label") && !element2.getAttribute("aria-labelledby")) throw new Error("Dialog requires an accessible name.");
        if (initialFocus && !element2.contains(initialFocus)) throw new Error("Initial focus must belong to the dialog.");
        if (!element2.open) element2.showModal();
        initialFocus?.focus();
      },
      close(value = "") {
        if (element2.open) element2.close(value);
      },
      destroy() {
        if (element2.open) element2.close();
        disposed = true;
      }
    };
  }

  // src/components/resize-handle.js
  function bindResizeHandle(handle, { getValue, onChange, onDragging = () => {
  }, axis = "horizontal", step = 16 } = {}) {
    if (!handle || typeof getValue !== "function" || typeof onChange !== "function" || !["horizontal", "vertical"].includes(axis) || !Number.isFinite(step) || step <= 0) throw new Error("Invalid resize handle contract.");
    const coordinate = (event) => axis === "horizontal" ? event.clientX : event.clientY;
    let drag = null, disposed = false;
    const stop = () => {
      if (!drag) return;
      const pointerId = drag.id;
      drag = null;
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      handle.classList.remove("is-dragging");
      onDragging(false);
    };
    const down = (event) => {
      if (disposed || drag || event.button !== 0 || event.isPrimary === false) return;
      const value = getValue();
      if (!Number.isFinite(value)) return;
      handle.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, coordinate: coordinate(event), value };
      event.preventDefault();
      handle.classList.add("is-dragging");
      onDragging(true);
    };
    const move = (event) => {
      if (drag && event.pointerId === drag.id) onChange(drag.value + coordinate(event) - drag.coordinate);
    };
    const end = (event) => {
      if (drag && event.pointerId === drag.id) stop();
    };
    const keydown = (event) => {
      const keys = axis === "horizontal" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
      const direction = keys.indexOf(event.key);
      if (disposed || direction < 0 || event.defaultPrevented) return;
      const value = getValue();
      if (!Number.isFinite(value)) return;
      event.preventDefault();
      onChange(value + (direction === 0 ? -step : step));
    };
    const listeners = { pointerdown: down, pointermove: move, pointerup: end, pointercancel: end, lostpointercapture: end, keydown };
    for (const [type, listener] of Object.entries(listeners)) handle.addEventListener(type, listener);
    return { cancel: stop, destroy() {
      if (disposed) return;
      disposed = true;
      stop();
      for (const [type, listener] of Object.entries(listeners)) handle.removeEventListener(type, listener);
    } };
  }

  // src/components/tree-keyboard.js
  function bindTreeKeyboard(root, {
    items,
    isExpanded,
    onToggle,
    onActivate,
    onToggleSelection,
    onSelectAll,
    onContextMenu,
    onMove = () => {
    }
  }) {
    const keydown = (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      const rows = items(), index = rows.findIndex((row2) => row2.element === event.target);
      if (index < 0) return;
      const row = rows[index];
      let next;
      if (event.key === "ArrowDown") next = rows[index + 1];
      else if (event.key === "ArrowUp") next = rows[index - 1];
      else if (event.key === "Home") next = rows[0];
      else if (event.key === "End") next = rows.at(-1);
      else if (event.key === "ArrowRight" && row.folder) {
        if (!isExpanded(row)) onToggle(row);
        else if (rows[index + 1]?.parentKey === row.key) next = rows[index + 1];
      } else if (event.key === "ArrowLeft") {
        if (row.folder && isExpanded(row)) onToggle(row);
        else next = rows.find((item) => item.key === row.parentKey);
      } else if (event.key === "Enter") {
        if (row.folder) onToggle(row);
        else onActivate(row, event);
      } else if (event.key === " ") {
        if (row.folder) onToggle(row);
        else onToggleSelection(row, event);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") onSelectAll(rows, event);
      else if (event.key === "ContextMenu" || event.shiftKey && event.key === "F10") onContextMenu(row, event);
      else return;
      event.preventDefault();
      event.stopPropagation();
      if (next) {
        next.element.focus();
        onMove(next, event);
      }
    };
    root.addEventListener("keydown", keydown);
    return { destroy() {
      root.removeEventListener("keydown", keydown);
    } };
  }

  // src/components/native-tree.js
  function renderNativeTree(root, { entries, childrenOf, isExpanded, renderRow, groupClass = "", focusKey } = {}) {
    if (!root || !Array.isArray(entries) || ![childrenOf, isExpanded, renderRow].every((fn) => typeof fn === "function")) throw new Error("Invalid native tree renderer.");
    const oldFocus = focusKey ?? root.querySelector(":focus")?.dataset.key;
    const fragment = document.createDocumentFragment(), rows = [], keys = /* @__PURE__ */ new Set();
    const walk = (entries2, container, level, parentKey) => entries2.forEach((entry, index) => {
      if (!entry.key || keys.has(entry.key)) throw new Error("Tree keys must be nonempty and unique.");
      keys.add(entry.key);
      const expanded = !!entry.folder && !!isExpanded(entry);
      const element2 = renderRow(entry, { level, expanded });
      element2.setAttribute("role", "treeitem");
      element2.tabIndex = -1;
      element2.dataset.key = entry.key;
      element2.setAttribute("aria-level", String(level));
      element2.setAttribute("aria-posinset", String(index + 1));
      element2.setAttribute("aria-setsize", String(entries2.length));
      if (entry.folder) element2.setAttribute("aria-expanded", String(expanded));
      const row = { ...entry, element: element2, parentKey };
      rows.push(row);
      container.append(element2);
      element2.addEventListener("focus", () => rows.forEach((item) => {
        item.element.tabIndex = item === row ? 0 : -1;
      }));
      if (expanded) {
        const group = document.createElement("div");
        group.className = groupClass;
        group.setAttribute("role", "group");
        for (const type of ["click", "dblclick", "contextmenu"]) group.addEventListener(type, (event) => event.stopPropagation());
        element2.append(group);
        walk(childrenOf(entry), group, level + 1, entry.key);
      }
    });
    walk(entries, fragment, 1, null);
    root.setAttribute("role", "tree");
    root.replaceChildren(fragment);
    rows.find((row) => row.key === oldFocus)?.element.focus();
    if (rows.length && !rows.some((row) => row.element.tabIndex === 0)) rows[0].element.tabIndex = 0;
    return rows;
  }

  // src/components/selection.js
  function selectKeys({ keys, selected = /* @__PURE__ */ new Set(), anchor = null, key, range = false, toggle = false }) {
    if (!keys.includes(key)) return { selected: new Set(selected), anchor };
    if (range) {
      const start = keys.indexOf(anchor), end = keys.indexOf(key);
      if (start < 0) return { selected: /* @__PURE__ */ new Set([key]), anchor: key };
      return { selected: new Set(keys.slice(Math.min(start, end), Math.max(start, end) + 1)), anchor };
    }
    if (toggle) {
      const next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { selected: next, anchor: key };
    }
    return { selected: /* @__PURE__ */ new Set([key]), anchor: key };
  }

  // generated/material-icons.js
  var materialIcons = { "file": '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="m8.668 6h3.6641l-3.6641-3.668v3.668m-4.668-4.668h5.332l4 4v8c0 0.73828-0.59375 1.3359-1.332 1.3359h-8c-0.73828 0-1.332-0.59766-1.332-1.3359v-10.664c0-0.74219 0.59375-1.3359 1.332-1.3359m3.332 1.3359h-3.332v10.664h8v-6h-4.668z" fill="#90a4ae" /></svg>', "readme": '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16"><path d="M0 0h24v24H0z"/><path fill="#42a5f5" d="M8 1C4.136 1 1 4.136 1 8s3.136 7 7 7 7-3.136 7-7-3.136-7-7-7m1 11H7V7.5h2zm0-6H7V4h2z"/></svg>', "markdown": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#42a5f5" d="m14 10-4 3.5L6 10H4v12h4v-6l2 2 2-2v6h4V10zm12 6v-6h-4v6h-4l6 8 6-8z"/></svg>', "javascript": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#ffca28" d="M2 2v12h12V2zm6 6h1v4a1.003 1.003 0 0 1-1 1H7a1.003 1.003 0 0 1-1-1v-1h1v1h1zm3 0h2v1h-2v1h1a1.003 1.003 0 0 1 1 1v1a1.003 1.003 0 0 1-1 1h-2v-1h2v-1h-1a1.003 1.003 0 0 1-1-1V9a1.003 1.003 0 0 1 1-1"/></svg>', "typescript": '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 16 16"><path fill="#0288d1" d="M2 2v12h12V2zm4 6h3v1H8v4H7V9H6zm5 0h2v1h-2v1h1a1.003 1.003 0 0 1 1 1v1a1.003 1.003 0 0 1-1 1h-2v-1h2v-1h-1a1.003 1.003 0 0 1-1-1V9a1.003 1.003 0 0 1 1-1"/></svg>', "json": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path fill="#f9a825" d="M560-160v-80h120q17 0 28.5-11.5T720-280v-80q0-38 22-69t58-44v-14q-36-13-58-44t-22-69v-80q0-17-11.5-28.5T680-720H560v-80h120q50 0 85 35t35 85v80q0 17 11.5 28.5T840-560h40v160h-40q-17 0-28.5 11.5T800-360v80q0 50-35 85t-85 35zm-280 0q-50 0-85-35t-35-85v-80q0-17-11.5-28.5T120-400H80v-160h40q17 0 28.5-11.5T160-600v-80q0-50 35-85t85-35h120v80H280q-17 0-28.5 11.5T240-680v80q0 38-22 69t-58 44v14q36 13 58 44t22 69v80q0 17 11.5 28.5T280-240h120v80z"/></svg>', "python": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#0288d1" d="M9.86 2A2.86 2.86 0 0 0 7 4.86v1.68h4.29c.39 0 .71.57.71.96H4.86A2.86 2.86 0 0 0 2 10.36v3.781a2.86 2.86 0 0 0 2.86 2.86h1.18v-2.68a2.85 2.85 0 0 1 2.85-2.86h5.25c1.58 0 2.86-1.271 2.86-2.851V4.86A2.86 2.86 0 0 0 14.14 2zm-.72 1.61c.4 0 .72.12.72.71s-.32.891-.72.891c-.39 0-.71-.3-.71-.89s.32-.711.71-.711"/><path fill="#fdd835" d="M17.959 7v2.68a2.85 2.85 0 0 1-2.85 2.859H9.86A2.85 2.85 0 0 0 7 15.389v3.75a2.86 2.86 0 0 0 2.86 2.86h4.28A2.86 2.86 0 0 0 17 19.14v-1.68h-4.291c-.39 0-.709-.57-.709-.96h7.14A2.86 2.86 0 0 0 22 13.64V9.86A2.86 2.86 0 0 0 19.14 7zM8.32 11.513l-.004.004.038-.004zm6.54 7.276c.39 0 .71.3.71.89a.71.71 0 0 1-.71.71c-.4 0-.72-.12-.72-.71s.32-.89.72-.89"/></svg>', "html": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#e65100" d="m4 4 2 22 10 2 10-2 2-22Zm19.72 7H11.28l.29 3h11.86l-.802 9.335L15.99 25l-6.635-1.646L8.93 19h3.02l.19 2 3.86.77 3.84-.77.29-4H8.84L8 8h16Z"/></svg>', "css": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#7e57c2" d="M20 18h-2v-2h-2v2c0 .193 0 .703 1.254 1.033A3.345 3.345 0 0 1 20 22h2v2h2v-2c0-.388-.562-.851-1.254-1.034C20.356 20.34 20 18.84 20 18m-3.254 2.966C14.356 20.34 14 18.84 14 18h-2v-2h-2v8h2v-2h4v2h2v-2c0-.388-.562-.851-1.254-1.034"/><path fill="#7e57c2" d="M24 4H4v20a4 4 0 0 0 4 4h16.16A3.84 3.84 0 0 0 28 24.16V8a4 4 0 0 0-4-4m2 14h-2v-2h-2v2c0 .193 0 .703 1.254 1.033A3.345 3.345 0 0 1 26 22v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2 2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2 2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 2 2 0 0 1 2-2h2a2 2 0 0 1 2 2Z"/></svg>', "yaml": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ff5252" d="M13 9h5.5L13 3.5zM6 2h8l6 6v12c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2m12 16v-2H9v2zm-4-4v-2H6v2z"/></svg>', "pdf": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ef5350" d="M13 9h5.5L13 3.5zM6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m4.93 10.44c.41.9.93 1.64 1.53 2.15l.41.32c-.87.16-2.07.44-3.34.93l-.11.04.5-1.04c.45-.87.78-1.66 1.01-2.4m6.48 3.81c.18-.18.27-.41.28-.66.03-.2-.02-.39-.12-.55-.29-.47-1.04-.69-2.28-.69l-1.29.07-.87-.58c-.63-.52-1.2-1.43-1.6-2.56l.04-.14c.33-1.33.64-2.94-.02-3.6a.85.85 0 0 0-.61-.24h-.24c-.37 0-.7.39-.79.77-.37 1.33-.15 2.06.22 3.27v.01c-.25.88-.57 1.9-1.08 2.93l-.96 1.8-.89.49c-1.2.75-1.77 1.59-1.88 2.12-.04.19-.02.36.05.54l.03.05.48.31.44.11c.81 0 1.73-.95 2.97-3.07l.18-.07c1.03-.33 2.31-.56 4.03-.75 1.03.51 2.24.74 3 .74.44 0 .74-.11.91-.3m-.41-.71.09.11c-.01.1-.04.11-.09.13h-.04l-.19.02c-.46 0-1.17-.19-1.9-.51.09-.1.13-.1.23-.1 1.4 0 1.8.25 1.9.35M7.83 17c-.65 1.19-1.24 1.85-1.69 2 .05-.38.5-1.04 1.21-1.69zm3.02-6.91c-.23-.9-.24-1.63-.07-2.05l.07-.12.15.05c.17.24.19.56.09 1.1l-.03.16-.16.82z"/></svg>', "image": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#26a69a" d="M8.5 6h4l-4-4zM3.875 1H9.5l4 4v8.6c0 .773-.616 1.4-1.375 1.4h-8.25c-.76 0-1.375-.627-1.375-1.4V2.4c0-.777.612-1.4 1.375-1.4M4 13.6h8V8l-2.625 2.8L8 9.4zm1.25-7.7c-.76 0-1.375.627-1.375 1.4s.616 1.4 1.375 1.4c.76 0 1.375-.627 1.375-1.4S6.009 5.9 5.25 5.9"/></svg>', "folder": '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="m6.922 3.768-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232" fill="#90a4ae" /></svg>', "folder-open": '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M14.483 6H4.721a1 1 0 0 0-.949.684L2 12V5h12a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232l-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11l2.403-5.606A1 1 0 0 0 14.483 6" fill="#90a4ae" /></svg>', "folder-test": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#00bfa5" d="m6.922 3.768-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232"/><path id="motive" fill="#a7ffeb" d="M8 6v1h1v6a2 2 0 0 0 4 0V7h1V6Zm2.5 7a.5.5 0 1 1 .5-.5.5.5 0 0 1-.5.5m1-2a.5.5 0 1 1 .5-.5.5.5 0 0 1-.5.5m.5-2h-2V7h2z"/></svg>', "folder-test-open": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#00bfa5" d="M14.483 6H4.721a1 1 0 0 0-.949.684L2 12V5h12a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232l-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11l2.403-5.606A1 1 0 0 0 14.483 6"/><path id="motive" fill="#a7ffeb" d="M8 6v1h1v6a2 2 0 0 0 4 0V7h1V6Zm2.5 7a.5.5 0 1 1 .5-.5.5.5 0 0 1-.5.5m1-2a.5.5 0 1 1 .5-.5.5.5 0 0 1-.5.5m.5-2h-2V7h2z"/></svg>', "folder-benchmark": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#1e88e5" d="m6.922 3.768-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232"/><path id="motive" fill="#bbdefb" d="M10 6a4.995 4.995 0 0 0-3.995 8H7.36A3.997 3.997 0 0 1 10 7a4 4 0 0 1 .846.09c.365-.22.754-.45 1.14-.676A4.9 4.9 0 0 0 10 6m4.242.758S9.366 8.804 8.585 9.586a2 2 0 0 0 2.829 2.828c.781-.78 2.828-5.656 2.828-5.656m.318 2.203c-.205.365-.43.759-.66 1.164A4 4 0 0 1 14 11a4 4 0 0 1-1.36 3h1.354A4.97 4.97 0 0 0 15 11a4.9 4.9 0 0 0-.44-2.04"/></svg>', "folder-benchmark-open": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#1e88e5" d="M14.483 6H4.721a1 1 0 0 0-.949.684L2 12V5h12a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232l-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11l2.403-5.606A1 1 0 0 0 14.483 6"/><path id="motive" fill="#bbdefb" d="M10 6a4.995 4.995 0 0 0-3.995 8H7.36A3.997 3.997 0 0 1 10 7a4 4 0 0 1 .846.09c.365-.22.754-.45 1.14-.676A4.9 4.9 0 0 0 10 6m4.242.758S9.366 8.804 8.585 9.586a2 2 0 0 0 2.829 2.828c.781-.78 2.828-5.656 2.828-5.656m.318 2.203c-.205.365-.43.759-.66 1.164A4 4 0 0 1 14 11a4 4 0 0 1-1.36 3h1.354A4.97 4.97 0 0 0 15 11a4.9 4.9 0 0 0-.44-2.04"/></svg>', "folder-contract": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#448aff" d="m6.922 3.768-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232"/><path id="motive" fill="#bbdefb" d="M12.188 10.188a.476.475 0 0 0-.022.672l.022.022a.49.49 0 0 0 .694 0 2.445 2.445 0 0 0 0-3.456l-1.73-1.73A2.444 2.444 0 0 0 7.695 9.15l.728.73a3.4 3.4 0 0 1 .196-1.184l-.23-.235a1.46 1.46 0 0 1-.01-2.06l.01-.012a1.46 1.46 0 0 1 2.062-.01l.01.01 1.727 1.725a1.46 1.46 0 0 1 .011 2.062zm-1.379-2.073a.49.49 0 0 0-.694 0 2.445 2.445 0 0 0 0 3.456l1.731 1.731a2.444 2.444 0 0 0 3.46-3.451l-.004-.005-.728-.729a3.4 3.4 0 0 1-.196 1.188l.23.23a1.46 1.46 0 0 1 .012 2.06l-.012.013a1.46 1.46 0 0 1-2.062.011l-.011-.01-1.726-1.727a1.46 1.46 0 0 1-.011-2.061l.011-.011a.476.475 0 0 0 .022-.673z"/></svg>', "folder-contract-open": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#448aff" d="M14.483 6H4.721a1 1 0 0 0-.949.684L2 12V5h12a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232l-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11l2.403-5.606A1 1 0 0 0 14.483 6"/><path id="motive" fill="#bbdefb" d="M12.188 10.188a.476.475 0 0 0-.022.672l.022.022a.49.49 0 0 0 .694 0 2.445 2.445 0 0 0 0-3.456l-1.73-1.73A2.444 2.444 0 0 0 7.695 9.15l.728.73a3.4 3.4 0 0 1 .196-1.184l-.23-.235a1.46 1.46 0 0 1-.01-2.06l.01-.012a1.46 1.46 0 0 1 2.062-.01l.01.01 1.727 1.725a1.46 1.46 0 0 1 .011 2.062zm-1.379-2.073a.49.49 0 0 0-.694 0 2.445 2.445 0 0 0 0 3.456l1.731 1.731a2.444 2.444 0 0 0 3.46-3.451l-.004-.005-.728-.729a3.4 3.4 0 0 1-.196 1.188l.23.23a1.46 1.46 0 0 1 .012 2.06l-.012.013a1.46 1.46 0 0 1-2.062.011l-.011-.01-1.726-1.727a1.46 1.46 0 0 1-.011-2.061l.011-.011a.476.475 0 0 0 .022-.673z"/></svg>', "folder-connection": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#00acc1" d="m6.922 3.768-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232"/><path id="motive" fill="#b2ebf2" d="M15.434 7.91a.905.905 0 0 1 .032 1.283q-.015.017-.032.033l-1.321 1.314-3.679-3.662 1.321-1.315a.915.915 0 0 1 1.288-.031q.017.015.032.032l.85.845L15.338 5l.661.657-1.415 1.409Zm-2.735 2.723-.662-.657-1.32 1.315-.99-.987 1.32-1.314-.66-.658-1.321 1.315-.708-.657-1.32 1.314a.905.905 0 0 0-.032 1.283l.032.032.849.845L6 14.341l.661.659 1.887-1.878.848.845a.915.915 0 0 0 1.29.032l.031-.033 1.32-1.313-.66-.658z"/></svg>', "folder-connection-open": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#00acc1" d="M14.483 6H4.721a1 1 0 0 0-.949.684L2 12V5h12a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232l-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11l2.403-5.606A1 1 0 0 0 14.483 6"/><path id="motive" fill="#b2ebf2" d="M15.434 7.91a.905.905 0 0 1 .032 1.283q-.015.017-.032.033l-1.321 1.314-3.679-3.662 1.321-1.315a.915.915 0 0 1 1.288-.031q.017.015.032.032l.85.845L15.338 5l.661.657-1.415 1.409Zm-2.735 2.723-.662-.657-1.32 1.315-.99-.987 1.32-1.314-.66-.658-1.321 1.315-.708-.657-1.32 1.314a.905.905 0 0 0-.032 1.283l.032.032.849.845L6 14.341l.661.659 1.887-1.878.848.845a.915.915 0 0 0 1.29.032l.031-.033 1.32-1.313-.66-.658z"/></svg>', "folder-docs": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#0277bd" d="m6.922 3.768-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232"/><path id="motive" fill="#b3e5fc" d="M12 5H8.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V8Zm0 8H9v-1h3zm2-2H9v-1h5zm-2.414-2.586V6L14 8.414Z"/></svg>', "folder-docs-open": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#0277bd" d="M14.483 6H4.721a1 1 0 0 0-.949.684L2 12V5h12a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232l-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11l2.403-5.606A1 1 0 0 0 14.483 6"/><path id="motive" fill="#b3e5fc" d="M12 5H8.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V8Zm0 8H9v-1h3zm2-2H9v-1h5zm-2.414-2.586V6L14 8.414Z"/></svg>', "folder-src": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#4caf50" d="m6.922 3.768-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232"/><path id="motive" fill="#c8e6c9" d="M9.225 15a.5.5 0 0 1-.12-.014.57.568 0 0 1-.414-.661l1.549-7.872a.566.565 0 0 1 .254-.372.53.53 0 0 1 .4-.067.57.57 0 0 1 .415.662l-1.552 7.872a.56.56 0 0 1-.253.371.53.53 0 0 1-.28.081m3.105-1h-.038a.54.54 0 0 1-.382-.206.583.582 0 0 1 .057-.774l2.664-2.483-2.653-2.312a.583.582 0 0 1-.08-.772.54.54 0 0 1 .377-.218.53.53 0 0 1 .406.129l3.126 2.727a.579.578 0 0 1 .002.862l-3.114 2.904a.536.535 0 0 1-.365.144zm-4.661 0a.536.535 0 0 1-.365-.146L4.186 10.95a.58.58 0 0 1-.005-.846l.01-.01 3.128-2.726a.516.515 0 0 1 .4-.13.54.54 0 0 1 .38.218.583.582 0 0 1-.08.773l-2.65 2.31 2.663 2.482a.579.578 0 0 1 .056.774.536.535 0 0 1-.381.206z"/></svg>', "folder-src-open": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="folder" fill="#4caf50" d="M14.483 6H4.721a1 1 0 0 0-.949.684L2 12V5h12a1 1 0 0 0-1-1H7.562a1 1 0 0 1-.64-.232l-.644-.536A1 1 0 0 0 5.638 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11l2.403-5.606A1 1 0 0 0 14.483 6"/><path id="motive" fill="#c8e6c9" d="M9.225 15a.5.5 0 0 1-.12-.014.57.568 0 0 1-.414-.661l1.549-7.872a.566.565 0 0 1 .254-.372.53.53 0 0 1 .4-.067.57.57 0 0 1 .415.662l-1.552 7.872a.56.56 0 0 1-.253.371.53.53 0 0 1-.28.081m3.105-1h-.038a.54.54 0 0 1-.382-.206.583.582 0 0 1 .057-.774l2.664-2.483-2.653-2.312a.583.582 0 0 1-.08-.772.54.54 0 0 1 .377-.218.53.53 0 0 1 .406.129l3.126 2.727a.579.578 0 0 1 .002.862l-3.114 2.904a.536.535 0 0 1-.365.144zm-4.661 0a.536.535 0 0 1-.365-.146L4.186 10.95a.58.58 0 0 1-.005-.846l.01-.01 3.128-2.726a.516.515 0 0 1 .4-.13.54.54 0 0 1 .38.218.583.582 0 0 1-.08.773l-2.65 2.31 2.663 2.482a.579.578 0 0 1 .056.774.536.535 0 0 1-.381.206z"/></svg>' };
  var materialMappings = { "folderNames": { "src": "folder-src", ".src": "folder-src", "_src": "folder-src", "-src": "folder-src", "__src__": "folder-src", "srcs": "folder-src", ".srcs": "folder-src", "_srcs": "folder-src", "-srcs": "folder-src", "__srcs__": "folder-src", "source": "folder-src", ".source": "folder-src", "_source": "folder-src", "-source": "folder-src", "__source__": "folder-src", "sources": "folder-src", ".sources": "folder-src", "_sources": "folder-src", "-sources": "folder-src", "__sources__": "folder-src", "code": "folder-src", ".code": "folder-src", "_code": "folder-src", "-code": "folder-src", "__code__": "folder-src", "test": "folder-test", ".test": "folder-test", "_test": "folder-test", "-test": "folder-test", "__test__": "folder-test", "tests": "folder-test", ".tests": "folder-test", "_tests": "folder-test", "-tests": "folder-test", "__tests__": "folder-test", "testing": "folder-test", ".testing": "folder-test", "_testing": "folder-test", "-testing": "folder-test", "__testing__": "folder-test", "snapshots": "folder-test", ".snapshots": "folder-test", "_snapshots": "folder-test", "-snapshots": "folder-test", "__snapshots__": "folder-test", "spec": "folder-test", ".spec": "folder-test", "_spec": "folder-test", "-spec": "folder-test", "__spec__": "folder-test", "specs": "folder-test", ".specs": "folder-test", "_specs": "folder-test", "-specs": "folder-test", "__specs__": "folder-test", "testfiles": "folder-test", ".testfiles": "folder-test", "_testfiles": "folder-test", "-testfiles": "folder-test", "__testfiles__": "folder-test", "doc": "folder-docs", ".doc": "folder-docs", "_doc": "folder-docs", "-doc": "folder-docs", "__doc__": "folder-docs", "docs": "folder-docs", ".docs": "folder-docs", "_docs": "folder-docs", "-docs": "folder-docs", "__docs__": "folder-docs", "document": "folder-docs", ".document": "folder-docs", "_document": "folder-docs", "-document": "folder-docs", "__document__": "folder-docs", "documents": "folder-docs", ".documents": "folder-docs", "_documents": "folder-docs", "-documents": "folder-docs", "__documents__": "folder-docs", "documentation": "folder-docs", ".documentation": "folder-docs", "_documentation": "folder-docs", "-documentation": "folder-docs", "__documentation__": "folder-docs", "post": "folder-docs", ".post": "folder-docs", "_post": "folder-docs", "-post": "folder-docs", "__post__": "folder-docs", "posts": "folder-docs", ".posts": "folder-docs", "_posts": "folder-docs", "-posts": "folder-docs", "__posts__": "folder-docs", "article": "folder-docs", ".article": "folder-docs", "_article": "folder-docs", "-article": "folder-docs", "__article__": "folder-docs", "articles": "folder-docs", ".articles": "folder-docs", "_articles": "folder-docs", "-articles": "folder-docs", "__articles__": "folder-docs", "wiki": "folder-docs", ".wiki": "folder-docs", "_wiki": "folder-docs", "-wiki": "folder-docs", "__wiki__": "folder-docs", "news": "folder-docs", ".news": "folder-docs", "_news": "folder-docs", "-news": "folder-docs", "__news__": "folder-docs", "blog": "folder-docs", ".blog": "folder-docs", "_blog": "folder-docs", "-blog": "folder-docs", "__blog__": "folder-docs", "knowledge": "folder-docs", ".knowledge": "folder-docs", "_knowledge": "folder-docs", "-knowledge": "folder-docs", "__knowledge__": "folder-docs", "diary": "folder-docs", ".diary": "folder-docs", "_diary": "folder-docs", "-diary": "folder-docs", "__diary__": "folder-docs", "note": "folder-docs", ".note": "folder-docs", "_note": "folder-docs", "-note": "folder-docs", "__note__": "folder-docs", "notes": "folder-docs", ".notes": "folder-docs", "_notes": "folder-docs", "-notes": "folder-docs", "__notes__": "folder-docs", "benchmark": "folder-benchmark", ".benchmark": "folder-benchmark", "_benchmark": "folder-benchmark", "-benchmark": "folder-benchmark", "__benchmark__": "folder-benchmark", "benchmarks": "folder-benchmark", ".benchmarks": "folder-benchmark", "_benchmarks": "folder-benchmark", "-benchmarks": "folder-benchmark", "__benchmarks__": "folder-benchmark", "bench": "folder-benchmark", ".bench": "folder-benchmark", "_bench": "folder-benchmark", "-bench": "folder-benchmark", "__bench__": "folder-benchmark", "benches": "folder-benchmark", ".benches": "folder-benchmark", "_benches": "folder-benchmark", "-benches": "folder-benchmark", "__benches__": "folder-benchmark", "performance": "folder-benchmark", ".performance": "folder-benchmark", "_performance": "folder-benchmark", "-performance": "folder-benchmark", "__performance__": "folder-benchmark", "perf": "folder-benchmark", ".perf": "folder-benchmark", "_perf": "folder-benchmark", "-perf": "folder-benchmark", "__perf__": "folder-benchmark", "profiling": "folder-benchmark", ".profiling": "folder-benchmark", "_profiling": "folder-benchmark", "-profiling": "folder-benchmark", "__profiling__": "folder-benchmark", "measure": "folder-benchmark", ".measure": "folder-benchmark", "_measure": "folder-benchmark", "-measure": "folder-benchmark", "__measure__": "folder-benchmark", "measures": "folder-benchmark", ".measures": "folder-benchmark", "_measures": "folder-benchmark", "-measures": "folder-benchmark", "__measures__": "folder-benchmark", "measurement": "folder-benchmark", ".measurement": "folder-benchmark", "_measurement": "folder-benchmark", "-measurement": "folder-benchmark", "__measurement__": "folder-benchmark", "connection": "folder-connection", ".connection": "folder-connection", "_connection": "folder-connection", "-connection": "folder-connection", "__connection__": "folder-connection", "connections": "folder-connection", ".connections": "folder-connection", "_connections": "folder-connection", "-connections": "folder-connection", "__connections__": "folder-connection", "integration": "folder-connection", ".integration": "folder-connection", "_integration": "folder-connection", "-integration": "folder-connection", "__integration__": "folder-connection", "integrations": "folder-connection", ".integrations": "folder-connection", "_integrations": "folder-connection", "-integrations": "folder-connection", "__integrations__": "folder-connection", "remote": "folder-connection", ".remote": "folder-connection", "_remote": "folder-connection", "-remote": "folder-connection", "__remote__": "folder-connection", "remotes": "folder-connection", ".remotes": "folder-connection", "_remotes": "folder-connection", "-remotes": "folder-connection", "__remotes__": "folder-connection", "pact": "folder-contract", ".pact": "folder-contract", "_pact": "folder-contract", "-pact": "folder-contract", "__pact__": "folder-contract", "pacts": "folder-contract", ".pacts": "folder-contract", "_pacts": "folder-contract", "-pacts": "folder-contract", "__pacts__": "folder-contract", "contract": "folder-contract", ".contract": "folder-contract", "_contract": "folder-contract", "-contract": "folder-contract", "__contract__": "folder-contract", "contracts": "folder-contract", ".contracts": "folder-contract", "_contracts": "folder-contract", "-contracts": "folder-contract", "__contracts__": "folder-contract", "contract-testing": "folder-contract", ".contract-testing": "folder-contract", "_contract-testing": "folder-contract", "-contract-testing": "folder-contract", "__contract-testing__": "folder-contract", "contract-test": "folder-contract", ".contract-test": "folder-contract", "_contract-test": "folder-contract", "-contract-test": "folder-contract", "__contract-test__": "folder-contract", "contract-tests": "folder-contract", ".contract-tests": "folder-contract", "_contract-tests": "folder-contract", "-contract-tests": "folder-contract", "__contract-tests__": "folder-contract" }, "folderNamesExpanded": { "src": "folder-src-open", ".src": "folder-src-open", "_src": "folder-src-open", "-src": "folder-src-open", "__src__": "folder-src-open", "srcs": "folder-src-open", ".srcs": "folder-src-open", "_srcs": "folder-src-open", "-srcs": "folder-src-open", "__srcs__": "folder-src-open", "source": "folder-src-open", ".source": "folder-src-open", "_source": "folder-src-open", "-source": "folder-src-open", "__source__": "folder-src-open", "sources": "folder-src-open", ".sources": "folder-src-open", "_sources": "folder-src-open", "-sources": "folder-src-open", "__sources__": "folder-src-open", "code": "folder-src-open", ".code": "folder-src-open", "_code": "folder-src-open", "-code": "folder-src-open", "__code__": "folder-src-open", "test": "folder-test-open", ".test": "folder-test-open", "_test": "folder-test-open", "-test": "folder-test-open", "__test__": "folder-test-open", "tests": "folder-test-open", ".tests": "folder-test-open", "_tests": "folder-test-open", "-tests": "folder-test-open", "__tests__": "folder-test-open", "testing": "folder-test-open", ".testing": "folder-test-open", "_testing": "folder-test-open", "-testing": "folder-test-open", "__testing__": "folder-test-open", "snapshots": "folder-test-open", ".snapshots": "folder-test-open", "_snapshots": "folder-test-open", "-snapshots": "folder-test-open", "__snapshots__": "folder-test-open", "spec": "folder-test-open", ".spec": "folder-test-open", "_spec": "folder-test-open", "-spec": "folder-test-open", "__spec__": "folder-test-open", "specs": "folder-test-open", ".specs": "folder-test-open", "_specs": "folder-test-open", "-specs": "folder-test-open", "__specs__": "folder-test-open", "testfiles": "folder-test-open", ".testfiles": "folder-test-open", "_testfiles": "folder-test-open", "-testfiles": "folder-test-open", "__testfiles__": "folder-test-open", "doc": "folder-docs-open", ".doc": "folder-docs-open", "_doc": "folder-docs-open", "-doc": "folder-docs-open", "__doc__": "folder-docs-open", "docs": "folder-docs-open", ".docs": "folder-docs-open", "_docs": "folder-docs-open", "-docs": "folder-docs-open", "__docs__": "folder-docs-open", "document": "folder-docs-open", ".document": "folder-docs-open", "_document": "folder-docs-open", "-document": "folder-docs-open", "__document__": "folder-docs-open", "documents": "folder-docs-open", ".documents": "folder-docs-open", "_documents": "folder-docs-open", "-documents": "folder-docs-open", "__documents__": "folder-docs-open", "documentation": "folder-docs-open", ".documentation": "folder-docs-open", "_documentation": "folder-docs-open", "-documentation": "folder-docs-open", "__documentation__": "folder-docs-open", "post": "folder-docs-open", ".post": "folder-docs-open", "_post": "folder-docs-open", "-post": "folder-docs-open", "__post__": "folder-docs-open", "posts": "folder-docs-open", ".posts": "folder-docs-open", "_posts": "folder-docs-open", "-posts": "folder-docs-open", "__posts__": "folder-docs-open", "article": "folder-docs-open", ".article": "folder-docs-open", "_article": "folder-docs-open", "-article": "folder-docs-open", "__article__": "folder-docs-open", "articles": "folder-docs-open", ".articles": "folder-docs-open", "_articles": "folder-docs-open", "-articles": "folder-docs-open", "__articles__": "folder-docs-open", "wiki": "folder-docs-open", ".wiki": "folder-docs-open", "_wiki": "folder-docs-open", "-wiki": "folder-docs-open", "__wiki__": "folder-docs-open", "news": "folder-docs-open", ".news": "folder-docs-open", "_news": "folder-docs-open", "-news": "folder-docs-open", "__news__": "folder-docs-open", "blog": "folder-docs-open", ".blog": "folder-docs-open", "_blog": "folder-docs-open", "-blog": "folder-docs-open", "__blog__": "folder-docs-open", "knowledge": "folder-docs-open", ".knowledge": "folder-docs-open", "_knowledge": "folder-docs-open", "-knowledge": "folder-docs-open", "__knowledge__": "folder-docs-open", "diary": "folder-docs-open", ".diary": "folder-docs-open", "_diary": "folder-docs-open", "-diary": "folder-docs-open", "__diary__": "folder-docs-open", "note": "folder-docs-open", ".note": "folder-docs-open", "_note": "folder-docs-open", "-note": "folder-docs-open", "__note__": "folder-docs-open", "notes": "folder-docs-open", ".notes": "folder-docs-open", "_notes": "folder-docs-open", "-notes": "folder-docs-open", "__notes__": "folder-docs-open", "benchmark": "folder-benchmark-open", ".benchmark": "folder-benchmark-open", "_benchmark": "folder-benchmark-open", "-benchmark": "folder-benchmark-open", "__benchmark__": "folder-benchmark-open", "benchmarks": "folder-benchmark-open", ".benchmarks": "folder-benchmark-open", "_benchmarks": "folder-benchmark-open", "-benchmarks": "folder-benchmark-open", "__benchmarks__": "folder-benchmark-open", "bench": "folder-benchmark-open", ".bench": "folder-benchmark-open", "_bench": "folder-benchmark-open", "-bench": "folder-benchmark-open", "__bench__": "folder-benchmark-open", "benches": "folder-benchmark-open", ".benches": "folder-benchmark-open", "_benches": "folder-benchmark-open", "-benches": "folder-benchmark-open", "__benches__": "folder-benchmark-open", "performance": "folder-benchmark-open", ".performance": "folder-benchmark-open", "_performance": "folder-benchmark-open", "-performance": "folder-benchmark-open", "__performance__": "folder-benchmark-open", "perf": "folder-benchmark-open", ".perf": "folder-benchmark-open", "_perf": "folder-benchmark-open", "-perf": "folder-benchmark-open", "__perf__": "folder-benchmark-open", "profiling": "folder-benchmark-open", ".profiling": "folder-benchmark-open", "_profiling": "folder-benchmark-open", "-profiling": "folder-benchmark-open", "__profiling__": "folder-benchmark-open", "measure": "folder-benchmark-open", ".measure": "folder-benchmark-open", "_measure": "folder-benchmark-open", "-measure": "folder-benchmark-open", "__measure__": "folder-benchmark-open", "measures": "folder-benchmark-open", ".measures": "folder-benchmark-open", "_measures": "folder-benchmark-open", "-measures": "folder-benchmark-open", "__measures__": "folder-benchmark-open", "measurement": "folder-benchmark-open", ".measurement": "folder-benchmark-open", "_measurement": "folder-benchmark-open", "-measurement": "folder-benchmark-open", "__measurement__": "folder-benchmark-open", "connection": "folder-connection-open", ".connection": "folder-connection-open", "_connection": "folder-connection-open", "-connection": "folder-connection-open", "__connection__": "folder-connection-open", "connections": "folder-connection-open", ".connections": "folder-connection-open", "_connections": "folder-connection-open", "-connections": "folder-connection-open", "__connections__": "folder-connection-open", "integration": "folder-connection-open", ".integration": "folder-connection-open", "_integration": "folder-connection-open", "-integration": "folder-connection-open", "__integration__": "folder-connection-open", "integrations": "folder-connection-open", ".integrations": "folder-connection-open", "_integrations": "folder-connection-open", "-integrations": "folder-connection-open", "__integrations__": "folder-connection-open", "remote": "folder-connection-open", ".remote": "folder-connection-open", "_remote": "folder-connection-open", "-remote": "folder-connection-open", "__remote__": "folder-connection-open", "remotes": "folder-connection-open", ".remotes": "folder-connection-open", "_remotes": "folder-connection-open", "-remotes": "folder-connection-open", "__remotes__": "folder-connection-open", "pact": "folder-contract-open", ".pact": "folder-contract-open", "_pact": "folder-contract-open", "-pact": "folder-contract-open", "__pact__": "folder-contract-open", "pacts": "folder-contract-open", ".pacts": "folder-contract-open", "_pacts": "folder-contract-open", "-pacts": "folder-contract-open", "__pacts__": "folder-contract-open", "contract": "folder-contract-open", ".contract": "folder-contract-open", "_contract": "folder-contract-open", "-contract": "folder-contract-open", "__contract__": "folder-contract-open", "contracts": "folder-contract-open", ".contracts": "folder-contract-open", "_contracts": "folder-contract-open", "-contracts": "folder-contract-open", "__contracts__": "folder-contract-open", "contract-testing": "folder-contract-open", ".contract-testing": "folder-contract-open", "_contract-testing": "folder-contract-open", "-contract-testing": "folder-contract-open", "__contract-testing__": "folder-contract-open", "contract-test": "folder-contract-open", ".contract-test": "folder-contract-open", "_contract-test": "folder-contract-open", "-contract-test": "folder-contract-open", "__contract-test__": "folder-contract-open", "contract-tests": "folder-contract-open", ".contract-tests": "folder-contract-open", "_contract-tests": "folder-contract-open", "-contract-tests": "folder-contract-open", "__contract-tests__": "folder-contract-open" }, "fileNames": { ".jscsrc": "json", ".jshintrc": "json", "composer.lock": "json", ".jsbeautifyrc": "json", ".esformatter": "json", "cdp.pid": "json", ".whitesource": "json", "jakefile": "javascript", "readme.md": "readme", "readme.rst": "readme", "readme.txt": "readme", "readme": "readme" }, "fileExtensions": { "htm": "html", "xhtml": "html", "html_vm": "html", "asp": "html", "html": "html", "aspx": "html", "jshtm": "html", "rhtml": "html", "shtml": "html", "volt": "html", "xht": "html", "md": "markdown", "markdown": "markdown", "rst": "markdown", "copilotmd": "markdown", "litcoffee": "markdown", "markdn": "markdown", "mdown": "markdown", "mdtext": "markdown", "mdtxt": "markdown", "mdwn": "markdown", "mkd": "markdown", "mkdn": "markdown", "ronn": "markdown", "workbook": "markdown", "css": "css", "json": "json", "jsonc": "json", "tsbuildinfo": "json", "json5": "json", "jsonl": "json", "ndjson": "json", "geojson": "json", "har": "json", "jsonld": "json", "webmanifest": "json", "ts.map": "json", "yml.dist": "yaml", "yaml.dist": "yaml", "YAML-tmLanguage": "yaml", "yaml": "yaml", "yml": "yaml", "cff": "yaml", "eyaml": "yaml", "eyml": "yaml", "winget": "yaml", "yaml-tmpreferences": "yaml", "yaml-tmtheme": "yaml", "png": "image", "jpeg": "image", "jpg": "image", "gif": "image", "ico": "image", "tif": "image", "tiff": "image", "ami": "image", "apx": "image", "avif": "image", "bmp": "image", "bpg": "image", "brk": "image", "cur": "image", "dds": "image", "exr": "image", "fpx": "image", "gbr": "image", "img": "image", "jbig2": "image", "jb2": "image", "jng": "image", "jxl": "image", "jxr": "image", "pgf": "image", "pic": "image", "raw": "image", "webp": "image", "eps": "image", "afphoto": "image", "ase": "image", "aseprite": "image", "clip": "image", "cpt": "image", "heif": "image", "heic": "image", "kra": "image", "mdp": "image", "ora": "image", "pdn": "image", "reb": "image", "sai": "image", "tga": "image", "xcf": "image", "jfif": "image", "ppm": "image", "pbm": "image", "pgm": "image", "pnm": "image", "icns": "image", "3fr": "image", "ari": "image", "arw": "image", "bay": "image", "braw": "image", "crw": "image", "cr2": "image", "cr3": "image", "cap": "image", "data": "image", "dcs": "image", "dcr": "image", "dng": "image", "drf": "image", "eip": "image", "erf": "image", "fff": "image", "gpr": "image", "iiq": "image", "k25": "image", "kdc": "image", "mdc": "image", "mef": "image", "mos": "image", "mrw": "image", "nef": "image", "nrw": "image", "obm": "image", "orf": "image", "pef": "image", "ptx": "image", "pxn": "image", "r3d": "image", "raf": "image", "rwl": "image", "rw2": "image", "rwz": "image", "sr2": "image", "srf": "image", "srw": "image", "x3f": "image", "ktx": "image", "ktx2": "image", "esx": "javascript", "mjs": "javascript", "js": "javascript", "cjs": "javascript", "es6": "javascript", "pac": "javascript", "ts": "typescript", "cts": "typescript", "mts": "typescript", "pdf": "pdf", "py": "python", "cpy": "python", "gyp": "python", "gypi": "python", "ipy": "python", "pyi": "python", "pyt": "python", "pyw": "python", "rpy": "python" } };

  // src/components/material-icons.js
  function materialResourceIcon({ label, folder }, open = false) {
    const name = label.toLowerCase();
    let key;
    if (folder) key = materialMappings[open ? "folderNamesExpanded" : "folderNames"][name] || (open ? "folder-open" : "folder");
    else {
      key = materialMappings.fileNames[name];
      const pieces = name.split(".");
      for (let index = 1; !key && index < pieces.length; index++) key = materialMappings.fileExtensions[pieces.slice(index).join(".")];
      key ||= "file";
    }
    const documentSVG = new DOMParser().parseFromString(materialIcons[key], "image/svg+xml");
    const svg = document.importNode(documentSVG.documentElement, true);
    svg.classList.add("af-explorer-icon");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.dataset.materialIcon = key;
    return svg;
  }

  // src/components/explorer-tree.js
  function explorerTree({ label, items, onSelect = () => {
  }, onActivate = () => {
  }, renderIcon = materialResourceIcon }) {
    if (!label || !Array.isArray(items)) throw new Error("Explorer requires a label and items.");
    if (typeof renderIcon !== "function") throw new Error("Explorer icon renderer must be a function.");
    const root = document.createElement("div");
    root.className = "af-explorer-tree";
    root.setAttribute("aria-label", label);
    root.setAttribute("aria-multiselectable", "true");
    const keys = /* @__PURE__ */ new Set(), expanded = /* @__PURE__ */ new Set(), initialSelected = /* @__PURE__ */ new Set();
    const normalize = (entries2) => entries2.map((entry) => {
      if (!entry.id || keys.has(entry.id) || !entry.label) throw new Error("Invalid explorer item.");
      keys.add(entry.id);
      if (entry.expanded) expanded.add(entry.id);
      if (entry.selected && !entry.disabled) initialSelected.add(entry.id);
      return { ...entry, key: entry.id, folder: Array.isArray(entry.children), children: normalize(entry.children || []) };
    });
    const entries = normalize(items);
    let rows = [], selected = initialSelected, anchor = null;
    const select = (row, event = {}) => {
      if (row.disabled) return;
      ({ selected, anchor } = selectKeys({
        keys: rows.filter((item) => !item.disabled).map((item) => item.key),
        selected,
        anchor,
        key: row.key,
        range: !!event.shiftKey,
        toggle: !!(event.ctrlKey || event.metaKey)
      }));
      render(row.key);
      onSelect([...selected]);
    };
    const toggle = (row) => {
      if (row.disabled) return;
      if (expanded.has(row.key)) expanded.delete(row.key);
      else expanded.add(row.key);
      render(row.key);
    };
    function render(focusKey) {
      rows = renderNativeTree(root, {
        entries,
        childrenOf: (row) => row.children,
        isExpanded: (row) => expanded.has(row.key),
        focusKey,
        groupClass: "af-explorer-group",
        renderRow(row, { level, expanded: open }) {
          const element2 = document.createElement("div");
          element2.className = "af-explorer-item";
          element2.style.setProperty("--tree-depth", level - 1);
          element2.setAttribute("aria-label", row.label);
          element2.setAttribute("aria-selected", String(selected.has(row.key)));
          if (row.disabled) element2.setAttribute("aria-disabled", "true");
          const line = document.createElement("div");
          line.className = "af-explorer-row af-explorer-line";
          const disclosure = document.createElement("span");
          disclosure.className = "af-explorer-disclosure";
          if (row.folder) disclosure.append(icon(open ? "chevron-down" : "chevron-right", { size: 14 }));
          const iconSlot = document.createElement("span");
          iconSlot.className = "af-explorer-icon-slot";
          const itemIcon = renderIcon(row, open);
          if (itemIcon) iconSlot.append(itemIcon);
          const name = document.createElement("span");
          name.className = "af-explorer-name";
          name.textContent = row.label;
          line.title = row.label;
          line.append(disclosure, iconSlot, name);
          element2.append(line);
          line.addEventListener("click", (event) => {
            element2.focus();
            if (row.folder && (disclosure.contains(event.target) || !event.ctrlKey && !event.metaKey && !event.shiftKey)) toggle(row);
            select(row, event);
          });
          line.addEventListener("dblclick", () => {
            if (!row.folder && !row.disabled) onActivate(row.key);
          });
          return element2;
        }
      });
    }
    render();
    const keyboard = bindTreeKeyboard(root, {
      items: () => rows,
      isExpanded: (row) => expanded.has(row.key),
      onToggle: toggle,
      onActivate: (row) => {
        if (!row.disabled) onActivate(row.key);
      },
      onToggleSelection: (row, event) => select(row, { shiftKey: event.shiftKey, ctrlKey: true }),
      onSelectAll: () => {
        selected = new Set(rows.filter((row) => !row.disabled).map((row) => row.key));
        render();
        onSelect([...selected]);
      },
      onContextMenu: () => {
      },
      onMove: (row, event) => {
        if (!event.ctrlKey && !event.metaKey || event.shiftKey) select(row, event);
      }
    });
    return { root, destroy() {
      keyboard.destroy();
      root.remove();
    } };
  }
  return __toCommonJS(product_core_exports);
})();
