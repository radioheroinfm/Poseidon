/**
 * Poseidon initialization_script (Kolyan D)
 * - Runs BEFORE page scripts
 * - Sync WebSocket shim for gateway URLs; native for Vite HMR etc.
 * - Recursive hermesDesktop Proxy
 */
(function () {
  if (window.__POSEIDON_BOOTSTRAPPED__) return;
  window.__POSEIDON_BOOTSTRAPPED__ = true;

  // Visible diagnostics on white screen
  function poseidonShowError(msg) {
    try {
      var el = document.getElementById("poseidon-error-overlay");
      if (!el) {
        el = document.createElement("div");
        el.id = "poseidon-error-overlay";
        el.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:2147483647;max-height:40vh;overflow:auto;background:rgba(10,10,18,0.92);color:#f8fafc;font:12px/1.4 ui-monospace,monospace;padding:10px 14px;white-space:pre-wrap;border-bottom:1px solid #334155;pointer-events:auto;";
        (document.body || document.documentElement).appendChild(el);
        var btn = document.createElement("button");
        btn.id = "poseidon-banner-close";
        btn.textContent = "Close window";
        btn.style.cssText = "position:fixed;top:8px;right:12px;z-index:2147483647;padding:6px 12px;background:#b91c1c;color:#fff;border:0;border-radius:6px;font:12px sans-serif;cursor:pointer;pointer-events:auto;";
        btn.onclick = function () {
          var inv = getInvoke && getInvoke();
          if (inv) inv("window_close");
          else window.close();
        };
        (document.body || document.documentElement).appendChild(btn);
      }
      el.textContent = (el.textContent ? el.textContent + "\n\n" : "") + String(msg);
    } catch (e) {}
  }
  window.addEventListener("error", function (ev) {
    poseidonShowError("error: " + (ev.message || ev.error || ev));
  });
  window.addEventListener("unhandledrejection", function (ev) {
    poseidonShowError("rejection: " + (ev.reason && (ev.reason.stack || ev.reason.message || ev.reason)));
  });


  var NativeWebSocket = window.WebSocket;

  function getInvoke() {
    var g = window.__TAURI__;
    if (g && g.core && g.core.invoke) return g.core.invoke.bind(g.core);
    return null;
  }
  function getListen() {
    var g = window.__TAURI__;
    if (g && g.event && g.event.listen) return g.event.listen.bind(g.event);
    return null;
  }

  function isGatewayWsUrl(url) {
    try {
      var u = new URL(url, location.href);
      if (u.protocol !== 'ws:' && u.protocol !== 'wss:') return false;
      var host = u.hostname;
      if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') return false;
      return u.pathname === '/api/ws' || u.pathname.indexOf('/api/ws') === 0;
    } catch (e) {
      return false;
    }
  }

  var nextId = 1;

  function PoseidonWebSocket(url, protocols) {
    if (!(this instanceof PoseidonWebSocket)) {
      return new PoseidonWebSocket(url, protocols);
    }
    // Non-gateway → native (Vite HMR, etc.)
    if (!isGatewayWsUrl(String(url))) {
      return new NativeWebSocket(url, protocols);
    }

    this.url = String(url);
    this.protocol = '';
    this.readyState = PoseidonWebSocket.CONNECTING;
    this.bufferedAmount = 0;
    this.binaryType = 'blob';
    this.extensions = '';
    this._id = 'pws-' + nextId++;
    this._listeners = { open: [], message: [], error: [], close: [] };
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;

    var protos = [];
    if (typeof protocols === 'string') protos = [protocols];
    else if (Array.isArray(protocols)) protos = protocols.slice();
    this._protocols = protos;

    var self = this;
    var invoke = getInvoke();
    var listen = getListen();
    if (!invoke || !listen) {
      queueMicrotask(function () {
        self._fail('Tauri API not available');
      });
      return this;
    }

    this._offs = [];
    listen('gateway-ws-frame', function (e) {
      var p = e.payload || {};
      if (p.id !== self._id) return;
      var data = typeof p.data === 'string' ? p.data : JSON.stringify(p.data);
      var ev = { data: data, type: 'message', target: self };
      if (self.onmessage) self.onmessage(ev);
      self._emit('message', ev);
    }).then(function (off) { self._offs.push(off); });

    listen('gateway-ws-status', function (e) {
      var p = e.payload || {};
      if (p.id !== self._id) return;
      if (p.connected === true && self.readyState === PoseidonWebSocket.CONNECTING) {
        self.readyState = PoseidonWebSocket.OPEN;
        if (p.protocol) self.protocol = p.protocol;
        var ev = { type: 'open', target: self };
        if (self.onopen) self.onopen(ev);
        self._emit('open', ev);
      } else if (p.connected === false) {
        var wasOpen = self.readyState === PoseidonWebSocket.OPEN || self.readyState === PoseidonWebSocket.CLOSING;
        self.readyState = PoseidonWebSocket.CLOSED;
        var cev = {
          type: 'close',
          code: p.code != null ? p.code : 1006,
          reason: p.message || '',
          wasClean: !!p.wasClean,
          target: self
        };
        if (self.onclose) self.onclose(cev);
        self._emit('close', cev);
        self._cleanup();
      }
    }).then(function (off) { self._offs.push(off); });

    invoke('gateway_ws_open', {
      id: this._id,
      url: this.url,
      protocols: this._protocols
    }).catch(function (err) {
      self._fail(String(err));
    });

    return this;
  }

  PoseidonWebSocket.CONNECTING = 0;
  PoseidonWebSocket.OPEN = 1;
  PoseidonWebSocket.CLOSING = 2;
  PoseidonWebSocket.CLOSED = 3;
  PoseidonWebSocket.prototype.CONNECTING = 0;
  PoseidonWebSocket.prototype.OPEN = 1;
  PoseidonWebSocket.prototype.CLOSING = 2;
  PoseidonWebSocket.prototype.CLOSED = 3;

  PoseidonWebSocket.prototype._emit = function (type, ev) {
    (this._listeners[type] || []).forEach(function (fn) {
      try { fn.call(this, ev); } catch (e) { console.error(e); }
    }.bind(this));
  };

  PoseidonWebSocket.prototype._fail = function (msg) {
    this.readyState = PoseidonWebSocket.CLOSED;
    var err = { type: 'error', message: msg, target: this };
    if (this.onerror) this.onerror(err);
    this._emit('error', err);
    var cev = { type: 'close', code: 1006, reason: msg, wasClean: false, target: this };
    if (this.onclose) this.onclose(cev);
    this._emit('close', cev);
    this._cleanup();
  };

  PoseidonWebSocket.prototype._cleanup = function () {
    (this._offs || []).forEach(function (fn) {
      try { if (typeof fn === 'function') fn(); } catch (e) {}
    });
    this._offs = [];
  };

  PoseidonWebSocket.prototype.send = function (data) {
    if (this.readyState !== PoseidonWebSocket.OPEN) {
      throw new Error('InvalidStateError: still in CONNECTING state');
    }
    var invoke = getInvoke();
    var text = typeof data === 'string' ? data : String(data);
    invoke('gateway_ws_send', { id: this._id, text: text }).catch(function (err) {
      console.error('[PoseidonWebSocket] send', err);
    });
  };

  PoseidonWebSocket.prototype.close = function (code, reason) {
    if (this.readyState === PoseidonWebSocket.CLOSED || this.readyState === PoseidonWebSocket.CLOSING) return;
    this.readyState = PoseidonWebSocket.CLOSING;
    var invoke = getInvoke();
    invoke('gateway_ws_close', {
      id: this._id,
      code: code != null ? code : 1000,
      reason: reason || ''
    }).catch(function () {});
  };

  PoseidonWebSocket.prototype.addEventListener = function (type, fn) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(fn);
  };
  PoseidonWebSocket.prototype.removeEventListener = function (type, fn) {
    if (!this._listeners[type]) return;
    this._listeners[type] = this._listeners[type].filter(function (f) { return f !== fn; });
  };
  PoseidonWebSocket.prototype.dispatchEvent = function () { return true; };

  // Install shim
  window.WebSocket = PoseidonWebSocket;
  window.PoseidonWebSocket = PoseidonWebSocket;
  window.__POSEIDON_NATIVE_WS__ = NativeWebSocket;

  // --- hermesDesktop recursive Proxy ---
  function getInvokeSafe() {
    return getInvoke();
  }

  function recursiveStub(path) {
    return new Proxy(function () {}, {
      get: function (_t, prop) {
        if (prop === 'then') return undefined;
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'toJSON' || prop === 'toString') return function () { return '[PoseidonStub ' + path + ']'; };
        var p = path + '.' + String(prop);
        if (/^on[A-Z]/.test(String(prop))) {
          return function () { return function () {}; };
        }
        return recursiveStub(p);
      },
      apply: function (_t, _this, args) {
        var inv = getInvokeSafe();
        console.warn('[Poseidon stub call]', path, args && args.length);
        if (inv) {
          inv('append_ui_log', { line: 'stub:' + path }).catch(function () {});
        }
        return Promise.resolve({});
      }
    });
  }

  function installHermesDesktop() {
    var invoke = getInvokeSafe();
    if (!invoke) {
      console.warn('[Poseidon] hermesDesktop deferred — no invoke yet');
      return;
    }

    // Safe default profile shape (strings only — upstream calls .trim())
    var defaultProfile = {
      id: "default",
      name: "Default",
      displayName: "Default",
      path: "",
      home: "",
      kind: "local"
    };

    var api = {
      windowControls: {
        custom: true,
        minimize: function () { invoke('window_minimize'); },
        toggleMaximize: function () { invoke('window_maximize'); },
        close: function () { invoke('window_close'); }
      },
      getVersion: function () {
        return invoke('get_version').then(function (v) { return String(v || '0.1.0'); });
      },
      getGatewayWsUrl: function () { return invoke('get_gateway_ws_url'); },
      getConnection: function () { return invoke('get_connection'); },
      getConnectionFor: function () { return invoke('get_connection'); },
      setActiveConnectionRoute: function (route) {
        return invoke('set_active_connection_route', { route: route || {} });
      },
      getBootProgress: function () { return invoke('get_boot_progress'); },
      openExternal: function (url) { return invoke('open_external', { url: url }); },
      // Profile API — was stub Proxy → (name??"").trim blew up
      profile: {
        getDefault: function () { return Promise.resolve(defaultProfile); },
        get: function () { return Promise.resolve(defaultProfile); },
        list: function () { return Promise.resolve({ profiles: [defaultProfile] }); },
        getAll: function () { return Promise.resolve([defaultProfile]); },
        current: function () { return Promise.resolve(defaultProfile); },
        getActive: function () { return Promise.resolve(defaultProfile); },
        refresh: function () { return Promise.resolve({ profiles: [defaultProfile] }); },
        refreshProfiles: function () { return Promise.resolve({ profiles: [defaultProfile] }); }
      },
      profiles: {
        list: function () { return Promise.resolve({ profiles: [defaultProfile] }); },
        get: function () { return Promise.resolve(defaultProfile); },
        refresh: function () { return Promise.resolve({ profiles: [defaultProfile] }); }
      },
      listProfiles: function () { return Promise.resolve({ profiles: [defaultProfile] }); },
      getProfiles: function () { return Promise.resolve({ profiles: [defaultProfile] }); },
      refreshProfiles: function () { return Promise.resolve({ profiles: [defaultProfile] }); },
      glassSupported: false,
      translucencySupported: false,
      localModelsEnabled: false,
      assumeFreshInstall: false
    };

    window.hermesDesktop = new Proxy(api, {
      get: function (t, prop) {
        if (prop in t) return t[prop];
        var name = String(prop);
        if (name === 'then') return undefined;
        if (/^on[A-Z]/.test(name)) {
          return function () { return function () {}; };
        }
        return recursiveStub(name);
      },
      has: function () { return true; }
    });

    console.log('[Poseidon] bootstrap: WebSocket shim + hermesDesktop ready');
    // Some Hermes paths still read window.electronAPI
    if (!window.electronAPI) {
      window.electronAPI = window.hermesDesktop;
    }
    poseidonShowError("Poseidon bootstrap OK — location=" + location.href + " hermesDesktop=" + !!window.hermesDesktop);

    try {
      invoke('append_ui_log', { line: 'bootstrap ok hermesDesktop+WebSocketShim' }).catch(function () {});
    } catch (e) {}
  }

  installHermesDesktop();
  // Retry if __TAURI__ appears slightly later
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (window.hermesDesktop && window.hermesDesktop.getVersion) {
      clearInterval(iv);
      return;
    }
    installHermesDesktop();
    if (tries > 20) clearInterval(iv);
  }, 100);

  // After Vite/React should have mounted — report DOM state
  function poseidonDomProbe(tag) {
    try {
      var root = document.getElementById("root") || document.getElementById("app") || document.querySelector("#root, #app, [data-hermes-root]");
      var bodyKids = document.body ? document.body.children.length : -1;
      var crash = document.querySelector("[class*='crash'], [class*='z-crash'], [data-testid*='crash']");
      var crashText = crash ? (crash.innerText || crash.textContent || "").trim().slice(0, 500) : "";
      var msg = tag + " root=" + (root ? "yes" : "NO") +
        " bodyChildren=" + bodyKids + " title=" + document.title +
        (crashText ? (" CRASH=[" + crashText.replace(/\s+/g, " ") + "]") : " noCrashEl");
      console.log("[Poseidon]", msg);
      poseidonShowError(msg);
      var inv = getInvoke && getInvoke();
      if (inv) inv("append_ui_log", { line: msg }).catch(function () {});
    } catch (e) {
      poseidonShowError("dom probe fail: " + e);
    }
  }
  setTimeout(function () { poseidonDomProbe("t+1s"); }, 1000);
  setTimeout(function () { poseidonDomProbe("t+3s"); }, 3000);
  setTimeout(function () { poseidonDomProbe("t+6s"); }, 6000);
})();
