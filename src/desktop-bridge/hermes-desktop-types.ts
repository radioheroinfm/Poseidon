/**
 * Nested hermesDesktop — Epoch 3 P0 connection path
 */

export type Platform = 'darwin' | 'win32' | 'linux';

export interface GatewayStatus {
  running: boolean;
  pid?: number;
  ownedByUs: boolean;
  portOpen: boolean;
  port?: number | null;
  message?: string | null;
}

export type GatewayWsUrlResult =
  | { ok: true; wsUrl: string }
  | { ok: false; error: string; needsOauthLogin?: boolean };

export interface SystemInfo {
  platform: Platform | string;
  arch: string;
  version: string;
  tauriVersion: string;
  isTauri: boolean;
}

export interface WindowControls {
  custom: boolean;
  minimize: () => void | Promise<void>;
  toggleMaximize: () => void | Promise<void>;
  close: () => void | Promise<void>;
}

/** From Rust get_connection — ensure + optional minted wsUrl */
export interface ConnectionInfo {
  kind: string;
  state: string;
  apiOrigin?: string | null;
  instanceId?: string | null;
  profileId?: string | null;
  wsUrl?: string | null;
  codeSha?: string | null;
  supervisor?: string | null;
  message?: string | null;
}

export interface ActiveRoute {
  connectionId?: string | null;
  profile?: string | null;
  registryScoped?: boolean;
}

export interface BootProgress {
  phase: string;
  ready: boolean;
  detail?: string | null;
  percent?: number | null;
}

export interface HermesDesktopP0 {
  windowControls: WindowControls;

  getVersion: (scope?: { connectionId?: string; profile?: string }) => Promise<string>;
  getGatewayWsUrl: (profile?: string) => Promise<GatewayWsUrlResult>;
  getConnection: (profile?: string) => Promise<ConnectionInfo>;
  getConnectionFor?: (payload?: {
    connectionId?: string | null;
    profile?: string | null;
  }) => Promise<ConnectionInfo>;
  setActiveConnectionRoute: (route: ActiveRoute) => Promise<ActiveRoute>;
  getBootProgress: () => Promise<BootProgress>;
  openExternal: (url: string) => Promise<void>;

  __poseidon: {
    getSystemInfo: () => Promise<SystemInfo>;
    gatewayStart: () => Promise<GatewayStatus>;
    gatewayStop: () => Promise<GatewayStatus>;
    gatewayStatus: () => Promise<GatewayStatus>;
    gatewayEnsure: () => Promise<GatewayStatus>;
  };
}

declare global {
  interface Window {
    hermesDesktop?: HermesDesktopP0;
  }
}

export {};
