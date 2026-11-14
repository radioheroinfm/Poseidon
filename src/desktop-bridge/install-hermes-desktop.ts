import type {
  HermesDesktopP0,
  GatewayStatus,
  SystemInfo,
  ConnectionInfo,
  GatewayWsUrlResult,
  ActiveRoute,
  BootProgress,
} from './hermes-desktop-types';
import { withHermesStubs } from './hermes-desktop-proxy';

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

  const getConnection = async (): Promise<ConnectionInfo> =>
    (await invoke('get_connection')) as ConnectionInfo;

  const api: HermesDesktopP0 = {
    windowControls: {
      custom: true,
      minimize: () => { void invoke('window_minimize'); },
      toggleMaximize: () => { void invoke('window_maximize'); },
      close: () => { void invoke('window_close'); },
    },

    getVersion: async () => String((await invoke('get_version')) ?? '0.1.0'),

    getGatewayWsUrl: async (): Promise<GatewayWsUrlResult> => {
      const r = await invoke('get_gateway_ws_url') as GatewayWsUrlResult;
      if (r && typeof r === 'object' && 'ok' in r) {
        if (r.ok === true && r.wsUrl) return { ok: true, wsUrl: r.wsUrl };
        if (r.ok === false) return { ok: false, error: r.error || 'error' };
      }
      return { ok: false, error: 'no url' };
    },

    getConnection,
    getConnectionFor: async () => getConnection(),

    setActiveConnectionRoute: async (route: ActiveRoute) =>
      (await invoke('set_active_connection_route', { route })) as ActiveRoute,

    getBootProgress: async () =>
      (await invoke('get_boot_progress')) as BootProgress,

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

  const wrapped = withHermesStubs(api);
  window.hermesDesktop = wrapped;
  console.log('[Poseidon] hermesDesktop P0 connection path installed');
  return wrapped;
}
