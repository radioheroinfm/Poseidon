/**
 * Poseidon Desktop Bridge
 * 
 * Изоморфный слой.
 * Снаружи выглядит как старый window.electronAPI из Hermes Desktop.
 * Внутри работает через Tauri invoke/listen.
 * 
 * Это позволяет почти не трогать оригинальный React-рендерер.
 */

export interface PoseidonDesktopAPI {
  // Пример минимального контракта (будет расширяться)
  getPlatform: () => Promise<string>;
  // ... остальные методы будут добавляться по мере аудита capability matrix
}

declare global {
  interface Window {
    electronAPI?: PoseidonDesktopAPI;   // для совместимости с оригинальным Hermes
    poseidon?: PoseidonDesktopAPI;      // наш новый неймспейс
  }
}

// TODO: Реализация через @tauri-apps/api
console.log("[Poseidon Bridge] placeholder loaded");
