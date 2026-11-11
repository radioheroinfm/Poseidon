/**
 * Poseidon Desktop Bridge
 * 
 * Изоморфный слой совместимости.
 * 
 * Когда мы внутри Tauri — используем invoke/listen.
 * Когда мы в обычном браузере (для разработки UI) — используем моки.
 * 
 * React-код Hermes продолжает работать с window.electronAPI
 * и ничего не подозревает.
 */

import type {
  PoseidonDesktopAPI,
  SystemInfo,
  Platform,
  WindowState,
  OpenDialogOptions,
  SaveDialogOptions,
} from './types';

// -------------------------------------------------
// Определение среды
// -------------------------------------------------

const isTauri = typeof window !== 'undefined' &&
  // @ts-expect-error
  (window.__TAURI_INTERNALS__ !== undefined || window.__TAURI__ !== undefined);

// -------------------------------------------------
// Мок-реализация (для разработки UI без Tauri)
// -------------------------------------------------

function createMockAPI(): PoseidonDesktopAPI {
  console.log('[Poseidon Bridge] Running in MOCK mode (browser)');

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
    async windowMinimize() { console.log('[mock] windowMinimize'); },
    async windowMaximize() { console.log('[mock] windowMaximize'); },
    async windowClose() { console.log('[mock] windowClose'); },
    async windowIsMaximized() { return false; },
    onWindowStateChange(cb) {
      // no-op unsubscribe
      return () => {};
    },
    async showOpenDialog() {
      console.log('[mock] showOpenDialog');
      return null;
    },
    async showSaveDialog() {
      console.log('[mock] showSaveDialog');
      return null;
    },
    async openExternal(url: string) {
      window.open(url, '_blank');
    },
    async openPath(path: string) {
      console.log('[mock] openPath', path);
    },
    async gatewayStart() {
      return { ok: true, message: 'mock gateway started' };
    },
    async gatewayStop() {
      return { ok: true, message: 'mock gateway stopped' };
    },
    async gatewayStatus() {
      return { running: false };
    },
    async getVersion() {
      return '0.1.0-dev';
    },
    async quit() {
      console.log('[mock] quit');
    },
  };
}

// -------------------------------------------------
// Реальная Tauri-реализация (будет расширяться)
// -------------------------------------------------

async function createTauriAPI(): Promise<PoseidonDesktopAPI> {
  // Динамический импорт, чтобы не ломать сборку в чистом браузере
  const { invoke } = await import('@tauri-apps/api/core');
  // const { listen } = await import('@tauri-apps/api/event');
  // const { getCurrentWindow } = await import('@tauri-apps/api/window');

  console.log('[Poseidon Bridge] Running in TAURI mode');

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
      return invoke('gateway_start');
    },
    async gatewayStop() {
      return invoke('gateway_stop');
    },
    async gatewayStatus() {
      return invoke('gateway_status');
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
// Инициализация и экспорт
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
export async function installDesktopBridge(): Promise<void> {
  const api = await getDesktopAPI();

  // Главный трюк совместимости с оригинальным Hermes
  (window as any).electronAPI = api;
  (window as any).poseidon = api;

  console.log('[Poseidon Bridge] installed as window.electronAPI + window.poseidon');
}

// Для удобства
export type { PoseidonDesktopAPI, SystemInfo, Platform, WindowState };
