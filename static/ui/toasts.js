var agentFactoryToasts = (() => {
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

  // src/components/toasts.js
  var toasts_exports = {};
  __export(toasts_exports, {
    createToastManager: () => createToastManager
  });

  // node_modules/@zag-js/toast/dist/index.mjs
  var dist_exports = {};
  __export(dist_exports, {
    anatomy: () => anatomy,
    connect: () => connect,
    createStore: () => createToastStore,
    group: () => group,
    machine: () => machine
  });

  // node_modules/@zag-js/dom-query/dist/chunk-QZ7TP4HQ.mjs
  var __defProp2 = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // node_modules/@zag-js/dom-query/dist/shared.mjs
  var isObject = (v) => typeof v === "object" && v !== null;
  var MAX_Z_INDEX = 2147483647;
  var dataAttr = (guard) => guard ? "" : void 0;

  // node_modules/@zag-js/dom-query/dist/node.mjs
  var ELEMENT_NODE = 1;
  var DOCUMENT_NODE = 9;
  var DOCUMENT_FRAGMENT_NODE = 11;
  var isHTMLElement = (el) => isObject(el) && el.nodeType === ELEMENT_NODE && typeof el.nodeName === "string";
  var isDocument = (el) => isObject(el) && el.nodeType === DOCUMENT_NODE;
  var isWindow = (el) => isObject(el) && el === el.window;
  var isNode = (el) => isObject(el) && el.nodeType !== void 0;
  var isShadowRoot = (el) => isNode(el) && el.nodeType === DOCUMENT_FRAGMENT_NODE && "host" in el;
  function isActiveElement(element) {
    if (!element) return false;
    const rootNode = element.getRootNode();
    return getActiveElement(rootNode) === element;
  }
  function contains(parent, child) {
    if (!parent || !child) return false;
    if (!isHTMLElement(parent) || !isNode(child)) return false;
    if (isHTMLElement(child) && parent === child) return true;
    if (parent.contains(child)) return true;
    const rootNode = child.getRootNode?.();
    if (rootNode && isShadowRoot(rootNode)) {
      let next = child;
      while (next) {
        if (parent === next) return true;
        next = next.parentNode || next.host;
      }
    }
    return false;
  }
  function getDocument(el) {
    if (isDocument(el)) return el;
    if (isWindow(el)) return el.document;
    return el?.ownerDocument ?? document;
  }
  function getWindow(el) {
    if (isShadowRoot(el)) return getWindow(el.host);
    if (isDocument(el)) return el.defaultView ?? window;
    if (isHTMLElement(el)) return el.ownerDocument?.defaultView ?? window;
    return window;
  }
  function getActiveElement(rootNode) {
    let activeElement = rootNode.activeElement;
    while (activeElement?.shadowRoot) {
      const el = activeElement.shadowRoot.activeElement;
      if (!el || el === activeElement) break;
      else activeElement = el;
    }
    return activeElement;
  }

  // node_modules/@zag-js/dom-query/dist/computed-style.mjs
  var styleCache = /* @__PURE__ */ new WeakMap();
  function getComputedStyle(el) {
    if (!styleCache.has(el)) {
      styleCache.set(el, getWindow(el).getComputedStyle(el));
    }
    return styleCache.get(el);
  }

  // node_modules/@zag-js/dom-query/dist/event.mjs
  var addDomEvent = (target, eventName, handler, options) => {
    const node = typeof target === "function" ? target() : target;
    node?.addEventListener(eventName, handler, options);
    return () => {
      node?.removeEventListener(eventName, handler, options);
    };
  };

  // node_modules/@zag-js/dom-query/dist/raf.mjs
  var AnimationFrame = class _AnimationFrame {
    constructor() {
      __publicField(this, "id", null);
      __publicField(this, "fn_cleanup");
      __publicField(this, "cleanup", () => {
        this.cancel();
      });
    }
    static create() {
      return new _AnimationFrame();
    }
    request(fn) {
      this.cancel();
      this.id = globalThis.requestAnimationFrame(() => {
        this.id = null;
        this.fn_cleanup = fn?.();
      });
    }
    cancel() {
      if (this.id !== null) {
        globalThis.cancelAnimationFrame(this.id);
        this.id = null;
      }
      this.fn_cleanup?.();
      this.fn_cleanup = void 0;
    }
    isActive() {
      return this.id !== null;
    }
  };
  function raf(fn) {
    const frame = AnimationFrame.create();
    frame.request(fn);
    return frame.cleanup;
  }
  function nextTick(fn) {
    const set = /* @__PURE__ */ new Set();
    function raf2(fn2) {
      const id = globalThis.requestAnimationFrame(fn2);
      set.add(() => globalThis.cancelAnimationFrame(id));
    }
    raf2(() => raf2(fn));
    return function cleanup() {
      set.forEach((fn2) => fn2());
    };
  }

  // node_modules/@zag-js/dom-query/dist/when-node.mjs
  function whenNode(nodeOrFn, fn, options = {}) {
    const { defer, onMissing } = options;
    const getNode = () => typeof nodeOrFn === "function" ? nodeOrFn() : nodeOrFn;
    const cleanups = [];
    const setup2 = (node2) => {
      if (!node2) return onMissing?.();
      cleanups.push(fn(node2));
    };
    const node = getNode();
    if (!defer || node) {
      setup2(node);
    } else {
      let cancelled = false;
      cleanups.push(() => {
        cancelled = true;
      });
      queueMicrotask(() => {
        if (cancelled) return;
        const committed = getNode();
        if (committed) {
          setup2(committed);
          return;
        }
        cleanups.push(
          raf(() => {
            if (cancelled) return;
            setup2(getNode());
          })
        );
      });
    }
    return () => {
      cleanups.forEach((fn2) => fn2?.());
    };
  }

  // node_modules/@zag-js/anatomy/dist/create-anatomy.mjs
  var createAnatomy = (name, parts2 = []) => ({
    parts: (...values) => {
      if (isEmpty(parts2)) {
        return createAnatomy(name, values);
      }
      throw new Error("createAnatomy().parts(...) should only be called once. Did you mean to use .extendWith(...) ?");
    },
    extendWith: (...values) => createAnatomy(name, [...parts2, ...values]),
    omit: (...values) => createAnatomy(name, parts2.filter((part) => !values.includes(part))),
    rename: (newName) => createAnatomy(newName, parts2),
    keys: () => parts2,
    build: () => [...new Set(parts2)].reduce(
      (prev, part) => Object.assign(prev, {
        [part]: {
          selector: [
            `&[data-scope="${toKebabCase(name)}"][data-part="${toKebabCase(part)}"]`,
            `& [data-scope="${toKebabCase(name)}"][data-part="${toKebabCase(part)}"]`
          ].join(", "),
          attrs: { "data-scope": toKebabCase(name), "data-part": toKebabCase(part) }
        }
      }),
      {}
    )
  });
  var toKebabCase = (value) => value.replace(/([A-Z])([A-Z])/g, "$1-$2").replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
  var isEmpty = (v) => v.length === 0;

  // node_modules/@zag-js/toast/dist/toast.anatomy.mjs
  var anatomy = createAnatomy("toast").parts(
    "group",
    "root",
    "title",
    "description",
    "actionTrigger",
    "closeTrigger"
  );
  var parts = anatomy.build();

  // node_modules/@zag-js/toast/dist/toast.dom.mjs
  var getRegionId = (placement) => `toast-group:${placement}`;
  var getRegionEl = (ctx, placement) => ctx.getById(`toast-group:${placement}`);
  var getRootId = (ctx) => `toast:${ctx.id}`;
  var getRootEl = (ctx) => ctx.getById(getRootId(ctx));
  var getTitleId = (ctx) => `toast:${ctx.id}:title`;
  var getDescriptionId = (ctx) => `toast:${ctx.id}:description`;
  var getCloseTriggerId = (ctx) => `toast${ctx.id}:close`;

  // node_modules/@zag-js/toast/dist/toast.utils.mjs
  var defaultTimeouts = {
    info: 5e3,
    error: 5e3,
    success: 2e3,
    loading: Infinity,
    warning: 5e3,
    DEFAULT: 5e3
  };
  function getToastDuration(duration, type) {
    return duration ?? defaultTimeouts[type] ?? defaultTimeouts.DEFAULT;
  }
  var getOffsets = (offsets) => typeof offsets === "string" ? { left: offsets, right: offsets, bottom: offsets, top: offsets } : offsets;
  function getGroupPlacementStyle(service, placement) {
    const { prop, computed, context } = service;
    const { offsets, gap } = prop("store").attrs;
    const heights = context.get("heights");
    const computedOffset = getOffsets(offsets);
    const rtl = prop("dir") === "rtl";
    const computedPlacement = placement.replace("-start", rtl ? "-right" : "-left").replace("-end", rtl ? "-left" : "-right");
    const isRighty = computedPlacement.includes("right");
    const isLefty = computedPlacement.includes("left");
    const styles = {
      position: "fixed",
      pointerEvents: computed("count") > 0 ? void 0 : "none",
      display: "flex",
      flexDirection: "column",
      "--gap": `${gap}px`,
      "--first-height": `${heights[0]?.height || 0}px`,
      "--viewport-offset-left": computedOffset.left,
      "--viewport-offset-right": computedOffset.right,
      "--viewport-offset-top": computedOffset.top,
      "--viewport-offset-bottom": computedOffset.bottom,
      zIndex: MAX_Z_INDEX
    };
    let alignItems = "center";
    if (isRighty) alignItems = "flex-end";
    if (isLefty) alignItems = "flex-start";
    styles.alignItems = alignItems;
    if (computedPlacement.includes("top")) {
      const offset = computedOffset.top;
      styles.top = `max(env(safe-area-inset-top, 0px), ${offset})`;
    }
    if (computedPlacement.includes("bottom")) {
      const offset = computedOffset.bottom;
      styles.bottom = `max(env(safe-area-inset-bottom, 0px), ${offset})`;
    }
    if (!computedPlacement.includes("left")) {
      const offset = computedOffset.right;
      styles.insetInlineEnd = `calc(env(safe-area-inset-right, 0px) + ${offset})`;
    }
    if (!computedPlacement.includes("right")) {
      const offset = computedOffset.left;
      styles.insetInlineStart = `calc(env(safe-area-inset-left, 0px) + ${offset})`;
    }
    return styles;
  }
  function getPlacementStyle(service, visible) {
    const { prop, context, computed } = service;
    const parent = prop("parent");
    const placement = parent.computed("placement");
    const { gap } = parent.prop("store").attrs;
    const [side] = placement.split("-");
    const mounted = context.get("mounted");
    const remainingTime = context.get("remainingTime");
    const height = computed("height");
    const frontmost = computed("frontmost");
    const sibling = !frontmost;
    const overlap = !prop("stacked");
    const stacked = prop("stacked");
    const type = prop("type");
    const duration = type === "loading" ? Number.MAX_SAFE_INTEGER : remainingTime;
    const offset = computed("heightIndex") * gap + computed("heightBefore");
    const styles = {
      position: "absolute",
      pointerEvents: "auto",
      "--opacity": "0",
      "--remove-delay": `${prop("removeDelay")}ms`,
      "--duration": `${duration}ms`,
      "--initial-height": `${height}px`,
      "--offset": `${offset}px`,
      "--index": prop("index"),
      "--z-index": computed("zIndex"),
      "--lift-amount": "calc(var(--lift) * var(--gap))",
      "--y": "100%",
      "--x": "0"
    };
    const assign = (overrides) => Object.assign(styles, overrides);
    if (side === "top") {
      assign({
        top: "0",
        "--sign": "-1",
        "--y": "-100%",
        "--lift": "1"
      });
    } else if (side === "bottom") {
      assign({
        bottom: "0",
        "--sign": "1",
        "--y": "100%",
        "--lift": "-1"
      });
    }
    if (mounted) {
      assign({
        "--y": "0",
        "--opacity": "1"
      });
      if (stacked) {
        assign({
          "--y": "calc(var(--lift) * var(--offset))",
          "--height": "var(--initial-height)"
        });
      }
    }
    if (!visible) {
      assign({
        "--opacity": "0",
        pointerEvents: "none"
      });
    }
    if (sibling && overlap) {
      assign({
        "--base-scale": "var(--index) * 0.05 + 1",
        "--y": "calc(var(--lift-amount) * var(--index))",
        "--scale": "calc(-1 * var(--base-scale))",
        "--height": "var(--first-height)"
      });
      if (!visible) {
        assign({
          "--y": "calc(var(--sign) * 40%)"
        });
      }
    }
    if (sibling && stacked && !visible) {
      assign({
        "--y": "calc(var(--lift) * var(--offset) + var(--lift) * -100%)"
      });
    }
    if (frontmost && !visible) {
      assign({
        "--y": "calc(var(--lift) * -100%)"
      });
    }
    return styles;
  }
  function getGhostBeforeStyle(service, visible) {
    const { computed } = service;
    const styles = {
      position: "absolute",
      inset: "0",
      scale: "1 2",
      pointerEvents: visible ? "none" : "auto"
    };
    const assign = (overrides) => Object.assign(styles, overrides);
    if (computed("frontmost") && !visible) {
      assign({
        height: "calc(var(--initial-height) + 80%)"
      });
    }
    return styles;
  }
  function getGhostAfterStyle() {
    return {
      position: "absolute",
      left: "0",
      height: "calc(var(--gap) + 2px)",
      bottom: "100%",
      width: "100%"
    };
  }

  // node_modules/@zag-js/toast/dist/toast-group.connect.mjs
  function groupConnect(service, normalize) {
    const { context, prop, send, refs, computed } = service;
    return {
      getCount() {
        return context.get("toasts").length;
      },
      getToasts() {
        return context.get("toasts");
      },
      getGroupProps(options = {}) {
        const { label = "Notifications" } = options;
        const { hotkey } = prop("store").attrs;
        const hotkeyLabel = hotkey.join("+").replace(/Key/g, "").replace(/Digit/g, "");
        const placement = computed("placement");
        const [side, align = "center"] = placement.split("-");
        return normalize.element({
          ...parts.group.attrs,
          dir: prop("dir"),
          tabIndex: -1,
          role: "region",
          "aria-label": `${label}, ${placement} (${hotkeyLabel})`,
          id: getRegionId(placement),
          "data-placement": placement,
          "data-side": side,
          "data-align": align,
          "aria-live": "polite",
          "aria-relevant": "additions text",
          "aria-atomic": "false",
          style: getGroupPlacementStyle(service, placement),
          onMouseEnter() {
            if (refs.get("ignoreMouseTimer").isActive()) return;
            send({ type: "REGION.POINTER_ENTER", placement });
          },
          onMouseMove() {
            if (refs.get("ignoreMouseTimer").isActive()) return;
            send({ type: "REGION.POINTER_ENTER", placement });
          },
          onMouseLeave() {
            if (refs.get("ignoreMouseTimer").isActive()) return;
            send({ type: "REGION.POINTER_LEAVE", placement });
          },
          onFocus(event) {
            send({ type: "REGION.FOCUS", target: event.relatedTarget });
          },
          onBlur(event) {
            if (refs.get("isFocusWithin") && !contains(event.currentTarget, event.relatedTarget)) {
              queueMicrotask(() => send({ type: "REGION.BLUR" }));
            }
          }
        });
      },
      subscribe(fn) {
        const store = prop("store");
        return store.subscribe(() => fn(context.get("toasts")));
      }
    };
  }

  // node_modules/@zag-js/utils/dist/chunk-MXGZDBDQ.mjs
  var __defProp3 = Object.defineProperty;
  var __typeError = (msg) => {
    throw TypeError(msg);
  };
  var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField2 = (obj, key, value) => __defNormalProp2(obj, typeof key !== "symbol" ? key + "" : key, value);
  var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
  var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
  var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);

  // node_modules/@zag-js/utils/dist/array.mjs
  function toArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  }

  // node_modules/@zag-js/utils/dist/equal.mjs
  var isArrayLike = (value) => value?.constructor.name === "Array";
  var isArrayEqual = (a, b) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  };
  var isEqual = (a, b) => {
    if (Object.is(a, b)) return true;
    if (a == null && b != null || a != null && b == null) return false;
    if (typeof a?.isEqual === "function" && typeof b?.isEqual === "function") {
      return a.isEqual(b);
    }
    if (typeof a === "function" && typeof b === "function") {
      return a.toString() === b.toString();
    }
    if (isArrayLike(a) && isArrayLike(b)) {
      return isArrayEqual(Array.from(a), Array.from(b));
    }
    if (!(typeof a === "object") || !(typeof b === "object")) return false;
    const keys = Object.keys(b ?? /* @__PURE__ */ Object.create(null));
    const length = keys.length;
    for (let i = 0; i < length; i++) {
      const hasKey = Reflect.has(a, keys[i]);
      if (!hasKey) return false;
    }
    for (let i = 0; i < length; i++) {
      const key = keys[i];
      if (!isEqual(a[key], b[key])) return false;
    }
    return true;
  };

  // node_modules/@zag-js/utils/dist/guard.mjs
  var isObjectLike = (v) => v != null && typeof v === "object";
  var isString = (v) => typeof v === "string";
  var isFunction = (v) => typeof v === "function";
  var hasProp = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
  var baseGetTag = (v) => Object.prototype.toString.call(v);
  var fnToString = Function.prototype.toString;
  var objectCtorString = fnToString.call(Object);
  var isPlainObject = (v) => {
    if (!isObjectLike(v) || baseGetTag(v) != "[object Object]" || isFrameworkElement(v)) return false;
    const proto = Object.getPrototypeOf(v);
    if (proto === null) return true;
    const Ctor = hasProp(proto, "constructor") && proto.constructor;
    return typeof Ctor == "function" && Ctor instanceof Ctor && fnToString.call(Ctor) == objectCtorString;
  };
  var isReactElement = (x) => typeof x === "object" && x !== null && "$$typeof" in x && "props" in x;
  var isVueElement = (x) => typeof x === "object" && x !== null && "__v_isVNode" in x;
  var isFrameworkElement = (x) => isReactElement(x) || isVueElement(x);

  // node_modules/@zag-js/utils/dist/functions.mjs
  var runIfFn = (v, ...a) => {
    const res = typeof v === "function" ? v(...a) : v;
    return res ?? void 0;
  };
  var identity = (v) => v();
  var callAll = (...fns) => (...a) => {
    fns.forEach(function(fn) {
      fn?.(...a);
    });
  };
  var uuid = /* @__PURE__ */ (() => {
    let id = 0;
    return () => {
      id++;
      return id.toString(36);
    };
  })();

  // node_modules/@zag-js/utils/dist/object.mjs
  function compact(obj) {
    if (!isPlainObject(obj) || obj === void 0) return obj;
    const keys2 = Reflect.ownKeys(obj).filter((key) => typeof key === "string");
    const filtered = {};
    for (const key of keys2) {
      const value = obj[key];
      if (value !== void 0) {
        filtered[key] = compact(value);
      }
    }
    return filtered;
  }
  function mergeWithDefault(defaults, overrides) {
    if (!overrides) return defaults;
    const result = { ...defaults };
    const source = overrides;
    for (const key in source) {
      const value = source[key];
      if (value !== void 0) result[key] = value;
    }
    return result;
  }

  // node_modules/@zag-js/utils/dist/timers.mjs
  var currentTime = () => performance.now();
  var _tick;
  var Timer = class {
    constructor(onTick) {
      __publicField2(this, "onTick", onTick);
      __publicField2(this, "frameId", null);
      __publicField2(this, "pausedAtMs", null);
      __publicField2(this, "context");
      __publicField2(this, "cancelFrame", () => {
        if (this.frameId === null) return;
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      });
      __publicField2(this, "setStartMs", (startMs) => {
        this.context.startMs = startMs;
      });
      __publicField2(this, "start", () => {
        if (this.frameId !== null) return;
        const now = currentTime();
        if (this.pausedAtMs !== null) {
          this.context.startMs += now - this.pausedAtMs;
          this.pausedAtMs = null;
        } else {
          this.context.startMs = now;
        }
        this.frameId = requestAnimationFrame(__privateGet(this, _tick));
      });
      __publicField2(this, "pause", () => {
        if (this.frameId === null) return;
        this.cancelFrame();
        this.pausedAtMs = currentTime();
      });
      __publicField2(this, "stop", () => {
        if (this.frameId === null) return;
        this.cancelFrame();
        this.pausedAtMs = null;
      });
      __privateAdd(this, _tick, (now) => {
        this.context.now = now;
        this.context.deltaMs = now - this.context.startMs;
        const shouldContinue = this.onTick(this.context);
        if (shouldContinue === false) {
          this.stop();
          return;
        }
        this.frameId = requestAnimationFrame(__privateGet(this, _tick));
      });
      this.context = { now: 0, startMs: currentTime(), deltaMs: 0 };
    }
    get elapsedMs() {
      if (this.pausedAtMs !== null) {
        return this.pausedAtMs - this.context.startMs;
      }
      return currentTime() - this.context.startMs;
    }
  };
  _tick = /* @__PURE__ */ new WeakMap();
  function setRafTimeout(fn, delayMs) {
    const timer = new Timer(({ deltaMs }) => {
      if (deltaMs >= delayMs) {
        fn();
        return false;
      }
    });
    timer.start();
    return () => timer.stop();
  }

  // node_modules/@zag-js/utils/dist/warning.mjs
  function warn(...a) {
    const m = a.length === 1 ? a[0] : a[1];
    const c = a.length === 2 ? a[0] : true;
    if (c && true) {
      console.warn(m);
    }
  }
  function invariant(...a) {
    const m = a.length === 1 ? a[0] : a[1];
    const c = a.length === 2 ? a[0] : true;
    if (c && true) {
      throw new Error(m);
    }
  }
  function ensure(c, m) {
    if (c == null) throw new Error(m());
  }
  function ensureProps(props, keys, scope) {
    let missingKeys = [];
    for (const key of keys) {
      if (props[key] == null) missingKeys.push(key);
    }
    if (missingKeys.length > 0)
      throw new Error(`[zag-js${scope ? ` > ${scope}` : ""}] missing required props: ${missingKeys.join(", ")}`);
  }

  // node_modules/@zag-js/core/dist/state.mjs
  var STATE_DELIMITER = ".";
  var ABSOLUTE_PREFIX = "#";
  var stateIndexCache = /* @__PURE__ */ new WeakMap();
  var stateIdIndexCache = /* @__PURE__ */ new WeakMap();
  function joinStatePath(parts2) {
    return parts2.join(STATE_DELIMITER);
  }
  function isAbsoluteStatePath(value) {
    return value.includes(STATE_DELIMITER);
  }
  function isExplicitAbsoluteStatePath(value) {
    return value.startsWith(ABSOLUTE_PREFIX);
  }
  function isChildTarget(value) {
    return value.startsWith(STATE_DELIMITER);
  }
  function stripAbsolutePrefix(value) {
    return isExplicitAbsoluteStatePath(value) ? value.slice(ABSOLUTE_PREFIX.length) : value;
  }
  function appendStatePath(base, segment) {
    return base ? `${base}${STATE_DELIMITER}${segment}` : segment;
  }
  function buildStateIndex(machine2) {
    const index = /* @__PURE__ */ new Map();
    const idIndex = /* @__PURE__ */ new Map();
    const visit = (basePath, state) => {
      index.set(basePath, state);
      const stateId = state.id;
      if (stateId) {
        if (idIndex.has(stateId)) {
          invariant(`[zag-js] Duplicate state id: "${stateId}"`);
        }
        idIndex.set(stateId, basePath);
      }
      const childStates = state.states;
      if (!childStates) return;
      ensure(state.initial, () => `[zag-js] Compound state "${basePath}" has child states but no "initial" property`);
      if (!(state.initial in childStates)) {
        invariant(
          `[zag-js] Compound state "${basePath}" has initial "${String(state.initial)}" which is not a child state`
        );
      }
      for (const [childKey, childState] of Object.entries(childStates)) {
        if (!childState) continue;
        const childPath = appendStatePath(basePath, childKey);
        visit(childPath, childState);
      }
    };
    for (const [topKey, topState] of Object.entries(machine2.states)) {
      if (!topState) continue;
      visit(topKey, topState);
    }
    return { index, idIndex };
  }
  function ensureStateIndex(machine2) {
    const cached = stateIndexCache.get(machine2);
    if (cached) return cached;
    const { index, idIndex } = buildStateIndex(machine2);
    stateIndexCache.set(machine2, index);
    stateIdIndexCache.set(machine2, idIndex);
    return index;
  }
  function getStatePathById(machine2, stateId) {
    ensureStateIndex(machine2);
    return stateIdIndexCache.get(machine2)?.get(stateId);
  }
  function toSegments(value) {
    if (!value) return [];
    return String(value).split(STATE_DELIMITER).filter(Boolean);
  }
  function getStateChain(machine2, state) {
    if (!state) return [];
    const stateIndex = ensureStateIndex(machine2);
    const segments = toSegments(state);
    const chain = [];
    const statePath = [];
    for (const segment of segments) {
      statePath.push(segment);
      const path = joinStatePath(statePath);
      const current = stateIndex.get(path);
      if (!current) break;
      chain.push({ path, state: current });
    }
    return chain;
  }
  function resolveAbsoluteStateValue(machine2, value) {
    const stateIndex = ensureStateIndex(machine2);
    const segments = toSegments(value);
    if (!segments.length) return value;
    const resolved = [];
    for (const segment of segments) {
      resolved.push(segment);
      const path = joinStatePath(resolved);
      if (!stateIndex.has(path)) return value;
    }
    let resolvedPath = joinStatePath(resolved);
    let current = stateIndex.get(resolvedPath);
    while (current?.initial) {
      const nextPath = `${resolvedPath}${STATE_DELIMITER}${current.initial}`;
      const nextState = stateIndex.get(nextPath);
      if (!nextState) break;
      resolvedPath = nextPath;
      current = nextState;
    }
    return resolvedPath;
  }
  function hasStatePath(machine2, value) {
    const stateIndex = ensureStateIndex(machine2);
    return stateIndex.has(value);
  }
  function resolveStateValue(machine2, value, source) {
    const stateValue = String(value);
    if (isExplicitAbsoluteStatePath(stateValue)) {
      const stateId = stripAbsolutePrefix(stateValue);
      const statePath = getStatePathById(machine2, stateId);
      ensure(statePath, () => `[zag-js] Unknown state id: "${stateId}"`);
      return resolveAbsoluteStateValue(machine2, statePath);
    }
    if (isChildTarget(stateValue) && source) {
      const childPath = appendStatePath(source, stateValue.slice(1));
      return resolveAbsoluteStateValue(machine2, childPath);
    }
    if (!isAbsoluteStatePath(stateValue) && source) {
      const sourceSegments = toSegments(source);
      for (let index = sourceSegments.length - 1; index >= 1; index--) {
        const base = sourceSegments.slice(0, index).join(STATE_DELIMITER);
        const candidate = appendStatePath(base, stateValue);
        if (hasStatePath(machine2, candidate)) return resolveAbsoluteStateValue(machine2, candidate);
      }
      if (hasStatePath(machine2, stateValue)) return resolveAbsoluteStateValue(machine2, stateValue);
    }
    return resolveAbsoluteStateValue(machine2, stateValue);
  }
  function findTransition(machine2, state, eventType) {
    const chain = getStateChain(machine2, state);
    for (let index = chain.length - 1; index >= 0; index--) {
      const transitionMap = chain[index]?.state.on;
      const transition = transitionMap?.[eventType];
      if (transition) return { transitions: transition, source: chain[index]?.path };
    }
    const rootTransitionMap = machine2.on;
    return { transitions: rootTransitionMap?.[eventType], source: void 0 };
  }
  function getExitEnterStates(machine2, prevState, nextState, reenter) {
    const prevChain = prevState ? getStateChain(machine2, prevState) : [];
    const nextChain = getStateChain(machine2, nextState);
    let commonIndex = 0;
    while (commonIndex < prevChain.length && commonIndex < nextChain.length && prevChain[commonIndex]?.path === nextChain[commonIndex]?.path) {
      commonIndex += 1;
    }
    let exiting = prevChain.slice(commonIndex).reverse();
    let entering = nextChain.slice(commonIndex);
    const sameLeaf = prevChain[prevChain.length - 1]?.path === nextChain[nextChain.length - 1]?.path;
    if (reenter && sameLeaf) {
      exiting = prevChain.slice().reverse();
      entering = nextChain;
    }
    return { exiting, entering };
  }
  function matchesState(current, value) {
    if (!current) return false;
    return current === value || current.startsWith(`${value}${STATE_DELIMITER}`);
  }
  function hasTag(machine2, state, tag) {
    return getStateChain(machine2, state).some((item) => item.state.tags?.includes(tag));
  }

  // node_modules/@zag-js/core/dist/create-machine.mjs
  function createGuards() {
    return {
      and: (...guards2) => {
        return function andGuard(params) {
          return guards2.every((str) => params.guard(str));
        };
      },
      or: (...guards2) => {
        return function orGuard(params) {
          return guards2.some((str) => params.guard(str));
        };
      },
      not: (guard) => {
        return function notGuard(params) {
          return !params.guard(guard);
        };
      }
    };
  }
  function createMachine(config) {
    ensureStateIndex(config);
    return config;
  }
  function setup() {
    return {
      guards: createGuards(),
      createMachine: (config) => {
        return createMachine(config);
      },
      choose: (transitions) => {
        return function chooseFn({ choose }) {
          return choose(transitions)?.actions;
        };
      }
    };
  }

  // node_modules/@zag-js/core/dist/types.mjs
  var MachineStatus = /* @__PURE__ */ ((MachineStatus2) => {
    MachineStatus2["NotStarted"] = "Not Started";
    MachineStatus2["Started"] = "Started";
    MachineStatus2["Stopped"] = "Stopped";
    return MachineStatus2;
  })(MachineStatus || {});
  var INIT_STATE = "__init__";

  // node_modules/@zag-js/core/dist/scope.mjs
  function createScope(props) {
    const getRootNode = () => props.getRootNode?.() ?? document;
    const getDoc = () => getDocument(getRootNode());
    const getWin = () => getDoc().defaultView ?? window;
    const getActiveElementFn = () => getActiveElement(getRootNode());
    const getById = (id) => getRootNode().getElementById(id);
    return {
      ...props,
      getRootNode,
      getDoc,
      getWin,
      getActiveElement: getActiveElementFn,
      isActiveElement,
      getById
    };
  }

  // node_modules/@zag-js/dismissable/dist/layer-stack.mjs
  var LAYER_REQUEST_DISMISS_EVENT = "layer:request-dismiss";
  var layerStack = {
    layers: [],
    branches: [],
    recentlyRemoved: /* @__PURE__ */ new Set(),
    count() {
      return this.layers.length;
    },
    pointerBlockingLayers() {
      return this.layers.filter((layer) => layer.pointerBlocking);
    },
    topMostPointerBlockingLayer() {
      return [...this.pointerBlockingLayers()].slice(-1)[0];
    },
    hasPointerBlockingLayer() {
      return this.pointerBlockingLayers().length > 0;
    },
    isBelowPointerBlockingLayer(node) {
      const index = this.indexOf(node);
      const highestBlockingIndex = this.topMostPointerBlockingLayer() ? this.indexOf(this.topMostPointerBlockingLayer()?.node) : -1;
      return index < highestBlockingIndex;
    },
    isTopMost(node) {
      const layer = this.layers[this.count() - 1];
      return layer?.node === node;
    },
    getNestedLayers(node) {
      return Array.from(this.layers).slice(this.indexOf(node) + 1);
    },
    getLayersByType(type) {
      return this.layers.filter((layer) => layer.type === type);
    },
    getNestedLayersByType(node, type) {
      const index = this.indexOf(node);
      if (index === -1) return [];
      return this.layers.slice(index + 1).filter((layer) => layer.type === type);
    },
    getParentLayerOfType(node, type) {
      const index = this.indexOf(node);
      if (index <= 0) return void 0;
      return this.layers.slice(0, index).reverse().find((layer) => layer.type === type);
    },
    countNestedLayersOfType(node, type) {
      return this.getNestedLayersByType(node, type).length;
    },
    isInNestedLayer(node, target) {
      const inNested = this.getNestedLayers(node).some((layer) => contains(layer.node, target));
      if (inNested) return true;
      if (this.recentlyRemoved.size > 0) return true;
      return false;
    },
    isInBranch(target) {
      return Array.from(this.branches).some((branch) => contains(branch, target));
    },
    add(layer) {
      const existingIndex = this.indexOf(layer.node);
      if (existingIndex !== -1) {
        this.layers.splice(existingIndex, 1);
      }
      this.layers.push(layer);
      this.syncLayers();
    },
    addBranch(node) {
      this.branches.push(node);
    },
    remove(node) {
      const index = this.indexOf(node);
      if (index < 0) return;
      const layer = this.layers[index];
      layer.styleTargets?.forEach((getTarget) => {
        const target = getTarget();
        if (target) {
          clearLayerStyleMirror(target);
        }
      });
      this.recentlyRemoved.add(node);
      nextTick(() => this.recentlyRemoved.delete(node));
      if (index < this.count() - 1) {
        const _layers = this.getNestedLayers(node);
        _layers.forEach((layer2) => layerStack.dismiss(layer2.node, node));
      }
      this.layers.splice(index, 1);
      this.syncLayers();
    },
    removeBranch(node) {
      const index = this.branches.indexOf(node);
      if (index >= 0) this.branches.splice(index, 1);
    },
    syncLayers() {
      this.layers.forEach((layer, index) => {
        applyLayerStackMetadata(layer, index, layer.node);
        layer.styleTargets?.forEach((getTarget) => {
          const target = getTarget();
          if (!target || target === layer.node) return;
          applyLayerStackMetadata(layer, index, target);
          const { zIndex } = getComputedStyle(layer.node);
          target.style.setProperty("--z-index", zIndex);
        });
      });
    },
    indexOf(node) {
      return this.layers.findIndex((layer) => layer.node === node);
    },
    dismiss(node, parent) {
      const index = this.indexOf(node);
      if (index === -1) return;
      const layer = this.layers[index];
      addListenerOnce(node, LAYER_REQUEST_DISMISS_EVENT, (event) => {
        layer.requestDismiss?.(event);
        if (!event.defaultPrevented) {
          layer?.dismiss();
        }
      });
      fireCustomEvent(node, LAYER_REQUEST_DISMISS_EVENT, {
        originalLayer: node,
        targetLayer: parent,
        originalIndex: index,
        targetIndex: parent ? this.indexOf(parent) : -1
      });
      this.syncLayers();
    },
    clear() {
      this.remove(this.layers[0].node);
    }
  };
  function applyLayerStackMetadata(layer, index, el) {
    el.style.setProperty("--layer-index", `${index}`);
    el.removeAttribute("data-nested");
    el.removeAttribute("data-has-nested");
    const parentOfSameType = layerStack.getParentLayerOfType(layer.node, layer.type);
    if (parentOfSameType) {
      el.setAttribute("data-nested", layer.type);
    }
    const nestedCount = layerStack.countNestedLayersOfType(layer.node, layer.type);
    if (nestedCount > 0) {
      el.setAttribute("data-has-nested", layer.type);
    }
    el.style.setProperty("--nested-layer-count", `${nestedCount}`);
  }
  function clearLayerStyleMirror(el) {
    el.style.removeProperty("--layer-index");
    el.style.removeProperty("--nested-layer-count");
    el.style.removeProperty("--z-index");
    el.removeAttribute("data-nested");
    el.removeAttribute("data-has-nested");
  }
  function fireCustomEvent(el, type, detail) {
    const win = el.ownerDocument.defaultView || window;
    const event = new win.CustomEvent(type, { cancelable: true, bubbles: true, detail });
    return el.dispatchEvent(event);
  }
  function addListenerOnce(el, type, callback) {
    el.addEventListener(type, callback, { once: true });
  }

  // node_modules/@zag-js/dismissable/dist/dismissable-layer.mjs
  function trackDismissableBranch(nodeOrFn, options = {}) {
    return whenNode(
      nodeOrFn,
      (node) => {
        layerStack.addBranch(node);
        return () => {
          layerStack.removeBranch(node);
        };
      },
      {
        defer: options.defer,
        onMissing: () => warn("[@zag-js/dismissable] branch node is `null` or `undefined`")
      }
    );
  }

  // node_modules/@zag-js/toast/dist/toast-group.machine.mjs
  var { guards, createMachine: createMachine2 } = setup();
  var { and } = guards;
  var groupMachine = createMachine2({
    props({ props }) {
      return {
        dir: "ltr",
        id: uuid(),
        ...props,
        store: props.store
      };
    },
    initialState({ prop }) {
      return prop("store").attrs.overlap ? "overlap" : "stack";
    },
    refs() {
      return {
        lastFocusedEl: null,
        isFocusWithin: false,
        isPointerWithin: false,
        ignoreMouseTimer: AnimationFrame.create(),
        dismissableCleanup: void 0
      };
    },
    context({ bindable: bindable2 }) {
      return {
        toasts: bindable2(() => ({
          defaultValue: [],
          sync: true,
          hash: (toasts) => toasts.map((t) => t.id).join(",")
        })),
        heights: bindable2(() => ({
          defaultValue: [],
          sync: true
        }))
      };
    },
    computed: {
      count: ({ context }) => context.get("toasts").length,
      overlap: ({ prop }) => prop("store").attrs.overlap,
      placement: ({ prop }) => prop("store").attrs.placement
    },
    effects: ["subscribeToStore", "trackDocumentVisibility", "trackHotKeyPress"],
    watch({ track, context, action }) {
      track([() => context.hash("toasts")], () => {
        queueMicrotask(() => {
          action(["collapsedIfEmpty", "setDismissableBranch"]);
        });
      });
    },
    exit: ["clearDismissableBranch", "clearLastFocusedEl", "clearMouseEventTimer"],
    on: {
      "DOC.HOTKEY": {
        actions: ["focusRegionEl"]
      },
      "REGION.BLUR": [
        {
          guard: and("isOverlapping", "isPointerOut"),
          target: "overlap",
          actions: ["collapseToasts", "resumeToasts", "restoreFocusIfPointerOut"]
        },
        {
          guard: "isPointerOut",
          target: "stack",
          actions: ["resumeToasts", "restoreFocusIfPointerOut"]
        },
        {
          actions: ["clearFocusWithin"]
        }
      ],
      "TOAST.REMOVE": {
        actions: ["removeToast", "removeHeight", "ignoreMouseEventsTemporarily"]
      },
      "TOAST.PAUSE": {
        actions: ["pauseToasts"]
      }
    },
    states: {
      stack: {
        on: {
          "REGION.POINTER_LEAVE": [
            {
              guard: "isOverlapping",
              target: "overlap",
              actions: ["clearPointerWithin", "resumeToasts", "collapseToasts"]
            },
            {
              actions: ["clearPointerWithin", "resumeToasts"]
            }
          ],
          "REGION.OVERLAP": {
            target: "overlap",
            actions: ["collapseToasts"]
          },
          "REGION.FOCUS": {
            actions: ["setLastFocusedEl", "pauseToasts"]
          },
          "REGION.POINTER_ENTER": {
            actions: ["setPointerWithin", "pauseToasts"]
          }
        }
      },
      overlap: {
        on: {
          "REGION.STACK": {
            target: "stack",
            actions: ["expandToasts"]
          },
          "REGION.POINTER_ENTER": {
            target: "stack",
            actions: ["setPointerWithin", "pauseToasts", "expandToasts"]
          },
          "REGION.FOCUS": {
            target: "stack",
            actions: ["setLastFocusedEl", "pauseToasts", "expandToasts"]
          }
        }
      }
    },
    implementations: {
      guards: {
        isOverlapping: ({ computed }) => computed("overlap"),
        isPointerOut: ({ refs }) => !refs.get("isPointerWithin")
      },
      effects: {
        subscribeToStore({ context, prop }) {
          const store = prop("store");
          context.set("toasts", store.getVisibleToasts());
          return store.subscribe((toast) => {
            if (toast.dismiss) {
              context.set("toasts", (prev) => prev.filter((t) => t.id !== toast.id));
              return;
            }
            context.set("toasts", (prev) => {
              const index = prev.findIndex((t) => t.id === toast.id);
              if (index !== -1) {
                return [...prev.slice(0, index), { ...prev[index], ...toast }, ...prev.slice(index + 1)];
              }
              return [toast, ...prev];
            });
          });
        },
        trackHotKeyPress({ prop, send }) {
          const handleKeyDown = (event) => {
            const { hotkey } = prop("store").attrs;
            const isHotkeyPressed = hotkey.every((key) => event[key] || event.code === key);
            if (!isHotkeyPressed) return;
            send({ type: "DOC.HOTKEY" });
          };
          return addDomEvent(document, "keydown", handleKeyDown, { capture: true });
        },
        trackDocumentVisibility({ prop, send, scope }) {
          const { pauseOnPageIdle } = prop("store").attrs;
          if (!pauseOnPageIdle) return;
          const doc = scope.getDoc();
          return addDomEvent(doc, "visibilitychange", () => {
            const isHidden = doc.visibilityState === "hidden";
            send({ type: isHidden ? "PAUSE_ALL" : "RESUME_ALL" });
          });
        }
      },
      actions: {
        setDismissableBranch({ refs, context, computed, scope }) {
          const toasts = context.get("toasts");
          const placement = computed("placement");
          const hasToasts = toasts.length > 0;
          if (!hasToasts) {
            refs.get("dismissableCleanup")?.();
            return;
          }
          if (hasToasts && refs.get("dismissableCleanup")) {
            return;
          }
          const groupEl = () => getRegionEl(scope, placement);
          const cleanup = trackDismissableBranch(groupEl, { defer: true });
          refs.set("dismissableCleanup", cleanup);
        },
        clearDismissableBranch({ refs }) {
          refs.get("dismissableCleanup")?.();
        },
        focusRegionEl({ scope, computed }) {
          queueMicrotask(() => {
            getRegionEl(scope, computed("placement"))?.focus();
          });
        },
        pauseToasts({ prop }) {
          prop("store").pause();
        },
        resumeToasts({ prop }) {
          prop("store").resume();
        },
        expandToasts({ prop }) {
          prop("store").expand();
        },
        collapseToasts({ prop }) {
          prop("store").collapse();
        },
        removeToast({ prop, event }) {
          prop("store").remove(event.id);
        },
        removeHeight({ event, context }) {
          if (event?.id == null) return;
          queueMicrotask(() => {
            context.set("heights", (heights) => heights.filter((height) => height.id !== event.id));
          });
        },
        collapsedIfEmpty({ send, computed }) {
          if (!computed("overlap") || computed("count") > 1) return;
          send({ type: "REGION.OVERLAP" });
        },
        setLastFocusedEl({ refs, event }) {
          if (refs.get("isFocusWithin") || !event.target) return;
          refs.set("isFocusWithin", true);
          refs.set("lastFocusedEl", event.target);
        },
        restoreFocusIfPointerOut({ refs }) {
          if (!refs.get("lastFocusedEl") || refs.get("isPointerWithin")) return;
          refs.get("lastFocusedEl")?.focus({ preventScroll: true });
          refs.set("lastFocusedEl", null);
          refs.set("isFocusWithin", false);
        },
        setPointerWithin({ refs }) {
          refs.set("isPointerWithin", true);
        },
        clearPointerWithin({ refs }) {
          refs.set("isPointerWithin", false);
          if (refs.get("lastFocusedEl") && !refs.get("isFocusWithin")) {
            refs.get("lastFocusedEl")?.focus({ preventScroll: true });
            refs.set("lastFocusedEl", null);
          }
        },
        clearFocusWithin({ refs }) {
          refs.set("isFocusWithin", false);
        },
        clearLastFocusedEl({ refs }) {
          if (!refs.get("lastFocusedEl")) return;
          refs.get("lastFocusedEl")?.focus({ preventScroll: true });
          refs.set("lastFocusedEl", null);
          refs.set("isFocusWithin", false);
        },
        ignoreMouseEventsTemporarily({ refs }) {
          refs.get("ignoreMouseTimer").request();
        },
        clearMouseEventTimer({ refs }) {
          refs.get("ignoreMouseTimer").cancel();
        }
      }
    }
  });

  // node_modules/@zag-js/toast/dist/toast.connect.mjs
  var defaultTranslations = {
    closeTriggerLabel: "Dismiss notification"
  };
  function connect(service, normalize) {
    const { state, send, prop, scope, context, computed } = service;
    const translations = mergeWithDefault(defaultTranslations, prop("translations"));
    const visible = state.hasTag("visible");
    const paused = state.hasTag("paused");
    const mounted = context.get("mounted");
    const frontmost = computed("frontmost");
    const placement = prop("parent").computed("placement");
    const type = prop("type");
    const stacked = prop("stacked");
    const title = prop("title");
    const description = prop("description");
    const action = prop("action");
    const [side, align = "center"] = placement.split("-");
    return {
      type,
      title,
      description,
      placement,
      visible,
      paused,
      closable: !!prop("closable"),
      pause() {
        send({ type: "PAUSE" });
      },
      resume() {
        send({ type: "RESUME" });
      },
      dismiss() {
        send({ type: "DISMISS", src: "programmatic" });
      },
      getRootProps() {
        return normalize.element({
          ...parts.root.attrs,
          dir: prop("dir"),
          id: getRootId(scope),
          "data-state": visible ? "open" : "closed",
          "data-type": type,
          "data-placement": placement,
          "data-align": align,
          "data-side": side,
          "data-mounted": dataAttr(mounted),
          "data-paused": dataAttr(paused),
          "data-first": dataAttr(frontmost),
          "data-sibling": dataAttr(!frontmost),
          "data-stack": dataAttr(stacked),
          "data-overlap": dataAttr(!stacked),
          role: "status",
          "aria-atomic": "true",
          "aria-describedby": description ? getDescriptionId(scope) : void 0,
          "aria-labelledby": title ? getTitleId(scope) : void 0,
          tabIndex: 0,
          style: getPlacementStyle(service, visible),
          onKeyDown(event) {
            if (event.defaultPrevented) return;
            if (event.key == "Escape") {
              send({ type: "DISMISS", src: "keyboard" });
              event.preventDefault();
            }
          }
        });
      },
      /* Leave a ghost div to avoid setting hover to false when transitioning out */
      getGhostBeforeProps() {
        return normalize.element({
          "data-ghost": "before",
          style: getGhostBeforeStyle(service, visible)
        });
      },
      /* Needed to avoid setting hover to false when in between toasts */
      getGhostAfterProps() {
        return normalize.element({
          "data-ghost": "after",
          style: getGhostAfterStyle()
        });
      },
      getTitleProps() {
        return normalize.element({
          ...parts.title.attrs,
          id: getTitleId(scope)
        });
      },
      getDescriptionProps() {
        return normalize.element({
          ...parts.description.attrs,
          id: getDescriptionId(scope)
        });
      },
      getActionTriggerProps() {
        return normalize.button({
          ...parts.actionTrigger.attrs,
          type: "button",
          onClick(event) {
            if (event.defaultPrevented) return;
            action?.onClick?.();
            send({ type: "DISMISS", src: "user" });
          }
        });
      },
      getCloseTriggerProps() {
        return normalize.button({
          id: getCloseTriggerId(scope),
          ...parts.closeTrigger.attrs,
          type: "button",
          "aria-label": translations?.closeTriggerLabel,
          onClick(event) {
            if (event.defaultPrevented) return;
            send({ type: "DISMISS", src: "user" });
          }
        });
      }
    };
  }

  // node_modules/@zag-js/toast/dist/toast.machine.mjs
  var { not } = createGuards();
  var machine = createMachine({
    props({ props }) {
      ensureProps(props, ["id", "type", "parent", "removeDelay"], "toast");
      return {
        closable: true,
        ...props,
        duration: getToastDuration(props.duration, props.type)
      };
    },
    initialState({ prop }) {
      const persist = prop("type") === "loading" || prop("duration") === Infinity;
      return persist ? "visible:persist" : "visible";
    },
    context({ prop, bindable: bindable2 }) {
      return {
        remainingTime: bindable2(() => ({
          defaultValue: getToastDuration(prop("duration"), prop("type"))
        })),
        createdAt: bindable2(() => ({
          defaultValue: Date.now()
        })),
        mounted: bindable2(() => ({
          defaultValue: false
        })),
        initialHeight: bindable2(() => ({
          defaultValue: 0
        }))
      };
    },
    refs() {
      return {
        closeTimerStartTime: Date.now(),
        lastCloseStartTimerStartTime: 0
      };
    },
    computed: {
      zIndex: ({ prop }) => {
        const toasts = prop("parent").context.get("toasts");
        const index = toasts.findIndex((toast) => toast.id === prop("id"));
        return toasts.length - index;
      },
      height: ({ prop }) => {
        const heights = prop("parent").context.get("heights");
        const height = heights.find((height2) => height2.id === prop("id"));
        return height?.height ?? 0;
      },
      heightIndex: ({ prop }) => {
        const heights = prop("parent").context.get("heights");
        return heights.findIndex((height) => height.id === prop("id"));
      },
      frontmost: ({ prop }) => prop("index") === 0,
      heightBefore: ({ prop }) => {
        const heights = prop("parent").context.get("heights");
        const heightIndex = heights.findIndex((height) => height.id === prop("id"));
        return heights.reduce((prev, curr, reducerIndex) => {
          if (reducerIndex >= heightIndex) return prev;
          return prev + curr.height;
        }, 0);
      },
      shouldPersist: ({ prop }) => prop("type") === "loading" || prop("duration") === Infinity
    },
    watch({ track, prop, send }) {
      track([() => prop("message")], () => {
        const message = prop("message");
        if (message) send({ type: message, src: "programmatic" });
      });
      track([() => prop("type"), () => prop("duration")], () => {
        send({ type: "UPDATE" });
      });
    },
    on: {
      UPDATE: [
        {
          guard: "shouldPersist",
          target: "visible:persist",
          actions: ["resetCloseTimer"]
        },
        {
          target: "visible:updating",
          actions: ["resetCloseTimer"]
        }
      ],
      MEASURE: {
        actions: ["measureHeight"]
      }
    },
    entry: ["setMounted", "measureHeight", "invokeOnVisible"],
    effects: ["trackHeight"],
    states: {
      "visible:updating": {
        tags: ["visible", "updating"],
        effects: ["waitForNextTick"],
        on: {
          SHOW: {
            target: "visible"
          }
        }
      },
      "visible:persist": {
        tags: ["visible", "paused"],
        on: {
          RESUME: {
            guard: not("isLoadingType"),
            target: "visible",
            actions: ["setCloseTimer"]
          },
          DISMISS: {
            target: "dismissing"
          }
        }
      },
      visible: {
        tags: ["visible"],
        effects: ["waitForDuration"],
        on: {
          DISMISS: {
            target: "dismissing"
          },
          PAUSE: {
            target: "visible:persist",
            actions: ["syncRemainingTime"]
          }
        }
      },
      dismissing: {
        entry: ["invokeOnDismiss"],
        effects: ["waitForRemoveDelay"],
        on: {
          REMOVE: {
            target: "unmounted",
            actions: ["notifyParentToRemove"]
          }
        }
      },
      unmounted: {
        entry: ["invokeOnUnmount"]
      }
    },
    implementations: {
      effects: {
        waitForRemoveDelay({ prop, send }) {
          return setRafTimeout(() => {
            send({ type: "REMOVE", src: "timer" });
          }, prop("removeDelay"));
        },
        waitForDuration({ send, context, computed }) {
          if (computed("shouldPersist")) return;
          return setRafTimeout(() => {
            send({ type: "DISMISS", src: "timer" });
          }, context.get("remainingTime"));
        },
        waitForNextTick({ send }) {
          return setRafTimeout(() => {
            send({ type: "SHOW", src: "timer" });
          }, 0);
        },
        trackHeight({ scope, prop }) {
          let cleanup;
          raf(() => {
            const rootEl = getRootEl(scope);
            if (!rootEl) return;
            const syncHeight = () => {
              const height = measureLayoutHeight(rootEl);
              const item = { id: prop("id"), height };
              setHeight(prop("parent"), item);
            };
            const win = scope.getWin();
            const observer = new win.MutationObserver(syncHeight);
            observer.observe(rootEl, {
              childList: true,
              subtree: true,
              characterData: true
            });
            cleanup = () => observer.disconnect();
          });
          return () => cleanup?.();
        }
      },
      guards: {
        isLoadingType: ({ prop }) => prop("type") === "loading",
        shouldPersist: ({ computed }) => computed("shouldPersist")
      },
      actions: {
        setMounted({ context }) {
          raf(() => {
            context.set("mounted", true);
          });
        },
        measureHeight({ scope, prop, context }) {
          queueMicrotask(() => {
            const rootEl = getRootEl(scope);
            if (!rootEl) return;
            const height = measureLayoutHeight(rootEl);
            context.set("initialHeight", height);
            const item = { id: prop("id"), height };
            setHeight(prop("parent"), item);
          });
        },
        setCloseTimer({ refs }) {
          refs.set("closeTimerStartTime", Date.now());
        },
        resetCloseTimer({ context, refs, prop }) {
          refs.set("closeTimerStartTime", Date.now());
          context.set("remainingTime", getToastDuration(prop("duration"), prop("type")));
        },
        syncRemainingTime({ context, refs }) {
          context.set("remainingTime", (prev) => {
            const closeTimerStartTime = refs.get("closeTimerStartTime");
            const elapsedTime = Date.now() - closeTimerStartTime;
            refs.set("lastCloseStartTimerStartTime", Date.now());
            return prev - elapsedTime;
          });
        },
        notifyParentToRemove({ prop }) {
          const parent = prop("parent");
          parent.send({ type: "TOAST.REMOVE", id: prop("id") });
        },
        invokeOnDismiss({ prop, event }) {
          prop("onStatusChange")?.({ status: "dismissing", src: event.src });
        },
        invokeOnUnmount({ prop }) {
          prop("onStatusChange")?.({ status: "unmounted" });
        },
        invokeOnVisible({ prop }) {
          prop("onStatusChange")?.({ status: "visible" });
        }
      }
    }
  });
  function measureLayoutHeight(el) {
    const prevHeight = el.style.height;
    el.style.height = "auto";
    const height = el.offsetHeight;
    el.style.height = prevHeight;
    return height;
  }
  function setHeight(parent, item) {
    const { id, height } = item;
    parent.context.set("heights", (prev) => {
      const alreadyExists = prev.find((i) => i.id === id);
      if (!alreadyExists) {
        return [{ id, height }, ...prev];
      } else {
        return prev.map((i) => i.id === id ? { ...i, height } : i);
      }
    });
  }

  // node_modules/@zag-js/toast/dist/toast.store.mjs
  var withDefaults = (options, defaults) => {
    return { ...defaults, ...compact(options) };
  };
  var priorities = {
    error: [1, 2],
    warning: [3, 6],
    loading: [4, 5],
    success: [5, 7],
    info: [6, 8]
  };
  var DEFAULT_TYPE = "info";
  var getPriorityForType = (type, hasAction) => {
    const [actionable, nonActionable] = priorities[type ?? DEFAULT_TYPE];
    return hasAction ? actionable : nonActionable;
  };
  var sortToastsByPriority = (toastArray) => {
    return toastArray.sort((a, b) => {
      const priorityA = a.priority ?? getPriorityForType(a.type, !!a.action);
      const priorityB = b.priority ?? getPriorityForType(b.type, !!b.action);
      return priorityA - priorityB;
    });
  };
  function createToastStore(props = {}) {
    const attrs = withDefaults(props, {
      placement: "bottom",
      overlap: false,
      max: 24,
      gap: 16,
      offsets: "1rem",
      hotkey: ["altKey", "KeyT"],
      removeDelay: 200,
      pauseOnPageIdle: true
    });
    let subscribers = [];
    let toasts = [];
    let dismissedToasts = /* @__PURE__ */ new Set();
    let toastQueue = [];
    const subscribe2 = (subscriber) => {
      subscribers.push(subscriber);
      return () => {
        const index = subscribers.indexOf(subscriber);
        subscribers.splice(index, 1);
      };
    };
    const publish = (data) => {
      subscribers.forEach((subscriber) => subscriber(data));
      return data;
    };
    const addToast = (data) => {
      if (toasts.length >= attrs.max) {
        toastQueue.push(data);
        return;
      }
      publish(data);
      toasts.unshift(data);
    };
    const processQueue = () => {
      toastQueue = sortToastsByPriority(toastQueue);
      while (toastQueue.length > 0 && toasts.length < attrs.max) {
        const nextToast = toastQueue.shift();
        if (nextToast) {
          publish(nextToast);
          toasts.unshift(nextToast);
        }
      }
    };
    const create = (data) => {
      const id = data.id ?? `toast:${uuid()}`;
      const exists = toasts.find((toast) => toast.id === id);
      if (dismissedToasts.has(id)) dismissedToasts.delete(id);
      if (exists) {
        toasts = toasts.map((toast) => {
          if (toast.id === id) {
            return publish({ ...toast, ...data, id });
          }
          return toast;
        });
      } else {
        const newToast = {
          id,
          duration: attrs.duration,
          removeDelay: attrs.removeDelay,
          type: DEFAULT_TYPE,
          ...data,
          stacked: !attrs.overlap,
          gap: attrs.gap
        };
        const priority = newToast.priority ?? getPriorityForType(newToast.type, !!newToast.action);
        addToast({ ...newToast, priority });
      }
      return id;
    };
    const remove = (id) => {
      dismissedToasts.add(id);
      if (!id) {
        toasts.forEach((toast) => {
          subscribers.forEach((subscriber) => subscriber({ id: toast.id, dismiss: true }));
        });
        toasts = [];
        toastQueue = [];
      } else {
        subscribers.forEach((subscriber) => subscriber({ id, dismiss: true }));
        toasts = toasts.filter((toast) => toast.id !== id);
        processQueue();
      }
      return id;
    };
    const error = (data) => {
      return create({ ...data, type: "error" });
    };
    const success = (data) => {
      return create({ ...data, type: "success" });
    };
    const info = (data) => {
      return create({ ...data, type: "info" });
    };
    const warning = (data) => {
      return create({ ...data, type: "warning" });
    };
    const loading = (data) => {
      return create({ ...data, type: "loading" });
    };
    const getVisibleToasts = () => {
      return toasts.filter((toast) => !dismissedToasts.has(toast.id));
    };
    const getCount = () => {
      return toasts.length;
    };
    const promise = (promise2, options, shared = {}) => {
      if (!options || !options.loading) {
        warn("[zag-js > toast] toaster.promise() requires at least a 'loading' option to be specified");
        return;
      }
      const id = create({
        ...shared,
        ...options.loading,
        promise: promise2,
        type: "loading"
      });
      let removable = true;
      let result;
      const prom = runIfFn(promise2).then(async (response) => {
        result = ["resolve", response];
        if (isHttpResponse(response) && !response.ok) {
          removable = false;
          const errorOptions = runIfFn(options.error, `HTTP Error! status: ${response.status}`);
          create({ ...shared, ...errorOptions, id, type: "error" });
        } else if (options.success !== void 0) {
          removable = false;
          const successOptions = runIfFn(options.success, response);
          create({ ...shared, ...successOptions, id, type: successOptions.type ?? "success" });
        }
      }).catch(async (error2) => {
        result = ["reject", error2];
        if (options.error !== void 0) {
          removable = false;
          const errorOptions = runIfFn(options.error, error2);
          create({ ...shared, ...errorOptions, id, type: "error" });
        }
      }).finally(() => {
        if (removable) {
          remove(id);
        }
        options.finally?.();
      });
      const unwrap = () => new Promise(
        (resolve, reject) => prom.then(() => result[0] === "reject" ? reject(result[1]) : resolve(result[1])).catch(reject)
      );
      return { id, unwrap };
    };
    const update = (id, data) => {
      return create({ id, ...data });
    };
    const pause = (id) => {
      if (id != null) {
        toasts = toasts.map((toast) => {
          if (toast.id === id) return publish({ ...toast, message: "PAUSE" });
          return toast;
        });
      } else {
        toasts = toasts.map((toast) => publish({ ...toast, message: "PAUSE" }));
      }
    };
    const resume = (id) => {
      if (id != null) {
        toasts = toasts.map((toast) => {
          if (toast.id === id) return publish({ ...toast, message: "RESUME" });
          return toast;
        });
      } else {
        toasts = toasts.map((toast) => publish({ ...toast, message: "RESUME" }));
      }
    };
    const dismiss = (id) => {
      if (id != null) {
        toasts = toasts.map((toast) => {
          if (toast.id === id) return publish({ ...toast, message: "DISMISS" });
          return toast;
        });
      } else {
        toasts = toasts.map((toast) => publish({ ...toast, message: "DISMISS" }));
      }
    };
    const isVisible = (id) => {
      return !dismissedToasts.has(id) && !!toasts.find((toast) => toast.id === id);
    };
    const isDismissed = (id) => {
      return dismissedToasts.has(id);
    };
    const expand = () => {
      toasts = toasts.map((toast) => publish({ ...toast, stacked: true }));
    };
    const collapse = () => {
      toasts = toasts.map((toast) => publish({ ...toast, stacked: false }));
    };
    return {
      attrs,
      subscribe: subscribe2,
      create,
      update,
      remove,
      dismiss,
      error,
      success,
      info,
      warning,
      loading,
      getVisibleToasts,
      getCount,
      promise,
      pause,
      resume,
      isVisible,
      isDismissed,
      expand,
      collapse
    };
  }
  var isHttpResponse = (data) => {
    return data && typeof data === "object" && "ok" in data && typeof data.ok === "boolean" && "status" in data && typeof data.status === "number";
  };

  // node_modules/@zag-js/toast/dist/index.mjs
  var group = {
    connect: groupConnect,
    machine: groupMachine
  };

  // node_modules/@zag-js/vanilla/dist/chunk-QZ7TP4HQ.mjs
  var __defProp4 = Object.defineProperty;
  var __defNormalProp3 = (obj, key, value) => key in obj ? __defProp4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField3 = (obj, key, value) => __defNormalProp3(obj, typeof key !== "symbol" ? key + "" : key, value);

  // node_modules/@zag-js/types/dist/prop-types.mjs
  function createNormalizer(fn) {
    return new Proxy({}, {
      get(_target, key) {
        if (key === "style")
          return (props) => {
            return fn({ style: props }).style;
          };
        return fn;
      }
    });
  }

  // node_modules/@zag-js/vanilla/dist/normalize-props.mjs
  var propMap = {
    onFocus: "onFocusin",
    onBlur: "onFocusout",
    onChange: "onInput",
    onDoubleClick: "onDblclick",
    htmlFor: "for",
    className: "class",
    defaultValue: "value",
    defaultChecked: "checked"
  };
  var caseSensitiveSvgAttrs = /* @__PURE__ */ new Set(["viewBox", "preserveAspectRatio"]);
  var toStyleString = (style) => {
    let string = "";
    for (let key in style) {
      const value = style[key];
      if (value === null || value === void 0) continue;
      if (!key.startsWith("--")) key = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
      string += `${key}:${value};`;
    }
    return string;
  };
  var normalizeProps = createNormalizer((props) => {
    return Object.entries(props).reduce((acc, [key, value]) => {
      if (value === void 0) return acc;
      if (key in propMap) {
        key = propMap[key];
      }
      if (key === "style" && typeof value === "object") {
        acc.style = toStyleString(value);
        return acc;
      }
      const normalizedKey = caseSensitiveSvgAttrs.has(key) ? key : key.toLowerCase();
      acc[normalizedKey] = value;
      return acc;
    }, {});
  });

  // node_modules/@zag-js/vanilla/dist/spread-props.mjs
  var prevAttrsMap = /* @__PURE__ */ new WeakMap();
  var assignableProps = /* @__PURE__ */ new Set(["value", "checked", "selected"]);
  var caseSensitiveSvgAttrs2 = /* @__PURE__ */ new Set([
    "viewBox",
    "preserveAspectRatio",
    "clipPath",
    "clipRule",
    "fillRule",
    "strokeWidth",
    "strokeLinecap",
    "strokeLinejoin",
    "strokeDasharray",
    "strokeDashoffset",
    "strokeMiterlimit"
  ]);
  var isSvgElement = (node) => {
    return node.tagName === "svg" || node.namespaceURI === "http://www.w3.org/2000/svg";
  };
  var getAttributeName = (node, attrName) => {
    const shouldPreserveCase = isSvgElement(node) && caseSensitiveSvgAttrs2.has(attrName);
    return shouldPreserveCase ? attrName : attrName.toLowerCase();
  };
  function spreadProps(node, attrs, machineId) {
    const scopeKey = machineId || "default";
    let machineMap = prevAttrsMap.get(node);
    if (!machineMap) {
      machineMap = /* @__PURE__ */ new Map();
      prevAttrsMap.set(node, machineMap);
    }
    const oldAttrs = machineMap.get(scopeKey) || {};
    const attrKeys = Object.keys(attrs);
    const addEvt = (e, f) => {
      node.addEventListener(e.toLowerCase(), f);
    };
    const remEvt = (e, f) => {
      node.removeEventListener(e.toLowerCase(), f);
    };
    const onEvents = (attr) => attr.startsWith("on");
    const others = (attr) => !attr.startsWith("on");
    const setup2 = (attr) => addEvt(attr.substring(2), attrs[attr]);
    const teardown = (attr) => remEvt(attr.substring(2), attrs[attr]);
    const apply = (attrName) => {
      const value = attrs[attrName];
      const oldValue = oldAttrs[attrName];
      if (value === oldValue) return;
      if (attrName === "class") {
        ;
        node.className = value ?? "";
        return;
      }
      if (assignableProps.has(attrName)) {
        ;
        node[attrName] = value ?? "";
        return;
      }
      if (typeof value === "boolean" && !attrName.includes("aria-")) {
        ;
        node.toggleAttribute(getAttributeName(node, attrName), value);
        return;
      }
      if (attrName === "children") {
        node.innerHTML = value;
        return;
      }
      if (value != null) {
        node.setAttribute(getAttributeName(node, attrName), value);
        return;
      }
      node.removeAttribute(getAttributeName(node, attrName));
    };
    for (const key in oldAttrs) {
      if (attrs[key] == null) {
        if (key === "class") {
          ;
          node.className = "";
        } else if (assignableProps.has(key)) {
          ;
          node[key] = "";
        } else {
          node.removeAttribute(getAttributeName(node, key));
        }
      }
    }
    const oldEvents = Object.keys(oldAttrs).filter(onEvents);
    oldEvents.forEach((evt) => {
      remEvt(evt.substring(2), oldAttrs[evt]);
    });
    attrKeys.filter(onEvents).forEach(setup2);
    attrKeys.filter(others).forEach(apply);
    machineMap.set(scopeKey, attrs);
    return function cleanup() {
      attrKeys.filter(onEvents).forEach(teardown);
      const currentMachineMap = prevAttrsMap.get(node);
      if (currentMachineMap) {
        currentMachineMap.delete(scopeKey);
        if (currentMachineMap.size === 0) {
          prevAttrsMap.delete(node);
        }
      }
    };
  }

  // node_modules/@zag-js/store/dist/global.mjs
  function glob() {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
  }
  function globalRef(key, value) {
    const g = glob();
    if (!g) return value();
    g[key] || (g[key] = value());
    return g[key];
  }
  var refSet = globalRef("__zag__refSet", () => /* @__PURE__ */ new WeakSet());

  // node_modules/@zag-js/store/dist/utils.mjs
  var isReactElement2 = (x) => typeof x === "object" && x !== null && "$$typeof" in x && "props" in x;
  var isVueElement2 = (x) => typeof x === "object" && x !== null && "__v_isVNode" in x;
  var isDOMElement = (x) => typeof x === "object" && x !== null && "nodeType" in x && typeof x.nodeName === "string";
  var isElement = (x) => isReactElement2(x) || isVueElement2(x) || isDOMElement(x);
  var isObject2 = (x) => x !== null && typeof x === "object";
  var canProxy = (x) => isObject2(x) && !refSet.has(x) && (Array.isArray(x) || !(Symbol.iterator in x)) && !isElement(x) && !(x instanceof WeakMap) && !(x instanceof WeakSet) && !(x instanceof Error) && !(x instanceof Number) && !(x instanceof Date) && !(x instanceof String) && !(x instanceof RegExp) && !(x instanceof ArrayBuffer) && !(x instanceof Promise) && !(x instanceof File) && !(x instanceof Blob) && !(x instanceof AbortController);
  var isDev = () => true;

  // node_modules/proxy-compare/dist/index.js
  var GET_ORIGINAL_SYMBOL = /* @__PURE__ */ Symbol();
  var getProto = Object.getPrototypeOf;
  var objectsToTrack = /* @__PURE__ */ new WeakMap();
  var isObjectToTrack = (obj) => obj && (objectsToTrack.has(obj) ? objectsToTrack.get(obj) : getProto(obj) === Object.prototype || getProto(obj) === Array.prototype);
  var getUntracked = (obj) => {
    if (isObjectToTrack(obj)) {
      return obj[GET_ORIGINAL_SYMBOL] || null;
    }
    return null;
  };
  var markToTrack = (obj, mark = true) => {
    objectsToTrack.set(obj, mark);
  };

  // node_modules/@zag-js/store/dist/proxy.mjs
  var proxyStateMap = globalRef("__zag__proxyStateMap", () => /* @__PURE__ */ new WeakMap());
  var buildProxyFunction = (objectIs = Object.is, newProxy = (target, handler) => new Proxy(target, handler), snapCache = /* @__PURE__ */ new WeakMap(), createSnapshot = (target, version) => {
    const cache = snapCache.get(target);
    if (cache?.[0] === version) {
      return cache[1];
    }
    const snap = Array.isArray(target) ? [] : Object.create(Object.getPrototypeOf(target));
    markToTrack(snap, true);
    snapCache.set(target, [version, snap]);
    Reflect.ownKeys(target).forEach((key) => {
      const value = Reflect.get(target, key);
      if (refSet.has(value)) {
        markToTrack(value, false);
        snap[key] = value;
      } else if (proxyStateMap.has(value)) {
        snap[key] = snapshot(value);
      } else {
        snap[key] = value;
      }
    });
    return Object.freeze(snap);
  }, proxyCache = /* @__PURE__ */ new WeakMap(), versionHolder = [1, 1], proxyFunction2 = (initialObject) => {
    if (!isObject2(initialObject)) {
      throw new Error("object required");
    }
    const found = proxyCache.get(initialObject);
    if (found) {
      return found;
    }
    let version = versionHolder[0];
    const listeners = /* @__PURE__ */ new Set();
    const notifyUpdate = (op, nextVersion = ++versionHolder[0]) => {
      if (version !== nextVersion) {
        version = nextVersion;
        listeners.forEach((listener) => listener(op, nextVersion));
      }
    };
    let checkVersion = versionHolder[1];
    const ensureVersion = (nextCheckVersion = ++versionHolder[1]) => {
      if (checkVersion !== nextCheckVersion && !listeners.size) {
        checkVersion = nextCheckVersion;
        propProxyStates.forEach(([propProxyState]) => {
          const propVersion = propProxyState[1](nextCheckVersion);
          if (propVersion > version) {
            version = propVersion;
          }
        });
      }
      return version;
    };
    const createPropListener = (prop) => (op, nextVersion) => {
      const newOp = [...op];
      newOp[1] = [prop, ...newOp[1]];
      notifyUpdate(newOp, nextVersion);
    };
    const propProxyStates = /* @__PURE__ */ new Map();
    const addPropListener = (prop, propProxyState) => {
      if (isDev() && propProxyStates.has(prop)) {
        throw new Error("prop listener already exists");
      }
      if (listeners.size) {
        const remove = propProxyState[3](createPropListener(prop));
        propProxyStates.set(prop, [propProxyState, remove]);
      } else {
        propProxyStates.set(prop, [propProxyState]);
      }
    };
    const removePropListener = (prop) => {
      const entry = propProxyStates.get(prop);
      if (entry) {
        propProxyStates.delete(prop);
        entry[1]?.();
      }
    };
    const addListener = (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        propProxyStates.forEach(([propProxyState, prevRemove], prop) => {
          if (isDev() && prevRemove) {
            throw new Error("remove already exists");
          }
          const remove = propProxyState[3](createPropListener(prop));
          propProxyStates.set(prop, [propProxyState, remove]);
        });
      }
      const removeListener = () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          propProxyStates.forEach(([propProxyState, remove], prop) => {
            if (remove) {
              remove();
              propProxyStates.set(prop, [propProxyState]);
            }
          });
        }
      };
      return removeListener;
    };
    const baseObject = Array.isArray(initialObject) ? [] : Object.create(Object.getPrototypeOf(initialObject));
    const handler = {
      deleteProperty(target, prop) {
        const prevValue = Reflect.get(target, prop);
        removePropListener(prop);
        const deleted = Reflect.deleteProperty(target, prop);
        if (deleted) {
          notifyUpdate(["delete", [prop], prevValue]);
        }
        return deleted;
      },
      set(target, prop, value, receiver) {
        const hasPrevValue = Reflect.has(target, prop);
        const prevValue = Reflect.get(target, prop, receiver);
        if (hasPrevValue && (objectIs(prevValue, value) || proxyCache.has(value) && objectIs(prevValue, proxyCache.get(value)))) {
          return true;
        }
        removePropListener(prop);
        if (isObject2(value)) {
          value = getUntracked(value) || value;
        }
        let nextValue = value;
        if (Object.getOwnPropertyDescriptor(target, prop)?.set) {
        } else {
          if (!proxyStateMap.has(value) && canProxy(value)) {
            nextValue = proxy(value);
          }
          const childProxyState = !refSet.has(nextValue) && proxyStateMap.get(nextValue);
          if (childProxyState) {
            addPropListener(prop, childProxyState);
          }
        }
        Reflect.set(target, prop, nextValue, receiver);
        notifyUpdate(["set", [prop], value, prevValue]);
        return true;
      }
    };
    const proxyObject = newProxy(baseObject, handler);
    proxyCache.set(initialObject, proxyObject);
    const proxyState = [baseObject, ensureVersion, createSnapshot, addListener];
    proxyStateMap.set(proxyObject, proxyState);
    Reflect.ownKeys(initialObject).forEach((key) => {
      const desc = Object.getOwnPropertyDescriptor(initialObject, key);
      if (desc.get || desc.set) {
        Object.defineProperty(baseObject, key, desc);
      } else {
        proxyObject[key] = initialObject[key];
      }
    });
    return proxyObject;
  }) => [
    // public functions
    proxyFunction2,
    // shared state
    proxyStateMap,
    refSet,
    // internal things
    objectIs,
    newProxy,
    canProxy,
    snapCache,
    createSnapshot,
    proxyCache,
    versionHolder
  ];
  var [proxyFunction] = buildProxyFunction();
  function proxy(initialObject = {}) {
    return proxyFunction(initialObject);
  }
  function subscribe(proxyObject, callback, notifyInSync) {
    const proxyState = proxyStateMap.get(proxyObject);
    if (isDev() && !proxyState) {
      console.warn("Please use proxy object");
    }
    let promise;
    const ops = [];
    const addListener = proxyState[3];
    let isListenerActive = false;
    const listener = (op) => {
      ops.push(op);
      if (notifyInSync) {
        callback(ops.splice(0));
        return;
      }
      if (!promise) {
        promise = Promise.resolve().then(() => {
          promise = void 0;
          if (isListenerActive) {
            callback(ops.splice(0));
          }
        });
      }
    };
    const removeListener = addListener(listener);
    isListenerActive = true;
    return () => {
      isListenerActive = false;
      removeListener();
    };
  }
  function snapshot(proxyObject) {
    const proxyState = proxyStateMap.get(proxyObject);
    if (isDev() && !proxyState) {
      console.warn("Please use proxy object");
    }
    const [target, ensureVersion, createSnapshot] = proxyState;
    return createSnapshot(target, ensureVersion());
  }

  // node_modules/@zag-js/vanilla/dist/bindable.mjs
  function bindable(props) {
    const initial = props().value ?? props().defaultValue;
    if (props().debug) {
      console.log(`[bindable > ${props().debug}] initial`, initial);
    }
    const eq = props().isEqual ?? Object.is;
    const store = proxy({ value: initial });
    const controlled = () => props().value !== void 0;
    return {
      initial,
      ref: store,
      get() {
        return controlled() ? props().value : store.value;
      },
      set(nextValue) {
        const prev = controlled() ? props().value : store.value;
        const next = isFunction(nextValue) ? nextValue(prev) : nextValue;
        if (props().debug) {
          console.log(`[bindable > ${props().debug}] setValue`, { next, prev });
        }
        if (!controlled()) store.value = next;
        if (!eq(next, prev)) {
          props().onChange?.(next, prev);
        }
      },
      invoke(nextValue, prevValue) {
        props().onChange?.(nextValue, prevValue);
      },
      hash(value) {
        return props().hash?.(value) ?? String(value);
      }
    };
  }
  bindable.cleanup = (_fn) => {
  };
  bindable.ref = (defaultValue) => {
    let value = defaultValue;
    return {
      get: () => value,
      set: (next) => {
        value = next;
      }
    };
  };

  // node_modules/@zag-js/vanilla/dist/refs.mjs
  function createRefs(refs) {
    const ref2 = { current: refs };
    return {
      get(key) {
        return ref2.current[key];
      },
      set(key, value) {
        ref2.current[key] = value;
      }
    };
  }

  // node_modules/@zag-js/vanilla/dist/merge-machine-props.mjs
  function mergeMachineProps(prev, next) {
    if (!isPlainObject(prev) || !isPlainObject(next)) {
      return next === void 0 ? prev : next;
    }
    const result = { ...prev };
    for (const key of Object.keys(next)) {
      const nextValue = next[key];
      const prevValue = prev[key];
      if (nextValue === void 0) {
        continue;
      }
      if (isPlainObject(prevValue) && isPlainObject(nextValue)) {
        result[key] = mergeMachineProps(prevValue, nextValue);
      } else {
        result[key] = nextValue;
      }
    }
    return result;
  }

  // node_modules/@zag-js/vanilla/dist/machine.mjs
  var VanillaMachine = class {
    constructor(machine2, userProps = {}) {
      __publicField3(this, "machine", machine2);
      __publicField3(this, "scope");
      __publicField3(this, "context");
      __publicField3(this, "prop");
      __publicField3(this, "state");
      __publicField3(this, "refs");
      __publicField3(this, "computed");
      __publicField3(this, "event", { type: "" });
      __publicField3(this, "previousEvent", { type: "" });
      __publicField3(this, "effects", /* @__PURE__ */ new Map());
      __publicField3(this, "transition", null);
      __publicField3(this, "cleanups", []);
      __publicField3(this, "subscriptions", []);
      __publicField3(this, "userPropsRef");
      __publicField3(this, "getEvent", () => ({
        ...this.event,
        current: () => this.event,
        previous: () => this.previousEvent
      }));
      __publicField3(this, "getState", () => ({
        ...this.state,
        matches: (...values) => values.some((value) => matchesState(this.state.get(), value)),
        hasTag: (tag) => hasTag(this.machine, this.state.get(), tag)
      }));
      __publicField3(this, "debug", (...args) => {
        if (this.machine.debug) console.log(...args);
      });
      __publicField3(this, "notify", () => {
        this.publish();
      });
      __publicField3(this, "send", (event) => {
        if (this.status !== MachineStatus.Started) return;
        queueMicrotask(() => {
          if (!event) return;
          this.previousEvent = this.event;
          this.event = event;
          this.debug("send", event);
          let currentState = this.state.get();
          const eventType = event.type;
          const { transitions, source } = findTransition(this.machine, currentState, eventType);
          const transition = this.choose(transitions);
          if (!transition) return;
          this.transition = transition;
          const target = resolveStateValue(this.machine, transition.target ?? currentState, source);
          this.debug("transition", transition);
          const changed = target !== currentState;
          if (changed) {
            this.state.set(target);
          } else if (transition.reenter) {
            this.state.invoke(currentState, currentState);
          } else {
            this.action(transition.actions);
          }
        });
      });
      __publicField3(this, "action", (keys) => {
        const strs = isFunction(keys) ? keys(this.getParams()) : keys;
        if (!strs) return;
        const fns = strs.map((s) => {
          const fn = this.machine.implementations?.actions?.[s];
          if (!fn) warn(`[zag-js] No implementation found for action "${JSON.stringify(s)}"`);
          return fn;
        });
        for (const fn of fns) {
          fn?.(this.getParams());
        }
      });
      __publicField3(this, "guard", (str) => {
        if (isFunction(str)) return str(this.getParams());
        const fn = this.machine.implementations?.guards?.[str];
        if (!fn) warn(`[zag-js] No implementation found for guard "${JSON.stringify(str)}"`);
        return fn?.(this.getParams());
      });
      __publicField3(this, "effect", (keys) => {
        const strs = isFunction(keys) ? keys(this.getParams()) : keys;
        if (!strs) return;
        const fns = strs.map((s) => {
          const fn = this.machine.implementations?.effects?.[s];
          if (!fn) warn(`[zag-js] No implementation found for effect "${JSON.stringify(s)}"`);
          return fn;
        });
        const cleanups = [];
        for (const fn of fns) {
          const cleanup = fn?.(this.getParams());
          if (cleanup) cleanups.push(cleanup);
        }
        return () => cleanups.forEach((fn) => fn?.());
      });
      __publicField3(this, "choose", (transitions) => {
        return toArray(transitions).find((t) => {
          let result = !t.guard;
          if (isString(t.guard)) result = !!this.guard(t.guard);
          else if (isFunction(t.guard)) result = t.guard(this.getParams());
          return result;
        });
      });
      __publicField3(this, "subscribe", (fn) => {
        this.subscriptions.push(fn);
        return () => {
          const index = this.subscriptions.indexOf(fn);
          if (index > -1) this.subscriptions.splice(index, 1);
        };
      });
      __publicField3(this, "status", MachineStatus.NotStarted);
      __publicField3(this, "publish", () => {
        this.callTrackers();
        this.subscriptions.forEach((fn) => fn(this.service));
      });
      __publicField3(this, "trackers", []);
      __publicField3(this, "setupTrackers", () => {
        this.machine.watch?.(this.getParams());
      });
      __publicField3(this, "callTrackers", () => {
        this.trackers.forEach(({ deps, fn }) => {
          const next = deps.map((dep) => dep());
          if (!isEqual(fn.prev, next)) {
            fn();
            fn.prev = next;
          }
        });
      });
      __publicField3(this, "getParams", () => ({
        state: this.getState(),
        context: this.context,
        event: this.getEvent(),
        prop: this.prop,
        send: this.send,
        action: this.action,
        guard: this.guard,
        track: (deps, fn) => {
          fn.prev = deps.map((dep) => dep());
          this.trackers.push({ deps, fn });
        },
        refs: this.refs,
        computed: this.computed,
        flush: identity,
        scope: this.scope,
        choose: this.choose
      }));
      this.userPropsRef = { current: userProps };
      const { id, ids, getRootNode } = runIfFn(userProps);
      this.scope = createScope({ id, ids, getRootNode });
      const prop = (key) => {
        const __props = runIfFn(this.userPropsRef.current);
        const props = machine2.props?.({ props: compact(__props), scope: this.scope }) ?? __props;
        return props[key];
      };
      this.prop = prop;
      const context = machine2.context?.({
        prop,
        bindable,
        scope: this.scope,
        flush(fn) {
          queueMicrotask(fn);
        },
        getContext() {
          return ctx;
        },
        getComputed() {
          return computed;
        },
        getRefs() {
          return refs;
        },
        getEvent: this.getEvent.bind(this)
      });
      if (context) {
        Object.values(context).forEach((item) => {
          const unsub = subscribe(item.ref, () => this.notify());
          this.cleanups.push(unsub);
        });
      }
      const ctx = {
        get(key) {
          return context?.[key].get();
        },
        set(key, value) {
          context?.[key].set(value);
        },
        initial(key) {
          return context?.[key].initial;
        },
        hash(key) {
          const current = context?.[key].get();
          return context?.[key].hash(current);
        }
      };
      this.context = ctx;
      const computed = (key) => {
        ensure(machine2.computed, () => `[zag-js] No computed object found on machine`);
        return machine2.computed[key]({
          context: ctx,
          event: this.getEvent(),
          prop,
          refs: this.refs,
          scope: this.scope,
          computed
        });
      };
      this.computed = computed;
      const refs = createRefs(machine2.refs?.({ prop, context: ctx }) ?? {});
      this.refs = refs;
      const state = bindable(() => ({
        defaultValue: resolveStateValue(machine2, machine2.initialState({ prop })),
        onChange: (nextState, prevState) => {
          const { exiting, entering } = getExitEnterStates(this.machine, prevState, nextState, this.transition?.reenter);
          exiting.forEach((item) => {
            const exitEffects = this.effects.get(item.path);
            exitEffects?.();
            this.effects.delete(item.path);
          });
          exiting.forEach((item) => {
            this.action(item.state?.exit);
          });
          this.action(this.transition?.actions);
          entering.forEach((item) => {
            const cleanup = this.effect(item.state?.effects);
            if (cleanup) {
              const existing = this.effects.get(item.path);
              this.effects.set(item.path, existing ? callAll(existing, cleanup) : cleanup);
            }
          });
          if (prevState === INIT_STATE) {
            this.action(machine2.entry);
            const cleanup = this.effect(machine2.effects);
            if (cleanup) {
              const existing = this.effects.get(INIT_STATE);
              this.effects.set(INIT_STATE, existing ? callAll(existing, cleanup) : cleanup);
            }
          }
          entering.forEach((item) => {
            this.action(item.state?.entry);
          });
        }
      }));
      this.state = state;
      this.cleanups.push(subscribe(this.state.ref, () => this.notify()));
    }
    updateProps(newProps) {
      const prevSource = this.userPropsRef.current;
      this.userPropsRef.current = () => {
        const prev = runIfFn(prevSource);
        const next = runIfFn(newProps);
        return mergeMachineProps(prev, next);
      };
      this.notify();
    }
    start() {
      this.status = MachineStatus.Started;
      this.debug("initializing...");
      this.state.invoke(this.state.initial, INIT_STATE);
      this.setupTrackers();
    }
    stop() {
      this.effects.forEach((fn) => fn?.());
      this.effects.clear();
      this.transition = null;
      this.action(this.machine.exit);
      this.cleanups.forEach((unsub) => unsub());
      this.cleanups = [];
      this.subscriptions = [];
      this.status = MachineStatus.Stopped;
      this.debug("unmounting...");
    }
    get service() {
      return {
        state: this.getState(),
        send: this.send,
        context: this.context,
        prop: this.prop,
        scope: this.scope,
        refs: this.refs,
        computed: this.computed,
        event: this.getEvent(),
        getStatus: () => this.status
      };
    }
  };

  // src/product-style-props.js
  function spreadProps2(node, props) {
    const { style, ...attributes } = props;
    const restore = [];
    for (const declaration of String(style || "").split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const name = declaration.slice(0, colon).trim(), value = declaration.slice(colon + 1).trim();
      restore.push([name, node.style.getPropertyValue(name), node.style.getPropertyPriority(name)]);
      node.style.setProperty(name, value);
    }
    const cleanup = spreadProps(node, attributes);
    return () => {
      cleanup();
      for (const [name, value, priority] of restore) {
        if (value) node.style.setProperty(name, value, priority);
        else node.style.removeProperty(name);
      }
    };
  }

  // src/components/toasts.js
  function createToastManager(host, { id = "af-notifications", max = 4 } = {}) {
    const store = dist_exports.createStore({ placement: "bottom-end", max, gap: 8, offsets: "16px", removeDelay: 0, pauseOnPageIdle: true });
    const group2 = new VanillaMachine(dist_exports.group.machine, { id, store });
    const region = document.createElement("div");
    region.className = "af-toast-region";
    host.append(region);
    const children = /* @__PURE__ */ new Map();
    let disposed = false, pending = false;
    let regionCleanup = () => {
    };
    const childProps = (data, index) => ({ ...data, index, parent: group2.service, translations: { closeTriggerLabel: "\uC54C\uB9BC \uB2EB\uAE30" } });
    function mount(data, index) {
      const root = document.createElement("div");
      root.className = "af-toast";
      const title = document.createElement("strong");
      const description = document.createElement("div");
      const close = document.createElement("button");
      const action = document.createElement("button");
      for (const button of [close, action]) {
        button.className = "ui-button ui-button--compact";
        button.type = "button";
      }
      close.textContent = "\uB2EB\uAE30";
      root.append(title, description, action, close);
      region.append(root);
      const machine2 = new VanillaMachine(dist_exports.machine, childProps(data, index));
      let cleanups = [];
      const render2 = () => {
        cleanups.forEach((fn) => fn());
        const api = dist_exports.connect(machine2.service, normalizeProps);
        title.textContent = api.title ?? "";
        description.textContent = api.description ?? "";
        const current = machine2.service.prop("action");
        action.textContent = current?.label ?? "";
        action.hidden = !current;
        close.hidden = !api.closable;
        cleanups = [
          spreadProps2(root, api.getRootProps()),
          spreadProps2(title, api.getTitleProps()),
          spreadProps2(description, api.getDescriptionProps()),
          spreadProps2(close, api.getCloseTriggerProps()),
          spreadProps2(action, api.getActionTriggerProps())
        ];
      };
      render2();
      const unsubscribe2 = machine2.subscribe(render2);
      machine2.start();
      return { data, index, machine: machine2, destroy() {
        unsubscribe2();
        machine2.stop();
        cleanups.forEach((fn) => fn());
        root.remove();
      } };
    }
    function render() {
      if (disposed) return;
      regionCleanup();
      const api = dist_exports.group.connect(group2.service, normalizeProps);
      regionCleanup = spreadProps2(region, { ...api.getGroupProps(), "aria-label": "\uC54C\uB9BC (Alt+T)" });
      const data = api.getToasts();
      const ids = new Set(data.map((item) => item.id));
      for (const [id2, child] of children) if (!ids.has(id2)) {
        children.delete(id2);
        child.destroy();
      }
      data.forEach((item, index) => {
        const child = children.get(item.id);
        if (!child) children.set(item.id, mount(item, index));
        else if (child.data !== item || child.index !== index) {
          child.data = item;
          child.index = index;
          child.machine.updateProps(childProps(item, index));
        }
      });
    }
    function schedule() {
      if (pending || disposed) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        render();
      });
    }
    render();
    const unsubscribe = group2.subscribe(schedule);
    group2.start();
    return {
      store,
      show({ type = "info", duration, ...options }) {
        if (disposed) throw new Error("Toast manager is destroyed.");
        if (!["info", "success", "warning", "error", "loading"].includes(type)) throw new Error("Unknown toast type.");
        return store.create({ ...options, type, closable: true, duration: duration ?? (["error", "loading"].includes(type) ? Infinity : 5e3) });
      },
      update(id2, options) {
        return store.update(id2, options);
      },
      dismiss(id2) {
        store.dismiss(id2);
      },
      destroy() {
        disposed = true;
        unsubscribe();
        group2.stop();
        children.forEach((child) => child.destroy());
        children.clear();
        store.remove();
        regionCleanup();
        region.remove();
      }
    };
  }
  return __toCommonJS(toasts_exports);
})();
