import type {
  HermesDesktopP0,
  GatewayStatus,
  SystemInfo,
  ConnectionDescriptor,
} from './hermes-desktop-types';

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function getInvoke(): Invoke | null {
  const g = (window as unknown as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__;
  if (g?.core?.invoke) return g.core.invoke.bind(g.core);
  return null;
}

export function installHermesDesktopP0(): HermesDesktopP0 | null {
  const invoke = getInvoke();
  if (!invoke) {
    console.warn('[Poseidon] no __TAURI__.core.invoke');
    return null;
  }

  const api: HermesDesktopP0 = {
    windowControls: {
      custom: true,
      minimize: () => { void invoke('window_minimize'); },
      toggleMaximize: () => { void invoke('window_maximize'); },
      close: () => { void invoke('window_close'); },
    },

    getVersion: async () => String((await invoke('get_version')) ?? '0.1.0'),

    getGatewayWsUrl: async () => {
      const url = await invoke('get_gateway_ws_url');
      return (url as string | null) ?? null;
    },

    getConnection: async () => {
      const st = (await invoke('gateway_status')) as GatewayStatus;
      const wsUrl =
        st?.portOpen && st.port ? `ws://127.0.0.1:${st.port}` : null;
      return {
        kind: wsUrl ? 'local' : 'none',
        wsUrl,
        port: st?.port ?? null,
        status: st,
      } satisfies ConnectionDescriptor;
    },

    getBootProgress: async () => ({ phase: 'poseidon-shell', ready: true }),

    openExternal: async (url: string) => {
      await invoke('open_external', { url });
    },

    __poseidon: {
      getSystemInfo: () => invoke('get_system_info') as Promise<SystemInfo>,
      gatewayStart: () => invoke('gateway_start') as Promise<GatewayStatus>,
      gatewayStop: () => invoke('gateway_stop') as Promise<GatewayStatus>,
      gatewayStatus: () => invoke('gateway_status') as Promise<GatewayStatus>,
      gatewayEnsure: () => invoke('gateway_ensure') as Promise<GatewayStatus>,
    },
  };

  window.hermesDesktop = api;
  console.log('[Poseidon] window.hermesDesktop P0+ installed');
  return api;
}
