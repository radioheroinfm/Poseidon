/**
 * Poseidon Desktop Bridge
 *
 * Изоморфный слой совместимости с window.electronAPI из Hermes Desktop.
 *
 * - Внутри Tauri  → настоящие invoke
 * - В браузере    → честные моки
 *
 * React-код Hermes продолжает работать с window.electronAPI.
 */

import type {
  PoseidonDesktopAPI,
  SystemInfo,
  Platform,
  WindowState,
  OpenDialogOptions,
  SaveDialogOptions,
  GatewayStatus,
} from './types';

// -------------------------------------------------
// Определение среды
// -------------------------------------------------

function detectTauri(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-expect-error
  return !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

const isTauri = detectTauri();

// -------------------------------------------------
// Мок-реализация
// -------------------------------------------------

function createMockAPI(): PoseidonDesktopAPI {
  console.log('[Poseidon Bridge] MOCK mode');

  return {
    async getSystemInfo(): Promise<SystemInfo> {
      return {
        platform: 'linux',
        arch: 'x64',
        version: '0.1.0-dev',
        tauriVersion: '2.x',
        isTauri: true,
      };
    },
    async getPlatform(): Promise<Platform> {
      return 'linux';
    },
    async windowMinimize() {},
    async windowMaximize() {},
    async windowClose() {},
    async windowIsMaximized() { return false; },
    onWindowStateChange(_cb) {
      return () => {};
    },
    async showOpenDialog(_options?: OpenDialogOptions) {
      return null;
    },
    async showSaveDialog(_options?: SaveDialogOptions) {
      return null;
    },
    async openExternal(url: string) {
      window.open(url, '_blank');
    },
    async openPath(_path: string) {},
    async gatewayStart(): Promise<GatewayStatus> {
      return { running: false, owned_by_us: false, port_open: false, message: 'mock' };
    },
    async gatewayStop(): Promise<GatewayStatus> {
      return { running: false, owned_by_us: false, port_open: false, message: 'mock' };
    },
    async gatewayStatus(): Promise<GatewayStatus> {
      return { running: false, owned_by_us: false, port_open: false, message: 'mock' };
    },
    async getVersion() {
      return '0.1.0-dev';
    },
    async quit() {},
  };
}

// -------------------------------------------------
// Tauri-реализация
// -------------------------------------------------

async function createTauriAPI(): Promise<PoseidonDesktopAPI> {
  const { invoke } = await import('@tauri-apps/api/core');

  console.log('[Poseidon Bridge] TAURI mode');

  return {
    async getSystemInfo() {
      return invoke<SystemInfo>('get_system_info');
    },
    async getPlatform() {
      return invoke<Platform>('get_platform');
    },
    async windowMinimize() {
      return invoke('window_minimize');
    },
    async windowMaximize() {
      return invoke('window_maximize');
    },
    async windowClose() {
      return invoke('window_close');
    },
    async windowIsMaximized() {
      return invoke<boolean>('window_is_maximized');
    },
    onWindowStateChange(_cb) {
      // TODO: listen('window-state-changed', ...)
      return () => {};
    },
    async showOpenDialog(options?: OpenDialogOptions) {
      return invoke<string[] | null>('show_open_dialog', { options });
    },
    async showSaveDialog(options?: SaveDialogOptions) {
      return invoke<string | null>('show_save_dialog', { options });
    },
    async openExternal(url: string) {
      return invoke('open_external', { url });
    },
    async openPath(path: string) {
      return invoke('open_path', { path });
    },
    async gatewayStart() {
      return invoke<GatewayStatus>('gateway_start');
    },
    async gatewayStop() {
      return invoke<GatewayStatus>('gateway_stop');
    },
    async gatewayStatus() {
      return invoke<GatewayStatus>('gateway_status');
    },
    async getVersion() {
      return invoke<string>('get_version');
    },
    async quit() {
      return invoke('quit_app');
    },
  };
}

// -------------------------------------------------
// Публичный API
// -------------------------------------------------

let apiPromise: Promise<PoseidonDesktopAPI> | null = null;

export async function getDesktopAPI(): Promise<PoseidonDesktopAPI> {
  if (!apiPromise) {
    apiPromise = isTauri ? createTauriAPI() : Promise.resolve(createMockAPI());
  }
  return apiPromise;
}

/**
 * Устанавливает bridge в window.
 * Вызывать один раз при старте приложения.
 */
export async function installDesktopBridge(): Promise<PoseidonDesktopAPI> {
  const api = await getDesktopAPI();

  (window as any).electronAPI = api;
  (window as any).poseidon = api;

  console.log('[Poseidon Bridge] installed → window.electronAPI + window.poseidon');
  return api;
}

export type { PoseidonDesktopAPI, SystemInfo, Platform, WindowState, GatewayStatus };
