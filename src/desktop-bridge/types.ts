/**
 * Poseidon Desktop Bridge — Types
 * 
 * Контракт, максимально близкий к реальному window.electronAPI
 * из hermes-agent/apps/desktop (preload.ts).
 * 
 * Цель: React-рендерер Hermes почти ничего не должен заметить.
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
  gatewayStart(): Promise<{ ok: boolean; message?: string }>;
  gatewayStop(): Promise<{ ok: boolean; message?: string }>;
  gatewayStatus(): Promise<{ running: boolean; pid?: number }>;

  // --- App ---
  getVersion(): Promise<string>;
  quit(): Promise<void>;
}
