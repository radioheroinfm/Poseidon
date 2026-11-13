/**
 * Install nested window.hermesDesktop (P0) using Tauri invoke.
 * Epoch 3 — ADR-014
 */

import type { HermesDesktopP0, GatewayStatus, SystemInfo } from './hermes-desktop-types';

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function getInvoke(): Invoke | null {
  const g = (window as unknown as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__;
  if (g?.core?.invoke) return g.core.invoke.bind(g.core);
  return null;
}

export function installHermesDesktopP0(): HermesDesktopP0 | null {
  const invoke = getInvoke();
  if (!invoke) {
    console.warn('[Poseidon] no __TAURI__.core.invoke — hermesDesktop not installed');
    return null;
  }

  const api: HermesDesktopP0 = {
    windowControls: {
      custom: true,
      minimize: () => { void invoke('window_minimize'); },
      toggleMaximize: () => { void invoke('window_maximize'); },
      close: () => { void invoke('window_close'); },
    },

    getVersion: async () => {
      const v = await invoke('get_version');
      return String(v ?? '0.1.0');
    },

    getGatewayWsUrl: async () => {
      const st = (await invoke('gateway_status')) as GatewayStatus;
      if (st?.portOpen && st.port) {
        return `ws://127.0.0.1:${st.port}`;
      }
      // try start? Spike 1 policy: status only; start explicit later
      return null;
    },

    getBootProgress: async () => {
      return { phase: 'poseidon-shell', ready: true };
    },

    openExternal: async (url: string) => {
      await invoke('open_external', { url });
    },

    __poseidon: {
      getSystemInfo: () => invoke('get_system_info') as Promise<SystemInfo>,
      gatewayStart: () => invoke('gateway_start') as Promise<GatewayStatus>,
      gatewayStop: () => invoke('gateway_stop') as Promise<GatewayStatus>,
      gatewayStatus: () => invoke('gateway_status') as Promise<GatewayStatus>,
    },
  };

  window.hermesDesktop = api;
  console.log('[Poseidon] window.hermesDesktop (P0) installed');
  return api;
}
