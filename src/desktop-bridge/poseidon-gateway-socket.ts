/**
 * WebSocket-like adapter over Rust WsBridge (ADR-015).
 * Renderer must not dial gateway directly (Origin gate).
 *
 * Usage:
 *   const ws = await PoseidonGatewaySocket.connect();
 *   ws.onmessage = (ev) => { ... };
 *   ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'gateway.ping', params: {} }));
 *   ws.close();
 */

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
type Unlisten = () => void;

function getInvoke(): Invoke {
  const g = (window as unknown as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__;
  if (!g?.core?.invoke) throw new Error('no __TAURI__.core.invoke');
  return g.core.invoke.bind(g.core);
}

async function getListen(): Promise<
  (event: string, handler: (event: { payload: unknown }) => void) => Promise<Unlisten>
> {
  const g = (window as unknown as {
    __TAURI__?: { event?: { listen?: Function } };
  }).__TAURI__;
  if (!g?.event?.listen) throw new Error('no __TAURI__.event.listen');
  return g.event.listen.bind(g.event) as (
    event: string,
    handler: (event: { payload: unknown }) => void
  ) => Promise<Unlisten>;
}

export type SocketReadyState = 0 | 1 | 2 | 3;

export class PoseidonGatewaySocket {
  static readonly CONNECTING = 0 as const;
  static readonly OPEN = 1 as const;
  static readonly CLOSING = 2 as const;
  static readonly CLOSED = 3 as const;

  readyState: SocketReadyState = PoseidonGatewaySocket.CONNECTING;
  onopen: ((ev: { type: string }) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null = null;

  private unlistenFrame: Unlisten | null = null;
  private unlistenStatus: Unlisten | null = null;
  private invoke: Invoke;

  private constructor(invoke: Invoke) {
    this.invoke = invoke;
  }

  /** Connect via Rust (mint + canonical dial). */
  static async connect(): Promise<PoseidonGatewaySocket> {
    const invoke = getInvoke();
    const listen = await getListen();
    const sock = new PoseidonGatewaySocket(invoke);

    sock.unlistenFrame = await listen('gateway-ws-frame', (e) => {
      const data = typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload);
      sock.onmessage?.({ data });
    });

    sock.unlistenStatus = await listen('gateway-ws-status', (e) => {
      const st = e.payload as { connected?: boolean; message?: string };
      if (st && st.connected === false && sock.readyState === PoseidonGatewaySocket.OPEN) {
        sock.readyState = PoseidonGatewaySocket.CLOSED;
        sock.onclose?.({ reason: st.message });
        sock.cleanup();
      }
    });

    try {
      await invoke('gateway_ws_connect');
      sock.readyState = PoseidonGatewaySocket.OPEN;
      sock.onopen?.({ type: 'open' });
    } catch (err) {
      sock.readyState = PoseidonGatewaySocket.CLOSED;
      sock.onerror?.({ message: String(err) });
      sock.cleanup();
      throw err;
    }

    return sock;
  }

  send(data: string): void {
    if (this.readyState !== PoseidonGatewaySocket.OPEN) {
      throw new Error('PoseidonGatewaySocket is not OPEN');
    }
    void this.invoke('gateway_ws_send', { text: data }).catch((err) => {
      this.onerror?.({ message: String(err) });
    });
  }

  close(): void {
    if (this.readyState === PoseidonGatewaySocket.CLOSED) return;
    this.readyState = PoseidonGatewaySocket.CLOSING;
    void this.invoke('gateway_ws_close')
      .catch(() => {})
      .finally(() => {
        this.readyState = PoseidonGatewaySocket.CLOSED;
        this.onclose?.({ code: 1000, reason: 'client close' });
        this.cleanup();
      });
  }

  private cleanup(): void {
    this.unlistenFrame?.();
    this.unlistenStatus?.();
    this.unlistenFrame = null;
    this.unlistenStatus = null;
  }
}
