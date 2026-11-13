# hermesDesktop PRELOAD_MAP

**Upstream:** NousResearch/hermes-agent  
**SHA:** `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19` (`v0.23.0`)  
**Source:** `apps/desktop/electron/preload.ts`  
**Shape:** one `contextBridge.exposeInMainWorld('hermesDesktop', { ... })`

> Приоритет: P0 = нужен для Spike 1 (первый чат), P1 = скоро, P2 = позже, P3 = platform/optional.

## P0 — минимальный путь к чату (гипотеза, уточняется)

| Key | Kind | Notes | Tauri approach |
|-----|------|-------|----------------|
| `getConnection` | invoke | descriptor / how to reach backend | command + gateway manager |
| `getGatewayWsUrl` | invoke | WS URL for renderer | from READY port / attach |
| `getVersion` | invoke | app/agent version | `get_version` / package |
| `getBootProgress` | invoke | boot UI | stub or real from gateway start |
| `onBootProgress` | event | boot events | Tauri event |
| `onBackendExit` | event | backend died | emit on child exit |
| `windowControls` | object | `{ custom, minimize, toggleMaximize, close }` | existing window_* commands |
| `onWindowStateChanged` | event | titlebar | window events |
| `openExternal` | invoke | links | existing open_external |
| `getPlatform` / machine | — | often via connection/version | get_platform |

## P1 — оболочка и настройки

| Key | Kind | Priority |
|-----|------|----------|
| `uiPreferences` | object | P1 |
| `settings` | object | P1 |
| `themes` | object | P1 |
| `setTitleBarTheme` / `setNativeTheme` / `setTranslucency` | send/invoke | P1 |
| `zoom` | object | P1 |
| `notify` | invoke | P1 |
| `clipboard` / `writeClipboard` / `readClipboard` | invoke | P1 |
| `selectPaths` / `selectSavePath` / `saveTextFileAs` | invoke | P1 (dialogs) |
| `revealPath` / `openDir` / `readDir` | invoke | P1 |
| `getRecentLogs` / `revealLogs` / `logLine` | invoke | P1 |

## P2 — connections / multi-backend

| Key | Kind | Priority |
|-----|------|----------|
| `connections` | object (list/save/remove/…) | P2 |
| `getConnectionFor` / `revalidateConnection` | invoke | P2 |
| `getGatewayWsUrlFor` / `getPluginWsUrl` | invoke | P2 |
| `cloud` | object | P2 |
| `profile` | object | P2 |
| `sshConfigHosts` / `sshResolveHost` | invoke | P2 |
| `oauthLoginConnectionConfig` | invoke | P2 |

## P3 — heavy / desktop-only chrome

| Key | Priority | Notes |
|-----|----------|-------|
| `hud` / `hudModifier` / `petOverlay` | P3 | floating windows |
| `quickEntry` | P3 | global hotkey mini composer |
| `screenshot` | P3 | macOS mostly |
| `terminal` | P3 | PTY — large |
| `git` / `git.review` | P3 | large surface |
| `pluginFiles` / desktop plugins | P3 | |
| `updates` / `uninstall` / `desktopMetrics` | P3 | |
| `findInPage` | P3 | |
| `mcpOauth` / `freeTierChallenge` | P3 | |

## Full top-level key list (from BUILD_REPORT / preload audit)

```
glassSupported, translucencySupported, localModelsEnabled, assumeFreshInstall,
localSkin, uiPreferences, getConnection, getEmbedHostOrigin, getConnectionFor,
getProfileRoutes, revalidateConnection, getGatewayWsUrl, getGatewayWsUrlFor,
getPluginWsUrl, getAgentRoster, openSessionWindow, openSessionInTerminal,
openWindow, openBrowserWindow, windowRelay, onBrowserPopoutClosed,
claimAmbientCue, windowControls, wakeIndicator, chatOnboarding, petOverlay,
hud, hudModifier, screenshot, quickEntry, getBootProgress,
getConnectionConfig, saveConnectionConfig, applyConnectionConfig,
testConnectionConfig, getSecretStorageEncryption, setSecretStorageEncryption,
connections, sshConfigHosts, sshResolveHost, probeConnectionConfig,
oauthLoginConnectionConfig, oauthLogoutConnectionConfig, cloud, profile,
api, notify, claimStartupLatency, requestMicrophoneAccess,
readWindowBelow, readFileDataUrl, readFileDataUrlForAttach, dataUrlReadMax,
readFileText, readPluginSource, selectPaths, selectSavePath,
saveTextFileAs, writeClipboard, readClipboard, saveGatewayFile,
saveImageFromUrl, contextMenuEdit, contextMenuCopyImage, contextMenuSpellcheck,
contextMenuGuestAddWord, spellcheckDictionary, onContextMenuSpellcheck,
saveImageBuffer, capturePreview, savePastedText, saveClipboardImage,
getPathForFile, normalizePreviewTarget, watchPreviewFile, watchDirectory,
stopPreviewFileWatch, setActiveWork, scheduleStreamWorkWake, onStreamWorkWake,
setTitleBarTheme, setNativeTheme, setTranslucency, setKeepAwake,
onKeepAwakeOffer, minimizeToTray, setDisableF12, setF12ShortcutActive,
onF12Shortcut, setPreviewShortcutActive, setPreviewGuestHidden,
beginPreviewGuestActivity, endPreviewGuestActivity, executePreviewGuestScript,
openExternal, freeTierChallenge, mcpOauth, openPreviewInBrowser,
reachPreviewUrl, setActiveConnectionRoute, fetchLinkTitle, resolveFavicon,
sanitizeWorkspaceCwd, settings, preparedSubmissions, zoom, revealLogs,
getRecentLogs, reportRendererError, logLine, readDir, gitRoot,
revealPath, openDir, desktopPluginsRoot, reconcileDesktopPlugins,
reconcileDesktopPluginsReport, logsRoot, renamePath, writeTextFile,
trashPath, pluginFiles, git, terminal, onClosePreviewRequested,
onPreviewNav, onOpenFolderRequested, onOpenUpdatesRequested, onDeepLink,
signalDeepLinkReady, probePluginRepo, installDesktopPlugin, removeDesktopPlugin,
onWindowStateChanged, onFocusSession, onNotificationAction,
onNotificationActivate, onExternalOpenFailed, onPreviewFileChanged,
onBackendExit, onConnectionApplied, onPowerResume, getOnBattery,
onBatteryChanged, onBootProgress, getBootstrapState, probeLocalBackend,
continueBootstrapLocal, recycleBackend, resetBootstrap, updateHold,
repairBootstrap, cancelBootstrap, onBootstrapEvent, getVersion,
relaunchApp, getMachineProfile, getRemoteDisplayReason, uninstall,
updates, desktopMetrics, themes, findInPage, stopFindInPage,
onFoundInPage, onOpenFindBarRequested
```

## Next

1. Из локального hermes-agent: какие ключи дергаются при **первом показе чата** (devtools / log).
2. Nested TypeScript interface `HermesDesktop` для P0.
3. Реализация P0 commands + events в Poseidon.
4. Spike 1: подключить renderer build.
