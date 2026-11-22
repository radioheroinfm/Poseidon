/**
 * Poseidon bootstrap (kolyan-patch-01) — the ONLY implementation that runs in the WebView.
 *
 * Installed through Tauri's `initialization_script`, i.e. before any page script
 * and again on every document load. Therefore:
 *  - it never assumes `window.__TAURI__` exists yet: Tauri is resolved lazily;
 *  - `window.hermesDesktop` is installed synchronously.
 *
 * Contents:
 *  1. diagnostics: JS errors, console.error/warn and loopback fetch/XHR are written to
 *     logs/poseidon-ui.log via `append_ui_log` (tickets are redacted);
 *  2. `window.hermesDesktop`: implemented P0 keys + a RECURSIVE stub proxy
 *     (`profile.getDefault()` etc. never throw "not a function"); every stub access is traced
 *     as `[trace] MISS|CALL <path>` -> run once, get the real boot-key list (BOOT_TRACE);
 *  3. a synchronous `WebSocket` shim: `new WebSocket("ws://127.0.0.1:<port>/api/ws", protocols)`
 *     returns a WebSocket-like object at once and dials through Rust (`gateway_ws_open`),
 *     because the browser's `Origin` header is rejected by the gateway (ADR-015).
 *     Other URLs (e.g. Vite HMR) go to the native WebSocket untouched.
 */
(function () {
  'use strict';
  if (window.__POSEIDON_BOOTSTRAPPED__) return;
  window.__POSEIDON_BOOTSTRAPPED__ = true;
  try { document.documentElement.dataset.hermesDesktopHost = "tauri"; } catch (e) {}

  var VERSION = 'kolyan-patch-01';

  // ------------------------------------------------------------------ tauri (lazy)

  function rawInvoke() {
    var t = window.__TAURI_INTERNALS__;
    if (t && typeof t.invoke === 'function') return t.invoke.bind(t);
    var g = window.__TAURI__;
    if (g && g.core && typeof g.core.invoke === 'function') return g.core.invoke.bind(g.core);
    return null;
  }

  function ready(maxMs) {
    var limit = typeof maxMs === 'number' ? maxMs : 20000;
    return new Promise(function (resolve, reject) {
      var waited = 0;
      (function poll() {
        if (rawInvoke()) return resolve();
        if (waited >= limit) return reject(new Error('Poseidon: Tauri API not available'));
        waited += 20;
        setTimeout(poll, 20);
      })();
    });
  }

  function invoke(cmd, args) {
    return ready().then(function () {
      return rawInvoke()(cmd, args);
    });
  }

  function listen(event, cb) {
    var g = window.__TAURI__;
    if (g && g.event && typeof g.event.listen === 'function') {
      return g.event.listen(event, cb);
    }
    var t = window.__TAURI_INTERNALS__;
    if (t && typeof t.invoke === 'function' && typeof t.transformCallback === 'function') {
      // same wire format as @tauri-apps/api event.listen
      return t.invoke('plugin:event|listen', {
        event: event,
        target: { kind: 'Any' },
        handler: t.transformCallback(cb)
      });
    }
    return Promise.reject(new Error('Poseidon: no event API'));
  }

  // ------------------------------------------------------------------ log

  var MAX_LOG_LINES = 3000;
  var logged = 0;
  var logBuf = [];
  var logTimer = null;
  var flushTries = 0;

  function redact(s) {
    return String(s)
      .replace(/ticket=[^&\s"']+/g, 'ticket=***')
      .replace(/(hermes-gateway-ticket\.)[A-Za-z0-9_\-\.~]+/g, '$1***');
  }

  function plog(line) {
    if (logged >= MAX_LOG_LINES) return;
    logged++;
    logBuf.push(redact(line).slice(0, 1500));
    if (!logTimer) logTimer = setTimeout(flushLog, 400);
  }

  function flushLog() {
    logTimer = null;
    if (!logBuf.length) return;
    var raw = rawInvoke();
    if (!raw) {
      if (++flushTries < 80) {
        logTimer = setTimeout(flushLog, 500);
        if (logTimer && typeof logTimer.unref === 'function') logTimer.unref(); // node tests only
      }
      return;
    }
    var lines = logBuf.splice(0, logBuf.length);
    lines.forEach(function (l) {
      try {
        var p = raw('append_ui_log', { line: l });
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) { /* ignore */ }
    });
  }

  var seenTrace = {};
  function trace(kind, what) {
    var k = kind + ' ' + what;
    if (seenTrace[k]) return;
    seenTrace[k] = 1;
    plog('[trace] ' + k);
  }

  // errors -> log (this is the "first red line" without opening DevTools)
  var errCount = 0;
  try {
    window.addEventListener('error', function (ev) {
      if (++errCount > 100) return;
      var st = ev && ev.error && ev.error.stack ? ' | ' + String(ev.error.stack).split('\n').slice(0, 4).join(' <- ') : '';
      plog('[js-error] ' + (ev && ev.message) + ' @' + (ev && ev.filename) + ':' + (ev && ev.lineno) + st);
    });
    window.addEventListener('unhandledrejection', function (ev) {
      if (++errCount > 100) return;
      var r = ev && ev.reason;
      plog('[js-unhandled-rejection] ' + (r && r.stack ? String(r.stack).split('\n').slice(0, 4).join(' <- ') : String(r)));
    });
  } catch (e) { /* no addEventListener (tests) */ }

  var consoleCount = 0;
  ['error', 'warn'].forEach(function (lvl) {
    try {
      var orig = console[lvl];
      console[lvl] = function () {
        if (++consoleCount <= 300) {
          var parts = [];
          for (var i = 0; i < arguments.length; i++) {
            var a = arguments[i];
            parts.push(a && a.stack ? String(a.stack).split('\n').slice(0, 3).join(' <- ') : String(a));
          }
          plog('[console.' + lvl + '] ' + parts.join(' '));
        }
        return orig.apply(console, arguments);
      };
    } catch (e) { /* ignore */ }
  });

  // loopback network calls (W5): which transports does the renderer use besides the socket?
  function isLoopbackHost(h) {
    return h === '127.0.0.1' || h === 'localhost' || h === '[::1]' || h === '::1';
  }
  function urlNoQuery(u) {
    try { var p = new URL(String(u), window.location.href); return p.protocol + '//' + p.host + p.pathname; }
    catch (e) { return String(u); }
  }
  function isLoopbackUrl(u) {
    try { return isLoopbackHost(new URL(String(u), window.location.href).hostname); } catch (e) { return false; }
  }
  function traceNet(kind, u) {
    if (isLoopbackUrl(u)) trace('NET-' + kind, urlNoQuery(u)); // no query: may hold tickets
  }
  try {
    if (typeof window.fetch === 'function') {
      var nativeFetch = window.fetch;
      window.fetch = function (input) {
        traceNet('fetch', input && input.url ? input.url : input);
        return nativeFetch.apply(this, arguments);
      };
    }
    if (window.XMLHttpRequest && window.XMLHttpRequest.prototype) {
      var nativeOpen = window.XMLHttpRequest.prototype.open;
      window.XMLHttpRequest.prototype.open = function (method, url) {
        traceNet('xhr', url);
        return nativeOpen.apply(this, arguments);
      };
    }
  } catch (e) { /* ignore */ }

  // ------------------------------------------------------------------ hermesDesktop

  function lastSeg(path) {
    var i = path.lastIndexOf('.');
    return i < 0 ? path : path.slice(i + 1);
  }

  var PASSTHROUGH_FN_PROPS = { name: 1, length: 1, prototype: 1, call: 1, apply: 1, bind: 1, toString: 1 };

  // Callable + indexable stub: any depth of property access is valid, never throws.
  function noop() {}

  function makeStub(path) {
    var fn = function () {
      trace('CALL', path);
      var seg = lastSeg(path);
      // Event subscribe: onFoo(cb) -> unsubscribe fn
      if (/^on[A-Z]/.test(seg)) return noop;
      // Disposers must be callable functions (Hermes calls destroy() synchronously)
      if (/^(destroy|dispose|unwatch|unsubscribe|stop|cancel|close|remove|cleanup)$/i.test(seg)) {
        return noop;
      }
      // watch*/listen*/subscribe* -> Promise<unsub> OR sync unsub (both safe)
      if (/watch|listen|subscribe|observe/i.test(seg)) {
        return Promise.resolve(noop);
      }
      // Profile list APIs -> empty list
      if (/profile/i.test(path) && /(list|getAll|refresh|getProfiles)/i.test(seg)) {
        return Promise.resolve([]);
      }
      if (/^(listProfiles|getProfiles|refreshProfiles)$/i.test(seg)) {
        return Promise.resolve([]);
      }
      // Clearly async getters
      if (/^(get|list|fetch|load|read|query|request|ensure|refresh|check)/i.test(seg)) {
        return Promise.resolve(null);
      }
      // DEFAULT: sync noop — so `const destroy = api.foo()` is callable
      return noop;
    };
    return new Proxy(fn, {
      get: function (t, prop) {
        if (typeof prop === 'symbol') {
          if (prop === Symbol.toPrimitive) return function () { return '[poseidon-stub ' + path + ']'; };
          return undefined;
        }
        if (prop === 'then' || prop === 'catch' || prop === 'finally' || prop === 'toJSON') return undefined;
        if (PASSTHROUGH_FN_PROPS[prop]) return Reflect.get(t, prop);
        // Property access .destroy must be a function, not a thenable stub chain
        if (/^(destroy|dispose|unwatch|unsubscribe|stop|cancel|close|remove|cleanup)$/i.test(String(prop))) {
          trace('HIT', path + '.' + prop + ' [noop-disposer]');
          return noop;
        }
        trace('MISS', path + '.' + prop);
        return makeStub(path + '.' + prop);
      }
    });
  }

  var api = {
    windowControls: {
      custom: true,
      minimize: function () { return invoke('window_minimize'); },
      toggleMaximize: function () { return invoke('window_maximize'); },
      close: function () { return invoke('window_close'); }
    },
    getVersion: function () {
      return invoke('get_version').then(function (v) { return String(v || '0.1.0'); });
    },
    getGatewayWsUrl: function () { return invoke('get_gateway_ws_url'); },
    getConnection: function () {
      return invoke('get_connection').then(function (c) {
        if (!c || typeof c !== 'object') return c;
        var origin = c.baseUrl || c.apiOrigin || c.base_url || c.api_origin || null;
        return Object.assign({}, c, {
          mode: c.mode || c.kind || 'local',
          baseUrl: origin,
          apiOrigin: origin,
          profile: (typeof c.profile === 'string' && c.profile) ? c.profile : 'default',
          connectionId: c.connectionId || c.connection_id || 'local',
          authMode: c.authMode || c.auth_mode || 'native',
          token: c.token == null ? '' : c.token
        });
      });
    },
    getConnectionFor: function () {
      return invoke('get_connection').then(function (c) {
        if (!c || typeof c !== 'object') return c;
        var origin = c.baseUrl || c.apiOrigin || null;
        return Object.assign({}, c, {
          mode: c.mode || c.kind || 'local',
          baseUrl: origin,
          apiOrigin: origin,
          profile: (typeof c.profile === 'string' && c.profile) ? c.profile : 'default',
          connectionId: c.connectionId || 'local',
          authMode: c.authMode || 'native',
          token: c.token == null ? '' : c.token
        });
      });
    },
    setActiveConnectionRoute: function (route) {
      return invoke('set_active_connection_route', { route: route || {} });
    },
    getBootProgress: function () { return invoke('get_boot_progress'); },
    openExternal: function (url) { return invoke('open_external', { url: url }); },
    glassSupported: false,
    translucencySupported: false,
    localModelsEnabled: false,
    assumeFreshInstall: false,
    // backend-sync.ts: (localSkin?.profile ?? '').trim() — must not be Proxy
    localSkin: null,
    // ALL renderer REST goes through hermesDesktop.api → main/Tauri (not browser fetch)
    api: function (request) {
      return invoke('hermes_api', { request: request || {} });
    },
    desktop: {
      claimStartupLatency: function () { return Promise.resolve(null); },
    settings: {
      getDefaultProjectDir: function () {
        return invoke('get_default_project_dir');
      }
    },
    sanitizeWorkspaceCwd: function (path) {
      return invoke('sanitize_workspace_cwd', { path: path || '' });
    },

      reportStartupLatency: function () { return Promise.resolve(); }
    },
    claimStartupLatency: function () { return Promise.resolve(null); },
    settings: {
      getDefaultProjectDir: function () {
        return invoke('get_default_project_dir');
      }
    },
    sanitizeWorkspaceCwd: function (path) {
      return invoke('sanitize_workspace_cwd', { path: path || '' });
    },

    getProfiles: function () { return Promise.resolve([]); },
    listProfiles: function () { return Promise.resolve([]); },
    refreshProfiles: function () { return Promise.resolve([]); },
    profile: {
      getDefault: function () { return Promise.resolve({ name: "default", display_name: "Default", id: "default" }); },
      get: function () { return Promise.resolve({ name: "default", display_name: "Default", id: "default" }); },
      list: function () { return Promise.resolve([]); },
      refresh: function () { return Promise.resolve([]); }
    },
    __poseidon: {
      version: VERSION,
      getSystemInfo: function () { return invoke('get_system_info'); },
      gatewayEnsure: function () { return invoke('gateway_ensure'); },
      gatewayEnsureJson: function () { return invoke('gateway_ensure_json'); }
    }
  };

  var hitSeen = {};
  window.hermesDesktop = new Proxy(api, {
    get: function (t, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'then' || prop === 'toJSON') return undefined;
      if (prop === 'localSkin') return null;
      if (Object.prototype.hasOwnProperty.call(t, prop)) {
        if (!hitSeen[prop]) { hitSeen[prop] = 1; trace('HIT', 'hermesDesktop.' + String(prop)); }
        return t[prop];
      }
      trace('MISS', 'hermesDesktop.' + String(prop));
      return makeStub('hermesDesktop.' + String(prop));
    },
    has: function () { return true; }
  });

  // ------------------------------------------------------------------ WebSocket shim

  var NativeWebSocket = window.WebSocket;
  var wsCounter = 0;
  var sessions = {};
  var listenersReady = null;

  function mkEvent(type, props) {
    var ev;
    try { ev = new Event(type); } catch (e) { ev = { type: type }; }
    Object.keys(props || {}).forEach(function (k) {
      try { Object.defineProperty(ev, k, { value: props[k], enumerable: true }); } catch (e) { /* ignore */ }
    });
    return ev;
  }
  function mkMessage(data) {
    try { return new MessageEvent('message', { data: data }); } catch (e) { return mkEvent('message', { data: data }); }
  }
  function mkClose(code, reason, wasClean) {
    try { return new CloseEvent('close', { code: code, reason: reason, wasClean: wasClean }); }
    catch (e) { return mkEvent('close', { code: code, reason: reason, wasClean: wasClean }); }
  }

  function ensureListeners() {
    if (listenersReady) return listenersReady;
    listenersReady = ready().then(function () {
      return Promise.all([
        listen('gateway-ws-session-frame', function (e) {
          var p = (e && e.payload) || {};
          var s = sessions[p.id];
          if (s) s._onFrame(String(p.data));
        }),
        listen('gateway-ws-session-status', function (e) {
          var p = (e && e.payload) || {};
          var s = sessions[p.id];
          if (s) s._onStatus(p);
        })
      ]);
    }).catch(function (err) {
      listenersReady = null;
      throw err;
    });
    return listenersReady;
  }

  function isGatewayUrl(u) {
    try {
      var p = new URL(String(u), window.location.href);
      return (p.protocol === 'ws:') && isLoopbackHost(p.hostname) && p.pathname === '/api/ws';
    } catch (e) {
      return false;
    }
  }

  class PoseidonWebSocket extends EventTarget {
    constructor(url, protocols) {
      super();
      this.url = String(url);
      this.readyState = 0;
      this.protocol = '';
      this.extensions = '';
      this.binaryType = 'blob';
      this.bufferedAmount = 0;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;
      this._id = 'ws-' + (++wsCounter) + '-' + Math.random().toString(36).slice(2, 8);
      this._queue = [];
      this._opened = false;
      this._closed = false;
      this._closeRequested = null;
      this._chain = Promise.resolve();
      var list = protocols == null ? [] : (typeof protocols === 'string' ? [protocols] : Array.prototype.slice.call(protocols));
      this._protos = list.map(String);
      sessions[this._id] = this;
      trace('WS-SHIM', 'open ' + redact(this.url));
      var self = this;
      ensureListeners()
        .then(function () {
          return invoke('gateway_ws_open', { id: self._id, url: self.url, protocols: self._protos });
        })
        .then(function (st) {
          self._markOpen(st && st.message);
        })
        .catch(function (err) {
          self._fail(err);
        });
    }

    _emit(type, ev) {
      var h = this['on' + type];
      if (typeof h === 'function') {
        try { h.call(this, ev); } catch (e) { plog('[ws-shim] handler error ' + type + ': ' + e); }
      }
      try { this.dispatchEvent(ev); } catch (e) { /* ignore */ }
    }

    _markOpen(message) {
      if (this._opened || this._closed) return;
      this._opened = true;
      this.readyState = 1;
      var m = /protocol=(\S+)/.exec(String(message || ''));
      this.protocol = m ? m[1] : 'hermes-gateway-v1';
      this._emit('open', mkEvent('open', {}));
      var q = this._queue;
      this._queue = [];
      for (var i = 0; i < q.length; i++) this._emit('message', mkMessage(q[i]));
      if (this._closeRequested) this._doClose();
    }

    _onFrame(data) {
      if (this._closed) return;
      if (!this._opened) { this._queue.push(data); return; }
      this._emit('message', mkMessage(data));
    }

    _onStatus(p) {
      if (p.connected === true) { this._markOpen(p.message); return; }
      this._finish(typeof p.code === 'number' ? p.code : 1006, String(p.message || ''));
    }

    _fail(err) {
      plog('[ws-shim] open failed: ' + (err && err.message ? err.message : err));
      this._finish(1006, String((err && err.message) || err));
    }

    _finish(code, reason) {
      if (this._closed) return;
      this._closed = true;
      var wasOpen = this._opened;
      this.readyState = 3;
      delete sessions[this._id];
      if (!wasOpen) this._emit('error', mkEvent('error', {}));
      var wasClean = code === 1000 || code === 1001;
      this._emit('close', mkClose(this._closeRequested ? this._closeRequested.code : code, reason, wasClean));
    }

    send(data) {
      if (this.readyState === 0) {
        throw (typeof DOMException === 'function'
          ? new DOMException('WebSocket is still in CONNECTING state', 'InvalidStateError')
          : new Error('InvalidStateError: WebSocket is still in CONNECTING state'));
      }
      if (this.readyState !== 1) return;
      var text;
      if (typeof data === 'string') {
        text = data;
      } else if (data && typeof ArrayBuffer !== 'undefined' && (data instanceof ArrayBuffer || ArrayBuffer.isView(data))) {
        text = new TextDecoder().decode(data);
      } else {
        plog('[ws-shim] unsupported send payload type; dropped');
        return;
      }
      var self = this;
      // serialize IPC calls: async Tauri commands may otherwise run out of order
      this._chain = this._chain
        .then(function () { return invoke('gateway_ws_send_to', { id: self._id, text: text }); })
        .catch(function (err) {
          plog('[ws-shim] send failed: ' + (err && err.message ? err.message : err));
          self._emit('error', mkEvent('error', {}));
        });
    }

    close(code, reason) {
      if (this.readyState >= 2) return;
      this._closeRequested = { code: typeof code === 'number' ? code : 1000, reason: reason ? String(reason) : '' };
      this.readyState = 2;
      if (this._opened) this._doClose();
      // if still connecting: _markOpen() or _fail() will finish the job
    }

    _doClose() {
      var self = this;
      this._chain = this._chain
        .then(function () { return invoke('gateway_ws_close_id', { id: self._id }); })
        .catch(function () { /* fall through to the timer */ });
      // Rust reports the close; if that never arrives, finish locally.
      setTimeout(function () {
        if (!self._closed) self._finish(self._closeRequested ? self._closeRequested.code : 1000, 'client close');
      }, 2000);
    }
  }

  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (name, i) {
    Object.defineProperty(PoseidonWebSocket, name, { value: i });
    Object.defineProperty(PoseidonWebSocket.prototype, name, { value: i });
  });

  if (typeof NativeWebSocket === 'function') {
    var WebSocketWrapper = function WebSocket(url, protocols) {
      if (!new.target) {
        throw new TypeError("Failed to construct 'WebSocket': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
      }
      if (isGatewayUrl(url)) return new PoseidonWebSocket(url, protocols);
      if (isLoopbackUrl(url)) trace('WS-NATIVE', redact(urlNoQuery(url)));
      return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
    };
    WebSocketWrapper.prototype = NativeWebSocket.prototype;
    ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) {
      Object.defineProperty(WebSocketWrapper, k, { value: NativeWebSocket[k] });
    });
    Object.defineProperty(WebSocketWrapper, Symbol.hasInstance, {
      value: function (o) { return o instanceof NativeWebSocket || o instanceof PoseidonWebSocket; }
    });
    window.WebSocket = WebSocketWrapper;
  }

  window.PoseidonWebSocket = PoseidonWebSocket;

  // ------------------------------------------------------------------ banner + white-screen probe

  plog('[poseidon] bootstrap ' + VERSION + ' installed href=' + redact(window.location && window.location.href));

  try {
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('DOMContentLoaded', function () {
        try {
          var b = document.createElement('div');
          b.id = 'poseidon-boot-banner';
          b.textContent = 'Poseidon ' + VERSION + ' — hermesDesktop=' + !!window.hermesDesktop;
          b.style.cssText = 'position:fixed;z-index:2147483647;left:8px;bottom:8px;padding:6px 10px;background:#0e7499;color:#fff;font:12px monospace;border-radius:6px;opacity:0.9;pointer-events:none';
          (document.body || document.documentElement).appendChild(b);
          setTimeout(function () { try { b.remove(); } catch (e) { /* ignore */ } }, 8000);
        } catch (e) { /* ignore */ }
      });
      setTimeout(function () {
        try {
          var root = document.getElementById('root');
          plog('[poseidon] t+5s #root children=' + (root ? root.children.length : 'no-root') +
            ' bodyTextLen=' + ((document.body && document.body.innerText) || '').length);
        } catch (e) { /* ignore */ }
      }, 5000);
    }
  } catch (e) { /* ignore */ }
})();
