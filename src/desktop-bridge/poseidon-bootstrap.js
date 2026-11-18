/**
 * Poseidon bootstrap — inject before Hermes apps/desktop loads.
 * - window.hermesDesktop (P0 + stubs)
 * - window.__POSEIDON_SOCKET_FACTORY__ / openGatewaySocket override hook
 * - PoseidonGatewaySocket over Rust WsBridge (ADR-015)
 */
(function () {
  if (window.__POSEIDON_BOOTSTRAPPED__) return;
  window.__POSEIDON_BOOTSTRAPPED__ = true;

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

  function PoseidonGatewaySocket() {
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this._off = [];
  }
  PoseidonGatewaySocket.CONNECTING = 0;
  PoseidonGatewaySocket.OPEN = 1;
  PoseidonGatewaySocket.CLOSING = 2;
  PoseidonGatewaySocket.CLOSED = 3;

  PoseidonGatewaySocket.connect = async function () {
    var invoke = getInvoke();
    var listen = getListen();
    if (!invoke || !listen) throw new Error('Poseidon: Tauri API missing');
    var sock = new PoseidonGatewaySocket();
    var off1 = await listen('gateway-ws-frame', function (e) {
      var data = typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload);
      if (sock.onmessage) sock.onmessage({ data: data });
    });
    var off2 = await listen('gateway-ws-status', function (e) {
      var st = e.payload || {};
      if (st.connected === false && sock.readyState === 1) {
        sock.readyState = 3;
        if (sock.onclose) sock.onclose({ reason: st.message || '' });
        sock._cleanup();
      }
    });
    sock._off = [off1, off2];
    try {
      await invoke('gateway_ws_connect');
      sock.readyState = 1;
      if (sock.onopen) sock.onopen({ type: 'open' });
    } catch (err) {
      sock.readyState = 3;
      if (sock.onerror) sock.onerror({ message: String(err) });
      sock._cleanup();
      throw err;
    }
    return sock;
  };

  PoseidonGatewaySocket.prototype.send = function (data) {
    if (this.readyState !== 1) throw new Error('PoseidonGatewaySocket not OPEN');
    var invoke = getInvoke();
    invoke('gateway_ws_send', { text: String(data) }).catch(function (err) {
      if (this.onerror) this.onerror({ message: String(err) });
    }.bind(this));
  };

  PoseidonGatewaySocket.prototype.close = function () {
    if (this.readyState === 3) return;
    this.readyState = 2;
    var self = this;
    var invoke = getInvoke();
    invoke('gateway_ws_close')
      .catch(function () {})
      .finally(function () {
        self.readyState = 3;
        if (self.onclose) self.onclose({ code: 1000, reason: 'client close' });
        self._cleanup();
      });
  };

  PoseidonGatewaySocket.prototype._cleanup = function () {
    (this._off || []).forEach(function (fn) {
      try { if (typeof fn === 'function') fn(); } catch (_) {}
    });
    this._off = [];
  };

  window.PoseidonGatewaySocket = PoseidonGatewaySocket;
  window.__POSEIDON_SOCKET_FACTORY__ = function () {
    return PoseidonGatewaySocket.connect();
  };

  // Install hermesDesktop P0
  var invoke = getInvoke();
  if (!invoke) {
    console.warn('[Poseidon] bootstrap: no invoke yet');
    return;
  }

  var BOOL_FLAGS = {
    glassSupported: true,
    translucencySupported: true,
    localModelsEnabled: true,
    assumeFreshInstall: true
  };

  function stub(path, name) {
    if (/^on[A-Z]/.test(name)) {
      return function () {
        return function () {};
      };
    }
    return function () {
      console.warn('[Poseidon stub]', path);
      return Promise.resolve(null);
    };
  }

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
    getGatewayWsUrl: function () {
      return invoke('get_gateway_ws_url');
    },
    getConnection: function () {
      return invoke('get_connection');
    },
    getConnectionFor: function () {
      return invoke('get_connection');
    },
    setActiveConnectionRoute: function (route) {
      return invoke('set_active_connection_route', { route: route || {} });
    },
    getBootProgress: function () {
      return invoke('get_boot_progress');
    },
    openExternal: function (url) {
      return invoke('open_external', { url: url });
    },
    glassSupported: false,
    translucencySupported: false,
    localModelsEnabled: false,
    assumeFreshInstall: false,
    __poseidon: {
      getSystemInfo: function () { return invoke('get_system_info'); },
      gatewayStart: function () { return invoke('gateway_start'); },
      gatewayStop: function () { return invoke('gateway_stop'); },
      gatewayStatus: function () { return invoke('gateway_status'); },
      gatewayEnsure: function () { return invoke('gateway_ensure'); },
      wsConnect: function () { return invoke('gateway_ws_connect'); },
      wsSend: function (text) { return invoke('gateway_ws_send', { text: text }); },
      wsClose: function () { return invoke('gateway_ws_close'); }
    }
  };

  var seen = {};
  window.hermesDesktop = new Proxy(api, {
    get: function (t, prop) {
      if (prop in t) return t[prop];
      var p = String(prop);
      if (BOOL_FLAGS[p]) {
        if (!seen[p]) { seen[p] = 1; console.warn('[Poseidon stub bool]', p); }
        return false;
      }
      if (!seen[p]) { seen[p] = 1; console.warn('[Poseidon stub missing]', p); }
      return stub(p, p);
    },
    has: function () { return true; }
  });

  console.log('[Poseidon] bootstrap ready — hermesDesktop + PoseidonGatewaySocket');
})();
