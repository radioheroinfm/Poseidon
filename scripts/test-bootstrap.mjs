// Tests for src/desktop-bridge/poseidon-bootstrap.js (kolyan-patch-01).
// No dependencies: node >= 18, `node --test scripts/test-bootstrap.mjs`.
//
// The script is executed in a vm sandbox together with a fake Tauri host that
// behaves like the Rust side (events may arrive BEFORE `invoke` resolves).

import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '..', 'src', 'desktop-bridge', 'poseidon-bootstrap.js'), 'utf8');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function makeWorld({ tauri = true, openFails = false, firstSendDelayMs = 0 } = {}) {
  const calls = [];
  const logs = [];
  const sent = [];
  const listeners = {};
  const nativeWsCalls = [];
  const windowHandlers = {};

  class FakeNativeWS {
    constructor(url, protocols) {
      nativeWsCalls.push({ url, protocols });
      this.url = url;
    }
  }
  Object.assign(FakeNativeWS, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });

  const emit = (kind, payload) =>
    (listeners['gateway-ws-session-' + kind] || []).forEach((cb) => cb({ payload }));

  let sendCount = 0;
  async function host(cmd, args) {
    calls.push({ cmd, args });
    switch (cmd) {
      case 'append_ui_log':
        logs.push(args.line);
        return '/tmp/log';
      case 'gateway_ws_open':
        if (openFails) throw new Error('port 1 is not the announced gateway port');
        // Rust emits status + first frame from its thread, usually before invoke() returns
        emit('status', { id: args.id, connected: true, message: 'connected hermes-gateway-v1', code: null });
        emit('frame', { id: args.id, data: 'ready' });
        return { connected: true, message: 'connected protocol=hermes-gateway-v1' };
      case 'gateway_ws_send_to':
        if (sendCount++ === 0 && firstSendDelayMs) await delay(firstSendDelayMs);
        sent.push(args.text);
        emit('frame', { id: args.id, data: 'echo:' + args.text });
        return null;
      case 'gateway_ws_close_id':
        emit('status', { id: args.id, connected: false, message: 'closed by client', code: 1000 });
        return { connected: false };
      default:
        return null;
    }
  }

  const sandbox = {
    EventTarget,
    Event,
    MessageEvent: globalThis.MessageEvent,
    CloseEvent: globalThis.CloseEvent,
    URL,
    TextDecoder,
    DOMException,
    setTimeout,
    clearTimeout,
    console: { error() {}, warn() {}, log() {} },
    WebSocket: FakeNativeWS,
    location: { href: 'http://127.0.0.1:5174/' },
    fetch: async () => ({ ok: true }),
    addEventListener(type, fn) {
      (windowHandlers[type] = windowHandlers[type] || []).push(fn);
    },
  };
  sandbox.window = sandbox;
  if (tauri) {
    sandbox.__TAURI_INTERNALS__ = { invoke: host, transformCallback: () => 1 };
    sandbox.__TAURI__ = {
      event: {
        listen: async (ev, cb) => {
          (listeners[ev] = listeners[ev] || []).push(cb);
          return () => {};
        },
      },
    };
  }
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'poseidon-bootstrap.js' });
  return { sandbox, calls, logs, sent, nativeWsCalls, windowHandlers, emit };
}

const GW = 'ws://127.0.0.1:55057/api/ws?native_dial=abc';
const PROTOS = ['hermes-gateway-v1', 'hermes-gateway-ticket.SECRETTICKET'];

test('hermesDesktop is installed synchronously, even before Tauri exists', () => {
  const w = makeWorld({ tauri: false });
  assert.ok(w.sandbox.hermesDesktop);
  assert.equal(typeof w.sandbox.hermesDesktop.getGatewayWsUrl, 'function');
  assert.equal(w.sandbox.hermesDesktop.windowControls.custom, true);
});

test('recursive stub: nested namespaces never throw', async () => {
  const w = makeWorld();
  const d = w.sandbox.hermesDesktop;
  assert.equal(await d.profile.getDefault(), null); // the old stub threw "not a function"
  assert.equal(await d.some.deeply.nested.call(1, 2), null);
  const unsub = d.onBootProgress(() => {});
  assert.equal(typeof unsub, 'function');
  // not thenable: `await hermesDesktop` must not hang
  const got = await Promise.race([Promise.resolve(d), delay(200).then(() => 'HANG')]);
  assert.notEqual(got, 'HANG');
  assert.equal(String(d.profile), '[poseidon-stub hermesDesktop.profile]');
});

test('boot trace records MISS/CALL once per path', async () => {
  const w = makeWorld();
  const d = w.sandbox.hermesDesktop;
  await d.profile.getDefault();
  await d.profile.getDefault();
  await delay(500);
  const trace = w.logs.filter((l) => l.startsWith('[trace]'));
  assert.ok(trace.some((l) => l.includes('MISS hermesDesktop.profile')));
  assert.ok(trace.some((l) => l.includes('CALL hermesDesktop.profile.getDefault')));
  assert.equal(trace.filter((l) => l.includes('CALL hermesDesktop.profile.getDefault')).length, 1);
});

test('WebSocket shim is synchronous and delivers open before messages', async () => {
  const w = makeWorld();
  const WS = w.sandbox.WebSocket;
  const order = [];
  const sock = new WS(GW, PROTOS);
  assert.equal(sock.readyState, 0); // CONNECTING, returned synchronously
  assert.ok(sock instanceof WS);
  sock.onopen = () => order.push('open');
  sock.onmessage = (e) => order.push('msg:' + e.data);
  await delay(100);
  assert.equal(sock.readyState, 1);
  assert.deepEqual(order.slice(0, 2), ['open', 'msg:ready']);
  assert.equal(sock.protocol, 'hermes-gateway-v1');

  const open = w.calls.find((c) => c.cmd === 'gateway_ws_open');
  assert.equal(open.args.url, GW);
  assert.deepEqual(Array.from(open.args.protocols), PROTOS); // vm realm: copy first

  sock.send('{"id":1}');
  await delay(50);
  assert.deepEqual(w.sent, ['{"id":1}']);
  assert.ok(order.includes('msg:echo:{"id":1}'));

  let closeEv = null;
  sock.addEventListener('close', (e) => (closeEv = e));
  sock.close(1000, 'bye');
  await delay(100);
  assert.equal(sock.readyState, 3);
  assert.equal(closeEv.code, 1000);
});

test('send() while CONNECTING throws InvalidStateError', () => {
  const w = makeWorld();
  const sock = new w.sandbox.WebSocket(GW, PROTOS);
  assert.throws(() => sock.send('x'), (e) => e.name === 'InvalidStateError');
});

test('sends keep their order even if the first IPC call is slow', async () => {
  const w = makeWorld({ firstSendDelayMs: 40 });
  const sock = new w.sandbox.WebSocket(GW, PROTOS);
  await delay(80);
  sock.send('1');
  sock.send('2');
  sock.send('3');
  await delay(200);
  assert.deepEqual(w.sent, ['1', '2', '3']);
});

test('non-gateway URLs (Vite HMR) go to the native WebSocket untouched', () => {
  const w = makeWorld();
  const s = new w.sandbox.WebSocket('ws://127.0.0.1:5174/', 'vite-hmr');
  assert.equal(w.nativeWsCalls.length, 1);
  assert.equal(w.nativeWsCalls[0].url, 'ws://127.0.0.1:5174/');
  assert.equal(w.nativeWsCalls[0].protocols, 'vite-hmr');
  assert.ok(!w.calls.some((c) => c.cmd === 'gateway_ws_open'));
  assert.ok(s);
});

test('failed open => error then close(1006)', async () => {
  const w = makeWorld({ openFails: true });
  const events = [];
  const sock = new w.sandbox.WebSocket(GW, PROTOS);
  sock.onerror = () => events.push('error');
  sock.onclose = (e) => events.push('close:' + e.code);
  await delay(150);
  assert.deepEqual(events, ['error', 'close:1006']);
  assert.equal(sock.readyState, 3);
});

test('server-side close is propagated with its code', async () => {
  const w = makeWorld();
  const sock = new w.sandbox.WebSocket(GW, PROTOS);
  let code = null;
  sock.onclose = (e) => (code = e.code);
  await delay(100);
  const id = w.calls.find((c) => c.cmd === 'gateway_ws_open').args.id;
  w.emit('status', { id, connected: false, message: 'server close', code: 1012 });
  await delay(20);
  assert.equal(code, 1012);
});

test('tickets never reach the log; JS errors and loopback fetches do', async () => {
  const w = makeWorld();
  new w.sandbox.WebSocket(GW + '&ticket=SECRETTICKET', PROTOS);
  (w.windowHandlers.error || []).forEach((h) =>
    h({ message: 'boom', filename: 'x.js', lineno: 7, error: { stack: 'Error: boom\n at a\n at b' } }),
  );
  await w.sandbox.fetch('http://127.0.0.1:55057/api/thing?ticket=SECRETTICKET&x=1');
  await delay(600);
  const all = w.logs.join('\n');
  assert.ok(!all.includes('SECRETTICKET'), 'ticket leaked into log');
  assert.ok(all.includes('[js-error] boom'));
  assert.ok(all.includes('NET-fetch http://127.0.0.1:55057/api/thing'));
});

test('installing twice is a no-op', () => {
  const w = makeWorld();
  const first = w.sandbox.WebSocket;
  vm.runInContext(SRC, w.sandbox);
  assert.equal(w.sandbox.WebSocket, first);
});
