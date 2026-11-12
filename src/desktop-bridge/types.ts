/**
 * Poseidon Desktop Bridge — Types
 *
 * Upstream Hermes exposes a large `window.hermesDesktop` API
 * (apps/desktop/electron/preload.ts, 760+ lines).
 *
 * Epoch 2 strategy: implement a **minimal viable subset** needed for:
 * - window controls (custom titlebar)
 * - system/platform info
 * - gateway lifecycle (start/stop/status)
 * - open external / path / dialogs
 *
 * Full parity with hermesDesktop is Epoch 3+.
 * See docs/upstream/FINDINGS_2026-11-12.md
 */

export type Platform = 'darwin' | 'win32' | 'linux';

export interface SystemInfo {
  platform: Platform;
  arch: string;
  version: string;          // версия Poseidon Desktop
  tauriVersion: string;
  isTauri: true;
}

export interface WindowState {
  isMaximized: boolean;
  isMinimized: boolean;
  isFullscreen: boolean;
  isFocused: boolean;
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  directory?: boolean;
  multiple?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

/**
 * Главный публичный API, который будет доступен как window.electronAPI
 * и как window.poseidon
 */
export interface PoseidonDesktopAPI {
  // --- System ---
  getSystemInfo(): Promise<SystemInfo>;
  getPlatform(): Promise<Platform>;

  // --- Window controls (для кастомного titlebar) ---
  windowMinimize(): Promise<void>;
  windowMaximize(): Promise<void>;
  windowClose(): Promise<void>;
  windowIsMaximized(): Promise<boolean>;
  onWindowStateChange(callback: (state: WindowState) => void): () => void;

  // --- Dialogs ---
  showOpenDialog(options?: OpenDialogOptions): Promise<string[] | null>;
  showSaveDialog(options?: SaveDialogOptions): Promise<string | null>;

  // --- Shell ---
  openExternal(url: string): Promise<void>;
  openPath(path: string): Promise<void>;

  // --- Gateway / Agent process ---
  // owned_by_us = true только если Desktop сам запустил этот процесс
  // port_open  = true если порт Gateway сейчас слушается
  gatewayStart(): Promise<GatewayStatus>;
  gatewayStop(): Promise<GatewayStatus>;
  gatewayStatus(): Promise<GatewayStatus>;

  // --- App ---
  getVersion(): Promise<string>;
  quit(): Promise<void>;
}

export interface GatewayStatus {
  running: boolean;
  pid?: number;
  owned_by_us: boolean;
  port_open: boolean;
  /** Announced or probed port */
  port?: number;
  message?: string;
}