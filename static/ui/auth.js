var agentFactoryAuthUI = (() => {
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

  // src/product-auth.js
  var product_auth_exports = {};
  __export(product_auth_exports, {
    fieldFor: () => fieldFor,
    setStatus: () => setStatus
  });

  // src/components/primitives.js
  var nextId = 0;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
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
  return __toCommonJS(product_auth_exports);
})();
