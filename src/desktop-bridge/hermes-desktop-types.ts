/**
 * Nested hermesDesktop shape (upstream-aligned) — Epoch 3 P0 subset.
 * Full map: docs/upstream/PRELOAD_MAP.md
 * SHA: 2bd378ed (v0.23.0)
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

/** P0 windowControls — matches preload structure */
export interface WindowControls {
  custom: boolean;
  minimize: () => void | Promise<void>;
  toggleMaximize: () => void | Promise<void>;
  close: () => void | Promise<void>;
}

/**
 * P0 slice of window.hermesDesktop for Spike 1 bootstrapping.
 * Expand only from PRELOAD_MAP priorities.
 */
export interface HermesDesktopP0 {
  windowControls: WindowControls;

  getVersion: (scope?: { connectionId?: string; profile?: string }) => Promise<string>;
  getGatewayWsUrl: (profile?: string) => Promise<string | null>;
  getBootProgress: () => Promise<unknown>;

  openExternal: (url: string) => Promise<void>;

  /** Poseidon extensions during transition (not in upstream) */
  __poseidon?: {
    getSystemInfo: () => Promise<SystemInfo>;
    gatewayStart: () => Promise<GatewayStatus>;
    gatewayStop: () => Promise<GatewayStatus>;
    gatewayStatus: () => Promise<GatewayStatus>;
  };
}

declare global {
  interface Window {
    hermesDesktop?: HermesDesktopP0;
  }
}

export {};
