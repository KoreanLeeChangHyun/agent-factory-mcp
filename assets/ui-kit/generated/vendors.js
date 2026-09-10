var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e9) {
    throw mod = 0, e9;
  }
};
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/wildcard/index.js
var require_wildcard = __commonJS({
  "node_modules/wildcard/index.js"(exports, module) {
    "use strict";
    function WildcardMatcher(text, separator) {
      this.text = text = text || "";
      this.hasWild = ~text.indexOf("*");
      this.separator = separator;
      this.parts = text.split(separator);
    }
    WildcardMatcher.prototype.match = function(input) {
      var matches = true;
      var parts3 = this.parts;
      var ii;
      var partsCount = parts3.length;
      var testParts;
      if (typeof input == "string" || input instanceof String) {
        if (!this.hasWild && this.text != input) {
          matches = false;
        } else {
          testParts = (input || "").split(this.separator);
          for (ii = 0; matches && ii < partsCount; ii++) {
            if (parts3[ii] === "*") {
              continue;
            } else if (ii < testParts.length) {
              matches = parts3[ii] === testParts[ii];
            } else {
              matches = false;
            }
          }
          matches = matches && testParts;
        }
      } else if (typeof input.splice == "function") {
        matches = [];
        for (ii = input.length; ii--; ) {
          if (this.match(input[ii])) {
            matches[matches.length] = input[ii];
          }
        }
      } else if (typeof input == "object") {
        matches = {};
        for (var key in input) {
          if (this.match(key)) {
            matches[key] = input[key];
          }
        }
      }
      return matches;
    };
    module.exports = function(text, test, separator) {
      var matcher = new WildcardMatcher(text, separator || /[\/\.]/);
      if (typeof test != "undefined") {
        return matcher.match(test);
      }
      return matcher;
    };
  }
});

// node_modules/mime-match/index.js
var require_mime_match = __commonJS({
  "node_modules/mime-match/index.js"(exports, module) {
    var wildcard = require_wildcard();
    var reMimePartSplit = /[\/\+\.]/;
    module.exports = function(target, pattern) {
      function test(pattern2) {
        var result = wildcard(pattern2, target, reMimePartSplit);
        return result && result.length >= 2;
      }
      return pattern ? test(pattern.split(";")[0]) : test;
    };
  }
});

// node_modules/lodash/isObject.js
var require_isObject = __commonJS({
  "node_modules/lodash/isObject.js"(exports, module) {
    function isObject3(value) {
      var type = typeof value;
      return value != null && (type == "object" || type == "function");
    }
    module.exports = isObject3;
  }
});

// node_modules/lodash/_freeGlobal.js
var require_freeGlobal = __commonJS({
  "node_modules/lodash/_freeGlobal.js"(exports, module) {
    var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
    module.exports = freeGlobal;
  }
});

// node_modules/lodash/_root.js
var require_root = __commonJS({
  "node_modules/lodash/_root.js"(exports, module) {
    var freeGlobal = require_freeGlobal();
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root2 = freeGlobal || freeSelf || Function("return this")();
    module.exports = root2;
  }
});

// node_modules/lodash/now.js
var require_now = __commonJS({
  "node_modules/lodash/now.js"(exports, module) {
    var root2 = require_root();
    var now = function() {
      return root2.Date.now();
    };
    module.exports = now;
  }
});

// node_modules/lodash/_trimmedEndIndex.js
var require_trimmedEndIndex = __commonJS({
  "node_modules/lodash/_trimmedEndIndex.js"(exports, module) {
    var reWhitespace = /\s/;
    function trimmedEndIndex(string) {
      var index = string.length;
      while (index-- && reWhitespace.test(string.charAt(index))) {
      }
      return index;
    }
    module.exports = trimmedEndIndex;
  }
});

// node_modules/lodash/_baseTrim.js
var require_baseTrim = __commonJS({
  "node_modules/lodash/_baseTrim.js"(exports, module) {
    var trimmedEndIndex = require_trimmedEndIndex();
    var reTrimStart = /^\s+/;
    function baseTrim(string) {
      return string ? string.slice(0, trimmedEndIndex(string) + 1).replace(reTrimStart, "") : string;
    }
    module.exports = baseTrim;
  }
});

// node_modules/lodash/_Symbol.js
var require_Symbol = __commonJS({
  "node_modules/lodash/_Symbol.js"(exports, module) {
    var root2 = require_root();
    var Symbol2 = root2.Symbol;
    module.exports = Symbol2;
  }
});

// node_modules/lodash/_getRawTag.js
var require_getRawTag = __commonJS({
  "node_modules/lodash/_getRawTag.js"(exports, module) {
    var Symbol2 = require_Symbol();
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    var nativeObjectToString = objectProto.toString;
    var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
    function getRawTag(value) {
      var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
      try {
        value[symToStringTag] = void 0;
        var unmasked = true;
      } catch (e9) {
      }
      var result = nativeObjectToString.call(value);
      if (unmasked) {
        if (isOwn) {
          value[symToStringTag] = tag;
        } else {
          delete value[symToStringTag];
        }
      }
      return result;
    }
    module.exports = getRawTag;
  }
});

// node_modules/lodash/_objectToString.js
var require_objectToString = __commonJS({
  "node_modules/lodash/_objectToString.js"(exports, module) {
    var objectProto = Object.prototype;
    var nativeObjectToString = objectProto.toString;
    function objectToString(value) {
      return nativeObjectToString.call(value);
    }
    module.exports = objectToString;
  }
});

// node_modules/lodash/_baseGetTag.js
var require_baseGetTag = __commonJS({
  "node_modules/lodash/_baseGetTag.js"(exports, module) {
    var Symbol2 = require_Symbol();
    var getRawTag = require_getRawTag();
    var objectToString = require_objectToString();
    var nullTag = "[object Null]";
    var undefinedTag = "[object Undefined]";
    var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
    function baseGetTag2(value) {
      if (value == null) {
        return value === void 0 ? undefinedTag : nullTag;
      }
      return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
    }
    module.exports = baseGetTag2;
  }
});

// node_modules/lodash/isObjectLike.js
var require_isObjectLike = __commonJS({
  "node_modules/lodash/isObjectLike.js"(exports, module) {
    function isObjectLike2(value) {
      return value != null && typeof value == "object";
    }
    module.exports = isObjectLike2;
  }
});

// node_modules/lodash/isSymbol.js
var require_isSymbol = __commonJS({
  "node_modules/lodash/isSymbol.js"(exports, module) {
    var baseGetTag2 = require_baseGetTag();
    var isObjectLike2 = require_isObjectLike();
    var symbolTag = "[object Symbol]";
    function isSymbol(value) {
      return typeof value == "symbol" || isObjectLike2(value) && baseGetTag2(value) == symbolTag;
    }
    module.exports = isSymbol;
  }
});

// node_modules/lodash/toNumber.js
var require_toNumber = __commonJS({
  "node_modules/lodash/toNumber.js"(exports, module) {
    var baseTrim = require_baseTrim();
    var isObject3 = require_isObject();
    var isSymbol = require_isSymbol();
    var NAN = 0 / 0;
    var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
    var reIsBinary = /^0b[01]+$/i;
    var reIsOctal = /^0o[0-7]+$/i;
    var freeParseInt = parseInt;
    function toNumber(value) {
      if (typeof value == "number") {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      if (isObject3(value)) {
        var other = typeof value.valueOf == "function" ? value.valueOf() : value;
        value = isObject3(other) ? other + "" : other;
      }
      if (typeof value != "string") {
        return value === 0 ? value : +value;
      }
      value = baseTrim(value);
      var isBinary = reIsBinary.test(value);
      return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
    }
    module.exports = toNumber;
  }
});

// node_modules/lodash/debounce.js
var require_debounce = __commonJS({
  "node_modules/lodash/debounce.js"(exports, module) {
    var isObject3 = require_isObject();
    var now = require_now();
    var toNumber = require_toNumber();
    var FUNC_ERROR_TEXT = "Expected a function";
    var nativeMax = Math.max;
    var nativeMin = Math.min;
    function debounce(func, wait, options) {
      var lastArgs, lastThis, maxWait, result, timerId, lastCallTime, lastInvokeTime = 0, leading = false, maxing = false, trailing = true;
      if (typeof func != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      wait = toNumber(wait) || 0;
      if (isObject3(options)) {
        leading = !!options.leading;
        maxing = "maxWait" in options;
        maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
        trailing = "trailing" in options ? !!options.trailing : trailing;
      }
      function invokeFunc(time) {
        var args = lastArgs, thisArg = lastThis;
        lastArgs = lastThis = void 0;
        lastInvokeTime = time;
        result = func.apply(thisArg, args);
        return result;
      }
      function leadingEdge(time) {
        lastInvokeTime = time;
        timerId = setTimeout(timerExpired, wait);
        return leading ? invokeFunc(time) : result;
      }
      function remainingWait(time) {
        var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime, timeWaiting = wait - timeSinceLastCall;
        return maxing ? nativeMin(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
      }
      function shouldInvoke(time) {
        var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime;
        return lastCallTime === void 0 || timeSinceLastCall >= wait || timeSinceLastCall < 0 || maxing && timeSinceLastInvoke >= maxWait;
      }
      function timerExpired() {
        var time = now();
        if (shouldInvoke(time)) {
          return trailingEdge(time);
        }
        timerId = setTimeout(timerExpired, remainingWait(time));
      }
      function trailingEdge(time) {
        timerId = void 0;
        if (trailing && lastArgs) {
          return invokeFunc(time);
        }
        lastArgs = lastThis = void 0;
        return result;
      }
      function cancel() {
        if (timerId !== void 0) {
          clearTimeout(timerId);
        }
        lastInvokeTime = 0;
        lastArgs = lastCallTime = lastThis = timerId = void 0;
      }
      function flush() {
        return timerId === void 0 ? result : trailingEdge(now());
      }
      function debounced() {
        var time = now(), isInvoking = shouldInvoke(time);
        lastArgs = arguments;
        lastThis = this;
        lastCallTime = time;
        if (isInvoking) {
          if (timerId === void 0) {
            return leadingEdge(lastCallTime);
          }
          if (maxing) {
            clearTimeout(timerId);
            timerId = setTimeout(timerExpired, wait);
            return invokeFunc(lastCallTime);
          }
        }
        if (timerId === void 0) {
          timerId = setTimeout(timerExpired, wait);
        }
        return result;
      }
      debounced.cancel = cancel;
      debounced.flush = flush;
      return debounced;
    }
    module.exports = debounce;
  }
});

// node_modules/lodash/throttle.js
var require_throttle = __commonJS({
  "node_modules/lodash/throttle.js"(exports, module) {
    var debounce = require_debounce();
    var isObject3 = require_isObject();
    var FUNC_ERROR_TEXT = "Expected a function";
    function throttle2(func, wait, options) {
      var leading = true, trailing = true;
      if (typeof func != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      if (isObject3(options)) {
        leading = "leading" in options ? !!options.leading : leading;
        trailing = "trailing" in options ? !!options.trailing : trailing;
      }
      return debounce(func, wait, {
        "leading": leading,
        "maxWait": wait,
        "trailing": trailing
      });
    }
    module.exports = throttle2;
  }
});

// node_modules/namespace-emitter/index.js
var require_namespace_emitter = __commonJS({
  "node_modules/namespace-emitter/index.js"(exports, module) {
    module.exports = function createNamespaceEmitter() {
      var emitter = {};
      var _fns = emitter._fns = {};
      emitter.emit = function emit(event, arg1, arg2, arg3, arg4, arg5, arg6) {
        var toEmit = getListeners(event);
        if (toEmit.length) {
          emitAll(event, toEmit, [arg1, arg2, arg3, arg4, arg5, arg6]);
        }
      };
      emitter.on = function on(event, fn) {
        if (!_fns[event]) {
          _fns[event] = [];
        }
        _fns[event].push(fn);
      };
      emitter.once = function once(event, fn) {
        function one() {
          fn.apply(this, arguments);
          emitter.off(event, one);
        }
        this.on(event, one);
      };
      emitter.off = function off(event, fn) {
        var keep = [];
        if (event && fn) {
          var fns = this._fns[event];
          var i8 = 0;
          var l5 = fns ? fns.length : 0;
          for (i8; i8 < l5; i8++) {
            if (fns[i8] !== fn) {
              keep.push(fns[i8]);
            }
          }
        }
        keep.length ? this._fns[event] = keep : delete this._fns[event];
      };
      function getListeners(e9) {
        var out = _fns[e9] ? _fns[e9] : [];
        var idx = e9.indexOf(":");
        var args = idx === -1 ? [e9] : [e9.substring(0, idx), e9.substring(idx + 1)];
        var keys = Object.keys(_fns);
        var i8 = 0;
        var l5 = keys.length;
        for (i8; i8 < l5; i8++) {
          var key = keys[i8];
          if (key === "*") {
            out = out.concat(_fns[key]);
          }
          if (args.length === 2 && args[0] === key) {
            out = out.concat(_fns[key]);
            break;
          }
        }
        return out;
      }
      function emitAll(e9, fns, args) {
        var i8 = 0;
        var l5 = fns.length;
        for (i8; i8 < l5; i8++) {
          if (!fns[i8]) break;
          fns[i8].event = e9;
          fns[i8].apply(fns[i8], args);
        }
      }
      return emitter;
    };
  }
});

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.HGBRCPUS.js
var iconPath = "";
var kitCode = "";
function getIconPath() {
  return iconPath.replace(/\/$/, "");
}
function setKitCode(code) {
  kitCode = code;
}
function getKitCode() {
  if (!kitCode) {
    const el = document.querySelector("[data-fa-kit-code]");
    if (el) {
      setKitCode(el.getAttribute("data-fa-kit-code") || "");
    }
  }
  return kitCode;
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.KKI7M5DP.js
var FA_VERSION = "7.3.0";
function getIconFolder(_name, family, variant) {
  let folder = "solid";
  if (family === "chisel") {
    folder = "chisel-regular";
  }
  if (family === "etch") {
    folder = "etch-solid";
  }
  if (family === "graphite") {
    folder = "graphite-thin";
  }
  if (family === "jelly") {
    folder = "jelly-regular";
    if (variant === "duo-regular") folder = "jelly-duo-regular";
    if (variant === "fill-regular") folder = "jelly-fill-regular";
  }
  if (family === "jelly-duo") {
    folder = "jelly-duo-regular";
  }
  if (family === "jelly-fill") {
    folder = "jelly-fill-regular";
  }
  if (family === "notdog") {
    if (variant === "solid") folder = "notdog-solid";
    if (variant === "duo-solid") folder = "notdog-duo-solid";
  }
  if (family === "notdog-duo") {
    folder = "notdog-duo-solid";
  }
  if (family === "slab") {
    if (variant === "solid" || variant === "regular") folder = "slab-regular";
    if (variant === "press-regular") folder = "slab-press-regular";
  }
  if (family === "slab-press") {
    folder = "slab-press-regular";
  }
  if (family === "slab-duo") {
    folder = "slab-duo-regular";
  }
  if (family === "slab-press-duo") {
    folder = "slab-press-duo-regular";
  }
  if (family === "thumbprint") {
    folder = "thumbprint-light";
  }
  if (family === "utility") {
    folder = "utility-semibold";
  }
  if (family === "utility-duo") {
    folder = "utility-duo-semibold";
  }
  if (family === "utility-fill") {
    folder = "utility-fill-semibold";
  }
  if (family === "whiteboard") {
    folder = "whiteboard-semibold";
  }
  if (family === "mosaic") {
    folder = "mosaic-solid";
  }
  if (family === "pixel") {
    folder = "pixel-regular";
  }
  if (family === "vellum") {
    folder = "vellum-solid";
  }
  if (family === "classic") {
    if (variant === "thin") folder = "thin";
    if (variant === "light") folder = "light";
    if (variant === "regular") folder = "regular";
    if (variant === "solid") folder = "solid";
  }
  if (family === "duotone") {
    if (variant === "thin") folder = "duotone-thin";
    if (variant === "light") folder = "duotone-light";
    if (variant === "regular") folder = "duotone-regular";
    if (variant === "solid") folder = "duotone";
  }
  if (family === "sharp") {
    if (variant === "thin") folder = "sharp-thin";
    if (variant === "light") folder = "sharp-light";
    if (variant === "regular") folder = "sharp-regular";
    if (variant === "solid") folder = "sharp-solid";
  }
  if (family === "sharp-duotone") {
    if (variant === "thin") folder = "sharp-duotone-thin";
    if (variant === "light") folder = "sharp-duotone-light";
    if (variant === "regular") folder = "sharp-duotone-regular";
    if (variant === "solid") folder = "sharp-duotone-solid";
  }
  if (family === "brands") {
    folder = "brands";
  }
  return folder;
}
function getIconUrl(name, family, variant) {
  const folder = getIconFolder(name, family, variant);
  const iconBase = getIconPath();
  if (iconBase) {
    return `${iconBase}/${folder}/${name}.svg`;
  }
  const kitCode2 = getKitCode();
  const isPro = kitCode2.length > 0;
  return isPro ? `https://ka-p.fontawesome.com/releases/v${FA_VERSION}/svgs/${folder}/${name}.svg?token=${encodeURIComponent(kitCode2)}` : `https://ka-f.fontawesome.com/releases/v${FA_VERSION}/svgs/${folder}/${name}.svg`;
}
var library = {
  name: "default",
  resolver: (name, family = "classic", variant = "solid") => {
    return getIconUrl(name, family, variant);
  },
  mutator: (svg, hostEl) => {
    if (!svg.hasAttribute("fill")) {
      svg.setAttribute("fill", "currentColor");
    }
    if (hostEl?.family && !svg.hasAttribute("data-duotone-initialized")) {
      const { family, variant } = hostEl;
      if (
        // Duotone
        family === "duotone" || // Sharp duotone
        family === "sharp-duotone" || // Notdog duo (correct usage: family="notdog-duo")
        family === "notdog-duo" || // NOTE: family="notdog" variant="duo-solid" is deprecated
        family === "notdog" && variant === "duo-solid" || // Jelly duo (correct usage: family="jelly-duo")
        family === "jelly-duo" || // NOTE: family="jelly" variant="duo-regular" is deprecated
        family === "jelly" && variant === "duo-regular" || // Utility duo (correct usage: family="utility-duo")
        family === "utility-duo" || // Slab duo (new in 7.3)
        family === "slab-duo" || family === "slab-press-duo" || // Thumbprint
        family === "thumbprint"
      ) {
        const paths = [...svg.querySelectorAll("path")];
        const primaryPath = paths.find((p3) => !p3.hasAttribute("opacity"));
        const secondaryPath = paths.find((p3) => p3.hasAttribute("opacity"));
        if (!primaryPath || !secondaryPath) return;
        primaryPath.setAttribute("data-duotone-primary", "");
        secondaryPath.setAttribute("data-duotone-secondary", "");
        if (hostEl.swapOpacity && primaryPath && secondaryPath) {
          const originalOpacity = secondaryPath.getAttribute("opacity") || "0.4";
          primaryPath.style.setProperty("--path-opacity", originalOpacity);
          secondaryPath.style.setProperty("--path-opacity", "1");
        }
        svg.setAttribute("data-duotone-initialized", "");
      }
    }
  }
};
var library_default_default = library;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.44TPNLVU.js
function dataUri(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
var icons = {
  //
  // Solid variant
  //
  solid: {
    backward: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M236.3 107.1C247.9 96 265 92.9 279.7 99.2C294.4 105.5 304 120 304 136L304 272.3L476.3 107.2C487.9 96 505 92.9 519.7 99.2C534.4 105.5 544 120 544 136L544 504C544 520 534.4 534.5 519.7 540.8C505 547.1 487.9 544 476.3 532.9L304 367.7L304 504C304 520 294.4 534.5 279.7 540.8C265 547.1 247.9 544 236.3 532.9L44.3 348.9C36.5 341.3 32 330.9 32 320C32 309.1 36.5 298.7 44.3 291.1L236.3 107.1z"/></svg>`,
    "backward-step": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M491 100.8C478.1 93.8 462.3 94.5 450 102.6L192 272.1L192 128C192 110.3 177.7 96 160 96C142.3 96 128 110.3 128 128L128 512C128 529.7 142.3 544 160 544C177.7 544 192 529.7 192 512L192 367.9L450 537.5C462.3 545.6 478 546.3 491 539.3C504 532.3 512 518.8 512 504.1L512 136.1C512 121.4 503.9 107.9 491 100.9z"/></svg>`,
    "angles-left": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M77.3 256 214.7 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256zm192 0L406.7 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L269.3 256z"/></svg>`,
    "angles-right": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M434.7 256 297.3 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L434.7 256zm-192 0L105.3 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256z"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M434.8 70.1c14.3 10.4 17.5 30.4 7.1 44.7l-256 352c-5.5 7.6-14 12.3-23.4 13.1s-18.5-2.7-25.1-9.3l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l101.5 101.5 234-321.7c10.4-14.3 30.4-17.5 44.7-7.1z"/></svg>`,
    "chevron-down": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M201.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 338.7 54.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>`,
    "chevron-left": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z"/></svg>`,
    "chevron-right": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M311.1 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L243.2 256 73.9 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>`,
    circle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0z"/></svg>`,
    "closed-captioning": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M64 192C64 156.7 92.7 128 128 128L512 128C547.3 128 576 156.7 576 192L576 448C576 483.3 547.3 512 512 512L128 512C92.7 512 64 483.3 64 448L64 192zM216 272L248 272C252.4 272 256 275.6 256 280C256 293.3 266.7 304 280 304C293.3 304 304 293.3 304 280C304 249.1 278.9 224 248 224L216 224C185.1 224 160 249.1 160 280L160 360C160 390.9 185.1 416 216 416L248 416C278.9 416 304 390.9 304 360C304 346.7 293.3 336 280 336C266.7 336 256 346.7 256 360C256 364.4 252.4 368 248 368L216 368C211.6 368 208 364.4 208 360L208 280C208 275.6 211.6 272 216 272zM384 280C384 275.6 387.6 272 392 272L424 272C428.4 272 432 275.6 432 280C432 293.3 442.7 304 456 304C469.3 304 480 293.3 480 280C480 249.1 454.9 224 424 224L392 224C361.1 224 336 249.1 336 280L336 360C336 390.9 361.1 416 392 416L424 416C454.9 416 480 390.9 480 360C480 346.7 469.3 336 456 336C442.7 336 432 346.7 432 360C432 364.4 428.4 368 424 368L392 368C387.6 368 384 364.4 384 360L384 280z"/></svg>`,
    "closed-captioning-slash": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M39 39.1C48.4 29.7 63.6 29.7 72.9 39.1L161.8 128L512 128C547.3 128 576 156.7 576 192L576 448C576 473.5 561.1 495.4 539.6 505.8L601 567.1C610.4 576.5 610.4 591.7 601 601C591.6 610.3 576.4 610.4 567.1 601L39 73.1C29.7 63.7 29.7 48.5 39 39.1zM384 350.1L384 279.9C384 275.5 387.6 271.9 392 271.9L424 271.9C428.4 271.9 432 275.5 432 279.9C432 293.2 442.7 303.9 456 303.9C469.3 303.9 480 293.2 480 279.9C480 249 454.9 223.9 424 223.9L392 223.9C361.1 223.9 336 249 336 279.9L336 302.1L384 350.1zM445.5 411.6C465.7 403.2 480 383.2 480 359.9C480 346.6 469.3 335.9 456 335.9C442.7 335.9 432 346.6 432 359.9C432 364.3 428.4 367.9 424 367.9L401.8 367.9L445.5 411.6zM162.3 264.1C160.8 269.1 160 274.5 160 280L160 360C160 390.9 185.1 416 216 416L248 416C266.1 416 282.1 407.5 292.4 394.2L410.2 512L128 512C92.7 512 64 483.3 64 448L64 192C64 184.2 65.4 176.7 68 169.8L162.3 264.1zM256.1 357.9C256 358.6 256 359.3 256 360C256 364.4 252.4 368 248 368L216 368C211.6 368 208 364.4 208 360L208 309.8L256.1 357.9z"/></svg>`,
    compress: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M160 64c0-17.7-14.3-32-32-32S96 46.3 96 64l0 64-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32l0-96zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0 0 64c0 17.7 14.3 32 32 32s32-14.3 32-32l0-96c0-17.7-14.3-32-32-32l-96 0zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7 14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-64zM320 320c-17.7 0-32 14.3-32 32l0 96c0 17.7 14.3 32 32 32s32-14.3 32-32l0-64 64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0z"/></svg>`,
    ellipsis: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.3.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M96 320C96 289.1 121.1 264 152 264C182.9 264 208 289.1 208 320C208 350.9 182.9 376 152 376C121.1 376 96 350.9 96 320zM264 320C264 289.1 289.1 264 320 264C350.9 264 376 289.1 376 320C376 350.9 350.9 376 320 376C289.1 376 264 350.9 264 320zM488 264C518.9 264 544 289.1 544 320C544 350.9 518.9 376 488 376C457.1 376 432 350.9 432 320C432 289.1 457.1 264 488 264z"/></svg>`,
    "ellipsis-vertical": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M320 208C289.1 208 264 182.9 264 152C264 121.1 289.1 96 320 96C350.9 96 376 121.1 376 152C376 182.9 350.9 208 320 208zM320 432C350.9 432 376 457.1 376 488C376 518.9 350.9 544 320 544C289.1 544 264 518.9 264 488C264 457.1 289.1 432 320 432zM376 320C376 350.9 350.9 376 320 376C289.1 376 264 350.9 264 320C264 289.1 289.1 264 320 264C350.9 264 376 289.1 376 320z"/></svg>`,
    expand: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M128 96C110.3 96 96 110.3 96 128L96 224C96 241.7 110.3 256 128 256C145.7 256 160 241.7 160 224L160 160L224 160C241.7 160 256 145.7 256 128C256 110.3 241.7 96 224 96L128 96zM160 416C160 398.3 145.7 384 128 384C110.3 384 96 398.3 96 416L96 512C96 529.7 110.3 544 128 544L224 544C241.7 544 256 529.7 256 512C256 494.3 241.7 480 224 480L160 480L160 416zM416 96C398.3 96 384 110.3 384 128C384 145.7 398.3 160 416 160L480 160L480 224C480 241.7 494.3 256 512 256C529.7 256 544 241.7 544 224L544 128C544 110.3 529.7 96 512 96L416 96zM544 416C544 398.3 529.7 384 512 384C494.3 384 480 398.3 480 416L480 480L416 480C398.3 480 384 494.3 384 512C384 529.7 398.3 544 416 544L512 544C529.7 544 544 529.7 544 512L544 416z"/></svg>`,
    eyedropper: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M341.6 29.2l-101.6 101.6-9.4-9.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-9.4-9.4 101.6-101.6c39-39 39-102.2 0-141.1s-102.2-39-141.1 0zM55.4 323.3c-15 15-23.4 35.4-23.4 56.6l0 42.4-26.6 39.9c-8.5 12.7-6.8 29.6 4 40.4s27.7 12.5 40.4 4l39.9-26.6 42.4 0c21.2 0 41.6-8.4 56.6-23.4l109.4-109.4-45.3-45.3-109.4 109.4c-3 3-7.1 4.7-11.3 4.7l-36.1 0 0-36.1c0-4.2 1.7-8.3 4.7-11.3l109.4-109.4-45.3-45.3-109.4 109.4z"/></svg>`,
    forward: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M403.7 107.1C392.1 96 375 92.9 360.3 99.2C345.6 105.5 336 120 336 136L336 272.3L163.7 107.2C152.1 96 135 92.9 120.3 99.2C105.6 105.5 96 120 96 136L96 504C96 520 105.6 534.5 120.3 540.8C135 547.1 152.1 544 163.7 532.9L336 367.7L336 504C336 520 345.6 534.5 360.3 540.8C375 547.1 392.1 544 403.7 532.9L595.7 348.9C603.6 341.4 608 330.9 608 320C608 309.1 603.5 298.7 595.7 291.1L403.7 107.1z"/></svg>`,
    file: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M192 64C156.7 64 128 92.7 128 128L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 234.5C512 217.5 505.3 201.2 493.3 189.2L386.7 82.7C374.7 70.7 358.5 64 341.5 64L192 64zM453.5 240L360 240C346.7 240 336 229.3 336 216L336 122.5L453.5 240z"/></svg>`,
    "file-audio": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM389.8 307.7C380.7 301.4 368.3 303.6 362 312.7C355.7 321.8 357.9 334.2 367 340.5C390.9 357.2 406.4 384.8 406.4 416C406.4 447.2 390.8 474.9 367 491.5C357.9 497.8 355.7 510.3 362 519.3C368.3 528.3 380.8 530.6 389.8 524.3C423.9 500.5 446.4 460.8 446.4 416C446.4 371.2 424 331.5 389.8 307.7zM208 376C199.2 376 192 383.2 192 392L192 440C192 448.8 199.2 456 208 456L232 456L259.2 490C262.2 493.8 266.8 496 271.7 496L272 496C280.8 496 288 488.8 288 480L288 352C288 343.2 280.8 336 272 336L271.7 336C266.8 336 262.2 338.2 259.2 342L232 376L208 376zM336 448.2C336 458.9 346.5 466.4 354.9 459.8C367.8 449.5 376 433.7 376 416C376 398.3 367.8 382.5 354.9 372.2C346.5 365.5 336 373.1 336 383.8L336 448.3z"/></svg>`,
    "file-code": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM282.2 359.6C290.8 349.5 289.7 334.4 279.6 325.8C269.5 317.2 254.4 318.3 245.8 328.4L197.8 384.4C190.1 393.4 190.1 406.6 197.8 415.6L245.8 471.6C254.4 481.7 269.6 482.8 279.6 474.2C289.6 465.6 290.8 450.4 282.2 440.4L247.6 400L282.2 359.6zM394.2 328.4C385.6 318.3 370.4 317.2 360.4 325.8C350.4 334.4 349.2 349.6 357.8 359.6L392.4 400L357.8 440.4C349.2 450.5 350.3 465.6 360.4 474.2C370.5 482.8 385.6 481.7 394.2 471.6L442.2 415.6C449.9 406.6 449.9 393.4 442.2 384.4L394.2 328.4z"/></svg>`,
    "file-excel": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM292 330.7C284.6 319.7 269.7 316.7 258.7 324C247.7 331.3 244.7 346.3 252 357.3L291.2 416L252 474.7C244.6 485.7 247.6 500.6 258.7 508C269.8 515.4 284.6 512.4 292 501.3L320 459.3L348 501.3C355.4 512.3 370.3 515.3 381.3 508C392.3 500.7 395.3 485.7 388 474.7L348.8 416L388 357.3C395.4 346.3 392.4 331.4 381.3 324C370.2 316.6 355.4 319.6 348 330.7L320 372.7L292 330.7z"/></svg>`,
    "file-image": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM256 320C256 302.3 241.7 288 224 288C206.3 288 192 302.3 192 320C192 337.7 206.3 352 224 352C241.7 352 256 337.7 256 320zM220.6 512L419.4 512C435.2 512 448 499.2 448 483.4C448 476.1 445.2 469 440.1 463.7L343.3 361.9C337.3 355.6 328.9 352 320.1 352L319.8 352C311 352 302.7 355.6 296.6 361.9L199.9 463.7C194.8 469 192 476.1 192 483.4C192 499.2 204.8 512 220.6 512z"/></svg>`,
    "file-pdf": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M128 64C92.7 64 64 92.7 64 128L64 512C64 547.3 92.7 576 128 576L208 576L208 464C208 428.7 236.7 400 272 400L448 400L448 234.5C448 217.5 441.3 201.2 429.3 189.2L322.7 82.7C310.7 70.7 294.5 64 277.5 64L128 64zM389.5 240L296 240C282.7 240 272 229.3 272 216L272 122.5L389.5 240zM272 444C261 444 252 453 252 464L252 592C252 603 261 612 272 612C283 612 292 603 292 592L292 564L304 564C337.1 564 364 537.1 364 504C364 470.9 337.1 444 304 444L272 444zM304 524L292 524L292 484L304 484C315 484 324 493 324 504C324 515 315 524 304 524zM400 444C389 444 380 453 380 464L380 592C380 603 389 612 400 612L432 612C460.7 612 484 588.7 484 560L484 496C484 467.3 460.7 444 432 444L400 444zM420 572L420 484L432 484C438.6 484 444 489.4 444 496L444 560C444 566.6 438.6 572 432 572L420 572zM508 464L508 592C508 603 517 612 528 612C539 612 548 603 548 592L548 548L576 548C587 548 596 539 596 528C596 517 587 508 576 508L548 508L548 484L576 484C587 484 596 475 596 464C596 453 587 444 576 444L528 444C517 444 508 453 508 464z"/></svg>`,
    "file-powerpoint": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM280 320C266.7 320 256 330.7 256 344L256 488C256 501.3 266.7 512 280 512C293.3 512 304 501.3 304 488L304 464L328 464C367.8 464 400 431.8 400 392C400 352.2 367.8 320 328 320L280 320zM328 416L304 416L304 368L328 368C341.3 368 352 378.7 352 392C352 405.3 341.3 416 328 416z"/></svg>`,
    "file-video": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM208 368L208 464C208 481.7 222.3 496 240 496L336 496C353.7 496 368 481.7 368 464L368 440L403 475C406.2 478.2 410.5 480 415 480C424.4 480 432 472.4 432 463L432 368.9C432 359.5 424.4 351.9 415 351.9C410.5 351.9 406.2 353.7 403 356.9L368 391.9L368 367.9C368 350.2 353.7 335.9 336 335.9L240 335.9C222.3 335.9 208 350.2 208 367.9z"/></svg>`,
    "file-word": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM263.4 338.8C260.5 325.9 247.7 317.7 234.8 320.6C221.9 323.5 213.7 336.3 216.6 349.2L248.6 493.2C250.9 503.7 260 511.4 270.8 512C281.6 512.6 291.4 505.9 294.8 495.6L320 419.9L345.2 495.6C348.6 505.8 358.4 512.5 369.2 512C380 511.5 389.1 503.8 391.4 493.2L423.4 349.2C426.3 336.3 418.1 323.4 405.2 320.6C392.3 317.8 379.4 325.9 376.6 338.8L363.4 398.2L342.8 336.4C339.5 326.6 330.4 320 320 320C309.6 320 300.5 326.6 297.2 336.4L276.6 398.2L263.4 338.8z"/></svg>`,
    "file-zipper": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM192 136C192 149.3 202.7 160 216 160L264 160C277.3 160 288 149.3 288 136C288 122.7 277.3 112 264 112L216 112C202.7 112 192 122.7 192 136zM192 232C192 245.3 202.7 256 216 256L264 256C277.3 256 288 245.3 288 232C288 218.7 277.3 208 264 208L216 208C202.7 208 192 218.7 192 232zM256 304L224 304C206.3 304 192 318.3 192 336L192 384C192 410.5 213.5 432 240 432C266.5 432 288 410.5 288 384L288 336C288 318.3 273.7 304 256 304zM240 368C248.8 368 256 375.2 256 384C256 392.8 248.8 400 240 400C231.2 400 224 392.8 224 384C224 375.2 231.2 368 240 368z"/></svg>`,
    "forward-step": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M21 36.8c12.9-7 28.7-6.3 41 1.8L320 208.1 320 64c0-17.7 14.3-32 32-32s32 14.3 32 32l0 384c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-144.1-258 169.6c-12.3 8.1-28 8.8-41 1.8S0 454.7 0 440L0 72C0 57.3 8.1 43.8 21 36.8z"/></svg>`,
    gauge: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0zm320 96c0-26.9-16.5-49.9-40-59.3L280 120c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 172.7c-23.5 9.5-40 32.5-40 59.3 0 35.3 28.7 64 64 64s64-28.7 64-64zM144 176a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm-16 80a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm288 32a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM400 144a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>`,
    gear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z"/></svg>`,
    "grip-vertical": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M128 40c0-22.1-17.9-40-40-40L40 0C17.9 0 0 17.9 0 40L0 88c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48zm0 192c0-22.1-17.9-40-40-40l-48 0c-22.1 0-40 17.9-40 40l0 48c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48zM0 424l0 48c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48c0-22.1-17.9-40-40-40l-48 0c-22.1 0-40 17.9-40 40zM320 40c0-22.1-17.9-40-40-40L232 0c-22.1 0-40 17.9-40 40l0 48c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48zM192 232l0 48c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48c0-22.1-17.9-40-40-40l-48 0c-22.1 0-40 17.9-40 40zM320 424c0-22.1-17.9-40-40-40l-48 0c-22.1 0-40 17.9-40 40l0 48c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48z"/></svg>`,
    indeterminate: `<svg part="indeterminate-icon" class="icon" viewBox="0 0 16 16"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round"><g stroke="currentColor" stroke-width="2"><g transform="translate(2.285714 6.857143)"><path d="M10.2857143,1.14285714 L1.14285714,1.14285714"/></g></g></g></svg>`,
    minus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32z"/></svg>`,
    pause: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M48 32C21.5 32 0 53.5 0 80L0 432c0 26.5 21.5 48 48 48l64 0c26.5 0 48-21.5 48-48l0-352c0-26.5-21.5-48-48-48L48 32zm224 0c-26.5 0-48 21.5-48 48l0 352c0 26.5 21.5 48 48 48l64 0c26.5 0 48-21.5 48-48l0-352c0-26.5-21.5-48-48-48l-64 0z"/></svg>`,
    "picture-in-picture": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M448 32c35.3 0 64 28.7 64 64l0 112-64 0 0-112-384 0 0 320 144 0 0 64-144 0-6.5-.3c-30.1-3.1-54.1-27-57.1-57.1L0 416 0 96C0 62.9 25.2 35.6 57.5 32.3L64 32 448 32zm16 224c26.5 0 48 21.5 48 48l0 128c0 26.5-21.5 48-48 48l-160 0c-26.5 0-48-21.5-48-48l0-128c0-26.5 21.5-48 48-48l160 0z"/></svg>`,
    play: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M91.2 36.9c-12.4-6.8-27.4-6.5-39.6 .7S32 57.9 32 72l0 368c0 14.1 7.5 27.2 19.6 34.4s27.2 7.5 39.6 .7l336-184c12.8-7 20.8-20.5 20.8-35.1s-8-28.1-20.8-35.1l-336-184z"/></svg>`,
    "play-circle": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0zM188.3 147.1c-7.6 4.2-12.3 12.3-12.3 20.9l0 176c0 8.7 4.7 16.7 12.3 20.9s16.8 4.1 24.3-.5l144-88c7.1-4.4 11.5-12.1 11.5-20.5s-4.4-16.1-11.5-20.5l-144-88c-7.4-4.5-16.7-4.7-24.3-.5z"/></svg>`,
    plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M352 128C352 110.3 337.7 96 320 96C302.3 96 288 110.3 288 128L288 288L128 288C110.3 288 96 302.3 96 320C96 337.7 110.3 352 128 352L288 352L288 512C288 529.7 302.3 544 320 544C337.7 544 352 529.7 352 512L352 352L512 352C529.7 352 544 337.7 544 320C544 302.3 529.7 288 512 288L352 288L352 128z"/></svg>`,
    star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M309.5-18.9c-4.1-8-12.4-13.1-21.4-13.1s-17.3 5.1-21.4 13.1L193.1 125.3 33.2 150.7c-8.9 1.4-16.3 7.7-19.1 16.3s-.5 18 5.8 24.4l114.4 114.5-25.2 159.9c-1.4 8.9 2.3 17.9 9.6 23.2s16.9 6.1 25 2L288.1 417.6 432.4 491c8 4.1 17.7 3.3 25-2s11-14.2 9.6-23.2L441.7 305.9 556.1 191.4c6.4-6.4 8.6-15.8 5.8-24.4s-10.1-14.9-19.1-16.3L383 125.3 309.5-18.9z"/></svg>`,
    upload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M352 173.3L352 384C352 401.7 337.7 416 320 416C302.3 416 288 401.7 288 384L288 173.3L246.6 214.7C234.1 227.2 213.8 227.2 201.3 214.7C188.8 202.2 188.8 181.9 201.3 169.4L297.3 73.4C309.8 60.9 330.1 60.9 342.6 73.4L438.6 169.4C451.1 181.9 451.1 202.2 438.6 214.7C426.1 227.2 405.8 227.2 393.3 214.7L352 173.3zM320 464C364.2 464 400 428.2 400 384L480 384C515.3 384 544 412.7 544 448L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 448C96 412.7 124.7 384 160 384L240 384C240 428.2 275.8 464 320 464zM464 488C477.3 488 488 477.3 488 464C488 450.7 477.3 440 464 440C450.7 440 440 450.7 440 464C440 477.3 450.7 488 464 488z"/></svg>`,
    user: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M224 248a120 120 0 1 0 0-240 120 120 0 1 0 0 240zm-29.7 56C95.8 304 16 383.8 16 482.3 16 498.7 29.3 512 45.7 512l356.6 0c16.4 0 29.7-13.3 29.7-29.7 0-98.5-79.8-178.3-178.3-178.3l-59.4 0z"/></svg>`,
    volume: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M48 352l48 0 134.1 119.2c6.4 5.7 14.6 8.8 23.1 8.8 19.2 0 34.8-15.6 34.8-34.8l0-378.4c0-19.2-15.6-34.8-34.8-34.8-8.5 0-16.7 3.1-23.1 8.8L96 160 48 160c-26.5 0-48 21.5-48 48l0 96c0 26.5 21.5 48 48 48zM441.1 107c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C443.3 170.7 464 210.9 464 256s-20.7 85.3-53.2 111.8c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5c43.2-35.2 70.9-88.9 70.9-149s-27.7-113.8-70.9-149zm-60.5 74.5c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C361.1 227.6 368 241 368 256s-6.9 28.4-17.7 37.3c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5C402.1 312.9 416 286.1 416 256s-13.9-56.9-35.5-74.5z"/></svg>`,
    "volume-low": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M48 352l48 0 134.1 119.2c6.4 5.7 14.6 8.8 23.1 8.8 19.2 0 34.8-15.6 34.8-34.8l0-378.4c0-19.2-15.6-34.8-34.8-34.8-8.5 0-16.7 3.1-23.1 8.8L96 160 48 160c-26.5 0-48 21.5-48 48l0 96c0 26.5 21.5 48 48 48zM380.6 181.5c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C361.1 227.6 368 241 368 256s-6.9 28.4-17.7 37.3c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5C402.1 312.9 416 286.1 416 256s-13.9-56.9-35.5-74.5z"/></svg>`,
    "volume-xmark": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M48 352l48 0 134.1 119.2c6.4 5.7 14.6 8.8 23.1 8.8 19.2 0 34.8-15.6 34.8-34.8l0-378.4c0-19.2-15.6-34.8-34.8-34.8-8.5 0-16.7 3.1-23.1 8.8L96 160 48 160c-26.5 0-48 21.5-48 48l0 96c0 26.5 21.5 48 48 48zM367 175c-9.4 9.4-9.4 24.6 0 33.9l47 47-47 47c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l47-47 47 47c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-47-47 47-47c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-47 47-47-47c-9.4-9.4-24.6-9.4-33.9 0z"/></svg>`,
    xmark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L147.2 256 9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192.5 301.3 329.9 438.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.8 256 375.1 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192.5 210.7 55.1 73.4z"/></svg>`
  },
  //
  // Regular variant
  //
  regular: {
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M216 64C229.3 64 240 74.7 240 88L240 128L400 128L400 88C400 74.7 410.7 64 424 64C437.3 64 448 74.7 448 88L448 128L480 128C515.3 128 544 156.7 544 192L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 192C96 156.7 124.7 128 160 128L192 128L192 88C192 74.7 202.7 64 216 64zM216 176L160 176C151.2 176 144 183.2 144 192L144 240L496 240L496 192C496 183.2 488.8 176 480 176L216 176zM144 288L144 480C144 488.8 151.2 496 160 496L480 496C488.8 496 496 488.8 496 480L496 288L144 288z"/></svg>`,
    "circle-question": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M464 256a208 208 0 1 0 -416 0 208 208 0 1 0 416 0zM0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0zm256-80c-17.7 0-32 14.3-32 32 0 13.3-10.7 24-24 24s-24-10.7-24-24c0-44.2 35.8-80 80-80s80 35.8 80 80c0 47.2-36 67.2-56 74.5l0 3.8c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-8.1c0-20.5 14.8-35.2 30.1-40.2 6.4-2.1 13.2-5.5 18.2-10.3 4.3-4.2 7.7-10 7.7-19.6 0-17.7-14.3-32-32-32zM224 368a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>`,
    "circle-xmark": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464a256 256 0 1 0 0-512 256 256 0 1 0 0 512zM167 167c-9.4 9.4-9.4 24.6 0 33.9l55 55-55 55c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l55-55 55 55c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-55-55 55-55c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-55 55-55-55c-9.4-9.4-24.6-9.4-33.9 0z"/></svg>`,
    clock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M528 320C528 434.9 434.9 528 320 528C205.1 528 112 434.9 112 320C112 205.1 205.1 112 320 112C434.9 112 528 205.1 528 320zM64 320C64 461.4 178.6 576 320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M384 336l-192 0c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l133.5 0c4.2 0 8.3 1.7 11.3 4.7l58.5 58.5c3 3 4.7 7.1 4.7 11.3L400 320c0 8.8-7.2 16-16 16zM192 384l192 0c35.3 0 64-28.7 64-64l0-197.5c0-17-6.7-33.3-18.7-45.3L370.7 18.7C358.7 6.7 342.5 0 325.5 0L192 0c-35.3 0-64 28.7-64 64l0 256c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64L0 448c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-16-48 0 0 16c0 8.8-7.2 16-16 16L64 464c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l16 0 0-48-16 0z"/></svg>`,
    eye: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M288 80C222.8 80 169.2 109.6 128.1 147.7 89.6 183.5 63 226 49.4 256 63 286 89.6 328.5 128.1 364.3 169.2 402.4 222.8 432 288 432s118.8-29.6 159.9-67.7C486.4 328.5 513 286 526.6 256 513 226 486.4 183.5 447.9 147.7 406.8 109.6 353.2 80 288 80zM95.4 112.6C142.5 68.8 207.2 32 288 32s145.5 36.8 192.6 80.6c46.8 43.5 78.1 95.4 93 131.1 3.3 7.9 3.3 16.7 0 24.6-14.9 35.7-46.2 87.7-93 131.1-47.1 43.7-111.8 80.6-192.6 80.6S142.5 443.2 95.4 399.4c-46.8-43.5-78.1-95.4-93-131.1-3.3-7.9-3.3-16.7 0-24.6 14.9-35.7 46.2-87.7 93-131.1zM288 336c44.2 0 80-35.8 80-80 0-29.6-16.1-55.5-40-69.3-1.4 59.7-49.6 107.9-109.3 109.3 13.8 23.9 39.7 40 69.3 40zm-79.6-88.4c2.5 .3 5 .4 7.6 .4 35.3 0 64-28.7 64-64 0-2.6-.2-5.1-.4-7.6-37.4 3.9-67.2 33.7-71.1 71.1zm45.6-115c10.8-3 22.2-4.5 33.9-4.5 8.8 0 17.5 .9 25.8 2.6 .3 .1 .5 .1 .8 .2 57.9 12.2 101.4 63.7 101.4 125.2 0 70.7-57.3 128-128 128-61.6 0-113-43.5-125.2-101.4-1.8-8.6-2.8-17.5-2.8-26.6 0-11 1.4-21.8 4-32 .2-.7 .3-1.3 .5-1.9 11.9-43.4 46.1-77.6 89.5-89.5z"/></svg>`,
    "eye-slash": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M41-24.9c-9.4-9.4-24.6-9.4-33.9 0S-2.3-.3 7 9.1l528 528c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-96.4-96.4c2.7-2.4 5.4-4.8 8-7.2 46.8-43.5 78.1-95.4 93-131.1 3.3-7.9 3.3-16.7 0-24.6-14.9-35.7-46.2-87.7-93-131.1-47.1-43.7-111.8-80.6-192.6-80.6-56.8 0-105.6 18.2-146 44.2L41-24.9zM176.9 111.1c32.1-18.9 69.2-31.1 111.1-31.1 65.2 0 118.8 29.6 159.9 67.7 38.5 35.7 65.1 78.3 78.6 108.3-13.6 30-40.2 72.5-78.6 108.3-3.1 2.8-6.2 5.6-9.4 8.4L393.8 328c14-20.5 22.2-45.3 22.2-72 0-70.7-57.3-128-128-128-26.7 0-51.5 8.2-72 22.2l-39.1-39.1zm182 182l-108-108c11.1-5.8 23.7-9.1 37.1-9.1 44.2 0 80 35.8 80 80 0 13.4-3.3 26-9.1 37.1zM103.4 173.2l-34-34c-32.6 36.8-55 75.8-66.9 104.5-3.3 7.9-3.3 16.7 0 24.6 14.9 35.7 46.2 87.7 93 131.1 47.1 43.7 111.8 80.6 192.6 80.6 37.3 0 71.2-7.9 101.5-20.6L352.2 422c-20 6.4-41.4 10-64.2 10-65.2 0-118.8-29.6-159.9-67.7-38.5-35.7-65.1-78.3-78.6-108.3 10.4-23.1 28.6-53.6 54-82.8z"/></svg>`,
    star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path d="M288.1-32c9 0 17.3 5.1 21.4 13.1L383 125.3 542.9 150.7c8.9 1.4 16.3 7.7 19.1 16.3s.5 18-5.8 24.4L441.7 305.9 467 465.8c1.4 8.9-2.3 17.9-9.6 23.2s-17 6.1-25 2L288.1 417.6 143.8 491c-8 4.1-17.7 3.3-25-2s-11-14.2-9.6-23.2L134.4 305.9 20 191.4c-6.4-6.4-8.6-15.8-5.8-24.4s10.1-14.9 19.1-16.3l159.9-25.4 73.6-144.2c4.1-8 12.4-13.1 21.4-13.1zm0 76.8L230.3 158c-3.5 6.8-10 11.6-17.6 12.8l-125.5 20 89.8 89.9c5.4 5.4 7.9 13.1 6.7 20.7l-19.8 125.5 113.3-57.6c6.8-3.5 14.9-3.5 21.8 0l113.3 57.6-19.8-125.5c-1.2-7.6 1.3-15.3 6.7-20.7l89.8-89.9-125.5-20c-7.6-1.2-14.1-6-17.6-12.8L288.1 44.8z"/></svg>`
  }
};
var systemLibrary = {
  name: "system",
  resolver: (name, _family = "classic", variant = "solid") => {
    let collection = icons[variant];
    let svg = collection[name] ?? icons.regular[name] ?? icons.regular["circle-question"];
    if (svg) {
      return dataUri(svg);
    }
    return "";
  },
  mutator: (svg) => {
    if (!svg.hasAttribute("fill")) {
      svg.setAttribute("fill", "currentColor");
    }
  }
};
var library_system_default = systemLibrary;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.ZRLTNBWF.js
var defaultIconFamily = "classic";
var registry = [library_default_default, library_system_default];
var watchedIcons = /* @__PURE__ */ new Set();
function watchIcon(icon) {
  watchedIcons.add(icon);
}
function unwatchIcon(icon) {
  watchedIcons.delete(icon);
}
function getIconLibrary(name) {
  return registry.find((lib) => lib.name === name);
}
function registerIconLibrary(name, options) {
  unregisterIconLibrary(name);
  registry.push({
    name,
    resolver: options.resolver,
    mutator: options.mutator,
    spriteSheet: options.spriteSheet
  });
  watchedIcons.forEach((icon) => {
    if (icon.library === name) {
      icon.setIcon();
    }
  });
}
function unregisterIconLibrary(name) {
  registry = registry.filter((lib) => lib.name !== name);
}
function getDefaultIconFamily() {
  return defaultIconFamily;
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.7VGCIHDG.js
var __defProp2 = Object.defineProperty;
var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc2(target, key) : target;
  for (var i8 = decorators.length - 1, decorator; i8 >= 0; i8--)
    if (decorator = decorators[i8])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp2(target, key, result);
  return result;
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);

// generated/icons.js
var icons2 = { "alert-triangle": '<!--\ntags: [warning, danger, caution, risk, alert, triangle, control, operation, function, interface]\ncategory: System\nversion: "1.0"\nunicode: "ea06"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 9v4" />\n  <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" />\n  <path d="M12 16h.01" />\n</svg>\n', "check": '<!--\ntags: [tick, "yes", confirm, check, control, operation, approve, function, interface, management]\ncategory: System\nversion: "1.0"\nunicode: "ea5e"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M5 12l5 5l10 -10" />\n</svg>\n', "chevron-down": '<!--\ntags: [move, next, swipe, bottom, chevron, down, decrease, navigation, flow, fall]\ncategory: Arrows\nversion: "1.0"\nunicode: "ea5f"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M6 9l6 6l6 -6" />\n</svg>\n', "chevron-right": '<!--\ntags: [move, checklist, next, chevron, right, navigation, flow, movement, route, path]\ncategory: Arrows\nversion: "1.0"\nunicode: "ea61"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M9 6l6 6l-6 6" />\n</svg>\n', "copy": '<!--\ntags: [clipboard, clone, duplicate, copy, typography, writing, font, character, word]\ncategory: Text\nversion: "1.0"\nunicode: "ea7a"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" />\n  <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />\n</svg>\n', "dots": '<!--\ntags: [hellip, more, ellipsis, dots, control, operation, function, interface, management]\ncategory: System\nversion: "1.0"\nunicode: "ea95"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />\n  <path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />\n  <path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />\n</svg>\n', "external-link": '<!--\ntags: [connection, outbound, redirect, new tab, tab, square, arrow, external, link, control]\ncategory: System\nversion: "1.0"\nunicode: "ea99"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />\n  <path d="M11 13l9 -9" />\n  <path d="M15 4h5v5" />\n</svg>\n', "history": '<!--\ntags: [search, see, past, card, website, history, control, operation, function, interface]\ncategory: System\nversion: "1.7"\nunicode: "ebea"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 8l0 4l2 2" />\n  <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />\n</svg>\n', "loader-2": '<!--\ntags: [process, download, upload, loader, loading, control, operation, function, interface, management]\ncategory: System\nversion: "1.72"\nunicode: "f226"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 3a9 9 0 1 0 9 9" />\n</svg>\n', "menu-2": '<!--\ntags: [bars, hamburger, navigation, burger, menu, control, operation, function, interface, management]\ncategory: System\nversion: "1.11"\nunicode: "ec42"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M4 6l16 0" />\n  <path d="M4 12l16 0" />\n  <path d="M4 18l16 0" />\n</svg>\n', "plus": '<!--\ntags: [add, create, new, "+", plus, calculation, equation, more, increase, positive]\ncategory: Math\nversion: "1.0"\nunicode: "eb0b"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 5l0 14" />\n  <path d="M5 12l14 0" />\n</svg>\n', "refresh": '<!--\ntags: [synchronization, reload, restart, spinner, loader, ajax, update, arrows, refresh, navigation]\ncategory: Arrows\nversion: "1.0"\nunicode: "eb13"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />\n  <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />\n</svg>\n', "search": '<!--\ncategory: System\ntags: [find, magnifier, magnifying glass, search, look, seek, query, browse]\nversion: "1.0"\nunicode: "eb1c"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />\n  <path d="M21 21l-6 -6" />\n</svg>\n', "settings": '<!--\ntags: [cog, edit, gear, preferences, tools, settings, config, options, control, operation]\ncategory: System\nversion: "1.0"\nunicode: "eb20"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" />\n  <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />\n</svg>\n', "trash": '<!--\ntags: [garbage, delete, remove, bin, ash-bin, uninstall, dustbin, trash, control, operation]\ncategory: System\nversion: "1.0"\nunicode: "eb41"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M4 7l16 0" />\n  <path d="M10 11l0 6" />\n  <path d="M14 11l0 6" />\n  <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />\n  <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />\n</svg>\n', "x": '<!--\ncategory: System\ntags: [cancel, remove, delete, empty, close, x]\nversion: "1.0"\nunicode: "eb55"\n-->\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M18 6l-12 12" />\n  <path d="M6 6l12 12" />\n</svg>\n' };

// node_modules/@lit/reactive-element/css-tag.js
var t = globalThis;
var e = t.ShadowRoot && (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s = /* @__PURE__ */ Symbol();
var o = /* @__PURE__ */ new WeakMap();
var n = class {
  constructor(t6, e9, o9) {
    if (this._$cssResult$ = true, o9 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t6, this.t = e9;
  }
  get styleSheet() {
    let t6 = this.o;
    const s4 = this.t;
    if (e && void 0 === t6) {
      const e9 = void 0 !== s4 && 1 === s4.length;
      e9 && (t6 = o.get(s4)), void 0 === t6 && ((this.o = t6 = new CSSStyleSheet()).replaceSync(this.cssText), e9 && o.set(s4, t6));
    }
    return t6;
  }
  toString() {
    return this.cssText;
  }
};
var r = (t6) => new n("string" == typeof t6 ? t6 : t6 + "", void 0, s);
var i = (t6, ...e9) => {
  const o9 = 1 === t6.length ? t6[0] : e9.reduce((e10, s4, o10) => e10 + ((t7) => {
    if (true === t7._$cssResult$) return t7.cssText;
    if ("number" == typeof t7) return t7;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + t7 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s4) + t6[o10 + 1], t6[0]);
  return new n(o9, t6, s);
};
var S = (s4, o9) => {
  if (e) s4.adoptedStyleSheets = o9.map((t6) => t6 instanceof CSSStyleSheet ? t6 : t6.styleSheet);
  else for (const e9 of o9) {
    const o10 = document.createElement("style"), n6 = t.litNonce;
    void 0 !== n6 && o10.setAttribute("nonce", n6), o10.textContent = e9.cssText, s4.appendChild(o10);
  }
};
var c = e ? (t6) => t6 : (t6) => t6 instanceof CSSStyleSheet ? ((t7) => {
  let e9 = "";
  for (const s4 of t7.cssRules) e9 += s4.cssText;
  return r(e9);
})(t6) : t6;

// node_modules/@lit/reactive-element/reactive-element.js
var { is: i2, defineProperty: e2, getOwnPropertyDescriptor: h, getOwnPropertyNames: r2, getOwnPropertySymbols: o2, getPrototypeOf: n2 } = Object;
var a = globalThis;
var c2 = a.trustedTypes;
var l = c2 ? c2.emptyScript : "";
var p = a.reactiveElementPolyfillSupport;
var d = (t6, s4) => t6;
var u = { toAttribute(t6, s4) {
  switch (s4) {
    case Boolean:
      t6 = t6 ? l : null;
      break;
    case Object:
    case Array:
      t6 = null == t6 ? t6 : JSON.stringify(t6);
  }
  return t6;
}, fromAttribute(t6, s4) {
  let i8 = t6;
  switch (s4) {
    case Boolean:
      i8 = null !== t6;
      break;
    case Number:
      i8 = null === t6 ? null : Number(t6);
      break;
    case Object:
    case Array:
      try {
        i8 = JSON.parse(t6);
      } catch (t7) {
        i8 = null;
      }
  }
  return i8;
} };
var f = (t6, s4) => !i2(t6, s4);
var b = { attribute: true, type: String, converter: u, reflect: false, useDefault: false, hasChanged: f };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), a.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var y = class extends HTMLElement {
  static addInitializer(t6) {
    this._$Ei(), (this.l ??= []).push(t6);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t6, s4 = b) {
    if (s4.state && (s4.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t6) && ((s4 = Object.create(s4)).wrapped = true), this.elementProperties.set(t6, s4), !s4.noAccessor) {
      const i8 = /* @__PURE__ */ Symbol(), h3 = this.getPropertyDescriptor(t6, i8, s4);
      void 0 !== h3 && e2(this.prototype, t6, h3);
    }
  }
  static getPropertyDescriptor(t6, s4, i8) {
    const { get: e9, set: r7 } = h(this.prototype, t6) ?? { get() {
      return this[s4];
    }, set(t7) {
      this[s4] = t7;
    } };
    return { get: e9, set(s5) {
      const h3 = e9?.call(this);
      r7?.call(this, s5), this.requestUpdate(t6, h3, i8);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t6) {
    return this.elementProperties.get(t6) ?? b;
  }
  static _$Ei() {
    if (this.hasOwnProperty(d("elementProperties"))) return;
    const t6 = n2(this);
    t6.finalize(), void 0 !== t6.l && (this.l = [...t6.l]), this.elementProperties = new Map(t6.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(d("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d("properties"))) {
      const t7 = this.properties, s4 = [...r2(t7), ...o2(t7)];
      for (const i8 of s4) this.createProperty(i8, t7[i8]);
    }
    const t6 = this[Symbol.metadata];
    if (null !== t6) {
      const s4 = litPropertyMetadata.get(t6);
      if (void 0 !== s4) for (const [t7, i8] of s4) this.elementProperties.set(t7, i8);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t7, s4] of this.elementProperties) {
      const i8 = this._$Eu(t7, s4);
      void 0 !== i8 && this._$Eh.set(i8, t7);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(s4) {
    const i8 = [];
    if (Array.isArray(s4)) {
      const e9 = new Set(s4.flat(1 / 0).reverse());
      for (const s5 of e9) i8.unshift(c(s5));
    } else void 0 !== s4 && i8.push(c(s4));
    return i8;
  }
  static _$Eu(t6, s4) {
    const i8 = s4.attribute;
    return false === i8 ? void 0 : "string" == typeof i8 ? i8 : "string" == typeof t6 ? t6.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t6) => this.enableUpdating = t6), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t6) => t6(this));
  }
  addController(t6) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t6), void 0 !== this.renderRoot && this.isConnected && t6.hostConnected?.();
  }
  removeController(t6) {
    this._$EO?.delete(t6);
  }
  _$E_() {
    const t6 = /* @__PURE__ */ new Map(), s4 = this.constructor.elementProperties;
    for (const i8 of s4.keys()) this.hasOwnProperty(i8) && (t6.set(i8, this[i8]), delete this[i8]);
    t6.size > 0 && (this._$Ep = t6);
  }
  createRenderRoot() {
    const t6 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return S(t6, this.constructor.elementStyles), t6;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach((t6) => t6.hostConnected?.());
  }
  enableUpdating(t6) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t6) => t6.hostDisconnected?.());
  }
  attributeChangedCallback(t6, s4, i8) {
    this._$AK(t6, i8);
  }
  _$ET(t6, s4) {
    const i8 = this.constructor.elementProperties.get(t6), e9 = this.constructor._$Eu(t6, i8);
    if (void 0 !== e9 && true === i8.reflect) {
      const h3 = (void 0 !== i8.converter?.toAttribute ? i8.converter : u).toAttribute(s4, i8.type);
      this._$Em = t6, null == h3 ? this.removeAttribute(e9) : this.setAttribute(e9, h3), this._$Em = null;
    }
  }
  _$AK(t6, s4) {
    const i8 = this.constructor, e9 = i8._$Eh.get(t6);
    if (void 0 !== e9 && this._$Em !== e9) {
      const t7 = i8.getPropertyOptions(e9), h3 = "function" == typeof t7.converter ? { fromAttribute: t7.converter } : void 0 !== t7.converter?.fromAttribute ? t7.converter : u;
      this._$Em = e9;
      const r7 = h3.fromAttribute(s4, t7.type);
      this[e9] = r7 ?? this._$Ej?.get(e9) ?? r7, this._$Em = null;
    }
  }
  requestUpdate(t6, s4, i8, e9 = false, h3) {
    if (void 0 !== t6) {
      const r7 = this.constructor;
      if (false === e9 && (h3 = this[t6]), i8 ??= r7.getPropertyOptions(t6), !((i8.hasChanged ?? f)(h3, s4) || i8.useDefault && i8.reflect && h3 === this._$Ej?.get(t6) && !this.hasAttribute(r7._$Eu(t6, i8)))) return;
      this.C(t6, s4, i8);
    }
    false === this.isUpdatePending && (this._$ES = this._$EP());
  }
  C(t6, s4, { useDefault: i8, reflect: e9, wrapped: h3 }, r7) {
    i8 && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t6) && (this._$Ej.set(t6, r7 ?? s4 ?? this[t6]), true !== h3 || void 0 !== r7) || (this._$AL.has(t6) || (this.hasUpdated || i8 || (s4 = void 0), this._$AL.set(t6, s4)), true === e9 && this._$Em !== t6 && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t6));
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$ES;
    } catch (t7) {
      Promise.reject(t7);
    }
    const t6 = this.scheduleUpdate();
    return null != t6 && await t6, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [t8, s5] of this._$Ep) this[t8] = s5;
        this._$Ep = void 0;
      }
      const t7 = this.constructor.elementProperties;
      if (t7.size > 0) for (const [s5, i8] of t7) {
        const { wrapped: t8 } = i8, e9 = this[s5];
        true !== t8 || this._$AL.has(s5) || void 0 === e9 || this.C(s5, void 0, i8, e9);
      }
    }
    let t6 = false;
    const s4 = this._$AL;
    try {
      t6 = this.shouldUpdate(s4), t6 ? (this.willUpdate(s4), this._$EO?.forEach((t7) => t7.hostUpdate?.()), this.update(s4)) : this._$EM();
    } catch (s5) {
      throw t6 = false, this._$EM(), s5;
    }
    t6 && this._$AE(s4);
  }
  willUpdate(t6) {
  }
  _$AE(t6) {
    this._$EO?.forEach((t7) => t7.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t6)), this.updated(t6);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t6) {
    return true;
  }
  update(t6) {
    this._$Eq &&= this._$Eq.forEach((t7) => this._$ET(t7, this[t7])), this._$EM();
  }
  updated(t6) {
  }
  firstUpdated(t6) {
  }
};
y.elementStyles = [], y.shadowRootOptions = { mode: "open" }, y[d("elementProperties")] = /* @__PURE__ */ new Map(), y[d("finalized")] = /* @__PURE__ */ new Map(), p?.({ ReactiveElement: y }), (a.reactiveElementVersions ??= []).push("2.1.2");

// node_modules/lit-html/lit-html.js
var t2 = globalThis;
var i3 = (t6) => t6;
var s2 = t2.trustedTypes;
var e3 = s2 ? s2.createPolicy("lit-html", { createHTML: (t6) => t6 }) : void 0;
var h2 = "$lit$";
var o3 = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n3 = "?" + o3;
var r3 = `<${n3}>`;
var l2 = document;
var c3 = () => l2.createComment("");
var a2 = (t6) => null === t6 || "object" != typeof t6 && "function" != typeof t6;
var u2 = Array.isArray;
var d2 = (t6) => u2(t6) || "function" == typeof t6?.[Symbol.iterator];
var f2 = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p2 = RegExp(`>|${f2}(?:([^\\s"'>=/]+)(${f2}*=${f2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y2 = /^(?:script|style|textarea|title)$/i;
var x = (t6) => (i8, ...s4) => ({ _$litType$: t6, strings: i8, values: s4 });
var b2 = x(1);
var w = x(2);
var T = x(3);
var E = /* @__PURE__ */ Symbol.for("lit-noChange");
var A = /* @__PURE__ */ Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l2.createTreeWalker(l2, 129);
function V(t6, i8) {
  if (!u2(t6) || !t6.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e3 ? e3.createHTML(i8) : i8;
}
var N = (t6, i8) => {
  const s4 = t6.length - 1, e9 = [];
  let n6, l5 = 2 === i8 ? "<svg>" : 3 === i8 ? "<math>" : "", c5 = v;
  for (let i9 = 0; i9 < s4; i9++) {
    const s5 = t6[i9];
    let a4, u4, d3 = -1, f3 = 0;
    for (; f3 < s5.length && (c5.lastIndex = f3, u4 = c5.exec(s5), null !== u4); ) f3 = c5.lastIndex, c5 === v ? "!--" === u4[1] ? c5 = _ : void 0 !== u4[1] ? c5 = m : void 0 !== u4[2] ? (y2.test(u4[2]) && (n6 = RegExp("</" + u4[2], "g")), c5 = p2) : void 0 !== u4[3] && (c5 = p2) : c5 === p2 ? ">" === u4[0] ? (c5 = n6 ?? v, d3 = -1) : void 0 === u4[1] ? d3 = -2 : (d3 = c5.lastIndex - u4[2].length, a4 = u4[1], c5 = void 0 === u4[3] ? p2 : '"' === u4[3] ? $ : g) : c5 === $ || c5 === g ? c5 = p2 : c5 === _ || c5 === m ? c5 = v : (c5 = p2, n6 = void 0);
    const x2 = c5 === p2 && t6[i9 + 1].startsWith("/>") ? " " : "";
    l5 += c5 === v ? s5 + r3 : d3 >= 0 ? (e9.push(a4), s5.slice(0, d3) + h2 + s5.slice(d3) + o3 + x2) : s5 + o3 + (-2 === d3 ? i9 : x2);
  }
  return [V(t6, l5 + (t6[s4] || "<?>") + (2 === i8 ? "</svg>" : 3 === i8 ? "</math>" : "")), e9];
};
var S2 = class _S {
  constructor({ strings: t6, _$litType$: i8 }, e9) {
    let r7;
    this.parts = [];
    let l5 = 0, a4 = 0;
    const u4 = t6.length - 1, d3 = this.parts, [f3, v2] = N(t6, i8);
    if (this.el = _S.createElement(f3, e9), P.currentNode = this.el.content, 2 === i8 || 3 === i8) {
      const t7 = this.el.content.firstChild;
      t7.replaceWith(...t7.childNodes);
    }
    for (; null !== (r7 = P.nextNode()) && d3.length < u4; ) {
      if (1 === r7.nodeType) {
        if (r7.hasAttributes()) for (const t7 of r7.getAttributeNames()) if (t7.endsWith(h2)) {
          const i9 = v2[a4++], s4 = r7.getAttribute(t7).split(o3), e10 = /([.?@])?(.*)/.exec(i9);
          d3.push({ type: 1, index: l5, name: e10[2], strings: s4, ctor: "." === e10[1] ? I : "?" === e10[1] ? L : "@" === e10[1] ? z : H }), r7.removeAttribute(t7);
        } else t7.startsWith(o3) && (d3.push({ type: 6, index: l5 }), r7.removeAttribute(t7));
        if (y2.test(r7.tagName)) {
          const t7 = r7.textContent.split(o3), i9 = t7.length - 1;
          if (i9 > 0) {
            r7.textContent = s2 ? s2.emptyScript : "";
            for (let s4 = 0; s4 < i9; s4++) r7.append(t7[s4], c3()), P.nextNode(), d3.push({ type: 2, index: ++l5 });
            r7.append(t7[i9], c3());
          }
        }
      } else if (8 === r7.nodeType) if (r7.data === n3) d3.push({ type: 2, index: l5 });
      else {
        let t7 = -1;
        for (; -1 !== (t7 = r7.data.indexOf(o3, t7 + 1)); ) d3.push({ type: 7, index: l5 }), t7 += o3.length - 1;
      }
      l5++;
    }
  }
  static createElement(t6, i8) {
    const s4 = l2.createElement("template");
    return s4.innerHTML = t6, s4;
  }
};
function M(t6, i8, s4 = t6, e9) {
  if (i8 === E) return i8;
  let h3 = void 0 !== e9 ? s4._$Co?.[e9] : s4._$Cl;
  const o9 = a2(i8) ? void 0 : i8._$litDirective$;
  return h3?.constructor !== o9 && (h3?._$AO?.(false), void 0 === o9 ? h3 = void 0 : (h3 = new o9(t6), h3._$AT(t6, s4, e9)), void 0 !== e9 ? (s4._$Co ??= [])[e9] = h3 : s4._$Cl = h3), void 0 !== h3 && (i8 = M(t6, h3._$AS(t6, i8.values), h3, e9)), i8;
}
var R = class {
  constructor(t6, i8) {
    this._$AV = [], this._$AN = void 0, this._$AD = t6, this._$AM = i8;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t6) {
    const { el: { content: i8 }, parts: s4 } = this._$AD, e9 = (t6?.creationScope ?? l2).importNode(i8, true);
    P.currentNode = e9;
    let h3 = P.nextNode(), o9 = 0, n6 = 0, r7 = s4[0];
    for (; void 0 !== r7; ) {
      if (o9 === r7.index) {
        let i9;
        2 === r7.type ? i9 = new k(h3, h3.nextSibling, this, t6) : 1 === r7.type ? i9 = new r7.ctor(h3, r7.name, r7.strings, this, t6) : 6 === r7.type && (i9 = new Z(h3, this, t6)), this._$AV.push(i9), r7 = s4[++n6];
      }
      o9 !== r7?.index && (h3 = P.nextNode(), o9++);
    }
    return P.currentNode = l2, e9;
  }
  p(t6) {
    let i8 = 0;
    for (const s4 of this._$AV) void 0 !== s4 && (void 0 !== s4.strings ? (s4._$AI(t6, s4, i8), i8 += s4.strings.length - 2) : s4._$AI(t6[i8])), i8++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t6, i8, s4, e9) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t6, this._$AB = i8, this._$AM = s4, this.options = e9, this._$Cv = e9?.isConnected ?? true;
  }
  get parentNode() {
    let t6 = this._$AA.parentNode;
    const i8 = this._$AM;
    return void 0 !== i8 && 11 === t6?.nodeType && (t6 = i8.parentNode), t6;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t6, i8 = this) {
    t6 = M(this, t6, i8), a2(t6) ? t6 === A || null == t6 || "" === t6 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t6 !== this._$AH && t6 !== E && this._(t6) : void 0 !== t6._$litType$ ? this.$(t6) : void 0 !== t6.nodeType ? this.T(t6) : d2(t6) ? this.k(t6) : this._(t6);
  }
  O(t6) {
    return this._$AA.parentNode.insertBefore(t6, this._$AB);
  }
  T(t6) {
    this._$AH !== t6 && (this._$AR(), this._$AH = this.O(t6));
  }
  _(t6) {
    this._$AH !== A && a2(this._$AH) ? this._$AA.nextSibling.data = t6 : this.T(l2.createTextNode(t6)), this._$AH = t6;
  }
  $(t6) {
    const { values: i8, _$litType$: s4 } = t6, e9 = "number" == typeof s4 ? this._$AC(t6) : (void 0 === s4.el && (s4.el = S2.createElement(V(s4.h, s4.h[0]), this.options)), s4);
    if (this._$AH?._$AD === e9) this._$AH.p(i8);
    else {
      const t7 = new R(e9, this), s5 = t7.u(this.options);
      t7.p(i8), this.T(s5), this._$AH = t7;
    }
  }
  _$AC(t6) {
    let i8 = C.get(t6.strings);
    return void 0 === i8 && C.set(t6.strings, i8 = new S2(t6)), i8;
  }
  k(t6) {
    u2(this._$AH) || (this._$AH = [], this._$AR());
    const i8 = this._$AH;
    let s4, e9 = 0;
    for (const h3 of t6) e9 === i8.length ? i8.push(s4 = new _k(this.O(c3()), this.O(c3()), this, this.options)) : s4 = i8[e9], s4._$AI(h3), e9++;
    e9 < i8.length && (this._$AR(s4 && s4._$AB.nextSibling, e9), i8.length = e9);
  }
  _$AR(t6 = this._$AA.nextSibling, s4) {
    for (this._$AP?.(false, true, s4); t6 !== this._$AB; ) {
      const s5 = i3(t6).nextSibling;
      i3(t6).remove(), t6 = s5;
    }
  }
  setConnected(t6) {
    void 0 === this._$AM && (this._$Cv = t6, this._$AP?.(t6));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t6, i8, s4, e9, h3) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t6, this.name = i8, this._$AM = e9, this.options = h3, s4.length > 2 || "" !== s4[0] || "" !== s4[1] ? (this._$AH = Array(s4.length - 1).fill(new String()), this.strings = s4) : this._$AH = A;
  }
  _$AI(t6, i8 = this, s4, e9) {
    const h3 = this.strings;
    let o9 = false;
    if (void 0 === h3) t6 = M(this, t6, i8, 0), o9 = !a2(t6) || t6 !== this._$AH && t6 !== E, o9 && (this._$AH = t6);
    else {
      const e10 = t6;
      let n6, r7;
      for (t6 = h3[0], n6 = 0; n6 < h3.length - 1; n6++) r7 = M(this, e10[s4 + n6], i8, n6), r7 === E && (r7 = this._$AH[n6]), o9 ||= !a2(r7) || r7 !== this._$AH[n6], r7 === A ? t6 = A : t6 !== A && (t6 += (r7 ?? "") + h3[n6 + 1]), this._$AH[n6] = r7;
    }
    o9 && !e9 && this.j(t6);
  }
  j(t6) {
    t6 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t6 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t6) {
    this.element[this.name] = t6 === A ? void 0 : t6;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t6) {
    this.element.toggleAttribute(this.name, !!t6 && t6 !== A);
  }
};
var z = class extends H {
  constructor(t6, i8, s4, e9, h3) {
    super(t6, i8, s4, e9, h3), this.type = 5;
  }
  _$AI(t6, i8 = this) {
    if ((t6 = M(this, t6, i8, 0) ?? A) === E) return;
    const s4 = this._$AH, e9 = t6 === A && s4 !== A || t6.capture !== s4.capture || t6.once !== s4.once || t6.passive !== s4.passive, h3 = t6 !== A && (s4 === A || e9);
    e9 && this.element.removeEventListener(this.name, this, s4), h3 && this.element.addEventListener(this.name, this, t6), this._$AH = t6;
  }
  handleEvent(t6) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t6) : this._$AH.handleEvent(t6);
  }
};
var Z = class {
  constructor(t6, i8, s4) {
    this.element = t6, this.type = 6, this._$AN = void 0, this._$AM = i8, this.options = s4;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t6) {
    M(this, t6);
  }
};
var j = { M: h2, P: o3, A: n3, C: 1, L: N, R, D: d2, V: M, I: k, H, N: L, U: z, B: I, F: Z };
var B = t2.litHtmlPolyfillSupport;
B?.(S2, k), (t2.litHtmlVersions ??= []).push("3.3.3");
var D = (t6, i8, s4) => {
  const e9 = s4?.renderBefore ?? i8;
  let h3 = e9._$litPart$;
  if (void 0 === h3) {
    const t7 = s4?.renderBefore ?? null;
    e9._$litPart$ = h3 = new k(i8.insertBefore(c3(), t7), t7, void 0, s4 ?? {});
  }
  return h3._$AI(t6), h3;
};

// node_modules/lit-element/lit-element.js
var s3 = globalThis;
var i4 = class extends y {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t6 = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t6.firstChild, t6;
  }
  update(t6) {
    const r7 = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t6), this._$Do = D(r7, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return E;
  }
};
i4._$litElement$ = true, i4["finalized"] = true, s3.litElementHydrateSupport?.({ LitElement: i4 });
var o4 = s3.litElementPolyfillSupport;
o4?.({ LitElement: i4 });
(s3.litElementVersions ??= []).push("4.2.2");

// node_modules/lit-html/is-server.js
var o5 = false;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.ZZ6XGOYX.js
var split_panel_styles_default = i`
  :host {
    --divider-width: 0.25rem;
    --divider-hit-area: 0.75rem;
    --min: 0%;
    --max: 100%;

    display: grid;
  }

  .start,
  .end {
    overflow: hidden;
  }

  .divider {
    flex: 0 0 var(--divider-width);
    display: flex;
    position: relative;
    align-items: center;
    justify-content: center;
    background-color: var(--wa-color-neutral-border-normal);
    color: var(--wa-color-neutral-on-normal);
    z-index: 1;
  }

  .divider:focus {
    outline: none;
  }

  :host(:not([disabled])) .divider:focus-visible {
    outline: var(--wa-focus-ring);
  }

  :host([disabled]) .divider {
    cursor: not-allowed;
  }

  /* Horizontal */
  :host(:not([orientation='vertical'], [disabled])) .divider {
    cursor: col-resize;
  }

  :host(:not([orientation='vertical'])) .divider::after {
    display: flex;
    content: '';
    position: absolute;
    height: 100%;
    left: calc(var(--divider-hit-area) / -2 + var(--divider-width) / 2);
    width: var(--divider-hit-area);
  }

  /* Vertical */
  :host([orientation='vertical']) {
    flex-direction: column;
  }

  :host([orientation='vertical']:not([disabled])) .divider {
    cursor: row-resize;
  }

  :host([orientation='vertical']) .divider::after {
    content: '';
    position: absolute;
    width: 100%;
    top: calc(var(--divider-hit-area) / -2 + var(--divider-width) / 2);
    height: var(--divider-hit-area);
  }

  @media (forced-colors: active) {
    .divider {
      outline: solid 1px transparent;
    }
  }
`;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.WYNTFJHW.js
function drag(container, options) {
  function move(pointerEvent) {
    const dims = container.getBoundingClientRect();
    const defaultView = container.ownerDocument.defaultView;
    const offsetX = dims.left + defaultView.pageXOffset;
    const offsetY = dims.top + defaultView.pageYOffset;
    const x2 = pointerEvent.pageX - offsetX;
    const y3 = pointerEvent.pageY - offsetY;
    if (options?.onMove) {
      options.onMove(x2, y3);
    }
  }
  function stop() {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", stop);
    if (options?.onStop) {
      options.onStop();
    }
  }
  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerup", stop);
  if (options?.initialEvent instanceof PointerEvent) {
    move(options.initialEvent);
  }
}
var supportsTouch = typeof window !== "undefined" && "ontouchstart" in window;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.ZWQCGLB5.js
var WaRepositionEvent = class extends Event {
  constructor() {
    super("wa-reposition", { bubbles: true, cancelable: false, composed: true });
  }
};

// node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/nanoid/index.browser.js
var nanoid = (size3 = 21) => {
  let id = "";
  let bytes = crypto.getRandomValues(new Uint8Array(size3 |= 0));
  while (size3--) {
    id += urlAlphabet[bytes[size3] & 63];
  }
  return id;
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.KNJT7KBU.js
function clamp(value, min2, max2) {
  const noNegativeZero = (n6) => Object.is(n6, -0) ? 0 : n6;
  if (value < min2) {
    return noNegativeZero(min2);
  }
  if (value > max2) {
    return noNegativeZero(max2);
  }
  return noNegativeZero(value);
}
function uniqueId(prefix = "") {
  return `${prefix}${nanoid()}`;
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.PZAN6FPN.js
function watch(propertyName, options) {
  const resolvedOptions = {
    waitUntilFirstUpdate: false,
    ...options
  };
  return (proto, decoratedFnName) => {
    const { update: update2 } = proto;
    const watchedProperties = Array.isArray(propertyName) ? propertyName : [propertyName];
    proto.update = function(changedProps) {
      watchedProperties.forEach((property) => {
        const key = property;
        if (changedProps.has(key)) {
          const oldValue = changedProps.get(key);
          const newValue = this[key];
          if (oldValue !== newValue) {
            if (!resolvedOptions.waitUntilFirstUpdate || this.hasUpdated) {
              this[decoratedFnName](oldValue, newValue);
            }
          }
        }
      });
      update2.call(this, changedProps);
    };
  };
}

// node_modules/@lit/reactive-element/decorators/custom-element.js
var t3 = (t6) => (e9, o9) => {
  void 0 !== o9 ? o9.addInitializer(() => {
    customElements.define(t6, e9);
  }) : customElements.define(t6, e9);
};

// node_modules/@lit/reactive-element/decorators/property.js
var o6 = { attribute: true, type: String, converter: u, reflect: false, hasChanged: f };
var r4 = (t6 = o6, e9, r7) => {
  const { kind: n6, metadata: i8 } = r7;
  let s4 = globalThis.litPropertyMetadata.get(i8);
  if (void 0 === s4 && globalThis.litPropertyMetadata.set(i8, s4 = /* @__PURE__ */ new Map()), "setter" === n6 && ((t6 = Object.create(t6)).wrapped = true), s4.set(r7.name, t6), "accessor" === n6) {
    const { name: o9 } = r7;
    return { set(r8) {
      const n7 = e9.get.call(this);
      e9.set.call(this, r8), this.requestUpdate(o9, n7, t6, true, r8);
    }, init(e10) {
      return void 0 !== e10 && this.C(o9, void 0, t6, e10), e10;
    } };
  }
  if ("setter" === n6) {
    const { name: o9 } = r7;
    return function(r8) {
      const n7 = this[o9];
      e9.call(this, r8), this.requestUpdate(o9, n7, t6, true, r8);
    };
  }
  throw Error("Unsupported decorator location: " + n6);
};
function n4(t6) {
  return (e9, o9) => "object" == typeof o9 ? r4(t6, e9, o9) : ((t7, e10, o10) => {
    const r7 = e10.hasOwnProperty(o10);
    return e10.constructor.createProperty(o10, t7), r7 ? Object.getOwnPropertyDescriptor(e10, o10) : void 0;
  })(t6, e9, o9);
}

// node_modules/@lit/reactive-element/decorators/state.js
function r5(r7) {
  return n4({ ...r7, state: true, attribute: false });
}

// node_modules/@lit/reactive-element/decorators/base.js
var e4 = (e9, t6, c5) => (c5.configurable = true, c5.enumerable = true, Reflect.decorate && "object" != typeof t6 && Object.defineProperty(e9, t6, c5), c5);

// node_modules/@lit/reactive-element/decorators/query.js
function e5(e9, r7) {
  return (n6, s4, i8) => {
    const o9 = (t6) => t6.renderRoot?.querySelector(e9) ?? null;
    if (r7) {
      const { get: e10, set: r8 } = "object" == typeof s4 ? n6 : i8 ?? /* @__PURE__ */ (() => {
        const t6 = /* @__PURE__ */ Symbol();
        return { get() {
          return this[t6];
        }, set(e11) {
          this[t6] = e11;
        } };
      })();
      return e4(n6, s4, { get() {
        let t6 = e10.call(this);
        return void 0 === t6 && (t6 = o9(this), (null !== t6 || this.hasUpdated) && r8.call(this, t6)), t6;
      } });
    }
    return e4(n6, s4, { get() {
      return o9(this);
    } });
  };
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.AOKMSJXD.js
var host_styles_default = i`
  :host {
    box-sizing: border-box;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: inherit;
  }

  [hidden],
  :host([hidden]) {
    display: none !important;
  }
`;
var HAS_ENDING_COLON = /;\s+$/;
function camelToKebab(str) {
  return str.replace(/[A-Z]/g, (c5) => `-${c5.toLowerCase()}`);
}
function buildStyleAttribute(options) {
  const { property: property2, value, element } = options;
  if (value) {
    let style = element.getAttribute("style") || "";
    if (style) {
      if (!style.match(HAS_ENDING_COLON)) {
        style += ";";
      }
      style += " ";
    }
    const str = `${property2}: ${value}`;
    if (style.includes(str)) {
      return;
    }
    return `${style}${str};`;
  }
  return null;
}
var _hasRecordedInitialProperties;
var WebAwesomeElement = class extends i4 {
  constructor() {
    super();
    __privateAdd(this, _hasRecordedInitialProperties, false);
    this.initialReflectedProperties = /* @__PURE__ */ new Map();
    this.didSSR = o5 || Boolean(this.shadowRoot);
    this.customStates = {
      /** Adds or removes the specified custom state. */
      set: (customState, active) => {
        if (!Boolean(this.internals?.states)) return;
        try {
          if (active) {
            this.internals.states.add(customState);
          } else {
            this.internals.states.delete(customState);
          }
        } catch (e9) {
          if (String(e9).includes("must start with '--'")) {
            console.error("Your browser implements an outdated version of CustomStateSet. Consider using a polyfill");
          } else {
            throw e9;
          }
        }
      },
      /** Determines whether or not the element currently has the specified state. */
      has: (customState) => {
        if (!Boolean(this.internals?.states)) return false;
        try {
          return this.internals.states.has(customState);
        } catch {
          return false;
        }
      }
    };
    try {
      this.internals = this.attachInternals();
    } catch {
      console.error("Element internals are not supported in your browser. Consider using a polyfill");
    }
    this.customStates.set("wa-defined", true);
    let Self = this.constructor;
    for (let [property2, spec] of Self.elementProperties) {
      if (spec.default === "inherit" && spec.initial !== void 0 && typeof property2 === "string") {
        this.customStates.set(`initial-${property2}-${spec.initial}`, true);
      }
    }
  }
  /** Prepends host styles to the component's styles. */
  static get styles() {
    const styles = Array.isArray(this.css) ? this.css : this.css ? [this.css] : [];
    return [host_styles_default, ...styles];
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.didSSR) {
      this.shadowRoot?.prepend(
        document.createComment(
          ` Web Awesome: https://webawesome.com/docs/components/${this.localName.replace("wa-", "")} `
        )
      );
    }
    if (this.didSSR) {
      this.updateComplete.then(() => {
        this.shadowRoot?.prepend(
          document.createComment(
            ` Web Awesome: https://webawesome.com/docs/components/${this.localName.replace("wa-", "")} `
          )
        );
      });
    }
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!__privateGet(this, _hasRecordedInitialProperties)) {
      this.constructor.elementProperties.forEach(
        (obj, prop) => {
          if (obj.reflect && this[prop] != null) {
            this.initialReflectedProperties.set(prop, this[prop]);
          }
        }
      );
      __privateSet(this, _hasRecordedInitialProperties, true);
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }
  willUpdate(changedProperties) {
    super.willUpdate(changedProperties);
    this.initialReflectedProperties.forEach((value, prop) => {
      if (changedProperties.has(prop) && this[prop] == null) {
        this[prop] = value;
      }
    });
  }
  firstUpdated(changedProperties) {
    super.firstUpdated(changedProperties);
    if (this.didSSR) {
      this.shadowRoot?.querySelectorAll("slot").forEach((slotElement) => {
        slotElement.dispatchEvent(new Event("slotchange", { bubbles: true, composed: false, cancelable: false }));
      });
    }
  }
  update(changedProperties) {
    try {
      super.update(changedProperties);
    } catch (e9) {
      if (this.didSSR && !this.hasUpdated) {
        const event = new Event("lit-hydration-error", { bubbles: true, composed: true, cancelable: false });
        event.error = e9;
        this.dispatchEvent(event);
      }
      throw e9;
    }
  }
  /**
   * @internal
   * Internal way to set styles across both client and server
   */
  setStyle(property2, value) {
    if (!this.style) {
      const str = buildStyleAttribute({
        // because this is going to be serialized to an HTML style attribute, need to transform the casing.
        property: camelToKebab(property2),
        value,
        element: this
      });
      if (str) {
        this.setAttribute("style", str);
      }
      return;
    }
    this.style[property2] = value;
  }
  /**
   * @internal
   * Internal way to set a CSS custom property across both client and server.
   */
  setStyleProperty(property2, value) {
    if (!this.style) {
      const str = buildStyleAttribute({
        // because this is going to be serialized to an HTML style attribute, need to transform the casing.
        property: property2,
        value,
        element: this
      });
      if (str) {
        this.setAttribute("style", str);
      }
      return;
    }
    this.style.setProperty(property2, value);
  }
  /**
   * @internal Given a native event, this function cancels it and dispatches it again from the host element using the desired
   * event options.
   */
  relayNativeEvent(event, eventOptions) {
    event.stopImmediatePropagation();
    this.dispatchEvent(
      new event.constructor(event.type, {
        ...event,
        ...eventOptions
      })
    );
  }
};
_hasRecordedInitialProperties = /* @__PURE__ */ new WeakMap();
__decorateClass([
  n4()
], WebAwesomeElement.prototype, "dir", 2);
__decorateClass([
  n4()
], WebAwesomeElement.prototype, "lang", 2);
__decorateClass([
  n4({ type: Boolean, reflect: true, attribute: "did-ssr" })
], WebAwesomeElement.prototype, "didSSR", 2);

// node_modules/@shoelace-style/localize/dist/index.js
var connectedElements = /* @__PURE__ */ new Set();
var translations = /* @__PURE__ */ new Map();
var fallback;
var documentDirection = "ltr";
var documentLanguage = "en";
var isClient = typeof MutationObserver !== "undefined" && typeof document !== "undefined" && typeof document.documentElement !== "undefined";
if (isClient) {
  const documentElementObserver = new MutationObserver(update);
  documentDirection = document.documentElement.dir || "ltr";
  documentLanguage = document.documentElement.lang || navigator.language;
  documentElementObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["dir", "lang"]
  });
}
function registerTranslation(...translation2) {
  translation2.map((t6) => {
    const code = t6.$code.toLowerCase();
    if (translations.has(code)) {
      translations.set(code, Object.assign(Object.assign({}, translations.get(code)), t6));
    } else {
      translations.set(code, t6);
    }
    if (!fallback) {
      fallback = t6;
    }
  });
  update();
}
function update() {
  if (isClient) {
    documentDirection = document.documentElement.dir || "ltr";
    documentLanguage = document.documentElement.lang || navigator.language;
  }
  [...connectedElements.keys()].map((el) => {
    if (typeof el.requestUpdate === "function") {
      el.requestUpdate();
    }
  });
}
var LocalizeController = class {
  constructor(host) {
    this.host = host;
    this.host.addController(this);
  }
  hostConnected() {
    connectedElements.add(this.host);
  }
  hostDisconnected() {
    connectedElements.delete(this.host);
  }
  dir() {
    return `${this.host.dir || documentDirection}`.toLowerCase();
  }
  lang() {
    const lang = `${this.host.lang || documentLanguage}`.toLowerCase().replace(/_/g, "-");
    try {
      new Intl.Locale(lang);
      return lang;
    } catch (_a) {
      return fallback ? fallback.$code.toLowerCase() : "en";
    }
  }
  getTranslationData(lang) {
    var _a, _b;
    let locale;
    try {
      locale = new Intl.Locale(lang.replace(/_/g, "-"));
    } catch (_c) {
      return { locale: void 0, language: "", region: "", primary: void 0, secondary: void 0 };
    }
    const language = locale.language.toLowerCase();
    const region = (_b = (_a = locale.region) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "";
    const primary = translations.get(`${language}-${region}`);
    const secondary = translations.get(language);
    return { locale, language, region, primary, secondary };
  }
  exists(key, options) {
    var _a;
    const { primary, secondary } = this.getTranslationData((_a = options.lang) !== null && _a !== void 0 ? _a : this.lang());
    options = Object.assign({ includeFallback: false }, options);
    if (primary && primary[key] || secondary && secondary[key] || options.includeFallback && fallback && fallback[key]) {
      return true;
    }
    return false;
  }
  term(key, ...args) {
    const { primary, secondary } = this.getTranslationData(this.lang());
    let term;
    if (primary && primary[key]) {
      term = primary[key];
    } else if (secondary && secondary[key]) {
      term = secondary[key];
    } else if (fallback && fallback[key]) {
      term = fallback[key];
    } else {
      console.error(`No translation found for: ${String(key)}`);
      return String(key);
    }
    if (typeof term === "function") {
      return term(...args);
    }
    return term;
  }
  date(dateToFormat, options) {
    dateToFormat = new Date(dateToFormat);
    return new Intl.DateTimeFormat(this.lang(), options).format(dateToFormat);
  }
  number(numberToFormat, options) {
    numberToFormat = Number(numberToFormat);
    return isNaN(numberToFormat) ? "" : new Intl.NumberFormat(this.lang(), options).format(numberToFormat);
  }
  relativeTime(value, unit, options) {
    return new Intl.RelativeTimeFormat(this.lang(), options).format(value, unit);
  }
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.KQHZRDPB.js
var translation = {
  $code: "en",
  $name: "English",
  $dir: "ltr",
  am: "AM",
  autosizeColumn: "Autosize column",
  captions: "Captions",
  carousel: "Carousel",
  chooseDate: "Choose date",
  chooseDecade: "Choose decade",
  chooseMonth: "Choose month",
  chooseTime: "Choose time",
  chooseYear: "Choose year",
  clearEntry: "Clear entry",
  clearFilter: "Clear filter",
  clearSort: "Clear sort",
  close: "Close",
  closeCalendar: "Close calendar",
  closeTimeInput: "Close time picker",
  collapseRow: "Collapse row",
  columnMenu: "Column options",
  columnMovedToPosition: (label, position, total) => `${label} moved to position ${position} of ${total}`,
  columns: "Columns",
  compactPageXOfY: (page, total) => `${page} of ${total}`,
  copied: "Copied",
  copy: "Copy",
  createOption: (value) => `Create "${value}"`,
  currentlyPlaying: "currently playing",
  currentValue: "Current value",
  date: "Date",
  datePickerKeyboardHelp: "Use arrow keys to change values; press Alt+Down Arrow to open the calendar.",
  day: "Day",
  dayPeriod: "AM/PM",
  decrement: "Decrement",
  deselectAllRows: "Deselect all rows",
  dropFileHere: "Drop file here or click to browse",
  dropFilesHere: "Drop files here or click to browse",
  empty: "Empty",
  endDate: "End date",
  enterFullscreen: "Enter fullscreen",
  error: "Error",
  exitFullscreen: "Exit fullscreen",
  expandRow: "Expand row",
  filterByColumn: (label) => `Filter by ${label}`,
  filterFrom: "From",
  filterMax: "Max",
  filterMin: "Min",
  filterTo: "To",
  firstPage: "First page",
  goToSlide: (slide, count) => `Go to slide ${slide} of ${count}`,
  hideColumn: "Hide column",
  hidePassword: "Hide password",
  hour: "Hour",
  incompleteDate: "Enter a valid date.",
  increment: "Increment",
  jumpBackwardX: (count) => `Jump back ${count} pages`,
  jumpForwardX: (count) => `Jump forward ${count} pages`,
  lastPage: "Last page",
  loading: "Loading",
  minute: "Minute",
  month: "Month",
  moreOptions: "More Options",
  mute: "Mute",
  nextDecade: "Next decade",
  nextMonth: "Next month",
  nextPage: "Next page",
  nextSlide: "Next slide",
  nextVideo: "Next Video",
  nextYear: "Next year",
  noData: "No data",
  noResults: "No matching results",
  now: "Now",
  numCharacters: (num) => {
    if (num === 1) return "1 character";
    return `${num} characters`;
  },
  numCharactersRemaining: (num) => {
    if (num === 1) return "1 character remaining";
    return `${num} characters remaining`;
  },
  numOptionsSelected: (num) => {
    if (num === 0) return "No options selected";
    if (num === 1) return "1 option selected";
    return `${num} options selected`;
  },
  numRowsCopied: (num) => num === 1 ? "1 row copied" : `${num} rows copied`,
  numRowsSelected: (num) => num === 1 ? "1 row selected" : `${num} rows selected`,
  pageXOfY: (page, total) => `Page ${page} of ${total}`,
  pagination: "Pagination",
  pause: "Pause",
  pauseAnimation: "Pause animation",
  pictureInPicture: "Picture in picture",
  pinLeft: "Pin left",
  pinRight: "Pin right",
  play: "Play",
  playAnimation: "Play animation",
  playbackSpeed: "Playback speed",
  playlist: "Playlist",
  pm: "PM",
  previousDecade: "Previous decade",
  previousMonth: "Previous month",
  previousPage: "Previous page",
  previousSlide: "Previous slide",
  previousVideo: "Previous video",
  previousYear: "Previous year",
  progress: "Progress",
  rangeTooLong: (max2) => {
    if (max2 === 1) return "Select a range no longer than 1 day";
    return `Select a range no longer than ${max2} days`;
  },
  rangeTooShort: (min2) => {
    if (min2 === 1) return "Select a range at least 1 day long";
    return `Select a range at least ${min2} days long`;
  },
  readonly: "Read-only",
  remove: "Remove",
  resetColumns: "Reset columns",
  resize: "Resize",
  resizeColumn: "Resize column",
  rowsPerPage: "Rows per page",
  scrollableRegion: "Scrollable region",
  scrollToEnd: "Scroll to end",
  scrollToStart: "Scroll to start",
  search: "Search",
  second: "Second",
  seek: "Seek",
  seekProgress: (current, duration) => `${current} of ${duration}`,
  selectAColorFromTheScreen: "Select a color from the screen",
  selectAllRows: "Select all rows",
  selected: "Selected",
  selectedDateLabel: (date) => `Selected: ${date}`,
  selectedRangeLabel: (range) => `Selected range: ${range}`,
  selectGroup: "Select group",
  selectionCleared: "Selection cleared",
  selectRow: "Select row",
  showingNofMRows: (shown, total) => `Showing ${shown} of ${total} rows`,
  showingXtoYofZ: (start, end, total) => `${start}\u2013${end} of ${total}`,
  showPassword: "Show password",
  slideNum: (slide) => `Slide ${slide}`,
  sortAscending: "Sort ascending",
  sortColumn: "Sort column",
  sortDescending: "Sort descending",
  startDate: "Start date",
  time: "Time",
  timeInputKeyboardHelp: "Use arrow keys to change values; press Alt+Down Arrow to open the time picker.",
  today: "Today",
  toggleColorFormat: "Toggle color format",
  unmute: "Unmute",
  unpin: "Unpin",
  unpinColumn: "Unpin column",
  videoPlayer: "Video player",
  volume: "Volume",
  year: "Year",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out"
};
registerTranslation(translation);
var en_default = translation;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.56IHH3HP.js
var LocalizeController2 = class extends LocalizeController {
  lang() {
    if (this.host.didSSR && !this.host.hasUpdated) {
      return this.host.lang || "en";
    }
    return super.lang();
  }
};
registerTranslation(en_default);

// node_modules/lit-html/directives/if-defined.js
var o7 = (o9) => o9 ?? A;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.JMBAF4TD.js
var WaSplitPanel = class extends WebAwesomeElement {
  constructor() {
    super(...arguments);
    this.isCollapsed = false;
    this.localize = new LocalizeController2(this);
    this.positionBeforeCollapsing = 0;
    this.position = 50;
    this.orientation = "horizontal";
    this.disabled = false;
    this.snapThreshold = 12;
  }
  connectedCallback() {
    super.connectedCallback();
    if (!o5) {
      this.resizeObserver = new ResizeObserver((entries) => this.handleResize(entries));
      this.updateComplete.then(() => this.resizeObserver.observe(this));
      this.detectSize();
      this.cachedPositionInPixels = this.percentageToPixels(this.position);
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.unobserve(this);
  }
  detectSize() {
    const { width, height } = this.getBoundingClientRect();
    this.size = this.orientation === "vertical" ? height : width;
  }
  percentageToPixels(value) {
    return this.size * (value / 100);
  }
  pixelsToPercentage(value) {
    return value / this.size * 100;
  }
  handleDrag(event) {
    const isRtl = this.didSSR && !this.hasUpdated ? this.dir === "rtl" : this.localize.dir() === "rtl";
    if (this.disabled) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    drag(this, {
      onMove: (x2, y3) => {
        let newPositionInPixels = this.orientation === "vertical" ? y3 : x2;
        if (this.primary === "end") {
          newPositionInPixels = this.size - newPositionInPixels;
        }
        if (this.snap) {
          const snaps = this.snap.split(" ");
          snaps.forEach((value) => {
            let snapPoint;
            if (value.endsWith("%")) {
              snapPoint = this.size * (parseFloat(value) / 100);
            } else {
              snapPoint = parseFloat(value);
            }
            if (isRtl && this.orientation === "horizontal") {
              snapPoint = this.size - snapPoint;
            }
            if (newPositionInPixels >= snapPoint - this.snapThreshold && newPositionInPixels <= snapPoint + this.snapThreshold) {
              newPositionInPixels = snapPoint;
            }
          });
        }
        this.position = clamp(this.pixelsToPercentage(newPositionInPixels), 0, 100);
      },
      initialEvent: event
    });
  }
  handleKeyDown(event) {
    if (this.disabled) {
      return;
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Enter"].includes(event.key)) {
      let newPosition = this.position;
      const incr = (event.shiftKey ? 10 : 1) * (this.primary === "end" ? -1 : 1);
      event.preventDefault();
      if (event.key === "ArrowLeft" && this.orientation === "horizontal" || event.key === "ArrowUp" && this.orientation === "vertical") {
        newPosition -= incr;
      }
      if (event.key === "ArrowRight" && this.orientation === "horizontal" || event.key === "ArrowDown" && this.orientation === "vertical") {
        newPosition += incr;
      }
      if (event.key === "Home") {
        newPosition = this.primary === "end" ? 100 : 0;
      }
      if (event.key === "End") {
        newPosition = this.primary === "end" ? 0 : 100;
      }
      if (event.key === "Enter") {
        if (this.isCollapsed) {
          newPosition = this.positionBeforeCollapsing;
          this.isCollapsed = false;
        } else {
          const positionBeforeCollapsing = this.position;
          newPosition = 0;
          requestAnimationFrame(() => {
            this.isCollapsed = true;
            this.positionBeforeCollapsing = positionBeforeCollapsing;
          });
        }
      }
      this.position = clamp(newPosition, 0, 100);
    }
  }
  handleResize(entries) {
    const { width, height } = entries[0].contentRect;
    this.size = this.orientation === "vertical" ? height : width;
    if (isNaN(this.cachedPositionInPixels) || this.position === Infinity) {
      this.cachedPositionInPixels = Number(this.getAttribute("position-in-pixels"));
      this.positionInPixels = Number(this.getAttribute("position-in-pixels"));
      this.position = this.pixelsToPercentage(this.positionInPixels);
    }
    if (this.primary) {
      const newPosition = this.pixelsToPercentage(this.cachedPositionInPixels);
      if (this.position !== newPosition) {
        this.position = newPosition;
      }
    }
  }
  handlePositionChange() {
    this.cachedPositionInPixels = this.percentageToPixels(this.position);
    const newPositionInPixels = this.percentageToPixels(this.position);
    if (this.positionInPixels !== newPositionInPixels) {
      this.positionInPixels = newPositionInPixels;
    }
    this.isCollapsed = false;
    this.positionBeforeCollapsing = 0;
    this.dispatchEvent(new WaRepositionEvent());
  }
  handlePositionInPixelsChange() {
    const newPosition = this.pixelsToPercentage(this.positionInPixels);
    if (this.position !== newPosition) {
      this.position = newPosition;
    }
  }
  handleVerticalChange() {
    this.detectSize();
  }
  updateStyles() {
    const gridTemplate = this.orientation === "vertical" ? "gridTemplateRows" : "gridTemplateColumns";
    const gridTemplateAlt = this.orientation === "vertical" ? "gridTemplateColumns" : "gridTemplateRows";
    const isRtl = this.hasUpdated ? this.localize.dir() === "rtl" : this.dir === "rtl";
    const primary = `
      clamp(
        0%,
        clamp(
          var(--min),
          ${this.position}% - var(--divider-width) / 2,
          var(--max)
        ),
        calc(100% - var(--divider-width))
      )
    `;
    const secondary = "auto";
    if (this.primary === "end") {
      if (isRtl && this.orientation === "horizontal") {
        this.setStyle(gridTemplate, `${primary} var(--divider-width) ${secondary}`);
      } else {
        this.setStyle(gridTemplate, `${secondary} var(--divider-width) ${primary}`);
      }
    } else {
      if (isRtl && this.orientation === "horizontal") {
        this.setStyle(gridTemplate, `${secondary} var(--divider-width) ${primary}`);
      } else {
        this.setStyle(gridTemplate, `${primary} var(--divider-width) ${secondary}`);
      }
    }
    this.setStyle(gridTemplateAlt, "unset");
  }
  willUpdate(changedProperties) {
    if (!this.style) {
      this.updateStyles();
    }
    super.willUpdate(changedProperties);
  }
  updated(changedProperties) {
    super.updated(changedProperties);
  }
  render() {
    if (this.style) {
      this.updateStyles();
    }
    return b2`
      <slot name="start" part="panel start" class="start"></slot>

      <div
        part="divider"
        class="divider"
        tabindex=${o7(this.disabled ? void 0 : "0")}
        role="separator"
        aria-valuenow=${this.position}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label=${this.localize.term("resize")}
        @keydown=${this.handleKeyDown}
        @mousedown=${this.handleDrag}
        @touchstart=${this.handleDrag}
      >
        <slot name="divider"></slot>
      </div>

      <slot name="end" part="panel end" class="end"></slot>
    `;
  }
};
WaSplitPanel.css = split_panel_styles_default;
__decorateClass([
  e5(".divider")
], WaSplitPanel.prototype, "divider", 2);
__decorateClass([
  n4({ type: Number, reflect: true })
], WaSplitPanel.prototype, "position", 2);
__decorateClass([
  n4({ attribute: "position-in-pixels", type: Number })
], WaSplitPanel.prototype, "positionInPixels", 2);
__decorateClass([
  n4({ reflect: true })
], WaSplitPanel.prototype, "orientation", 2);
__decorateClass([
  n4({ type: Boolean, reflect: true })
], WaSplitPanel.prototype, "disabled", 2);
__decorateClass([
  n4()
], WaSplitPanel.prototype, "primary", 2);
__decorateClass([
  n4()
], WaSplitPanel.prototype, "snap", 2);
__decorateClass([
  n4({ type: Number, attribute: "snap-threshold" })
], WaSplitPanel.prototype, "snapThreshold", 2);
__decorateClass([
  watch("position")
], WaSplitPanel.prototype, "handlePositionChange", 1);
__decorateClass([
  watch("positionInPixels")
], WaSplitPanel.prototype, "handlePositionInPixelsChange", 1);
__decorateClass([
  watch("vertical")
], WaSplitPanel.prototype, "handleVerticalChange", 1);
WaSplitPanel = __decorateClass([
  t3("wa-split-panel")
], WaSplitPanel);

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.HKHINDC2.js
var RenderedWatcher = class {
  constructor(element, callback) {
    this.element = element;
    this.callback = callback;
  }
  /**
   * Starts watching and reports the current state on the next frame. Additional targets also act as change signals,
   * e.g. an internal element that always has a non-zero box when rendered.
   */
  start(...additionalTargets) {
    if (o5) {
      return;
    }
    this.observer ?? (this.observer = new ResizeObserver(() => this.check()));
    this.observer.observe(this.element);
    for (const target of additionalTargets) {
      this.observer.observe(target);
    }
    this.initialCheckHandle ?? (this.initialCheckHandle = requestAnimationFrame(() => {
      this.initialCheckHandle = void 0;
      this.check();
    }));
  }
  /** Stops watching. */
  stop() {
    if (this.initialCheckHandle !== void 0) {
      cancelAnimationFrame(this.initialCheckHandle);
      this.initialCheckHandle = void 0;
    }
    this.observer?.disconnect();
  }
  check() {
    this.callback(this.element.getClientRects().length > 0);
  }
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.VQZ46MYI.js
var locks = /* @__PURE__ */ new Set();
function getScrollbarWidth() {
  const documentWidth = document.documentElement.clientWidth;
  return Math.abs(window.innerWidth - documentWidth);
}
function getExistingBodyPadding() {
  const padding = Number(getComputedStyle(document.body).paddingRight.replace(/px/, ""));
  if (isNaN(padding) || !padding) {
    return 0;
  }
  return padding;
}
function lockBodyScrolling(lockingEl) {
  locks.add(lockingEl);
  if (!document.documentElement.classList.contains("wa-scroll-lock")) {
    const scrollbarWidth = getScrollbarWidth() + getExistingBodyPadding();
    let scrollbarGutterProperty = getComputedStyle(document.documentElement).scrollbarGutter;
    if (!scrollbarGutterProperty || scrollbarGutterProperty === "auto") {
      scrollbarGutterProperty = "stable";
    }
    if (scrollbarWidth < 2) {
      scrollbarGutterProperty = "";
    }
    document.documentElement.style.setProperty("--wa-scroll-lock-gutter", scrollbarGutterProperty);
    document.documentElement.classList.add("wa-scroll-lock");
    document.documentElement.style.setProperty("--wa-scroll-lock-size", `${scrollbarWidth}px`);
  }
}
function unlockBodyScrolling(lockingEl) {
  locks.delete(lockingEl);
  if (locks.size === 0) {
    document.documentElement.classList.remove("wa-scroll-lock");
    document.documentElement.style.removeProperty("--wa-scroll-lock-size");
  }
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.RMZ7BVDM.js
function parseSpaceDelimitedTokens(input) {
  return input.split(" ").map((token) => token.trim()).filter((token) => token !== "");
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.4ZAKP7NY.js
var WaShowEvent = class extends Event {
  constructor() {
    super("wa-show", { bubbles: true, cancelable: true, composed: true });
  }
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.MQODJ75V.js
var WaHideEvent = class extends Event {
  constructor(detail) {
    super("wa-hide", { bubbles: true, cancelable: true, composed: true });
    this.detail = detail;
  }
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.PX3HMKF7.js
var WaAfterShowEvent = class extends Event {
  constructor() {
    super("wa-after-show", { bubbles: true, cancelable: false, composed: true });
  }
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.3NKIHICW.js
var WaAfterHideEvent = class extends Event {
  constructor() {
    super("wa-after-hide", { bubbles: true, cancelable: false, composed: true });
  }
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.XTG2LNFG.js
var dialog_styles_default = i`
  :host {
    --width: 31rem;
    --spacing: var(--wa-space-l);
    --backdrop-filter: none;
    --show-duration: var(--wa-transition-normal);
    --hide-duration: var(--wa-transition-normal);

    display: none;
  }

  :host([open]) {
    display: block;
  }

  .dialog {
    display: flex;
    flex-direction: column;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: var(--width);
    max-width: calc(100% - var(--wa-space-2xl));
    max-height: calc(100% - var(--wa-space-2xl));
    color: inherit;
    background-color: var(--wa-color-surface-raised);
    border-radius: var(--wa-panel-border-radius);
    border: none;
    box-shadow: var(--wa-shadow-l);
    padding: 0;
    margin: auto;

    &.show {
      animation: show-dialog var(--show-duration) ease;

      &::backdrop {
        animation: show-backdrop var(--show-duration, 200ms) ease;
      }
    }

    &.hide {
      animation: show-dialog var(--hide-duration) ease reverse;

      &::backdrop {
        animation: show-backdrop var(--hide-duration, 200ms) ease reverse;
      }
    }

    &.pulse {
      animation: pulse 250ms ease;
    }
  }

  .dialog:focus {
    outline: none;
  }

  /* Ensure there's enough vertical padding for phones that don't update vh when chrome appears (e.g. iPhone) */
  @media screen and (max-width: 420px) {
    .dialog {
      max-height: 80vh;
    }
  }

  .open {
    display: flex;
    opacity: 1;
  }

  .header {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: nowrap;

    padding-inline-start: var(--spacing);
    padding-block-end: 0;

    /* Subtract the close button's padding so that the X is visually aligned with the edges of the dialog content */
    padding-inline-end: calc(var(--spacing) - var(--wa-form-control-padding-block));
    padding-block-start: calc(var(--spacing) - var(--wa-form-control-padding-block));
  }

  .title {
    align-self: center;
    flex: 1 1 auto;
    font-family: inherit;
    font-size: var(--wa-font-size-l);
    font-weight: var(--wa-font-weight-heading);
    line-height: var(--wa-line-height-condensed);
    margin: 0;
  }

  .header-actions {
    align-self: start;
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: end;
    gap: var(--wa-space-2xs);
    padding-inline-start: var(--spacing);
  }

  .header-actions wa-button,
  .header-actions ::slotted(wa-button) {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .body {
    flex: 1 1 auto;
    display: block;
    padding: var(--spacing);
    overflow: auto;
    -webkit-overflow-scrolling: touch;

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: var(--wa-focus-ring);
      outline-offset: var(--wa-focus-ring-offset);
    }
  }

  .footer {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    gap: var(--wa-space-xs);
    justify-content: end;
    padding: var(--spacing);
    padding-block-start: 0;
  }

  .footer ::slotted(wa-button:not(:first-of-type)) {
    margin-inline-start: var(--wa-spacing-xs);
  }

  .dialog::backdrop {
    /*
      NOTE: the ::backdrop element doesn't inherit properly in Safari yet, but it will in 17.4! At that time, we can
      remove the fallback values here.
    */
    background-color: var(--wa-color-overlay-modal, rgb(0 0 0 / 0.25));
    backdrop-filter: var(--backdrop-filter);
  }

  @keyframes pulse {
    0% {
      scale: 1;
    }
    50% {
      scale: 1.02;
    }
    100% {
      scale: 1;
    }
  }

  @keyframes show-dialog {
    from {
      opacity: 0;
      scale: 0.8;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }

  @keyframes show-backdrop {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (forced-colors: active) {
    .dialog {
      border: solid 1px white;
    }
  }
`;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.3H2FQERJ.js
var dismissibleStack = [];
function registerDismissible(key) {
  unregisterDismissible(key);
  dismissibleStack.push(key);
}
function unregisterDismissible(key) {
  for (let i8 = dismissibleStack.length - 1; i8 >= 0; i8--) {
    if (dismissibleStack[i8] === key) {
      dismissibleStack.splice(i8, 1);
      break;
    }
  }
}
function isTopDismissible(key) {
  return dismissibleStack.length > 0 && dismissibleStack[dismissibleStack.length - 1] === key;
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.RWNXKUCF.js
var HasSlotController = class {
  constructor(host, ...slotNames) {
    this.slotNames = [];
    this.handleSlotChange = (event) => {
      const slot = event.target;
      if (this.slotNames.includes("[default]") && !slot.name || slot.name && this.slotNames.includes(slot.name)) {
        this.host.requestUpdate();
      }
    };
    (this.host = host).addController(this);
    this.slotNames = slotNames;
  }
  hasDefaultSlot() {
    if (!this.host.childNodes) {
      return false;
    }
    return [...this.host.childNodes].some((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
        return true;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        const tagName = el.tagName.toLowerCase();
        if (tagName === "wa-visually-hidden") {
          return false;
        }
        if (!el.hasAttribute("slot")) {
          return true;
        }
      }
      return false;
    });
  }
  hasNamedSlot(name) {
    return this.host.querySelector?.(`:scope > [slot="${name}"]`) !== null;
  }
  /**
   * @param slotName     - Name of the slot to look for
   * @param propertyName - Generally we infer via `withHeader` property on the host, but in cases where its different, you can specify a manual property name.
   */
  test(slotName, propertyName) {
    if (propertyName && this.host.didSSR && !this.host.hasUpdated) {
      return Boolean(this.host[propertyName]);
    }
    return slotName === "[default]" ? this.hasDefaultSlot() : this.hasNamedSlot(slotName);
  }
  hostConnected() {
    const shadowRoot = this.host.shadowRoot;
    if (shadowRoot && "addEventListener" in shadowRoot) {
      shadowRoot.addEventListener("slotchange", this.handleSlotChange);
    }
  }
  hostDisconnected() {
    const shadowRoot = this.host.shadowRoot;
    if (shadowRoot && "removeEventListener" in shadowRoot) {
      shadowRoot.removeEventListener("slotchange", this.handleSlotChange);
    }
  }
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.L6CIKOFQ.js
function animateWithClass(el, className) {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const { signal } = controller;
    if (el.classList.contains(className)) {
      return;
    }
    el.classList.add(className);
    let resolved = false;
    let onEnd = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      el.classList.remove(className);
      resolve();
      controller.abort();
    };
    el.addEventListener("animationend", onEnd, { once: true, signal });
    el.addEventListener("animationcancel", onEnd, { once: true, signal });
    requestAnimationFrame(() => {
      if (!resolved && el.getAnimations().length === 0) {
        onEnd();
      }
    });
  });
}

// node_modules/lit-html/directive.js
var t4 = { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4, EVENT: 5, ELEMENT: 6 };
var e6 = (t6) => (...e9) => ({ _$litDirective$: t6, values: e9 });
var i5 = class {
  constructor(t6) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t6, e9, i8) {
    this._$Ct = t6, this._$AM = e9, this._$Ci = i8;
  }
  _$AS(t6, e9) {
    return this.update(t6, e9);
  }
  update(t6, e9) {
    return this.render(...e9);
  }
};

// node_modules/lit-html/directives/class-map.js
var e7 = e6(class extends i5 {
  constructor(t6) {
    if (super(t6), t6.type !== t4.ATTRIBUTE || "class" !== t6.name || t6.strings?.length > 2) throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.");
  }
  render(t6) {
    return " " + Object.keys(t6).filter((s4) => t6[s4]).join(" ") + " ";
  }
  update(s4, [i8]) {
    if (void 0 === this.st) {
      this.st = /* @__PURE__ */ new Set(), void 0 !== s4.strings && (this.nt = new Set(s4.strings.join(" ").split(/\s/).filter((t6) => "" !== t6)));
      for (const t6 in i8) i8[t6] && !this.nt?.has(t6) && this.st.add(t6);
      return this.render(i8);
    }
    const r7 = s4.element.classList;
    for (const t6 of this.st) t6 in i8 || (r7.remove(t6), this.st.delete(t6));
    for (const t6 in i8) {
      const s5 = !!i8[t6];
      s5 === this.st.has(t6) || this.nt?.has(t6) || (s5 ? (r7.add(t6), this.st.add(t6)) : (r7.remove(t6), this.st.delete(t6)));
    }
    return E;
  }
});

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.WNMOBTJK.js
var WaDialog = class extends WebAwesomeElement {
  constructor() {
    super(...arguments);
    this.localize = new LocalizeController2(this);
    this.hasSlotController = new HasSlotController(this, "footer", "header-actions", "label");
    this.renderedWatcher = new RenderedWatcher(this, (isRendered) => this.handleRenderedChange(isRendered));
    this.open = false;
    this.label = "";
    this.withoutHeader = false;
    this.lightDismiss = false;
    this.withFooter = false;
    this.handleDocumentKeyDown = (event) => {
      if (event.key === "Escape" && this.open && isTopDismissible(this)) {
        event.preventDefault();
        event.stopPropagation();
        this.requestClose(this.dialog);
      }
    };
  }
  firstUpdated(changedProperties) {
    super.firstUpdated(changedProperties);
    if (this.open) {
      this.addOpenListeners();
      this.dialog.showModal();
      lockBodyScrolling(this);
      this.renderedWatcher.start(this.dialog);
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.renderedWatcher.stop();
    unlockBodyScrolling(this);
    this.removeOpenListeners();
  }
  async requestClose(source) {
    const waHideEvent = new WaHideEvent({ source });
    this.dispatchEvent(waHideEvent);
    if (waHideEvent.defaultPrevented) {
      this.open = true;
      animateWithClass(this.dialog, "pulse");
      return;
    }
    this.removeOpenListeners();
    await animateWithClass(this.dialog, "hide");
    this.open = false;
    this.dialog.close();
    unlockBodyScrolling(this);
    this.renderedWatcher.stop();
    const trigger = this.originalTrigger;
    if (typeof trigger?.focus === "function") {
      setTimeout(() => trigger.focus());
    }
    this.dispatchEvent(new WaAfterHideEvent());
  }
  addOpenListeners() {
    document.addEventListener("keydown", this.handleDocumentKeyDown);
    registerDismissible(this);
  }
  removeOpenListeners() {
    document.removeEventListener("keydown", this.handleDocumentKeyDown);
    unregisterDismissible(this);
  }
  handleDialogCancel(event) {
    event.preventDefault();
    if (!this.dialog.classList.contains("hide") && event.target === this.dialog && isTopDismissible(this)) {
      this.requestClose(this.dialog);
    }
  }
  handleDialogClick(event) {
    const target = event.target;
    const button = target.closest('[data-dialog="close"]');
    if (button) {
      event.stopPropagation();
      this.requestClose(button);
    }
  }
  async handleDialogPointerDown(event) {
    if (event.target === this.dialog) {
      if (this.lightDismiss) {
        this.requestClose(this.dialog);
      } else {
        await animateWithClass(this.dialog, "pulse");
      }
    }
  }
  /**
   * Suspends the modal when third-party CSS (e.g. cookie banner blockers) hides an open dialog, so the page isn't
   * left scroll locked and inert. "open" stays true so the modal resumes if the dialog is rendered again.
   */
  handleRenderedChange(isRendered) {
    if (!this.open) {
      this.renderedWatcher.stop();
      return;
    }
    if (!isRendered && this.dialog.open) {
      this.removeOpenListeners();
      this.dialog.close();
      unlockBodyScrolling(this);
    } else if (isRendered && !this.dialog.open) {
      this.addOpenListeners();
      this.dialog.showModal();
      lockBodyScrolling(this);
    }
  }
  handleOpenChange() {
    if (this.open && !this.dialog.open) {
      this.show();
    } else if (!this.open && this.dialog.open) {
      this.open = true;
      this.requestClose(this.dialog);
    } else if (!this.open) {
      this.renderedWatcher.stop();
    }
  }
  /** Shows the dialog. */
  async show() {
    const waShowEvent = new WaShowEvent();
    this.dispatchEvent(waShowEvent);
    if (waShowEvent.defaultPrevented) {
      this.open = false;
      return;
    }
    this.addOpenListeners();
    this.originalTrigger = document.activeElement;
    this.open = true;
    this.dialog.showModal();
    lockBodyScrolling(this);
    this.renderedWatcher.start(this.dialog);
    requestAnimationFrame(() => {
      const elementToFocus = this.querySelector("[autofocus]");
      if (elementToFocus && typeof elementToFocus.focus === "function") {
        elementToFocus.focus();
      } else {
        this.dialog.focus();
      }
    });
    await animateWithClass(this.dialog, "show");
    this.dispatchEvent(new WaAfterShowEvent());
  }
  render() {
    const hasHeader = !this.withoutHeader;
    const hasFooter = this.hasSlotController.test("footer", "withFooter");
    return b2`
      <dialog
        part="dialog"
        class=${e7({
      dialog: true,
      open: this.open
    })}
        @cancel=${this.handleDialogCancel}
        @click=${this.handleDialogClick}
        @pointerdown=${this.handleDialogPointerDown}
      >
        ${hasHeader ? b2`
              <div part="header" class="header">
                <h2 part="title" class="title" id="title">
                  <!-- If there's no label, use an invisible character to prevent the header from collapsing -->
                  <slot name="label"> ${this.label.length > 0 ? this.label : String.fromCharCode(8203)} </slot>
                </h2>
                <div part="header-actions" class="header-actions">
                  <slot name="header-actions"></slot>
                  <wa-button
                    part="close-button"
                    exportparts="base:close-button__base"
                    class="close"
                    appearance="plain"
                    @click="${(event) => this.requestClose(event.target)}"
                  >
                    <wa-icon
                      name="xmark"
                      label=${this.localize.term("close")}
                      library="system"
                      variant="solid"
                    ></wa-icon>
                  </wa-button>
                </div>
              </div>
            ` : ""}

        <div part="body" class="body"><slot></slot></div>

        <!-- Use a hidden element so we still get "slotchange" events. -->
        <div part="footer" class="footer" ?hidden=${!hasFooter}>
          <slot name="footer"></slot>
        </div>
      </dialog>
    `;
  }
};
WaDialog.css = dialog_styles_default;
__decorateClass([
  e5(".dialog")
], WaDialog.prototype, "dialog", 2);
__decorateClass([
  n4({ type: Boolean, reflect: true })
], WaDialog.prototype, "open", 2);
__decorateClass([
  n4({ reflect: true })
], WaDialog.prototype, "label", 2);
__decorateClass([
  n4({ attribute: "without-header", type: Boolean, reflect: true })
], WaDialog.prototype, "withoutHeader", 2);
__decorateClass([
  n4({ attribute: "light-dismiss", type: Boolean })
], WaDialog.prototype, "lightDismiss", 2);
__decorateClass([
  n4({ attribute: "with-footer", type: Boolean })
], WaDialog.prototype, "withFooter", 2);
__decorateClass([
  watch("open", { waitUntilFirstUpdate: true })
], WaDialog.prototype, "handleOpenChange", 1);
WaDialog = __decorateClass([
  t3("wa-dialog")
], WaDialog);
if (!o5) {
  document.addEventListener("click", (event) => {
    const dialogAttrEl = event.target.closest("[data-dialog]");
    if (dialogAttrEl instanceof Element) {
      const [command, id] = parseSpaceDelimitedTokens(dialogAttrEl.getAttribute("data-dialog") || "");
      if (command === "open" && id?.length) {
        const doc = dialogAttrEl.getRootNode();
        const dialog = doc.getElementById(id);
        if (dialog?.localName === "wa-dialog") {
          dialog.open = true;
        } else {
          console.warn(`A dialog with an ID of "${id}" could not be found in this document.`);
        }
      }
    }
  });
  document.addEventListener("pointerdown", () => {
  });
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.R7QX4M6R.js
var MirrorValidator = () => {
  return {
    checkValidity(element) {
      const formControl = element.input;
      const validity = {
        message: "",
        isValid: true,
        invalidKeys: []
      };
      if (!formControl) {
        return validity;
      }
      let isValid = true;
      if ("checkValidity" in formControl) {
        isValid = formControl.checkValidity();
      }
      if (isValid) {
        return validity;
      }
      validity.isValid = false;
      if ("validationMessage" in formControl) {
        validity.message = formControl.validationMessage;
      }
      if (!("validity" in formControl)) {
        validity.invalidKeys.push("customError");
        return validity;
      }
      for (const key in formControl.validity) {
        if (key === "valid") {
          continue;
        }
        const checkedKey = key;
        if (formControl.validity[checkedKey]) {
          validity.invalidKeys.push(checkedKey);
        }
      }
      return validity;
    }
  };
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.VC3BPUZJ.js
var WaInvalidEvent = class extends Event {
  constructor() {
    super("wa-invalid", { bubbles: true, cancelable: false, composed: true });
  }
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.KBXNFZQL.js
var CustomErrorValidator = () => {
  return {
    observedAttributes: ["custom-error"],
    checkValidity(element) {
      const validity = {
        message: "",
        isValid: true,
        invalidKeys: []
      };
      if (element.customError) {
        validity.message = element.customError;
        validity.isValid = false;
        validity.invalidKeys = ["customError"];
      }
      return validity;
    }
  };
};
var WebAwesomeFormAssociatedElement = class extends WebAwesomeElement {
  constructor() {
    super();
    this.name = null;
    this.disabled = false;
    this.required = false;
    this.assumeInteractionOn = ["input"];
    this.validators = [];
    this.valueHasChanged = false;
    this.hasInteracted = false;
    this.customError = null;
    this.emittedEvents = [];
    this.emitInvalid = (e9) => {
      if (e9.target !== this) return;
      this.hasInteracted = true;
      this.dispatchEvent(new WaInvalidEvent());
    };
    this.handleInteraction = (event) => {
      const emittedEvents = this.emittedEvents;
      if (!emittedEvents.includes(event.type)) {
        emittedEvents.push(event.type);
      }
      if (emittedEvents.length === this.assumeInteractionOn?.length) {
        this.hasInteracted = true;
      }
    };
    if ("addEventListener" in this) {
      this.addEventListener("invalid", this.emitInvalid);
    }
  }
  /**
   * Validators are static because they have `observedAttributes`, essentially attributes to "watch"
   * for changes. Whenever these attributes change, we want to be notified and update the validator.
   */
  static get validators() {
    return o5 ? [] : [CustomErrorValidator()];
  }
  // Append all Validator "observedAttributes" into the "observedAttributes" so they can run.
  static get observedAttributes() {
    const parentAttrs = new Set(super.observedAttributes || []);
    for (const validator of this.validators) {
      if (!validator.observedAttributes) {
        continue;
      }
      for (const attr of validator.observedAttributes) {
        parentAttrs.add(attr);
      }
    }
    return [...parentAttrs];
  }
  connectedCallback() {
    super.connectedCallback();
    if (this.didSSR && !this.hasUpdated) {
      this.updateComplete.then(() => {
        this.updateValidity();
      });
    } else {
      this.updateValidity();
    }
    this.assumeInteractionOn.forEach((event) => {
      this.addEventListener?.(event, this.handleInteraction);
    });
  }
  firstUpdated(...args) {
    super.firstUpdated(...args);
    this.updateValidity();
  }
  willUpdate(changedProperties) {
    if (!o5 && changedProperties.has("customError")) {
      if (!this.customError) {
        this.customError = null;
      }
      this.setCustomValidity(this.customError || "");
    }
    if (changedProperties.has("value") || changedProperties.has("disabled") || changedProperties.has("defaultValue")) {
      const value = this.value;
      this.updateFormValue(value);
    }
    if (changedProperties.has("disabled")) {
      this.customStates.set("disabled", this.disabled);
      if (this.hasAttribute("disabled") || !o5 && !this.matches(":disabled")) {
        this.toggleAttribute("disabled", this.disabled);
      }
    }
    super.willUpdate(changedProperties);
    if (this.didSSR && !this.hasUpdated) {
      this.updateComplete.then(() => this.updateValidity());
    } else {
      this.updateValidity();
    }
  }
  /**
   * @internal
   */
  updateFormValue(value) {
    if (Array.isArray(value)) {
      if (this.name) {
        const formData = new FormData();
        for (const val of value) {
          formData.append(this.name, val);
        }
        this.setValue(formData, formData);
      }
    } else {
      this.setValue(value, value);
    }
  }
  get labels() {
    return this.internals.labels;
  }
  getForm() {
    return this.internals.form;
  }
  /**
   * By default, form controls are associated with the nearest containing `<form>` element. This attribute allows you
   * to place the form control outside of a form and associate it with the form that has this `id`. The form must be in
   * the same document or shadow root for this to work.
   */
  set form(val) {
    if (val) {
      this.setAttribute("form", val);
    } else {
      this.removeAttribute("form");
    }
  }
  get form() {
    return this.internals.form;
  }
  get validity() {
    return this.internals.validity;
  }
  // Not sure if this supports `novalidate`. Will need to test.
  get willValidate() {
    return this.internals.willValidate;
  }
  get validationMessage() {
    return this.internals.validationMessage;
  }
  checkValidity() {
    this.updateValidity();
    return this.internals.checkValidity();
  }
  reportValidity() {
    this.updateValidity();
    this.hasInteracted = true;
    return this.internals.reportValidity();
  }
  /**
   * Override this to change where constraint validation popups are anchored.
   */
  get validationTarget() {
    return this.input || void 0;
  }
  setValidity(...args) {
    const flags = args[0];
    const message = args[1];
    let anchor = args[2];
    if (!anchor) {
      anchor = this.validationTarget;
    }
    this.internals.setValidity(flags, message, anchor || void 0);
    this.requestUpdate("validity");
    this.setCustomStates();
  }
  setCustomStates() {
    const required = Boolean(this.required);
    const isValid = this.internals.validity.valid;
    const hasInteracted = this.hasInteracted;
    this.customStates.set("required", required);
    this.customStates.set("optional", !required);
    this.customStates.set("invalid", !isValid);
    this.customStates.set("valid", isValid);
    this.customStates.set("user-invalid", !isValid && hasInteracted);
    this.customStates.set("user-valid", isValid && hasInteracted);
  }
  /**
   * Do not use this when creating a "Validator". This is intended for end users of components.
   * We track manually defined custom errors so we don't clear them on accident in our validators.
   *
   */
  setCustomValidity(message) {
    if (!message) {
      this.customError = null;
      this.setValidity({});
      return;
    }
    this.customError = message;
    this.setValidity({ customError: true }, message, this.validationTarget);
  }
  formResetCallback() {
    this.resetValidity();
    this.hasInteracted = false;
    this.valueHasChanged = false;
    this.emittedEvents = [];
    this.updateValidity();
  }
  formDisabledCallback(isDisabled) {
    this.disabled = isDisabled;
    this.updateValidity();
  }
  /**
   * Called when the browser is trying to restore element’s state to state in which case reason is "restore", or when
   * the browser is trying to fulfill autofill on behalf of user in which case reason is "autocomplete". In the case of
   * "restore", state is a string, File, or FormData object previously set as the second argument to setFormValue.
   */
  formStateRestoreCallback(state2, reason) {
    if (this.didSSR && !this.hasUpdated) {
      this.updateComplete.then(() => {
        this.value = state2;
        if (reason === "restore") {
          this.resetValidity();
        }
        this.updateValidity();
      });
    } else {
      this.value = state2;
      if (reason === "restore") {
        this.resetValidity();
      }
      this.updateValidity();
    }
  }
  setValue(...args) {
    const [value, state2] = args;
    this.internals.setFormValue(value, state2);
  }
  get allValidators() {
    const staticValidators = this.constructor.validators || [];
    const validators = this.validators || [];
    return [...staticValidators, ...validators];
  }
  /**
   * Reset validity is a way of removing manual custom errors and native validation.
   */
  resetValidity() {
    this.setCustomValidity("");
    this.setValidity({});
  }
  updateValidity() {
    if (this.disabled || this.hasAttribute("disabled") || !this.willValidate) {
      this.resetValidity();
      return;
    }
    const validators = this.allValidators;
    if (!validators?.length) {
      return;
    }
    const flags = {
      // Don't trust custom errors from the Browser. Safari breaks the spec.
      customError: Boolean(this.customError)
    };
    const formControl = this.validationTarget || this.input || void 0;
    let finalMessage = "";
    for (const validator of validators) {
      const { isValid, message, invalidKeys } = validator.checkValidity(this);
      if (isValid) {
        continue;
      }
      if (!finalMessage) {
        finalMessage = message;
      }
      if (invalidKeys?.length >= 0) {
        invalidKeys.forEach((str) => flags[str] = true);
      }
    }
    if (!finalMessage) {
      finalMessage = this.validationMessage;
    }
    this.setValidity(flags, finalMessage, formControl);
  }
};
WebAwesomeFormAssociatedElement.formAssociated = true;
__decorateClass([
  n4({ reflect: true })
], WebAwesomeFormAssociatedElement.prototype, "name", 2);
__decorateClass([
  n4({ type: Boolean })
], WebAwesomeFormAssociatedElement.prototype, "disabled", 2);
__decorateClass([
  n4({ state: true, attribute: false })
], WebAwesomeFormAssociatedElement.prototype, "valueHasChanged", 2);
__decorateClass([
  n4({ state: true, attribute: false })
], WebAwesomeFormAssociatedElement.prototype, "hasInteracted", 2);
__decorateClass([
  n4({ attribute: "custom-error", reflect: true })
], WebAwesomeFormAssociatedElement.prototype, "customError", 2);
__decorateClass([
  n4({ attribute: false, state: true, type: Object })
], WebAwesomeFormAssociatedElement.prototype, "validity", 1);

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.RPQJAXXR.js
var DEPRECATION_MAP = {
  small: "s",
  medium: "m",
  large: "l"
};
var warned = /* @__PURE__ */ new Set();
function warnDeprecatedSize(tagName, value) {
  if (value in DEPRECATION_MAP && !warned.has(`${tagName}:${value}`)) {
    warned.add(`${tagName}:${value}`);
    console.warn(
      `[${tagName}] size="${value}" is deprecated. Use size="${DEPRECATION_MAP[value]}" instead. The long-form value will be removed in the next major version.`
    );
  }
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.G5ZZIGWB.js
var size_styles_default = i`
  :host([size='xs']) {
    font-size: var(--wa-font-size-xs);
  }

  :host([size='s']),
  :host([size='small']) {
    font-size: var(--wa-font-size-s);
  }

  :host([size='m']),
  :host([size='medium']) {
    font-size: var(--wa-font-size-m);
  }

  :host([size='l']),
  :host([size='large']) {
    font-size: var(--wa-font-size-l);
  }

  :host([size='xl']) {
    font-size: var(--wa-font-size-xl);
  }
`;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.S35PLDPD.js
var button_styles_default = i`
  @layer wa-component {
    :host {
      display: inline-block;

      /* Workaround because Chrome doesn't like :host(:has()) below
       * https://issues.chromium.org/issues/40062355
       * Firefox doesn't like this nested rule, so both are needed */
      &:has(wa-badge) {
        position: relative;
      }
    }

    /* Apply relative positioning only when needed to position wa-badge
     * This avoids creating a new stacking context for every button */
    :host(:has(wa-badge)) {
      position: relative;
    }
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    user-select: none;
    -webkit-user-select: none;
    white-space: nowrap;
    vertical-align: middle;
    transition-property: background, border, box-shadow, color, opacity, transform;
    transition-duration: var(--wa-transition-fast);
    transition-timing-function: var(--wa-transition-easing);
    transform-origin: center;
    cursor: pointer;
    padding: 0 var(--wa-form-control-padding-inline);
    font-family: inherit;
    font-size: inherit;
    font-weight: var(--wa-font-weight-action);
    height: var(--wa-form-control-height);
    width: 100%;

    background-color: var(--wa-color-fill-loud, var(--wa-color-neutral-fill-loud));

    border-color: transparent;
    color: var(--wa-color-on-loud, var(--wa-color-neutral-on-loud));
    border-start-start-radius: var(--_button-start-start-radius, var(--wa-form-control-border-radius));
    border-start-end-radius: var(--_button-start-end-radius, var(--wa-form-control-border-radius));
    border-end-start-radius: var(--_button-end-start-radius, var(--wa-form-control-border-radius));
    border-end-end-radius: var(--_button-end-end-radius, var(--wa-form-control-border-radius));
    border-style: var(--wa-form-control-border-style);
    border-width: var(--wa-form-control-border-width);
  }

  /* Hover and active transforms */
  .button:not(.disabled):not(.loading) {
    @media (hover: hover) {
      &:hover {
        transform: var(--wa-button-transform-hover);
      }
    }
    &:active {
      transform: var(--wa-button-transform-active);
    }

    @media (prefers-reduced-motion: reduce) {
      &:hover,
      &:active {
        transform: none;
      }
    }
  }

  /* Appearance modifiers */
  :host([appearance='plain']) {
    /* Indentation overrides for grouping */
    margin-inline-start: var(--_button-horizontal-indent);
    margin-block-start: var(--_button-vertical-indent);

    .button {
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      background-color: transparent;
      border-color: transparent;
    }
    @media (hover: hover) {
      .button:not(.disabled):not(.loading):hover {
        color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
        background-color: var(--wa-color-fill-quiet, var(--wa-color-neutral-fill-quiet));
      }
    }
    .button:not(.disabled):not(.loading):active {
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      background-color: color-mix(
        in oklab,
        var(--wa-color-fill-quiet, var(--wa-color-neutral-fill-quiet)),
        var(--wa-color-mix-active)
      );
    }
  }

  :host([appearance='outlined']) {
    /* Indentation overrides for grouping outlined */
    margin-inline-start: var(--_button-horizontal-indent-outlined);
    margin-block-start: var(--_button-vertical-indent-outlined);

    .button {
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      background-color: transparent;
      border-color: var(--wa-color-border-loud, var(--wa-color-neutral-border-loud));
    }
    @media (hover: hover) {
      .button:not(.disabled):not(.loading):hover {
        color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
        background-color: var(--wa-color-fill-quiet, var(--wa-color-neutral-fill-quiet));
      }
    }
    .button:not(.disabled):not(.loading):active {
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      background-color: color-mix(
        in oklab,
        var(--wa-color-fill-quiet, var(--wa-color-neutral-fill-quiet)),
        var(--wa-color-mix-active)
      );
    }
  }

  :host([appearance='filled']) {
    /* Indentation overrides for grouping */
    margin-inline-start: var(--_button-horizontal-indent);
    margin-block-start: var(--_button-vertical-indent);

    .button {
      color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
      background-color: var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal));
      border-color: transparent;
    }
    @media (hover: hover) {
      .button:not(.disabled):not(.loading):hover {
        color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
        background-color: color-mix(
          in oklab,
          var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal)),
          var(--wa-color-mix-hover)
        );
      }
    }
    .button:not(.disabled):not(.loading):active {
      color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
      background-color: color-mix(
        in oklab,
        var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal)),
        var(--wa-color-mix-active)
      );
    }
  }

  :host([appearance='filled-outlined']) {
    /* Indentation overrides for grouping outlined */
    margin-inline-start: var(--_button-horizontal-indent-outlined);
    margin-block-start: var(--_button-vertical-indent-outlined);

    .button {
      color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
      background-color: var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal));
      border-color: var(--wa-color-border-normal, var(--wa-color-neutral-border-normal));
    }
    @media (hover: hover) {
      .button:not(.disabled):not(.loading):hover {
        color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
        background-color: color-mix(
          in oklab,
          var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal)),
          var(--wa-color-mix-hover)
        );
      }
    }
    .button:not(.disabled):not(.loading):active {
      color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
      background-color: color-mix(
        in oklab,
        var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal)),
        var(--wa-color-mix-active)
      );
    }
  }

  :host([appearance='accent']) {
    /* Indentation overrides for grouping */
    margin-inline-start: var(--_button-horizontal-indent);
    margin-block-start: var(--_button-vertical-indent);

    .button {
      color: var(--wa-color-on-loud, var(--wa-color-neutral-on-loud));
      background-color: var(--wa-color-fill-loud, var(--wa-color-neutral-fill-loud));
      border-color: transparent;
    }
    @media (hover: hover) {
      .button:not(.disabled):not(.loading):hover {
        background-color: color-mix(
          in oklab,
          var(--wa-color-fill-loud, var(--wa-color-neutral-fill-loud)),
          var(--wa-color-mix-hover)
        );
      }
    }
    .button:not(.disabled):not(.loading):active {
      background-color: color-mix(
        in oklab,
        var(--wa-color-fill-loud, var(--wa-color-neutral-fill-loud)),
        var(--wa-color-mix-active)
      );
    }
  }

  /* Focus states */
  .button:focus {
    outline: none;
  }

  .button:focus-visible {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  /* Disabled state */
  :host([disabled]) {
    opacity: 0.5;
    cursor: not-allowed;

    /* When disabled, prevent mouse events from bubbling up from children */
    .button {
      pointer-events: none;
    }
  }

  /* Keep it last so Safari doesn't stop parsing this block */
  .button::-moz-focus-inner {
    border: 0;
  }

  /* Icon buttons */
  .button.is-icon-button {
    outline-offset: 2px;
    width: var(--wa-form-control-height);
    aspect-ratio: 1;
  }

  /* Icon buttons with a caret need to grow to fit both the icon and the caret */
  .button.is-icon-button.caret {
    width: auto;
    aspect-ratio: auto;
    min-width: var(--wa-form-control-height);
  }

  /* Pill modifier */
  :host([pill]) .button {
    border-start-start-radius: var(--_button-start-start-radius, var(--wa-border-radius-pill));
    border-start-end-radius: var(--_button-start-end-radius, var(--wa-border-radius-pill));
    border-end-start-radius: var(--_button-end-start-radius, var(--wa-border-radius-pill));
    border-end-end-radius: var(--_button-end-end-radius, var(--wa-border-radius-pill));
  }

  /*
   * Label
   */

  .start,
  .end {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  .label {
    display: inline-block;
  }

  .is-icon-button .label {
    display: flex;
    justify-content: center;
  }

  .label::slotted(wa-icon) {
    align-self: center;
  }

  /*
   * Caret modifier
   */

  wa-icon[part='caret'] {
    display: flex;
    align-self: center;
    align-items: center;

    &::part(svg) {
      width: 0.875em;
      height: 0.875em;
    }

    .button:has(&) .end {
      display: none;
    }
  }

  /*
   * Loading modifier
   */

  .loading {
    position: relative;
    cursor: wait;

    .start,
    .label,
    .end,
    .caret {
      /* Hidden with opacity, not visibility, so the label stays in the accessibility tree */
      opacity: 0;

      /* Unlike visibility: hidden, opacity leaves the content clickable */
      pointer-events: none;
    }

    wa-spinner {
      --indicator-color: currentColor;
      --track-color: color-mix(in oklab, currentColor, transparent 90%);

      position: absolute;
      font-size: 1em;
      height: 1em;
      width: 1em;
      top: calc(50% - 0.5em);
      left: calc(50% - 0.5em);
    }
  }

  /*
   * Badges
   */

  .button ::slotted(wa-badge) {
    border-color: var(--wa-color-surface-default);
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
    translate: 50% -50%;
    pointer-events: none;
  }

  :host(:dir(rtl)) ::slotted(wa-badge) {
    translate: -50% -50%;
  }

  /*
  * Button spacing
  */

  slot[name='start']::slotted(*) {
    margin-inline-end: 0.75em;
  }

  slot[name='end']::slotted(*),
  .button:not(.visually-hidden-label) [part='caret'] {
    margin-inline-start: 0.75em;
  }
`;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.XNTP7DEQ.js
var variants_styles_default = i`
  :where(:root),
  .wa-neutral,
  :host([variant='neutral']) {
    --wa-color-fill-loud: var(--wa-color-neutral-fill-loud);
    --wa-color-fill-normal: var(--wa-color-neutral-fill-normal);
    --wa-color-fill-quiet: var(--wa-color-neutral-fill-quiet);
    --wa-color-border-loud: var(--wa-color-neutral-border-loud);
    --wa-color-border-normal: var(--wa-color-neutral-border-normal);
    --wa-color-border-quiet: var(--wa-color-neutral-border-quiet);
    --wa-color-on-loud: var(--wa-color-neutral-on-loud);
    --wa-color-on-normal: var(--wa-color-neutral-on-normal);
    --wa-color-on-quiet: var(--wa-color-neutral-on-quiet);
  }

  .wa-brand,
  :host([variant='brand']) {
    --wa-color-fill-loud: var(--wa-color-brand-fill-loud);
    --wa-color-fill-normal: var(--wa-color-brand-fill-normal);
    --wa-color-fill-quiet: var(--wa-color-brand-fill-quiet);
    --wa-color-border-loud: var(--wa-color-brand-border-loud);
    --wa-color-border-normal: var(--wa-color-brand-border-normal);
    --wa-color-border-quiet: var(--wa-color-brand-border-quiet);
    --wa-color-on-loud: var(--wa-color-brand-on-loud);
    --wa-color-on-normal: var(--wa-color-brand-on-normal);
    --wa-color-on-quiet: var(--wa-color-brand-on-quiet);
  }

  .wa-success,
  :host([variant='success']) {
    --wa-color-fill-loud: var(--wa-color-success-fill-loud);
    --wa-color-fill-normal: var(--wa-color-success-fill-normal);
    --wa-color-fill-quiet: var(--wa-color-success-fill-quiet);
    --wa-color-border-loud: var(--wa-color-success-border-loud);
    --wa-color-border-normal: var(--wa-color-success-border-normal);
    --wa-color-border-quiet: var(--wa-color-success-border-quiet);
    --wa-color-on-loud: var(--wa-color-success-on-loud);
    --wa-color-on-normal: var(--wa-color-success-on-normal);
    --wa-color-on-quiet: var(--wa-color-success-on-quiet);
  }

  .wa-warning,
  :host([variant='warning']) {
    --wa-color-fill-loud: var(--wa-color-warning-fill-loud);
    --wa-color-fill-normal: var(--wa-color-warning-fill-normal);
    --wa-color-fill-quiet: var(--wa-color-warning-fill-quiet);
    --wa-color-border-loud: var(--wa-color-warning-border-loud);
    --wa-color-border-normal: var(--wa-color-warning-border-normal);
    --wa-color-border-quiet: var(--wa-color-warning-border-quiet);
    --wa-color-on-loud: var(--wa-color-warning-on-loud);
    --wa-color-on-normal: var(--wa-color-warning-on-normal);
    --wa-color-on-quiet: var(--wa-color-warning-on-quiet);
  }

  .wa-danger,
  :host([variant='danger']) {
    --wa-color-fill-loud: var(--wa-color-danger-fill-loud);
    --wa-color-fill-normal: var(--wa-color-danger-fill-normal);
    --wa-color-fill-quiet: var(--wa-color-danger-fill-quiet);
    --wa-color-border-loud: var(--wa-color-danger-border-loud);
    --wa-color-border-normal: var(--wa-color-danger-border-normal);
    --wa-color-border-quiet: var(--wa-color-danger-border-quiet);
    --wa-color-on-loud: var(--wa-color-danger-on-loud);
    --wa-color-on-normal: var(--wa-color-danger-on-normal);
    --wa-color-on-quiet: var(--wa-color-danger-on-quiet);
  }
`;

// node_modules/lit-html/static.js
var a3 = /* @__PURE__ */ Symbol.for("");
var o8 = (t6) => {
  if (t6?.r === a3) return t6?._$litStatic$;
};
var i6 = (t6, ...r7) => ({ _$litStatic$: r7.reduce((r8, e9, a4) => r8 + ((t7) => {
  if (void 0 !== t7._$litStatic$) return t7._$litStatic$;
  throw Error(`Value passed to 'literal' function must be a 'literal' result: ${t7}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`);
})(e9) + t6[a4 + 1], t6[0]), r: a3 });
var l3 = /* @__PURE__ */ new Map();
var n5 = (t6) => (r7, ...e9) => {
  const a4 = e9.length;
  let s4, i8;
  const n6 = [], u4 = [];
  let c5, $3 = 0, f3 = false;
  for (; $3 < a4; ) {
    for (c5 = r7[$3]; $3 < a4 && void 0 !== (i8 = e9[$3], s4 = o8(i8)); ) c5 += s4 + r7[++$3], f3 = true;
    $3 !== a4 && u4.push(i8), n6.push(c5), $3++;
  }
  if ($3 === a4 && n6.push(r7[a4]), f3) {
    const t7 = n6.join("$$lit$$");
    void 0 === (r7 = l3.get(t7)) && (n6.raw = n6, l3.set(t7, r7 = n6)), e9 = u4;
  }
  return t6(r7, ...e9);
};
var u3 = n5(b2);
var c4 = n5(w);
var $2 = n5(T);

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.5PQVPZTW.js
var WaButton = class extends WebAwesomeFormAssociatedElement {
  constructor() {
    super(...arguments);
    this.assumeInteractionOn = ["click"];
    this.hasSlotController = new HasSlotController(this, "[default]", "start", "end");
    this.localize = new LocalizeController2(this);
    this.invalid = false;
    this.isIconButton = false;
    this.title = "";
    this.variant = "neutral";
    this.appearance = "accent";
    this.size = "m";
    this.withCaret = false;
    this.withStart = false;
    this.withEnd = false;
    this.disabled = false;
    this.loading = false;
    this.pill = false;
    this.type = "button";
  }
  static get validators() {
    return [...super.validators, MirrorValidator()];
  }
  handleSizeChange() {
    warnDeprecatedSize(this.localName, this.size);
  }
  constructLightDOMButton() {
    const button = document.createElement("button");
    for (const attribute of this.attributes) {
      if (attribute.name === "style") {
        continue;
      }
      button.setAttribute(attribute.name, attribute.value);
    }
    button.type = this.type;
    button.style.position = "absolute !important";
    button.style.width = "0 !important";
    button.style.height = "0 !important";
    button.style.clipPath = "inset(50%) !important";
    button.style.overflow = "hidden !important";
    button.style.whiteSpace = "nowrap !important";
    if (this.name) {
      button.name = this.name;
    }
    button.value = this.value || "";
    return button;
  }
  handleClick(event) {
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (this.type !== "submit" && this.type !== "reset") {
      return;
    }
    const form = this.getForm();
    if (!form) return;
    const lightDOMButton = this.constructLightDOMButton();
    this.parentElement?.append(lightDOMButton);
    lightDOMButton.click();
    lightDOMButton.remove();
  }
  handleInvalid() {
    this.dispatchEvent(new WaInvalidEvent());
  }
  handleLabelSlotChange() {
    const nodes = this.labelSlot.assignedNodes({ flatten: true });
    let hasIconLabel = false;
    let hasIcon = false;
    let hasText = false;
    let hasOtherElements = false;
    [...nodes].forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node;
        if (element.localName === "wa-icon") {
          hasIcon = true;
          if (!hasIconLabel) hasIconLabel = element.label !== void 0;
        } else {
          hasOtherElements = true;
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim() || "";
        if (text.length > 0) {
          hasText = true;
        }
      }
    });
    this.isIconButton = hasIcon && !hasText && !hasOtherElements;
    this.customStates.set("icon-button", this.isIconButton);
    if (this.isIconButton && !hasIconLabel) {
      console.warn(
        'Icon buttons must have a label for screen readers. Add <wa-icon label="..."> to remove this warning.',
        this
      );
    }
  }
  isButton() {
    return this.href ? false : true;
  }
  isLink() {
    return this.href ? true : false;
  }
  handleDisabledChange() {
    this.customStates.set("disabled", this.disabled);
    this.updateValidity();
  }
  handleHrefChange() {
    this.customStates.set("link", this.isLink());
  }
  handleLoadingChange() {
    this.customStates.set("loading", this.loading);
  }
  // eslint-disable-next-line
  setValue(..._args) {
  }
  /** Simulates a click on the button. */
  click() {
    this.button.click();
  }
  /** Sets focus on the button. */
  focus(options) {
    this.button.focus(options);
  }
  /** Removes focus from the button. */
  blur() {
    this.button.blur();
  }
  render() {
    const isLink = this.isLink();
    const tag = isLink ? i6`a` : i6`button`;
    return u3`
      <${tag}
        part="base button"
        class=${e7({
      button: true,
      caret: this.withCaret,
      disabled: this.disabled,
      loading: this.loading,
      rtl: this.localize.dir() === "rtl",
      "has-label": this.hasSlotController.test("[default]"),
      "has-start": this.hasSlotController.test("start", "withStart"),
      "has-end": this.hasSlotController.test("end", "withEnd"),
      "is-icon-button": this.isIconButton
    })}
        ?disabled=${o7(isLink ? void 0 : this.disabled)}
        type=${o7(isLink ? void 0 : this.type)}
        title=${this.title}
        name=${o7(isLink ? void 0 : this.name)}
        value=${o7(isLink ? void 0 : this.value)}
        href=${o7(isLink ? this.href : void 0)}
        target=${o7(isLink ? this.target : void 0)}
        download=${o7(isLink ? this.download : void 0)}
        rel=${o7(isLink && this.rel ? this.rel : void 0)}
        role=${o7(isLink ? void 0 : "button")}
        aria-disabled=${o7(isLink && this.disabled ? "true" : void 0)}
        aria-busy=${this.loading ? "true" : "false"}
        tabindex=${this.disabled ? "-1" : "0"}
        @invalid=${this.isButton() ? this.handleInvalid : null}
        @click=${this.handleClick}
      >
        <slot name="start" part="start" class="start"></slot>
        <slot part="label" class="label" @slotchange=${this.handleLabelSlotChange}></slot>
        <slot name="end" part="end" class="end"></slot>
        ${this.withCaret ? u3`
                <wa-icon part="caret" class="caret" library="system" name="chevron-down" variant="solid"></wa-icon>
              ` : ""}
        ${this.loading ? u3`<wa-spinner part="spinner"></wa-spinner>` : ""}
      </${tag}>
    `;
  }
};
WaButton.shadowRootOptions = { ...WebAwesomeFormAssociatedElement.shadowRootOptions, delegatesFocus: true };
WaButton.css = [button_styles_default, variants_styles_default, size_styles_default];
__decorateClass([
  e5(".button")
], WaButton.prototype, "button", 2);
__decorateClass([
  e5("slot:not([name])")
], WaButton.prototype, "labelSlot", 2);
__decorateClass([
  r5()
], WaButton.prototype, "invalid", 2);
__decorateClass([
  r5()
], WaButton.prototype, "isIconButton", 2);
__decorateClass([
  n4()
], WaButton.prototype, "title", 2);
__decorateClass([
  n4({ reflect: true })
], WaButton.prototype, "variant", 2);
__decorateClass([
  n4({ reflect: true })
], WaButton.prototype, "appearance", 2);
__decorateClass([
  n4({ reflect: true })
], WaButton.prototype, "size", 2);
__decorateClass([
  watch("size")
], WaButton.prototype, "handleSizeChange", 1);
__decorateClass([
  n4({ attribute: "with-caret", type: Boolean, reflect: true })
], WaButton.prototype, "withCaret", 2);
__decorateClass([
  n4({ attribute: "with-start", type: Boolean })
], WaButton.prototype, "withStart", 2);
__decorateClass([
  n4({ attribute: "with-end", type: Boolean })
], WaButton.prototype, "withEnd", 2);
__decorateClass([
  n4({ type: Boolean })
], WaButton.prototype, "disabled", 2);
__decorateClass([
  n4({ type: Boolean, reflect: true })
], WaButton.prototype, "loading", 2);
__decorateClass([
  n4({ type: Boolean, reflect: true })
], WaButton.prototype, "pill", 2);
__decorateClass([
  n4()
], WaButton.prototype, "type", 2);
__decorateClass([
  n4({ reflect: true })
], WaButton.prototype, "name", 2);
__decorateClass([
  n4({ reflect: true })
], WaButton.prototype, "value", 2);
__decorateClass([
  n4({ reflect: true })
], WaButton.prototype, "href", 2);
__decorateClass([
  n4()
], WaButton.prototype, "target", 2);
__decorateClass([
  n4()
], WaButton.prototype, "rel", 2);
__decorateClass([
  n4()
], WaButton.prototype, "download", 2);
__decorateClass([
  n4({ attribute: "formaction" })
], WaButton.prototype, "formAction", 2);
__decorateClass([
  n4({ attribute: "formenctype" })
], WaButton.prototype, "formEnctype", 2);
__decorateClass([
  n4({ attribute: "formmethod" })
], WaButton.prototype, "formMethod", 2);
__decorateClass([
  n4({ attribute: "formnovalidate", type: Boolean })
], WaButton.prototype, "formNoValidate", 2);
__decorateClass([
  n4({ attribute: "formtarget" })
], WaButton.prototype, "formTarget", 2);
__decorateClass([
  watch("disabled", { waitUntilFirstUpdate: true })
], WaButton.prototype, "handleDisabledChange", 1);
__decorateClass([
  watch("href")
], WaButton.prototype, "handleHrefChange", 1);
__decorateClass([
  watch("loading", { waitUntilFirstUpdate: true })
], WaButton.prototype, "handleLoadingChange", 1);
WaButton = __decorateClass([
  t3("wa-button")
], WaButton);
WaButton.disableWarning?.("change-in-update");

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.W7A2VLCT.js
var spinner_styles_default = i`
  :host {
    --track-width: 2px;
    --track-color: var(--wa-color-neutral-fill-normal);
    --indicator-color: var(--wa-color-brand-fill-loud);
    --speed: 2s;
    --size: 1em;

    /*
      Resizing a spinner element using anything but font-size will break the animation because the animation uses em
      units. Therefore, if a spinner is used in a flex container without \`flex: none\` applied, the spinner can
      grow/shrink and break the animation. The use of \`flex: none\` on the host element prevents this by always having
      the spinner sized according to its actual dimensions.
    */
    flex: none;
    display: inline-flex;
    width: var(--size);
    height: var(--size);
  }

  svg {
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    animation: spin var(--speed) linear infinite;
  }

  .track,
  .indicator {
    --radius: calc(var(--size) / 2 - var(--track-width) / 2);
    --circumference: calc(var(--radius) * 2 * 3.141592654);

    cx: calc(var(--size) / 2);
    cy: calc(var(--size) / 2);
    r: var(--radius);
    fill: none;
    stroke-width: var(--track-width);
  }

  .track {
    stroke: var(--track-color);
  }

  .indicator {
    stroke: var(--indicator-color);
    stroke-linecap: round;
    stroke-dasharray: calc(0.597 * var(--circumference)), calc(0.796 * var(--circumference));
    stroke-dashoffset: calc(-0.04 * var(--circumference));
    animation: dash 1.5s ease-in-out infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes dash {
    0% {
      stroke-dasharray: calc(0.008 * var(--circumference)), calc(1.194 * var(--circumference));
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: calc(0.716 * var(--circumference)), calc(1.194 * var(--circumference));
      stroke-dashoffset: calc(-0.278 * var(--circumference));
    }
    100% {
      stroke-dasharray: calc(0.716 * var(--circumference)), calc(1.194 * var(--circumference));
      stroke-dashoffset: calc(-0.987 * var(--circumference));
    }
  }
`;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.DVA7QY5T.js
var WaSpinner = class extends WebAwesomeElement {
  constructor() {
    super(...arguments);
    this.localize = new LocalizeController2(this);
  }
  render() {
    return b2`
      <svg
        part="base spinner"
        role="progressbar"
        aria-label=${this.localize.term("loading")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle class="track" />
        <circle class="indicator" />
      </svg>
    `;
  }
};
WaSpinner.css = spinner_styles_default;
WaSpinner = __decorateClass([
  t3("wa-spinner")
], WaSpinner);

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.YDQCS2HK.js
var WaErrorEvent = class extends Event {
  constructor() {
    super("wa-error", { bubbles: true, cancelable: false, composed: true });
  }
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.WDIIGUNP.js
var WaLoadEvent = class extends Event {
  constructor() {
    super("wa-load", { bubbles: true, cancelable: false, composed: true });
  }
};

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.O74G5RVH.js
var icon_styles_default = i`
  :host {
    --primary-color: currentColor;
    --primary-opacity: 1;
    --secondary-color: currentColor;
    --secondary-opacity: 0.4;
    --rotate-angle: 0deg;

    box-sizing: content-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: -0.125em;
  }

  /* #region Canvas — the box the icon is centered within (mirrors Font Awesome's icon canvas). Orthogonal to font-size. */

  /* Fixed width (default): 1.25em × 1em (20 × 16px) */
  :host(:not([canvas])),
  :host([canvas='fixed']) {
    width: 1.25em;
    height: 1em;
    min-width: 1.25em; /* <-- this is what Safari respects for intrinsic */
    min-height: 1em;
  }

  /* Auto: hug the icon's width. \`auto-width\` is the deprecated alias for canvas="auto". */
  :host([canvas='auto']),
  :host([auto-width]:not([canvas])) {
    width: auto;
    height: 1em;
  }

  /* Square: 1.25em × 1.25em (20 × 20px) */
  :host([canvas='square']) {
    width: 1.25em;
    height: 1.25em;
    min-width: 1.25em;
    min-height: 1.25em;
  }

  /* Roomy: 1.5em × 1.5em (24 × 24px) */
  :host([canvas='roomy']) {
    width: 1.5em;
    height: 1.5em;
    min-width: 1.5em;
    min-height: 1.5em;
  }

  /* #endregion */

  svg {
    /* NOTE: Avoid setting fill here. A stylesheet rule beats SVG presentation attributes, breaking stroke-based
       libraries like Lucide (fill="none" stroke="currentColor") and attribute-based mutators (issue #1733). The default
       library applies fill="currentColor" in its mutator instead. */
    height: 1em;
    overflow: visible;
    width: auto;

    /* Duotone colors with path-specific opacity fallback */
    path[data-duotone-primary] {
      color: var(--primary-color);
      opacity: var(--path-opacity, var(--primary-opacity));
    }

    path[data-duotone-secondary] {
      color: var(--secondary-color);
      opacity: var(--path-opacity, var(--secondary-opacity));
    }
  }

  /* Rotation */
  :host([rotate]) {
    transform: rotate(var(--rotate-angle, 0deg));
  }

  /* Flipping */
  :host([flip='x']) {
    transform: scaleX(-1);
  }
  :host([flip='y']) {
    transform: scaleY(-1);
  }
  :host([flip='both']) {
    transform: scale(-1, -1);
  }

  /* Rotation and Flipping combined */
  :host([rotate][flip='x']) {
    transform: rotate(var(--rotate-angle, 0deg)) scaleX(-1);
  }
  :host([rotate][flip='y']) {
    transform: rotate(var(--rotate-angle, 0deg)) scaleY(-1);
  }
  :host([rotate][flip='both']) {
    transform: rotate(var(--rotate-angle, 0deg)) scale(-1, -1);
  }

  /* #region Animations — ported from Font Awesome 7.3 (--fa-* props mapped to wa-icon's --* names) */

  :host([animation='beat']) {
    animation-name: beat;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='bounce']) {
    animation-name: bounce;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, cubic-bezier(0.28, 0.84, 0.42, 1));
  }

  :host([animation='fade']) {
    animation-name: fade;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='beat-fade']) {
    animation-name: beat-fade;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='flip']) {
    animation-name: flip;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1.5s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='flip-360']) {
    animation-name: flip-360;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='shake']) {
    animation-name: shake;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 0.75s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='spin']) {
    animation-name: spin;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 2s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='spin-pulse']) {
    animation-name: spin;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, steps(8));
  }

  /* spin-reverse is FA's reverse modifier expressed as a standalone value; reverse any spin via --animation-direction: reverse */
  :host([animation='spin-reverse']) {
    animation-name: spin;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, reverse);
    animation-duration: var(--animation-duration, 2s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='spin-snap']) {
    animation-name: spin-snap;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 3s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='spin-snap-4']) {
    animation-name: spin-snap-4;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 2.4s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='spin-snap-8']) {
    animation-name: spin-snap-8;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 4s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='buzz']) {
    animation-name: buzz;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 0.6s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='wag']) {
    animation-name: wag;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 0.9s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-out);
    transform-origin: bottom center;
  }

  :host([animation='float']) {
    animation-name: float;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 3s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
    will-change: transform;
  }

  :host([animation='swing']) {
    animation-name: swing;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1.2s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-out);
    transform-origin: top center;
  }

  :host([animation='jello']) {
    animation-name: jello;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 0.9s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-out);
  }

  @media (prefers-reduced-motion: reduce) {
    :host([animation='beat']),
    :host([animation='bounce']),
    :host([animation='fade']),
    :host([animation='beat-fade']),
    :host([animation='flip']),
    :host([animation='flip-360']),
    :host([animation='shake']),
    :host([animation='spin']),
    :host([animation='spin-pulse']),
    :host([animation='spin-reverse']),
    :host([animation='spin-snap']),
    :host([animation='spin-snap-4']),
    :host([animation='spin-snap-8']),
    :host([animation='buzz']),
    :host([animation='wag']),
    :host([animation='float']),
    :host([animation='swing']),
    :host([animation='jello']) {
      animation: none !important;
      transition: none !important;
    }
  }

  /* #endregion */

  /* #region Keyframes — ported verbatim from Font Awesome 7.3 */

  @keyframes beat {
    0% {
      transform: scale(1);
    }
    25% {
      transform: scale(calc(1.25 * var(--beat-scale, 1.25)));
    }
    45% {
      transform: scale(calc(1.22 * var(--beat-scale, 1.22)));
    }
    65% {
      transform: scale(calc(1.25 * var(--beat-scale, 1.25)));
    }
    90% {
      transform: scale(1);
    }
  }

  @keyframes bounce {
    0% {
      transform: scale(1, 1) translateY(0);
      /* No fallback by design (ported from FA 7.3): the first segment uses the user's --animation-timing or the CSS
         initial ease, while the explicit cubic-beziers on later stops drive the bounce physics. */
      animation-timing-function: var(--animation-timing);
    }
    14% {
      transform: scale(var(--bounce-start-scale-x, 1.06), var(--bounce-start-scale-y, 0.94))
        translateY(var(--bounce-anticipation, 3px));
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
    }
    32% {
      transform: scale(var(--bounce-jump-scale-x, 0.94), var(--bounce-jump-scale-y, 1.12))
        translateY(calc(-1 * var(--bounce-height, 0.5em)));
      animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
    }
    52% {
      transform: scale(1, 1) translateY(calc(-1 * var(--bounce-height, 0.5em) * 1.1));
      animation-timing-function: cubic-bezier(0.5, 0, 1, 0.5);
    }
    70% {
      transform: scale(var(--bounce-land-scale-x, 1.06), var(--bounce-land-scale-y, 0.92)) translateY(0);
      animation-timing-function: cubic-bezier(0.33, 0.33, 0.66, 1);
    }
    85% {
      transform: scale(0.98, 1.04) translateY(calc(-2px * var(--bounce-rebound, 1)));
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
    }
    100% {
      transform: scale(1, 1) translateY(0);
    }
  }

  @keyframes fade {
    0% {
      opacity: 1;
      transform: scale(1);
      animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
    }
    40% {
      opacity: var(--fade-opacity, 0.4);
      transform: scale(0.98);
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes beat-fade {
    0% {
      opacity: var(--beat-fade-opacity, 0.4);
      transform: scale(1);
      animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
    }
    25% {
      opacity: calc(var(--beat-fade-opacity, 0.4) + 0.4);
      transform: scale(var(--beat-fade-scale, 1.28));
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    45% {
      opacity: 1;
      transform: scale(var(--beat-fade-scale, 1.25));
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    65% {
      opacity: calc(var(--beat-fade-opacity, 0.4) + 0.4);
      transform: scale(var(--beat-fade-scale, 1.28));
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    100% {
      opacity: var(--beat-fade-opacity, 0.4);
      transform: scale(1);
    }
  }

  @keyframes flip {
    0% {
      transform: perspective(2em) scale(1) rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), 0deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
    }
    8% {
      transform: perspective(2em) scale(var(--flip-anticipation-scale, 0.95))
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), 0deg);
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
    }
    35% {
      transform: perspective(2em) scale(1)
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), calc(var(--flip-angle, -360deg) * 0.6));
      animation-timing-function: linear;
    }
    65% {
      transform: perspective(2em) scale(1)
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), calc(var(--flip-angle, -360deg) * 0.5));
      animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
    }
    92% {
      transform: perspective(2em) scale(1)
        rotate3d(
          var(--flip-x, 0),
          var(--flip-y, 1),
          var(--flip-z, 0),
          calc(var(--flip-angle, -360deg) * var(--flip-overshoot, 1.04))
        );
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
    }
    100% {
      transform: perspective(2em) scale(1)
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), var(--flip-angle, -360deg));
    }
  }

  @keyframes flip-360 {
    0% {
      transform: perspective(2em) scale(1) rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), 0deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
    }
    8% {
      transform: perspective(2em) scale(var(--flip-anticipation-scale, 0.95))
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), 0deg);
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
    }
    50% {
      transform: perspective(2em) scale(1)
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), calc(var(--flip-angle, -360deg) * 0.6));
      animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
    }
    80% {
      transform: perspective(2em) scale(1)
        rotate3d(
          var(--flip-x, 0),
          var(--flip-y, 1),
          var(--flip-z, 0),
          calc(var(--flip-angle, -360deg) * var(--flip-overshoot, 1.04))
        );
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
    }
    100% {
      transform: perspective(2em) scale(1)
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), var(--flip-angle, -360deg));
    }
  }

  @keyframes shake {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.8, 1);
    }
    8% {
      transform: rotate(35deg) translateX(1px);
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    20% {
      transform: rotate(-22deg) translateX(-1px);
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    35% {
      transform: rotate(15deg) translateX(1px);
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    50% {
      transform: rotate(-9deg);
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    65% {
      transform: rotate(5deg);
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    78% {
      transform: rotate(-3deg);
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    90% {
      transform: rotate(1deg);
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    100% {
      transform: rotate(0deg);
    }
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes spin-snap {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    12% {
      transform: rotate(60deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    16.67% {
      transform: rotate(60deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    28.67% {
      transform: rotate(120deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    33.33% {
      transform: rotate(120deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    45.33% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    50% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    62% {
      transform: rotate(240deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    66.67% {
      transform: rotate(240deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    78.67% {
      transform: rotate(300deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    83.33% {
      transform: rotate(300deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    95.33% {
      transform: rotate(360deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes spin-snap-4 {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    15% {
      transform: rotate(90deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    25% {
      transform: rotate(90deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    40% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    50% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    65% {
      transform: rotate(270deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    75% {
      transform: rotate(270deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    90% {
      transform: rotate(360deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes spin-snap-8 {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    9% {
      transform: rotate(45deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    12.5% {
      transform: rotate(45deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    21.5% {
      transform: rotate(90deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    25% {
      transform: rotate(90deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    34% {
      transform: rotate(135deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    37.5% {
      transform: rotate(135deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    46.5% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    50% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    59% {
      transform: rotate(225deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    62.5% {
      transform: rotate(225deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    71.5% {
      transform: rotate(270deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    75% {
      transform: rotate(270deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    84% {
      transform: rotate(315deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    87.5% {
      transform: rotate(315deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    96.5% {
      transform: rotate(360deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes buzz {
    0% {
      transform: translateX(0) rotate(0deg);
      animation-timing-function: cubic-bezier(0.1, 0, 0.9, 1);
    }
    5% {
      transform: translateX(var(--buzz-distance, 4px)) rotate(0.5deg);
    }
    10% {
      transform: translateX(calc(-1 * var(--buzz-distance, 4px))) rotate(-0.5deg);
    }
    15% {
      transform: translateX(var(--buzz-distance, 4px)) rotate(0.3deg);
    }
    20% {
      transform: translateX(calc(-1 * var(--buzz-distance, 4px))) rotate(-0.3deg);
    }
    25% {
      transform: translateX(calc(var(--buzz-distance, 4px) * 0.7)) rotate(0.2deg);
    }
    30% {
      transform: translateX(calc(-1 * var(--buzz-distance, 4px) * 0.7)) rotate(-0.2deg);
    }
    35% {
      transform: translateX(calc(var(--buzz-distance, 4px) * 0.4)) rotate(0.1deg);
    }
    40% {
      transform: translateX(0) rotate(0deg);
    }
    100% {
      transform: translateX(0) rotate(0deg);
    }
  }

  @keyframes wag {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.6, 1);
    }
    12% {
      transform: rotate(var(--wag-angle, 12deg));
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    24% {
      transform: rotate(2deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.6, 1);
    }
    36% {
      transform: rotate(calc(var(--wag-angle, 12deg) * 0.85));
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    48% {
      transform: rotate(1deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.6, 1);
    }
    58% {
      transform: rotate(calc(var(--wag-angle, 12deg) * 0.6));
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    68% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(0deg);
    }
  }

  @keyframes float {
    0% {
      transform: translateY(0) translateX(0) rotate(0deg)
        scale(var(--float-squash-x, 1.02), var(--float-squash-y, 0.98));
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
    }
    15% {
      transform: translateY(calc(-0.4 * var(--float-height, 6px))) translateX(var(--float-drift, 1px))
        rotate(var(--float-tilt, 1deg)) scale(1, 1);
      animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
    }
    35% {
      transform: translateY(calc(-1 * var(--float-height, 6px))) translateX(0) rotate(0deg)
        scale(var(--float-stretch-x, 0.98), var(--float-stretch-y, 1.03));
      animation-timing-function: cubic-bezier(0.5, 0, 0.5, 0);
    }
    50% {
      transform: translateY(calc(-0.92 * var(--float-height, 6px))) translateX(calc(-0.5 * var(--float-drift, 1px)))
        rotate(calc(-0.5 * var(--float-tilt, 1deg))) scale(0.995, 1.01);
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
    }
    70% {
      transform: translateY(calc(-0.3 * var(--float-height, 6px))) translateX(calc(-1 * var(--float-drift, 1px)))
        rotate(calc(-1 * var(--float-tilt, 1deg))) scale(1, 1);
      animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
    }
    90% {
      transform: translateY(calc(0.05 * var(--float-height, 6px))) translateX(0) rotate(0deg)
        scale(var(--float-squash-x, 1.02), var(--float-squash-y, 0.98));
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
    }
    100% {
      transform: translateY(0) translateX(0) rotate(0deg)
        scale(var(--float-squash-x, 1.02), var(--float-squash-y, 0.98));
    }
  }

  @keyframes swing {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.8, 1);
    }
    8% {
      transform: rotate(var(--swing-angle, 22deg));
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    18% {
      transform: rotate(calc(-1 * var(--swing-angle, 22deg) * 0.85));
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    28% {
      transform: rotate(calc(var(--swing-angle, 22deg) * 0.65));
      animation-timing-function: cubic-bezier(0.35, 0, 0.65, 1);
    }
    38% {
      transform: rotate(calc(-1 * var(--swing-angle, 22deg) * 0.45));
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    48% {
      transform: rotate(calc(var(--swing-angle, 22deg) * 0.25));
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    56% {
      transform: rotate(calc(-1 * var(--swing-angle, 22deg) * 0.1));
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    64% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(0deg);
    }
  }

  @keyframes jello {
    0% {
      transform: scale(1, 1);
      animation-timing-function: cubic-bezier(0.2, 0, 0.8, 1);
    }
    12% {
      transform: scale(var(--jello-scale-x, 1.15), calc(2 - var(--jello-scale-x, 1.15)));
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    24% {
      transform: scale(calc(2 - var(--jello-scale-y, 1.12)), var(--jello-scale-y, 1.12));
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    36% {
      transform: scale(
        calc(1 + (var(--jello-scale-x, 1.15) - 1) * 0.5),
        calc(2 - (1 + (var(--jello-scale-x, 1.15) - 1) * 0.5))
      );
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    48% {
      transform: scale(
        calc(2 - (1 + (var(--jello-scale-y, 1.12) - 1) * 0.3)),
        calc(1 + (var(--jello-scale-y, 1.12) - 1) * 0.3)
      );
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    58% {
      transform: scale(1.02, 0.98);
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    68% {
      transform: scale(1, 1);
    }
    100% {
      transform: scale(1, 1);
    }
  }

  /* #endregion */
`;

// node_modules/lit-html/directive-helpers.js
var { I: t5 } = j;
var l4 = (o9, t6) => void 0 === t6 ? void 0 !== o9?._$litType$ : o9?._$litType$ === t6;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.AL6UNYSC.js
var CACHEABLE_ERROR = /* @__PURE__ */ Symbol();
var RETRYABLE_ERROR = /* @__PURE__ */ Symbol();
var parser;
var iconCache = /* @__PURE__ */ new Map();
var WaIcon = class extends WebAwesomeElement {
  constructor() {
    super(...arguments);
    this.svg = null;
    this.autoWidth = false;
    this.swapOpacity = false;
    this.label = "";
    this.library = "default";
    this.rotate = 0;
    this.resolveIcon = async (url, library2) => {
      let fileData;
      if (library2?.spriteSheet) {
        if (!this.hasUpdated) {
          await this.updateComplete;
        }
        this.svg = b2`<svg part="svg">
        <use part="use" href="${url}"></use>
      </svg>`;
        await this.updateComplete;
        const svg = this.shadowRoot.querySelector("[part='svg']");
        if (typeof library2.mutator === "function") {
          library2.mutator(svg, this);
        }
        return this.svg;
      }
      try {
        fileData = await fetch(url, { mode: "cors" });
        if (!fileData.ok) return fileData.status === 410 ? CACHEABLE_ERROR : RETRYABLE_ERROR;
      } catch {
        return RETRYABLE_ERROR;
      }
      try {
        const div = document.createElement("div");
        div.innerHTML = await fileData.text();
        const svg = div.firstElementChild;
        if (svg?.tagName?.toLowerCase() !== "svg") return CACHEABLE_ERROR;
        if (!parser) parser = new DOMParser();
        const doc = parser.parseFromString(svg.outerHTML, "text/html");
        const svgEl = doc.body.querySelector("svg");
        if (!svgEl) return CACHEABLE_ERROR;
        svgEl.part.add("svg");
        return document.adoptNode(svgEl);
      } catch {
        return CACHEABLE_ERROR;
      }
    };
  }
  connectedCallback() {
    super.connectedCallback();
    watchIcon(this);
  }
  firstUpdated(changedProperties) {
    super.firstUpdated(changedProperties);
    if (this.hasAttribute("rotate")) {
      this.style.setProperty("--rotate-angle", `${this.rotate}deg`);
    }
    this.setIcon();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    unwatchIcon(this);
  }
  async getIconSource() {
    const library2 = getIconLibrary(this.library);
    const family = this.family || getDefaultIconFamily();
    if (this.name && library2) {
      const autoWidth = this.canvas === "auto" || this.autoWidth;
      let url;
      try {
        url = await library2.resolver(this.name, family, this.variant, autoWidth);
      } catch {
        url = void 0;
      }
      return { url, fromLibrary: true };
    }
    return {
      url: this.src,
      fromLibrary: false
    };
  }
  handleLabelChange() {
    const hasLabel = typeof this.label === "string" && this.label.length > 0;
    if (hasLabel) {
      this.setAttribute("role", "img");
      this.setAttribute("aria-label", this.label);
      this.removeAttribute("aria-hidden");
    } else {
      this.removeAttribute("role");
      this.removeAttribute("aria-label");
      this.setAttribute("aria-hidden", "true");
    }
  }
  async setIcon() {
    const { url, fromLibrary } = await this.getIconSource();
    const library2 = fromLibrary ? getIconLibrary(this.library) : void 0;
    if (!url) {
      this.svg = null;
      return;
    }
    let iconResolver = iconCache.get(url);
    if (!iconResolver) {
      iconResolver = this.resolveIcon(url, library2);
      iconCache.set(url, iconResolver);
    }
    const svg = await iconResolver;
    if (svg === RETRYABLE_ERROR) {
      iconCache.delete(url);
    }
    const sourceAfterFetch = await this.getIconSource();
    if (url !== sourceAfterFetch.url) {
      return;
    }
    if (l4(svg)) {
      this.svg = svg;
      return;
    }
    switch (svg) {
      case RETRYABLE_ERROR:
      case CACHEABLE_ERROR:
        this.svg = null;
        this.dispatchEvent(new WaErrorEvent());
        break;
      default:
        this.svg = svg.cloneNode(true);
        library2?.mutator?.(this.svg, this);
        this.dispatchEvent(new WaLoadEvent());
    }
  }
  willUpdate(changedProperties) {
    if (!this.style) {
      this.setStyleProperty("--rotate-angle", `${this.rotate}deg`);
    }
    return super.willUpdate(changedProperties);
  }
  updated(changedProperties) {
    super.updated(changedProperties);
    const library2 = getIconLibrary(this.library);
    if (this.hasAttribute("rotate")) {
      this.style.setProperty("--rotate-angle", `${this.rotate}deg`);
    }
    const svg = this.shadowRoot?.querySelector("svg");
    if (svg) {
      library2?.mutator?.(svg, this);
    }
  }
  render() {
    if (this.hasUpdated) {
      return this.svg;
    }
    return b2`<svg part="svg" width="16" height="16" viewBox="0 0 16 16"></svg>`;
  }
};
WaIcon.css = icon_styles_default;
__decorateClass([
  r5()
], WaIcon.prototype, "svg", 2);
__decorateClass([
  n4({ reflect: true })
], WaIcon.prototype, "name", 2);
__decorateClass([
  n4({ reflect: true })
], WaIcon.prototype, "family", 2);
__decorateClass([
  n4({ reflect: true })
], WaIcon.prototype, "variant", 2);
__decorateClass([
  n4({ reflect: true })
], WaIcon.prototype, "canvas", 2);
__decorateClass([
  n4({ attribute: "auto-width", type: Boolean, reflect: true })
], WaIcon.prototype, "autoWidth", 2);
__decorateClass([
  n4({ attribute: "swap-opacity", type: Boolean, reflect: true })
], WaIcon.prototype, "swapOpacity", 2);
__decorateClass([
  n4()
], WaIcon.prototype, "src", 2);
__decorateClass([
  n4()
], WaIcon.prototype, "label", 2);
__decorateClass([
  n4({ reflect: true })
], WaIcon.prototype, "library", 2);
__decorateClass([
  n4({ type: Number, reflect: true })
], WaIcon.prototype, "rotate", 2);
__decorateClass([
  n4({ type: String, reflect: true })
], WaIcon.prototype, "flip", 2);
__decorateClass([
  n4({ type: String, reflect: true })
], WaIcon.prototype, "animation", 2);
__decorateClass([
  watch("label")
], WaIcon.prototype, "handleLabelChange", 1);
__decorateClass([
  watch(["family", "name", "library", "variant", "src", "autoWidth", "canvas", "swapOpacity"], {
    waitUntilFirstUpdate: true
  })
], WaIcon.prototype, "setIcon", 1);
WaIcon = __decorateClass([
  t3("wa-icon")
], WaIcon);

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.LVP7MDLV.js
var drawer_styles_default = i`
  :host {
    --size: 25rem;
    --spacing: var(--wa-space-l);
    --backdrop-filter: none;
    --show-duration: var(--wa-transition-normal);
    --hide-duration: var(--wa-transition-normal);

    display: none;
  }

  :host([open]) {
    display: block;
  }

  .drawer {
    display: flex;
    flex-direction: column;
    top: 0;
    inset-inline-start: 0;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    overflow: hidden;
    color: inherit;
    background-color: var(--wa-color-surface-raised);
    border: none;
    box-shadow: var(--wa-shadow-l);
    overflow: auto;
    padding: 0;
    margin: 0;
    animation-duration: var(--show-duration);
    animation-timing-function: ease;

    &.show::backdrop {
      animation: show-backdrop var(--show-duration, 200ms) ease;
    }

    &.hide::backdrop {
      animation: show-backdrop var(--hide-duration, 200ms) ease reverse;
    }

    &.show.top {
      animation: show-drawer-from-top var(--show-duration) ease;
    }

    &.hide.top {
      animation: show-drawer-from-top var(--hide-duration) ease reverse;
    }

    &.show.end {
      animation: show-drawer-from-end var(--show-duration) ease;

      &:dir(rtl) {
        animation-name: show-drawer-from-start;
      }
    }

    &.hide.end {
      animation: show-drawer-from-end var(--hide-duration) ease reverse;

      &:dir(rtl) {
        animation-name: show-drawer-from-start;
      }
    }

    &.show.bottom {
      animation: show-drawer-from-bottom var(--show-duration) ease;
    }

    &.hide.bottom {
      animation: show-drawer-from-bottom var(--hide-duration) ease reverse;
    }

    &.show.start {
      animation: show-drawer-from-start var(--show-duration) ease;

      &:dir(rtl) {
        animation-name: show-drawer-from-end;
      }
    }

    &.hide.start {
      animation: show-drawer-from-start var(--hide-duration) ease reverse;

      &:dir(rtl) {
        animation-name: show-drawer-from-end;
      }
    }

    &.pulse {
      animation: pulse 250ms ease;
    }
  }

  .drawer:focus {
    outline: none;
  }

  .top {
    top: 0;
    inset-inline-end: auto;
    bottom: auto;
    inset-inline-start: 0;
    width: 100%;
    height: var(--size);
  }

  .end {
    top: 0;
    inset-inline-end: 0;
    bottom: auto;
    inset-inline-start: auto;
    width: var(--size);
    height: 100%;
  }

  .bottom {
    top: auto;
    inset-inline-end: auto;
    bottom: 0;
    inset-inline-start: 0;
    width: 100%;
    height: var(--size);
  }

  .start {
    top: 0;
    inset-inline-end: auto;
    bottom: auto;
    inset-inline-start: 0;
    width: var(--size);
    height: 100%;
  }

  .header {
    display: flex;
    flex-wrap: nowrap;
    padding-inline-start: var(--spacing);
    padding-block-end: 0;

    /* Subtract the close button's padding so that the X is visually aligned with the edges of the dialog content */
    padding-inline-end: calc(var(--spacing) - var(--wa-form-control-padding-block));
    padding-block-start: calc(var(--spacing) - var(--wa-form-control-padding-block));
  }

  .title {
    align-self: center;
    flex: 1 1 auto;
    font: inherit;
    font-size: var(--wa-font-size-l);
    font-weight: var(--wa-font-weight-heading);
    line-height: var(--wa-line-height-condensed);
    margin: 0;
  }

  .header-actions {
    align-self: start;
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: end;
    gap: var(--wa-space-2xs);
    padding-inline-start: var(--spacing);
  }

  .header-actions wa-button,
  .header-actions ::slotted(wa-button) {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .body {
    flex: 1 1 auto;
    display: block;
    padding: var(--spacing);
    overflow: auto;
    -webkit-overflow-scrolling: touch;

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: var(--wa-focus-ring);
      outline-offset: var(--wa-focus-ring-offset);
    }
  }

  .footer {
    display: flex;
    flex-wrap: wrap;
    gap: var(--wa-space-xs);
    justify-content: end;
    padding: var(--spacing);
    padding-block-start: 0;
  }

  .footer ::slotted(wa-button:not(:last-of-type)) {
    margin-inline-end: var(--wa-spacing-xs);
  }

  .drawer::backdrop {
    /*
        NOTE: the ::backdrop element doesn't inherit properly in Safari yet, but it will in 17.4! At that time, we can
        remove the fallback values here.
      */
    background-color: var(--wa-color-overlay-modal, rgb(0 0 0 / 0.25));
    backdrop-filter: var(--backdrop-filter);
  }

  @keyframes pulse {
    0% {
      scale: 1;
    }
    50% {
      scale: 1.01;
    }
    100% {
      scale: 1;
    }
  }

  @keyframes show-drawer {
    from {
      opacity: 0;
      scale: 0.8;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }

  @keyframes show-drawer-from-top {
    from {
      opacity: 0;
      translate: 0 -100%;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes show-drawer-from-end {
    from {
      opacity: 0;
      translate: 100%;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes show-drawer-from-bottom {
    from {
      opacity: 0;
      translate: 0 100%;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes show-drawer-from-start {
    from {
      opacity: 0;
      translate: -100% 0;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes show-backdrop {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (forced-colors: active) {
    .drawer {
      border: solid 1px white;
    }
  }
`;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.FZB65VHZ.js
var WaDrawer = class extends WebAwesomeElement {
  constructor() {
    super(...arguments);
    this.localize = new LocalizeController2(this);
    this.hasSlotController = new HasSlotController(this, "footer", "header-actions", "label");
    this.renderedWatcher = new RenderedWatcher(this, (isRendered) => this.handleRenderedChange(isRendered));
    this.open = false;
    this.label = "";
    this.placement = "end";
    this.withoutHeader = false;
    this.lightDismiss = false;
    this.withFooter = false;
    this.handleDocumentKeyDown = (event) => {
      if (event.key === "Escape" && this.open && isTopDismissible(this)) {
        event.preventDefault();
        event.stopPropagation();
        this.requestClose(this.drawer);
      }
    };
  }
  firstUpdated(changedProperties) {
    super.firstUpdated(changedProperties);
    if (this.open) {
      this.addOpenListeners();
      this.drawer.showModal();
      lockBodyScrolling(this);
      this.renderedWatcher.start(this.drawer);
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.renderedWatcher.stop();
    unlockBodyScrolling(this);
    this.removeOpenListeners();
  }
  async requestClose(source) {
    const waHideEvent = new WaHideEvent({ source });
    this.dispatchEvent(waHideEvent);
    if (waHideEvent.defaultPrevented) {
      this.open = true;
      animateWithClass(this.drawer, "pulse");
      return;
    }
    this.removeOpenListeners();
    await animateWithClass(this.drawer, "hide");
    this.open = false;
    this.drawer.close();
    unlockBodyScrolling(this);
    this.renderedWatcher.stop();
    const trigger = this.originalTrigger;
    if (typeof trigger?.focus === "function") {
      setTimeout(() => trigger.focus());
    }
    this.dispatchEvent(new WaAfterHideEvent());
  }
  addOpenListeners() {
    document.addEventListener("keydown", this.handleDocumentKeyDown);
    registerDismissible(this);
  }
  removeOpenListeners() {
    document.removeEventListener("keydown", this.handleDocumentKeyDown);
    unregisterDismissible(this);
  }
  handleDialogCancel(event) {
    event.preventDefault();
    if (!this.drawer.classList.contains("hide") && event.target === this.drawer && isTopDismissible(this)) {
      this.requestClose(this.drawer);
    }
  }
  handleDialogClick(event) {
    const target = event.target;
    const button = target.closest('[data-drawer="close"]');
    if (button) {
      event.stopPropagation();
      this.requestClose(button);
    }
  }
  async handleDialogPointerDown(event) {
    if (event.target === this.drawer) {
      if (this.lightDismiss) {
        this.requestClose(this.drawer);
      } else {
        await animateWithClass(this.drawer, "pulse");
      }
    }
  }
  /**
   * Suspends the modal when third-party CSS (e.g. cookie banner blockers) hides an open drawer, so the page isn't
   * left scroll locked and inert. "open" stays true so the modal resumes if the drawer is rendered again.
   */
  handleRenderedChange(isRendered) {
    if (!this.open) {
      this.renderedWatcher.stop();
      return;
    }
    if (!isRendered && this.drawer.open) {
      this.removeOpenListeners();
      this.drawer.close();
      unlockBodyScrolling(this);
    } else if (isRendered && !this.drawer.open) {
      this.addOpenListeners();
      this.drawer.showModal();
      lockBodyScrolling(this);
    }
  }
  handleOpenChange() {
    if (this.open && !this.drawer.open) {
      this.show();
    } else if (this.drawer.open) {
      this.open = true;
      this.requestClose(this.drawer);
    } else if (!this.open) {
      this.renderedWatcher.stop();
    }
  }
  /** Shows the drawer. */
  async show() {
    const waShowEvent = new WaShowEvent();
    this.dispatchEvent(waShowEvent);
    if (waShowEvent.defaultPrevented) {
      this.open = false;
      return;
    }
    this.addOpenListeners();
    this.originalTrigger = document.activeElement;
    this.open = true;
    this.drawer.showModal();
    lockBodyScrolling(this);
    this.renderedWatcher.start(this.drawer);
    requestAnimationFrame(() => {
      const elementToFocus = this.querySelector("[autofocus]");
      if (elementToFocus && typeof elementToFocus.focus === "function") {
        elementToFocus.focus();
      } else {
        this.drawer.focus();
      }
    });
    await animateWithClass(this.drawer, "show");
    this.dispatchEvent(new WaAfterShowEvent());
  }
  render() {
    const hasHeader = !this.withoutHeader;
    const hasFooter = this.hasSlotController.test("footer", "withFooter");
    return b2`
      <dialog
        part="dialog"
        class=${e7({
      drawer: true,
      open: this.open,
      top: this.placement === "top",
      end: this.placement === "end",
      bottom: this.placement === "bottom",
      start: this.placement === "start"
    })}
        @cancel=${this.handleDialogCancel}
        @click=${this.handleDialogClick}
        @pointerdown=${this.handleDialogPointerDown}
      >
        ${hasHeader ? b2`
              <div part="header" class="header">
                <h2 part="title" class="title" id="title">
                  <!-- If there's no label, use an invisible character to prevent the header from collapsing -->
                  <slot name="label"> ${this.label.length > 0 ? this.label : String.fromCharCode(8203)} </slot>
                </h2>
                <div part="header-actions" class="header-actions">
                  <slot name="header-actions"></slot>
                  <wa-button
                    part="close-button"
                    exportparts="base:close-button__base"
                    class="close"
                    appearance="plain"
                    @click="${(event) => this.requestClose(event.target)}"
                  >
                    <wa-icon
                      name="xmark"
                      label=${this.localize.term("close")}
                      library="system"
                      variant="solid"
                    ></wa-icon>
                  </wa-button>
                </div>
              </div>
            ` : ""}

        <div part="body" class="body"><slot></slot></div>

        <div part="footer" class="footer" ?hidden=${!hasFooter}>
          <slot name="footer"></slot>
        </div>
      </dialog>
    `;
  }
};
WaDrawer.css = drawer_styles_default;
__decorateClass([
  e5(".drawer")
], WaDrawer.prototype, "drawer", 2);
__decorateClass([
  n4({ type: Boolean, reflect: true })
], WaDrawer.prototype, "open", 2);
__decorateClass([
  n4({ reflect: true })
], WaDrawer.prototype, "label", 2);
__decorateClass([
  n4({ reflect: true })
], WaDrawer.prototype, "placement", 2);
__decorateClass([
  n4({ attribute: "without-header", type: Boolean, reflect: true })
], WaDrawer.prototype, "withoutHeader", 2);
__decorateClass([
  n4({ attribute: "light-dismiss", type: Boolean })
], WaDrawer.prototype, "lightDismiss", 2);
__decorateClass([
  n4({ attribute: "with-footer", type: Boolean })
], WaDrawer.prototype, "withFooter", 2);
__decorateClass([
  watch("open", { waitUntilFirstUpdate: true })
], WaDrawer.prototype, "handleOpenChange", 1);
WaDrawer = __decorateClass([
  t3("wa-drawer")
], WaDrawer);
if (!o5) {
  document.addEventListener("click", (event) => {
    const drawerAttrEl = event.target.closest("[data-drawer]");
    if (drawerAttrEl instanceof Element) {
      const [command, id] = parseSpaceDelimitedTokens(drawerAttrEl.getAttribute("data-drawer") || "");
      if (command === "open" && id?.length) {
        const doc = drawerAttrEl.getRootNode();
        const drawer = doc.getElementById(id);
        if (drawer?.localName === "wa-drawer") {
          drawer.open = true;
        } else {
          console.warn(`A drawer with an ID of "${id}" could not be found in this document.`);
        }
      }
    }
  });
  document.addEventListener("pointerdown", () => {
  });
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.DJLBC7Q4.js
var tooltip_styles_default = i`
  :host {
    --max-width: 30ch;

    /** These styles are added so we don't interfere in the DOM. */
    display: inline-block;
    position: absolute;

    /** Defaults for inherited CSS properties */
    color: var(--wa-tooltip-content-color);
    font-size: var(--wa-tooltip-font-size);
    line-height: var(--wa-tooltip-line-height);
    text-align: start;
    white-space: normal;
  }

  .tooltip {
    --arrow-size: var(--wa-tooltip-arrow-size);
    --arrow-color: var(--wa-tooltip-background-color);
  }

  .tooltip::part(popup) {
    z-index: 1000;
  }

  .tooltip[placement^='top']::part(popup) {
    transform-origin: bottom;
  }

  .tooltip[placement^='bottom']::part(popup) {
    transform-origin: top;
  }

  .tooltip[placement^='left']::part(popup) {
    transform-origin: right;
  }

  .tooltip[placement^='right']::part(popup) {
    transform-origin: left;
  }

  .body {
    display: block;
    width: max-content;
    max-width: var(--max-width);
    border-radius: var(--wa-tooltip-border-radius);
    background-color: var(--wa-tooltip-background-color);
    border: var(--wa-tooltip-border-width) var(--wa-tooltip-border-style) var(--wa-tooltip-border-color);
    padding: 0.25em 0.5em;
    user-select: none;
    -webkit-user-select: none;
  }

  .tooltip {
    --popup-border-width: var(--wa-tooltip-border-width);

    /* Inset box-shadow, not a border: Safari seams a clip-path edge that runs along a border. */
    &::part(arrow) {
      box-shadow: inset calc(-1 * var(--wa-tooltip-border-width)) calc(-1 * var(--wa-tooltip-border-width)) 0 0
        var(--wa-tooltip-border-color);
    }
  }
`;

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.HS5AYC6E.js
var popup_styles_default = i`
  :host {
    --arrow-color: black;
    --arrow-size: var(--wa-tooltip-arrow-size);
    --popup-border-width: 0px;
    --show-duration: var(--wa-transition-fast);
    --hide-duration: var(--wa-transition-fast);

    /*
     * These properties are computed to account for the arrow's dimensions after being rotated 45º. The constant
     * 0.7071 is derived from sin(45) to calculate the length of the arrow after rotation.
     *
     * The diamond will be translated inward by --arrow-base-offset, the border thickness, to centralise it on
     * the inner edge of the popup border. This also means we need to increase the size of the arrow by the
     * same amount to compensate.
     *
     * A diamond shaped clipping mask is used to avoid overlap of popup content. This extends slightly inward so
     * the popup border is covered with no sub-pixel rounding artifacts. The diamond corners are mitred at 22.5º
     * to properly merge any arrow border with the popup border. The constant 1.4142 is derived from 1 + tan(22.5).
     *
     */
    --arrow-base-offset: var(--popup-border-width);
    --arrow-size-diagonal: calc((var(--arrow-size) + var(--arrow-base-offset)) * 0.7071);
    --arrow-padding-offset: calc(var(--arrow-size-diagonal) - var(--arrow-size));
    --arrow-size-div: calc(var(--arrow-size-diagonal) * 2);
    --arrow-clipping-corner: calc(var(--arrow-base-offset) * 1.4142);

    display: contents;
  }

  .popup {
    position: absolute;
    isolation: isolate;
    max-width: var(--auto-size-available-width, none);
    max-height: var(--auto-size-available-height, none);

    /* Clear UA styles for [popover] */
    :where(&) {
      inset: unset;
      padding: unset;
      margin: unset;
      width: unset;
      height: unset;
      color: unset;
      background: unset;
      border: unset;
      overflow: unset;
    }
  }

  .popup-fixed {
    position: fixed;
  }

  .popup:not(.popup-active) {
    display: none;
  }

  .arrow {
    position: absolute;
    width: var(--arrow-size-div);
    height: var(--arrow-size-div);
    background: var(--arrow-color);
    z-index: 3;
    clip-path: polygon(
      var(--arrow-clipping-corner) 100%,
      var(--arrow-base-offset) calc(100% - var(--arrow-base-offset)),
      calc(var(--arrow-base-offset) - 2px) calc(100% - var(--arrow-base-offset)),
      calc(100% - var(--arrow-base-offset)) calc(var(--arrow-base-offset) - 2px),
      calc(100% - var(--arrow-base-offset)) var(--arrow-base-offset),
      100% var(--arrow-clipping-corner),
      100% 100%
    );
    rotate: 45deg;
  }

  :host([data-current-placement|='left']) .arrow {
    rotate: -45deg;
  }

  :host([data-current-placement|='right']) .arrow {
    rotate: 135deg;
  }

  :host([data-current-placement|='bottom']) .arrow {
    rotate: 225deg;
  }

  /* Hover bridge */
  .popup-hover-bridge:not(.popup-hover-bridge-visible) {
    display: none;
  }

  .popup-hover-bridge {
    position: fixed;
    z-index: 899;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    clip-path: polygon(
      var(--hover-bridge-top-left-x, 0) var(--hover-bridge-top-left-y, 0),
      var(--hover-bridge-top-right-x, 0) var(--hover-bridge-top-right-y, 0),
      var(--hover-bridge-bottom-right-x, 0) var(--hover-bridge-bottom-right-y, 0),
      var(--hover-bridge-bottom-left-x, 0) var(--hover-bridge-bottom-left-y, 0)
    );
  }

  /* Built-in animations */
  .show {
    animation: show var(--show-duration) ease;
  }

  .hide {
    animation: show var(--hide-duration) ease reverse;
  }

  @keyframes show {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .show-with-scale {
    animation: show-with-scale var(--show-duration) ease;
  }

  .hide-with-scale {
    animation: show-with-scale var(--hide-duration) ease reverse;
  }

  @keyframes show-with-scale {
    from {
      opacity: 0;
      scale: 0.8;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }
`;

// node_modules/@floating-ui/utils/dist/floating-ui.utils.mjs
var min = Math.min;
var max = Math.max;
var round = Math.round;
var floor = Math.floor;
var createCoords = (v2) => ({
  x: v2,
  y: v2
});
var oppositeSideMap = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function clamp2(start, value, end) {
  return max(start, min(value, end));
}
function evaluate(value, param) {
  return typeof value === "function" ? value(param) : value;
}
function getSide(placement) {
  return placement.split("-")[0];
}
function getAlignment(placement) {
  return placement.split("-")[1];
}
function getOppositeAxis(axis) {
  return axis === "x" ? "y" : "x";
}
function getAxisLength(axis) {
  return axis === "y" ? "height" : "width";
}
function getSideAxis(placement) {
  const firstChar = placement[0];
  return firstChar === "t" || firstChar === "b" ? "y" : "x";
}
function getAlignmentAxis(placement) {
  return getOppositeAxis(getSideAxis(placement));
}
function getAlignmentSides(placement, rects, rtl) {
  if (rtl === void 0) {
    rtl = false;
  }
  const alignment = getAlignment(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const length = getAxisLength(alignmentAxis);
  let mainAlignmentSide = alignmentAxis === "x" ? alignment === (rtl ? "end" : "start") ? "right" : "left" : alignment === "start" ? "bottom" : "top";
  if (rects.reference[length] > rects.floating[length]) {
    mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
  }
  return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
}
function getExpandedPlacements(placement) {
  const oppositePlacement = getOppositePlacement(placement);
  return [getOppositeAlignmentPlacement(placement), oppositePlacement, getOppositeAlignmentPlacement(oppositePlacement)];
}
function getOppositeAlignmentPlacement(placement) {
  return placement.includes("start") ? placement.replace("start", "end") : placement.replace("end", "start");
}
var lrPlacement = ["left", "right"];
var rlPlacement = ["right", "left"];
var tbPlacement = ["top", "bottom"];
var btPlacement = ["bottom", "top"];
function getSideList(side, isStart, rtl) {
  switch (side) {
    case "top":
    case "bottom":
      if (rtl) return isStart ? rlPlacement : lrPlacement;
      return isStart ? lrPlacement : rlPlacement;
    case "left":
    case "right":
      return isStart ? tbPlacement : btPlacement;
    default:
      return [];
  }
}
function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
  const alignment = getAlignment(placement);
  let list = getSideList(getSide(placement), direction === "start", rtl);
  if (alignment) {
    list = list.map((side) => side + "-" + alignment);
    if (flipAlignment) {
      list = list.concat(list.map(getOppositeAlignmentPlacement));
    }
  }
  return list;
}
function getOppositePlacement(placement) {
  const side = getSide(placement);
  return oppositeSideMap[side] + placement.slice(side.length);
}
function expandPaddingObject(padding) {
  var _padding$top, _padding$right, _padding$bottom, _padding$left;
  return {
    top: (_padding$top = padding.top) != null ? _padding$top : 0,
    right: (_padding$right = padding.right) != null ? _padding$right : 0,
    bottom: (_padding$bottom = padding.bottom) != null ? _padding$bottom : 0,
    left: (_padding$left = padding.left) != null ? _padding$left : 0
  };
}
function getPaddingObject(padding) {
  return typeof padding !== "number" ? expandPaddingObject(padding) : {
    top: padding,
    right: padding,
    bottom: padding,
    left: padding
  };
}
function rectToClientRect(rect) {
  const {
    x: x2,
    y: y3,
    width,
    height
  } = rect;
  return {
    width,
    height,
    top: y3,
    left: x2,
    right: x2 + width,
    bottom: y3 + height,
    x: x2,
    y: y3
  };
}

// node_modules/@floating-ui/core/dist/floating-ui.core.mjs
function computeCoordsFromPlacement(_ref, placement, rtl) {
  let {
    reference,
    floating
  } = _ref;
  const sideAxis = getSideAxis(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const alignLength = getAxisLength(alignmentAxis);
  const side = getSide(placement);
  const isVertical = sideAxis === "y";
  const commonX = reference.x + reference.width / 2 - floating.width / 2;
  const commonY = reference.y + reference.height / 2 - floating.height / 2;
  const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
  let coords;
  switch (side) {
    case "top":
      coords = {
        x: commonX,
        y: reference.y - floating.height
      };
      break;
    case "bottom":
      coords = {
        x: commonX,
        y: reference.y + reference.height
      };
      break;
    case "right":
      coords = {
        x: reference.x + reference.width,
        y: commonY
      };
      break;
    case "left":
      coords = {
        x: reference.x - floating.width,
        y: commonY
      };
      break;
    default:
      coords = {
        x: reference.x,
        y: reference.y
      };
  }
  const alignment = getAlignment(placement);
  if (alignment) {
    coords[alignmentAxis] += commonAlign * (alignment === "end" ? 1 : -1) * (rtl && isVertical ? -1 : 1);
  }
  return coords;
}
async function detectOverflow(state2, options) {
  var _await$platform$isEle;
  if (options === void 0) {
    options = {};
  }
  const {
    x: x2,
    y: y3,
    platform: platform2,
    rects,
    elements,
    strategy
  } = state2;
  const {
    boundary = "clippingAncestors",
    rootBoundary = "viewport",
    elementContext = "floating",
    altBoundary = false,
    padding = 0
  } = evaluate(options, state2);
  const paddingObject = getPaddingObject(padding);
  const altContext = elementContext === "floating" ? "reference" : "floating";
  const element = elements[altBoundary ? altContext : elementContext];
  const clippingClientRect = rectToClientRect(await platform2.getClippingRect({
    element: ((_await$platform$isEle = await (platform2.isElement == null ? void 0 : platform2.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || await (platform2.getDocumentElement == null ? void 0 : platform2.getDocumentElement(elements.floating)),
    boundary,
    rootBoundary,
    strategy
  }));
  const rect = elementContext === "floating" ? {
    x: x2,
    y: y3,
    width: rects.floating.width,
    height: rects.floating.height
  } : rects.reference;
  const offsetParent = await (platform2.getOffsetParent == null ? void 0 : platform2.getOffsetParent(elements.floating));
  const offsetScale = await (platform2.isElement == null ? void 0 : platform2.isElement(offsetParent)) && await (platform2.getScale == null ? void 0 : platform2.getScale(offsetParent)) || {
    x: 1,
    y: 1
  };
  const elementClientRect = rectToClientRect(platform2.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform2.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements,
    rect,
    offsetParent,
    strategy
  }) : rect);
  return {
    top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
    bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
    left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
    right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
  };
}
var MAX_RESET_COUNT = 50;
var computePosition = async (reference, floating, config) => {
  const {
    placement = "bottom",
    strategy = "absolute",
    middleware = [],
    platform: platform2
  } = config;
  const platformWithDetectOverflow = platform2.detectOverflow ? platform2 : {
    ...platform2,
    detectOverflow
  };
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(floating));
  let rects = await platform2.getElementRects({
    reference,
    floating,
    strategy
  });
  let {
    x: x2,
    y: y3
  } = computeCoordsFromPlacement(rects, placement, rtl);
  let statefulPlacement = placement;
  let resetCount = 0;
  const middlewareData = {};
  for (let i8 = 0; i8 < middleware.length; i8++) {
    const currentMiddleware = middleware[i8];
    if (!currentMiddleware) {
      continue;
    }
    const {
      name,
      fn
    } = currentMiddleware;
    const {
      x: nextX,
      y: nextY,
      data,
      reset
    } = await fn({
      x: x2,
      y: y3,
      initialPlacement: placement,
      placement: statefulPlacement,
      strategy,
      middlewareData,
      rects,
      platform: platformWithDetectOverflow,
      elements: {
        reference,
        floating
      }
    });
    x2 = nextX != null ? nextX : x2;
    y3 = nextY != null ? nextY : y3;
    middlewareData[name] = {
      ...middlewareData[name],
      ...data
    };
    if (reset && resetCount < MAX_RESET_COUNT) {
      resetCount++;
      if (typeof reset === "object") {
        if (reset.placement) {
          statefulPlacement = reset.placement;
        }
        if (reset.rects) {
          rects = reset.rects === true ? await platform2.getElementRects({
            reference,
            floating,
            strategy
          }) : reset.rects;
        }
        ({
          x: x2,
          y: y3
        } = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
      }
      i8 = -1;
    }
  }
  return {
    x: x2,
    y: y3,
    placement: statefulPlacement,
    strategy,
    middlewareData
  };
};
var arrow = (options) => ({
  name: "arrow",
  options,
  async fn(state2) {
    const {
      x: x2,
      y: y3,
      placement,
      rects,
      platform: platform2,
      elements,
      middlewareData
    } = state2;
    const {
      element,
      padding = 0
    } = evaluate(options, state2) || {};
    if (element == null) {
      return {};
    }
    const paddingObject = getPaddingObject(padding);
    const coords = {
      x: x2,
      y: y3
    };
    const axis = getAlignmentAxis(placement);
    const length = getAxisLength(axis);
    const arrowDimensions = await platform2.getDimensions(element);
    const isYAxis = axis === "y";
    const minProp = isYAxis ? "top" : "left";
    const maxProp = isYAxis ? "bottom" : "right";
    const clientProp = isYAxis ? "clientHeight" : "clientWidth";
    const endDiff = rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
    const startDiff = coords[axis] - rects.reference[axis];
    const arrowOffsetParent = await (platform2.getOffsetParent == null ? void 0 : platform2.getOffsetParent(element));
    let clientSize = arrowOffsetParent ? arrowOffsetParent[clientProp] : 0;
    if (!clientSize || !await (platform2.isElement == null ? void 0 : platform2.isElement(arrowOffsetParent))) {
      clientSize = elements.floating[clientProp] || rects.floating[length];
    }
    const centerToReference = endDiff / 2 - startDiff / 2;
    const largestPossiblePadding = clientSize / 2 - arrowDimensions[length] / 2 - 1;
    const minPadding = min(paddingObject[minProp], largestPossiblePadding);
    const maxPadding = min(paddingObject[maxProp], largestPossiblePadding);
    const max2 = clientSize - arrowDimensions[length] - maxPadding;
    const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
    const offset3 = clamp2(minPadding, center, max2);
    const shouldAddOffset = !middlewareData.arrow && getAlignment(placement) != null && center !== offset3 && rects.reference[length] / 2 - (center < minPadding ? minPadding : maxPadding) - arrowDimensions[length] / 2 < 0;
    const alignmentOffset = shouldAddOffset ? center < minPadding ? center - minPadding : center - max2 : 0;
    return {
      [axis]: coords[axis] + alignmentOffset,
      data: {
        [axis]: offset3,
        centerOffset: center - offset3 - alignmentOffset,
        ...shouldAddOffset && {
          alignmentOffset
        }
      },
      reset: shouldAddOffset
    };
  }
});
var flip = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "flip",
    options,
    async fn(state2) {
      var _middlewareData$arrow, _middlewareData$flip;
      const {
        placement,
        middlewareData,
        rects,
        initialPlacement,
        platform: platform2,
        elements
      } = state2;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = true,
        fallbackPlacements: specifiedFallbackPlacements,
        fallbackStrategy = "bestFit",
        fallbackAxisSideDirection = "none",
        flipAlignment = true,
        ...detectOverflowOptions
      } = evaluate(options, state2);
      if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      const side = getSide(placement);
      const initialSideAxis = getSideAxis(initialPlacement);
      const isBasePlacement = getSide(initialPlacement) === initialPlacement;
      const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
      const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
      const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== "none";
      if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) {
        fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
      }
      const placements2 = [initialPlacement, ...fallbackPlacements];
      const overflow = await platform2.detectOverflow(state2, detectOverflowOptions);
      const overflows = [];
      let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
      if (checkMainAxis) {
        overflows.push(overflow[side]);
      }
      if (checkCrossAxis) {
        const sides2 = getAlignmentSides(placement, rects, rtl);
        overflows.push(overflow[sides2[0]], overflow[sides2[1]]);
      }
      overflowsData = [...overflowsData, {
        placement,
        overflows
      }];
      if (!overflows.every((side2) => side2 <= 0)) {
        var _middlewareData$flip2, _overflowsData$filter;
        const nextIndex2 = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
        const nextPlacement = placements2[nextIndex2];
        if (nextPlacement) {
          const ignoreCrossAxisOverflow = checkCrossAxis === "alignment" ? initialSideAxis !== getSideAxis(nextPlacement) : false;
          if (!ignoreCrossAxisOverflow || // We leave the current main axis only if every placement on that axis
          // overflows the main axis.
          overflowsData.every((d3) => getSideAxis(d3.placement) === initialSideAxis ? d3.overflows[0] > 0 : true)) {
            return {
              data: {
                index: nextIndex2,
                overflows: overflowsData
              },
              reset: {
                placement: nextPlacement
              }
            };
          }
        }
        let resetPlacement = (_overflowsData$filter = overflowsData.filter((d3) => d3.overflows[0] <= 0).sort((a4, b3) => a4.overflows[1] - b3.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;
        if (!resetPlacement) {
          switch (fallbackStrategy) {
            case "bestFit": {
              var _overflowsData$filter2;
              const placement2 = (_overflowsData$filter2 = overflowsData.filter((d3) => {
                if (hasFallbackAxisSideDirection) {
                  const currentSideAxis = getSideAxis(d3.placement);
                  return currentSideAxis === initialSideAxis || // Create a bias to the `y` side axis due to horizontal
                  // reading directions favoring greater width.
                  currentSideAxis === "y";
                }
                return true;
              }).map((d3) => [d3.placement, d3.overflows.filter((overflow2) => overflow2 > 0).reduce((acc, overflow2) => acc + overflow2, 0)]).sort((a4, b3) => a4[1] - b3[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
              if (placement2) {
                resetPlacement = placement2;
              }
              break;
            }
            case "initialPlacement":
              resetPlacement = initialPlacement;
              break;
          }
        }
        if (placement !== resetPlacement) {
          return {
            reset: {
              placement: resetPlacement
            }
          };
        }
      }
      return {};
    }
  };
};
var originSides = /* @__PURE__ */ new Set(["left", "top"]);
async function convertValueToCoords(state2, options) {
  const {
    placement,
    platform: platform2,
    elements
  } = state2;
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
  const side = getSide(placement);
  const alignment = getAlignment(placement);
  const isVertical = getSideAxis(placement) === "y";
  const mainAxisMulti = originSides.has(side) ? -1 : 1;
  const crossAxisMulti = rtl && isVertical ? -1 : 1;
  const rawValue = evaluate(options, state2);
  let {
    mainAxis,
    crossAxis,
    alignmentAxis
  } = typeof rawValue === "number" ? {
    mainAxis: rawValue,
    crossAxis: 0,
    alignmentAxis: null
  } : {
    mainAxis: rawValue.mainAxis || 0,
    crossAxis: rawValue.crossAxis || 0,
    alignmentAxis: rawValue.alignmentAxis
  };
  if (alignment && typeof alignmentAxis === "number") {
    crossAxis = alignment === "end" ? alignmentAxis * -1 : alignmentAxis;
  }
  return isVertical ? {
    x: crossAxis * crossAxisMulti,
    y: mainAxis * mainAxisMulti
  } : {
    x: mainAxis * mainAxisMulti,
    y: crossAxis * crossAxisMulti
  };
}
var offset = function(options) {
  if (options === void 0) {
    options = 0;
  }
  return {
    name: "offset",
    options,
    async fn(state2) {
      var _middlewareData$offse, _middlewareData$arrow;
      const {
        x: x2,
        y: y3,
        placement,
        middlewareData
      } = state2;
      const diffCoords = await convertValueToCoords(state2, options);
      if (placement === ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse.placement) && (_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      return {
        x: x2 + diffCoords.x,
        y: y3 + diffCoords.y,
        data: {
          ...diffCoords,
          placement
        }
      };
    }
  };
};
var shift = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "shift",
    options,
    async fn(state2) {
      const {
        x: x2,
        y: y3,
        placement,
        platform: platform2
      } = state2;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = false,
        limiter = {
          fn: (_ref) => {
            let {
              x: x3,
              y: y4
            } = _ref;
            return {
              x: x3,
              y: y4
            };
          }
        },
        ...detectOverflowOptions
      } = evaluate(options, state2);
      const coords = {
        x: x2,
        y: y3
      };
      const overflow = await platform2.detectOverflow(state2, detectOverflowOptions);
      const crossAxis = getSideAxis(placement);
      const mainAxis = getOppositeAxis(crossAxis);
      let mainAxisCoord = coords[mainAxis];
      let crossAxisCoord = coords[crossAxis];
      const clampCoord = (axis, coord) => clamp2(coord + overflow[axis === "y" ? "top" : "left"], coord, coord - overflow[axis === "y" ? "bottom" : "right"]);
      if (checkMainAxis) {
        mainAxisCoord = clampCoord(mainAxis, mainAxisCoord);
      }
      if (checkCrossAxis) {
        crossAxisCoord = clampCoord(crossAxis, crossAxisCoord);
      }
      const limitedCoords = limiter.fn({
        ...state2,
        [mainAxis]: mainAxisCoord,
        [crossAxis]: crossAxisCoord
      });
      return {
        ...limitedCoords,
        data: {
          x: limitedCoords.x - x2,
          y: limitedCoords.y - y3,
          enabled: {
            [mainAxis]: checkMainAxis,
            [crossAxis]: checkCrossAxis
          }
        }
      };
    }
  };
};
var size = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "size",
    options,
    async fn(state2) {
      const {
        placement,
        rects,
        platform: platform2,
        elements
      } = state2;
      const {
        apply = () => {
        },
        ...detectOverflowOptions
      } = evaluate(options, state2);
      const overflow = await platform2.detectOverflow(state2, detectOverflowOptions);
      const side = getSide(placement);
      const alignment = getAlignment(placement);
      const isYAxis = getSideAxis(placement) === "y";
      const {
        width,
        height
      } = rects.floating;
      let heightSide;
      let widthSide;
      if (side === "top" || side === "bottom") {
        heightSide = side;
        widthSide = alignment === (await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating)) ? "start" : "end") ? "left" : "right";
      } else {
        widthSide = side;
        heightSide = alignment === "end" ? "top" : "bottom";
      }
      const maximumClippingHeight = height - overflow.top - overflow.bottom;
      const maximumClippingWidth = width - overflow.left - overflow.right;
      const overflowAvailableHeight = min(height - overflow[heightSide], maximumClippingHeight);
      const overflowAvailableWidth = min(width - overflow[widthSide], maximumClippingWidth);
      const shiftData = state2.middlewareData.shift;
      const noShift = !shiftData;
      let availableHeight = overflowAvailableHeight;
      let availableWidth = overflowAvailableWidth;
      if (shiftData != null && shiftData.enabled.x) {
        availableWidth = maximumClippingWidth;
      }
      if (shiftData != null && shiftData.enabled.y) {
        availableHeight = maximumClippingHeight;
      }
      if (noShift && !alignment) {
        if (isYAxis) {
          availableWidth = width - 2 * max(overflow.left, overflow.right);
        } else {
          availableHeight = height - 2 * max(overflow.top, overflow.bottom);
        }
      }
      await apply({
        ...state2,
        availableWidth,
        availableHeight
      });
      const nextDimensions = await platform2.getDimensions(elements.floating);
      if (width !== nextDimensions.width || height !== nextDimensions.height) {
        return {
          reset: {
            rects: true
          }
        };
      }
      return {};
    }
  };
};

// node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs
function hasWindow() {
  return typeof window !== "undefined";
}
function getNodeName(node) {
  if (isNode(node)) {
    return (node.nodeName || "").toLowerCase();
  }
  return "#document";
}
function getWindow(node) {
  var _node$ownerDocument;
  return (node == null || (_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
}
function getDocumentElement(node) {
  var _ref;
  return (_ref = (isNode(node) ? node.ownerDocument : node.document) || window.document) == null ? void 0 : _ref.documentElement;
}
function isNode(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Node || value instanceof getWindow(value).Node;
}
function isElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Element || value instanceof getWindow(value).Element;
}
function isHTMLElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof HTMLElement || value instanceof getWindow(value).HTMLElement;
}
function isShadowRoot(value) {
  if (!hasWindow() || typeof ShadowRoot === "undefined") {
    return false;
  }
  return value instanceof ShadowRoot || value instanceof getWindow(value).ShadowRoot;
}
function isOverflowElement(element) {
  const {
    overflow,
    overflowX,
    overflowY,
    display
  } = getComputedStyle2(element);
  return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) && display !== "inline" && display !== "contents";
}
function isTableElement(element) {
  return /^(table|td|th)$/.test(getNodeName(element));
}
function isTopLayer(element) {
  try {
    if (element.matches(":popover-open")) {
      return true;
    }
  } catch (_e) {
  }
  try {
    return element.matches(":modal");
  } catch (_e) {
    return false;
  }
}
var willChangeRe = /transform|translate|scale|rotate|perspective|filter/;
var containRe = /paint|layout|strict|content/;
var isNotNone = (value) => !!value && value !== "none";
var isWebKitValue;
function isContainingBlock(elementOrCss) {
  const css = isElement(elementOrCss) ? getComputedStyle2(elementOrCss) : elementOrCss;
  return isNotNone(css.transform) || isNotNone(css.translate) || isNotNone(css.scale) || isNotNone(css.rotate) || isNotNone(css.perspective) || !isWebKit() && (isNotNone(css.backdropFilter) || isNotNone(css.filter)) || willChangeRe.test(css.willChange || "") || containRe.test(css.contain || "");
}
function getContainingBlock(element) {
  let currentNode = getParentNode(element);
  while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
    if (isContainingBlock(currentNode)) {
      return currentNode;
    } else if (isTopLayer(currentNode)) {
      return null;
    }
    currentNode = getParentNode(currentNode);
  }
  return null;
}
function isWebKit() {
  if (isWebKitValue == null) {
    isWebKitValue = typeof CSS !== "undefined" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none");
  }
  return isWebKitValue;
}
function isLastTraversableNode(node) {
  return /^(html|body|#document)$/.test(getNodeName(node));
}
function getComputedStyle2(element) {
  return getWindow(element).getComputedStyle(element);
}
function getNodeScroll(element) {
  if (isElement(element)) {
    return {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
  }
  return {
    scrollLeft: element.scrollX,
    scrollTop: element.scrollY
  };
}
function getParentNode(node) {
  if (getNodeName(node) === "html") {
    return node;
  }
  const result = (
    // Step into the shadow DOM of the parent of a slotted node.
    node.assignedSlot || // DOM Element detected.
    node.parentNode || // ShadowRoot detected.
    isShadowRoot(node) && node.host || // Fallback.
    getDocumentElement(node)
  );
  return isShadowRoot(result) ? result.host : result;
}
function getNearestOverflowAncestor(node) {
  const parentNode = getParentNode(node);
  if (isLastTraversableNode(parentNode)) {
    return (node.ownerDocument || node).body;
  }
  if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) {
    return parentNode;
  }
  return getNearestOverflowAncestor(parentNode);
}
function getOverflowAncestors(node, list, traverseIframes) {
  var _node$ownerDocument2;
  if (list === void 0) {
    list = [];
  }
  if (traverseIframes === void 0) {
    traverseIframes = true;
  }
  const scrollableAncestor = getNearestOverflowAncestor(node);
  const isBody = scrollableAncestor === ((_node$ownerDocument2 = node.ownerDocument) == null ? void 0 : _node$ownerDocument2.body);
  const win = getWindow(scrollableAncestor);
  if (isBody) {
    const frameElement = getFrameElement(win);
    return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : [], frameElement && traverseIframes ? getOverflowAncestors(frameElement) : []);
  } else {
    return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor, [], traverseIframes));
  }
}
function getFrameElement(win) {
  return win.parent && Object.getPrototypeOf(win.parent) ? win.frameElement : null;
}

// node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs
function getCssDimensions(element) {
  const css = getComputedStyle2(element);
  let width = parseFloat(css.width) || 0;
  let height = parseFloat(css.height) || 0;
  const hasOffset = isHTMLElement(element);
  const offsetWidth = hasOffset ? element.offsetWidth : width;
  const offsetHeight = hasOffset ? element.offsetHeight : height;
  const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;
  if (shouldFallback) {
    width = offsetWidth;
    height = offsetHeight;
  }
  return {
    width,
    height,
    $: shouldFallback
  };
}
function unwrapElement(element) {
  return !isElement(element) ? element.contextElement : element;
}
function getScale(element) {
  const domElement = unwrapElement(element);
  if (!isHTMLElement(domElement)) {
    return createCoords(1);
  }
  const rect = domElement.getBoundingClientRect();
  const {
    width,
    height,
    $: $3
  } = getCssDimensions(domElement);
  let x2 = ($3 ? round(rect.width) : rect.width) / width;
  let y3 = ($3 ? round(rect.height) : rect.height) / height;
  if (!x2 || !Number.isFinite(x2)) {
    x2 = 1;
  }
  if (!y3 || !Number.isFinite(y3)) {
    y3 = 1;
  }
  return {
    x: x2,
    y: y3
  };
}
var noOffsets = /* @__PURE__ */ createCoords(0);
function getVisualOffsets(element) {
  const win = getWindow(element);
  if (!isWebKit() || !win.visualViewport) {
    return noOffsets;
  }
  return {
    x: win.visualViewport.offsetLeft,
    y: win.visualViewport.offsetTop
  };
}
function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
  if (isFixed === void 0) {
    isFixed = false;
  }
  return !!floatingOffsetParent && isFixed && floatingOffsetParent === getWindow(element);
}
function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
  if (includeScale === void 0) {
    includeScale = false;
  }
  if (isFixedStrategy === void 0) {
    isFixedStrategy = false;
  }
  const clientRect = element.getBoundingClientRect();
  const domElement = unwrapElement(element);
  let scale = createCoords(1);
  if (includeScale) {
    if (offsetParent) {
      if (isElement(offsetParent)) {
        scale = getScale(offsetParent);
      }
    } else {
      scale = getScale(element);
    }
  }
  const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
  let x2 = (clientRect.left + visualOffsets.x) / scale.x;
  let y3 = (clientRect.top + visualOffsets.y) / scale.y;
  let width = clientRect.width / scale.x;
  let height = clientRect.height / scale.y;
  if (domElement && offsetParent) {
    const win = getWindow(domElement);
    const offsetWin = isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
    let currentWin = win;
    let currentIFrame = getFrameElement(currentWin);
    while (currentIFrame && offsetWin !== currentWin) {
      const iframeScale = getScale(currentIFrame);
      const iframeRect = currentIFrame.getBoundingClientRect();
      const css = getComputedStyle2(currentIFrame);
      const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
      const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
      x2 *= iframeScale.x;
      y3 *= iframeScale.y;
      width *= iframeScale.x;
      height *= iframeScale.y;
      x2 += left;
      y3 += top;
      currentWin = getWindow(currentIFrame);
      currentIFrame = getFrameElement(currentWin);
    }
  }
  return rectToClientRect({
    width,
    height,
    x: x2,
    y: y3
  });
}
function getWindowScrollBarX(element, rect) {
  const leftScroll = getNodeScroll(element).scrollLeft;
  if (!rect) {
    return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
  }
  return rect.left + leftScroll;
}
function getHTMLOffset(documentElement, scroll) {
  const htmlRect = documentElement.getBoundingClientRect();
  const x2 = htmlRect.left + scroll.scrollLeft - getWindowScrollBarX(documentElement, htmlRect);
  const y3 = htmlRect.top + scroll.scrollTop;
  return {
    x: x2,
    y: y3
  };
}
function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
  let {
    elements,
    rect,
    offsetParent,
    strategy
  } = _ref;
  const isFixed = strategy === "fixed";
  const documentElement = getDocumentElement(offsetParent);
  const topLayer = elements ? isTopLayer(elements.floating) : false;
  if (offsetParent === documentElement || topLayer && isFixed) {
    return rect;
  }
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  let scale = createCoords(1);
  const offsets = createCoords(0);
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  if (isOffsetParentAnElement || !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent);
      scale = getScale(offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  return {
    width: rect.width * scale.x,
    height: rect.height * scale.y,
    x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
    y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
  };
}
function getClientRects(element) {
  return element.getClientRects ? Array.from(element.getClientRects()) : [];
}
function getDocumentRect(html) {
  const scroll = getNodeScroll(html);
  const body = html.ownerDocument.body;
  const width = max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
  const height = max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
  let x2 = -scroll.scrollLeft + getWindowScrollBarX(html);
  const y3 = -scroll.scrollTop;
  if (getComputedStyle2(body).direction === "rtl") {
    x2 += max(html.clientWidth, body.clientWidth) - width;
  }
  return {
    width,
    height,
    x: x2,
    y: y3
  };
}
var SCROLLBAR_MAX = 25;
function getViewportRect(element, strategy, rootBoundary) {
  if (rootBoundary === void 0) {
    rootBoundary = "viewport";
  }
  const isLayoutViewport = rootBoundary === "layoutViewport";
  const win = getWindow(element);
  const html = getDocumentElement(element);
  const visualViewport = win.visualViewport;
  let width = html.clientWidth;
  let height = html.clientHeight;
  let x2 = 0;
  let y3 = 0;
  if (visualViewport) {
    const layoutRelativeClientCoords = !isWebKit() || strategy === "fixed";
    if (isLayoutViewport) {
      if (!layoutRelativeClientCoords) {
        x2 = -visualViewport.offsetLeft;
        y3 = -visualViewport.offsetTop;
      }
    } else {
      width = visualViewport.width;
      height = visualViewport.height;
      if (layoutRelativeClientCoords) {
        x2 = visualViewport.offsetLeft;
        y3 = visualViewport.offsetTop;
      }
    }
  }
  const windowScrollbarX = getWindowScrollBarX(html);
  if (windowScrollbarX <= 0) {
    const doc = html.ownerDocument;
    const body = doc.body;
    const bodyStyles = getComputedStyle(body);
    const bodyMarginInline = doc.compatMode === "CSS1Compat" ? parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight) || 0 : 0;
    const reservedWidth = Math.abs(html.clientWidth - body.clientWidth - bodyMarginInline);
    const gutter = getComputedStyle(html).scrollbarGutter === "stable both-edges" ? reservedWidth / 2 : reservedWidth;
    if (gutter <= SCROLLBAR_MAX) {
      width -= gutter;
    }
  }
  return {
    width,
    height,
    x: x2,
    y: y3
  };
}
function getInnerBoundingClientRect(element, strategy) {
  const clientRect = getBoundingClientRect(element, true, strategy === "fixed");
  const top = clientRect.top + element.clientTop;
  const left = clientRect.left + element.clientLeft;
  const scale = getScale(element);
  const width = element.clientWidth * scale.x;
  const height = element.clientHeight * scale.y;
  const x2 = left * scale.x;
  const y3 = top * scale.y;
  return {
    width,
    height,
    x: x2,
    y: y3
  };
}
function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
  let rect;
  if (clippingAncestor === "viewport" || clippingAncestor === "layoutViewport") {
    rect = getViewportRect(element, strategy, clippingAncestor);
  } else if (clippingAncestor === "document") {
    rect = getDocumentRect(getDocumentElement(element));
  } else if (isElement(clippingAncestor)) {
    rect = getInnerBoundingClientRect(clippingAncestor, strategy);
  } else {
    const visualOffsets = getVisualOffsets(element);
    rect = {
      x: clippingAncestor.x - visualOffsets.x,
      y: clippingAncestor.y - visualOffsets.y,
      width: clippingAncestor.width,
      height: clippingAncestor.height
    };
  }
  return rectToClientRect(rect);
}
function getClippingElementAncestors(element, cache) {
  const cachedResult = cache.get(element);
  if (cachedResult) {
    return cachedResult;
  }
  let result = getOverflowAncestors(element, [], false).filter((el) => isElement(el) && getNodeName(el) !== "body");
  let lastKeptComputedStyle = null;
  const elementIsFixed = getComputedStyle2(element).position === "fixed";
  let currentNode = elementIsFixed ? getParentNode(element) : element;
  while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
    const computedStyle = getComputedStyle2(currentNode);
    const currentNodeIsContaining = isContainingBlock(currentNode);
    const lastPosition = lastKeptComputedStyle ? lastKeptComputedStyle.position : elementIsFixed ? "fixed" : "";
    const shouldDropCurrentNode = !currentNodeIsContaining && (lastPosition === "fixed" || lastPosition === "absolute" && computedStyle.position === "static");
    if (shouldDropCurrentNode) {
      result = result.filter((ancestor) => ancestor !== currentNode);
    } else {
      lastKeptComputedStyle = computedStyle;
    }
    currentNode = getParentNode(currentNode);
  }
  cache.set(element, result);
  return result;
}
function getClippingRect(_ref) {
  let {
    element,
    boundary,
    rootBoundary,
    strategy
  } = _ref;
  const elementClippingAncestors = boundary === "clippingAncestors" ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary);
  const clippingAncestors = [...elementClippingAncestors, rootBoundary];
  const firstRect = getClientRectFromClippingAncestor(element, clippingAncestors[0], strategy);
  let top = firstRect.top;
  let right = firstRect.right;
  let bottom = firstRect.bottom;
  let left = firstRect.left;
  for (let i8 = 1; i8 < clippingAncestors.length; i8++) {
    const rect = getClientRectFromClippingAncestor(element, clippingAncestors[i8], strategy);
    top = max(rect.top, top);
    right = min(rect.right, right);
    bottom = min(rect.bottom, bottom);
    left = max(rect.left, left);
  }
  return {
    width: right - left,
    height: bottom - top,
    x: left,
    y: top
  };
}
function getDimensions(element) {
  const {
    width,
    height
  } = getCssDimensions(element);
  return {
    width,
    height
  };
}
function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  const documentElement = getDocumentElement(offsetParent);
  const isFixed = strategy === "fixed";
  const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  const offsets = createCoords(0);
  if (isOffsetParentAnElement || !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  if (!isOffsetParentAnElement && documentElement) {
    offsets.x = getWindowScrollBarX(documentElement);
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  const x2 = rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x;
  const y3 = rect.top + scroll.scrollTop - offsets.y - htmlOffset.y;
  return {
    x: x2,
    y: y3,
    width: rect.width,
    height: rect.height
  };
}
function isStaticPositioned(element) {
  return getComputedStyle2(element).position === "static";
}
function getTrueOffsetParent(element, polyfill) {
  if (!isHTMLElement(element) || getComputedStyle2(element).position === "fixed") {
    return null;
  }
  if (polyfill) {
    return polyfill(element);
  }
  let rawOffsetParent = element.offsetParent;
  if (getDocumentElement(element) === rawOffsetParent) {
    rawOffsetParent = rawOffsetParent.ownerDocument.body;
  }
  return rawOffsetParent;
}
function getOffsetParent(element, polyfill) {
  const win = getWindow(element);
  if (isTopLayer(element)) {
    return win;
  }
  if (!isHTMLElement(element)) {
    let svgOffsetParent = getParentNode(element);
    while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
      if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) {
        return svgOffsetParent;
      }
      svgOffsetParent = getParentNode(svgOffsetParent);
    }
    return win;
  }
  let offsetParent = getTrueOffsetParent(element, polyfill);
  while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) {
    offsetParent = getTrueOffsetParent(offsetParent, polyfill);
  }
  if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) {
    return win;
  }
  return offsetParent || getContainingBlock(element) || win;
}
var getElementRects = async function(data) {
  const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
  const getDimensionsFn = this.getDimensions;
  const floatingDimensions = await getDimensionsFn(data.floating);
  return {
    reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
    floating: {
      x: 0,
      y: 0,
      width: floatingDimensions.width,
      height: floatingDimensions.height
    }
  };
};
function isRTL(element) {
  return getComputedStyle2(element).direction === "rtl";
}
var platform = {
  convertOffsetParentRelativeRectToViewportRelativeRect,
  getDocumentElement,
  getClippingRect,
  getOffsetParent,
  getElementRects,
  getClientRects,
  getDimensions,
  getScale,
  isElement,
  isRTL
};
function rectsAreEqual(a4, b3) {
  return a4.x === b3.x && a4.y === b3.y && a4.width === b3.width && a4.height === b3.height;
}
function observeMove(element, onMove, ancestorResize) {
  let io = null;
  let timeoutId;
  const root2 = getDocumentElement(element);
  function cleanup() {
    var _io;
    clearTimeout(timeoutId);
    (_io = io) == null || _io.disconnect();
    io = null;
  }
  function refresh(skip, threshold) {
    if (skip === void 0) {
      skip = false;
    }
    if (threshold === void 0) {
      threshold = 1;
    }
    cleanup();
    const elementRectForRootMargin = element.getBoundingClientRect();
    const {
      left,
      top,
      width,
      height
    } = elementRectForRootMargin;
    if (!skip) {
      onMove();
    }
    if (!width || !height) {
      return;
    }
    const insetTop = floor(top);
    const insetRight = floor(root2.clientWidth - (left + width));
    const insetBottom = floor(root2.clientHeight - (top + height));
    const insetLeft = floor(left);
    const rootMargin = -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px";
    const options = {
      rootMargin,
      threshold: max(0, min(1, threshold)) || 1
    };
    let isFirstUpdate = true;
    function handleObserve(entries) {
      const ratio = entries[0].intersectionRatio;
      if (!rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) {
        return refresh();
      }
      if (ratio !== threshold) {
        if (!isFirstUpdate) {
          return refresh();
        }
        if (!ratio) {
          timeoutId = setTimeout(() => {
            refresh(false, 1e-7);
          }, 1e3);
        } else {
          refresh(false, ratio);
        }
      }
      isFirstUpdate = false;
    }
    try {
      io = new IntersectionObserver(handleObserve, {
        ...options,
        // Handle <iframe>s
        root: root2.ownerDocument
      });
    } catch (_e) {
      io = new IntersectionObserver(handleObserve, options);
    }
    io.observe(element);
  }
  const win = getWindow(element);
  const handleResize = () => refresh(ancestorResize);
  win.addEventListener("resize", handleResize);
  refresh(true);
  return () => {
    win.removeEventListener("resize", handleResize);
    cleanup();
  };
}
function autoUpdate(reference, floating, update2, options) {
  if (options === void 0) {
    options = {};
  }
  const {
    ancestorScroll = true,
    ancestorResize = true,
    elementResize = typeof ResizeObserver === "function",
    layoutShift = typeof IntersectionObserver === "function",
    animationFrame = false
  } = options;
  const referenceEl = unwrapElement(reference);
  const ancestors = ancestorScroll || ancestorResize ? [...referenceEl ? getOverflowAncestors(referenceEl) : [], ...floating ? getOverflowAncestors(floating) : []] : [];
  ancestors.forEach((ancestor) => {
    ancestorScroll && ancestor.addEventListener("scroll", update2);
    ancestorResize && ancestor.addEventListener("resize", update2);
  });
  const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update2, ancestorResize) : null;
  let reobserveFrame = -1;
  let resizeObserver = null;
  if (elementResize) {
    resizeObserver = new ResizeObserver((_ref) => {
      let [firstEntry] = _ref;
      if (firstEntry && firstEntry.target === referenceEl && resizeObserver && floating) {
        resizeObserver.unobserve(floating);
        cancelAnimationFrame(reobserveFrame);
        reobserveFrame = requestAnimationFrame(() => {
          var _resizeObserver;
          (_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
        });
      }
      update2();
    });
    if (referenceEl && !animationFrame) {
      resizeObserver.observe(referenceEl);
    }
    if (floating) {
      resizeObserver.observe(floating);
    }
  }
  let frameId;
  let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
  if (animationFrame) {
    frameLoop();
  }
  function frameLoop() {
    const nextRefRect = getBoundingClientRect(reference);
    if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) {
      update2();
    }
    prevRefRect = nextRefRect;
    frameId = requestAnimationFrame(frameLoop);
  }
  update2();
  return () => {
    var _resizeObserver2;
    ancestors.forEach((ancestor) => {
      ancestorScroll && ancestor.removeEventListener("scroll", update2);
      ancestorResize && ancestor.removeEventListener("resize", update2);
    });
    cleanupIo == null || cleanupIo();
    (_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
    resizeObserver = null;
    if (animationFrame) {
      cancelAnimationFrame(frameId);
    }
  };
}
var offset2 = offset;
var shift2 = shift;
var flip2 = flip;
var size2 = size;
var arrow2 = arrow;
var computePosition2 = (reference, floating, options) => {
  const cache = /* @__PURE__ */ new Map();
  const mergedOptions = options != null ? options : {};
  const platformWithCache = {
    ...platform,
    ...mergedOptions.platform,
    _c: cache
  };
  return computePosition(reference, floating, {
    ...mergedOptions,
    platform: platformWithCache
  });
};

// node_modules/composed-offset-position/dist/composed-offset-position.browser.min.mjs
function e8(t6) {
  return i7(t6);
}
function r6(t6) {
  return t6.assignedSlot ? t6.assignedSlot : t6.parentNode instanceof ShadowRoot ? t6.parentNode.host : t6.parentNode;
}
function i7(e9) {
  for (let t6 = e9; t6; t6 = r6(t6)) if (t6 instanceof Element && "none" === getComputedStyle(t6).display) return null;
  for (let n6 = r6(e9); n6; n6 = r6(n6)) {
    if (!(n6 instanceof Element)) continue;
    const e10 = getComputedStyle(n6);
    if ("contents" !== e10.display) {
      if ("static" !== e10.position || isContainingBlock(e10)) return n6;
      if ("BODY" === n6.tagName) return n6;
    }
  }
  return null;
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.64OG2H45.js
function isVirtualElement(e9) {
  return e9 !== null && typeof e9 === "object" && "getBoundingClientRect" in e9 && ("contextElement" in e9 ? e9 instanceof Element : true);
}
var SUPPORTS_POPOVER = Boolean(globalThis?.HTMLElement?.prototype.hasOwnProperty("popover"));
var WaPopup = class extends WebAwesomeElement {
  constructor() {
    super(...arguments);
    this.localize = new LocalizeController2(this);
    this.SUPPORTS_POPOVER = false;
    this.active = false;
    this.placement = "top";
    this.boundary = "viewport";
    this.distance = 0;
    this.skidding = 0;
    this.arrow = false;
    this.arrowPlacement = "anchor";
    this.arrowPadding = 10;
    this.flip = false;
    this.flipFallbackPlacements = "";
    this.flipFallbackStrategy = "best-fit";
    this.flipPadding = 0;
    this.shift = false;
    this.shiftPadding = 0;
    this.autoSizePadding = 0;
    this.hoverBridge = false;
    this.updateHoverBridge = () => {
      if (this.hoverBridge && this.anchorEl && this.popup) {
        const anchorRect = this.anchorEl.getBoundingClientRect();
        const popupRect = this.popup.getBoundingClientRect();
        const isVertical = this.placement.includes("top") || this.placement.includes("bottom");
        let topLeftX = 0;
        let topLeftY = 0;
        let topRightX = 0;
        let topRightY = 0;
        let bottomLeftX = 0;
        let bottomLeftY = 0;
        let bottomRightX = 0;
        let bottomRightY = 0;
        if (isVertical) {
          if (anchorRect.top < popupRect.top) {
            topLeftX = anchorRect.left;
            topLeftY = anchorRect.bottom;
            topRightX = anchorRect.right;
            topRightY = anchorRect.bottom;
            bottomLeftX = popupRect.left;
            bottomLeftY = popupRect.top;
            bottomRightX = popupRect.right;
            bottomRightY = popupRect.top;
          } else {
            topLeftX = popupRect.left;
            topLeftY = popupRect.bottom;
            topRightX = popupRect.right;
            topRightY = popupRect.bottom;
            bottomLeftX = anchorRect.left;
            bottomLeftY = anchorRect.top;
            bottomRightX = anchorRect.right;
            bottomRightY = anchorRect.top;
          }
        } else {
          if (anchorRect.left < popupRect.left) {
            topLeftX = anchorRect.right;
            topLeftY = anchorRect.top;
            topRightX = popupRect.left;
            topRightY = popupRect.top;
            bottomLeftX = anchorRect.right;
            bottomLeftY = anchorRect.bottom;
            bottomRightX = popupRect.left;
            bottomRightY = popupRect.bottom;
          } else {
            topLeftX = popupRect.right;
            topLeftY = popupRect.top;
            topRightX = anchorRect.left;
            topRightY = anchorRect.top;
            bottomLeftX = popupRect.right;
            bottomLeftY = popupRect.bottom;
            bottomRightX = anchorRect.left;
            bottomRightY = anchorRect.bottom;
          }
        }
        this.style.setProperty("--hover-bridge-top-left-x", `${topLeftX}px`);
        this.style.setProperty("--hover-bridge-top-left-y", `${topLeftY}px`);
        this.style.setProperty("--hover-bridge-top-right-x", `${topRightX}px`);
        this.style.setProperty("--hover-bridge-top-right-y", `${topRightY}px`);
        this.style.setProperty("--hover-bridge-bottom-left-x", `${bottomLeftX}px`);
        this.style.setProperty("--hover-bridge-bottom-left-y", `${bottomLeftY}px`);
        this.style.setProperty("--hover-bridge-bottom-right-x", `${bottomRightX}px`);
        this.style.setProperty("--hover-bridge-bottom-right-y", `${bottomRightY}px`);
      }
    };
  }
  async connectedCallback() {
    super.connectedCallback();
    await this.updateComplete;
    this.SUPPORTS_POPOVER = SUPPORTS_POPOVER;
    this.start();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.stop();
  }
  async updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has("active")) {
      if (this.active) {
        this.start();
      } else {
        this.stop();
      }
    }
    if (changedProperties.has("anchor")) {
      this.handleAnchorChange();
    }
    if (this.active) {
      await this.updateComplete;
      this.reposition();
    }
  }
  async handleAnchorChange() {
    await this.stop();
    if (this.anchor && typeof this.anchor === "string") {
      const root2 = this.getRootNode();
      this.anchorEl = root2.getElementById(this.anchor);
    } else if (this.anchor instanceof Element || isVirtualElement(this.anchor)) {
      this.anchorEl = this.anchor;
    } else {
      this.anchorEl = this.querySelector('[slot="anchor"]');
    }
    if (this.anchorEl instanceof HTMLSlotElement) {
      this.anchorEl = this.anchorEl.assignedElements({ flatten: true })[0];
    }
    if (this.anchorEl) {
      this.start();
    }
  }
  start() {
    if (!this.anchorEl || !this.active || !this.isConnected) {
      return;
    }
    this.popup?.showPopover?.();
    this.cleanup = autoUpdate(this.anchorEl, this.popup, () => {
      this.reposition();
    });
  }
  async stop() {
    return new Promise((resolve) => {
      this.popup?.hidePopover?.();
      if (this.cleanup) {
        this.cleanup();
        this.cleanup = void 0;
        this.removeAttribute("data-current-placement");
        this.style.removeProperty("--auto-size-available-width");
        this.style.removeProperty("--auto-size-available-height");
        requestAnimationFrame(() => resolve());
      } else {
        resolve();
      }
    });
  }
  /** Forces the popup to recalculate and reposition itself. */
  reposition() {
    if (!this.active || !this.anchorEl || !this.popup) {
      return;
    }
    const middleware = [
      // The offset middleware goes first
      offset2({ mainAxis: this.distance, crossAxis: this.skidding })
    ];
    if (this.sync) {
      middleware.push(
        size2({
          apply: ({ rects }) => {
            const syncWidth = this.sync === "width" || this.sync === "both";
            const syncHeight = this.sync === "height" || this.sync === "both";
            this.popup.style.width = syncWidth ? `${rects.reference.width}px` : "";
            this.popup.style.height = syncHeight ? `${rects.reference.height}px` : "";
          }
        })
      );
    } else {
      this.popup.style.width = "";
      this.popup.style.height = "";
    }
    let defaultBoundary;
    if (this.SUPPORTS_POPOVER && !isVirtualElement(this.anchor) && this.boundary === "scroll") {
      defaultBoundary = getOverflowAncestors(this.anchorEl).filter((el) => el instanceof Element);
    }
    if (this.flip) {
      middleware.push(
        flip2({
          boundary: this.flipBoundary || defaultBoundary,
          // @ts-expect-error - We're converting a string attribute to an array here
          fallbackPlacements: this.flipFallbackPlacements,
          fallbackStrategy: this.flipFallbackStrategy === "best-fit" ? "bestFit" : "initialPlacement",
          padding: this.flipPadding
        })
      );
    }
    if (this.shift) {
      middleware.push(
        shift2({
          boundary: this.shiftBoundary || defaultBoundary,
          padding: this.shiftPadding
        })
      );
    }
    if (this.autoSize) {
      middleware.push(
        size2({
          boundary: this.autoSizeBoundary || defaultBoundary,
          padding: this.autoSizePadding,
          apply: ({ availableWidth, availableHeight }) => {
            if (this.autoSize === "vertical" || this.autoSize === "both") {
              this.style.setProperty("--auto-size-available-height", `${availableHeight}px`);
            } else {
              this.style.removeProperty("--auto-size-available-height");
            }
            if (this.autoSize === "horizontal" || this.autoSize === "both") {
              this.style.setProperty("--auto-size-available-width", `${availableWidth}px`);
            } else {
              this.style.removeProperty("--auto-size-available-width");
            }
          }
        })
      );
    } else {
      this.style.removeProperty("--auto-size-available-width");
      this.style.removeProperty("--auto-size-available-height");
    }
    if (this.arrow) {
      middleware.push(
        arrow2({
          element: this.arrowEl,
          padding: this.arrowPadding
        })
      );
    }
    const getOffsetParent2 = this.SUPPORTS_POPOVER ? (element) => platform.getOffsetParent(element, e8) : platform.getOffsetParent;
    computePosition2(this.anchorEl, this.popup, {
      placement: this.placement,
      middleware,
      strategy: this.SUPPORTS_POPOVER ? "absolute" : "fixed",
      platform: {
        ...platform,
        getOffsetParent: getOffsetParent2
      }
    }).then(({ x: x2, y: y3, middlewareData, placement }) => {
      const isRtl = this.localize.dir() === "rtl";
      const staticSide = { top: "bottom", right: "left", bottom: "top", left: "right" }[placement.split("-")[0]];
      this.setAttribute("data-current-placement", placement);
      Object.assign(this.popup.style, {
        left: `${x2}px`,
        top: `${y3}px`
      });
      if (this.arrow) {
        const arrowX = middlewareData.arrow.x;
        const arrowY = middlewareData.arrow.y;
        let top = "";
        let right = "";
        let bottom = "";
        let left = "";
        if (this.arrowPlacement === "start") {
          const value = typeof arrowX === "number" ? `calc(${this.arrowPadding}px - var(--arrow-padding-offset))` : "";
          top = typeof arrowY === "number" ? `calc(${this.arrowPadding}px - var(--arrow-padding-offset))` : "";
          right = isRtl ? value : "";
          left = isRtl ? "" : value;
        } else if (this.arrowPlacement === "end") {
          const value = typeof arrowX === "number" ? `calc(${this.arrowPadding}px - var(--arrow-padding-offset))` : "";
          right = isRtl ? "" : value;
          left = isRtl ? value : "";
          bottom = typeof arrowY === "number" ? `calc(${this.arrowPadding}px - var(--arrow-padding-offset))` : "";
        } else if (this.arrowPlacement === "center") {
          left = typeof arrowX === "number" ? `calc(50% - var(--arrow-size-diagonal))` : "";
          top = typeof arrowY === "number" ? `calc(50% - var(--arrow-size-diagonal))` : "";
        } else {
          left = typeof arrowX === "number" ? `${arrowX}px` : "";
          top = typeof arrowY === "number" ? `${arrowY}px` : "";
        }
        Object.assign(this.arrowEl.style, {
          top,
          right,
          bottom,
          left,
          [staticSide]: "calc(var(--arrow-base-offset) - var(--arrow-size-diagonal))"
        });
      }
    });
    requestAnimationFrame(() => this.updateHoverBridge());
    this.dispatchEvent(new WaRepositionEvent());
  }
  render() {
    return b2`
      <slot name="anchor" @slotchange=${this.handleAnchorChange}></slot>

      <span
        part="hover-bridge"
        class=${e7({
      "popup-hover-bridge": true,
      "popup-hover-bridge-visible": this.hoverBridge && this.active
    })}
      ></span>

      <div
        popover="manual"
        part="popup"
        class=${e7({
      popup: true,
      "popup-active": this.active,
      "popup-fixed": !this.SUPPORTS_POPOVER,
      "popup-has-arrow": this.arrow
    })}
      >
        <slot></slot>
        ${this.arrow ? b2`<div part="arrow" class="arrow" role="presentation"></div>` : ""}
      </div>
    `;
  }
};
WaPopup.css = popup_styles_default;
__decorateClass([
  e5(".popup")
], WaPopup.prototype, "popup", 2);
__decorateClass([
  e5(".arrow")
], WaPopup.prototype, "arrowEl", 2);
__decorateClass([
  n4({ attribute: false, type: Boolean })
], WaPopup.prototype, "SUPPORTS_POPOVER", 2);
__decorateClass([
  n4()
], WaPopup.prototype, "anchor", 2);
__decorateClass([
  n4({ type: Boolean, reflect: true })
], WaPopup.prototype, "active", 2);
__decorateClass([
  n4({ reflect: true })
], WaPopup.prototype, "placement", 2);
__decorateClass([
  n4()
], WaPopup.prototype, "boundary", 2);
__decorateClass([
  n4({ type: Number })
], WaPopup.prototype, "distance", 2);
__decorateClass([
  n4({ type: Number })
], WaPopup.prototype, "skidding", 2);
__decorateClass([
  n4({ type: Boolean })
], WaPopup.prototype, "arrow", 2);
__decorateClass([
  n4({ attribute: "arrow-placement" })
], WaPopup.prototype, "arrowPlacement", 2);
__decorateClass([
  n4({ attribute: "arrow-padding", type: Number })
], WaPopup.prototype, "arrowPadding", 2);
__decorateClass([
  n4({ type: Boolean })
], WaPopup.prototype, "flip", 2);
__decorateClass([
  n4({
    attribute: "flip-fallback-placements",
    converter: {
      fromAttribute: (value) => {
        return value.split(" ").map((p3) => p3.trim()).filter((p3) => p3 !== "");
      },
      toAttribute: (value) => {
        return value.join(" ");
      }
    }
  })
], WaPopup.prototype, "flipFallbackPlacements", 2);
__decorateClass([
  n4({ attribute: "flip-fallback-strategy" })
], WaPopup.prototype, "flipFallbackStrategy", 2);
__decorateClass([
  n4({ type: Object })
], WaPopup.prototype, "flipBoundary", 2);
__decorateClass([
  n4({ attribute: "flip-padding", type: Number })
], WaPopup.prototype, "flipPadding", 2);
__decorateClass([
  n4({ type: Boolean })
], WaPopup.prototype, "shift", 2);
__decorateClass([
  n4({ type: Object })
], WaPopup.prototype, "shiftBoundary", 2);
__decorateClass([
  n4({ attribute: "shift-padding", type: Number })
], WaPopup.prototype, "shiftPadding", 2);
__decorateClass([
  n4({ attribute: "auto-size" })
], WaPopup.prototype, "autoSize", 2);
__decorateClass([
  n4()
], WaPopup.prototype, "sync", 2);
__decorateClass([
  n4({ type: Object })
], WaPopup.prototype, "autoSizeBoundary", 2);
__decorateClass([
  n4({ attribute: "auto-size-padding", type: Number })
], WaPopup.prototype, "autoSizePadding", 2);
__decorateClass([
  n4({ attribute: "hover-bridge", type: Boolean })
], WaPopup.prototype, "hoverBridge", 2);
WaPopup = __decorateClass([
  t3("wa-popup")
], WaPopup);

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.F25QOBDY.js
function waitForEvent(el, eventName) {
  return new Promise((resolve) => {
    function done(event) {
      if (event.target === el) {
        el.removeEventListener(eventName, done);
        resolve();
      }
    }
    el.addEventListener(eventName, done);
  });
}

// node_modules/@awesome.me/webawesome/dist/chunks/chunk.BCXHEFKE.js
var WaTooltip = class extends WebAwesomeElement {
  constructor() {
    super(...arguments);
    this.dismissedByPress = false;
    this.placement = "top";
    this.disabled = false;
    this.distance = 8;
    this.open = false;
    this.skidding = 0;
    this.showDelay = 150;
    this.hideDelay = 0;
    this.trigger = "hover focus";
    this.withoutArrow = false;
    this.for = null;
    this.anchor = null;
    this.eventController = new AbortController();
    this.handleBlur = () => {
      this.dismissedByPress = false;
      if (this.hasTrigger("focus")) {
        this.hide();
      }
    };
    this.handleClick = () => {
      if (this.hasTrigger("click")) {
        if (this.open) {
          this.hide();
        } else {
          this.show();
        }
        return;
      }
      if (this.hasTrigger("manual")) {
        return;
      }
      this.lightDismiss();
    };
    this.handleFocus = () => {
      if (this.dismissedByPress) {
        return;
      }
      if (this.hasTrigger("focus")) {
        this.show();
      }
    };
    this.handleMouseDown = () => {
      if (this.hasTrigger("click") || this.hasTrigger("manual")) {
        return;
      }
      this.lightDismiss();
    };
    this.handleDocumentKeyDown = (event) => {
      if (this.hasTrigger("manual")) {
        return;
      }
      if (event.key === "Escape" && this.open && isTopDismissible(this)) {
        event.preventDefault();
        event.stopPropagation();
        this.hide();
      }
    };
    this.handleDocumentClick = (event) => {
      if (this.hasTrigger("manual")) {
        return;
      }
      if (this.anchor && event.composedPath().includes(this.anchor)) {
        return;
      }
      this.hide();
    };
    this.handleMouseOver = () => {
      if (this.dismissedByPress) {
        return;
      }
      if (this.hasTrigger("hover")) {
        clearTimeout(this.hoverTimeout);
        this.hoverTimeout = window.setTimeout(() => this.show(), this.showDelay);
      }
    };
    this.handleMouseOut = (event) => {
      const relatedTarget = event.relatedTarget;
      const movedIntoAnchor = Boolean(relatedTarget && this.anchor?.contains(relatedTarget));
      const movedIntoTooltip = Boolean(relatedTarget && this.contains(relatedTarget));
      if (movedIntoAnchor || movedIntoTooltip) {
        return;
      }
      this.dismissedByPress = false;
      if (this.hasTrigger("hover")) {
        clearTimeout(this.hoverTimeout);
        this.hoverTimeout = window.setTimeout(() => {
          this.hide();
        }, this.hideDelay);
      }
    };
  }
  connectedCallback() {
    super.connectedCallback();
    const isClient2 = typeof document !== "undefined";
    if (isClient2) {
      if (this.eventController.signal.aborted) {
        this.eventController = new AbortController();
      }
      this.addEventListener("mouseout", this.handleMouseOut);
      this.dismissedByPress = false;
      if (this.open) {
        this.open = false;
        this.updateComplete.then(() => {
          this.open = true;
        });
      }
      if (!this.id) {
        this.id = uniqueId("wa-tooltip-");
      }
      if (this.for && this.anchor) {
        this.anchor = null;
        this.handleForChange();
      } else if (this.for) {
        this.handleForChange();
      }
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleDocumentKeyDown);
    document.removeEventListener("click", this.handleDocumentClick);
    unregisterDismissible(this);
    this.eventController.abort();
    if (this.anchor) {
      this.removeFromAriaLabelledBy(this.anchor, this.id);
    }
  }
  firstUpdated(changedProperties) {
    this.body.hidden = !this.open;
    if (this.open) {
      this.popup.active = true;
      this.popup.reposition();
    }
    super.firstUpdated(changedProperties);
  }
  /** Hides the tooltip, or cancels a pending show, and keeps it hidden until re-armed. */
  lightDismiss() {
    clearTimeout(this.hoverTimeout);
    this.dismissedByPress = true;
    this.hide();
  }
  hasTrigger(triggerType) {
    const triggers = this.trigger.split(" ");
    return triggers.includes(triggerType);
  }
  /** Adds the tooltip ID to the aria-labelledby attribute */
  addToAriaLabelledBy(element, id) {
    const currentLabel = element.getAttribute("aria-labelledby") || "";
    const labels = currentLabel.split(/\s+/).filter(Boolean);
    if (!labels.includes(id)) {
      labels.push(id);
      element.setAttribute("aria-labelledby", labels.join(" "));
    }
  }
  /** Removes the tooltip ID from the aria-labelledby attribute */
  removeFromAriaLabelledBy(element, id) {
    const currentLabel = element.getAttribute("aria-labelledby") || "";
    const labels = currentLabel.split(/\s+/).filter(Boolean);
    const filteredLabels = labels.filter((label) => label !== id);
    if (filteredLabels.length > 0) {
      element.setAttribute("aria-labelledby", filteredLabels.join(" "));
    } else {
      element.removeAttribute("aria-labelledby");
    }
  }
  async handleOpenChange() {
    if (this.open) {
      if (this.disabled) {
        return;
      }
      const waShowEvent = new WaShowEvent();
      this.dispatchEvent(waShowEvent);
      if (waShowEvent.defaultPrevented) {
        this.open = false;
        return;
      }
      if (!this.hasTrigger("manual")) {
        document.addEventListener("keydown", this.handleDocumentKeyDown, { signal: this.eventController.signal });
        document.addEventListener("click", this.handleDocumentClick, { signal: this.eventController.signal });
        registerDismissible(this);
      }
      this.body.hidden = false;
      this.popup.active = true;
      await animateWithClass(this.popup.popup, "show-with-scale");
      this.popup.reposition();
      this.dispatchEvent(new WaAfterShowEvent());
    } else {
      const waHideEvent = new WaHideEvent();
      this.dispatchEvent(waHideEvent);
      if (waHideEvent.defaultPrevented) {
        this.open = true;
        return;
      }
      document.removeEventListener("keydown", this.handleDocumentKeyDown);
      document.removeEventListener("click", this.handleDocumentClick);
      unregisterDismissible(this);
      await animateWithClass(this.popup.popup, "hide-with-scale");
      this.popup.active = false;
      this.body.hidden = true;
      this.dispatchEvent(new WaAfterHideEvent());
    }
  }
  handleForChange() {
    const rootNode = this.getRootNode?.();
    if (!rootNode) {
      return;
    }
    const newAnchor = this.for ? rootNode.getElementById?.(this.for) : null;
    const oldAnchor = this.anchor;
    if (newAnchor === oldAnchor) {
      return;
    }
    this.dismissedByPress = false;
    const { signal } = this.eventController;
    if (newAnchor) {
      this.addToAriaLabelledBy(newAnchor, this.id);
      newAnchor.addEventListener("blur", this.handleBlur, { capture: true, signal });
      newAnchor.addEventListener("focus", this.handleFocus, { capture: true, signal });
      newAnchor.addEventListener("click", this.handleClick, { signal });
      newAnchor.addEventListener("mousedown", this.handleMouseDown, { signal });
      newAnchor.addEventListener("mouseover", this.handleMouseOver, { signal });
      newAnchor.addEventListener("mouseout", this.handleMouseOut, { signal });
    }
    if (oldAnchor) {
      this.removeFromAriaLabelledBy(oldAnchor, this.id);
      oldAnchor.removeEventListener("blur", this.handleBlur, { capture: true });
      oldAnchor.removeEventListener("focus", this.handleFocus, { capture: true });
      oldAnchor.removeEventListener("click", this.handleClick);
      oldAnchor.removeEventListener("mousedown", this.handleMouseDown);
      oldAnchor.removeEventListener("mouseover", this.handleMouseOver);
      oldAnchor.removeEventListener("mouseout", this.handleMouseOut);
    }
    this.anchor = newAnchor;
  }
  async handleOptionsChange() {
    if (this.hasUpdated) {
      await this.updateComplete;
      this.popup.reposition();
    }
  }
  handleDisabledChange() {
    if (this.disabled && this.open) {
      this.hide();
    }
  }
  /** Shows the tooltip. */
  async show() {
    if (this.open) {
      return void 0;
    }
    this.open = true;
    return waitForEvent(this, "wa-after-show");
  }
  /** Hides the tooltip */
  async hide() {
    if (!this.open) {
      return void 0;
    }
    this.open = false;
    return waitForEvent(this, "wa-after-hide");
  }
  render() {
    return b2`
      <wa-popup
        part="base tooltip"
        exportparts="
          popup:base__popup,
          arrow:base__arrow
        "
        class=${e7({
      tooltip: true,
      "tooltip-open": this.open
    })}
        placement=${this.placement}
        distance=${this.distance}
        skidding=${this.skidding}
        flip
        shift
        ?arrow=${!this.withoutArrow}
        hover-bridge
        .anchor=${this.anchor}
      >
        <div part="body" class="body">
          <slot></slot>
        </div>
      </wa-popup>
    `;
  }
};
WaTooltip.css = tooltip_styles_default;
WaTooltip.dependencies = { "wa-popup": WaPopup };
__decorateClass([
  e5("slot:not([name])")
], WaTooltip.prototype, "defaultSlot", 2);
__decorateClass([
  e5(".body")
], WaTooltip.prototype, "body", 2);
__decorateClass([
  e5("wa-popup")
], WaTooltip.prototype, "popup", 2);
__decorateClass([
  n4()
], WaTooltip.prototype, "placement", 2);
__decorateClass([
  n4({ type: Boolean, reflect: true })
], WaTooltip.prototype, "disabled", 2);
__decorateClass([
  n4({ type: Number })
], WaTooltip.prototype, "distance", 2);
__decorateClass([
  n4({ type: Boolean, reflect: true })
], WaTooltip.prototype, "open", 2);
__decorateClass([
  n4({ type: Number })
], WaTooltip.prototype, "skidding", 2);
__decorateClass([
  n4({ attribute: "show-delay", type: Number })
], WaTooltip.prototype, "showDelay", 2);
__decorateClass([
  n4({ attribute: "hide-delay", type: Number })
], WaTooltip.prototype, "hideDelay", 2);
__decorateClass([
  n4()
], WaTooltip.prototype, "trigger", 2);
__decorateClass([
  n4({ attribute: "without-arrow", type: Boolean, reflect: true })
], WaTooltip.prototype, "withoutArrow", 2);
__decorateClass([
  n4()
], WaTooltip.prototype, "for", 2);
__decorateClass([
  r5()
], WaTooltip.prototype, "anchor", 2);
__decorateClass([
  watch("open", { waitUntilFirstUpdate: true })
], WaTooltip.prototype, "handleOpenChange", 1);
__decorateClass([
  watch("for")
], WaTooltip.prototype, "handleForChange", 1);
__decorateClass([
  watch(["distance", "placement", "skidding"])
], WaTooltip.prototype, "handleOptionsChange", 1);
__decorateClass([
  watch("disabled")
], WaTooltip.prototype, "handleDisabledChange", 1);
WaTooltip = __decorateClass([
  t3("wa-tooltip")
], WaTooltip);

// node_modules/@github/relative-time-element/dist/intl-cache.js
var __classPrivateFieldGet = function(receiver, state2, kind, f3) {
  if (kind === "a" && !f3) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state2 === "function" ? receiver !== state2 || !f3 : !state2.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f3 : kind === "a" ? f3.call(receiver) : f3 ? f3.value : state2.get(receiver);
};
var _LRUCache_map;
var LRUCache = class {
  constructor(max2 = 100) {
    this.max = max2;
    _LRUCache_map.set(this, /* @__PURE__ */ new Map());
  }
  get(key) {
    const value = __classPrivateFieldGet(this, _LRUCache_map, "f").get(key);
    if (value !== void 0) {
      __classPrivateFieldGet(this, _LRUCache_map, "f").delete(key);
      __classPrivateFieldGet(this, _LRUCache_map, "f").set(key, value);
    }
    return value;
  }
  set(key, value) {
    __classPrivateFieldGet(this, _LRUCache_map, "f").delete(key);
    __classPrivateFieldGet(this, _LRUCache_map, "f").set(key, value);
    if (__classPrivateFieldGet(this, _LRUCache_map, "f").size > this.max) {
      __classPrivateFieldGet(this, _LRUCache_map, "f").delete(__classPrivateFieldGet(this, _LRUCache_map, "f").keys().next().value);
    }
  }
  clear() {
    __classPrivateFieldGet(this, _LRUCache_map, "f").clear();
  }
};
_LRUCache_map = /* @__PURE__ */ new WeakMap();
var registeredCaches = [];
function createCache(max2) {
  const cache = new LRUCache(max2);
  registeredCaches.push(cache);
  return cache;
}
function clearIntlCache() {
  for (const cache of registeredCaches)
    cache.clear();
}
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("languagechange", clearIntlCache);
}
function cacheKey(locale, options) {
  return `${locale}\0${options ? JSON.stringify(options) : ""}`;
}
var dateTimeFormats = createCache();
function dateTimeFormat(locale, options) {
  const key = cacheKey(locale, options);
  let format = dateTimeFormats.get(key);
  if (!format)
    dateTimeFormats.set(key, format = new Intl.DateTimeFormat(locale, options));
  return format;
}
var relativeTimeFormats = createCache();
function relativeTimeFormat(locale, options) {
  const key = cacheKey(locale, options);
  let format = relativeTimeFormats.get(key);
  if (!format)
    relativeTimeFormats.set(key, format = new Intl.RelativeTimeFormat(locale, options));
  return format;
}
var numberFormats = createCache();
function numberFormat(locale, options) {
  const key = cacheKey(locale, options);
  let format = numberFormats.get(key);
  if (!format)
    numberFormats.set(key, format = new Intl.NumberFormat(locale, options));
  return format;
}
var locales = createCache();
function getLocale(tag) {
  let value = locales.get(tag);
  if (!value)
    locales.set(tag, value = new Intl.Locale(tag));
  return value;
}

// node_modules/@github/relative-time-element/dist/duration-format-ponyfill.js
var __classPrivateFieldSet = function(receiver, state2, value, kind, f3) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f3) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state2 === "function" ? receiver !== state2 || !f3 : !state2.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f3.call(receiver, value) : f3 ? f3.value = value : state2.set(receiver, value), value;
};
var __classPrivateFieldGet2 = function(receiver, state2, kind, f3) {
  if (kind === "a" && !f3) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state2 === "function" ? receiver !== state2 || !f3 : !state2.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f3 : kind === "a" ? f3.call(receiver) : f3 ? f3.value : state2.get(receiver);
};
var _DurationFormat_options;
var ListFormatPonyFill = class {
  formatToParts(members) {
    const parts3 = [];
    for (const value of members) {
      parts3.push({ type: "element", value });
      parts3.push({ type: "literal", value: ", " });
    }
    return parts3.slice(0, -1);
  }
};
var ListFormat = typeof Intl !== "undefined" && Intl.ListFormat || ListFormatPonyFill;
var listFormats = createCache();
function listFormat(locale, options) {
  const key = `${locale}\0${JSON.stringify(options)}`;
  let format = listFormats.get(key);
  if (!format)
    listFormats.set(key, format = new ListFormat(locale, options));
  return format;
}
var partsTable = [
  ["years", "year"],
  ["months", "month"],
  ["weeks", "week"],
  ["days", "day"],
  ["hours", "hour"],
  ["minutes", "minute"],
  ["seconds", "second"],
  ["milliseconds", "millisecond"]
];
var twoDigitFormatOptions = { minimumIntegerDigits: 2 };
var DurationFormat = class {
  constructor(locale, options = {}) {
    _DurationFormat_options.set(this, void 0);
    let style = String(options.style || "short");
    if (style !== "long" && style !== "short" && style !== "narrow" && style !== "digital")
      style = "short";
    let prevStyle = style === "digital" ? "numeric" : style;
    const hours = options.hours || prevStyle;
    prevStyle = hours === "2-digit" ? "numeric" : hours;
    const minutes = options.minutes || prevStyle;
    prevStyle = minutes === "2-digit" ? "numeric" : minutes;
    const seconds = options.seconds || prevStyle;
    prevStyle = seconds === "2-digit" ? "numeric" : seconds;
    const milliseconds = options.milliseconds || prevStyle;
    __classPrivateFieldSet(this, _DurationFormat_options, {
      locale,
      style,
      years: options.years || style === "digital" ? "short" : style,
      yearsDisplay: options.yearsDisplay === "always" ? "always" : "auto",
      months: options.months || style === "digital" ? "short" : style,
      monthsDisplay: options.monthsDisplay === "always" ? "always" : "auto",
      weeks: options.weeks || style === "digital" ? "short" : style,
      weeksDisplay: options.weeksDisplay === "always" ? "always" : "auto",
      days: options.days || style === "digital" ? "short" : style,
      daysDisplay: options.daysDisplay === "always" ? "always" : "auto",
      hours,
      hoursDisplay: options.hoursDisplay === "always" ? "always" : style === "digital" ? "always" : "auto",
      minutes,
      minutesDisplay: options.minutesDisplay === "always" ? "always" : style === "digital" ? "always" : "auto",
      seconds,
      secondsDisplay: options.secondsDisplay === "always" ? "always" : style === "digital" ? "always" : "auto",
      milliseconds,
      millisecondsDisplay: options.millisecondsDisplay === "always" ? "always" : "auto"
    }, "f");
  }
  resolvedOptions() {
    return __classPrivateFieldGet2(this, _DurationFormat_options, "f");
  }
  formatToParts(duration) {
    const list = [];
    const options = __classPrivateFieldGet2(this, _DurationFormat_options, "f");
    const style = options.style;
    const locale = options.locale;
    for (const [unit, nfUnit] of partsTable) {
      const value = duration[unit];
      if (options[`${unit}Display`] === "auto" && !value)
        continue;
      const unitStyle = options[unit];
      const nfOpts = unitStyle === "2-digit" ? twoDigitFormatOptions : unitStyle === "numeric" ? {} : { style: "unit", unit: nfUnit, unitDisplay: unitStyle };
      let formattedValue = numberFormat(locale, nfOpts).format(value);
      if (unit === "months" && (unitStyle === "narrow" || style === "narrow" && formattedValue.endsWith("m"))) {
        formattedValue = formattedValue.replace(/(\d+)m$/, "$1mo");
      }
      list.push(formattedValue);
    }
    return listFormat(locale, {
      type: "unit",
      style: style === "digital" ? "short" : style
    }).formatToParts(list);
  }
  format(duration) {
    return this.formatToParts(duration).map((p3) => p3.value).join("");
  }
};
_DurationFormat_options = /* @__PURE__ */ new WeakMap();

// node_modules/@github/relative-time-element/dist/duration.js
var durationRe = /^[-+]?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
var durationFormats = createCache();
var durationFormatOptionFields = [
  "style",
  "years",
  "yearsDisplay",
  "months",
  "monthsDisplay",
  "weeks",
  "weeksDisplay",
  "days",
  "daysDisplay",
  "hours",
  "hoursDisplay",
  "minutes",
  "minutesDisplay",
  "seconds",
  "secondsDisplay",
  "milliseconds",
  "millisecondsDisplay"
];
function durationFormatKey(locale, opts) {
  var _a;
  let key = locale;
  for (const field of durationFormatOptionFields) {
    key += `\0${(_a = opts[field]) !== null && _a !== void 0 ? _a : ""}`;
  }
  return key;
}
var unitNames = ["year", "month", "week", "day", "hour", "minute", "second", "millisecond"];
var isDuration = (str) => durationRe.test(str);
var Duration = class _Duration {
  constructor(years = 0, months = 0, weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0) {
    this.years = years;
    this.months = months;
    this.weeks = weeks;
    this.days = days;
    this.hours = hours;
    this.minutes = minutes;
    this.seconds = seconds;
    this.milliseconds = milliseconds;
    this.years || (this.years = 0);
    this.sign || (this.sign = Math.sign(this.years));
    this.months || (this.months = 0);
    this.sign || (this.sign = Math.sign(this.months));
    this.weeks || (this.weeks = 0);
    this.sign || (this.sign = Math.sign(this.weeks));
    this.days || (this.days = 0);
    this.sign || (this.sign = Math.sign(this.days));
    this.hours || (this.hours = 0);
    this.sign || (this.sign = Math.sign(this.hours));
    this.minutes || (this.minutes = 0);
    this.sign || (this.sign = Math.sign(this.minutes));
    this.seconds || (this.seconds = 0);
    this.sign || (this.sign = Math.sign(this.seconds));
    this.milliseconds || (this.milliseconds = 0);
    this.sign || (this.sign = Math.sign(this.milliseconds));
    this.blank = this.sign === 0;
  }
  abs() {
    return new _Duration(Math.abs(this.years), Math.abs(this.months), Math.abs(this.weeks), Math.abs(this.days), Math.abs(this.hours), Math.abs(this.minutes), Math.abs(this.seconds), Math.abs(this.milliseconds));
  }
  static from(durationLike) {
    var _a;
    if (typeof durationLike === "string") {
      const str = String(durationLike).trim();
      const factor = str.startsWith("-") ? -1 : 1;
      const parsed = (_a = str.match(durationRe)) === null || _a === void 0 ? void 0 : _a.slice(1).map((x2) => (Number(x2) || 0) * factor);
      if (!parsed)
        return new _Duration();
      return new _Duration(...parsed);
    } else if (typeof durationLike === "object") {
      const { years, months, weeks, days, hours, minutes, seconds, milliseconds } = durationLike;
      return new _Duration(years, months, weeks, days, hours, minutes, seconds, milliseconds);
    }
    throw new RangeError("invalid duration");
  }
  static compare(one, two) {
    const now = Date.now();
    const oneApplied = Math.abs(applyDuration(now, _Duration.from(one)).getTime() - now);
    const twoApplied = Math.abs(applyDuration(now, _Duration.from(two)).getTime() - now);
    return oneApplied > twoApplied ? -1 : oneApplied < twoApplied ? 1 : 0;
  }
  toLocaleString(locale, opts) {
    const key = durationFormatKey(locale, opts);
    let format = durationFormats.get(key);
    if (!format)
      durationFormats.set(key, format = new DurationFormat(locale, opts));
    return format.format(this);
  }
};
function applyDuration(date, duration) {
  const r7 = new Date(date);
  if (duration.sign < 0) {
    r7.setUTCSeconds(r7.getUTCSeconds() + duration.seconds);
    r7.setUTCMinutes(r7.getUTCMinutes() + duration.minutes);
    r7.setUTCHours(r7.getUTCHours() + duration.hours);
    r7.setUTCDate(r7.getUTCDate() + duration.weeks * 7 + duration.days);
    r7.setUTCMonth(r7.getUTCMonth() + duration.months);
    r7.setUTCFullYear(r7.getUTCFullYear() + duration.years);
  } else {
    r7.setUTCFullYear(r7.getUTCFullYear() + duration.years);
    r7.setUTCMonth(r7.getUTCMonth() + duration.months);
    r7.setUTCDate(r7.getUTCDate() + duration.weeks * 7 + duration.days);
    r7.setUTCHours(r7.getUTCHours() + duration.hours);
    r7.setUTCMinutes(r7.getUTCMinutes() + duration.minutes);
    r7.setUTCSeconds(r7.getUTCSeconds() + duration.seconds);
  }
  return r7;
}
function elapsedTime(date, precision = "second", now = Date.now()) {
  const delta = date.getTime() - now;
  if (delta === 0)
    return new Duration();
  const sign = Math.sign(delta);
  const ms = Math.abs(delta);
  const sec = Math.floor(ms / 1e3);
  const min2 = Math.floor(sec / 60);
  const hr = Math.floor(min2 / 60);
  const day = Math.floor(hr / 24);
  const month = Math.floor(day / 30);
  const year = Math.floor(month / 12);
  const i8 = unitNames.indexOf(precision);
  return new Duration(i8 >= 0 ? year * sign : 0, i8 >= 1 ? (month - year * 12) * sign : 0, 0, i8 >= 3 ? (day - month * 30) * sign : 0, i8 >= 4 ? (hr - day * 24) * sign : 0, i8 >= 5 ? (min2 - hr * 60) * sign : 0, i8 >= 6 ? (sec - min2 * 60) * sign : 0, i8 >= 7 ? (ms - sec * 1e3) * sign : 0);
}
function roundToSingleUnit(duration, { relativeTo = Date.now() } = {}) {
  relativeTo = new Date(relativeTo);
  if (duration.blank)
    return duration;
  const sign = duration.sign;
  let years = Math.abs(duration.years);
  let months = Math.abs(duration.months);
  let weeks = Math.abs(duration.weeks);
  let days = Math.abs(duration.days);
  let hours = Math.abs(duration.hours);
  let minutes = Math.abs(duration.minutes);
  let seconds = Math.abs(duration.seconds);
  let milliseconds = Math.abs(duration.milliseconds);
  if (milliseconds >= 900)
    seconds += Math.round(milliseconds / 1e3);
  if (seconds || minutes || hours || days || weeks || months || years) {
    milliseconds = 0;
  }
  if (seconds >= 55)
    minutes += Math.round(seconds / 60);
  if (minutes || hours || days || weeks || months || years)
    seconds = 0;
  if (minutes >= 55)
    hours += Math.round(minutes / 60);
  if (hours || days || weeks || months || years)
    minutes = 0;
  if (days && hours >= 12)
    days += Math.round(hours / 24);
  if (!days && hours >= 21)
    days += Math.round(hours / 24);
  if (days || weeks || months || years)
    hours = 0;
  const currentYear = relativeTo.getFullYear();
  const currentMonth = relativeTo.getMonth();
  const currentDate = relativeTo.getDate();
  if (days >= 27 || years + months + days) {
    const newMonthDate = new Date(relativeTo);
    newMonthDate.setDate(1);
    newMonthDate.setMonth(currentMonth + months * sign + 1);
    newMonthDate.setDate(0);
    const monthDateCorrection = Math.max(0, currentDate - newMonthDate.getDate());
    const newDate = new Date(relativeTo);
    newDate.setFullYear(currentYear + years * sign);
    newDate.setDate(currentDate - monthDateCorrection);
    newDate.setMonth(currentMonth + months * sign);
    newDate.setDate(currentDate - monthDateCorrection + days * sign);
    const yearDiff = newDate.getFullYear() - relativeTo.getFullYear();
    const monthDiff = newDate.getMonth() - relativeTo.getMonth();
    const daysDiff = Math.abs(Math.round((Number(newDate) - Number(relativeTo)) / 864e5)) + monthDateCorrection;
    const monthsDiff = Math.abs(yearDiff * 12 + monthDiff);
    if (daysDiff < 27) {
      if (days >= 6) {
        weeks += Math.round(days / 7);
        days = 0;
      } else {
        days = daysDiff;
      }
      months = years = 0;
    } else if (monthsDiff <= 11) {
      months = monthsDiff;
      years = 0;
    } else {
      months = 0;
      years = yearDiff * sign;
    }
    if (months || years)
      days = 0;
  }
  if (years)
    months = 0;
  if (weeks >= 4)
    months += Math.round(weeks / 4);
  if (months || years)
    weeks = 0;
  if (days && weeks && !months && !years) {
    weeks += Math.round(days / 7);
    days = 0;
  }
  return new Duration(years * sign, months * sign, weeks * sign, days * sign, hours * sign, minutes * sign, seconds * sign, milliseconds * sign);
}
function getRelativeTimeUnit(duration, opts) {
  const rounded = roundToSingleUnit(duration, opts);
  if (rounded.blank)
    return [0, "second"];
  for (const unit of unitNames) {
    if (unit === "millisecond")
      continue;
    const val = rounded[`${unit}s`];
    if (val)
      return [val, unit];
  }
  return [0, "second"];
}

// node_modules/@github/relative-time-element/dist/relative-time-element.js
var __classPrivateFieldGet3 = function(receiver, state2, kind, f3) {
  if (kind === "a" && !f3) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state2 === "function" ? receiver !== state2 || !f3 : !state2.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f3 : kind === "a" ? f3.call(receiver) : f3 ? f3.value : state2.get(receiver);
};
var __classPrivateFieldSet2 = function(receiver, state2, value, kind, f3) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f3) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state2 === "function" ? receiver !== state2 || !f3 : !state2.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f3.call(receiver, value) : f3 ? f3.value = value : state2.set(receiver, value), value;
};
var _RelativeTimeElement_instances;
var _RelativeTimeElement_customTitle;
var _RelativeTimeElement_updating;
var _RelativeTimeElement_lang_get;
var _RelativeTimeElement_renderRoot;
var _RelativeTimeElement_getFormattedTitle;
var _RelativeTimeElement_getExplicitThreshold;
var _RelativeTimeElement_resolveFormat;
var _RelativeTimeElement_getMicroDuration;
var _RelativeTimeElement_getMicroRelativeFormat;
var _RelativeTimeElement_getDurationFormat;
var _RelativeTimeElement_getRelativeFormat;
var _RelativeTimeElement_getDateTimeFormat;
var _RelativeTimeElement_isToday;
var _RelativeTimeElement_isCurrentYear;
var _RelativeTimeElement_getUserPreferredAbsoluteTimeFormat;
var _RelativeTimeElement_updateRenderRootContent;
var _RelativeTimeElement_shouldDisplayUserPreferredAbsoluteTime;
var _RelativeTimeElement_onRelativeTimeUpdated;
var HTMLElement2 = globalThis.HTMLElement || null;
var emptyDuration = new Duration();
var microEmptyDuration = new Duration(0, 0, 0, 0, 0, 1);
var RelativeTimeUpdatedEvent = class extends Event {
  constructor(oldText, newText, oldTitle, newTitle) {
    super("relative-time-updated", { bubbles: true, composed: true });
    this.oldText = oldText;
    this.newText = newText;
    this.oldTitle = oldTitle;
    this.newTitle = newTitle;
  }
};
function getUnitFactor(el) {
  const date = el.date;
  if (!date)
    return Infinity;
  const now = Date.now();
  if (el.format === "duration" || el.format === "elapsed") {
    const precision = el.precision;
    if (precision === "second") {
      return 1e3;
    } else if (precision === "minute") {
      return 60 * 1e3;
    }
  }
  const ms = Math.abs(now - date.getTime());
  let factor = 60 * 60 * 1e3;
  if (ms < 60 * 1e3) {
    factor = 1e3;
  } else if (ms < 60 * 60 * 1e3) {
    factor = 60 * 1e3;
  }
  const threshold = getExplicitThreshold(el);
  if (el.format === "micro" && threshold) {
    const thresholdDuration = Duration.from(threshold);
    const signedThresholdDuration = date.getTime() > now ? negateDuration(thresholdDuration) : thresholdDuration;
    const thresholdTime = applyDuration(date, signedThresholdDuration).getTime();
    const msUntilThreshold = thresholdTime - now;
    if (msUntilThreshold > 0)
      factor = Math.min(factor, msUntilThreshold);
  }
  return factor;
}
function negateDuration(duration) {
  return new Duration(-duration.years, -duration.months, -duration.weeks, -duration.days, -duration.hours, -duration.minutes, -duration.seconds, -duration.milliseconds);
}
function getExplicitThreshold(el) {
  const threshold = el.getAttribute("threshold");
  return threshold && isDuration(threshold) ? threshold : null;
}
var browser12hCycle;
function isBrowser12hCycle() {
  if (browser12hCycle === void 0) {
    try {
      browser12hCycle = new Intl.DateTimeFormat([], { hour: "numeric" }).resolvedOptions().hour12 === true;
    } catch (_a) {
      browser12hCycle = false;
    }
  }
  return browser12hCycle;
}
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("languagechange", () => {
    browser12hCycle = void 0;
  });
}
var dateObserver = new class {
  constructor() {
    this.elements = /* @__PURE__ */ new Set();
    this.time = Infinity;
    this.updating = false;
    this.timer = -1;
  }
  observe(element) {
    this.elements.add(element);
    if (this.updating)
      return;
    const date = element.date;
    if (date && date.getTime()) {
      const ms = getUnitFactor(element);
      const time = Date.now() + ms;
      if (time < this.time || this.time <= Date.now()) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.update(), ms);
        this.time = time;
      }
    }
  }
  unobserve(element) {
    if (!this.elements.has(element))
      return;
    this.elements.delete(element);
  }
  update() {
    clearTimeout(this.timer);
    if (!this.elements.size)
      return;
    let nearestDistance = Infinity;
    this.updating = true;
    try {
      for (const timeEl of this.elements) {
        nearestDistance = Math.min(nearestDistance, getUnitFactor(timeEl));
        timeEl.update();
      }
    } finally {
      this.updating = false;
    }
    this.time = Math.min(60 * 60 * 1e3, nearestDistance);
    this.timer = setTimeout(() => this.update(), this.time);
    this.time += Date.now();
  }
}();
var RelativeTimeElement = class extends HTMLElement2 {
  constructor() {
    super(...arguments);
    _RelativeTimeElement_instances.add(this);
    _RelativeTimeElement_customTitle.set(this, false);
    _RelativeTimeElement_updating.set(this, false);
    _RelativeTimeElement_renderRoot.set(this, this.shadowRoot ? this.shadowRoot : this.attachShadow ? this.attachShadow({ mode: "open" }) : this);
    _RelativeTimeElement_onRelativeTimeUpdated.set(this, null);
  }
  static define(tag = "relative-time", registry3 = customElements) {
    registry3.define(tag, this);
    return this;
  }
  get timeZone() {
    var _a;
    const tz = ((_a = this.closest("[time-zone]")) === null || _a === void 0 ? void 0 : _a.getAttribute("time-zone")) || this.ownerDocument.documentElement.getAttribute("time-zone");
    return tz || void 0;
  }
  get hourCycle() {
    var _a;
    const hc = ((_a = this.closest("[hour-cycle]")) === null || _a === void 0 ? void 0 : _a.getAttribute("hour-cycle")) || this.ownerDocument.documentElement.getAttribute("hour-cycle");
    if (hc === "h11" || hc === "h12" || hc === "h23" || hc === "h24")
      return hc;
    return isBrowser12hCycle() ? "h12" : "h23";
  }
  static get observedAttributes() {
    return [
      "second",
      "minute",
      "hour",
      "weekday",
      "day",
      "month",
      "year",
      "time-zone-name",
      "prefix",
      "threshold",
      "tense",
      "precision",
      "format",
      "format-style",
      "no-title",
      "datetime",
      "lang",
      "title",
      "aria-hidden",
      "time-zone",
      "hour-cycle"
    ];
  }
  get onRelativeTimeUpdated() {
    return __classPrivateFieldGet3(this, _RelativeTimeElement_onRelativeTimeUpdated, "f");
  }
  set onRelativeTimeUpdated(listener) {
    if (__classPrivateFieldGet3(this, _RelativeTimeElement_onRelativeTimeUpdated, "f")) {
      this.removeEventListener("relative-time-updated", __classPrivateFieldGet3(this, _RelativeTimeElement_onRelativeTimeUpdated, "f"));
    }
    __classPrivateFieldSet2(this, _RelativeTimeElement_onRelativeTimeUpdated, typeof listener === "object" || typeof listener === "function" ? listener : null, "f");
    if (typeof listener === "function") {
      this.addEventListener("relative-time-updated", listener);
    }
  }
  get second() {
    const second = this.getAttribute("second");
    if (second === "numeric" || second === "2-digit")
      return second;
  }
  set second(value) {
    this.setAttribute("second", value || "");
  }
  get minute() {
    const minute = this.getAttribute("minute");
    if (minute === "numeric" || minute === "2-digit")
      return minute;
  }
  set minute(value) {
    this.setAttribute("minute", value || "");
  }
  get hour() {
    const hour = this.getAttribute("hour");
    if (hour === "numeric" || hour === "2-digit")
      return hour;
  }
  set hour(value) {
    this.setAttribute("hour", value || "");
  }
  get weekday() {
    const weekday = this.getAttribute("weekday");
    if (weekday === "long" || weekday === "short" || weekday === "narrow") {
      return weekday;
    }
    if (this.format === "datetime" && weekday !== "")
      return this.formatStyle;
  }
  set weekday(value) {
    this.setAttribute("weekday", value || "");
  }
  get day() {
    var _a;
    const day = (_a = this.getAttribute("day")) !== null && _a !== void 0 ? _a : "numeric";
    if (day === "numeric" || day === "2-digit")
      return day;
  }
  set day(value) {
    this.setAttribute("day", value || "");
  }
  get month() {
    const format = this.format;
    let month = this.getAttribute("month");
    if (month === "")
      return;
    month !== null && month !== void 0 ? month : month = format === "datetime" ? this.formatStyle : "short";
    if (month === "numeric" || month === "2-digit" || month === "short" || month === "long" || month === "narrow") {
      return month;
    }
  }
  set month(value) {
    this.setAttribute("month", value || "");
  }
  get year() {
    var _a;
    const year = this.getAttribute("year");
    if (year === "numeric" || year === "2-digit")
      return year;
    if (!this.hasAttribute("year") && (/* @__PURE__ */ new Date()).getUTCFullYear() !== ((_a = this.date) === null || _a === void 0 ? void 0 : _a.getUTCFullYear())) {
      return "numeric";
    }
  }
  set year(value) {
    this.setAttribute("year", value || "");
  }
  get timeZoneName() {
    const name = this.getAttribute("time-zone-name");
    if (name === "long" || name === "short" || name === "shortOffset" || name === "longOffset" || name === "shortGeneric" || name === "longGeneric") {
      return name;
    }
  }
  set timeZoneName(value) {
    this.setAttribute("time-zone-name", value || "");
  }
  get prefix() {
    var _a;
    return (_a = this.getAttribute("prefix")) !== null && _a !== void 0 ? _a : this.format === "datetime" ? "" : "on";
  }
  set prefix(value) {
    this.setAttribute("prefix", value);
  }
  get threshold() {
    const threshold = this.getAttribute("threshold");
    return threshold && isDuration(threshold) ? threshold : "P30D";
  }
  set threshold(value) {
    this.setAttribute("threshold", value);
  }
  get tense() {
    const tense = this.getAttribute("tense");
    if (tense === "past")
      return "past";
    if (tense === "future")
      return "future";
    return "auto";
  }
  set tense(value) {
    this.setAttribute("tense", value);
  }
  get precision() {
    const precision = this.getAttribute("precision");
    if (unitNames.includes(precision))
      return precision;
    if (this.format === "micro")
      return "minute";
    return "second";
  }
  set precision(value) {
    this.setAttribute("precision", value);
  }
  get format() {
    const format = this.getAttribute("format");
    if (format === "datetime")
      return "datetime";
    if (format === "relative")
      return "relative";
    if (format === "duration")
      return "duration";
    if (format === "micro")
      return "micro";
    if (format === "elapsed")
      return "elapsed";
    return "auto";
  }
  set format(value) {
    this.setAttribute("format", value);
  }
  get formatStyle() {
    const formatStyle = this.getAttribute("format-style");
    if (formatStyle === "long")
      return "long";
    if (formatStyle === "short")
      return "short";
    if (formatStyle === "narrow")
      return "narrow";
    const format = this.format;
    if (format === "elapsed" || format === "micro")
      return "narrow";
    if (format === "datetime")
      return "short";
    return "long";
  }
  set formatStyle(value) {
    this.setAttribute("format-style", value);
  }
  get noTitle() {
    return this.hasAttribute("no-title");
  }
  set noTitle(value) {
    this.toggleAttribute("no-title", value);
  }
  get datetime() {
    return this.getAttribute("datetime") || "";
  }
  set datetime(value) {
    this.setAttribute("datetime", value);
  }
  get date() {
    const parsed = Date.parse(this.datetime);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  set date(value) {
    this.datetime = (value === null || value === void 0 ? void 0 : value.toISOString()) || "";
  }
  connectedCallback() {
    this.update();
  }
  disconnectedCallback() {
    dateObserver.unobserve(this);
  }
  attributeChangedCallback(attrName, oldValue, newValue) {
    if (oldValue === newValue)
      return;
    if (attrName === "title") {
      __classPrivateFieldSet2(this, _RelativeTimeElement_customTitle, newValue !== null && (this.date && __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_getFormattedTitle).call(this, this.date, __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "a", _RelativeTimeElement_lang_get), this.timeZone, this.hourCycle)) !== newValue, "f");
    }
    if (!__classPrivateFieldGet3(this, _RelativeTimeElement_updating, "f") && !(attrName === "title" && __classPrivateFieldGet3(this, _RelativeTimeElement_customTitle, "f"))) {
      __classPrivateFieldSet2(this, _RelativeTimeElement_updating, (async () => {
        await Promise.resolve();
        this.update();
        __classPrivateFieldSet2(this, _RelativeTimeElement_updating, false, "f");
      })(), "f");
    }
  }
  update() {
    const oldText = __classPrivateFieldGet3(this, _RelativeTimeElement_renderRoot, "f").textContent || this.textContent || "";
    const oldTitle = this.getAttribute("title") || "";
    let newTitle = oldTitle;
    const date = this.date;
    if (typeof Intl === "undefined" || !Intl.DateTimeFormat || !date) {
      __classPrivateFieldGet3(this, _RelativeTimeElement_renderRoot, "f").textContent = oldText;
      return;
    }
    const now = Date.now();
    const locale = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "a", _RelativeTimeElement_lang_get);
    const timeZone = this.timeZone;
    const hourCycle = this.hourCycle;
    if (!__classPrivateFieldGet3(this, _RelativeTimeElement_customTitle, "f")) {
      newTitle = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_getFormattedTitle).call(this, date, locale, timeZone, hourCycle) || "";
      if (newTitle && !this.noTitle && newTitle !== oldTitle)
        this.setAttribute("title", newTitle);
    }
    const duration = elapsedTime(date, this.precision, now);
    const format = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_resolveFormat).call(this, duration, elapsedTime(date, "millisecond", now));
    let newText = oldText;
    const displayUserPreferredAbsoluteTime = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_shouldDisplayUserPreferredAbsoluteTime).call(this, format);
    if (displayUserPreferredAbsoluteTime) {
      newText = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_getUserPreferredAbsoluteTimeFormat).call(this, date, locale, timeZone, hourCycle);
    } else {
      if (format === "duration") {
        if (this.format === "micro" && this.tense !== "auto" && Intl.RelativeTimeFormat) {
          newText = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_getMicroRelativeFormat).call(this, duration, locale);
        } else {
          newText = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_getDurationFormat).call(this, duration, locale);
        }
      } else if (format === "relative") {
        newText = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_getRelativeFormat).call(this, duration, locale);
      } else {
        newText = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_getDateTimeFormat).call(this, date, locale, timeZone, hourCycle);
      }
    }
    if (newText) {
      __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_updateRenderRootContent).call(this, newText);
    } else if (this.shadowRoot === __classPrivateFieldGet3(this, _RelativeTimeElement_renderRoot, "f") && this.textContent) {
      __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_updateRenderRootContent).call(this, this.textContent);
    }
    if (newText !== oldText || newTitle !== oldTitle) {
      this.dispatchEvent(new RelativeTimeUpdatedEvent(oldText, newText, oldTitle, newTitle));
    }
    const shouldObserve = !displayUserPreferredAbsoluteTime && (format === "relative" || format === "duration") || this.format === "micro" && Boolean(__classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_getExplicitThreshold).call(this)) && date.getTime() > now || displayUserPreferredAbsoluteTime && (__classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_isToday).call(this, date, locale, timeZone) || __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_isCurrentYear).call(this, date, locale, timeZone));
    if (shouldObserve) {
      dateObserver.observe(this);
    } else {
      dateObserver.unobserve(this);
    }
  }
};
_RelativeTimeElement_customTitle = /* @__PURE__ */ new WeakMap(), _RelativeTimeElement_updating = /* @__PURE__ */ new WeakMap(), _RelativeTimeElement_renderRoot = /* @__PURE__ */ new WeakMap(), _RelativeTimeElement_onRelativeTimeUpdated = /* @__PURE__ */ new WeakMap(), _RelativeTimeElement_instances = /* @__PURE__ */ new WeakSet(), _RelativeTimeElement_lang_get = function _RelativeTimeElement_lang_get2() {
  var _a;
  const lang = ((_a = this.closest("[lang]")) === null || _a === void 0 ? void 0 : _a.getAttribute("lang")) || this.ownerDocument.documentElement.getAttribute("lang");
  if (!lang)
    return "default";
  try {
    return getLocale(lang).toString();
  } catch (_b) {
    return "default";
  }
}, _RelativeTimeElement_getFormattedTitle = function _RelativeTimeElement_getFormattedTitle2(date, locale, timeZone, hourCycle) {
  return dateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
    hourCycle
  }).format(date);
}, _RelativeTimeElement_getExplicitThreshold = function _RelativeTimeElement_getExplicitThreshold2() {
  return getExplicitThreshold(this);
}, _RelativeTimeElement_resolveFormat = function _RelativeTimeElement_resolveFormat2(duration, thresholdDuration = duration) {
  const format = this.format;
  if (format === "datetime")
    return "datetime";
  if (format === "duration")
    return "duration";
  if (format === "elapsed")
    return "duration";
  if (format === "micro") {
    const threshold = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_getExplicitThreshold).call(this);
    if (threshold && Duration.compare(thresholdDuration, threshold) === -1)
      return "datetime";
    return "duration";
  }
  if ((format === "auto" || format === "relative") && typeof Intl !== "undefined" && Intl.RelativeTimeFormat) {
    const tense = this.tense;
    if (tense === "past" || tense === "future")
      return "relative";
    if (Duration.compare(duration, this.threshold) === 1)
      return "relative";
  }
  return "datetime";
}, _RelativeTimeElement_getMicroDuration = function _RelativeTimeElement_getMicroDuration2(duration) {
  duration = roundToSingleUnit(duration);
  if (duration.months === 0 && (this.tense === "past" && duration.sign !== -1 || this.tense === "future" && duration.sign !== 1)) {
    return microEmptyDuration;
  }
  return duration;
}, _RelativeTimeElement_getMicroRelativeFormat = function _RelativeTimeElement_getMicroRelativeFormat2(duration, locale) {
  const relativeFormat = relativeTimeFormat(locale, {
    numeric: "always",
    style: "narrow"
  });
  duration = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_getMicroDuration).call(this, duration);
  const [int, unit] = getRelativeTimeUnit(duration.blank ? microEmptyDuration : duration);
  return relativeFormat.format(Math.abs(int) * (this.tense === "past" ? -1 : 1), unit);
}, _RelativeTimeElement_getDurationFormat = function _RelativeTimeElement_getDurationFormat2(duration, locale) {
  const format = this.format;
  const style = this.formatStyle;
  const tense = this.tense;
  let empty = emptyDuration;
  if (format === "micro") {
    duration = __classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_getMicroDuration).call(this, duration);
    empty = microEmptyDuration;
  } else if (tense === "past" && duration.sign !== -1 || tense === "future" && duration.sign !== 1) {
    duration = empty;
  }
  const display = `${this.precision}sDisplay`;
  if (duration.blank) {
    return empty.toLocaleString(locale, { style, [display]: "always" });
  }
  return duration.abs().toLocaleString(locale, { style });
}, _RelativeTimeElement_getRelativeFormat = function _RelativeTimeElement_getRelativeFormat2(duration, locale) {
  const relativeFormat = relativeTimeFormat(locale, {
    numeric: "auto",
    style: this.formatStyle
  });
  const tense = this.tense;
  if (tense === "future" && duration.sign !== 1)
    duration = emptyDuration;
  if (tense === "past" && duration.sign !== -1)
    duration = emptyDuration;
  const [int, unit] = getRelativeTimeUnit(duration);
  if (unit === "second" && int < 10) {
    return relativeFormat.format(0, this.precision === "millisecond" ? "second" : this.precision);
  }
  return relativeFormat.format(int, unit);
}, _RelativeTimeElement_getDateTimeFormat = function _RelativeTimeElement_getDateTimeFormat2(date, locale, timeZone, hourCycle) {
  const formatter = dateTimeFormat(locale, {
    second: this.second,
    minute: this.minute,
    hour: this.hour,
    weekday: this.weekday,
    day: this.day,
    month: this.month,
    year: this.year,
    timeZoneName: this.timeZoneName,
    timeZone,
    hourCycle
  });
  return `${this.prefix} ${formatter.format(date)}`.trim();
}, _RelativeTimeElement_isToday = function _RelativeTimeElement_isToday2(date, locale, timeZone) {
  const now = /* @__PURE__ */ new Date();
  const formatter = dateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(now) === formatter.format(date);
}, _RelativeTimeElement_isCurrentYear = function _RelativeTimeElement_isCurrentYear2(date, locale, timeZone) {
  const now = /* @__PURE__ */ new Date();
  const formatter = dateTimeFormat(locale, {
    timeZone,
    year: "numeric"
  });
  return formatter.format(now) === formatter.format(date);
}, _RelativeTimeElement_getUserPreferredAbsoluteTimeFormat = function _RelativeTimeElement_getUserPreferredAbsoluteTimeFormat2(date, locale, timeZone, hourCycle) {
  const timeOnlyOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
    hourCycle
  };
  if (__classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_isToday).call(this, date, locale, timeZone)) {
    const relativeFormatter = relativeTimeFormat(locale, { numeric: "auto" });
    let todayText = relativeFormatter.format(0, "day");
    todayText = todayText.charAt(0).toLocaleUpperCase(locale) + todayText.slice(1);
    const timeOnly = dateTimeFormat(locale, timeOnlyOptions).format(date);
    return `${todayText} ${timeOnly}`;
  }
  const timeAndDateOptions = Object.assign(Object.assign({}, timeOnlyOptions), { day: "numeric", month: "short" });
  if (__classPrivateFieldGet3(this, _RelativeTimeElement_instances, "m", _RelativeTimeElement_isCurrentYear).call(this, date, locale, timeZone)) {
    return dateTimeFormat(locale, timeAndDateOptions).format(date);
  }
  return dateTimeFormat(locale, Object.assign(Object.assign({}, timeAndDateOptions), { year: "numeric" })).format(date);
}, _RelativeTimeElement_updateRenderRootContent = function _RelativeTimeElement_updateRenderRootContent2(content) {
  const root2 = __classPrivateFieldGet3(this, _RelativeTimeElement_renderRoot, "f");
  const ariaHidden = this.hasAttribute("aria-hidden") && this.getAttribute("aria-hidden") === "true";
  let span = root2.firstElementChild;
  if (!span || span.getAttribute("part") !== "root" || root2.childNodes.length !== 1) {
    span = document.createElement("span");
    span.setAttribute("part", "root");
    root2.replaceChildren(span);
  }
  if (ariaHidden) {
    if (span.getAttribute("aria-hidden") !== "true")
      span.setAttribute("aria-hidden", "true");
  } else if (span.hasAttribute("aria-hidden")) {
    span.removeAttribute("aria-hidden");
  }
  if (span.textContent !== content) {
    span.textContent = content;
  }
}, _RelativeTimeElement_shouldDisplayUserPreferredAbsoluteTime = function _RelativeTimeElement_shouldDisplayUserPreferredAbsoluteTime2(format) {
  var _a;
  if (format === "duration" && this.format !== "micro")
    return false;
  return this.ownerDocument.documentElement.getAttribute("data-prefers-absolute-time") === "true" || ((_a = this.ownerDocument.body) === null || _a === void 0 ? void 0 : _a.getAttribute("data-prefers-absolute-time")) === "true";
};

// node_modules/@github/relative-time-element/dist/relative-time-element-define.js
var root = typeof globalThis !== "undefined" ? globalThis : window;
try {
  root.RelativeTimeElement = RelativeTimeElement.define();
} catch (e9) {
  if (!(root.DOMException && e9 instanceof DOMException && e9.name === "NotSupportedError") && !(e9 instanceof ReferenceError)) {
    throw e9;
  }
}

// node_modules/tom-select/dist/esm/contrib/microevent.js
function forEvents(events, callback) {
  events.split(/\s+/).forEach((event) => {
    callback(event);
  });
}
var MicroEvent = class {
  constructor() {
    this._events = {};
  }
  on(events, fct) {
    forEvents(events, (event) => {
      const event_array = this._events[event] || [];
      event_array.push(fct);
      this._events[event] = event_array;
    });
  }
  off(events, fct) {
    var n6 = arguments.length;
    if (n6 === 0) {
      this._events = {};
      return;
    }
    forEvents(events, (event) => {
      if (n6 === 1) {
        delete this._events[event];
        return;
      }
      const event_array = this._events[event];
      if (event_array === void 0)
        return;
      event_array.splice(event_array.indexOf(fct), 1);
      this._events[event] = event_array;
    });
  }
  trigger(events, ...args) {
    var self2 = this;
    forEvents(events, (event) => {
      const event_array = self2._events[event];
      if (event_array === void 0)
        return;
      event_array.forEach((fct) => {
        fct.apply(self2, args);
      });
    });
  }
};

// node_modules/tom-select/dist/esm/contrib/microplugin.js
function MicroPlugin(Interface) {
  Interface.plugins = {};
  return class extends Interface {
    constructor() {
      super(...arguments);
      this.plugins = {
        names: [],
        settings: {},
        requested: {},
        loaded: {}
      };
    }
    /**
     * Registers a plugin.
     *
     * @param {function} fn
     */
    static define(name, fn) {
      Interface.plugins[name] = {
        "name": name,
        "fn": fn
      };
    }
    /**
     * Initializes the listed plugins (with options).
     * Acceptable formats:
     *
     * List (without options):
     *   ['a', 'b', 'c']
     *
     * List (with options):
     *   [{'name': 'a', options: {}}, {'name': 'b', options: {}}]
     *
     * Hash (with options):
     *   {'a': { ... }, 'b': { ... }, 'c': { ... }}
     *
     * @param {array|object} plugins
     */
    initializePlugins(plugins) {
      var key, name;
      const self2 = this;
      const queue = [];
      if (Array.isArray(plugins)) {
        plugins.forEach((plugin15) => {
          if (typeof plugin15 === "string") {
            queue.push(plugin15);
          } else {
            self2.plugins.settings[plugin15.name] = plugin15.options;
            queue.push(plugin15.name);
          }
        });
      } else if (plugins) {
        for (key in plugins) {
          if (plugins.hasOwnProperty(key)) {
            self2.plugins.settings[key] = plugins[key];
            queue.push(key);
          }
        }
      }
      while (name = queue.shift()) {
        self2.require(name);
      }
    }
    loadPlugin(name) {
      var self2 = this;
      var plugins = self2.plugins;
      var plugin15 = Interface.plugins[name];
      if (!Interface.plugins.hasOwnProperty(name)) {
        throw new Error('Unable to find "' + name + '" plugin');
      }
      plugins.requested[name] = true;
      plugins.loaded[name] = plugin15.fn.apply(self2, [self2.plugins.settings[name] || {}]);
      plugins.names.push(name);
    }
    /**
     * Initializes a plugin.
     *
     */
    require(name) {
      var self2 = this;
      var plugins = self2.plugins;
      if (!self2.plugins.loaded.hasOwnProperty(name)) {
        if (plugins.requested[name]) {
          throw new Error('Plugin has circular dependency ("' + name + '")');
        }
        self2.loadPlugin(name);
      }
      return plugins.loaded[name];
    }
  };
}

// node_modules/@orchidjs/unicode-variants/dist/esm/regex.js
var arrayToPattern = (chars) => {
  chars = chars.filter(Boolean);
  if (chars.length < 2) {
    return chars[0] || "";
  }
  return maxValueLength(chars) == 1 ? "[" + chars.join("") + "]" : "(?:" + chars.join("|") + ")";
};
var sequencePattern = (array) => {
  if (!hasDuplicates(array)) {
    return array.join("");
  }
  let pattern = "";
  let prev_char_count = 0;
  const prev_pattern = () => {
    if (prev_char_count > 1) {
      pattern += "{" + prev_char_count + "}";
    }
  };
  array.forEach((char, i8) => {
    if (char === array[i8 - 1]) {
      prev_char_count++;
      return;
    }
    prev_pattern();
    pattern += char;
    prev_char_count = 1;
  });
  prev_pattern();
  return pattern;
};
var setToPattern = (chars) => {
  let array = Array.from(chars);
  return arrayToPattern(array);
};
var hasDuplicates = (array) => {
  return new Set(array).size !== array.length;
};
var escape_regex = (str) => {
  return (str + "").replace(/([\$\(\)\*\+\.\?\[\]\^\{\|\}\\])/gu, "\\$1");
};
var maxValueLength = (array) => {
  return array.reduce((longest, value) => Math.max(longest, unicodeLength(value)), 0);
};
var unicodeLength = (str) => {
  return Array.from(str).length;
};

// node_modules/@orchidjs/unicode-variants/dist/esm/strings.js
var allSubstrings = (input) => {
  if (input.length === 1)
    return [[input]];
  let result = [];
  const start = input.substring(1);
  const suba = allSubstrings(start);
  suba.forEach(function(subresult) {
    let tmp = subresult.slice(0);
    tmp[0] = input.charAt(0) + tmp[0];
    result.push(tmp);
    tmp = subresult.slice(0);
    tmp.unshift(input.charAt(0));
    result.push(tmp);
  });
  return result;
};

// node_modules/@orchidjs/unicode-variants/dist/esm/index.js
var code_points = [[0, 65535]];
var accent_pat = "[\u0300-\u036F\xB7\u02BE\u02BC]";
var unicode_map;
var multi_char_reg;
var max_char_length = 3;
var latin_convert = {};
var latin_condensed = {
  "/": "\u2044\u2215",
  "0": "\u07C0",
  "a": "\u2C65\u0250\u0251",
  "aa": "\uA733",
  "ae": "\xE6\u01FD\u01E3",
  "ao": "\uA735",
  "au": "\uA737",
  "av": "\uA739\uA73B",
  "ay": "\uA73D",
  "b": "\u0180\u0253\u0183",
  "c": "\uA73F\u0188\u023C\u2184",
  "d": "\u0111\u0257\u0256\u1D05\u018C\uABB7\u0501\u0266",
  "e": "\u025B\u01DD\u1D07\u0247",
  "f": "\uA77C\u0192",
  "g": "\u01E5\u0260\uA7A1\u1D79\uA77F\u0262",
  "h": "\u0127\u2C68\u2C76\u0265",
  "i": "\u0268\u0131",
  "j": "\u0249\u0237",
  "k": "\u0199\u2C6A\uA741\uA743\uA745\uA7A3",
  "l": "\u0142\u019A\u026B\u2C61\uA749\uA747\uA781\u026D",
  "m": "\u0271\u026F\u03FB",
  "n": "\uA7A5\u019E\u0272\uA791\u1D0E\u043B\u0509",
  "o": "\xF8\u01FF\u0254\u0275\uA74B\uA74D\u1D11",
  "oe": "\u0153",
  "oi": "\u01A3",
  "oo": "\uA74F",
  "ou": "\u0223",
  "p": "\u01A5\u1D7D\uA751\uA753\uA755\u03C1",
  "q": "\uA757\uA759\u024B",
  "r": "\u024D\u027D\uA75B\uA7A7\uA783",
  "s": "\xDF\u023F\uA7A9\uA785\u0282",
  "t": "\u0167\u01AD\u0288\u2C66\uA787",
  "th": "\xFE",
  "tz": "\uA729",
  "u": "\u0289",
  "v": "\u028B\uA75F\u028C",
  "vy": "\uA761",
  "w": "\u2C73",
  "y": "\u01B4\u024F\u1EFF",
  "z": "\u01B6\u0225\u0240\u2C6C\uA763",
  "hv": "\u0195"
};
for (let latin in latin_condensed) {
  let unicode = latin_condensed[latin] || "";
  for (let i8 = 0; i8 < unicode.length; i8++) {
    let char = unicode.substring(i8, i8 + 1);
    latin_convert[char] = latin;
  }
}
var convert_pat = new RegExp(Object.keys(latin_convert).join("|") + "|" + accent_pat, "gu");
var initialize = (_code_points) => {
  if (unicode_map !== void 0)
    return;
  unicode_map = generateMap(_code_points || code_points);
};
var normalize = (str, form = "NFKD") => str.normalize(form);
var asciifold = (str) => {
  return Array.from(str).reduce(
    /**
     * @param {string} result
     * @param {string} char
     */
    (result, char) => {
      return result + _asciifold(char);
    },
    ""
  );
};
var _asciifold = (str) => {
  str = normalize(str).toLowerCase().replace(convert_pat, (char) => {
    return latin_convert[char] || "";
  });
  return normalize(str, "NFC");
};
function* generator(code_points2) {
  for (const [code_point_min, code_point_max] of code_points2) {
    for (let i8 = code_point_min; i8 <= code_point_max; i8++) {
      let composed = String.fromCharCode(i8);
      let folded = asciifold(composed);
      if (folded == composed.toLowerCase()) {
        continue;
      }
      if (folded.length > max_char_length) {
        continue;
      }
      if (folded.length == 0) {
        continue;
      }
      yield { folded, composed, code_point: i8 };
    }
  }
}
var generateSets = (code_points2) => {
  const unicode_sets = {};
  const addMatching = (folded, to_add) => {
    const folded_set = unicode_sets[folded] || /* @__PURE__ */ new Set();
    const patt = new RegExp("^" + setToPattern(folded_set) + "$", "iu");
    if (to_add.match(patt)) {
      return;
    }
    folded_set.add(escape_regex(to_add));
    unicode_sets[folded] = folded_set;
  };
  for (let value of generator(code_points2)) {
    addMatching(value.folded, value.folded);
    addMatching(value.folded, value.composed);
  }
  return unicode_sets;
};
var generateMap = (code_points2) => {
  const unicode_sets = generateSets(code_points2);
  const unicode_map2 = {};
  let multi_char = [];
  for (let folded in unicode_sets) {
    let set = unicode_sets[folded];
    if (set) {
      unicode_map2[folded] = setToPattern(set);
    }
    if (folded.length > 1) {
      multi_char.push(escape_regex(folded));
    }
  }
  multi_char.sort((a4, b3) => b3.length - a4.length);
  const multi_char_patt = arrayToPattern(multi_char);
  multi_char_reg = new RegExp("^" + multi_char_patt, "u");
  return unicode_map2;
};
var mapSequence = (strings, min_replacement = 1) => {
  let chars_replaced = 0;
  strings = strings.map((str) => {
    if (unicode_map[str]) {
      chars_replaced += str.length;
    }
    return unicode_map[str] || str;
  });
  if (chars_replaced >= min_replacement) {
    return sequencePattern(strings);
  }
  return "";
};
var substringsToPattern = (str, min_replacement = 1) => {
  min_replacement = Math.max(min_replacement, str.length - 1);
  return arrayToPattern(allSubstrings(str).map((sub_pat) => {
    return mapSequence(sub_pat, min_replacement);
  }));
};
var sequencesToPattern = (sequences, all = true) => {
  let min_replacement = sequences.length > 1 ? 1 : 0;
  return arrayToPattern(sequences.map((sequence) => {
    let seq = [];
    const len = all ? sequence.length() : sequence.length() - 1;
    for (let j2 = 0; j2 < len; j2++) {
      seq.push(substringsToPattern(sequence.substrs[j2] || "", min_replacement));
    }
    return sequencePattern(seq);
  }));
};
var inSequences = (needle_seq, sequences) => {
  for (const seq of sequences) {
    if (seq.start != needle_seq.start || seq.end != needle_seq.end) {
      continue;
    }
    if (seq.substrs.join("") !== needle_seq.substrs.join("")) {
      continue;
    }
    let needle_parts = needle_seq.parts;
    const filter = (part) => {
      for (const needle_part of needle_parts) {
        if (needle_part.start === part.start && needle_part.substr === part.substr) {
          return false;
        }
        if (part.length == 1 || needle_part.length == 1) {
          continue;
        }
        if (part.start < needle_part.start && part.end > needle_part.start) {
          return true;
        }
        if (needle_part.start < part.start && needle_part.end > part.start) {
          return true;
        }
      }
      return false;
    };
    let filtered = seq.parts.filter(filter);
    if (filtered.length > 0) {
      continue;
    }
    return true;
  }
  return false;
};
var Sequence = class _Sequence {
  parts;
  substrs;
  start;
  end;
  constructor() {
    this.parts = [];
    this.substrs = [];
    this.start = 0;
    this.end = 0;
  }
  add(part) {
    if (part) {
      this.parts.push(part);
      this.substrs.push(part.substr);
      this.start = Math.min(part.start, this.start);
      this.end = Math.max(part.end, this.end);
    }
  }
  last() {
    return this.parts[this.parts.length - 1];
  }
  length() {
    return this.parts.length;
  }
  clone(position, last_piece) {
    let clone = new _Sequence();
    let parts3 = JSON.parse(JSON.stringify(this.parts));
    let last_part = parts3.pop();
    for (const part of parts3) {
      clone.add(part);
    }
    let last_substr = last_piece.substr.substring(0, position - last_part.start);
    let clone_last_len = last_substr.length;
    clone.add({ start: last_part.start, end: last_part.start + clone_last_len, length: clone_last_len, substr: last_substr });
    return clone;
  }
};
var getPattern = (str) => {
  initialize();
  str = asciifold(str);
  let pattern = "";
  let sequences = [new Sequence()];
  for (let i8 = 0; i8 < str.length; i8++) {
    let substr = str.substring(i8);
    let match2 = substr.match(multi_char_reg);
    const char = str.substring(i8, i8 + 1);
    const match_str = match2 ? match2[0] : null;
    let overlapping = [];
    let added_types = /* @__PURE__ */ new Set();
    for (const sequence of sequences) {
      const last_piece = sequence.last();
      if (!last_piece || last_piece.length == 1 || last_piece.end <= i8) {
        if (match_str) {
          const len = match_str.length;
          sequence.add({ start: i8, end: i8 + len, length: len, substr: match_str });
          added_types.add("1");
        } else {
          sequence.add({ start: i8, end: i8 + 1, length: 1, substr: char });
          added_types.add("2");
        }
      } else if (match_str) {
        let clone = sequence.clone(i8, last_piece);
        const len = match_str.length;
        clone.add({ start: i8, end: i8 + len, length: len, substr: match_str });
        overlapping.push(clone);
      } else {
        added_types.add("3");
      }
    }
    if (overlapping.length > 0) {
      overlapping = overlapping.sort((a4, b3) => {
        return a4.length() - b3.length();
      });
      for (let clone of overlapping) {
        if (inSequences(clone, sequences)) {
          continue;
        }
        sequences.push(clone);
      }
      continue;
    }
    if (i8 > 0 && added_types.size == 1 && !added_types.has("3")) {
      pattern += sequencesToPattern(sequences, false);
      let new_seq = new Sequence();
      const old_seq = sequences[0];
      if (old_seq) {
        new_seq.add(old_seq.last());
      }
      sequences = [new_seq];
    }
  }
  pattern += sequencesToPattern(sequences, true);
  return pattern;
};

// node_modules/@orchidjs/sifter/dist/esm/utils.js
var getAttr = (obj, name) => {
  if (!obj)
    return;
  return obj[name];
};
var getAttrNesting = (obj, name) => {
  if (!obj)
    return;
  var part, names = name.split(".");
  while ((part = names.shift()) && (obj = obj[part]))
    ;
  return obj;
};
var scoreValue = (value, token, weight) => {
  var score, pos;
  if (!value)
    return 0;
  value = value + "";
  if (token.regex == null)
    return 0;
  pos = value.search(token.regex);
  if (pos === -1)
    return 0;
  score = token.string.length / value.length;
  if (pos === 0)
    score += 0.5;
  return score * weight;
};
var propToArray = (obj, key) => {
  var value = obj[key];
  if (typeof value == "function")
    return value;
  if (value && !Array.isArray(value)) {
    obj[key] = [value];
  }
};
var iterate = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};
var cmp = (a4, b3) => {
  if (typeof a4 === "number" && typeof b3 === "number") {
    return a4 > b3 ? 1 : a4 < b3 ? -1 : 0;
  }
  a4 = asciifold(a4 + "").toLowerCase();
  b3 = asciifold(b3 + "").toLowerCase();
  if (a4 > b3)
    return 1;
  if (b3 > a4)
    return -1;
  return 0;
};

// node_modules/@orchidjs/sifter/dist/esm/sifter.js
var Sifter = class {
  items;
  // []|{};
  settings;
  /**
   * Textually searches arrays and hashes of objects
   * by property (or multiple properties). Designed
   * specifically for autocomplete.
   *
   */
  constructor(items, settings) {
    this.items = items;
    this.settings = settings || { diacritics: true };
  }
  /**
   * Splits a search string into an array of individual
   * regexps to be used to match results.
   *
   */
  tokenize(query, respect_word_boundaries, weights) {
    if (!query || !query.length)
      return [];
    const tokens = [];
    const words = query.split(/\s+/);
    var field_regex;
    if (weights) {
      field_regex = new RegExp("^(" + Object.keys(weights).map(escape_regex).join("|") + "):(.*)$");
    }
    words.forEach((word) => {
      let field_match;
      let field = null;
      let regex = null;
      if (field_regex && (field_match = word.match(field_regex))) {
        field = field_match[1];
        word = field_match[2];
      }
      if (word.length > 0) {
        if (this.settings.diacritics) {
          regex = getPattern(word) || null;
        } else {
          regex = escape_regex(word);
        }
        if (regex && respect_word_boundaries)
          regex = "\\b" + regex;
      }
      tokens.push({
        string: word,
        regex: regex ? new RegExp(regex, "iu") : null,
        field
      });
    });
    return tokens;
  }
  /**
   * Returns a function to be used to score individual results.
   *
   * Good matches will have a higher score than poor matches.
   * If an item is not a match, 0 will be returned by the function.
   *
   * @returns {T.ScoreFn}
   */
  getScoreFunction(query, options) {
    var search = this.prepareSearch(query, options);
    return this._getScoreFunction(search);
  }
  /**
   * @returns {T.ScoreFn}
   *
   */
  _getScoreFunction(search) {
    const tokens = search.tokens, token_count = tokens.length;
    if (!token_count) {
      return function() {
        return 0;
      };
    }
    const fields = search.options.fields, weights = search.weights, field_count = fields.length, getAttrFn = search.getAttrFn;
    if (!field_count) {
      return function() {
        return 1;
      };
    }
    const scoreObject = (function() {
      if (field_count === 1) {
        return function(token, data) {
          const field = fields[0].field;
          return scoreValue(getAttrFn(data, field), token, weights[field] || 1);
        };
      }
      return function(token, data) {
        var sum = 0;
        if (token.field) {
          const value = getAttrFn(data, token.field);
          if (!token.regex && value) {
            sum += 1 / field_count;
          } else {
            sum += scoreValue(value, token, 1);
          }
        } else {
          iterate(weights, (weight, field) => {
            sum += scoreValue(getAttrFn(data, field), token, weight);
          });
        }
        return sum / field_count;
      };
    })();
    if (token_count === 1) {
      return function(data) {
        return scoreObject(tokens[0], data);
      };
    }
    if (search.options.conjunction === "and") {
      return function(data) {
        var score, sum = 0;
        for (let token of tokens) {
          score = scoreObject(token, data);
          if (score <= 0)
            return 0;
          sum += score;
        }
        return sum / token_count;
      };
    } else {
      return function(data) {
        var sum = 0;
        iterate(tokens, (token) => {
          sum += scoreObject(token, data);
        });
        return sum / token_count;
      };
    }
  }
  /**
   * Returns a function that can be used to compare two
   * results, for sorting purposes. If no sorting should
   * be performed, `null` will be returned.
   *
   * @return function(a,b)
   */
  getSortFunction(query, options) {
    var search = this.prepareSearch(query, options);
    return this._getSortFunction(search);
  }
  _getSortFunction(search) {
    var implicit_score, sort_flds = [];
    const self2 = this, options = search.options, sort = !search.query && options.sort_empty ? options.sort_empty : options.sort;
    if (typeof sort == "function") {
      return sort.bind(this);
    }
    const get_field = function(name, result) {
      if (name === "$score")
        return result.score;
      return search.getAttrFn(self2.items[result.id], name);
    };
    if (sort) {
      for (let s4 of sort) {
        if (search.query || s4.field !== "$score") {
          sort_flds.push(s4);
        }
      }
    }
    if (search.query) {
      implicit_score = true;
      for (let fld of sort_flds) {
        if (fld.field === "$score") {
          implicit_score = false;
          break;
        }
      }
      if (implicit_score) {
        sort_flds.unshift({ field: "$score", direction: "desc" });
      }
    } else {
      sort_flds = sort_flds.filter((fld) => fld.field !== "$score");
    }
    const sort_flds_count = sort_flds.length;
    if (!sort_flds_count) {
      return null;
    }
    return function(a4, b3) {
      var result, field;
      for (let sort_fld of sort_flds) {
        field = sort_fld.field;
        let multiplier = sort_fld.direction === "desc" ? -1 : 1;
        result = multiplier * cmp(get_field(field, a4), get_field(field, b3));
        if (result)
          return result;
      }
      return 0;
    };
  }
  /**
   * Parses a search query and returns an object
   * with tokens and fields ready to be populated
   * with results.
   *
   */
  prepareSearch(query, optsUser) {
    const weights = {};
    var options = Object.assign({}, optsUser);
    propToArray(options, "sort");
    propToArray(options, "sort_empty");
    if (options.fields) {
      propToArray(options, "fields");
      const fields = [];
      options.fields.forEach((field) => {
        if (typeof field == "string") {
          field = { field, weight: 1 };
        }
        fields.push(field);
        weights[field.field] = "weight" in field ? field.weight : 1;
      });
      options.fields = fields;
    }
    return {
      options,
      query: query.toLowerCase().trim(),
      tokens: this.tokenize(query, options.respect_word_boundaries, weights),
      total: 0,
      items: [],
      weights,
      getAttrFn: options.nesting ? getAttrNesting : getAttr
    };
  }
  /**
   * Searches through all items and returns a sorted array of matches.
   *
   */
  search(query, options) {
    var self2 = this, score, search;
    search = this.prepareSearch(query, options);
    options = search.options;
    query = search.query;
    const fn_score = options.score || self2._getScoreFunction(search);
    if (query.length) {
      iterate(self2.items, (item, id) => {
        score = fn_score(item);
        if (options.filter === false || score > 0) {
          search.items.push({ "score": score, "id": id });
        }
      });
    } else {
      iterate(self2.items, (_2, id) => {
        search.items.push({ "score": 1, "id": id });
      });
    }
    const fn_sort = self2._getSortFunction(search);
    if (fn_sort)
      search.items.sort(fn_sort);
    search.total = search.items.length;
    if (typeof options.limit === "number") {
      search.items = search.items.slice(0, options.limit);
    }
    return search;
  }
};

// node_modules/tom-select/dist/esm/utils.js
var hash_key = (value) => {
  if (typeof value === "undefined" || value === null)
    return null;
  return get_hash(value);
};
var get_hash = (value) => {
  if (typeof value === "boolean")
    return value ? "1" : "0";
  return value + "";
};
var escape_html = (str) => {
  return (str + "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};
var timeout = (fn, timeout2) => {
  if (timeout2 > 0) {
    return window.setTimeout(fn, timeout2);
  }
  fn.call(null);
  return null;
};
var loadDebounce = (fn, delay) => {
  var timeout2;
  return function(value, callback) {
    var self2 = this;
    if (timeout2) {
      self2.loading = Math.max(self2.loading - 1, 0);
      clearTimeout(timeout2);
    }
    timeout2 = setTimeout(function() {
      timeout2 = null;
      self2.loadedSearches[value] = true;
      fn.call(self2, value, callback);
    }, delay);
  };
};
var debounce_events = (self2, types, fn) => {
  var type;
  var trigger = self2.trigger;
  var event_args = {};
  self2.trigger = function() {
    var type2 = arguments[0];
    if (types.indexOf(type2) !== -1) {
      event_args[type2] = arguments;
    } else {
      return trigger.apply(self2, arguments);
    }
  };
  fn.apply(self2, []);
  self2.trigger = trigger;
  for (type of types) {
    if (type in event_args) {
      trigger.apply(self2, event_args[type]);
    }
  }
};
var getSelection = (input) => {
  return {
    start: input.selectionStart || 0,
    length: (input.selectionEnd || 0) - (input.selectionStart || 0)
  };
};
var preventDefault = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var addEvent = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
var isKeyDown = (key_name, evt) => {
  if (!evt) {
    return false;
  }
  if (!evt[key_name]) {
    return false;
  }
  var count = (evt.altKey ? 1 : 0) + (evt.ctrlKey ? 1 : 0) + (evt.shiftKey ? 1 : 0) + (evt.metaKey ? 1 : 0);
  if (count === 1) {
    return true;
  }
  return false;
};
var getId = (el, id) => {
  const existing_id = el.getAttribute("id");
  if (existing_id) {
    return existing_id;
  }
  el.setAttribute("id", id);
  return id;
};
var addSlashes = (str) => {
  return str.replace(/[\\"']/g, "\\$&");
};
var append = (parent, node) => {
  if (node)
    parent.append(node);
};
var iterate2 = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};

// node_modules/tom-select/dist/esm/vanilla.js
var getDom = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
var escapeQuery = (query) => {
  return query.replace(/['"\\]/g, "\\$&");
};
var triggerEvent = (dom_el, event_name) => {
  var event = document.createEvent("HTMLEvents");
  event.initEvent(event_name, true, false);
  dom_el.dispatchEvent(event);
};
var applyCSS = (dom_el, css) => {
  Object.assign(dom_el.style, css);
};
var addClasses = (elmts, ...classes) => {
  var norm_classes = classesArray(classes);
  elmts = castAsArray(elmts);
  elmts.map((el) => {
    norm_classes.map((cls) => {
      el.classList.add(cls);
    });
  });
};
var removeClasses = (elmts, ...classes) => {
  var norm_classes = classesArray(classes);
  elmts = castAsArray(elmts);
  elmts.map((el) => {
    norm_classes.map((cls) => {
      el.classList.remove(cls);
    });
  });
};
var classesArray = (args) => {
  var classes = [];
  iterate2(args, (_classes) => {
    if (typeof _classes === "string") {
      _classes = _classes.trim().split(/[\t\n\f\r\s]/);
    }
    if (Array.isArray(_classes)) {
      classes = classes.concat(_classes);
    }
  });
  return classes.filter(Boolean);
};
var castAsArray = (arg) => {
  if (!Array.isArray(arg)) {
    arg = [arg];
  }
  return arg;
};
var parentMatch = (target, selector, wrapper) => {
  if (wrapper && !wrapper.contains(target)) {
    return;
  }
  while (target && target.matches) {
    if (target.matches(selector)) {
      return target;
    }
    target = target.parentNode;
  }
};
var getTail = (list, direction = 0) => {
  if (direction > 0) {
    return list[list.length - 1];
  }
  return list[0];
};
var isEmptyObject = (obj) => {
  return Object.keys(obj).length === 0;
};
var nodeIndex = (el, amongst) => {
  if (!el)
    return -1;
  amongst = amongst || el.nodeName;
  var i8 = 0;
  while (el = el.previousElementSibling) {
    if (el.matches(amongst)) {
      i8++;
    }
  }
  return i8;
};
var setAttr = (el, attrs) => {
  iterate2(attrs, (val, attr) => {
    if (val == null) {
      el.removeAttribute(attr);
    } else {
      el.setAttribute(attr, "" + val);
    }
  });
};
var replaceNode = (existing, replacement) => {
  if (existing.parentNode)
    existing.parentNode.replaceChild(replacement, existing);
};

// node_modules/tom-select/dist/esm/contrib/highlight.js
var highlight = (element, regex) => {
  if (regex === null)
    return;
  if (typeof regex === "string") {
    if (!regex.length)
      return;
    regex = new RegExp(regex, "i");
  }
  const highlightText = (node) => {
    var match2 = node.data.match(regex);
    if (match2 && node.data.length > 0) {
      var spannode = document.createElement("span");
      spannode.className = "highlight";
      var middlebit = node.splitText(match2.index);
      middlebit.splitText(match2[0].length);
      var middleclone = middlebit.cloneNode(true);
      spannode.appendChild(middleclone);
      replaceNode(middlebit, spannode);
      return 1;
    }
    return 0;
  };
  const highlightChildren = (node) => {
    if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName) && (node.className !== "highlight" || node.tagName !== "SPAN")) {
      Array.from(node.childNodes).forEach((element2) => {
        highlightRecursive(element2);
      });
    }
  };
  const highlightRecursive = (node) => {
    if (node.nodeType === 3) {
      return highlightText(node);
    }
    highlightChildren(node);
    return 0;
  };
  highlightRecursive(element);
};
var removeHighlight = (el) => {
  var elements = el.querySelectorAll("span.highlight");
  Array.prototype.forEach.call(elements, function(el2) {
    var parent = el2.parentNode;
    parent.replaceChild(el2.firstChild, el2);
    parent.normalize();
  });
};

// node_modules/tom-select/dist/esm/constants.js
var KEY_A = 65;
var KEY_RETURN = 13;
var KEY_ESC = 27;
var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;
var KEY_BACKSPACE = 8;
var KEY_DELETE = 46;
var KEY_TAB = 9;
var IS_MAC = typeof navigator === "undefined" ? false : /Mac/.test(navigator.userAgent);
var KEY_SHORTCUT = IS_MAC ? "metaKey" : "ctrlKey";

// node_modules/tom-select/dist/esm/defaults.js
var defaults_default = {
  options: [],
  optgroups: [],
  plugins: [],
  delimiter: ",",
  splitOn: null,
  // regexp or string for splitting up values from a paste command
  persist: true,
  diacritics: true,
  create: null,
  createOnBlur: false,
  createFilter: null,
  clearAfterSelect: false,
  highlight: true,
  openOnFocus: true,
  shouldOpen: null,
  maxOptions: 50,
  maxItems: null,
  hideSelected: null,
  duplicates: false,
  addPrecedence: false,
  selectOnTab: false,
  preload: null,
  allowEmptyOption: false,
  //closeAfterSelect: false,
  refreshThrottle: 300,
  loadThrottle: 300,
  loadingClass: "loading",
  dataAttr: null,
  //'data-data',
  optgroupField: "optgroup",
  valueField: "value",
  labelField: "text",
  disabledField: "disabled",
  optgroupLabelField: "label",
  optgroupValueField: "value",
  lockOptgroupOrder: false,
  sortField: "$order",
  searchField: ["text"],
  searchConjunction: "and",
  mode: null,
  wrapperClass: "ts-wrapper",
  controlClass: "ts-control",
  dropdownClass: "ts-dropdown",
  dropdownContentClass: "ts-dropdown-content",
  itemClass: "item",
  optionClass: "option",
  dropdownParent: null,
  controlInput: '<input type="text" autocomplete="off" size="1" />',
  copyClassesToDropdown: false,
  placeholder: null,
  hidePlaceholder: null,
  shouldLoad: function(query) {
    return query.length > 0;
  },
  /*
  load                 : null, // function(query, callback) { ... }
  score                : null, // function(search) { ... }
  onInitialize         : null, // function() { ... }
  onChange             : null, // function(value) { ... }
  onItemAdd            : null, // function(value, $item) { ... }
  onItemRemove         : null, // function(value) { ... }
  onClear              : null, // function() { ... }
  onOptionAdd          : null, // function(value, data) { ... }
  onOptionRemove       : null, // function(value) { ... }
  onOptionClear        : null, // function() { ... }
  onOptionGroupAdd     : null, // function(id, data) { ... }
  onOptionGroupRemove  : null, // function(id) { ... }
  onOptionGroupClear   : null, // function() { ... }
  onDropdownOpen       : null, // function(dropdown) { ... }
  onDropdownClose      : null, // function(dropdown) { ... }
  onType               : null, // function(str) { ... }
  onDelete             : null, // function(values) { ... }
  */
  render: {
    /*
    item: null,
    optgroup: null,
    optgroup_header: null,
    option: null,
    option_create: null
    */
  }
};

// node_modules/tom-select/dist/esm/getSettings.js
function getSettings(input, settings_user) {
  var settings = Object.assign({}, defaults_default, settings_user);
  var attr_data = settings.dataAttr;
  var field_label = settings.labelField;
  var field_value = settings.valueField;
  var field_disabled = settings.disabledField;
  var field_optgroup = settings.optgroupField;
  var field_optgroup_label = settings.optgroupLabelField;
  var field_optgroup_value = settings.optgroupValueField;
  var tag_name = input.tagName.toLowerCase();
  var placeholder = input.getAttribute("placeholder") || input.getAttribute("data-placeholder");
  if (!placeholder && !settings.allowEmptyOption) {
    let option = input.querySelector('option[value=""]');
    if (option) {
      placeholder = option.textContent;
    }
  }
  var settings_element = {
    placeholder,
    options: [],
    optgroups: [],
    items: [],
    maxItems: null
  };
  var init_select = () => {
    var tagName;
    var options = settings_element.options;
    var optionsMap = {};
    var group_count = 1;
    let $order = 0;
    var readData = (el) => {
      var data = Object.assign({}, el.dataset);
      var json = attr_data && data[attr_data];
      if (typeof json === "string" && json.length) {
        data = Object.assign(data, JSON.parse(json));
      }
      return data;
    };
    var addOption = (option, group2) => {
      var value = hash_key(option.value);
      if (value == null)
        return;
      if (!value && !settings.allowEmptyOption)
        return;
      if (optionsMap.hasOwnProperty(value)) {
        if (group2) {
          var arr = optionsMap[value][field_optgroup];
          if (!arr) {
            optionsMap[value][field_optgroup] = group2;
          } else if (!Array.isArray(arr)) {
            optionsMap[value][field_optgroup] = [arr, group2];
          } else {
            arr.push(group2);
          }
        }
      } else {
        var option_data = readData(option);
        option_data[field_label] = option_data[field_label] || option.textContent;
        option_data[field_value] = option_data[field_value] || value;
        option_data[field_disabled] = option_data[field_disabled] || option.disabled;
        option_data[field_optgroup] = option_data[field_optgroup] || group2;
        option_data.$option = option;
        option_data.$order = option_data.$order || ++$order;
        optionsMap[value] = option_data;
        options.push(option_data);
      }
      if (option.selected) {
        settings_element.items.push(value);
      }
    };
    var addGroup = (optgroup) => {
      var id, optgroup_data;
      optgroup_data = readData(optgroup);
      optgroup_data[field_optgroup_label] = optgroup_data[field_optgroup_label] || optgroup.getAttribute("label") || "";
      optgroup_data[field_optgroup_value] = optgroup_data[field_optgroup_value] || group_count++;
      optgroup_data[field_disabled] = optgroup_data[field_disabled] || optgroup.disabled;
      optgroup_data.$order = optgroup_data.$order || ++$order;
      settings_element.optgroups.push(optgroup_data);
      id = optgroup_data[field_optgroup_value];
      iterate2(optgroup.children, (option) => {
        addOption(option, id);
      });
    };
    settings_element.maxItems = input.hasAttribute("multiple") ? null : 1;
    iterate2(input.children, (child) => {
      tagName = child.tagName.toLowerCase();
      if (tagName === "optgroup") {
        addGroup(child);
      } else if (tagName === "option") {
        addOption(child);
      }
    });
  };
  var init_textbox = () => {
    var _a, _b;
    const data_raw = input.getAttribute(attr_data);
    if (!data_raw) {
      var value = (_b = (_a = input === null || input === void 0 ? void 0 : input.value) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : "";
      if (!settings.allowEmptyOption && !value.length)
        return;
      const values = value.split(settings.delimiter);
      iterate2(values, (value2) => {
        const option = {};
        option[field_label] = value2;
        option[field_value] = value2;
        settings_element.options.push(option);
      });
      settings_element.items = values;
    } else {
      settings_element.options = JSON.parse(data_raw);
      iterate2(settings_element.options, (opt) => {
        settings_element.items.push(opt[field_value]);
      });
    }
  };
  if (tag_name === "select") {
    init_select();
  } else {
    init_textbox();
  }
  return Object.assign({}, defaults_default, settings_element, settings_user);
}

// node_modules/tom-select/dist/esm/tom-select.js
var instance_i = 0;
var TomSelect = class extends MicroPlugin(MicroEvent) {
  constructor(input_arg, user_settings) {
    super();
    this.order = 0;
    this.isOpen = false;
    this.isDisabled = false;
    this.isReadOnly = false;
    this.isInvalid = false;
    this.isValid = true;
    this.isLocked = false;
    this.isFocused = false;
    this.isInputHidden = false;
    this.isSetup = false;
    this.isDropdownContentStale = true;
    this.ignoreFocus = false;
    this.ignoreHover = false;
    this.hasOptions = false;
    this.lastValue = "";
    this.caretPos = 0;
    this.loading = 0;
    this.loadedSearches = {};
    this.activeOption = null;
    this.activeItems = [];
    this.optgroups = {};
    this.options = {};
    this.userOptions = {};
    this.items = [];
    this.refreshTimeout = null;
    instance_i++;
    var dir;
    var input = getDom(input_arg);
    if (input.tomselect) {
      throw new Error("Tom Select already initialized on this element");
    }
    input.tomselect = this;
    var computedStyle = window.getComputedStyle && window.getComputedStyle(input, null);
    dir = computedStyle.getPropertyValue("direction");
    const settings = getSettings(input, user_settings);
    this.settings = settings;
    this.input = input;
    this.tabIndex = input.tabIndex || 0;
    this.is_select_tag = input.tagName.toLowerCase() === "select";
    this.rtl = /rtl/i.test(dir);
    this.inputId = getId(input, "tomselect-" + instance_i);
    this.isRequired = input.required;
    this.sifter = new Sifter(this.options, { diacritics: settings.diacritics });
    settings.mode = settings.mode || (settings.maxItems === 1 ? "single" : "multi");
    if (typeof settings.hideSelected !== "boolean") {
      settings.hideSelected = settings.mode === "multi";
    }
    if (typeof settings.hidePlaceholder !== "boolean") {
      settings.hidePlaceholder = settings.mode !== "multi";
    }
    var filter = settings.createFilter;
    if (typeof filter !== "function") {
      if (typeof filter === "string") {
        filter = new RegExp(filter);
      }
      if (filter instanceof RegExp) {
        settings.createFilter = (input2) => filter.test(input2);
      } else {
        settings.createFilter = (value) => {
          return this.settings.duplicates || !this.options[value];
        };
      }
    }
    this.initializePlugins(settings.plugins);
    this.setupCallbacks();
    this.setupTemplates();
    const wrapper = getDom("<div>");
    const control = getDom("<div>");
    const dropdown = this._render("dropdown");
    const dropdown_content = getDom(`<div role="listbox" tabindex="-1">`);
    const classes = this.input.getAttribute("class") || "";
    const inputMode = settings.mode;
    var control_input;
    addClasses(wrapper, settings.wrapperClass, classes, inputMode);
    addClasses(control, settings.controlClass);
    append(wrapper, control);
    addClasses(dropdown, settings.dropdownClass, inputMode);
    if (settings.copyClassesToDropdown) {
      addClasses(dropdown, classes);
    }
    addClasses(dropdown_content, settings.dropdownContentClass);
    append(dropdown, dropdown_content);
    getDom(settings.dropdownParent || wrapper).appendChild(dropdown);
    if (isHtmlString(settings.controlInput)) {
      control_input = getDom(settings.controlInput);
      var attrs = ["autocorrect", "autocapitalize", "autocomplete", "spellcheck", "aria-label"];
      iterate2(attrs, (attr) => {
        if (input.getAttribute(attr)) {
          setAttr(control_input, { [attr]: input.getAttribute(attr) });
        }
      });
      control_input.tabIndex = -1;
      control.appendChild(control_input);
      this.focus_node = control_input;
    } else if (settings.controlInput) {
      control_input = getDom(settings.controlInput);
      this.focus_node = control_input;
    } else {
      control_input = getDom("<input/>");
      this.focus_node = control;
    }
    this.wrapper = wrapper;
    this.dropdown = dropdown;
    this.dropdown_content = dropdown_content;
    this.control = control;
    this.control_input = control_input;
    this.setup();
  }
  /**
   * set up event bindings.
   *
   */
  setup() {
    const self2 = this;
    const settings = self2.settings;
    const control_input = self2.control_input;
    const dropdown = self2.dropdown;
    const dropdown_content = self2.dropdown_content;
    const wrapper = self2.wrapper;
    const control = self2.control;
    const input = self2.input;
    const focus_node = self2.focus_node;
    const passive_event = { passive: true };
    const listboxId = self2.inputId + "-ts-dropdown";
    setAttr(dropdown_content, {
      id: listboxId
    });
    setAttr(focus_node, {
      role: "combobox",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
      "aria-controls": listboxId
    });
    const control_id = getId(focus_node, self2.inputId + "-ts-control");
    const query = "label[for='" + escapeQuery(self2.inputId) + "']";
    const label = document.querySelector(query);
    const label_click = self2.focus.bind(self2);
    if (label) {
      addEvent(label, "click", label_click);
      setAttr(label, { for: control_id });
      const label_id = getId(label, self2.inputId + "-ts-label");
      setAttr(focus_node, { "aria-labelledby": label_id });
      setAttr(dropdown_content, { "aria-labelledby": label_id });
    }
    wrapper.style.width = input.style.width;
    wrapper.style.minWidth = input.style.minWidth;
    wrapper.style.maxWidth = input.style.maxWidth;
    if (self2.plugins.names.length) {
      const classes_plugins = "plugin-" + self2.plugins.names.join(" plugin-");
      addClasses([wrapper, dropdown], classes_plugins);
    }
    if ((settings.maxItems === null || settings.maxItems > 1) && self2.is_select_tag) {
      setAttr(input, { multiple: "multiple" });
    }
    if (settings.placeholder) {
      setAttr(control_input, { placeholder: settings.placeholder });
    }
    if (!settings.splitOn && settings.delimiter) {
      settings.splitOn = new RegExp("\\s*" + escape_regex(settings.delimiter) + "+\\s*");
    }
    if (settings.load && settings.loadThrottle) {
      settings.load = loadDebounce(settings.load, settings.loadThrottle);
    }
    addEvent(dropdown, "mousemove", () => {
      self2.ignoreHover = false;
    });
    addEvent(dropdown, "mouseenter", (e9) => {
      var target_match = parentMatch(e9.target, "[data-selectable]", dropdown);
      if (target_match)
        self2.onOptionHover(e9, target_match);
    }, { capture: true });
    addEvent(dropdown, "click", (evt) => {
      const option = parentMatch(evt.target, "[data-selectable]");
      if (option) {
        self2.onOptionSelect(evt, option);
        preventDefault(evt, true);
      }
    });
    addEvent(control, "click", (evt) => {
      var target_match = parentMatch(evt.target, "[data-ts-item]", control);
      if (target_match && self2.onItemSelect(evt, target_match)) {
        preventDefault(evt, true);
        return;
      }
      if (control_input.value != "") {
        return;
      }
      self2.onClick();
      preventDefault(evt, true);
    });
    addEvent(focus_node, "keydown", (e9) => self2.onKeyDown(e9));
    addEvent(control_input, "keypress", (e9) => self2.onKeyPress(e9));
    addEvent(control_input, "input", (e9) => self2.onInput(e9));
    addEvent(focus_node, "blur", (e9) => self2.onBlur(e9));
    addEvent(focus_node, "focus", (e9) => self2.onFocus(e9));
    addEvent(control_input, "paste", (e9) => self2.onPaste(e9));
    const doc_mousedown = (evt) => {
      const target = evt.composedPath()[0];
      if (!wrapper.contains(target) && !dropdown.contains(target)) {
        if (self2.isFocused) {
          self2.blur();
        }
        self2.inputState();
        return;
      }
      if (target == control_input && self2.isOpen) {
        evt.stopPropagation();
      } else {
        preventDefault(evt, true);
      }
    };
    const win_scroll = () => {
      if (self2.isOpen) {
        self2.positionDropdown();
      }
    };
    const input_invalid = () => {
      if (self2.isValid) {
        self2.isValid = false;
        self2.isInvalid = true;
        self2.refreshState();
      }
    };
    addEvent(input, "invalid", input_invalid);
    addEvent(document, "mousedown", doc_mousedown);
    addEvent(window, "scroll", win_scroll, passive_event);
    addEvent(window, "resize", win_scroll, passive_event);
    this._destroy = () => {
      input.removeEventListener("invalid", input_invalid);
      document.removeEventListener("mousedown", doc_mousedown);
      window.removeEventListener("scroll", win_scroll);
      window.removeEventListener("resize", win_scroll);
      if (label)
        label.removeEventListener("click", label_click);
    };
    this.revertSettings = {
      innerHTML: input.innerHTML,
      tabIndex: input.tabIndex
    };
    input.tabIndex = -1;
    input.insertAdjacentElement("afterend", self2.wrapper);
    self2.sync(false);
    settings.items = [];
    delete settings.optgroups;
    delete settings.options;
    self2.refreshItems();
    self2.close(false);
    self2.inputState();
    self2.isSetup = true;
    self2.on("change", this.onChange);
    addClasses(input, "tomselected", "ts-hidden-accessible");
    self2.trigger("initialize");
    if (settings.preload === true) {
      self2.preload();
    }
  }
  /**
   * Register options and optgroups
   *
   */
  setupOptions(options = [], optgroups = []) {
    this.addOptions(options);
    iterate2(optgroups, (optgroup) => {
      this.registerOptionGroup(optgroup);
    });
  }
  /**
   * Sets up default rendering functions.
   */
  setupTemplates() {
    var self2 = this;
    var field_label = self2.settings.labelField;
    var field_optgroup = self2.settings.optgroupLabelField;
    var templates = {
      "optgroup": (data) => {
        let optgroup = document.createElement("div");
        optgroup.className = "optgroup";
        optgroup.appendChild(data.options);
        return optgroup;
      },
      "optgroup_header": (data, escape) => {
        return '<div class="optgroup-header">' + escape(data[field_optgroup]) + "</div>";
      },
      "option": (data, escape) => {
        return "<div>" + escape(data[field_label]) + "</div>";
      },
      "item": (data, escape) => {
        return "<div>" + escape(data[field_label]) + "</div>";
      },
      "option_create": (data, escape) => {
        return '<div class="create">Add <strong>' + escape(data.input) + "</strong>&hellip;</div>";
      },
      "no_results": () => {
        return '<div class="no-results">No results found</div>';
      },
      "loading": () => {
        return '<div class="spinner"></div>';
      },
      "not_loading": () => {
      },
      "dropdown": () => {
        return "<div></div>";
      }
    };
    self2.settings.render = Object.assign({}, templates, self2.settings.render);
  }
  /**
   * Maps fired events to callbacks provided
   * in the settings used when creating the control.
   */
  setupCallbacks() {
    var key, fn;
    var callbacks = {
      "initialize": "onInitialize",
      "change": "onChange",
      "item_add": "onItemAdd",
      "item_remove": "onItemRemove",
      "item_select": "onItemSelect",
      "clear": "onClear",
      "option_add": "onOptionAdd",
      "option_remove": "onOptionRemove",
      "option_clear": "onOptionClear",
      "optgroup_add": "onOptionGroupAdd",
      "optgroup_remove": "onOptionGroupRemove",
      "optgroup_clear": "onOptionGroupClear",
      "dropdown_open": "onDropdownOpen",
      "dropdown_close": "onDropdownClose",
      "type": "onType",
      "load": "onLoad",
      "focus": "onFocus",
      "blur": "onBlur"
    };
    for (key in callbacks) {
      fn = this.settings[callbacks[key]];
      if (fn)
        this.on(key, fn);
    }
  }
  /**
   * Sync the Tom Select instance with the original input or select
   *
   */
  sync(get_settings = true) {
    const self2 = this;
    const settings = get_settings ? getSettings(self2.input, { delimiter: self2.settings.delimiter, allowEmptyOption: self2.settings.allowEmptyOption }) : self2.settings;
    self2.setupOptions(settings.options, settings.optgroups);
    self2.setValue(settings.items || [], true);
    if (self2.input.disabled) {
      self2.disable();
    } else if (self2.input.readOnly) {
      self2.setReadOnly(true);
    } else {
      self2.enable();
    }
    self2.lastQuery = null;
  }
  /**
   * Triggered when the main control element
   * has a click event.
   *
   */
  onClick() {
    var self2 = this;
    if (self2.activeItems.length > 0) {
      self2.clearActiveItems();
      self2.focus();
      return;
    }
    if (self2.isFocused && self2.isOpen) {
      self2.blur();
    } else {
      self2.focus();
    }
  }
  /**
   * @deprecated v1.7
   *
   */
  onMouseDown() {
  }
  /**
   * Triggered when the value of the control has been changed.
   * This should propagate the event to the original DOM
   * input / select element.
   */
  onChange() {
    triggerEvent(this.input, "input");
    triggerEvent(this.input, "change");
  }
  /**
   * Triggered on <input> paste.
   *
   */
  onPaste(e9) {
    var self2 = this;
    if (self2.isInputHidden || self2.isLocked) {
      preventDefault(e9);
      return;
    }
    if (!self2.settings.splitOn) {
      return;
    }
    setTimeout(() => {
      var pastedText = self2.inputValue();
      if (!pastedText.match(self2.settings.splitOn)) {
        return;
      }
      var splitInput = pastedText.trim().split(self2.settings.splitOn);
      iterate2(splitInput, (piece) => {
        const hash = hash_key(piece);
        if (hash) {
          if (this.options[piece]) {
            self2.addItem(piece);
          } else {
            self2.createItem(piece);
          }
        }
      });
    }, 0);
  }
  /**
   * Triggered on <input> keypress.
   *
   */
  onKeyPress(e9) {
    var self2 = this;
    if (self2.isLocked) {
      preventDefault(e9);
      return;
    }
    var character = String.fromCharCode(e9.keyCode || e9.which);
    if (self2.settings.create && self2.settings.mode === "multi" && character === self2.settings.delimiter) {
      self2.createItem();
      preventDefault(e9);
      return;
    }
  }
  /**
   * Triggered on <input> keydown.
   *
   */
  onKeyDown(e9) {
    var self2 = this;
    self2.ignoreHover = true;
    if (self2.isLocked) {
      if (e9.keyCode !== KEY_TAB) {
        preventDefault(e9);
      }
      return;
    }
    switch (e9.keyCode) {
      // ctrl+A: select all
      case KEY_A:
        if (isKeyDown(KEY_SHORTCUT, e9)) {
          if (self2.control_input.value == "") {
            preventDefault(e9);
            self2.selectAll();
            return;
          }
        }
        break;
      // esc: close dropdown
      case KEY_ESC:
        if (self2.isOpen) {
          preventDefault(e9, true);
          self2.close();
        }
        self2.clearActiveItems();
        return;
      // down: open dropdown or move selection down
      case KEY_DOWN:
        if (!self2.isOpen && self2.hasOptions) {
          self2.open();
        } else if (self2.activeOption) {
          let next2 = self2.getAdjacent(self2.activeOption, 1);
          if (next2)
            self2.setActiveOption(next2);
        }
        preventDefault(e9);
        return;
      // up: move selection up
      case KEY_UP:
        if (self2.activeOption) {
          let prev2 = self2.getAdjacent(self2.activeOption, -1);
          if (prev2)
            self2.setActiveOption(prev2);
        }
        preventDefault(e9);
        return;
      // return: select active option
      case KEY_RETURN:
        if (self2.canSelect(self2.activeOption)) {
          self2.onOptionSelect(e9, self2.activeOption);
          preventDefault(e9);
        } else if (self2.settings.create && self2.createItem()) {
          preventDefault(e9);
        } else if (document.activeElement == self2.control_input && self2.isOpen) {
          preventDefault(e9);
        }
        return;
      // left: modifiy item selection to the left
      case KEY_LEFT:
        self2.advanceSelection(-1, e9);
        return;
      // right: modifiy item selection to the right
      case KEY_RIGHT:
        self2.advanceSelection(1, e9);
        return;
      // tab: select active option and/or create item
      case KEY_TAB:
        if (self2.settings.selectOnTab) {
          if (self2.canSelect(self2.activeOption)) {
            self2.onOptionSelect(e9, self2.activeOption);
            preventDefault(e9);
          } else if (self2.settings.create && self2.createItem()) {
            preventDefault(e9);
          }
        }
        return;
      // delete|backspace: delete items
      case KEY_BACKSPACE:
      case KEY_DELETE:
        self2.deleteSelection(e9);
        return;
    }
    if (self2.isInputHidden && !isKeyDown(KEY_SHORTCUT, e9)) {
      preventDefault(e9);
    }
  }
  /**
   * Triggered on <input> keyup.
   *
   */
  onInput(e9) {
    if (this.isLocked) {
      return;
    }
    const value = this.inputValue();
    if (this.lastValue === value)
      return;
    this.lastValue = value;
    if (value == "") {
      this._onInput();
      return;
    }
    if (this.refreshTimeout) {
      window.clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = timeout(() => {
      this.refreshTimeout = null;
      this._onInput();
    }, this.settings.refreshThrottle);
  }
  _onInput() {
    const value = this.lastValue;
    if (this.settings.shouldLoad.call(this, value)) {
      this.load(value);
    }
    this.refreshOptions();
    this.trigger("type", value);
  }
  /**
   * Triggered when the user rolls over
   * an option in the autocomplete dropdown menu.
   *
   */
  onOptionHover(evt, option) {
    if (this.ignoreHover)
      return;
    this.setActiveOption(option, false);
  }
  /**
   * Triggered on <input> focus.
   *
   */
  onFocus(e9) {
    var self2 = this;
    var wasFocused = self2.isFocused;
    if (self2.isDisabled || self2.isReadOnly) {
      self2.blur();
      preventDefault(e9);
      return;
    }
    if (self2.ignoreFocus)
      return;
    self2.isFocused = true;
    if (self2.settings.preload === "focus")
      self2.preload();
    if (!wasFocused)
      self2.trigger("focus");
    if (!self2.activeItems.length) {
      self2.inputState();
      self2.refreshOptions(!!self2.settings.openOnFocus);
    }
    self2.refreshState();
  }
  /**
   * Triggered on <input> blur.
   *
   */
  onBlur(e9) {
    if (document.hasFocus() === false)
      return;
    var self2 = this;
    if (!self2.isFocused)
      return;
    self2.isFocused = false;
    self2.ignoreFocus = false;
    var deactivate = () => {
      self2.close();
      self2.setActiveItem();
      self2.setCaret(self2.items.length);
      self2.trigger("blur");
    };
    if (self2.settings.create && self2.settings.createOnBlur) {
      self2.createItem(null, deactivate);
    } else {
      deactivate();
    }
  }
  /**
   * Triggered when the user clicks on an option
   * in the autocomplete dropdown menu.
   *
   */
  onOptionSelect(evt, option) {
    var value, self2 = this;
    if (option.parentElement && option.parentElement.matches("[data-disabled]")) {
      return;
    }
    if (option.classList.contains("create")) {
      self2.createItem(null, () => {
        if (self2.settings.closeAfterSelect) {
          self2.close();
        } else if (self2.settings.clearAfterSelect) {
          self2.setTextboxValue();
        }
      });
    } else {
      value = option.dataset.value;
      if (typeof value !== "undefined") {
        self2.isDropdownContentStale = self2.settings.hideSelected;
        self2.addItem(value);
        if (self2.settings.closeAfterSelect) {
          self2.close();
        } else if (self2.settings.clearAfterSelect) {
          self2.setTextboxValue();
        }
        if (!self2.settings.hideSelected && evt.type && /click/.test(evt.type)) {
          self2.setActiveOption(option);
        }
      }
    }
  }
  /**
   * Return true if the given option can be selected
   *
   */
  canSelect(option) {
    if (this.isOpen && option && this.dropdown_content.contains(option)) {
      return true;
    }
    return false;
  }
  /**
   * Triggered when the user clicks on an item
   * that has been selected.
   *
   */
  onItemSelect(evt, item) {
    var self2 = this;
    if (!self2.isLocked && self2.settings.mode === "multi") {
      preventDefault(evt);
      self2.setActiveItem(item, evt);
      return true;
    }
    return false;
  }
  /**
   * Determines whether or not to invoke
   * the user-provided option provider / loader
   *
   * Note, there is a subtle difference between
   * this.canLoad() and this.settings.shouldLoad();
   *
   *	- settings.shouldLoad() is a user-input validator.
   *	When false is returned, the not_loading template
   *	will be added to the dropdown
   *
   *	- canLoad() is lower level validator that checks
   * 	the Tom Select instance. There is no inherent user
   *	feedback when canLoad returns false
   *
   */
  canLoad(value) {
    if (!this.settings.load)
      return false;
    if (this.loadedSearches.hasOwnProperty(value))
      return false;
    return true;
  }
  /**
   * Invokes the user-provided option provider / loader.
   *
   */
  load(value) {
    const self2 = this;
    if (!self2.canLoad(value))
      return;
    addClasses(self2.wrapper, self2.settings.loadingClass);
    self2.loading++;
    const callback = self2.loadCallback.bind(self2);
    self2.settings.load.call(self2, value, callback);
  }
  /**
   * Invoked by the user-provided option provider
   *
   */
  loadCallback(options, optgroups) {
    const self2 = this;
    self2.loading = Math.max(self2.loading - 1, 0);
    self2.isDropdownContentStale = true;
    self2.clearActiveOption();
    self2.setupOptions(options, optgroups);
    self2.refreshOptions(self2.isFocused && !self2.isInputHidden);
    if (!self2.loading) {
      removeClasses(self2.wrapper, self2.settings.loadingClass);
    }
    self2.trigger("load", options, optgroups);
  }
  preload() {
    var classList = this.wrapper.classList;
    if (classList.contains("preloaded"))
      return;
    classList.add("preloaded");
    this.load("");
  }
  /**
   * Sets the input field of the control to the specified value.
   *
   */
  setTextboxValue(value = "") {
    var input = this.control_input;
    var changed = input.value !== value;
    if (changed) {
      input.value = value;
      triggerEvent(input, "update");
      this.lastValue = value;
    }
  }
  /**
   * Returns the value of the control. If multiple items
   * can be selected (e.g. <select multiple>), this returns
   * an array. If only one item can be selected, this
   * returns a string.
   *
   */
  getValue() {
    if (this.is_select_tag && this.input.hasAttribute("multiple")) {
      return this.items;
    }
    return this.items.join(this.settings.delimiter);
  }
  /**
   * Resets the selected items to the given value.
   *
   */
  setValue(value, silent) {
    var events = silent ? [] : ["change"];
    debounce_events(this, events, () => {
      this.clear(silent);
      this.addItems(value, silent);
    });
  }
  /**
   * Resets the number of max items to the given value
   *
   */
  setMaxItems(value) {
    if (value === 0)
      value = null;
    this.settings.maxItems = value;
    this.refreshState();
  }
  /**
   * Sets the selected item.
   *
   */
  setActiveItem(item, e9) {
    var self2 = this;
    var eventName;
    var i8, begin, end, swap;
    var last;
    if (self2.settings.mode === "single")
      return;
    if (!item) {
      self2.clearActiveItems();
      if (self2.isFocused) {
        self2.inputState();
      }
      return;
    }
    eventName = e9 && e9.type.toLowerCase();
    if (eventName === "click" && isKeyDown("shiftKey", e9) && self2.activeItems.length) {
      last = self2.getLastActive();
      begin = Array.prototype.indexOf.call(self2.control.children, last);
      end = Array.prototype.indexOf.call(self2.control.children, item);
      if (begin > end) {
        swap = begin;
        begin = end;
        end = swap;
      }
      for (i8 = begin; i8 <= end; i8++) {
        item = self2.control.children[i8];
        if (self2.activeItems.indexOf(item) === -1) {
          self2.setActiveItemClass(item);
        }
      }
      preventDefault(e9);
    } else if (eventName === "click" && isKeyDown(KEY_SHORTCUT, e9) || eventName === "keydown" && isKeyDown("shiftKey", e9)) {
      if (item.classList.contains("active")) {
        self2.removeActiveItem(item);
      } else {
        self2.setActiveItemClass(item);
      }
    } else {
      self2.clearActiveItems();
      self2.setActiveItemClass(item);
    }
    self2.inputState();
    if (!self2.isFocused) {
      self2.focus();
    }
  }
  /**
   * Set the active and last-active classes
   *
   */
  setActiveItemClass(item) {
    const self2 = this;
    const last_active = self2.control.querySelector(".last-active");
    if (last_active)
      removeClasses(last_active, "last-active");
    addClasses(item, "active last-active");
    self2.trigger("item_select", item);
    if (self2.activeItems.indexOf(item) == -1) {
      self2.activeItems.push(item);
    }
  }
  /**
   * Remove active item
   *
   */
  removeActiveItem(item) {
    var idx = this.activeItems.indexOf(item);
    this.activeItems.splice(idx, 1);
    removeClasses(item, "active");
  }
  /**
   * Clears all the active items
   *
   */
  clearActiveItems() {
    removeClasses(this.activeItems, "active");
    this.activeItems = [];
  }
  /**
   * Sets the selected item in the dropdown menu
   * of available options.
   *
   */
  setActiveOption(option, scroll = true) {
    if (option === this.activeOption) {
      return;
    }
    this.clearActiveOption();
    if (!option)
      return;
    this.activeOption = option;
    setAttr(this.focus_node, { "aria-activedescendant": option.getAttribute("id") });
    setAttr(option, { "aria-selected": "true" });
    addClasses(option, "active");
    if (scroll)
      this.scrollToOption(option);
  }
  /**
   * Sets the dropdown_content scrollTop to display the option
   *
   */
  scrollToOption(option, behavior) {
    if (!option)
      return;
    const content = this.dropdown_content;
    const height_menu = content.clientHeight;
    const scrollTop = content.scrollTop || 0;
    const height_item = option.offsetHeight;
    const y3 = option.getBoundingClientRect().top - content.getBoundingClientRect().top + scrollTop;
    if (y3 + height_item > height_menu + scrollTop) {
      this.scroll(y3 - height_menu + height_item, behavior);
    } else if (y3 < scrollTop) {
      this.scroll(y3, behavior);
    }
  }
  /**
   * Scroll the dropdown to the given position
   *
   */
  scroll(scrollTop, behavior) {
    const content = this.dropdown_content;
    if (behavior) {
      content.style.scrollBehavior = behavior;
    }
    content.scrollTop = scrollTop;
    content.style.scrollBehavior = "";
  }
  /**
   * Clears the active option
   *
   */
  clearActiveOption() {
    if (this.activeOption) {
      removeClasses(this.activeOption, "active");
      setAttr(this.activeOption, { "aria-selected": null });
    }
    this.activeOption = null;
    setAttr(this.focus_node, { "aria-activedescendant": null });
  }
  /**
   * Selects all items (CTRL + A).
   */
  selectAll() {
    const self2 = this;
    if (self2.settings.mode === "single")
      return;
    const activeItems = self2.controlChildren();
    if (!activeItems.length)
      return;
    self2.inputState();
    self2.close();
    self2.activeItems = activeItems;
    iterate2(activeItems, (item) => {
      self2.setActiveItemClass(item);
    });
  }
  /**
   * Determines if the control_input should be in a hidden or visible state
   *
   */
  inputState() {
    var self2 = this;
    if (!self2.control.contains(self2.control_input))
      return;
    setAttr(self2.control_input, { placeholder: self2.settings.placeholder });
    if (self2.activeItems.length > 0 || !self2.isFocused && self2.settings.hidePlaceholder && self2.items.length > 0) {
      self2.setTextboxValue();
      self2.isInputHidden = true;
    } else {
      if (self2.settings.hidePlaceholder && self2.items.length > 0) {
        setAttr(self2.control_input, { placeholder: "" });
      }
      self2.isInputHidden = false;
    }
    self2.wrapper.classList.toggle("input-hidden", self2.isInputHidden);
  }
  /**
   * Get the input value
   */
  inputValue() {
    return this.control_input.value.trim();
  }
  /**
   * Gives the control focus.
   */
  focus() {
    var self2 = this;
    if (self2.isDisabled || self2.isReadOnly)
      return;
    self2.ignoreFocus = true;
    const focusTarget = this.control_input.offsetWidth ? this.control_input : this.focus_node;
    focusTarget.focus();
    setTimeout(() => {
      self2.ignoreFocus = false;
      const root2 = focusTarget.getRootNode();
      if (root2.activeElement !== focusTarget) {
        return;
      }
      this.onFocus();
    }, 0);
  }
  /**
   * Forces the control out of focus.
   *
   */
  blur() {
    this.focus_node.blur();
    this.onBlur();
  }
  /**
   * Returns a function that scores an object
   * to show how good of a match it is to the
   * provided query.
   *
   * @return {function}
   */
  getScoreFunction(query) {
    return this.sifter.getScoreFunction(query, this.getSearchOptions());
  }
  /**
   * Returns search options for sifter (the system
   * for scoring and sorting results).
   *
   * @see https://github.com/orchidjs/sifter.js
   * @return {object}
   */
  getSearchOptions() {
    var settings = this.settings;
    var sort = settings.sortField;
    if (typeof settings.sortField === "string") {
      sort = [{ field: settings.sortField }];
    }
    return {
      fields: settings.searchField,
      conjunction: settings.searchConjunction,
      sort,
      nesting: settings.nesting
    };
  }
  /**
   * Searches through available options and returns
   * a sorted array of matches.
   *
   */
  search(query) {
    var result, calculateScore;
    var self2 = this;
    var options = this.getSearchOptions();
    if (self2.settings.score) {
      calculateScore = self2.settings.score.call(self2, query);
      if (typeof calculateScore !== "function") {
        throw new Error('Tom Select "score" setting must be a function that returns a function');
      }
    }
    if (self2.isDropdownContentStale || query !== self2.lastQuery) {
      self2.lastQuery = query;
      if (/(.)\1{15,}/.test(query)) {
        query = "";
      }
      result = self2.sifter.search(query, Object.assign(options, { score: calculateScore }));
      self2.currentResults = result;
    } else {
      result = Object.assign({}, self2.currentResults);
    }
    if (self2.settings.hideSelected) {
      result.items = result.items.filter((item) => {
        let hashed = hash_key(item.id);
        return !(hashed !== null && self2.items.indexOf(hashed) !== -1);
      });
    }
    return result;
  }
  /**
   * Refreshes the list of available options shown
   * in the autocomplete dropdown menu.
   *
   */
  refreshOptions(triggerDropdown = true) {
    var i8, j2, k2, n6, optgroup, optgroups, html, has_create_option, active_group;
    var create;
    const groups = {};
    const groups_order = [];
    var self2 = this;
    var query = self2.inputValue();
    const same_query = query === self2.lastQuery || query == "" && self2.lastQuery == null;
    var results = self2.search(query);
    var active_option = null;
    var show_dropdown = self2.settings.shouldOpen || false;
    var dropdown_content = self2.dropdown_content;
    if (same_query) {
      active_option = self2.activeOption;
      if (active_option) {
        active_group = active_option.closest("[data-group]");
      }
    }
    n6 = results.items.length;
    if (typeof self2.settings.maxOptions === "number") {
      n6 = Math.min(n6, self2.settings.maxOptions);
    }
    if (n6 > 0) {
      show_dropdown = true;
    }
    const getGroupFragment = (optgroup2, order) => {
      let group_order_i = groups[optgroup2];
      if (group_order_i !== void 0) {
        let order_group = groups_order[group_order_i];
        if (order_group !== void 0) {
          return [group_order_i, order_group.fragment];
        }
      }
      let group_fragment = document.createDocumentFragment();
      group_order_i = groups_order.length;
      groups_order.push({ fragment: group_fragment, order, optgroup: optgroup2 });
      return [group_order_i, group_fragment];
    };
    for (i8 = 0; i8 < n6; i8++) {
      let item = results.items[i8];
      if (!item)
        continue;
      let opt_value = item.id;
      let option = self2.options[opt_value];
      if (option === void 0)
        continue;
      let opt_hash = get_hash(opt_value);
      let option_el = self2.getOption(opt_hash, true);
      if (!self2.settings.hideSelected) {
        option_el.classList.toggle("selected", self2.items.includes(opt_hash));
      }
      optgroup = option[self2.settings.optgroupField] || "";
      optgroups = Array.isArray(optgroup) ? optgroup : [optgroup];
      for (j2 = 0, k2 = optgroups && optgroups.length; j2 < k2; j2++) {
        optgroup = optgroups[j2];
        let order = option.$order;
        let self_optgroup = self2.optgroups[optgroup];
        if (self_optgroup === void 0 && typeof self2.settings.optionGroupRegister === "function") {
          var regGroup;
          if (regGroup = self2.settings.optionGroupRegister.apply(self2, [optgroup])) {
            self2.registerOptionGroup(regGroup);
          }
        }
        self_optgroup = self2.optgroups[optgroup];
        if (self_optgroup === void 0) {
          optgroup = "";
        } else {
          order = self_optgroup.$order;
        }
        const [group_order_i, group_fragment] = getGroupFragment(optgroup, order);
        if (j2 > 0) {
          option_el = option_el.cloneNode(true);
          setAttr(option_el, { id: option.$id + "-clone-" + j2, "aria-selected": null });
          option_el.classList.add("ts-cloned");
          removeClasses(option_el, "active");
          if (self2.activeOption && self2.activeOption.dataset.value == opt_value) {
            if (active_group && active_group.dataset.group === optgroup.toString()) {
              active_option = option_el;
            }
          }
        }
        group_fragment.appendChild(option_el);
        if (optgroup != "") {
          groups[optgroup] = group_order_i;
        }
      }
    }
    if (self2.settings.lockOptgroupOrder) {
      groups_order.sort((a4, b3) => {
        return a4.order - b3.order;
      });
    }
    html = document.createDocumentFragment();
    iterate2(groups_order, (group_order) => {
      let group_fragment = group_order.fragment;
      let optgroup2 = group_order.optgroup;
      if (!group_fragment || !group_fragment.children.length)
        return;
      let group_heading = self2.optgroups[optgroup2];
      if (group_heading !== void 0) {
        let group_options = document.createDocumentFragment();
        let header = self2.render("optgroup_header", group_heading);
        append(group_options, header);
        append(group_options, group_fragment);
        let group_html = self2.render("optgroup", { group: group_heading, options: group_options });
        append(html, group_html);
      } else {
        append(html, group_fragment);
      }
    });
    dropdown_content.innerHTML = "";
    append(dropdown_content, html);
    self2.isDropdownContentStale = false;
    if (self2.settings.highlight) {
      removeHighlight(dropdown_content);
      if (results.query.length && results.tokens.length) {
        iterate2(results.tokens, (tok) => {
          highlight(dropdown_content, tok.regex);
        });
      }
    }
    var add_template = (template) => {
      let content = self2.render(template, { input: query });
      if (content) {
        show_dropdown = true;
        dropdown_content.insertBefore(content, dropdown_content.firstChild);
      }
      return content;
    };
    if (self2.loading) {
      add_template("loading");
    } else if (!self2.settings.shouldLoad.call(self2, query)) {
      add_template("not_loading");
    } else if (results.items.length === 0) {
      add_template("no_results");
    }
    has_create_option = self2.canCreate(query);
    if (has_create_option) {
      create = add_template("option_create");
    }
    self2.hasOptions = results.items.length > 0 || has_create_option;
    if (show_dropdown) {
      if (results.items.length > 0) {
        if (!active_option && self2.settings.mode === "single" && self2.items[0] != void 0) {
          active_option = self2.getOption(self2.items[0]);
        }
        if (!dropdown_content.contains(active_option)) {
          let active_index = 0;
          if (create && !self2.settings.addPrecedence) {
            active_index = 1;
          }
          active_option = self2.selectable()[active_index];
        }
      } else if (create) {
        active_option = create;
      }
      if (triggerDropdown && !self2.isOpen) {
        self2.open();
        self2.scrollToOption(active_option, "auto");
      }
      self2.setActiveOption(active_option);
    } else {
      self2.clearActiveOption();
      if (triggerDropdown && self2.isOpen) {
        self2.close(false);
      }
    }
  }
  /**
   * Return list of selectable options
   *
   */
  selectable() {
    return this.dropdown_content.querySelectorAll("[data-selectable]");
  }
  /**
   * Adds an available option. If it already exists,
   * nothing will happen. Note: this does not refresh
   * the options list dropdown (use `refreshOptions`
   * for that).
   *
   * Usage:
   *
   *   this.addOption(data)
   *
   */
  addOption(data, user_created = false) {
    const self2 = this;
    if (Array.isArray(data)) {
      self2.addOptions(data, user_created);
      return false;
    }
    const key = hash_key(data[self2.settings.valueField]);
    if (key === null || self2.options.hasOwnProperty(key)) {
      self2.updateOption(data[self2.settings.valueField], data);
      return false;
    }
    data.$order = data.$order || ++self2.order;
    data.$id = self2.inputId + "-opt-" + data.$order;
    self2.options[key] = data;
    self2.isDropdownContentStale = true;
    if (user_created) {
      self2.userOptions[key] = user_created;
      self2.trigger("option_add", key, data);
    }
    return key;
  }
  /**
   * Add multiple options
   *
   */
  addOptions(data, user_created = false) {
    iterate2(data, (dat) => {
      this.addOption(dat, user_created);
    });
  }
  /**
   * @deprecated 1.7.7
   */
  registerOption(data) {
    return this.addOption(data);
  }
  /**
   * Registers an option group to the pool of option groups.
   *
   * @return {boolean|string}
   */
  registerOptionGroup(data) {
    var key = hash_key(data[this.settings.optgroupValueField]);
    if (key === null)
      return false;
    data.$order = data.$order || ++this.order;
    this.optgroups[key] = data;
    return key;
  }
  /**
   * Registers a new optgroup for options
   * to be bucketed into.
   *
   */
  addOptionGroup(id, data) {
    var hashed_id;
    data[this.settings.optgroupValueField] = id;
    if (hashed_id = this.registerOptionGroup(data)) {
      this.trigger("optgroup_add", hashed_id, data);
    }
  }
  /**
   * Removes an existing option group.
   *
   */
  removeOptionGroup(id) {
    if (this.optgroups.hasOwnProperty(id)) {
      delete this.optgroups[id];
      this.clearCache();
      this.trigger("optgroup_remove", id);
    }
  }
  /**
   * Clears all existing option groups.
   */
  clearOptionGroups() {
    this.optgroups = {};
    this.clearCache();
    this.trigger("optgroup_clear");
  }
  /**
   * Updates an option available for selection. If
   * it is visible in the selected items or options
   * dropdown, it will be re-rendered automatically.
   *
   */
  updateOption(value, data) {
    const self2 = this;
    var item_new;
    var index_item;
    const value_old = hash_key(value);
    const value_new = hash_key(data[self2.settings.valueField]);
    if (value_old === null)
      return;
    const data_old = self2.options[value_old];
    if (data_old == void 0)
      return;
    if (typeof value_new !== "string")
      throw new Error("Value must be set in option data");
    const option = self2.getOption(value_old);
    const item = self2.getItem(value_old);
    data.$order = data.$order || data_old.$order;
    delete self2.options[value_old];
    self2.uncacheValue(value_new);
    self2.options[value_new] = data;
    if (option) {
      if (self2.dropdown_content.contains(option)) {
        const option_new = self2._render("option", data);
        replaceNode(option, option_new);
        if (self2.activeOption === option) {
          self2.setActiveOption(option_new);
        }
      }
      option.remove();
    }
    if (item) {
      index_item = self2.items.indexOf(value_old);
      if (index_item !== -1) {
        self2.items.splice(index_item, 1, value_new);
      }
      item_new = self2._render("item", data);
      if (item.classList.contains("active"))
        addClasses(item_new, "active");
      replaceNode(item, item_new);
    }
    self2.isDropdownContentStale = true;
  }
  /**
   * Removes a single option.
   *
   */
  removeOption(value, silent) {
    const self2 = this;
    value = get_hash(value);
    self2.uncacheValue(value);
    delete self2.userOptions[value];
    delete self2.options[value];
    self2.isDropdownContentStale = true;
    self2.trigger("option_remove", value);
    self2.removeItem(value, silent);
  }
  /**
   * Clears all options.
   */
  clearOptions(filter) {
    const boundFilter = (filter || this.clearFilter).bind(this);
    this.loadedSearches = {};
    this.userOptions = {};
    this.clearCache();
    const selected = {};
    iterate2(this.options, (option, key) => {
      if (boundFilter(option, key)) {
        selected[key] = option;
      }
    });
    this.options = this.sifter.items = selected;
    this.isDropdownContentStale = true;
    this.trigger("option_clear");
  }
  /**
   * Used by clearOptions() to decide whether or not an option should be removed
   * Return true to keep an option, false to remove
   *
   */
  clearFilter(option, value) {
    if (this.items.indexOf(value) >= 0) {
      return true;
    }
    return false;
  }
  /**
   * Returns the dom element of the option
   * matching the given value.
   *
   */
  getOption(value, create = false) {
    const hashed = hash_key(value);
    if (hashed === null)
      return null;
    const option = this.options[hashed];
    if (option != void 0) {
      if (option.$div) {
        return option.$div;
      }
      if (create) {
        return this._render("option", option);
      }
    }
    return null;
  }
  /**
   * Returns the dom element of the next or previous dom element of the same type
   * Note: adjacent options may not be adjacent DOM elements (optgroups)
   *
   */
  getAdjacent(option, direction, type = "option") {
    var self2 = this, all;
    if (!option) {
      return null;
    }
    if (type == "item") {
      all = self2.controlChildren();
    } else {
      all = self2.dropdown_content.querySelectorAll("[data-selectable]");
    }
    for (let i8 = 0; i8 < all.length; i8++) {
      if (all[i8] != option) {
        continue;
      }
      if (direction > 0) {
        return all[i8 + 1];
      }
      return all[i8 - 1];
    }
    return null;
  }
  /**
   * Returns the dom element of the item
   * matching the given value.
   *
   */
  getItem(item) {
    if (typeof item == "object") {
      return item;
    }
    var value = hash_key(item);
    return value !== null ? this.control.querySelector(`[data-value="${addSlashes(value)}"]`) : null;
  }
  /**
   * "Selects" multiple items at once. Adds them to the list
   * at the current caret position.
   *
   */
  addItems(values, silent) {
    var self2 = this;
    var items = Array.isArray(values) ? values : [values];
    items = items.filter((x2) => self2.items.indexOf(x2) === -1);
    const last_item = items[items.length - 1];
    items.forEach((item) => {
      self2.isPending = item !== last_item;
      self2.addItem(item, silent);
    });
  }
  /**
   * "Selects" an item. Adds it to the list
   * at the current caret position.
   *
   */
  addItem(value, silent) {
    var events = silent ? [] : ["change", "dropdown_close"];
    debounce_events(this, events, () => {
      var item, wasFull;
      const self2 = this;
      const inputMode = self2.settings.mode;
      const hashed = hash_key(value);
      if (hashed && self2.items.indexOf(hashed) !== -1) {
        if (inputMode === "single") {
          self2.close();
        }
        if (inputMode === "single" || !self2.settings.duplicates) {
          return;
        }
      }
      if (hashed === null || !self2.options.hasOwnProperty(hashed))
        return;
      if (inputMode === "single")
        self2.clear(silent);
      if (inputMode === "multi" && self2.isFull())
        return;
      item = self2._render("item", self2.options[hashed]);
      if (self2.control.contains(item)) {
        item = item.cloneNode(true);
      }
      wasFull = self2.isFull();
      self2.items.splice(self2.caretPos, 0, hashed);
      self2.insertAtCaret(item);
      if (self2.isSetup) {
        if (!self2.isPending && self2.settings.hideSelected) {
          let option = self2.getOption(hashed);
          let next2 = self2.getAdjacent(option, 1);
          if (next2) {
            self2.setActiveOption(next2);
          }
        }
        if (self2.settings.clearAfterSelect) {
          self2.setTextboxValue();
        }
        if (!self2.isPending && !self2.settings.closeAfterSelect) {
          self2.refreshOptions(self2.isFocused && inputMode !== "single");
        }
        if (self2.settings.closeAfterSelect != false && self2.isFull()) {
          self2.close();
        } else if (!self2.isPending) {
          self2.positionDropdown();
        }
        self2.trigger("item_add", hashed, item);
        if (!self2.isPending) {
          self2.updateOriginalInput({ silent });
        }
      }
      if (!self2.isPending || !wasFull && self2.isFull()) {
        self2.inputState();
        self2.refreshState();
      }
    });
  }
  /**
   * Removes the selected item matching
   * the provided value.
   *
   */
  removeItem(item = null, silent) {
    const self2 = this;
    item = self2.getItem(item);
    if (!item)
      return;
    var i8, idx;
    const value = item.dataset.value;
    i8 = nodeIndex(item);
    item.remove();
    if (item.classList.contains("active")) {
      idx = self2.activeItems.indexOf(item);
      self2.activeItems.splice(idx, 1);
      removeClasses(item, "active");
    }
    self2.items.splice(i8, 1);
    self2.isDropdownContentStale = true;
    if (!self2.settings.persist && self2.userOptions.hasOwnProperty(value)) {
      self2.removeOption(value, silent);
    }
    if (i8 < self2.caretPos) {
      self2.setCaret(self2.caretPos - 1);
    }
    self2.updateOriginalInput({ silent });
    self2.refreshState();
    self2.positionDropdown();
    self2.trigger("item_remove", value, item);
  }
  /**
   * Invokes the `create` method provided in the
   * TomSelect options that should provide the data
   * for the new item, given the user input.
   *
   * Once this completes, it will be added
   * to the item list.
   *
   */
  createItem(input = null, callback = () => {
  }) {
    if (arguments.length === 3) {
      callback = arguments[2];
    }
    if (typeof callback != "function") {
      callback = () => {
      };
    }
    var self2 = this;
    var caret = self2.caretPos;
    var output;
    input = input || self2.inputValue();
    if (!self2.canCreate(input)) {
      const hash = hash_key(input);
      if (hash) {
        if (this.options[input]) {
          self2.addItem(input);
        }
      }
      callback();
      return false;
    }
    self2.lock();
    var created = false;
    var create = (data) => {
      self2.unlock();
      if (!data || typeof data !== "object")
        return callback();
      var value = hash_key(data[self2.settings.valueField]);
      if (typeof value !== "string") {
        return callback();
      }
      self2.setTextboxValue();
      self2.addOption(data, true);
      self2.setCaret(caret);
      self2.addItem(value);
      callback(data);
      created = true;
    };
    if (typeof self2.settings.create === "function") {
      output = self2.settings.create.call(this, input, create);
    } else {
      output = {
        [self2.settings.labelField]: input,
        [self2.settings.valueField]: input
      };
    }
    if (!created) {
      create(output);
    }
    return true;
  }
  /**
   * Re-renders the selected item lists.
   */
  refreshItems() {
    var self2 = this;
    self2.isDropdownContentStale = true;
    if (self2.isSetup) {
      self2.addItems(self2.items);
    }
    self2.updateOriginalInput();
    self2.refreshState();
  }
  /**
   * Updates all state-dependent attributes
   * and CSS classes.
   */
  refreshState() {
    const self2 = this;
    self2.refreshValidityState();
    const isFull = self2.isFull();
    const isLocked = self2.isLocked;
    self2.wrapper.classList.toggle("rtl", self2.rtl);
    const wrap_classList = self2.wrapper.classList;
    wrap_classList.toggle("focus", self2.isFocused);
    wrap_classList.toggle("disabled", self2.isDisabled);
    wrap_classList.toggle("readonly", self2.isReadOnly);
    wrap_classList.toggle("required", self2.isRequired);
    wrap_classList.toggle("invalid", !self2.isValid);
    wrap_classList.toggle("locked", isLocked);
    wrap_classList.toggle("full", isFull);
    wrap_classList.toggle("input-active", self2.isFocused && !self2.isInputHidden);
    wrap_classList.toggle("dropdown-active", self2.isOpen);
    wrap_classList.toggle("has-options", isEmptyObject(self2.options));
    wrap_classList.toggle("has-items", self2.items.length > 0);
  }
  /**
   * Update the `required` attribute of both input and control input.
   *
   * The `required` property needs to be activated on the control input
   * for the error to be displayed at the right place. `required` also
   * needs to be temporarily deactivated on the input since the input is
   * hidden and can't show errors.
   */
  refreshValidityState() {
    var self2 = this;
    if (!self2.input.validity) {
      return;
    }
    self2.isValid = self2.input.validity.valid;
    self2.isInvalid = !self2.isValid;
  }
  /**
   * Determines whether or not more items can be added
   * to the control without exceeding the user-defined maximum.
   *
   * @returns {boolean}
   */
  isFull() {
    return this.settings.maxItems !== null && this.items.length >= this.settings.maxItems;
  }
  /**
   * Refreshes the original <select> or <input>
   * element to reflect the current state.
   *
   */
  updateOriginalInput(opts = {}) {
    const self2 = this;
    var option, label;
    const empty_option = self2.input.querySelector('option[value=""]');
    if (self2.is_select_tag) {
      let AddSelected = function(option_el, value, label2) {
        if (!option_el) {
          option_el = getDom('<option value="' + escape_html(value) + '">' + escape_html(label2) + "</option>");
        }
        if (option_el != empty_option) {
          self2.input.append(option_el);
        }
        selected.push(option_el);
        if (option_el != empty_option || has_selected > 0 || self2.settings.mode == "multi") {
          option_el.selected = true;
        }
        return option_el;
      };
      const selected = [];
      const has_selected = self2.input.querySelectorAll("option:checked").length;
      self2.input.querySelectorAll("option:checked").forEach((option_el) => {
        option_el.selected = false;
      });
      if (self2.items.length == 0 && self2.settings.mode == "single") {
        AddSelected(empty_option, "", "");
      } else {
        self2.items.forEach((value) => {
          option = self2.options[value];
          label = option[self2.settings.labelField] || "";
          if (selected.includes(option.$option)) {
            const reuse_opt = self2.input.querySelector(`option[value="${addSlashes(value)}"]:not(:checked)`);
            AddSelected(reuse_opt, value, label);
          } else {
            option.$option = AddSelected(option.$option, value, label);
          }
        });
      }
    } else {
      self2.input.value = self2.getValue();
    }
    if (self2.isSetup) {
      if (!opts.silent) {
        self2.trigger("change", self2.getValue());
      }
    }
  }
  /**
   * Shows the autocomplete dropdown containing
   * the available options.
   */
  open() {
    var self2 = this;
    if (self2.isLocked || self2.isOpen || self2.settings.mode === "multi" && self2.isFull())
      return;
    self2.isOpen = true;
    setAttr(self2.focus_node, { "aria-expanded": "true" });
    self2.refreshState();
    applyCSS(self2.dropdown, { visibility: "hidden", display: "block" });
    self2.positionDropdown();
    applyCSS(self2.dropdown, { visibility: "visible", display: "block" });
    self2.focus();
    self2.trigger("dropdown_open", self2.dropdown);
  }
  /**
   * Closes the autocomplete dropdown menu.
   */
  close(setTextboxValue = true) {
    var self2 = this;
    var trigger = self2.isOpen;
    if (setTextboxValue) {
      self2.setTextboxValue();
      if (self2.settings.mode === "single" && self2.items.length) {
        self2.inputState();
      }
    }
    self2.isOpen = false;
    setAttr(self2.focus_node, { "aria-expanded": "false" });
    applyCSS(self2.dropdown, { display: "none" });
    if (self2.settings.hideSelected) {
      self2.clearActiveOption();
    }
    self2.refreshState();
    if (trigger)
      self2.trigger("dropdown_close", self2.dropdown);
  }
  /**
   * Calculates and applies the appropriate
   * position of the dropdown if dropdownParent = 'body'.
   * Otherwise, position is determined by css
   */
  positionDropdown() {
    if (this.settings.dropdownParent !== "body") {
      return;
    }
    var context = this.control;
    var rect = context.getBoundingClientRect();
    var top = context.offsetHeight + rect.top + window.scrollY;
    var left = rect.left + window.scrollX;
    applyCSS(this.dropdown, {
      width: rect.width + "px",
      top: top + "px",
      left: left + "px"
    });
  }
  /**
   * Resets / clears all selected items
   * from the control.
   *
   */
  clear(silent) {
    var self2 = this;
    if (!self2.items.length)
      return;
    var items = self2.controlChildren();
    iterate2(items, (item) => {
      self2.removeItem(item, true);
    });
    self2.inputState();
    if (!silent)
      self2.updateOriginalInput();
    self2.trigger("clear");
  }
  /**
   * A helper method for inserting an element
   * at the current caret position.
   *
   */
  insertAtCaret(el) {
    const self2 = this;
    const caret = self2.caretPos;
    const target = self2.control;
    target.insertBefore(el, target.children[caret] || null);
    self2.setCaret(caret + 1);
  }
  /**
   * Removes the current selected item(s).
   *
   */
  deleteSelection(e9) {
    var direction, selection, caret, tail;
    var self2 = this;
    direction = e9 && e9.keyCode === KEY_BACKSPACE ? -1 : 1;
    selection = getSelection(self2.control_input);
    const rm_items = [];
    if (self2.activeItems.length) {
      tail = getTail(self2.activeItems, direction);
      caret = nodeIndex(tail);
      if (direction > 0) {
        caret++;
      }
      iterate2(self2.activeItems, (item) => rm_items.push(item));
    } else if ((self2.isFocused || self2.settings.mode === "single") && self2.items.length) {
      const items = self2.controlChildren();
      let rm_item;
      if (direction < 0 && selection.start === 0 && selection.length === 0) {
        rm_item = items[self2.caretPos - 1];
      } else if (direction > 0 && selection.start === self2.inputValue().length) {
        rm_item = items[self2.caretPos];
      }
      if (rm_item !== void 0) {
        rm_items.push(rm_item);
      }
    }
    if (!self2.shouldDelete(rm_items, e9)) {
      return false;
    }
    preventDefault(e9, true);
    if (typeof caret !== "undefined") {
      self2.setCaret(caret);
    }
    while (rm_items.length) {
      self2.removeItem(rm_items.pop());
    }
    self2.inputState();
    self2.positionDropdown();
    self2.refreshOptions(false);
    return true;
  }
  /**
   * Return true if the items should be deleted
   */
  shouldDelete(items, evt) {
    const values = items.map((item) => item.dataset.value);
    if (!values.length || typeof this.settings.onDelete === "function" && this.settings.onDelete.call(this, values, evt) === false) {
      return false;
    }
    return true;
  }
  /**
   * Selects the previous / next item (depending on the `direction` argument).
   *
   * > 0 - right
   * < 0 - left
   *
   */
  advanceSelection(direction, e9) {
    var last_active, adjacent, self2 = this;
    if (self2.rtl)
      direction *= -1;
    if (self2.inputValue().length)
      return;
    if (isKeyDown(KEY_SHORTCUT, e9) || isKeyDown("shiftKey", e9)) {
      last_active = self2.getLastActive(direction);
      if (last_active) {
        if (!last_active.classList.contains("active")) {
          adjacent = last_active;
        } else {
          adjacent = self2.getAdjacent(last_active, direction, "item");
        }
      } else if (direction > 0) {
        adjacent = self2.control_input.nextElementSibling;
      } else {
        adjacent = self2.control_input.previousElementSibling;
      }
      if (adjacent) {
        if (adjacent.classList.contains("active")) {
          self2.removeActiveItem(last_active);
        }
        self2.setActiveItemClass(adjacent);
      }
    } else {
      self2.moveCaret(direction);
    }
  }
  moveCaret(direction) {
  }
  /**
   * Get the last active item
   *
   */
  getLastActive(direction) {
    let last_active = this.control.querySelector(".last-active");
    if (last_active) {
      return last_active;
    }
    var result = this.control.querySelectorAll(".active");
    if (result) {
      return getTail(result, direction);
    }
  }
  /**
   * Moves the caret to the specified index.
   *
   * The input must be moved by leaving it in place and moving the
   * siblings, due to the fact that focus cannot be restored once lost
   * on mobile webkit devices
   *
   */
  setCaret(new_pos) {
    this.caretPos = this.items.length;
  }
  /**
   * Return list of item dom elements
   *
   */
  controlChildren() {
    return Array.from(this.control.querySelectorAll("[data-ts-item]"));
  }
  /**
   * Disables user input on the control. Used while
   * items are being asynchronously created.
   */
  lock() {
    this.setLocked(true);
  }
  /**
   * Re-enables user input on the control.
   */
  unlock() {
    this.setLocked(false);
  }
  /**
   * Disable or enable user input on the control
   */
  setLocked(lock = this.isReadOnly || this.isDisabled) {
    this.isLocked = lock;
    this.refreshState();
  }
  /**
   * Disables user input on the control completely.
   * While disabled, it cannot receive focus.
   */
  disable() {
    this.setDisabled(true);
    this.close();
  }
  /**
   * Enables the control so that it can respond
   * to focus and user input.
   */
  enable() {
    this.setDisabled(false);
  }
  setDisabled(disabled) {
    this.focus_node.tabIndex = disabled ? -1 : this.tabIndex;
    this.isDisabled = disabled;
    this.input.disabled = disabled;
    this.control_input.disabled = disabled;
    this.setLocked();
  }
  setReadOnly(isReadOnly) {
    this.isReadOnly = isReadOnly;
    this.input.readOnly = isReadOnly;
    this.control_input.readOnly = isReadOnly;
    this.setLocked();
  }
  /**
   * Completely destroys the control and
   * unbinds all event listeners so that it can
   * be garbage collected.
   */
  destroy() {
    var self2 = this;
    var revertSettings = self2.revertSettings;
    self2.trigger("destroy");
    self2.off();
    self2.wrapper.remove();
    self2.dropdown.remove();
    self2.input.innerHTML = revertSettings.innerHTML;
    self2.input.tabIndex = revertSettings.tabIndex;
    removeClasses(self2.input, "tomselected", "ts-hidden-accessible");
    self2._destroy();
    delete self2.input.tomselect;
  }
  /**
   * A helper method for rendering "item" and
   * "option" templates, given the data.
   *
   */
  render(templateName, data) {
    var id, html;
    const self2 = this;
    if (typeof this.settings.render[templateName] !== "function") {
      return null;
    }
    html = self2.settings.render[templateName].call(this, data, escape_html);
    if (!html) {
      return null;
    }
    html = getDom(html);
    if (templateName === "option" || templateName === "option_create") {
      if (data[self2.settings.disabledField]) {
        setAttr(html, { "aria-disabled": "true" });
      } else {
        setAttr(html, { "data-selectable": "" });
      }
    } else if (templateName === "optgroup") {
      id = data.group[self2.settings.optgroupValueField];
      setAttr(html, { "data-group": id });
      if (data.group[self2.settings.disabledField]) {
        setAttr(html, { "data-disabled": "" });
      }
    }
    if (templateName === "option" || templateName === "item") {
      const value = get_hash(data[self2.settings.valueField]);
      setAttr(html, { "data-value": value });
      if (templateName === "item") {
        addClasses(html, self2.settings.itemClass);
        setAttr(html, { "data-ts-item": "" });
      } else {
        addClasses(html, self2.settings.optionClass);
        setAttr(html, {
          role: "option",
          id: data.$id
        });
        data.$div = html;
        self2.options[value] = data;
      }
    }
    return html;
  }
  /**
   * Type guarded rendering
   *
   */
  _render(templateName, data) {
    const html = this.render(templateName, data);
    if (html == null) {
      throw "HTMLElement expected";
    }
    return html;
  }
  /**
   * Clears the render cache for a template. If
   * no template is given, clears all render
   * caches.
   *
   */
  clearCache() {
    iterate2(this.options, (option) => {
      if (option.$div) {
        option.$div.remove();
        delete option.$div;
      }
    });
  }
  /**
   * Removes a value from item and option caches
   *
   */
  uncacheValue(value) {
    const option_el = this.getOption(value);
    if (option_el)
      option_el.remove();
  }
  /**
   * Determines whether or not to display the
   * create item prompt, given a user input.
   *
   */
  canCreate(input) {
    return this.settings.create && input.length > 0 && this.settings.createFilter.call(this, input);
  }
  /**
   * Wraps this.`method` so that `new_fn` can be invoked 'before', 'after', or 'instead' of the original method
   *
   * this.hook('instead','onKeyDown',function( arg1, arg2 ...){
   *
   * });
   */
  hook(when, method, new_fn) {
    var self2 = this;
    var orig_method = self2[method];
    self2[method] = function() {
      var result, result_new;
      if (when === "after") {
        result = orig_method.apply(self2, arguments);
      }
      result_new = new_fn.apply(self2, arguments);
      if (when === "instead") {
        return result_new;
      }
      if (when === "before") {
        result = orig_method.apply(self2, arguments);
      }
      return result;
    };
  }
};

// node_modules/tom-select/dist/esm/plugins/change_listener/plugin.js
var addEvent2 = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
function plugin() {
  addEvent2(this.input, "change", () => {
    this.sync();
  });
}

// node_modules/tom-select/dist/esm/plugins/checkbox_options/plugin.js
var hash_key2 = (value) => {
  if (typeof value === "undefined" || value === null) return null;
  return get_hash2(value);
};
var get_hash2 = (value) => {
  if (typeof value === "boolean") return value ? "1" : "0";
  return value + "";
};
var preventDefault2 = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var getDom2 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString2(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString2 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
function plugin2(userOptions) {
  var self2 = this;
  var orig_onOptionSelect = self2.onOptionSelect;
  self2.settings.hideSelected = false;
  const cbOptions = Object.assign({
    // so that the user may add different ones as well
    className: "tomselect-checkbox",
    // the following default to the historic plugin's values
    checkedClassNames: void 0,
    uncheckedClassNames: void 0
  }, userOptions);
  var UpdateChecked = function UpdateChecked2(checkbox, toCheck) {
    if (toCheck) {
      checkbox.checked = true;
      if (cbOptions.uncheckedClassNames) {
        checkbox.classList.remove(...cbOptions.uncheckedClassNames);
      }
      if (cbOptions.checkedClassNames) {
        checkbox.classList.add(...cbOptions.checkedClassNames);
      }
    } else {
      checkbox.checked = false;
      if (cbOptions.checkedClassNames) {
        checkbox.classList.remove(...cbOptions.checkedClassNames);
      }
      if (cbOptions.uncheckedClassNames) {
        checkbox.classList.add(...cbOptions.uncheckedClassNames);
      }
    }
  };
  var UpdateCheckbox = function UpdateCheckbox2(option) {
    setTimeout(() => {
      var checkbox = option.querySelector("input." + cbOptions.className);
      if (checkbox instanceof HTMLInputElement) {
        UpdateChecked(checkbox, option.classList.contains("selected"));
      }
    }, 1);
  };
  self2.hook("after", "setupTemplates", () => {
    var orig_render_option = self2.settings.render.option;
    self2.settings.render.option = (data, escape_html2) => {
      var rendered = getDom2(orig_render_option.call(self2, data, escape_html2));
      var checkbox = document.createElement("input");
      if (cbOptions.className) {
        checkbox.classList.add(cbOptions.className);
      }
      checkbox.addEventListener("click", function(evt) {
        preventDefault2(evt);
      });
      checkbox.type = "checkbox";
      const hashed = hash_key2(data[self2.settings.valueField]);
      UpdateChecked(checkbox, !!(hashed && self2.items.indexOf(hashed) > -1));
      rendered.prepend(checkbox);
      return rendered;
    };
  });
  self2.on("item_remove", (value) => {
    var option = self2.getOption(value);
    if (option) {
      option.classList.remove("selected");
      UpdateCheckbox(option);
    }
  });
  self2.on("item_add", (value) => {
    var option = self2.getOption(value);
    if (option) {
      UpdateCheckbox(option);
    }
  });
  self2.hook("instead", "onOptionSelect", (evt, option) => {
    if (option.classList.contains("selected")) {
      option.classList.remove("selected");
      self2.removeItem(option.dataset.value);
      self2.refreshOptions();
      preventDefault2(evt, true);
      return;
    }
    orig_onOptionSelect.call(self2, evt, option);
    UpdateCheckbox(option);
  });
}

// node_modules/tom-select/dist/esm/plugins/clear_button/plugin.js
var getDom3 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString3(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString3 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
function plugin3(userOptions) {
  const self2 = this;
  const options = Object.assign({
    className: "clear-button",
    title: "Clear All",
    role: "button",
    tabindex: 0,
    html: (data) => {
      return `<div class="${data.className}" title="${data.title}" role="${data.role}" tabindex="${data.tabindex}">&times;</div>`;
    }
  }, userOptions);
  self2.on("initialize", () => {
    var button = getDom3(options.html(options));
    button.addEventListener("click", (evt) => {
      if (self2.isLocked) return;
      self2.clear();
      if (self2.settings.mode === "single" && self2.settings.allowEmptyOption) {
        self2.addItem("");
      }
      self2.refreshOptions(false);
      evt.preventDefault();
      evt.stopPropagation();
    });
    self2.control.appendChild(button);
  });
}

// node_modules/tom-select/dist/esm/plugins/drag_drop/plugin.js
var preventDefault3 = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var addEvent3 = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
var iterate3 = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};
var getDom4 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString4(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString4 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
var setAttr2 = (el, attrs) => {
  iterate3(attrs, (val, attr) => {
    if (val == null) {
      el.removeAttribute(attr);
    } else {
      el.setAttribute(attr, "" + val);
    }
  });
};
var insertAfter = (referenceNode, newNode) => {
  var _referenceNode$parent;
  (_referenceNode$parent = referenceNode.parentNode) == null || _referenceNode$parent.insertBefore(newNode, referenceNode.nextSibling);
};
var insertBefore = (referenceNode, newNode) => {
  var _referenceNode$parent2;
  (_referenceNode$parent2 = referenceNode.parentNode) == null || _referenceNode$parent2.insertBefore(newNode, referenceNode);
};
var isBefore = (referenceNode, newNode) => {
  do {
    var _newNode;
    newNode = (_newNode = newNode) == null ? void 0 : _newNode.previousElementSibling;
    if (referenceNode == newNode) {
      return true;
    }
  } while (newNode && newNode.previousElementSibling);
  return false;
};
function plugin4() {
  var self2 = this;
  if (self2.settings.mode !== "multi") return;
  var orig_lock = self2.lock;
  var orig_unlock = self2.unlock;
  let sortable = true;
  let drag_item;
  self2.hook("after", "setupTemplates", () => {
    var orig_render_item = self2.settings.render.item;
    self2.settings.render.item = (data, escape) => {
      const item = getDom4(orig_render_item.call(self2, data, escape));
      setAttr2(item, {
        "draggable": "true"
      });
      const mousedown = (evt) => {
        if (!sortable) preventDefault3(evt);
        evt.stopPropagation();
      };
      const dragStart = (evt) => {
        drag_item = item;
        setTimeout(() => {
          item.classList.add("ts-dragging");
        }, 0);
      };
      const dragOver = (evt) => {
        evt.preventDefault();
        item.classList.add("ts-drag-over");
        moveitem(item, drag_item);
      };
      const dragLeave = () => {
        item.classList.remove("ts-drag-over");
      };
      const moveitem = (targetitem, dragitem) => {
        if (dragitem === void 0) return;
        if (isBefore(dragitem, item)) {
          insertAfter(targetitem, dragitem);
        } else {
          insertBefore(targetitem, dragitem);
        }
      };
      const dragend = () => {
        var _drag_item;
        document.querySelectorAll(".ts-drag-over").forEach((el) => el.classList.remove("ts-drag-over"));
        (_drag_item = drag_item) == null || _drag_item.classList.remove("ts-dragging");
        drag_item = void 0;
        var values = [];
        self2.control.querySelectorAll(`[data-value]`).forEach((el) => {
          if (el.dataset.value) {
            let value = el.dataset.value;
            if (value) {
              values.push(value);
            }
          }
        });
        self2.setValue(values);
      };
      addEvent3(item, "mousedown", mousedown);
      addEvent3(item, "dragstart", dragStart);
      addEvent3(item, "dragenter", dragOver);
      addEvent3(item, "dragover", dragOver);
      addEvent3(item, "dragleave", dragLeave);
      addEvent3(item, "dragend", dragend);
      return item;
    };
  });
  self2.hook("instead", "lock", () => {
    sortable = false;
    return orig_lock.call(self2);
  });
  self2.hook("instead", "unlock", () => {
    sortable = true;
    return orig_unlock.call(self2);
  });
}

// node_modules/tom-select/dist/esm/plugins/dropdown_header/plugin.js
var preventDefault4 = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var getDom5 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString5(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString5 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
function plugin5(userOptions) {
  const self2 = this;
  const options = Object.assign({
    title: "Untitled",
    headerClass: "dropdown-header",
    titleRowClass: "dropdown-header-title",
    labelClass: "dropdown-header-label",
    closeClass: "dropdown-header-close",
    html: (data) => {
      return '<div class="' + data.headerClass + '"><div class="' + data.titleRowClass + '"><span class="' + data.labelClass + '">' + data.title + '</span><a class="' + data.closeClass + '">&times;</a></div></div>';
    }
  }, userOptions);
  self2.on("initialize", () => {
    var header = getDom5(options.html(options));
    var close_link = header.querySelector("." + options.closeClass);
    if (close_link) {
      close_link.addEventListener("click", (evt) => {
        preventDefault4(evt, true);
        self2.close();
      });
    }
    self2.dropdown.insertBefore(header, self2.dropdown.firstChild);
  });
}

// node_modules/tom-select/dist/esm/plugins/caret_position/plugin.js
var iterate4 = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};
var removeClasses2 = (elmts, ...classes) => {
  var norm_classes = classesArray2(classes);
  elmts = castAsArray2(elmts);
  elmts.map((el) => {
    norm_classes.map((cls) => {
      el.classList.remove(cls);
    });
  });
};
var classesArray2 = (args) => {
  var classes = [];
  iterate4(args, (_classes) => {
    if (typeof _classes === "string") {
      _classes = _classes.trim().split(/[\t\n\f\r\s]/);
    }
    if (Array.isArray(_classes)) {
      classes = classes.concat(_classes);
    }
  });
  return classes.filter(Boolean);
};
var castAsArray2 = (arg) => {
  if (!Array.isArray(arg)) {
    arg = [arg];
  }
  return arg;
};
var nodeIndex2 = (el, amongst) => {
  if (!el) return -1;
  amongst = amongst || el.nodeName;
  var i8 = 0;
  while (el = el.previousElementSibling) {
    if (el.matches(amongst)) {
      i8++;
    }
  }
  return i8;
};
function plugin6() {
  var self2 = this;
  self2.hook("instead", "setCaret", (new_pos) => {
    if (self2.settings.mode === "single" || !self2.control.contains(self2.control_input)) {
      new_pos = self2.items.length;
    } else {
      new_pos = Math.max(0, Math.min(self2.items.length, new_pos));
      if (new_pos != self2.caretPos && !self2.isPending) {
        self2.controlChildren().forEach((child, j2) => {
          if (j2 < new_pos) {
            self2.control_input.insertAdjacentElement("beforebegin", child);
          } else {
            self2.control.appendChild(child);
          }
        });
      }
    }
    self2.caretPos = new_pos;
  });
  self2.hook("instead", "moveCaret", (direction) => {
    if (!self2.isFocused) return;
    const last_active = self2.getLastActive(direction);
    if (last_active) {
      const idx = nodeIndex2(last_active);
      self2.setCaret(direction > 0 ? idx + 1 : idx);
      self2.setActiveItem();
      removeClasses2(last_active, "last-active");
    } else {
      self2.setCaret(self2.caretPos + direction);
    }
  });
}

// node_modules/tom-select/dist/esm/plugins/dropdown_input/plugin.js
var KEY_ESC2 = 27;
var KEY_TAB2 = 9;
var preventDefault5 = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var addEvent4 = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
var iterate5 = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};
var getDom6 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString6(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString6 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
var addClasses2 = (elmts, ...classes) => {
  var norm_classes = classesArray3(classes);
  elmts = castAsArray3(elmts);
  elmts.map((el) => {
    norm_classes.map((cls) => {
      el.classList.add(cls);
    });
  });
};
var classesArray3 = (args) => {
  var classes = [];
  iterate5(args, (_classes) => {
    if (typeof _classes === "string") {
      _classes = _classes.trim().split(/[\t\n\f\r\s]/);
    }
    if (Array.isArray(_classes)) {
      classes = classes.concat(_classes);
    }
  });
  return classes.filter(Boolean);
};
var castAsArray3 = (arg) => {
  if (!Array.isArray(arg)) {
    arg = [arg];
  }
  return arg;
};
function plugin7() {
  const self2 = this;
  self2.settings.shouldOpen = true;
  self2.hook("before", "setup", () => {
    var _self$input;
    self2.focus_node = self2.control;
    addClasses2(self2.control_input, "dropdown-input");
    const div = getDom6('<div class="dropdown-input-wrap">');
    div.append(self2.control_input);
    self2.dropdown.insertBefore(div, self2.dropdown.firstChild);
    const placeholder = getDom6('<input class="items-placeholder" tabindex="-1" />');
    placeholder.placeholder = self2.settings.placeholder || "";
    self2.control.append(placeholder);
    const label = (_self$input = self2.input) == null ? void 0 : _self$input.getAttribute("aria-label");
    if (!label) return;
    placeholder.setAttribute("aria-label", label);
  });
  self2.on("initialize", () => {
    self2.control_input.addEventListener("keydown", (evt) => {
      switch (evt.keyCode) {
        case KEY_ESC2:
          if (self2.isOpen) {
            preventDefault5(evt, true);
            self2.close();
          }
          self2.clearActiveItems();
          return;
        case KEY_TAB2:
          self2.focus_node.tabIndex = -1;
          break;
      }
      return self2.onKeyDown.call(self2, evt);
    });
    self2.on("blur", () => {
      self2.focus_node.tabIndex = self2.isDisabled ? -1 : self2.tabIndex;
    });
    self2.on("dropdown_open", () => {
      self2.control_input.focus();
    });
    const orig_onBlur = self2.onBlur;
    self2.hook("instead", "onBlur", (evt) => {
      if (evt && evt.relatedTarget == self2.control_input) return;
      return orig_onBlur.call(self2);
    });
    addEvent4(self2.control_input, "blur", () => self2.onBlur());
    self2.hook("before", "close", () => {
      if (!self2.isOpen) return;
      self2.focus_node.focus({
        preventScroll: true
      });
    });
  });
}

// node_modules/tom-select/dist/esm/plugins/input_autogrow/plugin.js
var addEvent5 = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
function plugin8() {
  var self2 = this;
  self2.on("initialize", () => {
    var test_input = document.createElement("span");
    var control = self2.control_input;
    test_input.style.cssText = "position:absolute; top:-99999px; left:-99999px; width:auto; padding:0; white-space:pre; ";
    self2.wrapper.appendChild(test_input);
    var transfer_styles = ["letterSpacing", "fontSize", "fontFamily", "fontWeight", "textTransform"];
    for (const style_name of transfer_styles) {
      test_input.style[style_name] = control.style[style_name];
    }
    var resize = () => {
      test_input.textContent = control.value;
      control.style.width = test_input.clientWidth + "px";
    };
    resize();
    self2.on("update item_add item_remove", resize);
    addEvent5(control, "input", resize);
    addEvent5(control, "keyup", resize);
    addEvent5(control, "blur", resize);
    addEvent5(control, "update", resize);
  });
}

// node_modules/tom-select/dist/esm/plugins/no_backspace_delete/plugin.js
function plugin9() {
  var self2 = this;
  var orig_deleteSelection = self2.deleteSelection;
  this.hook("instead", "deleteSelection", (evt) => {
    if (self2.activeItems.length) {
      return orig_deleteSelection.call(self2, evt);
    }
    return false;
  });
}

// node_modules/tom-select/dist/esm/plugins/no_active_items/plugin.js
function plugin10() {
  this.hook("instead", "setActiveItem", () => {
  });
  this.hook("instead", "selectAll", () => {
  });
}

// node_modules/tom-select/dist/esm/plugins/optgroup_columns/plugin.js
var KEY_LEFT2 = 37;
var KEY_RIGHT2 = 39;
var parentMatch2 = (target, selector, wrapper) => {
  while (target && target.matches) {
    if (target.matches(selector)) {
      return target;
    }
    target = target.parentNode;
  }
};
var nodeIndex3 = (el, amongst) => {
  if (!el) return -1;
  amongst = amongst || el.nodeName;
  var i8 = 0;
  while (el = el.previousElementSibling) {
    if (el.matches(amongst)) {
      i8++;
    }
  }
  return i8;
};
function plugin11() {
  var self2 = this;
  var orig_keydown = self2.onKeyDown;
  self2.hook("instead", "onKeyDown", (evt) => {
    var index, option, options, optgroup;
    if (!self2.isOpen || !(evt.keyCode === KEY_LEFT2 || evt.keyCode === KEY_RIGHT2)) {
      return orig_keydown.call(self2, evt);
    }
    self2.ignoreHover = true;
    optgroup = parentMatch2(self2.activeOption, "[data-group]");
    index = nodeIndex3(self2.activeOption, "[data-selectable]");
    if (!optgroup) {
      return;
    }
    if (evt.keyCode === KEY_LEFT2) {
      optgroup = optgroup.previousSibling;
    } else {
      optgroup = optgroup.nextSibling;
    }
    if (!optgroup) {
      return;
    }
    options = optgroup.querySelectorAll("[data-selectable]");
    option = options[Math.min(options.length - 1, index)];
    if (option) {
      self2.setActiveOption(option);
    }
  });
}

// node_modules/tom-select/dist/esm/plugins/remove_button/plugin.js
var preventDefault6 = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var addEvent6 = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
var getDom7 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString7(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString7 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
function plugin12(userOptions) {
  const self2 = this;
  const options = Object.assign({
    label: "\xD7",
    title: "Remove",
    className: "remove",
    tabindex: -1,
    role: "button",
    html: (data) => {
      var _data$tabindex;
      const el = document.createElement("div");
      el.className = data.className || "";
      el.title = data.title || "";
      el.setAttribute("role", data.role || "button");
      el.tabIndex = (_data$tabindex = data.tabindex) != null ? _data$tabindex : -1;
      el.textContent = data.label || "";
      return el;
    }
  }, userOptions);
  self2.hook("after", "setupTemplates", () => {
    var orig_render_item = self2.settings.render.item;
    self2.settings.render.item = (data, escape) => {
      var item = getDom7(orig_render_item.call(self2, data, escape));
      var close_button = getDom7(options.html(options));
      item.appendChild(close_button);
      addEvent6(close_button, "mousedown", (evt) => {
        preventDefault6(evt, true);
      });
      addEvent6(close_button, "click", (evt) => {
        if (self2.isLocked) return;
        preventDefault6(evt, true);
        if (self2.isLocked) return;
        if (!self2.shouldDelete([item], evt)) return;
        self2.removeItem(item);
        self2.refreshOptions(false);
        self2.inputState();
      });
      return item;
    };
  });
}

// node_modules/tom-select/dist/esm/plugins/restore_on_backspace/plugin.js
function plugin13(userOptions) {
  const self2 = this;
  const options = Object.assign({
    text: (option) => {
      return option[self2.settings.labelField];
    }
  }, userOptions);
  self2.on("item_remove", function(value) {
    if (!self2.isFocused) {
      return;
    }
    if (self2.control_input.value.trim() === "") {
      var option = self2.options[value];
      if (option) {
        self2.setTextboxValue(options.text.call(self2, option));
      }
    }
  });
}

// node_modules/tom-select/dist/esm/plugins/virtual_scroll/plugin.js
var iterate6 = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};
var addClasses3 = (elmts, ...classes) => {
  var norm_classes = classesArray4(classes);
  elmts = castAsArray4(elmts);
  elmts.map((el) => {
    norm_classes.map((cls) => {
      el.classList.add(cls);
    });
  });
};
var classesArray4 = (args) => {
  var classes = [];
  iterate6(args, (_classes) => {
    if (typeof _classes === "string") {
      _classes = _classes.trim().split(/[\t\n\f\r\s]/);
    }
    if (Array.isArray(_classes)) {
      classes = classes.concat(_classes);
    }
  });
  return classes.filter(Boolean);
};
var castAsArray4 = (arg) => {
  if (!Array.isArray(arg)) {
    arg = [arg];
  }
  return arg;
};
function plugin14() {
  const self2 = this;
  const orig_canLoad = self2.canLoad;
  const orig_clearActiveOption = self2.clearActiveOption;
  const orig_loadCallback = self2.loadCallback;
  var pagination = {};
  var dropdown_content;
  var loading_more = false;
  var load_more_opt;
  var default_values = [];
  var default_values_loaded = false;
  var default_pagination;
  var default_options = [];
  var html_values = [];
  if (!self2.settings.shouldLoadMore) {
    self2.settings.shouldLoadMore = () => {
      const scroll_percent = dropdown_content.clientHeight / (dropdown_content.scrollHeight - dropdown_content.scrollTop);
      if (scroll_percent > 0.9) {
        return true;
      }
      if (self2.activeOption) {
        var selectable = self2.selectable();
        var index = Array.from(selectable).indexOf(self2.activeOption);
        if (index >= selectable.length - 2) {
          return true;
        }
      }
      return false;
    };
  }
  if (!self2.settings.firstUrl) {
    throw "virtual_scroll plugin requires a firstUrl() method";
  }
  self2.settings.sortField = [{
    field: "$order"
  }, {
    field: "$score"
  }];
  const canLoadMore = (query) => {
    if (self2.settings.maxOptions !== null && typeof self2.settings.maxOptions === "number" && dropdown_content.children.length >= self2.settings.maxOptions) {
      return false;
    }
    if (query in pagination && pagination[query]) {
      return true;
    }
    return false;
  };
  const clearFilter = (option, value) => {
    if (self2.items.indexOf(value) >= 0 || default_values.indexOf(value) >= 0) {
      return true;
    }
    return false;
  };
  self2.setNextUrl = (value, next_url) => {
    pagination[value] = next_url;
  };
  self2.getUrl = (query) => {
    if (query in pagination) {
      const next_url = pagination[query];
      pagination[query] = false;
      return next_url;
    }
    self2.clearPagination();
    return self2.settings.firstUrl.call(self2, query);
  };
  self2.clearPagination = () => {
    pagination = {};
  };
  self2.hook("instead", "clearActiveOption", () => {
    if (loading_more) {
      return;
    }
    return orig_clearActiveOption.call(self2);
  });
  self2.hook("instead", "canLoad", (query) => {
    if (!(query in pagination)) {
      return orig_canLoad.call(self2, query);
    }
    return canLoadMore(query);
  });
  self2.hook("instead", "loadCallback", (options, optgroups) => {
    if (!loading_more) {
      const activeFilter = self2.lastValue !== "" ? (_option, value) => self2.items.indexOf(value) >= 0 || html_values.indexOf(value) >= 0 : clearFilter;
      self2.clearOptions(activeFilter);
    } else if (load_more_opt) {
      const first_option = options[0];
      if (first_option !== void 0) {
        load_more_opt.dataset.value = first_option[self2.settings.valueField];
      }
    }
    orig_loadCallback.call(self2, options, optgroups);
    if (!loading_more && !default_values_loaded) {
      default_values_loaded = true;
      if (self2.lastValue === "") {
        default_values = Object.keys(self2.options);
        default_pagination = pagination[""];
        default_options = Object.values(self2.options);
      }
    }
    loading_more = false;
  });
  self2.hook("before", "refreshOptions", () => {
    if (self2.activeOption && "option" !== self2.activeOption.getAttribute("role")) {
      self2.setActiveOption(self2.activeOption.previousElementSibling);
    }
  });
  self2.hook("after", "refreshOptions", () => {
    const query = self2.lastValue;
    var option;
    if (canLoadMore(query)) {
      option = self2.render("loading_more", {
        query
      });
      if (option) {
        option.setAttribute("data-selectable", "");
        load_more_opt = option;
      }
    } else if (query in pagination && !dropdown_content.querySelector(".no-results")) {
      option = self2.render("no_more_results", {
        query
      });
    }
    if (option) {
      addClasses3(option, self2.settings.optionClass);
      dropdown_content.append(option);
    }
  });
  const restoreDefaults = () => {
    if (!default_values_loaded) {
      return;
    }
    self2.addOptions(default_options);
    self2.clearOptions(clearFilter);
    if (default_pagination) {
      pagination[""] = default_pagination;
    }
  };
  self2.on("type", (query) => {
    if (query === "") {
      restoreDefaults();
      self2.refreshOptions(false);
    }
  });
  self2.on("dropdown_close", restoreDefaults);
  self2.on("initialize", () => {
    html_values = Object.keys(self2.options);
    default_values = Object.keys(self2.options);
    dropdown_content = self2.dropdown_content;
    self2.settings.render = Object.assign({}, {
      loading_more: () => {
        return `<div class="loading-more-results">Loading more results ... </div>`;
      },
      no_more_results: () => {
        return `<div class="no-more-results">No more results</div>`;
      }
    }, self2.settings.render);
    dropdown_content.addEventListener("scroll", () => {
      if (!self2.settings.shouldLoadMore.call(self2)) {
        return;
      }
      if (!canLoadMore(self2.lastValue)) {
        return;
      }
      if (loading_more) return;
      loading_more = true;
      self2.load.call(self2, self2.lastValue);
    });
  });
}

// node_modules/tom-select/dist/esm/tom-select.complete.js
TomSelect.define("change_listener", plugin);
TomSelect.define("checkbox_options", plugin2);
TomSelect.define("clear_button", plugin3);
TomSelect.define("drag_drop", plugin4);
TomSelect.define("dropdown_header", plugin5);
TomSelect.define("caret_position", plugin6);
TomSelect.define("dropdown_input", plugin7);
TomSelect.define("input_autogrow", plugin8);
TomSelect.define("no_backspace_delete", plugin9);
TomSelect.define("no_active_items", plugin10);
TomSelect.define("optgroup_columns", plugin11);
TomSelect.define("remove_button", plugin12);
TomSelect.define("restore_on_backspace", plugin13);
TomSelect.define("virtual_scroll", plugin14);
var tom_select_complete_default = TomSelect;

// node_modules/@uppy/core/lib/utils/NetworkError.js
var NetworkError = class extends Error {
  cause;
  isNetworkError;
  request;
  constructor(error, xhr = null) {
    super(`This looks like a network error, the endpoint might be blocked by an internet provider or a firewall.`);
    this.cause = error;
    this.isNetworkError = true;
    this.request = xhr;
  }
};
var NetworkError_default = NetworkError;

// node_modules/@uppy/core/lib/utils/ProgressTimeout.js
var ProgressTimeout = class {
  #aliveTimer;
  #isDone = false;
  #onTimedOut;
  #timeout;
  constructor(timeout2, timeoutHandler) {
    this.#timeout = timeout2;
    this.#onTimedOut = () => timeoutHandler(timeout2);
  }
  progress() {
    if (this.#isDone)
      return;
    if (this.#timeout > 0) {
      clearTimeout(this.#aliveTimer);
      this.#aliveTimer = setTimeout(this.#onTimedOut, this.#timeout);
    }
  }
  done() {
    if (!this.#isDone) {
      clearTimeout(this.#aliveTimer);
      this.#aliveTimer = void 0;
      this.#isDone = true;
    }
  }
};
var ProgressTimeout_default = ProgressTimeout;

// node_modules/@uppy/core/lib/utils/fetcher.js
var noop = () => {
};
function fetcher(url, options = {}) {
  const { body = null, headers = {}, method = "GET", onBeforeRequest = noop, onUploadProgress = noop, shouldRetry = () => true, onAfterResponse = noop, onTimeout = noop, responseType, retries = 3, signal = null, timeout: timeout2 = 3e4, withCredentials = false } = options;
  const delay = (attempt) => 0.3 * 2 ** (attempt - 1) * 1e3;
  const timer = new ProgressTimeout_default(timeout2, onTimeout);
  function requestWithRetry(retryCount = 0) {
    return new Promise(async (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const onError = (error) => {
        if (shouldRetry(xhr) && retryCount < retries) {
          setTimeout(() => {
            requestWithRetry(retryCount + 1).then(resolve, reject);
          }, delay(retryCount));
        } else {
          timer.done();
          reject(error);
        }
      };
      xhr.open(method, url, true);
      xhr.withCredentials = withCredentials;
      if (responseType) {
        xhr.responseType = responseType;
      }
      xhr.onload = async () => {
        try {
          await onAfterResponse(xhr, retryCount);
        } catch (err) {
          err.request = xhr;
          onError(err);
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          timer.done();
          resolve(xhr);
        } else if (shouldRetry(xhr) && retryCount < retries) {
          setTimeout(() => {
            requestWithRetry(retryCount + 1).then(resolve, reject);
          }, delay(retryCount));
        } else {
          timer.done();
          reject(new NetworkError_default(xhr.statusText, xhr));
        }
      };
      xhr.onerror = () => onError(new NetworkError_default(xhr.statusText, xhr));
      xhr.upload.onprogress = (event) => {
        timer.progress();
        onUploadProgress(event);
      };
      if (headers) {
        Object.keys(headers).forEach((key) => {
          xhr.setRequestHeader(key, headers[key]);
        });
      }
      function abort() {
        xhr.abort();
        reject(new DOMException("Aborted", "AbortError"));
      }
      signal?.addEventListener("abort", abort);
      if (signal?.aborted) {
        abort();
        return;
      }
      await onBeforeRequest(xhr, retryCount);
      xhr.send(body);
    });
  }
  return requestWithRetry();
}

// node_modules/@uppy/core/lib/utils/fileFilters.js
var hasError = (file) => "error" in file && !!file.error;
var isCompleted = (file) => file.progress.uploadComplete;
function filterFilesToUpload(files) {
  return files.filter((file) => !hasError(file) && !isCompleted(file));
}
function filterFilesToEmitUploadStarted(files) {
  return files.filter((file) => !file.progress?.uploadStarted || !file.isRestored);
}

// node_modules/@uppy/core/lib/utils/getFileNameAndExtension.js
function getFileNameAndExtension(fullFileName) {
  const lastDot = fullFileName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === fullFileName.length - 1) {
    return {
      name: fullFileName,
      extension: void 0
    };
  }
  return {
    name: fullFileName.slice(0, lastDot),
    extension: fullFileName.slice(lastDot + 1)
  };
}

// node_modules/@uppy/core/lib/utils/mimeTypes.js
var mimeTypes_default = {
  __proto__: null,
  md: "text/markdown",
  markdown: "text/markdown",
  mp4: "video/mp4",
  mp3: "audio/mp3",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  yaml: "text/yaml",
  yml: "text/yaml",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  tab: "text/tab-separated-values",
  avi: "video/x-msvideo",
  mks: "video/x-matroska",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  dicom: "application/dicom",
  doc: "application/msword",
  msg: "application/vnd.ms-outlook",
  docm: "application/vnd.ms-word.document.macroenabled.12",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dot: "application/msword",
  dotm: "application/vnd.ms-word.template.macroenabled.12",
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  xla: "application/vnd.ms-excel",
  xlam: "application/vnd.ms-excel.addin.macroenabled.12",
  xlc: "application/vnd.ms-excel",
  xlf: "application/x-xliff+xml",
  xlm: "application/vnd.ms-excel",
  xls: "application/vnd.ms-excel",
  xlsb: "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  xlsm: "application/vnd.ms-excel.sheet.macroenabled.12",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlt: "application/vnd.ms-excel",
  xltm: "application/vnd.ms-excel.template.macroenabled.12",
  xltx: "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  xlw: "application/vnd.ms-excel",
  txt: "text/plain",
  text: "text/plain",
  conf: "text/plain",
  log: "text/plain",
  pdf: "application/pdf",
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  rar: "application/x-rar-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  dmg: "application/x-apple-diskimage"
};

// node_modules/@uppy/core/lib/utils/getFileType.js
function getFileType(file) {
  if (file.type)
    return file.type;
  const fileExtension = file.name ? getFileNameAndExtension(file.name).extension?.toLowerCase() : null;
  if (fileExtension && fileExtension in mimeTypes_default) {
    return mimeTypes_default[fileExtension];
  }
  return "application/octet-stream";
}

// node_modules/@uppy/core/lib/utils/generateFileID.js
function encodeCharacter(character) {
  return character.charCodeAt(0).toString(32);
}
function encodeFilename(name) {
  let suffix = "";
  return name.replace(/[^A-Z0-9]/gi, (character) => {
    suffix += `-${encodeCharacter(character)}`;
    return "/";
  }) + suffix;
}
function generateFileID(file, instanceId) {
  let id = instanceId || "uppy";
  if (typeof file.name === "string") {
    id += `-${encodeFilename(file.name.toLowerCase())}`;
  }
  if (file.type !== void 0) {
    id += `-${file.type}`;
  }
  if (file.meta && typeof file.meta.relativePath === "string") {
    id += `-${encodeFilename(file.meta.relativePath.toLowerCase())}`;
  }
  if (file.data?.size !== void 0) {
    id += `-${file.data.size}`;
  }
  if (file.data.lastModified !== void 0) {
    id += `-${file.data.lastModified}`;
  }
  return id;
}
function hasFileStableId(file) {
  if (!file.isRemote || !file.remote)
    return false;
  const stableIdProviders = /* @__PURE__ */ new Set([
    "box",
    "dropbox",
    "drive",
    "facebook",
    "unsplash"
  ]);
  return stableIdProviders.has(file.remote.provider);
}
function getSafeFileId(file, instanceId) {
  if (hasFileStableId(file))
    return file.id;
  const fileType = getFileType(file);
  return generateFileID({
    ...file,
    type: fileType
  }, instanceId);
}

// node_modules/@uppy/core/lib/utils/getAllowedMetaFields.js
function getAllowedMetaFields(fields, meta) {
  if (fields === true) {
    return Object.keys(meta);
  }
  if (Array.isArray(fields)) {
    return fields;
  }
  return [];
}

// node_modules/@uppy/core/lib/utils/getTimeStamp.js
function pad(number) {
  return number < 10 ? `0${number}` : number.toString();
}
function getTimeStamp() {
  const date = /* @__PURE__ */ new Date();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${hours}:${minutes}:${seconds}`;
}

// node_modules/@uppy/core/lib/utils/isNetworkError.js
function isNetworkError(xhr) {
  if (!xhr)
    return false;
  return xhr.readyState === 4 && xhr.status === 0;
}
var isNetworkError_default = isNetworkError;

// node_modules/@uppy/core/lib/utils/TaskQueue.js
var TaskQueue = class {
  #queue = [];
  #running = 0;
  #concurrency;
  #paused = false;
  constructor(options) {
    const limit = options?.concurrency;
    this.#concurrency = typeof limit !== "number" || limit === 0 ? Infinity : limit;
  }
  /**
   * Add a task to the queue.
   *
   * @param task - Function receiving AbortSignal, returns Promise
   * @returns AbortablePromise that resolves with task result
   */
  add(task) {
    const controller = new AbortController();
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const queuedTask = {
      run: () => task(controller.signal),
      resolve,
      reject,
      controller
    };
    controller.signal.addEventListener("abort", () => {
      const index = this.#queue.indexOf(queuedTask);
      if (index !== -1) {
        this.#queue.splice(index, 1);
        reject(controller.signal.reason ?? new DOMException("Aborted", "AbortError"));
      }
    }, { once: true });
    promise.abort = (reason) => {
      controller.abort(reason ?? new DOMException("Aborted", "AbortError"));
    };
    promise.abortOn = (signal) => {
      if (signal) {
        const onAbort = () => promise.abort(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
        promise.then(() => signal.removeEventListener("abort", onAbort), () => signal.removeEventListener("abort", onAbort));
      }
      return promise;
    };
    if (!this.#paused && this.#running < this.#concurrency) {
      this.#execute(queuedTask);
    } else {
      this.#queue.push(queuedTask);
    }
    return promise;
  }
  #execute(task) {
    this.#running++;
    if (task.controller.signal.aborted) {
      this.#running--;
      task.reject(task.controller.signal.reason ?? new DOMException("Aborted", "AbortError"));
      this.#advance();
      return;
    }
    let runPromise;
    try {
      runPromise = task.run();
    } catch (error) {
      runPromise = Promise.reject(error);
    }
    runPromise.then((result) => {
      if (task.controller.signal.aborted) {
        task.reject(task.controller.signal.reason ?? new DOMException("Aborted", "AbortError"));
      } else {
        task.resolve(result);
      }
    }, (error) => {
      task.reject(error);
    }).finally(() => {
      this.#running--;
      this.#advance();
    });
  }
  #advance() {
    queueMicrotask(() => {
      if (this.#paused || this.#running >= this.#concurrency)
        return;
      while (this.#queue.length > 0) {
        const next2 = this.#queue.shift();
        if (next2.controller.signal.aborted)
          continue;
        this.#execute(next2);
        return;
      }
    });
  }
  /**
   * Pause the queue. Running tasks continue, but no new tasks start.
   */
  pause() {
    this.#paused = true;
  }
  /**
   * Resume the queue and start processing pending tasks.
   */
  resume() {
    this.#paused = false;
    const available = this.#concurrency - this.#running;
    for (let i8 = 0; i8 < available; i8++) {
      this.#advance();
    }
  }
  /**
   * Clear all pending tasks from the queue.
   * Running tasks are not affected.
   *
   * @param reason - Optional reason for rejection (defaults to AbortError)
   */
  clear(reason) {
    const tasks = this.#queue.splice(0);
    const error = reason ?? new DOMException("Cleared", "AbortError");
    for (const task of tasks) {
      task.controller.abort(error);
      task.reject(error);
    }
  }
  get concurrency() {
    return this.#concurrency;
  }
  set concurrency(value) {
    this.#concurrency = typeof value !== "number" || value === 0 ? Infinity : value;
    if (!this.#paused) {
      const available = this.#concurrency - this.#running;
      for (let i8 = 0; i8 < available; i8++) {
        this.#advance();
      }
    }
  }
  get pending() {
    return this.#queue.length;
  }
  get running() {
    return this.#running;
  }
  get isPaused() {
    return this.#paused;
  }
  /**
   * @deprecated Legacy compatibility wrapper for RateLimitedQueue API.
   * Wraps a function so that when called, it's queued and returns an AbortablePromise.
   * Note: for legacy compatibility with RateLimitedQueue, the wrapped function
   * does not receive this queue's AbortSignal. Aborting the returned promise
   * will reject it, but it will not automatically cancel work inside the wrapped
   * function unless that function is wired to an external AbortSignal.
   */
  wrapPromiseFunction(fn) {
    return (...args) => {
      return this.add((signal) => {
        void signal;
        return fn(...args);
      });
    };
  }
};

// node_modules/@uppy/core/lib/utils/Translator.js
function insertReplacement(source, rx, replacement) {
  const newParts = [];
  source.forEach((chunk) => {
    if (typeof chunk !== "string") {
      newParts.push(chunk);
      return;
    }
    rx[Symbol.split](chunk).forEach((raw, i8, list) => {
      if (raw !== "") {
        newParts.push(raw);
      }
      if (i8 < list.length - 1) {
        newParts.push(replacement);
      }
    });
  });
  return newParts;
}
function interpolate(phrase, options) {
  const dollarRegex = /\$/g;
  const dollarBillsYall = "$$$$";
  let interpolated = [phrase];
  if (options == null)
    return interpolated;
  for (const arg of Object.keys(options)) {
    if (arg !== "_") {
      let replacement = options[arg];
      if (typeof replacement === "string") {
        replacement = dollarRegex[Symbol.replace](replacement, dollarBillsYall);
      }
      interpolated = insertReplacement(interpolated, new RegExp(`%\\{${arg}\\}`, "g"), replacement);
    }
  }
  return interpolated;
}
var defaultOnMissingKey = (key) => {
  throw new Error(`missing string: ${key}`);
};
var Translator = class {
  locale;
  constructor(locales2, { onMissingKey = defaultOnMissingKey } = {}) {
    this.locale = {
      strings: {},
      pluralize(n6) {
        if (n6 === 1) {
          return 0;
        }
        return 1;
      }
    };
    if (Array.isArray(locales2)) {
      locales2.forEach(this.#apply, this);
    } else {
      this.#apply(locales2);
    }
    this.#onMissingKey = onMissingKey;
  }
  #onMissingKey;
  #apply(locale) {
    if (!locale?.strings) {
      return;
    }
    const prevLocale = this.locale;
    Object.assign(this.locale, {
      strings: { ...prevLocale.strings, ...locale.strings },
      pluralize: locale.pluralize || prevLocale.pluralize
    });
  }
  /**
   * Public translate method
   *
   * @param key
   * @param options with values that will be used later to replace placeholders in string
   * @returns string translated (and interpolated)
   */
  translate(key, options) {
    return this.translateArray(key, options).join("");
  }
  /**
   * Get a translation and return the translated and interpolated parts as an array.
   *
   * @returns The translated and interpolated parts, in order.
   */
  translateArray(key, options) {
    let string = this.locale.strings[key];
    if (string == null) {
      this.#onMissingKey(key);
      string = key;
    }
    const hasPluralForms = typeof string === "object";
    if (hasPluralForms) {
      if (options && typeof options.smart_count !== "undefined") {
        const plural = this.locale.pluralize(options.smart_count);
        return interpolate(string[plural], options);
      }
      throw new Error("Attempted to use a string with plural forms, but no value was given for %{smart_count}");
    }
    if (typeof string !== "string") {
      throw new Error(`string was not a string`);
    }
    return interpolate(string, options);
  }
};

// node_modules/@uppy/core/lib/BasePlugin.js
var BasePlugin = class {
  uppy;
  opts;
  id;
  defaultLocale;
  i18n;
  i18nArray;
  type;
  VERSION;
  constructor(uppy, opts) {
    this.uppy = uppy;
    this.opts = opts ?? {};
  }
  getPluginState() {
    const { plugins } = this.uppy.getState();
    return plugins?.[this.id] || {};
  }
  setPluginState(update2) {
    const { plugins } = this.uppy.getState();
    this.uppy.setState({
      plugins: {
        ...plugins,
        [this.id]: {
          ...plugins[this.id],
          ...update2
        }
      }
    });
  }
  setOptions(newOpts) {
    this.opts = { ...this.opts, ...newOpts };
    this.setPluginState(void 0);
    this.i18nInit();
  }
  i18nInit() {
    const translator = new Translator([
      this.defaultLocale,
      this.uppy.locale,
      this.opts.locale
    ]);
    this.i18n = translator.translate.bind(translator);
    this.i18nArray = translator.translateArray.bind(translator);
    this.setPluginState(void 0);
  }
  /**
   * Extendable methods
   * ==================
   * These methods are here to serve as an overview of the extendable methods as well as
   * making them not conditional in use, such as `if (this.afterUpdate)`.
   */
  addTarget(plugin15) {
    throw new Error("Extend the addTarget method to add your plugin to another plugin's target");
  }
  install() {
  }
  uninstall() {
  }
  update(state2) {
  }
  // Called after every state update, after everything's mounted. Debounced.
  afterUpdate() {
  }
};

// node_modules/@uppy/core/lib/EventManager.js
var EventManager = class {
  #uppy;
  #events = [];
  constructor(uppy) {
    this.#uppy = uppy;
  }
  on(event, fn) {
    this.#events.push([event, fn]);
    return this.#uppy.on(event, fn);
  }
  remove() {
    for (const [event, fn] of this.#events.splice(0)) {
      this.#uppy.off(event, fn);
    }
  }
  onFilePause(fileID, cb) {
    this.on("upload-pause", (file, isPaused) => {
      if (fileID === file?.id) {
        cb(isPaused);
      }
    });
  }
  onFileRemove(fileID, cb) {
    this.on("file-removed", (file) => {
      if (fileID === file.id)
        cb(file.id);
    });
  }
  onPause(fileID, cb) {
    this.on("upload-pause", (file, isPaused) => {
      if (fileID === file?.id) {
        cb(isPaused);
      }
    });
  }
  onRetry(fileID, cb) {
    this.on("upload-retry", (file) => {
      if (fileID === file?.id) {
        cb();
      }
    });
  }
  onRetryAll(fileID, cb) {
    this.on("retry-all", () => {
      if (!this.#uppy.getFile(fileID))
        return;
      cb();
    });
  }
  onPauseAll(fileID, cb) {
    this.on("pause-all", () => {
      if (!this.#uppy.getFile(fileID))
        return;
      cb();
    });
  }
  onCancelAll(fileID, eventHandler) {
    this.on("cancel-all", (...args) => {
      if (!this.#uppy.getFile(fileID))
        return;
      eventHandler(...args);
    });
  }
  onResumeAll(fileID, cb) {
    this.on("resume-all", () => {
      if (!this.#uppy.getFile(fileID))
        return;
      cb();
    });
  }
};

// node_modules/@uppy/core/lib/loggers.js
var justErrorsLogger = {
  debug: () => {
  },
  warn: () => {
  },
  error: (...args) => console.error(`[Uppy] [${getTimeStamp()}]`, ...args)
};
var debugLogger = {
  debug: (...args) => console.debug(`[Uppy] [${getTimeStamp()}]`, ...args),
  warn: (...args) => console.warn(`[Uppy] [${getTimeStamp()}]`, ...args),
  error: (...args) => console.error(`[Uppy] [${getTimeStamp()}]`, ...args)
};

// node_modules/@transloadit/prettier-bytes/dist/prettierBytes.js
var units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
function prettierBytes(input, unit) {
  if (typeof input !== "number" || Number.isNaN(input)) {
    throw new TypeError(`Expected a number, got ${typeof input}`);
  }
  const neg = input < 0;
  let num = Math.abs(input);
  if (neg) {
    num = -num;
  }
  if (num === 0) {
    return "0 B";
  }
  const exponent = unit ? units.indexOf(unit) : Math.min(Math.floor(Math.log(num) / Math.log(1024)), units.length - 1);
  const value = Number(num / 1024 ** exponent);
  const displayUnit = units[exponent];
  if (exponent >= 3) {
    return value % 1 === 0 ? `${Math.round(value)} ${displayUnit}` : `${value.toFixed(2)} ${displayUnit}`;
  }
  return `${value >= 10 || value % 1 === 0 ? Math.round(value) : value.toFixed(1)} ${displayUnit}`;
}

// node_modules/@uppy/core/lib/Restricter.js
var import_mime_match = __toESM(require_mime_match(), 1);
var defaultOptions = {
  maxFileSize: null,
  minFileSize: null,
  maxTotalFileSize: null,
  maxNumberOfFiles: null,
  minNumberOfFiles: null,
  allowedFileTypes: null,
  requiredMetaFields: []
};
var RestrictionError = class extends Error {
  isUserFacing;
  file;
  constructor(message, opts) {
    super(message);
    this.isUserFacing = opts?.isUserFacing ?? true;
    if (opts?.file) {
      this.file = opts.file;
    }
  }
  isRestriction = true;
};
var Restricter = class {
  getI18n;
  getOpts;
  constructor(getOpts, getI18n) {
    this.getI18n = getI18n;
    this.getOpts = () => {
      const opts = getOpts();
      if (opts.restrictions?.allowedFileTypes != null && !Array.isArray(opts.restrictions.allowedFileTypes)) {
        throw new TypeError("`restrictions.allowedFileTypes` must be an array");
      }
      return opts;
    };
  }
  // Because these operations are slow, we cannot run them for every file (if we are adding multiple files)
  validateAggregateRestrictions(existingFiles, addingFiles) {
    const { maxTotalFileSize, maxNumberOfFiles } = this.getOpts().restrictions;
    if (maxNumberOfFiles) {
      const nonGhostFiles = existingFiles.filter((f3) => !f3.isGhost);
      if (nonGhostFiles.length + addingFiles.length > maxNumberOfFiles) {
        throw new RestrictionError(`${this.getI18n()("youCanOnlyUploadX", {
          smart_count: maxNumberOfFiles
        })}`);
      }
    }
    if (maxTotalFileSize) {
      const totalFilesSize = [...existingFiles, ...addingFiles].reduce((total, f3) => total + (f3.size ?? 0), 0);
      if (totalFilesSize > maxTotalFileSize) {
        throw new RestrictionError(this.getI18n()("aggregateExceedsSize", {
          sizeAllowed: prettierBytes(maxTotalFileSize),
          size: prettierBytes(totalFilesSize)
        }));
      }
    }
  }
  validateSingleFile(file) {
    const { maxFileSize, minFileSize, allowedFileTypes } = this.getOpts().restrictions;
    if (allowedFileTypes) {
      const isCorrectFileType = allowedFileTypes.some((type) => {
        if (type.includes("/")) {
          if (!file.type)
            return false;
          return (0, import_mime_match.default)(file.type.replace(/;.*?$/, ""), type);
        }
        if (type[0] === "." && file.extension) {
          return file.extension.toLowerCase() === type.slice(1).toLowerCase();
        }
        return false;
      });
      if (!isCorrectFileType) {
        const allowedFileTypesString = allowedFileTypes.join(", ");
        throw new RestrictionError(this.getI18n()("youCanOnlyUploadFileTypes", {
          types: allowedFileTypesString
        }), { file });
      }
    }
    if (maxFileSize && file.size != null && file.size > maxFileSize) {
      throw new RestrictionError(this.getI18n()("exceedsSize", {
        size: prettierBytes(maxFileSize),
        file: file.name ?? this.getI18n()("unnamed")
      }), { file });
    }
    if (minFileSize && file.size != null && file.size < minFileSize) {
      throw new RestrictionError(this.getI18n()("inferiorSize", {
        size: prettierBytes(minFileSize)
      }), { file });
    }
  }
  validate(existingFiles, addingFiles) {
    addingFiles.forEach((addingFile) => {
      this.validateSingleFile(addingFile);
    });
    this.validateAggregateRestrictions(existingFiles, addingFiles);
  }
  validateMinNumberOfFiles(files) {
    const { minNumberOfFiles } = this.getOpts().restrictions;
    if (minNumberOfFiles && Object.keys(files).length < minNumberOfFiles) {
      throw new RestrictionError(this.getI18n()("youHaveToAtLeastSelectX", {
        smart_count: minNumberOfFiles
      }));
    }
  }
  getMissingRequiredMetaFields(file) {
    const error = new RestrictionError(this.getI18n()("missingRequiredMetaFieldOnFile", {
      fileName: file.name ?? this.getI18n()("unnamed")
    }));
    const { requiredMetaFields } = this.getOpts().restrictions;
    const missingFields = [];
    for (const field of requiredMetaFields) {
      if (!Object.hasOwn(file.meta, field) || file.meta[field] === "") {
        missingFields.push(field);
      }
    }
    return { missingFields, error };
  }
};

// node_modules/@uppy/core/lib/Uppy.js
var import_throttle = __toESM(require_throttle(), 1);
var import_namespace_emitter = __toESM(require_namespace_emitter(), 1);

// node_modules/nanoid/non-secure/index.js
var urlAlphabet2 = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
var nanoid2 = (size3 = 21) => {
  let id = "";
  let i8 = size3 | 0;
  while (i8-- > 0) {
    id += urlAlphabet2[Math.random() * 64 | 0];
  }
  return id;
};

// node_modules/@uppy/core/package.json
var package_default = {
  name: "@uppy/core",
  description: "Core module for the extensible JavaScript file upload widget with support for drag&drop, resumable uploads, previews, restrictions, file processing/encoding, remote providers like Dropbox, Google Drive, S3 and more :dog:",
  version: "6.0.1",
  license: "MIT",
  style: "dist/style.min.css",
  type: "module",
  sideEffects: [
    "*.css"
  ],
  scripts: {
    build: "tsc --build tsconfig.build.json",
    "build:css": "sass --load-path=../../ src/style.scss dist/style.css && sass --load-path=../../ src/provider-views/style.scss dist/provider-views.css && postcss dist/style.css -u cssnano -o dist/style.min.css && postcss dist/provider-views.css -u cssnano -o dist/provider-views.min.css",
    typecheck: "tsc --build",
    test: "vitest run --silent='passed-only'"
  },
  keywords: [
    "file uploader",
    "uppy",
    "uppy-plugin"
  ],
  homepage: "https://uppy.io",
  bugs: {
    url: "https://github.com/transloadit/uppy/issues"
  },
  repository: {
    type: "git",
    url: "git+https://github.com/transloadit/uppy.git"
  },
  files: [
    "src",
    "lib",
    "dist",
    "CHANGELOG.md"
  ],
  exports: {
    ".": "./lib/index.js",
    "./css/style.min.css": "./dist/style.min.css",
    "./css/style.css": "./dist/style.css",
    "./css/style.scss": "./src/style.scss",
    "./store-default": "./lib/store/index.js",
    "./utils": "./lib/utils/index.js",
    "./utils/preact": "./lib/utils/preact/index.js",
    "./utils/preact/hooks": "./lib/utils/preact/hooks.js",
    "./companion-client": "./lib/companion-client/index.js",
    "./provider-views": "./lib/provider-views/index.js",
    "./provider-views/css/style.min.css": "./dist/provider-views.min.css",
    "./provider-views/css/style.css": "./dist/provider-views.css",
    "./provider-views/css/style.scss": "./src/provider-views/style.scss",
    "./package.json": "./package.json"
  },
  dependencies: {
    "@transloadit/prettier-bytes": "^2.0.0",
    classnames: "^2.5.1",
    lodash: "^4.18.1",
    "mime-match": "^1.0.2",
    "namespace-emitter": "^2.0.1",
    nanoid: "^5.1.11",
    "p-queue": "^9.3.3",
    "p-retry": "^6.1.0",
    preact: "^10.29.2"
  },
  devDependencies: {
    "@types/deep-freeze": "^0",
    "@types/gapi": "^0.0.47",
    "@types/google.accounts": "^0.0.18",
    "@types/google.picker": "^0.0.52",
    "@types/lodash": "^4.17.25",
    "@types/mime-match": "^1.0.0",
    "@types/namespace-emitter": "^2.0.0",
    "@types/node": "^22.20.1",
    "@vitest/browser-playwright": "^4.1.6",
    cssnano: "^8.0.1",
    "deep-freeze": "^0.0.1",
    playwright: "1.61.1",
    postcss: "^8.5.23",
    "postcss-cli": "^11.0.1",
    sass: "^1.89.2",
    typescript: "^6.0.3",
    vite: "^8.2.2",
    vitest: "^4.1.6"
  }
};

// node_modules/@uppy/core/lib/getFileName.js
function getFileName(fileType, fileDescriptor) {
  if (fileDescriptor.name) {
    return fileDescriptor.name;
  }
  if (fileType.split("/")[0] === "image") {
    return `${fileType.split("/")[0]}.${fileType.split("/")[1]}`;
  }
  return "noname";
}

// node_modules/@uppy/core/lib/locale.js
var locale_default = {
  strings: {
    addBulkFilesFailed: {
      0: "Failed to add %{smart_count} file due to an internal error",
      1: "Failed to add %{smart_count} files due to internal errors"
    },
    youCanOnlyUploadX: {
      0: "You can only upload %{smart_count} file",
      1: "You can only upload %{smart_count} files"
    },
    youHaveToAtLeastSelectX: {
      0: "You have to select at least %{smart_count} file",
      1: "You have to select at least %{smart_count} files"
    },
    aggregateExceedsSize: "You selected %{size} of files, but maximum allowed size is %{sizeAllowed}",
    exceedsSize: "%{file} exceeds maximum allowed size of %{size}",
    missingRequiredMetaField: "Missing required meta fields",
    missingRequiredMetaFieldOnFile: "Missing required meta fields in %{fileName}",
    inferiorSize: "This file is smaller than the allowed size of %{size}",
    youCanOnlyUploadFileTypes: "You can only upload: %{types}",
    noMoreFilesAllowed: "Cannot add more files",
    noDuplicates: "Cannot add the duplicate file '%{fileName}', it already exists",
    companionError: "Connection with Companion failed",
    authAborted: "Authentication aborted",
    companionUnauthorizeHint: "To unauthorize to your %{provider} account, please go to %{url}",
    failedToUpload: "Failed to upload %{file}",
    noInternetConnection: "No Internet connection",
    connectedToInternet: "Connected to the Internet",
    // Strings for remote providers
    noFilesFound: "You have no files or folders here",
    noSearchResults: "Unfortunately, there are no results for this search",
    selectX: {
      0: "Select %{smart_count}",
      1: "Select %{smart_count}"
    },
    allFilesFromFolderNamed: "All files from folder %{name}",
    openFolderNamed: "Open folder %{name}",
    cancel: "Cancel",
    logOut: "Log out",
    logIn: "Log in",
    pickFiles: "Pick files",
    pickPhotos: "Pick photos",
    filter: "Filter",
    resetFilter: "Reset filter",
    loading: "Loading...",
    loadedXFiles: "Loaded %{numFiles} files",
    authenticateWithTitle: "Please authenticate with %{pluginName} to select files",
    authenticateWith: "Connect to %{pluginName}",
    signInWithGoogle: "Sign in with Google",
    searchImages: "Search for images",
    enterTextToSearch: "Enter text to search for images",
    search: "Search",
    resetSearch: "Reset search",
    emptyFolderAdded: "No files were added from empty folder",
    addedNumFiles: "Added %{numFiles} file(s)",
    folderAlreadyAdded: 'The folder "%{folder}" was already added',
    folderAdded: {
      0: "Added %{smart_count} file from %{folder}",
      1: "Added %{smart_count} files from %{folder}"
    },
    additionalRestrictionsFailed: "%{count} additional restrictions were not fulfilled",
    unnamed: "Unnamed",
    pleaseWait: "Please wait"
  }
};

// node_modules/@uppy/core/lib/store/index.js
var DefaultStore = class {
  static VERSION = package_default.version;
  state = {};
  #callbacks = /* @__PURE__ */ new Set();
  getState() {
    return this.state;
  }
  setState(patch) {
    const prevState = { ...this.state };
    const nextState = { ...this.state, ...patch };
    this.state = nextState;
    this.#publish(prevState, nextState, patch);
  }
  subscribe(listener) {
    this.#callbacks.add(listener);
    return () => {
      this.#callbacks.delete(listener);
    };
  }
  #publish(...args) {
    this.#callbacks.forEach((listener) => {
      listener(...args);
    });
  }
};
var store_default = DefaultStore;

// node_modules/@uppy/core/lib/supportsUploadProgress.js
function supportsUploadProgress(userAgent) {
  if (userAgent == null && typeof navigator !== "undefined") {
    userAgent = navigator.userAgent;
  }
  if (!userAgent)
    return true;
  const m2 = /Edge\/(\d+\.\d+)/.exec(userAgent);
  if (!m2)
    return true;
  const edgeVersion = m2[1];
  const version = edgeVersion.split(".", 2);
  const major = parseInt(version[0], 10);
  const minor = parseInt(version[1], 10);
  if (major < 15 || major === 15 && minor < 15063) {
    return true;
  }
  if (major > 18 || major === 18 && minor >= 18218) {
    return true;
  }
  return false;
}

// node_modules/@uppy/core/lib/Uppy.js
var defaultUploadState = {
  totalProgress: 0,
  allowNewUpload: true,
  error: null,
  recoveredState: null
};
var Uppy = class _Uppy {
  static VERSION = package_default.version;
  #plugins = /* @__PURE__ */ Object.create(null);
  #restricter;
  #storeUnsubscribe;
  #emitter = (0, import_namespace_emitter.default)();
  #preProcessors = /* @__PURE__ */ new Set();
  #uploaders = /* @__PURE__ */ new Set();
  #postProcessors = /* @__PURE__ */ new Set();
  defaultLocale;
  locale;
  // The user optionally passes in options, but we set defaults for missing options.
  // We consider all options present after the contructor has run.
  opts;
  store;
  // Warning: do not use this from a plugin, as it will cause the plugins' translations to be missing
  i18n;
  i18nArray;
  scheduledAutoProceed = null;
  wasOffline = false;
  /**
   * Instantiate Uppy
   */
  constructor(opts) {
    this.defaultLocale = locale_default;
    const defaultOptions3 = {
      id: "uppy",
      autoProceed: false,
      allowMultipleUploadBatches: true,
      debug: false,
      restrictions: defaultOptions,
      meta: {},
      onBeforeFileAdded: (file, files) => !Object.hasOwn(files, file.id),
      onBeforeUpload: (files) => files,
      store: new store_default(),
      logger: justErrorsLogger,
      infoTimeout: 5e3
    };
    const merged = { ...defaultOptions3, ...opts };
    this.opts = {
      ...merged,
      restrictions: {
        ...defaultOptions3.restrictions,
        ...opts?.restrictions
      }
    };
    if (opts?.logger && opts.debug) {
      this.log("You are using a custom `logger`, but also set `debug: true`, which uses built-in logger to output logs to console. Ignoring `debug: true` and using your custom `logger`.", "warning");
    } else if (opts?.debug) {
      this.opts.logger = debugLogger;
    }
    this.log(`Using Core v${_Uppy.VERSION}`);
    this.i18nInit();
    this.store = this.opts.store;
    this.setState({
      ...defaultUploadState,
      plugins: {},
      files: {},
      currentUploads: {},
      capabilities: {
        uploadProgress: supportsUploadProgress(),
        individualCancellation: true,
        resumableUploads: false
      },
      meta: { ...this.opts.meta },
      info: []
    });
    this.#restricter = new Restricter(() => this.opts, () => this.i18n);
    this.#storeUnsubscribe = this.store.subscribe((prevState, nextState, patch) => {
      this.emit("state-update", prevState, nextState, patch);
      this.updateAll(nextState);
    });
    if (this.opts.debug && typeof window !== "undefined") {
      window[this.opts.id] = this;
    }
    this.#addListeners();
  }
  emit(event, ...args) {
    this.#emitter.emit(event, ...args);
  }
  on(event, callback) {
    this.#emitter.on(event, callback);
    return this;
  }
  once(event, callback) {
    this.#emitter.once(event, callback);
    return this;
  }
  off(event, callback) {
    this.#emitter.off(event, callback);
    return this;
  }
  /**
   * Iterate on all plugins and run `update` on them.
   * Called each time state changes.
   *
   */
  updateAll(state2) {
    this.iteratePlugins((plugin15) => {
      plugin15.update(state2);
    });
  }
  /**
   * Updates state with a patch
   */
  setState(patch) {
    this.store.setState(patch);
  }
  /**
   * Returns current state.
   */
  getState() {
    return this.store.getState();
  }
  patchFilesState(filesWithNewState) {
    const existingFilesState = this.getState().files;
    this.setState({
      files: {
        ...existingFilesState,
        ...Object.fromEntries(Object.entries(filesWithNewState).map(([fileID, newFileState]) => [
          fileID,
          {
            ...existingFilesState[fileID],
            ...newFileState
          }
        ]))
      }
    });
  }
  /**
   * Shorthand to set state for a specific file.
   */
  setFileState(fileID, state2) {
    if (!this.getState().files[fileID]) {
      throw new Error(`Can\u2019t set state for ${fileID} (the file could have been removed)`);
    }
    this.patchFilesState({ [fileID]: state2 });
  }
  i18nInit() {
    const onMissingKey = (key) => this.log(`Missing i18n string: ${key}`, "error");
    const translator = new Translator([this.defaultLocale, this.opts.locale], {
      onMissingKey
    });
    this.i18n = translator.translate.bind(translator);
    this.i18nArray = translator.translateArray.bind(translator);
    this.locale = translator.locale;
  }
  setOptions(newOpts) {
    this.opts = {
      ...this.opts,
      ...newOpts,
      restrictions: {
        ...this.opts.restrictions,
        ...newOpts?.restrictions
      }
    };
    if (newOpts.meta) {
      this.setMeta(newOpts.meta);
    }
    this.i18nInit();
    if (newOpts.locale) {
      this.iteratePlugins((plugin15) => {
        plugin15.setOptions(newOpts);
      });
    }
    this.setState(void 0);
  }
  resetProgress() {
    const defaultProgress = {
      percentage: 0,
      bytesUploaded: false,
      uploadComplete: false,
      uploadStarted: null
    };
    const files = { ...this.getState().files };
    const updatedFiles = /* @__PURE__ */ Object.create(null);
    Object.keys(files).forEach((fileID) => {
      updatedFiles[fileID] = {
        ...files[fileID],
        progress: {
          ...files[fileID].progress,
          ...defaultProgress
        },
        // @ts-expect-error these types are inserted
        // into the namespace in their respective packages
        // but core isn't aware of those
        tus: void 0,
        transloadit: void 0,
        s3Multipart: void 0
      };
    });
    this.setState({ files: updatedFiles, ...defaultUploadState });
  }
  clear() {
    const { capabilities, currentUploads } = this.getState();
    if (Object.keys(currentUploads).length > 0 && !capabilities.individualCancellation) {
      throw new Error("The installed uploader plugin does not allow removing files during an upload.");
    }
    this.setState({ ...defaultUploadState, files: {} });
  }
  addPreProcessor(fn) {
    this.#preProcessors.add(fn);
  }
  removePreProcessor(fn) {
    return this.#preProcessors.delete(fn);
  }
  addPostProcessor(fn) {
    this.#postProcessors.add(fn);
  }
  removePostProcessor(fn) {
    return this.#postProcessors.delete(fn);
  }
  addUploader(fn) {
    this.#uploaders.add(fn);
  }
  removeUploader(fn) {
    return this.#uploaders.delete(fn);
  }
  setMeta(data) {
    const updatedMeta = { ...this.getState().meta, ...data };
    const updatedFiles = { ...this.getState().files };
    Object.keys(updatedFiles).forEach((fileID) => {
      updatedFiles[fileID] = {
        ...updatedFiles[fileID],
        meta: { ...updatedFiles[fileID].meta, ...data }
      };
    });
    this.log("Adding metadata:");
    this.log(data);
    this.setState({
      meta: updatedMeta,
      files: updatedFiles
    });
  }
  setFileMeta(fileID, data) {
    const updatedFiles = { ...this.getState().files };
    if (!updatedFiles[fileID]) {
      this.log(`Was trying to set metadata for a file that has been removed: ${fileID}`);
      return;
    }
    const newMeta = { ...updatedFiles[fileID].meta, ...data };
    updatedFiles[fileID] = { ...updatedFiles[fileID], meta: newMeta };
    this.setState({ files: updatedFiles });
  }
  /**
   * Get a file object.
   */
  getFile(fileID) {
    return this.getState().files[fileID];
  }
  /**
   * Get all files in an array.
   */
  getFiles() {
    const { files } = this.getState();
    return Object.values(files);
  }
  getFilesByIds(ids) {
    return ids.map((id) => this.getFile(id));
  }
  getObjectOfFilesPerState() {
    const { files: filesObject, totalProgress, error } = this.getState();
    const files = Object.values(filesObject);
    const inProgressFiles = [];
    const newFiles = [];
    const startedFiles = [];
    const uploadStartedFiles = [];
    const pausedFiles = [];
    const completeFiles = [];
    const erroredFiles = [];
    const inProgressNotPausedFiles = [];
    const processingFiles = [];
    for (const file of files) {
      const { progress } = file;
      if (!progress.uploadComplete && progress.uploadStarted) {
        inProgressFiles.push(file);
        if (!file.isPaused) {
          inProgressNotPausedFiles.push(file);
        }
      }
      if (!progress.uploadStarted) {
        newFiles.push(file);
      }
      if (progress.uploadStarted || progress.preprocess || progress.postprocess) {
        startedFiles.push(file);
      }
      if (progress.uploadStarted) {
        uploadStartedFiles.push(file);
      }
      if (file.isPaused) {
        pausedFiles.push(file);
      }
      if (progress.uploadComplete) {
        completeFiles.push(file);
      }
      if (file.error) {
        erroredFiles.push(file);
      }
      if (progress.preprocess || progress.postprocess) {
        processingFiles.push(file);
      }
    }
    return {
      newFiles,
      startedFiles,
      uploadStartedFiles,
      pausedFiles,
      completeFiles,
      erroredFiles,
      inProgressFiles,
      inProgressNotPausedFiles,
      processingFiles,
      isUploadStarted: uploadStartedFiles.length > 0,
      isAllComplete: totalProgress === 100 && completeFiles.length === files.length && processingFiles.length === 0,
      isAllErrored: !!error && erroredFiles.length === files.length,
      isAllPaused: inProgressFiles.length !== 0 && pausedFiles.length === inProgressFiles.length,
      isUploadInProgress: inProgressFiles.length > 0,
      isSomeGhost: files.some((file) => file.isGhost)
    };
  }
  #informAndEmit(errors) {
    for (const error of errors) {
      if (error.isRestriction) {
        this.emit("restriction-failed", error.file, error);
      } else {
        this.emit("error", error, error.file);
      }
      this.log(error, "warning");
    }
    const userFacingErrors = errors.filter((error) => error.isUserFacing);
    const maxNumToShow = 4;
    const firstErrors = userFacingErrors.slice(0, maxNumToShow);
    const additionalErrors = userFacingErrors.slice(maxNumToShow);
    firstErrors.forEach(({ message, details = "" }) => {
      this.info({ message, details }, "error", this.opts.infoTimeout);
    });
    if (additionalErrors.length > 0) {
      this.info({
        message: this.i18n("additionalRestrictionsFailed", {
          count: additionalErrors.length
        })
      });
    }
  }
  validateRestrictions(file, files = this.getFiles()) {
    try {
      this.#restricter.validate(files, [file]);
    } catch (err) {
      return err;
    }
    return null;
  }
  validateSingleFile(file) {
    try {
      this.#restricter.validateSingleFile(file);
    } catch (err) {
      return err.message;
    }
    return null;
  }
  validateAggregateRestrictions(files) {
    const existingFiles = this.getFiles();
    try {
      this.#restricter.validateAggregateRestrictions(existingFiles, files);
    } catch (err) {
      return err.message;
    }
    return null;
  }
  #checkRequiredMetaFieldsOnFile(file) {
    const { missingFields, error } = this.#restricter.getMissingRequiredMetaFields(file);
    if (missingFields.length > 0) {
      this.setFileState(file.id, {
        missingRequiredMetaFields: missingFields,
        error: error.message
      });
      this.log(error.message);
      this.emit("restriction-failed", file, error);
      return false;
    }
    if (missingFields.length === 0 && file.missingRequiredMetaFields) {
      this.setFileState(file.id, {
        missingRequiredMetaFields: []
      });
    }
    return true;
  }
  #checkRequiredMetaFields(files) {
    let success = true;
    for (const file of Object.values(files)) {
      if (!this.#checkRequiredMetaFieldsOnFile(file)) {
        success = false;
      }
    }
    return success;
  }
  #assertNewUploadAllowed(file) {
    const { allowNewUpload } = this.getState();
    if (allowNewUpload === false) {
      const error = new RestrictionError(this.i18n("noMoreFilesAllowed"), {
        file
      });
      this.#informAndEmit([error]);
      throw error;
    }
  }
  checkIfFileAlreadyExists(fileID) {
    const { files } = this.getState();
    if (files[fileID] && !files[fileID].isGhost) {
      return true;
    }
    return false;
  }
  /**
   * Create a file state object based on user-provided `addFile()` options.
   */
  #transformFile(fileDescriptorOrFile) {
    const file = fileDescriptorOrFile instanceof File ? {
      name: fileDescriptorOrFile.name,
      type: fileDescriptorOrFile.type,
      size: fileDescriptorOrFile.size,
      data: fileDescriptorOrFile,
      meta: {},
      isRemote: false,
      source: void 0,
      preview: void 0
    } : fileDescriptorOrFile;
    const fileType = getFileType(file);
    const fileName = getFileName(fileType, file);
    const fileExtension = getFileNameAndExtension(fileName).extension;
    const id = getSafeFileId(file, this.getID());
    const meta = {
      ...file.meta,
      name: fileName,
      type: fileType
    };
    const size3 = Number.isFinite(file.data.size) ? file.data.size : null;
    return {
      source: file.source || "",
      id,
      name: fileName,
      extension: fileExtension || "",
      meta: {
        ...this.getState().meta,
        ...meta
      },
      type: fileType,
      progress: {
        percentage: 0,
        bytesUploaded: false,
        bytesTotal: size3,
        uploadComplete: false,
        uploadStarted: null
      },
      size: size3,
      isGhost: false,
      ...file.isRemote ? {
        isRemote: true,
        remote: file.remote,
        data: file.data
      } : {
        isRemote: false,
        data: file.data
      },
      preview: file.preview
    };
  }
  // Schedule an upload if `autoProceed` is enabled.
  #startIfAutoProceed() {
    if (this.opts.autoProceed && !this.scheduledAutoProceed) {
      this.scheduledAutoProceed = setTimeout(() => {
        this.scheduledAutoProceed = null;
        this.upload().catch((err) => {
          if (!err.isRestriction) {
            this.log(err.stack || err.message || err);
          }
        });
      }, 4);
    }
  }
  #checkAndUpdateFileState(filesToAdd) {
    let { files: existingFiles } = this.getState();
    let nextFilesState = { ...existingFiles };
    const validFilesToAdd = [];
    const errors = [];
    for (const fileToAdd of filesToAdd) {
      try {
        let newFile = this.#transformFile(fileToAdd);
        this.#assertNewUploadAllowed(newFile);
        const existingFile = existingFiles[newFile.id];
        const isGhost = existingFile?.isGhost;
        if (isGhost && !newFile.isRemote) {
          if (newFile.data == null)
            throw new Error("File data is missing");
          newFile = {
            ...existingFile,
            isGhost: false,
            data: newFile.data
          };
          this.log(`Replaced the blob in the restored ghost file: ${newFile.name}, ${newFile.id}`);
        }
        const onBeforeFileAddedResult = this.opts.onBeforeFileAdded(newFile, nextFilesState);
        existingFiles = this.getState().files;
        nextFilesState = { ...existingFiles, ...nextFilesState };
        if (!onBeforeFileAddedResult && this.checkIfFileAlreadyExists(newFile.id)) {
          throw new RestrictionError(this.i18n("noDuplicates", {
            fileName: newFile.name ?? this.i18n("unnamed")
          }), { file: newFile });
        }
        if (onBeforeFileAddedResult === false && !isGhost) {
          throw new RestrictionError("Cannot add the file because onBeforeFileAdded returned false.", { isUserFacing: false, file: newFile });
        } else if (typeof onBeforeFileAddedResult === "object" && onBeforeFileAddedResult !== null) {
          newFile = onBeforeFileAddedResult;
        }
        this.#restricter.validateSingleFile(newFile);
        nextFilesState[newFile.id] = newFile;
        validFilesToAdd.push(newFile);
      } catch (err) {
        errors.push(err);
      }
    }
    try {
      this.#restricter.validateAggregateRestrictions(Object.values(existingFiles), validFilesToAdd);
    } catch (err) {
      errors.push(err);
      return {
        nextFilesState: existingFiles,
        validFilesToAdd: [],
        errors
      };
    }
    return {
      nextFilesState,
      validFilesToAdd,
      errors
    };
  }
  /**
   * Add a new file to `state.files`. Runs `onBeforeFileAdded`, guesses the
   * file type, checks the file against restrictions, and starts an upload if
   * `autoProceed === true`.
   *
   * Emits `file-added` and `files-added` with a single-element array. Throws
   * on the first error, including restriction errors. Use `addFiles` for
   * multi-file adds — see its documentation for batch semantics.
   */
  addFile(file) {
    const { nextFilesState, validFilesToAdd, errors } = this.#checkAndUpdateFileState([file]);
    const restrictionErrors = errors.filter((error) => error.isRestriction);
    this.#informAndEmit(restrictionErrors);
    if (errors.length > 0)
      throw errors[0];
    this.setState({ files: nextFilesState });
    const [firstValidFileToAdd] = validFilesToAdd;
    this.emit("file-added", firstValidFileToAdd);
    this.emit("files-added", validFilesToAdd);
    this.log(`Added file: ${firstValidFileToAdd.name}, ${firstValidFileToAdd.id}, mime type: ${firstValidFileToAdd.type}`);
    this.#startIfAutoProceed();
    return firstValidFileToAdd.id;
  }
  /**
   * Add multiple files to `state.files`.
   *
   * Emits `file-added` per accepted file and `files-added` once for the batch.
   * Restriction failures emit `restriction-failed` and show an info message
   * without throwing — valid files in the same batch are still added. Any
   * non-restriction error (for example, an exception from `onBeforeFileAdded`)
   * is aggregated into an `AggregateError` (with `.errors`) and thrown
   * *before* state is updated — when this happens, no files from the batch
   * are added and `files-added` is not emitted.
   *
   * Prefer this over calling `addFile` in a loop when adding multiple files:
   * batch listeners on `files-added` fire exactly once, and restriction
   * failures on individual files do not abort the batch. Non-restriction
   * errors still abort the batch before any files are added.
   */
  addFiles(fileDescriptors) {
    const { nextFilesState, validFilesToAdd, errors } = this.#checkAndUpdateFileState(fileDescriptors);
    const restrictionErrors = errors.filter((error) => error.isRestriction);
    this.#informAndEmit(restrictionErrors);
    const nonRestrictionErrors = errors.filter((error) => !error.isRestriction);
    if (nonRestrictionErrors.length > 0) {
      let message = "Multiple errors occurred while adding files:\n";
      nonRestrictionErrors.forEach((subError) => {
        message += `
 * ${subError.message}`;
      });
      this.info({
        message: this.i18n("addBulkFilesFailed", {
          smart_count: nonRestrictionErrors.length
        }),
        details: message
      }, "error", this.opts.infoTimeout);
      if (typeof AggregateError === "function") {
        throw new AggregateError(nonRestrictionErrors, message);
      } else {
        const err = new Error(message);
        err.errors = nonRestrictionErrors;
        throw err;
      }
    }
    this.setState({ files: nextFilesState });
    validFilesToAdd.forEach((file) => {
      this.emit("file-added", file);
    });
    this.emit("files-added", validFilesToAdd);
    if (validFilesToAdd.length > 5) {
      this.log(`Added batch of ${validFilesToAdd.length} files`);
    } else {
      Object.values(validFilesToAdd).forEach((file) => {
        this.log(`Added file: ${file.name}
 id: ${file.id}
 type: ${file.type}`);
      });
    }
    if (validFilesToAdd.length > 0) {
      this.#startIfAutoProceed();
    }
  }
  removeFiles(fileIDs) {
    const { files, currentUploads } = this.getState();
    const updatedFiles = { ...files };
    const updatedUploads = { ...currentUploads };
    const removedFiles = /* @__PURE__ */ Object.create(null);
    fileIDs.forEach((fileID) => {
      if (files[fileID]) {
        removedFiles[fileID] = files[fileID];
        delete updatedFiles[fileID];
      }
    });
    function fileIsNotRemoved(uploadFileID) {
      return removedFiles[uploadFileID] === void 0;
    }
    Object.keys(updatedUploads).forEach((uploadID) => {
      const newFileIDs = currentUploads[uploadID].fileIDs.filter(fileIsNotRemoved);
      if (newFileIDs.length === 0) {
        delete updatedUploads[uploadID];
        return;
      }
      const { capabilities } = this.getState();
      if (newFileIDs.length !== currentUploads[uploadID].fileIDs.length && !capabilities.individualCancellation) {
        throw new Error("The installed uploader plugin does not allow removing files during an upload.");
      }
      updatedUploads[uploadID] = {
        ...currentUploads[uploadID],
        fileIDs: newFileIDs
      };
    });
    const stateUpdate = {
      currentUploads: updatedUploads,
      files: updatedFiles
    };
    if (Object.keys(updatedFiles).length === 0) {
      stateUpdate.allowNewUpload = true;
      stateUpdate.error = null;
      stateUpdate.recoveredState = null;
    }
    this.setState(stateUpdate);
    this.#updateTotalProgressThrottled();
    const removedFileIDs = Object.keys(removedFiles);
    removedFileIDs.forEach((fileID) => {
      this.emit("file-removed", removedFiles[fileID]);
    });
    if (removedFileIDs.length > 5) {
      this.log(`Removed ${removedFileIDs.length} files`);
    } else {
      this.log(`Removed files: ${removedFileIDs.join(", ")}`);
    }
  }
  removeFile(fileID) {
    this.removeFiles([fileID]);
  }
  pauseResume(fileID) {
    if (!this.getState().capabilities.resumableUploads || this.getFile(fileID).progress.uploadComplete) {
      return void 0;
    }
    const file = this.getFile(fileID);
    const wasPaused = file.isPaused || false;
    const isPaused = !wasPaused;
    this.setFileState(fileID, {
      isPaused
    });
    this.emit("upload-pause", file, isPaused);
    return isPaused;
  }
  pauseAll() {
    const updatedFiles = { ...this.getState().files };
    const inProgressUpdatedFiles = Object.keys(updatedFiles).filter((file) => {
      return !updatedFiles[file].progress.uploadComplete && updatedFiles[file].progress.uploadStarted;
    });
    inProgressUpdatedFiles.forEach((file) => {
      const updatedFile = { ...updatedFiles[file], isPaused: true };
      updatedFiles[file] = updatedFile;
    });
    this.setState({ files: updatedFiles });
    this.emit("pause-all");
  }
  resumeAll() {
    const updatedFiles = { ...this.getState().files };
    const inProgressUpdatedFiles = Object.keys(updatedFiles).filter((file) => {
      return !updatedFiles[file].progress.uploadComplete && updatedFiles[file].progress.uploadStarted;
    });
    inProgressUpdatedFiles.forEach((file) => {
      const updatedFile = {
        ...updatedFiles[file],
        isPaused: false,
        error: null
      };
      updatedFiles[file] = updatedFile;
    });
    this.setState({ files: updatedFiles });
    this.emit("resume-all");
  }
  #getFilesToRetry() {
    const { files } = this.getState();
    return Object.keys(files).filter((fileId) => {
      const file = files[fileId];
      return file.error && (!file.missingRequiredMetaFields || file.missingRequiredMetaFields.length === 0);
    });
  }
  async #doRetryAll() {
    const filesToRetry = this.#getFilesToRetry();
    const updatedFiles = { ...this.getState().files };
    filesToRetry.forEach((fileID) => {
      updatedFiles[fileID] = {
        ...updatedFiles[fileID],
        isPaused: false,
        error: null
      };
    });
    this.setState({
      files: updatedFiles,
      error: null
    });
    this.emit("retry-all", this.getFilesByIds(filesToRetry));
    if (filesToRetry.length === 0) {
      return {
        successful: [],
        failed: []
      };
    }
    const uploadID = this.#createUpload(filesToRetry, {
      forceAllowNewUpload: true
      // create new upload even if allowNewUpload: false
    });
    return this.#runUpload(uploadID);
  }
  async retryAll() {
    const result = await this.#doRetryAll();
    this.emit("complete", result);
    return result;
  }
  cancelAll() {
    this.emit("cancel-all");
    const { files } = this.getState();
    const fileIDs = Object.keys(files);
    if (fileIDs.length) {
      this.removeFiles(fileIDs);
    }
    this.setState(defaultUploadState);
  }
  /**
   * Retry a specific file that has errored.
   */
  retryUpload(fileID) {
    this.setFileState(fileID, {
      error: null,
      isPaused: false
    });
    this.emit("upload-retry", this.getFile(fileID));
    const uploadID = this.#createUpload([fileID], {
      forceAllowNewUpload: true
      // create new upload even if allowNewUpload: false
    });
    return this.#runUpload(uploadID);
  }
  logout() {
    this.iteratePlugins((plugin15) => {
      ;
      plugin15.provider?.logout?.();
    });
  }
  #handleUploadProgress = (file, progress) => {
    const fileInState = file ? this.getFile(file.id) : void 0;
    if (file == null || !fileInState) {
      this.log(`Not setting progress for a file that has been removed: ${file?.id}`);
      return;
    }
    if (fileInState.progress.percentage === 100) {
      this.log(`Not setting progress for a file that has been already uploaded: ${file.id}`);
      return;
    }
    const newProgress = {
      bytesTotal: progress.bytesTotal,
      // bytesTotal may be null or zero; in that case we can't divide by it
      percentage: progress.bytesTotal != null && Number.isFinite(progress.bytesTotal) && progress.bytesTotal > 0 ? Math.round(progress.bytesUploaded / progress.bytesTotal * 100) : void 0
    };
    if (fileInState.progress.uploadStarted != null) {
      this.setFileState(file.id, {
        progress: {
          ...fileInState.progress,
          ...newProgress,
          bytesUploaded: progress.bytesUploaded
        }
      });
    } else {
      this.setFileState(file.id, {
        progress: {
          ...fileInState.progress,
          ...newProgress
        }
      });
    }
    this.#updateTotalProgressThrottled();
  };
  #updateTotalProgress() {
    const totalProgress = this.#calculateTotalProgress();
    let totalProgressPercent = null;
    if (totalProgress != null) {
      totalProgressPercent = Math.round(totalProgress * 100);
      if (totalProgressPercent > 100)
        totalProgressPercent = 100;
      else if (totalProgressPercent < 0)
        totalProgressPercent = 0;
    }
    this.emit("progress", totalProgressPercent ?? 0);
    this.setState({
      totalProgress: totalProgressPercent ?? 0
    });
  }
  // ___Why throttle at 500ms?
  //    - We must throttle at >250ms for superfocus in Dashboard to work well
  //    (because animation takes 0.25s, and we want to wait for all animations to be over before refocusing).
  //    [Practical Check]: if thottle is at 100ms, then if you are uploading a file,
  //    and click 'ADD MORE FILES', - focus won't activate in Firefox.
  //    - We must throttle at around >500ms to avoid performance lags.
  //    [Practical Check] Firefox, try to upload a big file for a prolonged period of time. Laptop will start to heat up.
  #updateTotalProgressThrottled = (0, import_throttle.default)(() => this.#updateTotalProgress(), 500, { leading: true, trailing: true });
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: accessed via Symbol in tests
  [/* @__PURE__ */ Symbol.for("uppy test: updateTotalProgress")]() {
    return this.#updateTotalProgress();
  }
  #calculateTotalProgress() {
    const files = this.getFiles();
    const filesInProgress = files.filter((file) => {
      return file.progress.uploadStarted || file.progress.preprocess || file.progress.postprocess;
    });
    if (filesInProgress.length === 0) {
      return 0;
    }
    if (filesInProgress.every((file) => file.progress.uploadComplete)) {
      return 1;
    }
    const isSizedFile = (file) => file.progress.bytesTotal != null && file.progress.bytesTotal !== 0;
    const sizedFilesInProgress = filesInProgress.filter(isSizedFile);
    const unsizedFilesInProgress = filesInProgress.filter((file) => !isSizedFile(file));
    if (sizedFilesInProgress.every((file) => file.progress.uploadComplete) && unsizedFilesInProgress.length > 0 && !unsizedFilesInProgress.every((file) => file.progress.uploadComplete)) {
      return null;
    }
    const totalFilesSize = sizedFilesInProgress.reduce((acc, file) => acc + (file.progress.bytesTotal ?? 0), 0);
    const totalUploadedSize = sizedFilesInProgress.reduce((acc, file) => acc + (file.progress.bytesUploaded || 0), 0);
    return totalFilesSize === 0 ? 0 : totalUploadedSize / totalFilesSize;
  }
  /**
   * Registers listeners for all global actions, like:
   * `error`, `file-removed`, `upload-progress`
   */
  #addListeners() {
    const errorHandler = (error, file, response) => {
      let errorMsg = error.message || "Unknown error";
      if (error.details) {
        errorMsg += ` ${error.details}`;
      }
      this.setState({ error: errorMsg });
      if (file != null && file.id in this.getState().files) {
        this.setFileState(file.id, {
          error: errorMsg,
          response
        });
      }
    };
    this.on("error", errorHandler);
    this.on("upload-error", (file, error, response) => {
      errorHandler(error, file, response);
      if (typeof error === "object" && error.message) {
        this.log(error.message, "error");
        const newError = new Error(this.i18n("failedToUpload", { file: file?.name ?? "" }));
        newError.isUserFacing = true;
        newError.details = error.message;
        if (error.details) {
          newError.details += ` ${error.details}`;
        }
        this.#informAndEmit([newError]);
      } else {
        this.#informAndEmit([error]);
      }
    });
    let uploadStalledWarningRecentlyEmitted = null;
    this.on("upload-stalled", (error, files) => {
      const { message } = error;
      const details = files.map((file) => file.meta.name).join(", ");
      if (!uploadStalledWarningRecentlyEmitted) {
        this.info({ message, details }, "warning", this.opts.infoTimeout);
        uploadStalledWarningRecentlyEmitted = setTimeout(() => {
          uploadStalledWarningRecentlyEmitted = null;
        }, this.opts.infoTimeout);
      }
      this.log(`${message} ${details}`.trim(), "warning");
    });
    this.on("upload", () => {
      this.setState({ error: null });
    });
    const onUploadStarted = (files) => {
      const filesFiltered = files.filter((file) => {
        const exists = file != null && this.getFile(file.id);
        if (!exists)
          this.log(`Not setting progress for a file that has been removed: ${file?.id}`);
        return exists;
      });
      const filesState = Object.fromEntries(filesFiltered.map((file) => [
        file.id,
        {
          progress: {
            uploadStarted: Date.now(),
            uploadComplete: false,
            bytesUploaded: 0,
            bytesTotal: file.size
          }
        }
      ]));
      this.patchFilesState(filesState);
    };
    this.on("upload-start", onUploadStarted);
    this.on("upload-progress", this.#handleUploadProgress);
    this.on("upload-success", (file, uploadResp) => {
      if (file == null || !this.getFile(file.id)) {
        this.log(`Not setting progress for a file that has been removed: ${file?.id}`);
        return;
      }
      const currentProgress = this.getFile(file.id).progress;
      const needsPostProcessing = this.#postProcessors.size > 0;
      this.setFileState(file.id, {
        progress: {
          ...currentProgress,
          postprocess: needsPostProcessing ? {
            mode: "indeterminate"
          } : void 0,
          uploadComplete: true,
          ...!needsPostProcessing && { complete: true },
          percentage: 100,
          bytesUploaded: currentProgress.bytesTotal
        },
        response: uploadResp,
        uploadURL: uploadResp.uploadURL,
        isPaused: false
      });
      if (file.size == null) {
        this.setFileState(file.id, {
          size: uploadResp.bytesUploaded || currentProgress.bytesTotal
        });
      }
      this.#updateTotalProgressThrottled();
    });
    this.on("preprocess-progress", (file, progress) => {
      if (file == null || !this.getFile(file.id)) {
        this.log(`Not setting progress for a file that has been removed: ${file?.id}`);
        return;
      }
      this.setFileState(file.id, {
        progress: { ...this.getFile(file.id).progress, preprocess: progress }
      });
    });
    this.on("preprocess-complete", (file) => {
      if (file == null || !this.getFile(file.id)) {
        this.log(`Not setting progress for a file that has been removed: ${file?.id}`);
        return;
      }
      const files = { ...this.getState().files };
      files[file.id] = {
        ...files[file.id],
        progress: { ...files[file.id].progress }
      };
      delete files[file.id].progress.preprocess;
      this.setState({ files });
    });
    this.on("postprocess-progress", (file, progress) => {
      if (file == null || !this.getFile(file.id)) {
        this.log(`Not setting progress for a file that has been removed: ${file?.id}`);
        return;
      }
      this.setFileState(file.id, {
        progress: {
          ...this.getState().files[file.id].progress,
          postprocess: progress
        }
      });
    });
    this.on("postprocess-complete", (fileIn) => {
      const file = fileIn && this.getFile(fileIn.id);
      if (file == null) {
        this.log(`Not setting progress for a file that has been removed: ${fileIn?.id}`);
        return;
      }
      const { postprocess: _deleted, ...newProgress } = file.progress;
      this.patchFilesState({
        [file.id]: {
          progress: {
            ...newProgress,
            complete: true
          }
        }
      });
    });
    this.on("restored", () => {
      this.#updateTotalProgressThrottled();
    });
    this.on("dashboard:file-edit-complete", (file) => {
      if (file) {
        this.#checkRequiredMetaFieldsOnFile(file);
      }
    });
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("online", this.#updateOnlineStatus);
      window.addEventListener("offline", this.#updateOnlineStatus);
      setTimeout(this.#updateOnlineStatus, 3e3);
    }
  }
  updateOnlineStatus() {
    const online = window.navigator.onLine ?? true;
    if (!online) {
      this.emit("is-offline");
      this.info(this.i18n("noInternetConnection"), "error", 0);
      this.wasOffline = true;
    } else {
      this.emit("is-online");
      if (this.wasOffline) {
        this.emit("back-online");
        this.info(this.i18n("connectedToInternet"), "success", 3e3);
        this.wasOffline = false;
      }
    }
  }
  #updateOnlineStatus = this.updateOnlineStatus.bind(this);
  getID() {
    return this.opts.id;
  }
  /**
   * Registers a plugin with Core.
   */
  use(Plugin, ...args) {
    if (typeof Plugin !== "function") {
      const msg = `Expected a plugin class, but got ${Plugin === null ? "null" : typeof Plugin}. Please verify that the plugin was imported and spelled correctly.`;
      throw new TypeError(msg);
    }
    const plugin15 = new Plugin(this, ...args);
    const pluginId = plugin15.id;
    if (!pluginId) {
      throw new Error("Your plugin must have an id");
    }
    if (!plugin15.type) {
      throw new Error("Your plugin must have a type");
    }
    const existsPluginAlready = this.getPlugin(pluginId);
    if (existsPluginAlready) {
      const msg = `Already found a plugin named '${existsPluginAlready.id}'. Tried to use: '${pluginId}'.
Uppy plugins must have unique \`id\` options.`;
      throw new Error(msg);
    }
    if (Plugin.VERSION) {
      this.log(`Using ${pluginId} v${Plugin.VERSION}`);
    }
    if (plugin15.type in this.#plugins) {
      this.#plugins[plugin15.type].push(plugin15);
    } else {
      this.#plugins[plugin15.type] = [plugin15];
    }
    plugin15.install();
    this.emit("plugin-added", plugin15);
    return this;
  }
  getPlugin(id) {
    for (const plugins of Object.values(this.#plugins)) {
      const foundPlugin = plugins.find((plugin15) => plugin15.id === id);
      if (foundPlugin != null) {
        return foundPlugin;
      }
    }
    return void 0;
  }
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: accessed via Symbol in tests
  [/* @__PURE__ */ Symbol.for("uppy test: getPlugins")](type) {
    return this.#plugins[type];
  }
  /**
   * Iterate through all `use`d plugins.
   *
   */
  iteratePlugins(method) {
    Object.values(this.#plugins).flat(1).forEach(method);
  }
  /**
   * Uninstall and remove a plugin.
   *
   * @param {object} instance The plugin instance to remove.
   */
  removePlugin(instance) {
    this.log(`Removing plugin ${instance.id}`);
    this.emit("plugin-remove", instance);
    if (instance.uninstall) {
      instance.uninstall();
    }
    const list = this.#plugins[instance.type];
    const index = list.findIndex((item) => item.id === instance.id);
    if (index !== -1) {
      list.splice(index, 1);
    }
    const state2 = this.getState();
    const updatedState = {
      plugins: {
        ...state2.plugins,
        [instance.id]: void 0
      }
    };
    this.setState(updatedState);
  }
  /**
   * Uninstall all plugins and close down this Uppy instance.
   */
  destroy() {
    this.log(`Closing Uppy instance ${this.opts.id}: removing all files and uninstalling plugins`);
    this.cancelAll();
    this.#storeUnsubscribe();
    this.iteratePlugins((plugin15) => {
      this.removePlugin(plugin15);
    });
    if (typeof window !== "undefined" && window.removeEventListener) {
      window.removeEventListener("online", this.#updateOnlineStatus);
      window.removeEventListener("offline", this.#updateOnlineStatus);
    }
  }
  hideInfo() {
    const { info } = this.getState();
    this.setState({ info: info.slice(1) });
    this.emit("info-hidden");
  }
  /**
   * Set info message in `state.info`, so that UI plugins like `Informer`
   * can display the message.
   */
  info(message, type = "info", duration = 3e3) {
    const isComplexMessage = typeof message === "object";
    this.setState({
      info: [
        ...this.getState().info,
        {
          type,
          message: isComplexMessage ? message.message : message,
          details: isComplexMessage ? message.details : null
        }
      ]
    });
    setTimeout(() => this.hideInfo(), duration);
    this.emit("info-visible");
  }
  /**
   * Passes messages to a function, provided in `opts.logger`.
   * If `opts.logger: Uppy.debugLogger` or `opts.debug: true`, logs to the browser console.
   */
  log(message, type) {
    const { logger } = this.opts;
    switch (type) {
      case "error":
        logger.error(message);
        break;
      case "warning":
        logger.warn(message);
        break;
      default:
        logger.debug(message);
        break;
    }
  }
  // We need to store request clients by a unique ID, so we can share RequestClient instances across files
  // this allows us to do rate limiting and synchronous operations like refreshing provider tokens
  // example: refreshing tokens: if each file has their own requestclient,
  // we don't have any way to synchronize all requests in order to
  // - block all requests
  // - refresh the token
  // - unblock all requests and allow them to run with a the new access token
  // back when we had a requestclient per file, once an access token expired,
  // all 6 files would go ahead and refresh the token at the same time
  // (calling /refresh-token up to 6 times), which will probably fail for some providers
  #requestClientById = /* @__PURE__ */ new Map();
  registerRequestClient(id, client) {
    this.#requestClientById.set(id, client);
  }
  /** @protected */
  getRequestClientForFile(file) {
    if (!("remote" in file && file.remote))
      throw new Error(`Tried to get RequestClient for a non-remote file ${file.id}`);
    const requestClient = this.#requestClientById.get(file.remote.requestClientId);
    if (requestClient == null)
      throw new Error(`requestClientId "${file.remote.requestClientId}" not registered for file "${file.id}"`);
    return requestClient;
  }
  /**
   * Restore an upload by its ID.
   */
  async restore(uploadID) {
    this.log(`Core: Running restored upload "${uploadID}"`);
    const result = await this.#runUpload(uploadID);
    this.emit("complete", result);
    return result;
  }
  /**
   * Create an upload for a bunch of files.
   *
   */
  #createUpload(fileIDs, opts = {}) {
    const { forceAllowNewUpload = false } = opts;
    const { allowNewUpload, currentUploads } = this.getState();
    if (!allowNewUpload && !forceAllowNewUpload) {
      throw new Error("Cannot create a new upload: already uploading.");
    }
    const uploadID = nanoid2();
    this.emit("upload", uploadID, this.getFilesByIds(fileIDs));
    this.setState({
      allowNewUpload: this.opts.allowMultipleUploadBatches !== false && this.opts.allowMultipleUploads !== false,
      currentUploads: {
        ...currentUploads,
        [uploadID]: {
          fileIDs,
          step: 0,
          result: {}
        }
      }
    });
    return uploadID;
  }
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: accessed via Symbol in tests
  [/* @__PURE__ */ Symbol.for("uppy test: createUpload")](...args) {
    return this.#createUpload(...args);
  }
  #getUpload(uploadID) {
    const { currentUploads } = this.getState();
    return currentUploads[uploadID];
  }
  /**
   * Add data to an upload's result object.
   */
  addResultData(uploadID, data) {
    if (!this.#getUpload(uploadID)) {
      this.log(`Not setting result for an upload that has been removed: ${uploadID}`);
      return;
    }
    const { currentUploads } = this.getState();
    const currentUpload = {
      ...currentUploads[uploadID],
      result: { ...currentUploads[uploadID].result, ...data }
    };
    this.setState({
      currentUploads: { ...currentUploads, [uploadID]: currentUpload }
    });
  }
  /**
   * Remove an upload, eg. if it has been canceled or completed.
   *
   */
  #removeUpload(uploadID) {
    const { [uploadID]: _deleted, ...currentUploads } = this.getState().currentUploads;
    this.setState({
      currentUploads
    });
  }
  /**
   * Run an upload. This picks up where it left off in case the upload is being restored.
   */
  async #runUpload(uploadID) {
    const getCurrentUpload = () => {
      const { currentUploads } = this.getState();
      return currentUploads[uploadID];
    };
    let currentUpload = getCurrentUpload();
    if (!currentUpload) {
      throw new Error("Nonexistent upload");
    }
    const steps = [
      ...this.#preProcessors,
      ...this.#uploaders,
      ...this.#postProcessors
    ];
    try {
      for (let step = currentUpload.step || 0; step < steps.length; step++) {
        const fn = steps[step];
        this.setState({
          currentUploads: {
            ...this.getState().currentUploads,
            [uploadID]: {
              ...currentUpload,
              step
            }
          }
        });
        const { fileIDs } = currentUpload;
        await fn(fileIDs, uploadID);
        currentUpload = getCurrentUpload();
        if (!currentUpload) {
          break;
        }
      }
    } catch (err) {
      this.#removeUpload(uploadID);
      throw err;
    }
    if (currentUpload) {
      currentUpload.fileIDs.forEach((fileID) => {
        const file = this.getFile(fileID);
        if (file?.progress.postprocess) {
          this.emit("postprocess-complete", file);
        }
      });
      const files = currentUpload.fileIDs.map((fileID) => this.getFile(fileID));
      const successful = files.filter((file) => !file.error);
      const failed = files.filter((file) => file.error);
      this.addResultData(uploadID, { successful, failed, uploadID });
      currentUpload = getCurrentUpload();
    }
    let result;
    if (currentUpload) {
      result = currentUpload.result;
      this.#removeUpload(uploadID);
    }
    if (result == null) {
      this.log(`Not setting result for an upload that has been removed: ${uploadID}`);
      result = {
        successful: [],
        failed: [],
        uploadID
      };
    }
    return result;
  }
  /**
   * Start an upload for all the files that are not currently being uploaded.
   */
  async upload() {
    if (!this.#plugins.uploader?.length) {
      this.log("No uploader type plugins are used", "warning");
    }
    let { files } = this.getState();
    const filesToRetry = this.#getFilesToRetry();
    if (filesToRetry.length > 0) {
      const retryResult = await this.#doRetryAll();
      const hasNewFiles = this.getFiles().filter((file) => file.progress.uploadStarted == null).length > 0;
      if (!hasNewFiles) {
        this.emit("complete", retryResult);
        return retryResult;
      }
      ;
      ({ files } = this.getState());
    }
    const onBeforeUploadResult = this.opts.onBeforeUpload(files);
    if (onBeforeUploadResult === false) {
      throw new Error("Not starting the upload because onBeforeUpload returned false");
    }
    if (onBeforeUploadResult && typeof onBeforeUploadResult === "object") {
      files = onBeforeUploadResult;
      this.setState({
        files
      });
    }
    try {
      this.#restricter.validateMinNumberOfFiles(files);
      if (!this.#checkRequiredMetaFields(files)) {
        throw new RestrictionError(this.i18n("missingRequiredMetaField"));
      }
      const { currentUploads } = this.getState();
      const currentlyUploadingFiles = Object.values(currentUploads).flatMap((curr) => curr.fileIDs);
      const waitingFileIDs = Object.keys(files).filter((fileID) => {
        const file = this.getFile(fileID);
        return file && !file.progress.uploadStarted && !currentlyUploadingFiles.includes(fileID);
      });
      const uploadID = this.#createUpload(waitingFileIDs);
      const result = await this.#runUpload(uploadID);
      this.emit("complete", result);
      return result;
    } catch (err) {
      this.#informAndEmit([err]);
      throw err;
    }
  }
};
var Uppy_default = Uppy;

// node_modules/@uppy/xhr-upload/package.json
var package_default2 = {
  name: "@uppy/xhr-upload",
  description: "Plain and simple classic HTML multipart form uploads with Uppy, as well as uploads using the HTTP PUT method.",
  version: "6.0.0",
  license: "MIT",
  type: "module",
  sideEffects: false,
  scripts: {
    build: "tsc --build tsconfig.build.json",
    typecheck: "tsc --build",
    test: "vitest run --silent='passed-only'"
  },
  keywords: [
    "file uploader",
    "xhr",
    "xhr upload",
    "XMLHttpRequest",
    "ajax",
    "fetch",
    "uppy",
    "uppy-plugin"
  ],
  homepage: "https://uppy.io",
  bugs: {
    url: "https://github.com/transloadit/uppy/issues"
  },
  repository: {
    type: "git",
    url: "git+https://github.com/transloadit/uppy.git"
  },
  files: [
    "src",
    "lib",
    "dist",
    "CHANGELOG.md"
  ],
  exports: {
    ".": "./lib/index.js",
    "./package.json": "./package.json"
  },
  devDependencies: {
    "@uppy/core": "^6.0.0",
    "@uppy/dashboard": "^6.0.0",
    "@vitest/browser-playwright": "^4.1.6",
    msw: "^2.10.4",
    playwright: "1.61.1",
    typescript: "^6.0.3",
    vitest: "^4.1.6"
  },
  peerDependencies: {
    "@uppy/core": "^6.0.0"
  }
};

// node_modules/@uppy/xhr-upload/lib/locale.js
var locale_default2 = {
  strings: {
    // Shown in the Informer if an upload is being canceled because it stalled for too long.
    uploadStalled: "Upload has not made any progress for %{seconds} seconds. You may want to retry it."
  }
};

// node_modules/@uppy/xhr-upload/lib/index.js
function buildResponseError(xhr, err) {
  let error = err;
  if (!error)
    error = new Error("Upload error");
  if (typeof error === "string")
    error = new Error(error);
  if (!(error instanceof Error)) {
    error = Object.assign(new Error("Upload error"), { data: error });
  }
  if (isNetworkError_default(xhr)) {
    error = new NetworkError_default(error, xhr);
    return error;
  }
  error.request = xhr;
  return error;
}
function setTypeInBlob(file) {
  const dataWithUpdatedType = file.data.slice(0, file.data.size, file.meta.type);
  return dataWithUpdatedType;
}
var defaultOptions2 = {
  formData: true,
  fieldName: "file",
  method: "post",
  allowedMetaFields: true,
  bundle: false,
  headers: {},
  timeout: 30 * 1e3,
  limit: 5,
  withCredentials: false,
  responseType: ""
};
var XHRUpload = class extends BasePlugin {
  static VERSION = package_default2.version;
  #getFetcher;
  #queue;
  uploaderEvents;
  constructor(uppy, opts) {
    super(uppy, {
      ...defaultOptions2,
      fieldName: opts.bundle ? "files[]" : "file",
      ...opts
    });
    this.type = "uploader";
    this.id = this.opts.id || "XHRUpload";
    this.defaultLocale = locale_default2;
    this.i18nInit();
    this.#queue = new TaskQueue({ concurrency: this.opts.limit });
    if (this.opts.bundle && !this.opts.formData) {
      throw new Error("`opts.formData` must be true when `opts.bundle` is enabled.");
    }
    if (this.opts.bundle && typeof this.opts.headers === "function") {
      throw new Error("`opts.headers` can not be a function when the `bundle: true` option is set.");
    }
    if (opts?.allowedMetaFields === void 0 && "metaFields" in this.opts) {
      throw new Error("The `metaFields` option has been renamed to `allowedMetaFields`.");
    }
    this.uploaderEvents = /* @__PURE__ */ Object.create(null);
    this.#getFetcher = (files) => {
      return async (url, options) => {
        try {
          const res = await fetcher(url, {
            ...options,
            onBeforeRequest: (xhr, retryCount) => this.opts.onBeforeRequest?.(xhr, retryCount, files),
            shouldRetry: this.opts.shouldRetry,
            onAfterResponse: this.opts.onAfterResponse,
            onTimeout: (timeout2) => {
              const seconds = Math.ceil(timeout2 / 1e3);
              const error = new Error(this.i18n("uploadStalled", { seconds }));
              this.uppy.emit("upload-stalled", error, files);
            },
            onUploadProgress: (event) => {
              if (event.lengthComputable) {
                for (const { id } of files) {
                  const file = this.uppy.getFile(id);
                  if (file != null) {
                    this.uppy.emit("upload-progress", file, {
                      uploadStarted: file.progress.uploadStarted ?? 0,
                      bytesUploaded: event.loaded / event.total * file.size,
                      bytesTotal: file.size
                    });
                  }
                }
              }
            }
          });
          let body = await this.opts.getResponseData?.(res);
          if (res.responseType === "json") {
            body ??= res.response;
          } else {
            try {
              body ??= JSON.parse(res.responseText);
            } catch (cause) {
              throw new Error("@uppy/xhr-upload expects a JSON response (with a `url` property). To parse non-JSON responses, use `getResponseData` to turn your response into JSON.", { cause });
            }
          }
          const uploadURL = typeof body?.url === "string" ? body.url : void 0;
          for (const { id } of files) {
            this.uppy.emit("upload-success", this.uppy.getFile(id), {
              status: res.status,
              body,
              uploadURL
            });
          }
          return res;
        } catch (error) {
          if (error.name === "AbortError") {
            return void 0;
          }
          const request = error.request;
          for (const file of files) {
            this.uppy.emit("upload-error", this.uppy.getFile(file.id), buildResponseError(request, error), request);
          }
          throw error;
        }
      };
    };
  }
  getOptions(file) {
    const overrides = this.uppy.getState().xhrUpload;
    const { headers } = this.opts;
    const opts = {
      ...this.opts,
      ...overrides || {},
      ...file.xhrUpload || {},
      headers: {}
    };
    if (typeof headers === "function") {
      opts.headers = headers(file);
    } else {
      Object.assign(opts.headers, this.opts.headers);
    }
    if (overrides) {
      Object.assign(opts.headers, overrides.headers);
    }
    if (file.xhrUpload) {
      Object.assign(opts.headers, file.xhrUpload.headers);
    }
    return opts;
  }
  addMetadata(formData, meta, opts) {
    const allowedMetaFields = getAllowedMetaFields(opts.allowedMetaFields, meta);
    allowedMetaFields.forEach((item) => {
      const value = meta[item];
      if (Array.isArray(value)) {
        value.forEach((subItem) => {
          formData.append(item, subItem);
        });
      } else {
        formData.append(item, value);
      }
    });
  }
  createFormDataUpload(file, opts) {
    const formPost = new FormData();
    this.addMetadata(formPost, file.meta, opts);
    const dataWithUpdatedType = setTypeInBlob(file);
    if (file.name) {
      formPost.append(opts.fieldName, dataWithUpdatedType, file.meta.name);
    } else {
      formPost.append(opts.fieldName, dataWithUpdatedType);
    }
    return formPost;
  }
  createBundledUpload(files, opts) {
    const formPost = new FormData();
    const { meta } = this.uppy.getState();
    this.addMetadata(formPost, meta, opts);
    files.forEach((file) => {
      const options = this.getOptions(file);
      const dataWithUpdatedType = setTypeInBlob(file);
      if (file.name) {
        formPost.append(options.fieldName, dataWithUpdatedType, file.name);
      } else {
        formPost.append(options.fieldName, dataWithUpdatedType);
      }
    });
    return formPost;
  }
  async #uploadLocalFile(file) {
    const events = new EventManager(this.uppy);
    const controller = new AbortController();
    events.onFileRemove(file.id, () => controller.abort());
    events.onCancelAll(file.id, () => controller.abort());
    try {
      await this.#queue.add(async (signal) => {
        const opts = this.getOptions(file);
        const fetch2 = this.#getFetcher([file]);
        const body = opts.formData ? this.createFormDataUpload(file, opts) : file.data;
        const endpoint = typeof opts.endpoint === "string" ? opts.endpoint : await opts.endpoint(file);
        return fetch2(endpoint, {
          ...opts,
          body,
          signal: AbortSignal.any([signal, controller.signal])
        });
      });
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      throw error;
    } finally {
      events.remove();
    }
  }
  async #uploadBundle(files) {
    const controller = new AbortController();
    function abort() {
      controller.abort();
    }
    this.uppy.once("cancel-all", abort);
    try {
      await this.#queue.add(async (signal) => {
        const optsFromState = this.uppy.getState().xhrUpload ?? {};
        const fetch2 = this.#getFetcher(files);
        const body = this.createBundledUpload(files, {
          ...this.opts,
          ...optsFromState
        });
        const endpoint = typeof this.opts.endpoint === "string" ? this.opts.endpoint : await this.opts.endpoint(files);
        return fetch2(endpoint, {
          // headers can't be a function with bundle: true
          ...this.opts,
          body,
          signal: AbortSignal.any([signal, controller.signal])
        });
      });
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      throw error;
    } finally {
      this.uppy.off("cancel-all", abort);
    }
  }
  #getCompanionClientArgs(file) {
    const opts = this.getOptions(file);
    const allowedMetaFields = getAllowedMetaFields(opts.allowedMetaFields, file.meta);
    return {
      ...file.remote?.body,
      protocol: "multipart",
      endpoint: opts.endpoint,
      size: file.data.size,
      fieldname: opts.fieldName,
      metadata: Object.fromEntries(allowedMetaFields.map((name) => [name, file.meta[name]])),
      httpMethod: opts.method,
      useFormData: opts.formData,
      headers: opts.headers
    };
  }
  async #uploadFiles(files) {
    await Promise.allSettled(files.map((file) => {
      if (file.isRemote) {
        const getQueue = () => this.#queue;
        const controller = new AbortController();
        const removedHandler = (removedFile) => {
          if (removedFile.id === file.id)
            controller.abort();
        };
        this.uppy.on("file-removed", removedHandler);
        return this.uppy.getRequestClientForFile(file).uploadRemoteFile(file, this.#getCompanionClientArgs(file), {
          signal: controller.signal,
          getQueue
        }).finally(() => {
          this.uppy.off("file-removed", removedHandler);
        });
      }
      return this.#uploadLocalFile(file);
    }));
  }
  #handleUpload = async (fileIDs) => {
    if (fileIDs.length === 0) {
      this.uppy.log("[XHRUpload] No files to upload!");
      return;
    }
    if (this.opts.limit === 0) {
      this.uppy.log("[XHRUpload] When uploading multiple files at once, consider setting the `limit` option (to `10` for example), to limit the number of concurrent uploads, which helps prevent memory and network issues: https://uppy.io/docs/xhr-upload/#limit-0", "warning");
    }
    this.uppy.log("[XHRUpload] Uploading...");
    const files = this.uppy.getFilesByIds(fileIDs);
    const filesFiltered = filterFilesToUpload(files);
    const filesToEmit = filterFilesToEmitUploadStarted(filesFiltered);
    this.uppy.emit("upload-start", filesToEmit);
    if (this.opts.bundle) {
      const isSomeFileRemote = filesFiltered.some((file) => file.isRemote);
      if (isSomeFileRemote) {
        throw new Error("Can\u2019t upload remote files when the `bundle: true` option is set");
      }
      if (typeof this.opts.headers === "function") {
        throw new TypeError("`headers` may not be a function when the `bundle: true` option is set");
      }
      await this.#uploadBundle(filesFiltered);
    } else {
      await this.#uploadFiles(filesFiltered);
    }
  };
  install() {
    if (this.opts.bundle) {
      const { capabilities } = this.uppy.getState();
      this.uppy.setState({
        capabilities: {
          ...capabilities,
          individualCancellation: false
        }
      });
    }
    this.uppy.addUploader(this.#handleUpload);
  }
  uninstall() {
    if (this.opts.bundle) {
      const { capabilities } = this.uppy.getState();
      this.uppy.setState({
        capabilities: {
          ...capabilities,
          individualCancellation: true
        }
      });
    }
    this.uppy.removeUploader(this.#handleUpload);
  }
};

// node_modules/@zag-js/vanilla/dist/chunk-QZ7TP4HQ.mjs
var __defProp3 = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// node_modules/@zag-js/utils/dist/chunk-MXGZDBDQ.mjs
var __defProp4 = Object.defineProperty;
var __typeError2 = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField2 = (obj, key, value) => __defNormalProp2(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck2 = (obj, member, msg) => member.has(obj) || __typeError2("Cannot " + msg);
var __privateGet2 = (obj, member, getter) => (__accessCheck2(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd2 = (obj, member, value) => member.has(obj) ? __typeError2("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);

// node_modules/@zag-js/utils/dist/array.mjs
function toArray(v2) {
  if (v2 == null) return [];
  return Array.isArray(v2) ? v2 : [v2];
}
function nextIndex(v2, idx, opts = {}) {
  const { step = 1, loop = true } = opts;
  const next2 = idx + step;
  const len = v2.length;
  const last2 = len - 1;
  if (idx === -1) return step > 0 ? 0 : last2;
  if (next2 < 0) return loop ? last2 : 0;
  if (next2 >= len) return loop ? 0 : idx > len ? len : idx;
  return next2;
}
function next(v2, idx, opts = {}) {
  return v2[nextIndex(v2, idx, opts)];
}
function prevIndex(v2, idx, opts = {}) {
  const { step = 1, loop = true } = opts;
  return nextIndex(v2, idx, { step: -step, loop });
}
function prev(v2, index, opts = {}) {
  return v2[prevIndex(v2, index, opts)];
}

// node_modules/@zag-js/utils/dist/equal.mjs
var isArrayLike = (value) => value?.constructor.name === "Array";
var isArrayEqual = (a4, b3) => {
  if (a4.length !== b3.length) return false;
  for (let i8 = 0; i8 < a4.length; i8++) {
    if (!isEqual(a4[i8], b3[i8])) return false;
  }
  return true;
};
var isEqual = (a4, b3) => {
  if (Object.is(a4, b3)) return true;
  if (a4 == null && b3 != null || a4 != null && b3 == null) return false;
  if (typeof a4?.isEqual === "function" && typeof b3?.isEqual === "function") {
    return a4.isEqual(b3);
  }
  if (typeof a4 === "function" && typeof b3 === "function") {
    return a4.toString() === b3.toString();
  }
  if (isArrayLike(a4) && isArrayLike(b3)) {
    return isArrayEqual(Array.from(a4), Array.from(b3));
  }
  if (!(typeof a4 === "object") || !(typeof b3 === "object")) return false;
  const keys = Object.keys(b3 ?? /* @__PURE__ */ Object.create(null));
  const length = keys.length;
  for (let i8 = 0; i8 < length; i8++) {
    const hasKey = Reflect.has(a4, keys[i8]);
    if (!hasKey) return false;
  }
  for (let i8 = 0; i8 < length; i8++) {
    const key = keys[i8];
    if (!isEqual(a4[key], b3[key])) return false;
  }
  return true;
};

// node_modules/@zag-js/utils/dist/guard.mjs
var isObjectLike = (v2) => v2 != null && typeof v2 === "object";
var isString = (v2) => typeof v2 === "string";
var isFunction = (v2) => typeof v2 === "function";
var hasProp = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
var baseGetTag = (v2) => Object.prototype.toString.call(v2);
var fnToString = Function.prototype.toString;
var objectCtorString = fnToString.call(Object);
var isPlainObject = (v2) => {
  if (!isObjectLike(v2) || baseGetTag(v2) != "[object Object]" || isFrameworkElement(v2)) return false;
  const proto = Object.getPrototypeOf(v2);
  if (proto === null) return true;
  const Ctor = hasProp(proto, "constructor") && proto.constructor;
  return typeof Ctor == "function" && Ctor instanceof Ctor && fnToString.call(Ctor) == objectCtorString;
};
var isReactElement = (x2) => typeof x2 === "object" && x2 !== null && "$$typeof" in x2 && "props" in x2;
var isVueElement = (x2) => typeof x2 === "object" && x2 !== null && "__v_isVNode" in x2;
var isFrameworkElement = (x2) => isReactElement(x2) || isVueElement(x2);

// node_modules/@zag-js/utils/dist/functions.mjs
var runIfFn = (v2, ...a4) => {
  const res = typeof v2 === "function" ? v2(...a4) : v2;
  return res ?? void 0;
};
var identity = (v2) => v2();
var callAll = (...fns) => (...a4) => {
  fns.forEach(function(fn) {
    fn?.(...a4);
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
      this.frameId = requestAnimationFrame(__privateGet2(this, _tick));
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
    __privateAdd2(this, _tick, (now) => {
      this.context.now = now;
      this.context.deltaMs = now - this.context.startMs;
      const shouldContinue = this.onTick(this.context);
      if (shouldContinue === false) {
        this.stop();
        return;
      }
      this.frameId = requestAnimationFrame(__privateGet2(this, _tick));
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
function warn(...a4) {
  const m2 = a4.length === 1 ? a4[0] : a4[1];
  const c5 = a4.length === 2 ? a4[0] : true;
  if (c5 && true) {
    console.warn(m2);
  }
}
function invariant(...a4) {
  const m2 = a4.length === 1 ? a4[0] : a4[1];
  const c5 = a4.length === 2 ? a4[0] : true;
  if (c5 && true) {
    throw new Error(m2);
  }
}
function ensure(c5, m2) {
  if (c5 == null) throw new Error(m2());
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
function joinStatePath(parts3) {
  return parts3.join(STATE_DELIMITER);
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

// node_modules/@zag-js/dom-query/dist/chunk-QZ7TP4HQ.mjs
var __defProp5 = Object.defineProperty;
var __defNormalProp3 = (obj, key, value) => key in obj ? __defProp5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField3 = (obj, key, value) => __defNormalProp3(obj, typeof key !== "symbol" ? key + "" : key, value);

// node_modules/@zag-js/dom-query/dist/shared.mjs
var isObject = (v2) => typeof v2 === "object" && v2 !== null;
var MAX_Z_INDEX = 2147483647;
var dataAttr = (guard) => guard ? "" : void 0;
var BACKSLASH_RE = /\\/g;
var DOUBLE_QUOTE_RE = /"/g;
var cssesc = (value) => globalThis.CSS?.escape?.(value) ?? value.replace(BACKSLASH_RE, "\\\\").replace(DOUBLE_QUOTE_RE, '\\"');
var getByOwnerId = (id) => `[data-ownedby~="${cssesc(String(id))}"]`;

// node_modules/@zag-js/dom-query/dist/node.mjs
var ELEMENT_NODE = 1;
var DOCUMENT_NODE = 9;
var DOCUMENT_FRAGMENT_NODE = 11;
var isElement2 = (el) => isObject(el) && el.nodeType === ELEMENT_NODE && typeof el.nodeName === "string";
var isHTMLElement2 = (el) => isObject(el) && el.nodeType === ELEMENT_NODE && typeof el.nodeName === "string";
var isDocument = (el) => isObject(el) && el.nodeType === DOCUMENT_NODE;
var isWindow = (el) => isObject(el) && el === el.window;
var isNode2 = (el) => isObject(el) && el.nodeType !== void 0;
var isShadowRoot2 = (el) => isNode2(el) && el.nodeType === DOCUMENT_FRAGMENT_NODE && "host" in el;
function isActiveElement(element) {
  if (!element) return false;
  const rootNode = element.getRootNode();
  return getActiveElement(rootNode) === element;
}
function getParentElement(node) {
  const parentNode = node.parentNode;
  if (isShadowRoot2(parentNode)) return parentNode.host;
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
  if (!isHTMLElement2(parent) || !isNode2(child)) return false;
  if (isHTMLElement2(child) && parent === child) return true;
  if (parent.contains(child)) return true;
  const rootNode = child.getRootNode?.();
  if (rootNode && isShadowRoot2(rootNode)) {
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
function getWindow2(el) {
  if (isShadowRoot2(el)) return getWindow2(el.host);
  if (isDocument(el)) return el.defaultView ?? window;
  if (isHTMLElement2(el)) return el.ownerDocument?.defaultView ?? window;
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
function getComputedStyle3(el) {
  if (!styleCache.has(el)) {
    styleCache.set(el, getWindow2(el).getComputedStyle(el));
  }
  return styleCache.get(el);
}

// node_modules/@zag-js/dom-query/dist/platform.mjs
var isDom = () => typeof document !== "undefined";
function getPlatform() {
  const agent = navigator.userAgentData;
  return agent?.platform ?? navigator.platform;
}
var pt = (v2) => isDom() && v2.test(getPlatform());
var IPHONE_REGEX = /^iPhone/i;
var IPAD_REGEX = /^iPad/i;
var MAC_REGEX = /^Mac/i;
var isIPhone = () => pt(IPHONE_REGEX);
var isIPad = () => pt(IPAD_REGEX) || isMac() && navigator.maxTouchPoints > 1;
var isIos = () => isIPhone() || isIPad();
var isMac = () => pt(MAC_REGEX);

// node_modules/@zag-js/dom-query/dist/event.mjs
var isLeftClick = (e9) => e9.button === 0;
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
  const func = defer ? raf : (v2) => v2();
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
  const func = defer ? raf : (v2) => v2();
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
function queryAll(root2, selector) {
  return Array.from(root2?.querySelectorAll(selector) ?? []);
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
    const win = getWindow2(element);
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
    if (!key.startsWith("--")) key = key.replace(/[A-Z]/g, (match2) => `-${match2.toLowerCase()}`);
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
  const addEvt = (e9, f3) => {
    node.addEventListener(e9.toLowerCase(), f3);
  };
  const remEvt = (e9, f3) => {
    node.removeEventListener(e9.toLowerCase(), f3);
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
  const g2 = glob();
  if (!g2) return value();
  g2[key] || (g2[key] = value());
  return g2[key];
}
var refSet = globalRef("__zag__refSet", () => /* @__PURE__ */ new WeakSet());

// node_modules/@zag-js/store/dist/utils.mjs
var isReactElement2 = (x2) => typeof x2 === "object" && x2 !== null && "$$typeof" in x2 && "props" in x2;
var isVueElement2 = (x2) => typeof x2 === "object" && x2 !== null && "__v_isVNode" in x2;
var isDOMElement = (x2) => typeof x2 === "object" && x2 !== null && "nodeType" in x2 && typeof x2.nodeName === "string";
var isElement3 = (x2) => isReactElement2(x2) || isVueElement2(x2) || isDOMElement(x2);
var isObject2 = (x2) => x2 !== null && typeof x2 === "object";
var canProxy = (x2) => isObject2(x2) && !refSet.has(x2) && (Array.isArray(x2) || !(Symbol.iterator in x2)) && !isElement3(x2) && !(x2 instanceof WeakMap) && !(x2 instanceof WeakSet) && !(x2 instanceof Error) && !(x2 instanceof Number) && !(x2 instanceof Date) && !(x2 instanceof String) && !(x2 instanceof RegExp) && !(x2 instanceof ArrayBuffer) && !(x2 instanceof Promise) && !(x2 instanceof File) && !(x2 instanceof Blob) && !(x2 instanceof AbortController);
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
      const fns = strs.map((s4) => {
        const fn = this.machine.implementations?.actions?.[s4];
        if (!fn) warn(`[zag-js] No implementation found for action "${JSON.stringify(s4)}"`);
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
      const fns = strs.map((s4) => {
        const fn = this.machine.implementations?.effects?.[s4];
        if (!fn) warn(`[zag-js] No implementation found for effect "${JSON.stringify(s4)}"`);
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
      return toArray(transitions).find((t6) => {
        let result = !t6.guard;
        if (isString(t6.guard)) result = !!this.guard(t6.guard);
        else if (isFunction(t6.guard)) result = t6.guard(this.getParams());
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

// node_modules/@zag-js/splitter/dist/index.mjs
var dist_exports = {};
__export(dist_exports, {
  anatomy: () => anatomy,
  connect: () => connect,
  layout: () => getPanelLayout,
  machine: () => machine,
  panelProps: () => panelProps,
  props: () => props,
  registry: () => registry2,
  resizeTriggerProps: () => resizeTriggerProps,
  splitPanelProps: () => splitPanelProps,
  splitProps: () => splitProps2,
  splitResizeTriggerProps: () => splitResizeTriggerProps
});

// node_modules/@zag-js/splitter/dist/chunk-QZ7TP4HQ.mjs
var __defProp6 = Object.defineProperty;
var __defNormalProp4 = (obj, key, value) => key in obj ? __defProp6(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField4 = (obj, key, value) => __defNormalProp4(obj, typeof key !== "symbol" ? key + "" : key, value);

// node_modules/@zag-js/anatomy/dist/create-anatomy.mjs
var createAnatomy = (name, parts3 = []) => ({
  parts: (...values) => {
    if (isEmpty(parts3)) {
      return createAnatomy(name, values);
    }
    throw new Error("createAnatomy().parts(...) should only be called once. Did you mean to use .extendWith(...) ?");
  },
  extendWith: (...values) => createAnatomy(name, [...parts3, ...values]),
  omit: (...values) => createAnatomy(name, parts3.filter((part) => !values.includes(part))),
  rename: (newName) => createAnatomy(newName, parts3),
  keys: () => parts3,
  build: () => [...new Set(parts3)].reduce(
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
var isEmpty = (v2) => v2.length === 0;

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
  return isHTMLElement2(el) && el.dataset.part === "panel" ? el.dataset.id : void 0;
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
var getCursor = (state2, x2) => {
  let cursor = x2 ? "col-resize" : "row-resize";
  if (state2.isAtMin) cursor = x2 ? "e-resize" : "s-resize";
  if (state2.isAtMax) cursor = x2 ? "w-resize" : "n-resize";
  return cursor;
};
var getResizeTriggerEls = (ctx) => {
  return queryAll(getRootEl(ctx), `[role=separator]${getByOwnerId(getRootId(ctx))}`);
};
var getGlobalCursorEl = (ctx) => {
  return ctx.getDoc().getElementById(getGlobalCursorId(ctx));
};
var setupGlobalCursor = (ctx, state2, x2, nonce) => {
  const styleEl = getGlobalCursorEl(ctx);
  const textContent = `* { cursor: ${getCursor(state2, x2)} !important; }`;
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
  size: size3,
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
  const valueNow = size3[firstIndex];
  return {
    valueMax,
    valueMin,
    valueNow
  };
}
function getAriaValue(size3, panels, handleId) {
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
    size: size3,
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
function parsePanelSize(size3, rootEl, orientation) {
  if (size3 == null) return void 0;
  if (typeof size3 === "number") {
    return size3;
  }
  const match2 = size3.trim().match(sizeRegex);
  if (!match2) return void 0;
  const value = Number.parseFloat(match2[1]);
  if (!Number.isFinite(value)) return void 0;
  const unit = match2[2];
  if (unit == null || unit === "%") {
    return value;
  }
  if (!rootEl) return void 0;
  const rootSize = getRootSize(rootEl, orientation);
  if (rootSize === 0) return void 0;
  const px = toPixelValue(value, unit, rootEl);
  return px == null ? void 0 : px / rootSize * 100;
}
function toCssPanelSize(size3) {
  if (size3 == null) return void 0;
  if (typeof size3 === "number") {
    return `${size3}%`;
  }
  const trimmed = size3.trim();
  if (percentRegex.test(trimmed)) {
    return trimmed;
  }
  const match2 = trimmed.match(sizeRegex);
  if (!match2) return void 0;
  const value = Number.parseFloat(match2[1]);
  if (!Number.isFinite(value)) return void 0;
  const unit = match2[2];
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
    const size3 = parsePanelSize(sizes?.[index], rootEl, orientation);
    if (size3 == null) continue;
    numPanelsWithSizes++;
    nextSize[index] = size3;
    remainingSize -= size3;
  }
  for (let index = 0; index < panels.length; index++) {
    if (nextSize[index] != null) continue;
    const numRemainingPanels = panels.length - numPanelsWithSizes;
    const size3 = numRemainingPanels > 0 ? remainingSize / numRemainingPanels : 0;
    numPanelsWithSizes++;
    nextSize[index] = size3;
    remainingSize -= size3;
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
  size: size3,
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
  const layoutSize = size3 ?? defaultSize;
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
function connect(service, normalize2) {
  const { state: state2, send, prop, computed, context, scope } = service;
  const horizontal = computed("horizontal");
  const dragging = state2.matches("dragging");
  const registry3 = prop("registry");
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
    const size3 = prop("size")?.[panelIndex];
    const defaultSize = prop("defaultSize")?.[panelIndex];
    const dragState = context.get("dragState");
    const resolvedSizes = context.get("size");
    const panelData = panels[panelIndex];
    const panelSize = resolvedSizes[panelIndex];
    const collapsed = !!panelData?.collapsible && panelSize != null && fuzzyNumbersEqual(panelSize, panelData.collapsedSize ?? 0);
    return getPanelFlexBoxStyle({
      size: size3,
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
    setSizes(size3) {
      send({ type: "SIZE.SET", size: size3 });
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
      const size3 = getResolvedSizes();
      const panelData = getPanelById(panels2, id);
      const { panelSize } = panelDataHelper(panels2, panelData, size3);
      ensure(panelSize != null, () => `Panel size not found for panel "${panelData.id}"`);
      return panelSize;
    },
    isPanelCollapsed(id) {
      const panels2 = context.get("panels");
      const size3 = getResolvedSizes();
      const panelData = getPanelById(panels2, id);
      const { collapsedSize = 0, collapsible, panelSize } = panelDataHelper(panels2, panelData, size3);
      ensure(panelSize != null, () => `Panel size not found for panel "${panelData.id}"`);
      return collapsible === true && fuzzyNumbersEqual(panelSize, collapsedSize);
    },
    isPanelExpanded(id) {
      const panels2 = context.get("panels");
      const size3 = getResolvedSizes();
      const panelData = getPanelById(panels2, id);
      const { collapsedSize = 0, collapsible, panelSize } = panelDataHelper(panels2, panelData, size3);
      ensure(panelSize != null, () => `Panel size not found for panel "${panelData.id}"`);
      return !collapsible || fuzzyCompareNumbers(panelSize, collapsedSize) > 0;
    },
    getLayout() {
      return getPanelLayout(prop("panels"));
    },
    getRootProps() {
      return normalize2.element({
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
      return normalize2.element({
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
      return normalize2.element({
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
      return normalize2.element({
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
          cursor: triggerState.disabled || registry3 ? void 0 : horizontal ? "col-resize" : "row-resize",
          [horizontal ? "minHeight" : "minWidth"]: "0"
        },
        onPointerDown(event) {
          if (!isLeftClick(event)) return;
          if (triggerState.disabled) {
            event.preventDefault();
            return;
          }
          event.currentTarget.focus({ preventScroll: true, focusVisible: false });
          if (registry3) {
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
          if (triggerState.disabled || registry3) return;
          send({ type: "POINTER_OVER", id });
        },
        onPointerLeave() {
          if (triggerState.disabled || registry3) return;
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
    return nextLayout.map((size3) => size3 * scale2);
  }
  const remainingSize = 100 - fixedTotal;
  if (remainingSize <= 0) {
    const total2 = nextLayout.reduce((accumulated, current) => accumulated + current, 0);
    if (fuzzyNumbersEqual(total2, 100)) {
      return nextLayout;
    }
    const scale2 = 100 / Math.max(total2, 1);
    return nextLayout.map((size3) => size3 * scale2);
  }
  if (fuzzyNumbersEqual(relativeTotal, 0)) {
    const size3 = remainingSize / relativeIndices.length;
    relativeIndices.forEach((index) => {
      nextLayout[index] = size3;
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
  return nextLayout.map((size3) => size3 * scale);
}

// node_modules/@zag-js/splitter/dist/utils/resize-panel.mjs
function resizePanel({ panels, index, size: size3 }) {
  const panel = panels[index];
  ensure(panel, () => `Panel data not found for index ${index}`);
  let { collapsedSize = 0, collapsible, maxSize = 100, minSize = 0 } = panel;
  if (fuzzyCompareNumbers(size3, minSize) < 0) {
    if (collapsible) {
      const halfwayPoint = (collapsedSize + minSize) / 2;
      if (fuzzyCompareNumbers(size3, halfwayPoint) < 0) {
        size3 = collapsedSize;
      } else {
        size3 = minSize;
      }
    } else {
      size3 = minSize;
    }
  }
  size3 = Math.min(maxSize, size3);
  size3 = parseFloat(size3.toFixed(PRECISION));
  return size3;
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
  const totalSize = nextSize.reduce((total, size3) => size3 + total, 0);
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
    throw Error(`Invalid ${panels.length} panel size: ${nextSize.map((size3) => `${size3}%`).join(", ")}`);
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
        isEqual(a4, b3) {
          return b3 != null && fuzzySizeEqual(a4, b3);
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
        const registry3 = prop("registry");
        if (!registry3) return;
        let cleanups = [];
        const exec = () => {
          cleanups.forEach((fn) => fn());
          cleanups = getResizeTriggerEls(scope).map((resizeTriggerEl) => {
            const id = resizeTriggerEl.dataset.id;
            if (!id) return;
            return registry3.register({
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
        const size3 = context.get("size");
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
          initialSize: size3
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
        const size3 = sizes[index];
        const { collapsedSize = 0, collapsible, minSize = 0 } = panelData;
        if (size3 != null && collapsible) {
          const pivotIndices = [idBefore, idAfter].map(
            (id) => panelDataArray.findIndex((panelData2) => panelData2.id === id)
          );
          const nextSize = resizeByDelta({
            delta: fuzzyNumbersEqual(size3, collapsedSize) ? minSize - collapsedSize : collapsedSize - size3,
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
        const registry3 = prop("registry");
        if (registry3) return;
        const dragState = context.get("dragState");
        if (!dragState) return;
        const panels = context.get("panels");
        const horizontal = prop("orientation") === "horizontal";
        const [idBefore] = dragState.resolvedResizeTriggerId.split(":");
        const indexBefore = panels.findIndex((panel2) => panel2.id === idBefore);
        const panel = panels[indexBefore];
        const size3 = context.get("size");
        const aria = getAriaValue(size3, panels, dragState.resolvedResizeTriggerId);
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
  sizes.forEach((size3, index) => {
    const panelData = panelsArray[index];
    ensure(panelData, () => `Panel data not found for index ${index}`);
    const { collapsedSize = 0, collapsible, id: panelId } = panelData;
    const lastNotifiedSize = panelIdToLastNotifiedSizeMap.get(panelId);
    if (lastNotifiedSize == null || size3 !== lastNotifiedSize) {
      panelIdToLastNotifiedSizeMap.set(panelId, size3);
      if (collapsible && lastNotifiedSize != null && (onCollapse || onExpand)) {
        if (fuzzyNumbersEqual(lastNotifiedSize, collapsedSize) && !fuzzyNumbersEqual(size3, collapsedSize)) {
          onExpand?.({ panelId, size: size3 });
        }
        if (!fuzzyNumbersEqual(lastNotifiedSize, collapsedSize) && fuzzyNumbersEqual(size3, collapsedSize)) {
          onCollapse?.({ panelId, size: size3 });
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
function intersects(r1, r22, strict = false) {
  if (strict) {
    return r1.x < r22.x + r22.width && r1.x + r1.width > r22.x && r1.y < r22.y + r22.height && r1.y + r1.height > r22.y;
  }
  return r1.x <= r22.x + r22.width && r1.x + r1.width >= r22.x && r1.y <= r22.y + r22.height && r1.y + r1.height >= r22.y;
}
function toRect(r7) {
  return { x: r7.x, y: r7.y, width: r7.width, height: r7.height };
}

// node_modules/@zag-js/splitter/dist/utils/stacking-order.mjs
function compareStackingOrder(a4, b3) {
  if (a4 === b3) throw new Error("Cannot compare node with itself");
  const ancestors = {
    a: getAncestorElements(a4),
    b: getAncestorElements(b3)
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
    let i8 = children.length;
    while (i8--) {
      const child = children[i8];
      if (child === furthestAncestors.a) return 1;
      if (child === furthestAncestors.b) return -1;
    }
  }
  return Math.sign(zIndexes.a - zIndexes.b);
}
var STACKING_PROPS_REGEX = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function isFlexItem(node) {
  const parent = getParentElement(node);
  const display = getComputedStyle3(parent ?? node).display;
  return display === "flex" || display === "inline-flex";
}
function createsStackingContext(node) {
  const style = getComputedStyle3(node);
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
  let i8 = nodes.length;
  while (i8--) {
    const node = nodes[i8];
    ensure(node, () => "[stacking-order] missing node in findStackingContext");
    if (createsStackingContext(node)) return node;
  }
  return null;
}
var getZIndex = (node) => {
  return node && Number(getComputedStyle3(node).zIndex) || 0;
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
      const newActiveIds = new Set(intersecting.map((h3) => h3.id));
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
        this.state.activeHandleIds = new Set(intersecting.map((h3) => h3.id));
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
  findHitHandles(x2, y3, pointerType) {
    const intersecting = [];
    const margin = this.options.hitAreaMargins[pointerType];
    this.handles.forEach((handle) => {
      const rect = handle.element.getBoundingClientRect();
      const hit = x2 >= rect.left - margin && x2 <= rect.right + margin && y3 >= rect.top - margin && y3 <= rect.bottom + margin;
      if (hit) intersecting.push(handle);
    });
    return intersecting;
  }
  /**
   * Full intersection check: hit-test + stacking order verification.
   * Used for pointerdown activation where correctness matters.
   */
  findIntersectingHandles(x2, y3, pointerType, eventTarget) {
    const hits = this.findHitHandles(x2, y3, pointerType);
    const targetElement = isElement2(eventTarget) ? eventTarget : null;
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
    const hasHorizontal = intersecting.some((h3) => h3.orientation === "horizontal");
    const hasVertical = intersecting.some((h3) => h3.orientation === "vertical");
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
var registry2 = (opts = {}) => new SplitterRegistry(opts);

// node_modules/@zag-js/toast/dist/index.mjs
var dist_exports2 = {};
__export(dist_exports2, {
  anatomy: () => anatomy2,
  connect: () => connect2,
  createStore: () => createToastStore,
  group: () => group,
  machine: () => machine2
});

// node_modules/@zag-js/toast/dist/toast.anatomy.mjs
var anatomy2 = createAnatomy("toast").parts(
  "group",
  "root",
  "title",
  "description",
  "actionTrigger",
  "closeTrigger"
);
var parts2 = anatomy2.build();

// node_modules/@zag-js/toast/dist/toast.dom.mjs
var getRegionId = (placement) => `toast-group:${placement}`;
var getRegionEl = (ctx, placement) => ctx.getById(`toast-group:${placement}`);
var getRootId2 = (ctx) => `toast:${ctx.id}`;
var getRootEl2 = (ctx) => ctx.getById(getRootId2(ctx));
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
    const offset3 = computedOffset.top;
    styles.top = `max(env(safe-area-inset-top, 0px), ${offset3})`;
  }
  if (computedPlacement.includes("bottom")) {
    const offset3 = computedOffset.bottom;
    styles.bottom = `max(env(safe-area-inset-bottom, 0px), ${offset3})`;
  }
  if (!computedPlacement.includes("left")) {
    const offset3 = computedOffset.right;
    styles.insetInlineEnd = `calc(env(safe-area-inset-right, 0px) + ${offset3})`;
  }
  if (!computedPlacement.includes("right")) {
    const offset3 = computedOffset.left;
    styles.insetInlineStart = `calc(env(safe-area-inset-left, 0px) + ${offset3})`;
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
  const offset3 = computed("heightIndex") * gap + computed("heightBefore");
  const styles = {
    position: "absolute",
    pointerEvents: "auto",
    "--opacity": "0",
    "--remove-delay": `${prop("removeDelay")}ms`,
    "--duration": `${duration}ms`,
    "--initial-height": `${height}px`,
    "--offset": `${offset3}px`,
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
function groupConnect(service, normalize2) {
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
      return normalize2.element({
        ...parts2.group.attrs,
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
        const { zIndex } = getComputedStyle3(layer.node);
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
  props({ props: props2 }) {
    return {
      dir: "ltr",
      id: uuid(),
      ...props2,
      store: props2.store
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
        hash: (toasts) => toasts.map((t6) => t6.id).join(",")
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
            context.set("toasts", (prev2) => prev2.filter((t6) => t6.id !== toast.id));
            return;
          }
          context.set("toasts", (prev2) => {
            const index = prev2.findIndex((t6) => t6.id === toast.id);
            if (index !== -1) {
              return [...prev2.slice(0, index), { ...prev2[index], ...toast }, ...prev2.slice(index + 1)];
            }
            return [toast, ...prev2];
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
function connect2(service, normalize2) {
  const { state: state2, send, prop, scope, context, computed } = service;
  const translations2 = mergeWithDefault(defaultTranslations, prop("translations"));
  const visible = state2.hasTag("visible");
  const paused = state2.hasTag("paused");
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
      return normalize2.element({
        ...parts2.root.attrs,
        dir: prop("dir"),
        id: getRootId2(scope),
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
      return normalize2.element({
        "data-ghost": "before",
        style: getGhostBeforeStyle(service, visible)
      });
    },
    /* Needed to avoid setting hover to false when in between toasts */
    getGhostAfterProps() {
      return normalize2.element({
        "data-ghost": "after",
        style: getGhostAfterStyle()
      });
    },
    getTitleProps() {
      return normalize2.element({
        ...parts2.title.attrs,
        id: getTitleId(scope)
      });
    },
    getDescriptionProps() {
      return normalize2.element({
        ...parts2.description.attrs,
        id: getDescriptionId(scope)
      });
    },
    getActionTriggerProps() {
      return normalize2.button({
        ...parts2.actionTrigger.attrs,
        type: "button",
        onClick(event) {
          if (event.defaultPrevented) return;
          action?.onClick?.();
          send({ type: "DISMISS", src: "user" });
        }
      });
    },
    getCloseTriggerProps() {
      return normalize2.button({
        id: getCloseTriggerId(scope),
        ...parts2.closeTrigger.attrs,
        type: "button",
        "aria-label": translations2?.closeTriggerLabel,
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
var machine2 = createMachine({
  props({ props: props2 }) {
    ensureProps(props2, ["id", "type", "parent", "removeDelay"], "toast");
    return {
      closable: true,
      ...props2,
      duration: getToastDuration(props2.duration, props2.type)
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
      return heights.reduce((prev2, curr, reducerIndex) => {
        if (reducerIndex >= heightIndex) return prev2;
        return prev2 + curr.height;
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
          const rootEl = getRootEl2(scope);
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
          const rootEl = getRootEl2(scope);
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
        context.set("remainingTime", (prev2) => {
          const closeTimerStartTime = refs.get("closeTimerStartTime");
          const elapsedTime2 = Date.now() - closeTimerStartTime;
          refs.set("lastCloseStartTimerStartTime", Date.now());
          return prev2 - elapsedTime2;
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
  parent.context.set("heights", (prev2) => {
    const alreadyExists = prev2.find((i8) => i8.id === id);
    if (!alreadyExists) {
      return [{ id, height }, ...prev2];
    } else {
      return prev2.map((i8) => i8.id === id ? { ...i8, height } : i8);
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
  return toastArray.sort((a4, b3) => {
    const priorityA = a4.priority ?? getPriorityForType(a4.type, !!a4.action);
    const priorityB = b3.priority ?? getPriorityForType(b3.type, !!b3.action);
    return priorityA - priorityB;
  });
};
function createToastStore(props2 = {}) {
  const attrs = withDefaults(props2, {
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
  const update2 = (id, data) => {
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
    update: update2,
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

// src/vendors.js
registerIconLibrary("default", {
  resolver: (name) => {
    const aliases = { bars: "menu-2", "xmark": "x", "chevron-down": "chevron-down", "chevron-right": "chevron-right" };
    const svg = icons2[aliases[name] ?? name] ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>';
    return "data:image/svg+xml," + encodeURIComponent(svg);
  },
  mutator: (svg) => svg.setAttribute("stroke-width", "1.4")
});
export {
  tom_select_complete_default as TomSelect,
  Uppy_default as Uppy,
  VanillaMachine,
  XHRUpload,
  autoUpdate,
  computePosition2 as computePosition,
  flip2 as flip,
  normalizeProps,
  offset2 as offset,
  shift2 as shift,
  dist_exports as splitter,
  spreadProps,
  dist_exports2 as toast
};
/*! For license information please see vendors.js.LEGAL.txt */
