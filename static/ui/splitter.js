var agentFactorySplitter = (() => {
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

  // src/components/splitter.js
  var splitter_exports = {};
  __export(splitter_exports, {
    createSplitPane: () => createSplitPane
  });

  // node_modules/@zag-js/vanilla/dist/chunk-QZ7TP4HQ.mjs
  var __defProp2 = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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
  function nextIndex(v, idx, opts = {}) {
    const { step = 1, loop = true } = opts;
    const next2 = idx + step;
    const len = v.length;
    const last2 = len - 1;
    if (idx === -1) return step > 0 ? 0 : last2;
    if (next2 < 0) return loop ? last2 : 0;
    if (next2 >= len) return loop ? 0 : idx > len ? len : idx;
    return next2;
  }
  function next(v, idx, opts = {}) {
    return v[nextIndex(v, idx, opts)];
  }
  function prevIndex(v, idx, opts = {}) {
    const { step = 1, loop = true } = opts;
    return nextIndex(v, idx, { step: -step, loop });
  }
  function prev(v, index, opts = {}) {
    return v[prevIndex(v, index, opts)];
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
  function splitProps(props2, keys2) {
    const rest = {};
    const result = {};
    const keySet = new Set(keys2);
    const ownKeys = Reflect.ownKeys(props2);
    for (const key of ownKeys) {
      if (keySet.has(key)) {
        result[key] = props2[key];
      } else {
        rest[key] = props2[key];
      }
    }
    return [result, rest];
  }
  var createSplitProps = (keys2) => {
    return function split(props2) {
      return splitProps(props2, keys2);
    };
  };

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
  function ensureProps(props2, keys, scope) {
    let missingKeys = [];
    for (const key of keys) {
      if (props2[key] == null) missingKeys.push(key);
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
  function buildStateIndex(machine3) {
    const index = /* @__PURE__ */ new Map();
    const idIndex = /* @__PURE__ */ new Map();
    const visit = (basePath, state2) => {
      index.set(basePath, state2);
      const stateId = state2.id;
      if (stateId) {
        if (idIndex.has(stateId)) {
          invariant(`[zag-js] Duplicate state id: "${stateId}"`);
        }
        idIndex.set(stateId, basePath);
      }
      const childStates = state2.states;
      if (!childStates) return;
      ensure(state2.initial, () => `[zag-js] Compound state "${basePath}" has child states but no "initial" property`);
      if (!(state2.initial in childStates)) {
        invariant(
          `[zag-js] Compound state "${basePath}" has initial "${String(state2.initial)}" which is not a child state`
        );
      }
      for (const [childKey, childState] of Object.entries(childStates)) {
        if (!childState) continue;
        const childPath = appendStatePath(basePath, childKey);
        visit(childPath, childState);
      }
    };
    for (const [topKey, topState] of Object.entries(machine3.states)) {
      if (!topState) continue;
      visit(topKey, topState);
    }
    return { index, idIndex };
  }
  function ensureStateIndex(machine3) {
    const cached = stateIndexCache.get(machine3);
    if (cached) return cached;
    const { index, idIndex } = buildStateIndex(machine3);
    stateIndexCache.set(machine3, index);
    stateIdIndexCache.set(machine3, idIndex);
    return index;
  }
  function getStatePathById(machine3, stateId) {
    ensureStateIndex(machine3);
    return stateIdIndexCache.get(machine3)?.get(stateId);
  }
  function toSegments(value) {
    if (!value) return [];
    return String(value).split(STATE_DELIMITER).filter(Boolean);
  }
  function getStateChain(machine3, state2) {
    if (!state2) return [];
    const stateIndex = ensureStateIndex(machine3);
    const segments = toSegments(state2);
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
  function resolveAbsoluteStateValue(machine3, value) {
    const stateIndex = ensureStateIndex(machine3);
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
  function hasStatePath(machine3, value) {
    const stateIndex = ensureStateIndex(machine3);
    return stateIndex.has(value);
  }
  function resolveStateValue(machine3, value, source) {
    const stateValue = String(value);
    if (isExplicitAbsoluteStatePath(stateValue)) {
      const stateId = stripAbsolutePrefix(stateValue);
      const statePath = getStatePathById(machine3, stateId);
      ensure(statePath, () => `[zag-js] Unknown state id: "${stateId}"`);
      return resolveAbsoluteStateValue(machine3, statePath);
    }
    if (isChildTarget(stateValue) && source) {
      const childPath = appendStatePath(source, stateValue.slice(1));
      return resolveAbsoluteStateValue(machine3, childPath);
    }
    if (!isAbsoluteStatePath(stateValue) && source) {
      const sourceSegments = toSegments(source);
      for (let index = sourceSegments.length - 1; index >= 1; index--) {
        const base = sourceSegments.slice(0, index).join(STATE_DELIMITER);
        const candidate = appendStatePath(base, stateValue);
        if (hasStatePath(machine3, candidate)) return resolveAbsoluteStateValue(machine3, candidate);
      }
      if (hasStatePath(machine3, stateValue)) return resolveAbsoluteStateValue(machine3, stateValue);
    }
    return resolveAbsoluteStateValue(machine3, stateValue);
  }
  function findTransition(machine3, state2, eventType) {
    const chain = getStateChain(machine3, state2);
    for (let index = chain.length - 1; index >= 0; index--) {
      const transitionMap = chain[index]?.state.on;
      const transition = transitionMap?.[eventType];
      if (transition) return { transitions: transition, source: chain[index]?.path };
    }
    const rootTransitionMap = machine3.on;
    return { transitions: rootTransitionMap?.[eventType], source: void 0 };
  }
  function getExitEnterStates(machine3, prevState, nextState, reenter) {
    const prevChain = prevState ? getStateChain(machine3, prevState) : [];
    const nextChain = getStateChain(machine3, nextState);
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
  function hasTag(machine3, state2, tag) {
    return getStateChain(machine3, state2).some((item) => item.state.tags?.includes(tag));
  }

  // node_modules/@zag-js/core/dist/create-machine.mjs
  function createMachine(config) {
    ensureStateIndex(config);
    return config;
  }

  // node_modules/@zag-js/core/dist/types.mjs
  var MachineStatus = /* @__PURE__ */ ((MachineStatus2) => {
    MachineStatus2["NotStarted"] = "Not Started";
    MachineStatus2["Started"] = "Started";
    MachineStatus2["Stopped"] = "Stopped";
    return MachineStatus2;
  })(MachineStatus || {});
  var INIT_STATE = "__init__";

  // node_modules/@zag-js/dom-query/dist/chunk-QZ7TP4HQ.mjs
  var __defProp4 = Object.defineProperty;
  var __defNormalProp3 = (obj, key, value) => key in obj ? __defProp4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField3 = (obj, key, value) => __defNormalProp3(obj, typeof key !== "symbol" ? key + "" : key, value);

  // node_modules/@zag-js/dom-query/dist/shared.mjs
  var isObject = (v) => typeof v === "object" && v !== null;
  var dataAttr = (guard) => guard ? "" : void 0;
  var BACKSLASH_RE = /\\/g;
  var DOUBLE_QUOTE_RE = /"/g;
  var cssesc = (value) => globalThis.CSS?.escape?.(value) ?? value.replace(BACKSLASH_RE, "\\\\").replace(DOUBLE_QUOTE_RE, '\\"');
  var getByOwnerId = (id) => `[data-ownedby~="${cssesc(String(id))}"]`;

  // node_modules/@zag-js/dom-query/dist/node.mjs
  var ELEMENT_NODE = 1;
  var DOCUMENT_NODE = 9;
  var DOCUMENT_FRAGMENT_NODE = 11;
  var isElement = (el) => isObject(el) && el.nodeType === ELEMENT_NODE && typeof el.nodeName === "string";
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
  function getParentElement(node) {
    const parentNode = node.parentNode;
    if (isShadowRoot(parentNode)) return parentNode.host;
    return parentNode;
  }
  function getAncestorElements(node) {
    const ancestors = [];
    while (node) {
      ancestors.push(node);
      node = getParentElement(node);
    }
    return ancestors;
  }
  function contains(parent, child) {
    if (!parent || !child) return false;
    if (!isHTMLElement(parent) || !isNode(child)) return false;
    if (isHTMLElement(child) && parent === child) return true;
    if (parent.contains(child)) return true;
    const rootNode = child.getRootNode?.();
    if (rootNode && isShadowRoot(rootNode)) {
      let next2 = child;
      while (next2) {
        if (parent === next2) return true;
        next2 = next2.parentNode || next2.host;
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

  // node_modules/@zag-js/dom-query/dist/platform.mjs
  var isDom = () => typeof document !== "undefined";
  function getPlatform() {
    const agent = navigator.userAgentData;
    return agent?.platform ?? navigator.platform;
  }
  var pt = (v) => isDom() && v.test(getPlatform());
  var IPHONE_REGEX = /^iPhone/i;
  var IPAD_REGEX = /^iPad/i;
  var MAC_REGEX = /^Mac/i;
  var isIPhone = () => pt(IPHONE_REGEX);
  var isIPad = () => pt(IPAD_REGEX) || isMac() && navigator.maxTouchPoints > 1;
  var isIos = () => isIPhone() || isIPad();
  var isMac = () => pt(MAC_REGEX);

  // node_modules/@zag-js/dom-query/dist/event.mjs
  var isLeftClick = (e) => e.button === 0;
  var isTouchEvent = (event) => "touches" in event && event.touches.length > 0;
  var keyMap = {
    Up: "ArrowUp",
    Down: "ArrowDown",
    Esc: "Escape",
    " ": "Space",
    ",": "Comma",
    Left: "ArrowLeft",
    Right: "ArrowRight"
  };
  var rtlKeyMap = {
    ArrowLeft: "ArrowRight",
    ArrowRight: "ArrowLeft"
  };
  function getEventKey(event, options = {}) {
    const { dir = "ltr", orientation = "horizontal" } = options;
    let key = event.key;
    key = keyMap[key] ?? key;
    const isRtl = dir === "rtl" && orientation === "horizontal";
    if (isRtl && key in rtlKeyMap) key = rtlKeyMap[key];
    return key;
  }
  function getEventPoint(event, type = "client") {
    const point = isTouchEvent(event) ? event.touches[0] || event.changedTouches[0] : event;
    return { x: point[`${type}X`], y: point[`${type}Y`] };
  }
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
      __publicField3(this, "id", null);
      __publicField3(this, "fn_cleanup");
      __publicField3(this, "cleanup", () => {
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

  // node_modules/@zag-js/dom-query/dist/mutation-observer.mjs
  function observeChildrenImpl(node, options) {
    const { callback: fn } = options;
    if (!node) return;
    const win = node.ownerDocument.defaultView || window;
    const obs = new win.MutationObserver(fn);
    obs.observe(node, { childList: true, subtree: true });
    return () => obs.disconnect();
  }
  function observeChildren(nodeOrFn, options) {
    const { defer } = options;
    const func = defer ? raf : (v) => v();
    const cleanups = [];
    cleanups.push(
      func(() => {
        const node = typeof nodeOrFn === "function" ? nodeOrFn() : nodeOrFn;
        cleanups.push(observeChildrenImpl(node, options));
      })
    );
    return () => {
      cleanups.forEach((fn) => fn?.());
    };
  }

  // node_modules/@zag-js/dom-query/dist/text-selection.mjs
  var state = "default";
  var userSelect = "";
  var elementMap = /* @__PURE__ */ new WeakMap();
  function disableTextSelectionImpl(options = {}) {
    const { target, doc } = options;
    const docNode = doc ?? document;
    const rootEl = docNode.documentElement;
    if (isIos()) {
      if (state === "default") {
        userSelect = rootEl.style.webkitUserSelect;
        rootEl.style.webkitUserSelect = "none";
      }
      state = "disabled";
    } else if (target) {
      elementMap.set(target, target.style.userSelect);
      target.style.userSelect = "none";
    }
    return () => restoreTextSelection({ target, doc: docNode });
  }
  function restoreTextSelection(options = {}) {
    const { target, doc } = options;
    const docNode = doc ?? document;
    const rootEl = docNode.documentElement;
    if (isIos()) {
      if (state !== "disabled") return;
      state = "restoring";
      setTimeout(() => {
        nextTick(() => {
          if (state === "restoring") {
            if (rootEl.style.webkitUserSelect === "none") {
              rootEl.style.webkitUserSelect = userSelect || "";
            }
            userSelect = "";
            state = "default";
          }
        });
      }, 300);
    } else {
      if (target && elementMap.has(target)) {
        const prevUserSelect = elementMap.get(target);
        if (target.style.userSelect === "none") {
          target.style.userSelect = prevUserSelect ?? "";
        }
        if (target.getAttribute("style") === "") {
          target.removeAttribute("style");
        }
        elementMap.delete(target);
      }
    }
  }
  function disableTextSelection(options = {}) {
    const { defer, target, ...restOptions } = options;
    const func = defer ? raf : (v) => v();
    const cleanups = [];
    cleanups.push(
      func(() => {
        const node = typeof target === "function" ? target() : target;
        cleanups.push(disableTextSelectionImpl({ ...restOptions, target: node }));
      })
    );
    return () => {
      cleanups.forEach((fn) => fn?.());
    };
  }

  // node_modules/@zag-js/dom-query/dist/pointer-move.mjs
  function trackPointerMove(doc, handlers) {
    const { onPointerMove, onPointerUp } = handlers;
    const handleMove = (event) => {
      const point = getEventPoint(event);
      const distance = Math.sqrt(point.x ** 2 + point.y ** 2);
      const moveBuffer = event.pointerType === "touch" ? 10 : 5;
      if (distance < moveBuffer) return;
      if (event.pointerType === "mouse" && event.buttons === 0) {
        handleUp(event);
        return;
      }
      onPointerMove({ point, event });
    };
    const handleUp = (event) => {
      const point = getEventPoint(event);
      onPointerUp({ point, event });
    };
    const cleanups = [
      addDomEvent(doc, "pointermove", handleMove, false),
      addDomEvent(doc, "pointerup", handleUp, false),
      addDomEvent(doc, "pointercancel", handleUp, false),
      addDomEvent(doc, "contextmenu", handleUp, false),
      disableTextSelection({ doc })
    ];
    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }

  // node_modules/@zag-js/dom-query/dist/query.mjs
  function queryAll(root, selector) {
    return Array.from(root?.querySelectorAll(selector) ?? []);
  }

  // node_modules/@zag-js/dom-query/dist/resize-observer.mjs
  function createSharedResizeObserver(options) {
    const listeners = /* @__PURE__ */ new WeakMap();
    let observer;
    const entries = /* @__PURE__ */ new WeakMap();
    const getObserver = (win) => {
      if (observer) return observer;
      observer = new win.ResizeObserver((observedEntries) => {
        for (const entry of observedEntries) {
          entries.set(entry.target, entry);
          const elementListeners = listeners.get(entry.target);
          if (elementListeners) {
            for (const listener of elementListeners) {
              listener(entry);
            }
          }
        }
      });
      return observer;
    };
    const observe = (element, listener) => {
      let elementListeners = listeners.get(element) || /* @__PURE__ */ new Set();
      elementListeners.add(listener);
      listeners.set(element, elementListeners);
      const win = getWindow(element);
      getObserver(win).observe(element, options);
      return () => {
        const elementListeners2 = listeners.get(element);
        if (!elementListeners2) return;
        elementListeners2.delete(listener);
        if (elementListeners2.size === 0) {
          listeners.delete(element);
          getObserver(win).unobserve(element);
        }
      };
    };
    const unobserve = (element) => {
      listeners.delete(element);
      observer?.unobserve(element);
    };
    return {
      observe,
      unobserve
    };
  }
  var resizeObserverBorderBox = /* @__PURE__ */ createSharedResizeObserver({
    box: "border-box"
  });

  // node_modules/@zag-js/core/dist/scope.mjs
  function createScope(props2) {
    const getRootNode = () => props2.getRootNode?.() ?? document;
    const getDoc = () => getDocument(getRootNode());
    const getWin = () => getDoc().defaultView ?? window;
    const getActiveElementFn = () => getActiveElement(getRootNode());
    const getById = (id) => getRootNode().getElementById(id);
    return {
      ...props2,
      getRootNode,
      getDoc,
      getWin,
      getActiveElement: getActiveElementFn,
      isActiveElement,
      getById
    };
  }

  // node_modules/@zag-js/types/dist/prop-types.mjs
  function createNormalizer(fn) {
    return new Proxy({}, {
      get(_target, key) {
        if (key === "style")
          return (props2) => {
            return fn({ style: props2 }).style;
          };
        return fn;
      }
    });
  }

  // node_modules/@zag-js/types/dist/create-props.mjs
  var createProps = () => (props2) => Array.from(new Set(props2));

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
  var normalizeProps = createNormalizer((props2) => {
    return Object.entries(props2).reduce((acc, [key, value]) => {
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
    const setup = (attr) => addEvt(attr.substring(2), attrs[attr]);
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
    attrKeys.filter(onEvents).forEach(setup);
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
  var isElement2 = (x) => isReactElement2(x) || isVueElement2(x) || isDOMElement(x);
  var isObject2 = (x) => x !== null && typeof x === "object";
  var canProxy = (x) => isObject2(x) && !refSet.has(x) && (Array.isArray(x) || !(Symbol.iterator in x)) && !isElement2(x) && !(x instanceof WeakMap) && !(x instanceof WeakSet) && !(x instanceof Error) && !(x instanceof Number) && !(x instanceof Date) && !(x instanceof String) && !(x instanceof RegExp) && !(x instanceof ArrayBuffer) && !(x instanceof Promise) && !(x instanceof File) && !(x instanceof Blob) && !(x instanceof AbortController);
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
  function bindable(props2) {
    const initial = props2().value ?? props2().defaultValue;
    if (props2().debug) {
      console.log(`[bindable > ${props2().debug}] initial`, initial);
    }
    const eq = props2().isEqual ?? Object.is;
    const store = proxy({ value: initial });
    const controlled = () => props2().value !== void 0;
    return {
      initial,
      ref: store,
      get() {
        return controlled() ? props2().value : store.value;
      },
      set(nextValue) {
        const prev2 = controlled() ? props2().value : store.value;
        const next2 = isFunction(nextValue) ? nextValue(prev2) : nextValue;
        if (props2().debug) {
          console.log(`[bindable > ${props2().debug}] setValue`, { next: next2, prev: prev2 });
        }
        if (!controlled()) store.value = next2;
        if (!eq(next2, prev2)) {
          props2().onChange?.(next2, prev2);
        }
      },
      invoke(nextValue, prevValue) {
        props2().onChange?.(nextValue, prevValue);
      },
      hash(value) {
        return props2().hash?.(value) ?? String(value);
      }
    };
  }
  bindable.cleanup = (_fn) => {
  };
  bindable.ref = (defaultValue) => {
    let value = defaultValue;
    return {
      get: () => value,
      set: (next2) => {
        value = next2;
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
  function mergeMachineProps(prev2, next2) {
    if (!isPlainObject(prev2) || !isPlainObject(next2)) {
      return next2 === void 0 ? prev2 : next2;
    }
    const result = { ...prev2 };
    for (const key of Object.keys(next2)) {
      const nextValue = next2[key];
      const prevValue = prev2[key];
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
    constructor(machine3, userProps = {}) {
      __publicField(this, "machine", machine3);
      __publicField(this, "scope");
      __publicField(this, "context");
      __publicField(this, "prop");
      __publicField(this, "state");
      __publicField(this, "refs");
      __publicField(this, "computed");
      __publicField(this, "event", { type: "" });
      __publicField(this, "previousEvent", { type: "" });
      __publicField(this, "effects", /* @__PURE__ */ new Map());
      __publicField(this, "transition", null);
      __publicField(this, "cleanups", []);
      __publicField(this, "subscriptions", []);
      __publicField(this, "userPropsRef");
      __publicField(this, "getEvent", () => ({
        ...this.event,
        current: () => this.event,
        previous: () => this.previousEvent
      }));
      __publicField(this, "getState", () => ({
        ...this.state,
        matches: (...values) => values.some((value) => matchesState(this.state.get(), value)),
        hasTag: (tag) => hasTag(this.machine, this.state.get(), tag)
      }));
      __publicField(this, "debug", (...args) => {
        if (this.machine.debug) console.log(...args);
      });
      __publicField(this, "notify", () => {
        this.publish();
      });
      __publicField(this, "send", (event) => {
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
      __publicField(this, "action", (keys) => {
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
      __publicField(this, "guard", (str) => {
        if (isFunction(str)) return str(this.getParams());
        const fn = this.machine.implementations?.guards?.[str];
        if (!fn) warn(`[zag-js] No implementation found for guard "${JSON.stringify(str)}"`);
        return fn?.(this.getParams());
      });
      __publicField(this, "effect", (keys) => {
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
      __publicField(this, "choose", (transitions) => {
        return toArray(transitions).find((t) => {
          let result = !t.guard;
          if (isString(t.guard)) result = !!this.guard(t.guard);
          else if (isFunction(t.guard)) result = t.guard(this.getParams());
          return result;
        });
      });
      __publicField(this, "subscribe", (fn) => {
        this.subscriptions.push(fn);
        return () => {
          const index = this.subscriptions.indexOf(fn);
          if (index > -1) this.subscriptions.splice(index, 1);
        };
      });
      __publicField(this, "status", MachineStatus.NotStarted);
      __publicField(this, "publish", () => {
        this.callTrackers();
        this.subscriptions.forEach((fn) => fn(this.service));
      });
      __publicField(this, "trackers", []);
      __publicField(this, "setupTrackers", () => {
        this.machine.watch?.(this.getParams());
      });
      __publicField(this, "callTrackers", () => {
        this.trackers.forEach(({ deps, fn }) => {
          const next2 = deps.map((dep) => dep());
          if (!isEqual(fn.prev, next2)) {
            fn();
            fn.prev = next2;
          }
        });
      });
      __publicField(this, "getParams", () => ({
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
        const props2 = machine3.props?.({ props: compact(__props), scope: this.scope }) ?? __props;
        return props2[key];
      };
      this.prop = prop;
      const context = machine3.context?.({
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
        ensure(machine3.computed, () => `[zag-js] No computed object found on machine`);
        return machine3.computed[key]({
          context: ctx,
          event: this.getEvent(),
          prop,
          refs: this.refs,
          scope: this.scope,
          computed
        });
      };
      this.computed = computed;
      const refs = createRefs(machine3.refs?.({ prop, context: ctx }) ?? {});
      this.refs = refs;
      const state2 = bindable(() => ({
        defaultValue: resolveStateValue(machine3, machine3.initialState({ prop })),
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
            this.action(machine3.entry);
            const cleanup = this.effect(machine3.effects);
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
      this.state = state2;
      this.cleanups.push(subscribe(this.state.ref, () => this.notify()));
    }
    updateProps(newProps) {
      const prevSource = this.userPropsRef.current;
      this.userPropsRef.current = () => {
        const prev2 = runIfFn(prevSource);
        const next2 = runIfFn(newProps);
        return mergeMachineProps(prev2, next2);
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
  function spreadProps2(node, props2) {
    const { style, ...attributes } = props2;
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

  // node_modules/@zag-js/splitter/dist/index.mjs
  var dist_exports = {};
  __export(dist_exports, {
    anatomy: () => anatomy,
    connect: () => connect,
    layout: () => getPanelLayout,
    machine: () => machine,
    panelProps: () => panelProps,
    props: () => props,
    registry: () => registry,
    resizeTriggerProps: () => resizeTriggerProps,
    splitPanelProps: () => splitPanelProps,
    splitProps: () => splitProps2,
    splitResizeTriggerProps: () => splitResizeTriggerProps
  });

  // node_modules/@zag-js/splitter/dist/chunk-QZ7TP4HQ.mjs
  var __defProp5 = Object.defineProperty;
  var __defNormalProp4 = (obj, key, value) => key in obj ? __defProp5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField4 = (obj, key, value) => __defNormalProp4(obj, typeof key !== "symbol" ? key + "" : key, value);

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
      (prev2, part) => Object.assign(prev2, {
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

  // node_modules/@zag-js/splitter/dist/splitter.anatomy.mjs
  var anatomy = createAnatomy("splitter").parts("root", "panel", "resizeTrigger", "resizeTriggerIndicator");
  var parts = anatomy.build();

  // node_modules/@zag-js/splitter/dist/splitter.dom.mjs
  var getRootId = (ctx) => ctx.ids?.root ?? `splitter:${ctx.id}`;
  var getResizeTriggerId = (ctx, id) => ctx.ids?.resizeTrigger?.(id) ?? `splitter:${ctx.id}:splitter:${id}`;
  var getPanelId = (ctx, id) => ctx.ids?.panel?.(id) ?? `splitter:${ctx.id}:panel:${id}`;
  var getGlobalCursorId = (ctx) => `splitter:${ctx.id}:global-cursor`;
  var getRootEl = (ctx) => ctx.getById(getRootId(ctx));
  var getResizeTriggerEl = (ctx, id) => id != null ? ctx.getById(getResizeTriggerId(ctx, id)) : null;
  var getPanelIdFromEl = (el) => {
    return isHTMLElement(el) && el.dataset.part === "panel" ? el.dataset.id : void 0;
  };
  var getPrevPanelId = (el) => {
    let prev2 = el?.previousElementSibling ?? null;
    while (prev2) {
      const id = getPanelIdFromEl(prev2);
      if (id) return id;
      prev2 = prev2.previousElementSibling;
    }
  };
  var getNextPanelId = (el) => {
    let next2 = el?.nextElementSibling ?? null;
    while (next2) {
      const id = getPanelIdFromEl(next2);
      if (id) return id;
      next2 = next2.nextElementSibling;
    }
  };
  var resolveResizeTriggerId = (ctx, id) => {
    const [beforeId, afterId] = id.split(":");
    if (beforeId && afterId) return id;
    const triggerEl = getResizeTriggerEl(ctx, id);
    const resolvedBeforeId = beforeId || getPrevPanelId(triggerEl);
    const resolvedAfterId = afterId || getNextPanelId(triggerEl);
    return resolvedBeforeId && resolvedAfterId ? `${resolvedBeforeId}:${resolvedAfterId}` : null;
  };
  var getCursor = (state2, x) => {
    let cursor = x ? "col-resize" : "row-resize";
    if (state2.isAtMin) cursor = x ? "e-resize" : "s-resize";
    if (state2.isAtMax) cursor = x ? "w-resize" : "n-resize";
    return cursor;
  };
  var getResizeTriggerEls = (ctx) => {
    return queryAll(getRootEl(ctx), `[role=separator]${getByOwnerId(getRootId(ctx))}`);
  };
  var getGlobalCursorEl = (ctx) => {
    return ctx.getDoc().getElementById(getGlobalCursorId(ctx));
  };
  var setupGlobalCursor = (ctx, state2, x, nonce) => {
    const styleEl = getGlobalCursorEl(ctx);
    const textContent = `* { cursor: ${getCursor(state2, x)} !important; }`;
    if (styleEl) {
      styleEl.textContent = textContent;
    } else {
      const style = ctx.getDoc().createElement("style");
      if (nonce) style.nonce = nonce;
      style.id = getGlobalCursorId(ctx);
      style.textContent = textContent;
      ctx.getDoc().head.appendChild(style);
    }
  };
  var removeGlobalCursor = (ctx) => {
    const styleEl = getGlobalCursorEl(ctx);
    styleEl?.remove();
  };

  // node_modules/@zag-js/splitter/dist/utils/aria.mjs
  function calculateAriaValues({
    size,
    panels,
    pivotIndices
  }) {
    let currentMinSize = 0;
    let currentMaxSize = 100;
    let totalMinSize = 0;
    let totalMaxSize = 0;
    const firstIndex = pivotIndices[0];
    ensure(firstIndex, () => "No pivot index found");
    panels.forEach((panel, index) => {
      const { maxSize = 100, minSize = 0 } = panel;
      if (index === firstIndex) {
        currentMinSize = minSize;
        currentMaxSize = maxSize;
      } else {
        totalMinSize += minSize;
        totalMaxSize += maxSize;
      }
    });
    const valueMax = Math.min(currentMaxSize, 100 - totalMinSize);
    const valueMin = Math.max(currentMinSize, 100 - totalMaxSize);
    const valueNow = size[firstIndex];
    return {
      valueMax,
      valueMin,
      valueNow
    };
  }
  function getAriaValue(size, panels, handleId) {
    const [beforeId, afterId] = handleId.split(":");
    const beforeIndex = panels.findIndex((panel) => panel.id === beforeId);
    const afterIndex = panels.findIndex((panel) => panel.id === afterId);
    if (beforeIndex === -1 || afterIndex === -1) {
      return {
        beforeId: beforeId || void 0,
        afterId: afterId || void 0,
        valueMax: void 0,
        valueMin: void 0,
        valueNow: void 0
      };
    }
    const { valueMax, valueMin, valueNow } = calculateAriaValues({
      size,
      panels,
      pivotIndices: [beforeIndex, afterIndex]
    });
    return {
      beforeId,
      afterId,
      valueMax: Math.round(valueMax),
      valueMin: Math.round(valueMin),
      valueNow: valueNow != null ? Math.round(valueNow) : void 0
    };
  }

  // node_modules/@zag-js/splitter/dist/utils/fuzzy.mjs
  var PRECISION = 10;
  function fuzzyCompareNumbers(actual, expected, fractionDigits = PRECISION) {
    if (actual.toFixed(fractionDigits) === expected.toFixed(fractionDigits)) {
      return 0;
    } else {
      return actual > expected ? 1 : -1;
    }
  }
  function fuzzyNumbersEqual(actual, expected, fractionDigits = PRECISION) {
    if (actual == null || expected == null) return false;
    return fuzzyCompareNumbers(actual, expected, fractionDigits) === 0;
  }
  function fuzzySizeEqual(actual, expected, fractionDigits) {
    if (actual.length !== expected.length) {
      return false;
    }
    for (let index = 0; index < actual.length; index++) {
      const actualSize = actual[index];
      const expectedSize = expected[index];
      if (!fuzzyNumbersEqual(actualSize, expectedSize, fractionDigits)) {
        return false;
      }
    }
    return true;
  }

  // node_modules/@zag-js/splitter/dist/utils/size.mjs
  var sizeRegex = /^(-?\d*\.?\d+)(%|px|em|rem|vw|vh)?$/;
  var percentRegex = /^(-?\d*\.?\d+)%$/;
  function getRootSize(rootEl, orientation) {
    if (!rootEl) return 0;
    const rect = rootEl.getBoundingClientRect();
    return orientation === "horizontal" ? rect.width : rect.height;
  }
  function getGroupSize(rootEl, orientation) {
    return getRootSize(rootEl, orientation);
  }
  function toPixelValue(value, unit, rootEl) {
    const win = rootEl.ownerDocument.defaultView;
    if (!win) return void 0;
    switch (unit) {
      case "px":
        return value;
      case "em": {
        const fontSize = Number.parseFloat(win.getComputedStyle(rootEl).fontSize);
        return value * fontSize;
      }
      case "rem": {
        const fontSize = Number.parseFloat(win.getComputedStyle(rootEl.ownerDocument.documentElement).fontSize);
        return value * fontSize;
      }
      case "vw":
        return value / 100 * win.innerWidth;
      case "vh":
        return value / 100 * win.innerHeight;
      default:
        return void 0;
    }
  }
  function parsePanelSize(size, rootEl, orientation) {
    if (size == null) return void 0;
    if (typeof size === "number") {
      return size;
    }
    const match = size.trim().match(sizeRegex);
    if (!match) return void 0;
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value)) return void 0;
    const unit = match[2];
    if (unit == null || unit === "%") {
      return value;
    }
    if (!rootEl) return void 0;
    const rootSize = getRootSize(rootEl, orientation);
    if (rootSize === 0) return void 0;
    const px = toPixelValue(value, unit, rootEl);
    return px == null ? void 0 : px / rootSize * 100;
  }
  function toCssPanelSize(size) {
    if (size == null) return void 0;
    if (typeof size === "number") {
      return `${size}%`;
    }
    const trimmed = size.trim();
    if (percentRegex.test(trimmed)) {
      return trimmed;
    }
    const match = trimmed.match(sizeRegex);
    if (!match) return void 0;
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value)) return void 0;
    const unit = match[2];
    return unit == null ? `${value}%` : `${value}${unit}`;
  }
  function resolvePanelSizes({
    sizes,
    panels,
    rootEl,
    orientation
  }) {
    const nextSize = Array(panels.length);
    let remainingSize = 100;
    let numPanelsWithSizes = 0;
    for (let index = 0; index < panels.length; index++) {
      const size = parsePanelSize(sizes?.[index], rootEl, orientation);
      if (size == null) continue;
      numPanelsWithSizes++;
      nextSize[index] = size;
      remainingSize -= size;
    }
    for (let index = 0; index < panels.length; index++) {
      if (nextSize[index] != null) continue;
      const numRemainingPanels = panels.length - numPanelsWithSizes;
      const size = numRemainingPanels > 0 ? remainingSize / numRemainingPanels : 0;
      numPanelsWithSizes++;
      nextSize[index] = size;
      remainingSize -= size;
    }
    return nextSize;
  }
  function normalizePanels(panels, rootEl, orientation) {
    return panels.map((panel) => ({
      ...panel,
      minSize: parsePanelSize(panel.minSize, rootEl, orientation),
      maxSize: parsePanelSize(panel.maxSize, rootEl, orientation),
      collapsedSize: parsePanelSize(panel.collapsedSize, rootEl, orientation)
    }));
  }

  // node_modules/@zag-js/splitter/dist/utils/panel.mjs
  function getPanelById(panels, id) {
    const panel = panels.find((panel2) => panel2.id === id);
    ensure(panel, () => `Panel data not found for id "${id}"`);
    return panel;
  }
  function findPanelDataIndex(panels, panel) {
    return panels.findIndex((prevPanel) => prevPanel === panel || prevPanel.id === panel.id);
  }
  function findPanelIndex(panels, id) {
    return panels.findIndex((panel) => panel.id === id);
  }
  function panelDataHelper(panels, panel, sizes) {
    const index = findPanelIndex(panels, panel.id);
    const pivotIndices = index === panels.length - 1 ? [index - 1, index] : [index, index + 1];
    const panelSize = sizes[index];
    return { ...panel, panelSize, pivotIndices };
  }
  function sortPanels(panels) {
    return panels.sort((panelA, panelB) => {
      const orderA = panelA.order;
      const orderB = panelB.order;
      if (orderA == null && orderB == null) {
        return 0;
      } else if (orderA == null) {
        return -1;
      } else if (orderB == null) {
        return 1;
      } else {
        return orderA - orderB;
      }
    });
  }
  function getPanelLayout(panels) {
    return panels.map((panel) => panel.id).sort().join(":");
  }
  function serializePanels(panels) {
    const keys = panels.map((panel) => panel.id);
    const sortedKeys = keys.sort();
    const serialized = sortedKeys.map((key) => {
      const panel = panels.find((panel2) => panel2.id === key);
      return JSON.stringify(panel);
    });
    return serialized.join(",");
  }
  function getPanelFlexBoxStyle({
    size,
    defaultSize,
    dragState,
    resolvedSizes,
    panels,
    panelIndex,
    horizontal,
    collapsed = false,
    precision = 3
  }) {
    const resolvedSize = resolvedSizes[panelIndex];
    const layoutSize = size ?? defaultSize;
    const panel = panels[panelIndex];
    let flexGrow;
    let flexBasis;
    let flexShrink = 1;
    const constraintAxis = horizontal ? "Width" : "Height";
    const minSizeCss = panel ? toCssPanelSize(panel.minSize) : void 0;
    const maxSize = panel ? toCssPanelSize(panel.maxSize) : void 0;
    const minSize = collapsed ? toCssPanelSize(panel?.collapsedSize ?? 0) : minSizeCss;
    const layoutCssSize = toCssPanelSize(layoutSize);
    if (resolvedSize == null) {
      if (layoutCssSize != null) {
        if (layoutCssSize.endsWith("%")) {
          flexGrow = Number.parseFloat(layoutCssSize).toPrecision(precision);
        } else {
          flexBasis = getClampedFlexBasis({
            basis: layoutCssSize,
            minSize: minSizeCss,
            maxSize
          });
          flexGrow = "0";
          flexShrink = 0;
        }
      } else {
        flexGrow = "1";
      }
    } else if (panels.length === 1) {
      flexGrow = "1";
    } else {
      flexGrow = resolvedSize.toPrecision(precision);
    }
    return {
      flexBasis: flexBasis ?? 0,
      flexGrow,
      flexShrink,
      ...minSize ? { [`min${constraintAxis}`]: minSize } : {},
      ...maxSize ? { [`max${constraintAxis}`]: maxSize } : {},
      // Without this, Panel sizes may be unintentionally overridden by their content
      overflow: "hidden",
      // Disable pointer events inside of a panel during resize
      // This avoid edge cases like nested iframes
      pointerEvents: dragState !== null ? "none" : void 0
    };
  }
  function getClampedFlexBasis({
    basis,
    minSize,
    maxSize
  }) {
    return `clamp(${minSize ?? "0%"}, ${basis}, ${maxSize ?? "100%"})`;
  }

  // node_modules/@zag-js/splitter/dist/splitter.connect.mjs
  function connect(service, normalize) {
    const { state: state2, send, prop, computed, context, scope } = service;
    const horizontal = computed("horizontal");
    const dragging = state2.matches("dragging");
    const registry2 = prop("registry");
    const orientation = prop("orientation");
    const rawPanels = prop("panels");
    const panels = context.get("panels");
    const getResolvedSizes = () => {
      const sizes = context.get("size");
      if (sizes.length > 0) return sizes;
      return resolvePanelSizes({
        sizes: prop("size") ?? prop("defaultSize"),
        panels: rawPanels,
        rootEl: null,
        orientation
      });
    };
    const getPanelStyle = (id) => {
      const panelIndex = rawPanels.findIndex((panel) => panel.id === id);
      const size = prop("size")?.[panelIndex];
      const defaultSize = prop("defaultSize")?.[panelIndex];
      const dragState = context.get("dragState");
      const resolvedSizes = context.get("size");
      const panelData = panels[panelIndex];
      const panelSize = resolvedSizes[panelIndex];
      const collapsed = !!panelData?.collapsible && panelSize != null && fuzzyNumbersEqual(panelSize, panelData.collapsedSize ?? 0);
      return getPanelFlexBoxStyle({
        size,
        defaultSize,
        dragState,
        resolvedSizes,
        panels: rawPanels,
        panelIndex,
        horizontal,
        collapsed
      });
    };
    const resolveResizeTriggerId2 = (id) => {
      const [beforeId, afterId] = id.split(":");
      if (beforeId && afterId) return id;
      if (beforeId) {
        const index = rawPanels.findIndex((panel) => panel.id === beforeId);
        const nextPanel = rawPanels[index + 1];
        return nextPanel ? `${beforeId}:${nextPanel.id}` : id;
      }
      if (afterId) {
        const index = rawPanels.findIndex((panel) => panel.id === afterId);
        const prevPanel = rawPanels[index - 1];
        return prevPanel ? `${prevPanel.id}:${afterId}` : id;
      }
      return id;
    };
    const getResizeTriggerState = (props2) => {
      const { id, disabled } = props2;
      const dragging2 = context.get("dragState")?.resizeTriggerId === id;
      const focused = dragging2 || state2.matches("focused") && context.get("keyboardState")?.resizeTriggerId === id;
      return {
        dragging: dragging2,
        focused,
        disabled: !!disabled
      };
    };
    return {
      dragging,
      orientation,
      getPanels() {
        return rawPanels;
      },
      getPanelById(id) {
        return getPanelById(rawPanels, id);
      },
      getItems() {
        return rawPanels.flatMap((panel, index, arr) => {
          const nextPanel = arr[index + 1];
          if (panel && nextPanel) {
            return [
              { type: "panel", id: panel.id },
              { type: "handle", id: `${panel.id}:${nextPanel.id}` }
            ];
          }
          return [{ type: "panel", id: panel.id }];
        });
      },
      getSizes() {
        return getResolvedSizes();
      },
      setSizes(size) {
        send({ type: "SIZE.SET", size });
      },
      resetSizes() {
        send({ type: "SIZE.RESET" });
      },
      collapsePanel(id) {
        send({ type: "PANEL.COLLAPSE", id });
      },
      expandPanel(id, minSize) {
        send({ type: "PANEL.EXPAND", id, minSize });
      },
      resizePanel(id, unsafePanelSize) {
        send({ type: "PANEL.RESIZE", id, size: unsafePanelSize });
      },
      getPanelSize(id) {
        const panels2 = context.get("panels");
        const size = getResolvedSizes();
        const panelData = getPanelById(panels2, id);
        const { panelSize } = panelDataHelper(panels2, panelData, size);
        ensure(panelSize != null, () => `Panel size not found for panel "${panelData.id}"`);
        return panelSize;
      },
      isPanelCollapsed(id) {
        const panels2 = context.get("panels");
        const size = getResolvedSizes();
        const panelData = getPanelById(panels2, id);
        const { collapsedSize = 0, collapsible, panelSize } = panelDataHelper(panels2, panelData, size);
        ensure(panelSize != null, () => `Panel size not found for panel "${panelData.id}"`);
        return collapsible === true && fuzzyNumbersEqual(panelSize, collapsedSize);
      },
      isPanelExpanded(id) {
        const panels2 = context.get("panels");
        const size = getResolvedSizes();
        const panelData = getPanelById(panels2, id);
        const { collapsedSize = 0, collapsible, panelSize } = panelDataHelper(panels2, panelData, size);
        ensure(panelSize != null, () => `Panel size not found for panel "${panelData.id}"`);
        return !collapsible || fuzzyCompareNumbers(panelSize, collapsedSize) > 0;
      },
      getLayout() {
        return getPanelLayout(prop("panels"));
      },
      getRootProps() {
        return normalize.element({
          ...parts.root.attrs,
          "data-orientation": orientation,
          "data-dragging": dataAttr(dragging),
          id: getRootId(scope),
          dir: prop("dir"),
          style: {
            display: "flex",
            flexDirection: horizontal ? "row" : "column",
            height: "100%",
            width: "100%",
            overflow: "hidden"
          }
        });
      },
      getPanelProps(props2) {
        const { id } = props2;
        return normalize.element({
          ...parts.panel.attrs,
          "data-orientation": orientation,
          "data-dragging": dataAttr(dragging),
          dir: prop("dir"),
          "data-id": id,
          "data-index": findPanelIndex(prop("panels"), id),
          id: getPanelId(scope, id),
          "data-ownedby": getRootId(scope),
          style: getPanelStyle(id)
        });
      },
      getResizeTriggerState,
      getResizeTriggerIndicator(props2) {
        const triggerState = getResizeTriggerState(props2);
        return normalize.element({
          ...parts.resizeTriggerIndicator.attrs,
          "data-orientation": orientation,
          "data-focus": dataAttr(triggerState.focused),
          "data-dragging": dataAttr(triggerState.dragging),
          "data-disabled": dataAttr(triggerState.disabled),
          "data-ownedby": getRootId(scope)
        });
      },
      getResizeTriggerProps(props2) {
        const { id } = props2;
        const triggerState = getResizeTriggerState(props2);
        const resolvedId = resolveResizeTriggerId2(id);
        const aria = getAriaValue(getResolvedSizes(), panels, resolvedId);
        return normalize.element({
          ...parts.resizeTrigger.attrs,
          dir: prop("dir"),
          id: getResizeTriggerId(scope, id),
          role: "separator",
          "data-id": id,
          "data-ownedby": getRootId(scope),
          tabIndex: triggerState.disabled ? void 0 : 0,
          "aria-valuenow": aria.valueNow,
          "aria-valuemin": aria.valueMin,
          "aria-valuemax": aria.valueMax,
          "data-orientation": orientation,
          "aria-orientation": orientation,
          "aria-controls": aria.beforeId && aria.afterId ? `${getPanelId(scope, aria.beforeId)} ${getPanelId(scope, aria.afterId)}` : void 0,
          "data-focus": dataAttr(triggerState.focused),
          "data-dragging": dataAttr(triggerState.dragging),
          "data-disabled": dataAttr(triggerState.disabled),
          style: {
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            flex: "0 0 auto",
            pointerEvents: triggerState.disabled ? "none" : triggerState.dragging && !triggerState.focused ? "none" : void 0,
            cursor: triggerState.disabled || registry2 ? void 0 : horizontal ? "col-resize" : "row-resize",
            [horizontal ? "minHeight" : "minWidth"]: "0"
          },
          onPointerDown(event) {
            if (!isLeftClick(event)) return;
            if (triggerState.disabled) {
              event.preventDefault();
              return;
            }
            event.currentTarget.focus({ preventScroll: true, focusVisible: false });
            if (registry2) {
              return;
            }
            const point = getEventPoint(event);
            send({ type: "POINTER_DOWN", id, point });
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
            event.stopPropagation();
          },
          onPointerUp(event) {
            if (triggerState.disabled) return;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          },
          onPointerOver() {
            if (triggerState.disabled || registry2) return;
            send({ type: "POINTER_OVER", id });
          },
          onPointerLeave() {
            if (triggerState.disabled || registry2) return;
            send({ type: "POINTER_LEAVE", id });
          },
          onBlur() {
            if (triggerState.disabled) return;
            send({ type: "BLUR" });
          },
          onFocus() {
            if (triggerState.disabled) return;
            send({ type: "FOCUS", id });
          },
          onKeyDown(event) {
            if (event.defaultPrevented) return;
            if (triggerState.disabled) return;
            const keyboardResizeBy = prop("keyboardResizeBy");
            let delta = 0;
            if (event.shiftKey) {
              delta = 10;
            } else if (keyboardResizeBy != null) {
              delta = keyboardResizeBy;
            } else {
              delta = 1;
            }
            const keyMap2 = {
              Enter() {
                send({ type: "ENTER", id });
              },
              ArrowUp() {
                send({ type: "KEYBOARD_MOVE", id, delta: horizontal ? 0 : -delta });
              },
              ArrowDown() {
                send({ type: "KEYBOARD_MOVE", id, delta: horizontal ? 0 : delta });
              },
              ArrowLeft() {
                send({ type: "KEYBOARD_MOVE", id, delta: horizontal ? -delta : 0 });
              },
              ArrowRight() {
                send({ type: "KEYBOARD_MOVE", id, delta: horizontal ? delta : 0 });
              },
              Home() {
                send({ type: "KEYBOARD_MOVE", id, delta: -100 });
              },
              End() {
                send({ type: "KEYBOARD_MOVE", id, delta: 100 });
              },
              F6() {
                send({ type: "FOCUS.CYCLE", id, shiftKey: event.shiftKey });
              }
            };
            const key = getEventKey(event, {
              dir: prop("dir"),
              orientation
            });
            const exec = keyMap2[key];
            if (exec) {
              exec(event);
              event.preventDefault();
            }
          }
        });
      }
    };
  }

  // node_modules/@zag-js/splitter/dist/utils/preserve-fixed-panel-sizes.mjs
  function preserveFixedPanelSizes({
    panels,
    prevLayout,
    prevGroupSize,
    nextGroupSize
  }) {
    if (prevGroupSize <= 0 || nextGroupSize <= 0) {
      return prevLayout;
    }
    const nextLayout = [...prevLayout];
    const relativeIndices = [];
    let fixedTotal = 0;
    let relativeTotal = 0;
    panels.forEach((panel, index) => {
      if (panel.resizeBehavior === "preserve-pixel-size") {
        const prevPixelSize = prevLayout[index] / 100 * prevGroupSize;
        const nextPercentSize = prevPixelSize / nextGroupSize * 100;
        nextLayout[index] = nextPercentSize;
        fixedTotal += nextPercentSize;
      } else {
        relativeIndices.push(index);
        relativeTotal += prevLayout[index];
      }
    });
    if (relativeIndices.length === 0) {
      const total2 = nextLayout.reduce((accumulated, current) => accumulated + current, 0);
      if (fuzzyNumbersEqual(total2, 100)) {
        return nextLayout;
      }
      if (total2 <= 0) {
        return prevLayout;
      }
      const scale2 = 100 / total2;
      return nextLayout.map((size) => size * scale2);
    }
    const remainingSize = 100 - fixedTotal;
    if (remainingSize <= 0) {
      const total2 = nextLayout.reduce((accumulated, current) => accumulated + current, 0);
      if (fuzzyNumbersEqual(total2, 100)) {
        return nextLayout;
      }
      const scale2 = 100 / Math.max(total2, 1);
      return nextLayout.map((size) => size * scale2);
    }
    if (fuzzyNumbersEqual(relativeTotal, 0)) {
      const size = remainingSize / relativeIndices.length;
      relativeIndices.forEach((index) => {
        nextLayout[index] = size;
      });
      return nextLayout;
    }
    relativeIndices.forEach((index) => {
      nextLayout[index] = prevLayout[index] / relativeTotal * remainingSize;
    });
    const total = nextLayout.reduce((accumulated, current) => accumulated + current, 0);
    if (fuzzyNumbersEqual(total, 100)) {
      return nextLayout;
    }
    const scale = 100 / total;
    return nextLayout.map((size) => size * scale);
  }

  // node_modules/@zag-js/splitter/dist/utils/resize-panel.mjs
  function resizePanel({ panels, index, size }) {
    const panel = panels[index];
    ensure(panel, () => `Panel data not found for index ${index}`);
    let { collapsedSize = 0, collapsible, maxSize = 100, minSize = 0 } = panel;
    if (fuzzyCompareNumbers(size, minSize) < 0) {
      if (collapsible) {
        const halfwayPoint = (collapsedSize + minSize) / 2;
        if (fuzzyCompareNumbers(size, halfwayPoint) < 0) {
          size = collapsedSize;
        } else {
          size = minSize;
        }
      } else {
        size = minSize;
      }
    }
    size = Math.min(maxSize, size);
    size = parseFloat(size.toFixed(PRECISION));
    return size;
  }

  // node_modules/@zag-js/splitter/dist/utils/resize-by-delta.mjs
  function resizeByDelta(props2) {
    let { delta, initialSize, panels, pivotIndices, prevSize, trigger } = props2;
    if (fuzzyNumbersEqual(delta, 0)) {
      return initialSize;
    }
    const nextSize = [...initialSize];
    const [firstPivotIndex, secondPivotIndex] = pivotIndices;
    ensure(firstPivotIndex, () => "Invalid first pivot index");
    ensure(secondPivotIndex, () => "Invalid second pivot index");
    let deltaApplied = 0;
    {
      if (trigger === "keyboard") {
        {
          const index = delta < 0 ? secondPivotIndex : firstPivotIndex;
          const panel = panels[index];
          ensure(panel, () => `Panel data not found for index ${index}`);
          const { collapsedSize = 0, collapsible, minSize = 0 } = panel;
          if (collapsible) {
            const prevSize2 = initialSize[index];
            ensure(prevSize2, () => `Previous size not found for panel index ${index}`);
            if (fuzzyNumbersEqual(prevSize2, collapsedSize)) {
              const localDelta = minSize - prevSize2;
              if (fuzzyCompareNumbers(localDelta, Math.abs(delta)) > 0) {
                delta = delta < 0 ? 0 - localDelta : localDelta;
              }
            }
          }
        }
        {
          const index = delta < 0 ? firstPivotIndex : secondPivotIndex;
          const panel = panels[index];
          ensure(panel, () => `No panel data found for index ${index}`);
          const { collapsedSize = 0, collapsible, minSize = 0 } = panel;
          if (collapsible) {
            const prevSize2 = initialSize[index];
            ensure(prevSize2, () => `Previous size not found for panel index ${index}`);
            if (fuzzyNumbersEqual(prevSize2, minSize)) {
              const localDelta = prevSize2 - collapsedSize;
              if (fuzzyCompareNumbers(localDelta, Math.abs(delta)) > 0) {
                delta = delta < 0 ? 0 - localDelta : localDelta;
              }
            }
          }
        }
      }
    }
    {
      const increment = delta < 0 ? 1 : -1;
      let index = delta < 0 ? secondPivotIndex : firstPivotIndex;
      let maxAvailableDelta = 0;
      while (true) {
        const prevSize2 = initialSize[index];
        ensure(prevSize2, () => `Previous size not found for panel index ${index}`);
        const maxSafeSize = resizePanel({
          panels,
          index,
          size: 100
        });
        const delta2 = maxSafeSize - prevSize2;
        maxAvailableDelta += delta2;
        index += increment;
        if (index < 0 || index >= panels.length) {
          break;
        }
      }
      const minAbsDelta = Math.min(Math.abs(delta), Math.abs(maxAvailableDelta));
      delta = delta < 0 ? 0 - minAbsDelta : minAbsDelta;
    }
    {
      const pivotIndex = delta < 0 ? firstPivotIndex : secondPivotIndex;
      let index = pivotIndex;
      while (index >= 0 && index < panels.length) {
        const deltaRemaining = Math.abs(delta) - Math.abs(deltaApplied);
        const prevSize2 = initialSize[index];
        ensure(prevSize2, () => `Previous size not found for panel index ${index}`);
        const unsafeSize = prevSize2 - deltaRemaining;
        const safeSize = resizePanel({ panels, index, size: unsafeSize });
        if (!fuzzyNumbersEqual(prevSize2, safeSize)) {
          deltaApplied += prevSize2 - safeSize;
          nextSize[index] = safeSize;
          if (deltaApplied.toPrecision(3).localeCompare(Math.abs(delta).toPrecision(3), void 0, {
            numeric: true
          }) >= 0) {
            break;
          }
        }
        if (delta < 0) {
          index--;
        } else {
          index++;
        }
      }
    }
    if (fuzzySizeEqual(prevSize, nextSize)) {
      return prevSize;
    }
    {
      const pivotIndex = delta < 0 ? secondPivotIndex : firstPivotIndex;
      const prevSize2 = initialSize[pivotIndex];
      ensure(prevSize2, () => `Previous size not found for panel index ${pivotIndex}`);
      const unsafeSize = prevSize2 + deltaApplied;
      const safeSize = resizePanel({ panels, index: pivotIndex, size: unsafeSize });
      nextSize[pivotIndex] = safeSize;
      if (!fuzzyNumbersEqual(safeSize, unsafeSize)) {
        let deltaRemaining = unsafeSize - safeSize;
        const pivotIndex2 = delta < 0 ? secondPivotIndex : firstPivotIndex;
        let index = pivotIndex2;
        while (index >= 0 && index < panels.length) {
          const prevSize3 = nextSize[index];
          ensure(prevSize3, () => `Previous size not found for panel index ${index}`);
          const unsafeSize2 = prevSize3 + deltaRemaining;
          const safeSize2 = resizePanel({ panels, index, size: unsafeSize2 });
          if (!fuzzyNumbersEqual(prevSize3, safeSize2)) {
            deltaRemaining -= safeSize2 - prevSize3;
            nextSize[index] = safeSize2;
          }
          if (fuzzyNumbersEqual(deltaRemaining, 0)) {
            break;
          }
          if (delta > 0) {
            index--;
          } else {
            index++;
          }
        }
      }
    }
    const totalSize = nextSize.reduce((total, size) => size + total, 0);
    if (!fuzzyNumbersEqual(totalSize, 100)) {
      return prevSize;
    }
    return nextSize;
  }

  // node_modules/@zag-js/splitter/dist/utils/validate-sizes.mjs
  function validateSizes({ size: prevSize, panels }) {
    const nextSize = [...prevSize];
    const nextSizeTotalSize = nextSize.reduce((accumulated, current) => accumulated + current, 0);
    if (nextSize.length !== panels.length) {
      throw Error(`Invalid ${panels.length} panel size: ${nextSize.map((size) => `${size}%`).join(", ")}`);
    } else if (!fuzzyNumbersEqual(nextSizeTotalSize, 100) && nextSize.length > 0) {
      for (let index = 0; index < panels.length; index++) {
        const unsafeSize = nextSize[index];
        ensure(unsafeSize, () => `No size data found for index ${index}`);
        const safeSize = 100 / nextSizeTotalSize * unsafeSize;
        nextSize[index] = safeSize;
      }
    }
    let remainingSize = 0;
    for (let index = 0; index < panels.length; index++) {
      const unsafeSize = nextSize[index];
      ensure(unsafeSize, () => `No size data found for index ${index}`);
      const safeSize = resizePanel({ panels, index, size: unsafeSize });
      if (unsafeSize != safeSize) {
        remainingSize += unsafeSize - safeSize;
        nextSize[index] = safeSize;
      }
    }
    if (!fuzzyNumbersEqual(remainingSize, 0)) {
      for (let index = 0; index < panels.length; index++) {
        const prevSize2 = nextSize[index];
        ensure(prevSize2, () => `No size data found for index ${index}`);
        const unsafeSize = prevSize2 + remainingSize;
        const safeSize = resizePanel({ panels, index, size: unsafeSize });
        if (prevSize2 !== safeSize) {
          remainingSize -= safeSize - prevSize2;
          nextSize[index] = safeSize;
          if (fuzzyNumbersEqual(remainingSize, 0)) {
            break;
          }
        }
      }
    }
    return nextSize;
  }

  // node_modules/@zag-js/splitter/dist/splitter.machine.mjs
  var machine = createMachine({
    props({ props: props2 }) {
      ensureProps(props2, ["panels"]);
      return {
        orientation: "horizontal",
        defaultSize: [],
        dir: "ltr",
        ...props2,
        panels: sortPanels(props2.panels)
      };
    },
    initialState() {
      return "idle";
    },
    context({ prop, bindable: bindable2, getContext, getRefs }) {
      return {
        panels: bindable2(() => ({
          defaultValue: normalizePanels(prop("panels"), null, prop("orientation"))
        })),
        size: bindable2(() => ({
          defaultValue: [],
          isEqual(a, b) {
            return b != null && fuzzySizeEqual(a, b);
          },
          onChange(value) {
            const ctx = getContext();
            const refs = getRefs();
            if (refs.get("suppressOnResize")) return;
            const sizesBeforeCollapse = refs.get("panelSizeBeforeCollapse");
            const expandToSizes = Object.fromEntries(sizesBeforeCollapse.entries());
            const resizeTriggerId = ctx.get("dragState")?.resizeTriggerId ?? null;
            const layout = getPanelLayout(prop("panels"));
            prop("onResize")?.({
              size: value,
              layout,
              resizeTriggerId,
              expandToSizes
            });
          }
        })),
        dragState: bindable2(() => ({
          defaultValue: null
        })),
        keyboardState: bindable2(() => ({
          defaultValue: null
        }))
      };
    },
    watch({ track, action, prop }) {
      track(
        [
          () => serializePanels(prop("panels")),
          () => JSON.stringify(prop("size") ?? []),
          () => JSON.stringify(prop("defaultSize") ?? [])
        ],
        () => {
          action(["syncSize"]);
        }
      );
    },
    refs() {
      return {
        panelSizeBeforeCollapse: /* @__PURE__ */ new Map(),
        prevDelta: 0,
        panelIdToLastNotifiedSizeMap: /* @__PURE__ */ new Map(),
        initialSize: null,
        prevInitialLayout: null,
        prevGroupSize: null,
        lastRequestedSize: null,
        suppressOnResize: false
      };
    },
    computed: {
      horizontal({ prop }) {
        return prop("orientation") === "horizontal";
      }
    },
    on: {
      "SIZE.SET": {
        actions: ["setSize"]
      },
      "SIZE.RESET": {
        actions: ["resetSize"]
      },
      "PANEL.COLLAPSE": {
        actions: ["collapsePanel"]
      },
      "PANEL.EXPAND": {
        actions: ["expandPanel"]
      },
      "PANEL.RESIZE": {
        actions: ["resizePanel"]
      },
      "ROOT.RESIZE": {
        actions: ["syncSize"]
      }
    },
    entry: ["syncSize"],
    exit: ["clearGlobalCursor"],
    effects: ["trackResizeHandles", "trackRootResize"],
    states: {
      idle: {
        entry: ["clearDraggingState", "clearKeyboardState"],
        on: {
          POINTER_OVER: {
            target: "hover:temp",
            actions: ["setKeyboardState"]
          },
          FOCUS: {
            target: "focused",
            actions: ["setKeyboardState"]
          },
          POINTER_DOWN: {
            target: "dragging",
            actions: ["setDraggingState"]
          }
        }
      },
      "hover:temp": {
        effects: ["waitForHoverDelay"],
        on: {
          HOVER_DELAY: {
            target: "hover"
          },
          FOCUS: {
            target: "focused",
            actions: ["setKeyboardState"]
          },
          POINTER_DOWN: {
            target: "dragging",
            actions: ["setDraggingState"]
          },
          POINTER_LEAVE: {
            target: "idle"
          }
        }
      },
      hover: {
        tags: ["focus"],
        on: {
          FOCUS: {
            target: "focused",
            actions: ["setKeyboardState"]
          },
          POINTER_DOWN: {
            target: "dragging",
            actions: ["setDraggingState"]
          },
          POINTER_LEAVE: {
            target: "idle"
          }
        }
      },
      focused: {
        tags: ["focus"],
        on: {
          BLUR: {
            target: "idle"
          },
          ENTER: {
            actions: ["collapseOrExpandPanel"]
          },
          POINTER_DOWN: {
            target: "dragging",
            actions: ["setDraggingState"]
          },
          KEYBOARD_MOVE: {
            actions: ["invokeOnResizeStart", "setKeyboardValue", "invokeOnResizeEnd"]
          },
          "FOCUS.CYCLE": {
            actions: ["focusNextResizeTrigger"]
          }
        }
      },
      dragging: {
        tags: ["focus"],
        effects: ["trackPointerMove"],
        entry: ["invokeOnResizeStart"],
        on: {
          POINTER_MOVE: {
            actions: ["setPointerValue", "setGlobalCursor"]
          },
          POINTER_UP: [
            {
              guard: "isResizeTriggerFocused",
              target: "focused",
              actions: ["invokeOnResizeEnd", "setKeyboardState", "clearDraggingState", "clearGlobalCursor"]
            },
            {
              target: "idle",
              actions: ["invokeOnResizeEnd", "clearGlobalCursor"]
            }
          ]
        }
      }
    },
    implementations: {
      guards: {
        isResizeTriggerFocused({ context, scope }) {
          const dragState = context.get("dragState");
          return scope.isActiveElement(getResizeTriggerEl(scope, dragState?.resizeTriggerId));
        }
      },
      effects: {
        trackResizeHandles: ({ prop, scope, send }) => {
          const registry2 = prop("registry");
          if (!registry2) return;
          let cleanups = [];
          const exec = () => {
            cleanups.forEach((fn) => fn());
            cleanups = getResizeTriggerEls(scope).map((resizeTriggerEl) => {
              const id = resizeTriggerEl.dataset.id;
              if (!id) return;
              return registry2.register({
                id: getResizeTriggerId(scope, id),
                element: resizeTriggerEl,
                orientation: prop("orientation"),
                onActivate(point) {
                  send({ type: "POINTER_DOWN", id, point });
                },
                onDeactivate() {
                  send({ type: "POINTER_UP" });
                }
              });
            }).filter(Boolean);
          };
          exec();
          const observeCleanup = observeChildren(getRootEl(scope), {
            callback: exec
          });
          return () => {
            cleanups.forEach((fn) => fn());
            observeCleanup?.();
          };
        },
        trackRootResize: ({ scope, send }) => {
          const rootEl = getRootEl(scope);
          if (!rootEl) return;
          return resizeObserverBorderBox.observe(rootEl, () => {
            send({ type: "ROOT.RESIZE" });
          });
        },
        waitForHoverDelay: ({ send }) => {
          return setRafTimeout(() => {
            send({ type: "HOVER_DELAY" });
          }, 250);
        },
        trackPointerMove: ({ scope, send }) => {
          const doc = scope.getDoc();
          return trackPointerMove(doc, {
            onPointerMove(info) {
              send({ type: "POINTER_MOVE", point: info.point });
            },
            onPointerUp() {
              send({ type: "POINTER_UP" });
            }
          });
        }
      },
      actions: {
        setSize(params) {
          const { context, event, prop, scope } = params;
          const unsafeSize = event.size;
          const prevSize = context.get("size");
          const panels = context.get("panels");
          const safeSize = validateSizes({
            size: resolvePanelSizes({
              sizes: unsafeSize,
              panels: prop("panels"),
              rootEl: getRootEl(scope),
              orientation: prop("orientation")
            }),
            panels
          });
          if (!isEqual(prevSize, safeSize)) {
            setSize(params, safeSize);
          }
        },
        resetSize(params) {
          const { refs, context, prop, scope } = params;
          const initialSize = refs.get("initialSize");
          const nextSize = initialSize ?? validateSizes({
            size: resolvePanelSizes({
              sizes: prop("size") ?? prop("defaultSize"),
              panels: prop("panels"),
              rootEl: getRootEl(scope),
              orientation: prop("orientation")
            }),
            panels: context.get("panels")
          });
          setSize(params, nextSize);
        },
        syncSize(params) {
          const { context, scope, prop, refs } = params;
          const rootEl = getRootEl(scope);
          if (!rootEl) return;
          const orientation = prop("orientation");
          const nextGroupSize = getGroupSize(rootEl, orientation);
          if (nextGroupSize <= 0) return;
          const panels = normalizePanels(prop("panels"), rootEl, prop("orientation"));
          context.set("panels", panels);
          const sizeSpec = prop("size") ?? prop("defaultSize");
          const initialLayout = `${getPanelLayout(prop("panels"))}:${JSON.stringify(prop("size") ?? [])}:${JSON.stringify(prop("defaultSize") ?? [])}`;
          const prevGroupSize = refs.get("prevGroupSize");
          const currentSize = context.get("size");
          const nextResolvedSize = resolvePanelSizes({
            sizes: sizeSpec,
            panels: prop("panels"),
            rootEl,
            orientation
          });
          const canPreserveLayout = prevGroupSize != null && prevGroupSize !== nextGroupSize && currentSize.length === panels.length;
          const nextSize = canPreserveLayout ? preserveFixedPanelSizes({
            panels,
            prevLayout: currentSize,
            prevGroupSize,
            nextGroupSize
          }) : nextResolvedSize;
          const safeSize = validateSizes({
            size: nextSize,
            panels
          });
          if (refs.get("prevInitialLayout") !== initialLayout) {
            refs.set("initialSize", safeSize);
            refs.set("prevInitialLayout", initialLayout);
          }
          const prevSize = context.get("size");
          if (!isEqual(prevSize, safeSize)) {
            refs.set("suppressOnResize", prop("size") != null || prevSize.length === 0);
            context.set("size", safeSize);
            refs.set("suppressOnResize", false);
          }
          refs.set("prevGroupSize", nextGroupSize);
        },
        setDraggingState({ context, event, prop, scope }) {
          const orientation = prop("orientation");
          const size = context.get("size");
          const resizeTriggerId = event.id;
          const resolvedResizeTriggerId = resolveResizeTriggerId(scope, resizeTriggerId);
          if (!resolvedResizeTriggerId) return;
          const panelGroupEl = getRootEl(scope);
          if (!panelGroupEl) return;
          const handleElement = getResizeTriggerEl(scope, resizeTriggerId);
          ensure(handleElement, () => `Drag handle element not found for id "${resizeTriggerId}"`);
          const initialCursorPosition = orientation === "horizontal" ? event.point.x : event.point.y;
          context.set("dragState", {
            resizeTriggerId: event.id,
            resolvedResizeTriggerId,
            resizeTriggerRect: handleElement.getBoundingClientRect(),
            initialCursorPosition,
            initialSize: size
          });
        },
        clearDraggingState({ context }) {
          context.set("dragState", null);
        },
        setKeyboardState({ context, event, scope }) {
          const id = event.id ?? context.get("dragState")?.resizeTriggerId;
          if (id == null) return;
          context.set("keyboardState", {
            resizeTriggerId: id,
            resolvedResizeTriggerId: resolveResizeTriggerId(scope, id)
          });
        },
        clearKeyboardState({ context }) {
          context.set("keyboardState", null);
        },
        collapsePanel(params) {
          const { context, event, refs } = params;
          const prevSize = context.get("size");
          const panels = context.get("panels");
          const panel = panels.find((panel2) => panel2.id === event.id);
          ensure(panel, () => `Panel data not found for id "${event.id}"`);
          if (panel.collapsible) {
            const { collapsedSize = 0, panelSize, pivotIndices } = panelDataHelper(panels, panel, prevSize);
            ensure(panelSize != null, () => `Panel size not found for panel "${panel.id}"`);
            if (!fuzzyNumbersEqual(panelSize, collapsedSize)) {
              refs.get("panelSizeBeforeCollapse").set(panel.id, panelSize);
              const isLastPanel = findPanelDataIndex(panels, panel) === panels.length - 1;
              const delta = isLastPanel ? panelSize - collapsedSize : collapsedSize - panelSize;
              const nextSize = resizeByDelta({
                delta,
                initialSize: prevSize,
                panels,
                pivotIndices,
                prevSize,
                trigger: "imperative-api"
              });
              if (!isEqual(prevSize, nextSize)) {
                setSize(params, nextSize);
              }
            }
          }
        },
        expandPanel(params) {
          const { context, event, refs } = params;
          const panels = context.get("panels");
          const prevSize = context.get("size");
          const panel = panels.find((panel2) => panel2.id === event.id);
          ensure(panel, () => `Panel data not found for id "${event.id}"`);
          if (panel.collapsible) {
            const {
              collapsedSize = 0,
              panelSize = 0,
              minSize: minSizeFromProps = 0,
              pivotIndices
            } = panelDataHelper(panels, panel, prevSize);
            const minSize = event.minSize ?? minSizeFromProps;
            if (fuzzyNumbersEqual(panelSize, collapsedSize)) {
              const prevPanelSize = refs.get("panelSizeBeforeCollapse").get(panel.id);
              const baseSize = prevPanelSize != null && prevPanelSize >= minSize ? prevPanelSize : minSize;
              const isLastPanel = findPanelDataIndex(panels, panel) === panels.length - 1;
              const delta = isLastPanel ? panelSize - baseSize : baseSize - panelSize;
              const nextSize = resizeByDelta({
                delta,
                initialSize: prevSize,
                panels,
                pivotIndices,
                prevSize,
                trigger: "imperative-api"
              });
              if (!isEqual(prevSize, nextSize)) {
                setSize(params, nextSize);
              }
            }
          }
        },
        resizePanel(params) {
          const { context, event } = params;
          const prevSize = context.get("size");
          const panels = context.get("panels");
          const panel = getPanelById(panels, event.id);
          const unsafePanelSize = event.size;
          const { panelSize, pivotIndices } = panelDataHelper(panels, panel, prevSize);
          ensure(panelSize != null, () => `Panel size not found for panel "${panel.id}"`);
          const isLastPanel = findPanelDataIndex(panels, panel) === panels.length - 1;
          const delta = isLastPanel ? panelSize - unsafePanelSize : unsafePanelSize - panelSize;
          const nextSize = resizeByDelta({
            delta,
            initialSize: prevSize,
            panels,
            pivotIndices,
            prevSize,
            trigger: "imperative-api"
          });
          if (!isEqual(prevSize, nextSize)) {
            setSize(params, nextSize);
          }
        },
        setPointerValue(params) {
          const { context, event, prop, scope } = params;
          const dragState = context.get("dragState");
          if (!dragState) return;
          const { resolvedResizeTriggerId, initialSize, initialCursorPosition } = dragState;
          const panels = context.get("panels");
          const panelGroupElement = getRootEl(scope);
          ensure(panelGroupElement, () => `Panel group element not found`);
          const pivotIndices = resolvedResizeTriggerId.split(":").map((id) => panels.findIndex((panel) => panel.id === id));
          const horizontal = prop("orientation") === "horizontal";
          const cursorPosition = horizontal ? event.point.x : event.point.y;
          const groupRect = panelGroupElement.getBoundingClientRect();
          const groupSizeInPixels = horizontal ? groupRect.width : groupRect.height;
          const offsetPixels = cursorPosition - initialCursorPosition;
          const offsetPercentage = offsetPixels / groupSizeInPixels * 100;
          const prevSize = context.get("size");
          const nextSize = resizeByDelta({
            delta: offsetPercentage,
            initialSize: initialSize ?? prevSize,
            panels,
            pivotIndices,
            prevSize,
            trigger: "mouse-or-touch"
          });
          if (!isEqual(prevSize, nextSize)) {
            setSize(params, nextSize);
          }
        },
        setKeyboardValue(params) {
          const { context, event } = params;
          const panelDataArray = context.get("panels");
          const resizeTriggerId = resolveResizeTriggerId(params.scope, event.id);
          if (!resizeTriggerId) return;
          const delta = event.delta;
          const pivotIndices = resizeTriggerId.split(":").map((id) => panelDataArray.findIndex((panelData) => panelData.id === id));
          const prevSize = context.get("size");
          const nextSize = resizeByDelta({
            delta,
            initialSize: prevSize,
            panels: panelDataArray,
            pivotIndices,
            prevSize,
            trigger: "keyboard"
          });
          if (!isEqual(prevSize, nextSize)) {
            setSize(params, nextSize);
          }
        },
        invokeOnResizeEnd({ context, prop, refs }) {
          queueMicrotask(() => {
            const dragState = context.get("dragState");
            prop("onResizeEnd")?.({
              size: refs.get("lastRequestedSize") ?? context.get("size"),
              resizeTriggerId: dragState?.resizeTriggerId ?? null
            });
          });
        },
        invokeOnResizeStart({ prop }) {
          queueMicrotask(() => {
            prop("onResizeStart")?.();
          });
        },
        collapseOrExpandPanel(params) {
          const { context, refs } = params;
          const panelDataArray = context.get("panels");
          const sizes = context.get("size");
          const resizeTriggerId = context.get("keyboardState")?.resolvedResizeTriggerId;
          const [idBefore, idAfter] = resizeTriggerId?.split(":") ?? [];
          const index = panelDataArray.findIndex((panelData2) => panelData2.id === idBefore);
          if (index === -1) return;
          const panelData = panelDataArray[index];
          ensure(panelData, () => `No panel data found for index ${index}`);
          const size = sizes[index];
          const { collapsedSize = 0, collapsible, minSize = 0 } = panelData;
          if (size != null && collapsible) {
            const pivotIndices = [idBefore, idAfter].map(
              (id) => panelDataArray.findIndex((panelData2) => panelData2.id === id)
            );
            const nextSize = resizeByDelta({
              delta: fuzzyNumbersEqual(size, collapsedSize) ? minSize - collapsedSize : collapsedSize - size,
              initialSize: refs.get("initialSize") ?? sizes,
              panels: panelDataArray,
              pivotIndices,
              prevSize: sizes,
              trigger: "keyboard"
            });
            if (!isEqual(sizes, nextSize)) {
              setSize(params, nextSize);
            }
          }
        },
        setGlobalCursor(params) {
          const { context, scope, prop } = params;
          const registry2 = prop("registry");
          if (registry2) return;
          const dragState = context.get("dragState");
          if (!dragState) return;
          const panels = context.get("panels");
          const horizontal = prop("orientation") === "horizontal";
          const [idBefore] = dragState.resolvedResizeTriggerId.split(":");
          const indexBefore = panels.findIndex((panel2) => panel2.id === idBefore);
          const panel = panels[indexBefore];
          const size = context.get("size");
          const aria = getAriaValue(size, panels, dragState.resolvedResizeTriggerId);
          const isAtMin = fuzzyNumbersEqual(aria.valueNow, aria.valueMin) || fuzzyNumbersEqual(aria.valueNow, panel.collapsedSize);
          const isAtMax = fuzzyNumbersEqual(aria.valueNow, aria.valueMax);
          const cursorState = { isAtMin, isAtMax };
          setupGlobalCursor(scope, cursorState, horizontal, prop("nonce"));
        },
        clearGlobalCursor({ scope }) {
          removeGlobalCursor(scope);
        },
        focusNextResizeTrigger({ event, scope }) {
          const resizeTriggers = getResizeTriggerEls(scope);
          const index = resizeTriggers.findIndex((el) => el.dataset.id === event.id);
          const handleEl = event.shiftKey ? prev(resizeTriggers, index) : next(resizeTriggers, index);
          handleEl?.focus();
        }
      }
    }
  });
  function setSize(params, sizes) {
    const { refs, prop, context } = params;
    const panelsArray = context.get("panels");
    const onCollapse = prop("onCollapse");
    const onExpand = prop("onExpand");
    const onResize = prop("onResize");
    const onResizeStart = prop("onResizeStart");
    const onResizeEnd = prop("onResizeEnd");
    const panelIdToLastNotifiedSizeMap = refs.get("panelIdToLastNotifiedSizeMap");
    const dragState = context.get("dragState");
    const keyboardState = context.get("keyboardState");
    const isProgrammatic = dragState === null && keyboardState === null;
    refs.set("lastRequestedSize", sizes);
    if (isProgrammatic && onResizeStart) {
      queueMicrotask(() => {
        onResizeStart();
      });
    }
    if (prop("size") == null) {
      context.set("size", sizes);
    } else if (onResize) {
      const sizesBeforeCollapse = refs.get("panelSizeBeforeCollapse");
      const expandToSizes = Object.fromEntries(sizesBeforeCollapse.entries());
      const resizeTriggerId = dragState?.resizeTriggerId ?? null;
      const layout = getPanelLayout(prop("panels"));
      onResize({
        size: sizes,
        layout,
        resizeTriggerId,
        expandToSizes
      });
    }
    sizes.forEach((size, index) => {
      const panelData = panelsArray[index];
      ensure(panelData, () => `Panel data not found for index ${index}`);
      const { collapsedSize = 0, collapsible, id: panelId } = panelData;
      const lastNotifiedSize = panelIdToLastNotifiedSizeMap.get(panelId);
      if (lastNotifiedSize == null || size !== lastNotifiedSize) {
        panelIdToLastNotifiedSizeMap.set(panelId, size);
        if (collapsible && lastNotifiedSize != null && (onCollapse || onExpand)) {
          if (fuzzyNumbersEqual(lastNotifiedSize, collapsedSize) && !fuzzyNumbersEqual(size, collapsedSize)) {
            onExpand?.({ panelId, size });
          }
          if (!fuzzyNumbersEqual(lastNotifiedSize, collapsedSize) && fuzzyNumbersEqual(size, collapsedSize)) {
            onCollapse?.({ panelId, size });
          }
        }
      }
    });
    if (isProgrammatic && onResizeEnd) {
      queueMicrotask(() => {
        onResizeEnd({
          size: sizes,
          resizeTriggerId: null
          // Programmatic changes don't have a resize trigger
        });
      });
    }
  }

  // node_modules/@zag-js/splitter/dist/splitter.props.mjs
  var props = createProps()([
    "dir",
    "getRootNode",
    "id",
    "ids",
    "onResize",
    "onResizeStart",
    "onResizeEnd",
    "onCollapse",
    "onExpand",
    "orientation",
    "size",
    "defaultSize",
    "panels",
    "keyboardResizeBy",
    "nonce",
    "registry"
  ]);
  var splitProps2 = createSplitProps(props);
  var panelProps = createProps()(["id"]);
  var splitPanelProps = createSplitProps(panelProps);
  var resizeTriggerProps = createProps()(["disabled", "id"]);
  var splitResizeTriggerProps = createSplitProps(resizeTriggerProps);

  // node_modules/@zag-js/splitter/dist/utils/intersects.mjs
  function intersects(r1, r2, strict = false) {
    if (strict) {
      return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
    }
    return r1.x <= r2.x + r2.width && r1.x + r1.width >= r2.x && r1.y <= r2.y + r2.height && r1.y + r1.height >= r2.y;
  }
  function toRect(r) {
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }

  // node_modules/@zag-js/splitter/dist/utils/stacking-order.mjs
  function compareStackingOrder(a, b) {
    if (a === b) throw new Error("Cannot compare node with itself");
    const ancestors = {
      a: getAncestorElements(a),
      b: getAncestorElements(b)
    };
    let commonAncestor = null;
    while (ancestors.a.at(-1) === ancestors.b.at(-1)) {
      const currentA = ancestors.a.pop();
      ancestors.b.pop();
      commonAncestor = currentA;
    }
    ensure(
      commonAncestor,
      () => "[stacking-order] Stacking order can only be calculated for elements with a common ancestor"
    );
    const zIndexes = {
      a: getZIndex(findStackingContext(ancestors.a)),
      b: getZIndex(findStackingContext(ancestors.b))
    };
    if (zIndexes.a === zIndexes.b) {
      const children = commonAncestor.childNodes;
      const furthestAncestors = {
        a: ancestors.a.at(-1),
        b: ancestors.b.at(-1)
      };
      let i = children.length;
      while (i--) {
        const child = children[i];
        if (child === furthestAncestors.a) return 1;
        if (child === furthestAncestors.b) return -1;
      }
    }
    return Math.sign(zIndexes.a - zIndexes.b);
  }
  var STACKING_PROPS_REGEX = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
  function isFlexItem(node) {
    const parent = getParentElement(node);
    const display = getComputedStyle(parent ?? node).display;
    return display === "flex" || display === "inline-flex";
  }
  function createsStackingContext(node) {
    const style = getComputedStyle(node);
    if (style.position === "fixed") return true;
    if (style.zIndex !== "auto" && (style.position !== "static" || isFlexItem(node))) return true;
    if (+style.opacity < 1) return true;
    if (hasProp(style, "transform") && style.transform !== "none") return true;
    if (hasProp(style, "webkitTransform") && style.webkitTransform !== "none") return true;
    if (hasProp(style, "mixBlendMode") && style.mixBlendMode !== "normal") return true;
    if (hasProp(style, "filter") && style.filter !== "none") return true;
    if (hasProp(style, "webkitFilter") && style.webkitFilter !== "none") return true;
    if (hasProp(style, "isolation") && style.isolation === "isolate") return true;
    if (STACKING_PROPS_REGEX.test(style.willChange)) return true;
    if (style.webkitOverflowScrolling === "touch") return true;
    return false;
  }
  function findStackingContext(nodes) {
    let i = nodes.length;
    while (i--) {
      const node = nodes[i];
      ensure(node, () => "[stacking-order] missing node in findStackingContext");
      if (createsStackingContext(node)) return node;
    }
    return null;
  }
  var getZIndex = (node) => {
    return node && Number(getComputedStyle(node).zIndex) || 0;
  };

  // node_modules/@zag-js/splitter/dist/utils/registry.mjs
  var SplitterRegistry = class {
    constructor(options = {}) {
      __publicField4(this, "handles", /* @__PURE__ */ new Map());
      __publicField4(this, "state", {
        activeHandleIds: /* @__PURE__ */ new Set(),
        isPointerDown: false
      });
      __publicField4(this, "listenerAttached", false);
      __publicField4(this, "options");
      __publicField4(this, "handlePointerMove", (event) => {
        if (this.state.isPointerDown) return;
        const pointerType = this.getPointerType(event);
        const intersecting = this.findHitHandles(event.clientX, event.clientY, pointerType);
        const newActiveIds = new Set(intersecting.map((h) => h.id));
        const changed = newActiveIds.size !== this.state.activeHandleIds.size || [...newActiveIds].some((id) => !this.state.activeHandleIds.has(id));
        if (changed) {
          this.state.activeHandleIds = newActiveIds;
          this.updateCursor(intersecting);
        }
      });
      __publicField4(this, "handlePointerDown", (event) => {
        const pointerType = this.getPointerType(event);
        const intersecting = this.findIntersectingHandles(event.clientX, event.clientY, pointerType, event.target);
        if (intersecting.length > 0) {
          this.state.isPointerDown = true;
          this.state.activeHandleIds = new Set(intersecting.map((h) => h.id));
          const point = { x: event.clientX, y: event.clientY };
          intersecting.forEach((handle) => {
            handle.onActivate(point);
          });
          this.updateCursor(intersecting);
        }
      });
      __publicField4(this, "handlePointerUp", (_event) => {
        if (this.state.isPointerDown) {
          this.state.isPointerDown = false;
          this.handles.forEach((handle) => {
            if (this.state.activeHandleIds.has(handle.id)) {
              handle.onDeactivate();
            }
          });
          this.state.activeHandleIds.clear();
          this.clearGlobalCursor();
        }
      });
      __publicField4(this, "globalCursorId", "splitter-registry-cursor");
      this.options = {
        nonce: options.nonce ?? "",
        hitAreaMargins: {
          coarse: options.hitAreaMargins?.coarse ?? 15,
          fine: options.hitAreaMargins?.fine ?? 5
        }
      };
    }
    register(data) {
      this.handles.set(data.id, data);
      this.attachGlobalListeners();
      return () => {
        this.handles.delete(data.id);
        this.state.activeHandleIds.delete(data.id);
        if (this.handles.size === 0) {
          this.detachGlobalListeners();
        }
      };
    }
    attachGlobalListeners() {
      if (this.listenerAttached) return;
      this.doc.addEventListener("pointermove", this.handlePointerMove, true);
      this.doc.addEventListener("pointerdown", this.handlePointerDown, true);
      this.doc.addEventListener("pointerup", this.handlePointerUp, true);
      this.listenerAttached = true;
    }
    detachGlobalListeners() {
      if (!this.listenerAttached) return;
      this.doc.removeEventListener("pointermove", this.handlePointerMove, true);
      this.doc.removeEventListener("pointerdown", this.handlePointerDown, true);
      this.doc.removeEventListener("pointerup", this.handlePointerUp, true);
      this.listenerAttached = false;
    }
    getPointerType(event) {
      return event.pointerType === "touch" || event.pointerType === "pen" ? "coarse" : "fine";
    }
    get doc() {
      const firstHandle = this.handles.values().next().value;
      return getDocument(firstHandle?.element);
    }
    /**
     * Fast hit-test: only checks pointer proximity to handles (no stacking order).
     * Used for pointermove cursor feedback.
     */
    findHitHandles(x, y, pointerType) {
      const intersecting = [];
      const margin = this.options.hitAreaMargins[pointerType];
      this.handles.forEach((handle) => {
        const rect = handle.element.getBoundingClientRect();
        const hit = x >= rect.left - margin && x <= rect.right + margin && y >= rect.top - margin && y <= rect.bottom + margin;
        if (hit) intersecting.push(handle);
      });
      return intersecting;
    }
    /**
     * Full intersection check: hit-test + stacking order verification.
     * Used for pointerdown activation where correctness matters.
     */
    findIntersectingHandles(x, y, pointerType, eventTarget) {
      const hits = this.findHitHandles(x, y, pointerType);
      const targetElement = isElement(eventTarget) ? eventTarget : null;
      if (!targetElement || !contains(this.doc, targetElement)) return hits;
      return hits.filter((handle) => {
        const dragHandleElement = handle.element;
        if (targetElement === dragHandleElement || contains(dragHandleElement, targetElement) || contains(targetElement, dragHandleElement)) {
          return true;
        }
        try {
          if (compareStackingOrder(targetElement, dragHandleElement) > 0) {
            const dragHandleRect = dragHandleElement.getBoundingClientRect();
            let currentElement = targetElement;
            while (currentElement) {
              if (currentElement.contains(dragHandleElement)) break;
              const currentRect = currentElement.getBoundingClientRect();
              if (intersects(toRect(currentRect), toRect(dragHandleRect), true)) {
                return false;
              }
              currentElement = getParentElement(currentElement);
            }
          }
        } catch {
        }
        return true;
      });
    }
    updateCursor(intersecting) {
      if (intersecting.length === 0) {
        this.clearGlobalCursor();
        return;
      }
      const hasHorizontal = intersecting.some((h) => h.orientation === "horizontal");
      const hasVertical = intersecting.some((h) => h.orientation === "vertical");
      let cursor = "default";
      if (hasHorizontal && hasVertical) {
        cursor = "move";
      } else if (hasHorizontal) {
        cursor = "ew-resize";
      } else if (hasVertical) {
        cursor = "ns-resize";
      }
      this.setGlobalCursor(cursor);
    }
    setGlobalCursor(cursor) {
      const doc = this.doc;
      let styleEl = doc.getElementById(this.globalCursorId);
      const textContent = `* { cursor: ${cursor} !important; }`;
      if (styleEl) {
        styleEl.textContent = textContent;
      } else {
        styleEl = doc.createElement("style");
        styleEl.id = this.globalCursorId;
        styleEl.textContent = textContent;
        if (this.options.nonce) {
          styleEl.nonce = this.options.nonce;
        }
        doc.head.appendChild(styleEl);
      }
    }
    clearGlobalCursor() {
      const styleEl = this.doc.getElementById(this.globalCursorId);
      styleEl?.remove();
    }
  };
  var registry = (opts = {}) => new SplitterRegistry(opts);

  // src/product-splitter-vendors.js
  var machine2 = { ...machine, implementations: { ...machine.implementations, actions: {
    ...machine.implementations.actions,
    setGlobalCursor({ scope, prop }) {
      const root = scope.getDoc().documentElement;
      root.dataset.afSplitCursor = prop("orientation");
      root.dataset.afSplitOwner = prop("id");
    },
    clearGlobalCursor({ scope, prop }) {
      const root = scope.getDoc().documentElement;
      if (root.dataset.afSplitOwner === prop("id")) {
        delete root.dataset.afSplitCursor;
        delete root.dataset.afSplitOwner;
      }
    }
  } } };
  var splitter = { ...dist_exports, machine: machine2 };

  // src/components/splitter.js
  function createSplitPane(root, { id, size = [35, 65], orientation = "horizontal", onResize, storageKey, label = "\uD328\uB110 \uD06C\uAE30 \uC870\uC808", keyboardResizeBy } = {}) {
    if (!id) throw new Error("SplitPane requires a stable unique id.");
    const panels = [...root.querySelectorAll(":scope > [data-af-panel]")];
    const handle = root.querySelector(":scope > [data-af-resizer]");
    if (panels.length !== 2 || !handle) throw new Error("SplitPane requires two panels and a resize handle.");
    if (storageKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (Array.isArray(saved) && saved.length === 2 && saved.every((n) => Number.isFinite(n) && n >= 10 && n <= 90) && Math.abs(saved[0] + saved[1] - 100) < 0.1) size = saved;
      } catch {
      }
    }
    const machine3 = new VanillaMachine(splitter.machine, {
      id,
      orientation,
      defaultSize: size,
      keyboardResizeBy,
      panels: [{ id: "start", minSize: 10 }, { id: "end", minSize: 10 }],
      onResize(details) {
        onResize?.(details.size);
      },
      onResizeEnd(details) {
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(details.size));
          } catch {
          }
        }
      }
    });
    let cleanups = [];
    const render = (service) => {
      cleanups.forEach((cleanup) => cleanup());
      const api = splitter.connect(service, normalizeProps);
      cleanups = [
        spreadProps2(root, api.getRootProps()),
        spreadProps2(panels[0], api.getPanelProps({ id: "start" })),
        spreadProps2(handle, { ...api.getResizeTriggerProps({ id: "start:end" }), "aria-label": label }),
        spreadProps2(panels[1], api.getPanelProps({ id: "end" }))
      ];
    };
    render(machine3.service);
    const unsubscribe = machine3.subscribe(render);
    machine3.start();
    return {
      machine: machine3,
      setSizes(size2) {
        splitter.connect(machine3.service, normalizeProps).setSizes(size2);
      },
      destroy() {
        unsubscribe();
        machine3.stop();
        cleanups.forEach((cleanup) => cleanup());
      }
    };
  }
  return __toCommonJS(splitter_exports);
})();
