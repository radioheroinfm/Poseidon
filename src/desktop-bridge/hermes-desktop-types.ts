/**
 * Nested hermesDesktop — Epoch 3 expanding P0 toward Spike 1.
 * Map: docs/upstream/PRELOAD_MAP.md · SHA 2bd378ed
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

/** Connection-ish stub until full registry ported */
export interface ConnectionDescriptor {
  kind: 'local' | 'none';
  wsUrl: string | null;
  port: number | null;
  status: GatewayStatus;
}

export interface HermesDesktopP0 {
  windowControls: WindowControls;

  getVersion: (scope?: { connectionId?: string; profile?: string }) => Promise<string>;
  getGatewayWsUrl: (profile?: string) => Promise<string | null>;
  getConnection: (profile?: string) => Promise<ConnectionDescriptor>;
  getBootProgress: () => Promise<Record<string, unknown>>;
  openExternal: (url: string) => Promise<void>;

  /** Poseidon-native helpers during migration */
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
