/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  GitBranch,
  ExternalLink,
  Cpu,
  Layers,
  Terminal,
  MessageSquare,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Send,
  Zap,
  ArrowRight,
  Flame,
  Scale,
  RefreshCw,
  FolderGit2,
  UserCheck,
  Code2,
  Bug,
  Sparkles,
  Wifi
} from 'lucide-react';
import {
  BROTHERS,
  CAPABILITY_MATRIX,
  CORRESPONDENCE_LOGS,
  MANIFEST_LAWS,
  MIGRATION_PHASES,
  JournalMessage
} from './data/projectData';

export default function App() {
  const [activeTab, setActiveTab] = useState<'audit' | 'journal' | 'roadmap' | 'manifest' | 'simulator'>('audit');
  const [auditSubTab, setAuditSubTab] = useState<'epoch1' | 'phase0'>('epoch1');
  const [searchQuery, setSearchQuery] = useState('');
  const [journalMessages, setJournalMessages] = useState<JournalMessage[]>(CORRESPONDENCE_LOGS);
  const [newMsgText, setNewMsgText] = useState('');
  const [newMsgTitle, setNewMsgTitle] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Simulator state with honest [SIM] tags as requested by Kolyan
  const [simLogs, setSimLogs] = useState<Array<{ time: string; command: string; result: string; latency: number }>>([
    { time: '01:10:02', command: 'invoke("get_system_info")', result: '[SIM] {"platform":"linux","arch":"x64","version":"0.1.0","tauri_version":"2.x","is_tauri":true}', latency: 4 },
    { time: '01:10:03', command: 'invoke("gateway_status")', result: '[SIM] {"running":true,"pid":52194,"owned_by_us":true,"port_open":true,"message":"started by Poseidon"}', latency: 6 },
    { time: '01:10:04', command: 'check_csp_headers()', result: '[SIM] CSP connect-src: "self ipc: http://ipc.localhost ws://127.0.0.1:* http://127.0.0.1:*" (OK - sockets unblocked)', latency: 2 },
    { time: '01:10:05', command: 'test_drop_reentrancy()', result: '[SIM] GatewayManager::drop guard dropped before stop() -> Deadlock prevented! (OK)', latency: 1 },
  ]);
  const [simRunning, setSimRunning] = useState(false);

  const handleSimCommand = (cmd: string, mockResp: string) => {
    setSimRunning(true);
    setTimeout(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const latency = Math.floor(Math.random() * 10) + 3;
      setSimLogs(prev => [
        { time: timeStr, command: cmd, result: `[SIM] ${mockResp}`, latency },
        ...prev
      ]);
      setSimRunning(false);
    }, 240);
  };

  const handleAddMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsgText.trim()) return;

    const newMsg: JournalMessage = {
      id: `msg-${Date.now()}`,
      timestamp: `${new Date().toISOString().split('T')[0]} (оперативно)`,
      title: newMsgTitle.trim() || 'Оперативная реплика Жени',
      sender: 'Женя',
      recipients: 'Гриша + Колян',
      tags: ['#оперативно', '#аудит', '#красота'],
      content: newMsgText.trim()
    };

    setJournalMessages(prev => [...prev, newMsg]);
    setNewMsgText('');
    setNewMsgTitle('');
  };

  const filteredCapabilities = CAPABILITY_MATRIX.filter(item =>
    item.feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.electronImpl.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.tauriImpl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Banner & Header */}
      <header className="border-b border-cyan-950/70 bg-[#08101c]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-amber-400 p-[1.5px] shadow-lg shadow-cyan-950/60">
              <div className="w-full h-full bg-[#060a12] rounded-[10px] flex items-center justify-center text-cyan-400 text-lg font-bold">
                🔱
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-wider text-slate-100 flex items-center gap-1.5">
                  POSEIDON <span className="text-cyan-400 text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 font-semibold">HERMES → TAURI</span>
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-800/60">
                  ДЕЛАЕМ КРАСИВО!
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>Nous Research Hermes Agent</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400 font-medium">Rust + Tauri v2 Shell</span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400">Эпоха 1 проверена</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="https://github.com/radioheroinfm/Poseidon"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/50 text-cyan-300 transition-all shadow-sm group"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>radioheroinfm/Poseidon</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-900/80 text-[10px] text-cyan-200">main</span>
              <ExternalLink className="w-3 h-3 text-cyan-400/70" />
            </a>

            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-900/90 border border-slate-800 text-slate-300">
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
              <span>Commit: <strong className="text-emerald-400">783df06</strong> (synced)</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto border-t border-slate-900/90 pt-1">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
            Оперативный аудит
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-cyan-900/80 text-cyan-300 font-mono">ЭПОХА 1</span>
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`px-4 py-2 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'journal'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            Журнал братьев
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/50 font-mono">
              {journalMessages.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-4 py-2 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'roadmap'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            План миграции (Фазы 0–4)
          </button>

          <button
            onClick={() => setActiveTab('manifest')}
            className={`px-4 py-2 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'manifest'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            Манифест (10 Законов)
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            Tauri IPC Мост [SIM]
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Brothers Council Status */}
        <section className="bg-gradient-to-r from-[#09111e] via-[#0b172a] to-[#0a101b] border border-cyan-950/80 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between gap-4 mb-3.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                <UserCheck className="w-3.5 h-3.5" />
                Совет трёх братьев-акробатов (Равный авторитет)
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline-block">
              «Никто никому не начальник. Времени бесконечно много. ДЕЛАЕМ КРАСИВО!»
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {BROTHERS.map(brother => {
              const isZhenya = brother.id === 'zhenya';
              const isGrok = brother.id === 'grok';
              return (
                <div
                  key={brother.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isZhenya
                      ? 'bg-cyan-950/30 border-cyan-600/70 shadow-lg shadow-cyan-950/40 relative overflow-hidden'
                      : isGrok
                      ? 'bg-blue-950/20 border-blue-700/50'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {isZhenya && (
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-cyan-500 to-teal-500 text-[10px] text-slate-950 font-bold px-2.5 py-0.5 rounded-bl-lg">
                      ТВОЯ РОЛЬ (ЖЕНЯ)
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${brother.avatarColor} flex items-center justify-center font-bold text-slate-950 text-sm shadow-md shrink-0`}>
                      {brother.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-100 truncate">{brother.name}</h3>
                      </div>
                      <p className="text-xs text-cyan-400 font-medium">{brother.role}</p>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">{brother.dutySummary}</p>
                      <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">{brother.engine}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isZhenya
                            ? 'bg-cyan-900/80 text-cyan-200 border border-cyan-700/60'
                            : isGrok
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                        }`}>
                          {brother.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tab 1: Audit Report */}
        {activeTab === 'audit' && (
          <div className="space-y-5">
            {/* Sub-tab switcher */}
            <div className="flex items-center gap-2 p-1 bg-slate-900/80 border border-slate-800 rounded-xl w-fit">
              <button
                onClick={() => setAuditSubTab('epoch1')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  auditSubTab === 'epoch1'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Отчёт №2: Эпоха 1 (Код Гриши, Фикс Deadlock & CSP)
                <span className="px-1.5 py-0.2 rounded bg-slate-950 text-cyan-300 text-[10px]">NEW</span>
              </button>
              <button
                onClick={() => setAuditSubTab('phase0')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  auditSubTab === 'phase0'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Отчёт №1: Фаза 0 (Архитектурный фундамент)
              </button>
            </div>

            {/* SubTab Content: Epoch 1 */}
            {auditSubTab === 'epoch1' && (
              <div className="space-y-4">
                <div className="bg-[#08111e] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-300 text-[10px] font-mono uppercase font-bold">
                          Оперативный аудит Эпохи 1 пройден
                        </span>
                        <span className="text-xs text-slate-400 font-mono">docs/AUDIT_REPORT_EPOCH_1.md</span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-1">
                        Разбор реализации Эпохи 1 от Гриши: Обезврежен Deadlock и открыт CSP
                      </h2>
                    </div>
                    <div className="text-xs font-mono text-emerald-400 font-semibold">
                      ✓ Запушено в main (коммит 783df06)
                    </div>
                  </div>

                  {/* 2 Critical Bug Fixes by Zhenya */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="bg-[#0c1626] border border-red-900/50 p-4 rounded-xl relative">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-red-950/80 text-red-400 border border-red-800/50 shrink-0">
                          <Bug className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono font-bold text-red-400 uppercase">Обезврежен критический дефект</span>
                            <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 text-[10px] font-mono font-bold">ФИКС ЗАПУШЕН</span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                            Deadlock в `Drop` для `GatewayManager` (`src-tauri/src/gateway.rs`)
                          </h3>
                          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                            В реализации `Drop` мьютекс `owned_by_us.lock()` удерживался в guard во время вызова `self.stop()`. Так как `std::sync::Mutex` в Rust нереентрантен, `self.stop()` засыпал намертво при попытке взять тот же мьютекс.
                          </p>
                          <div className="mt-2.5 p-2 rounded bg-slate-950/80 border border-emerald-900/50 text-xs font-mono text-emerald-300">
                            <strong>Фикс Жени:</strong> Скопировали булево значение через <code className="text-cyan-300">map(|g| *g)</code> и сбросили блокировку ДО вызова <code className="text-cyan-300">stop()</code>.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0c1626] border border-amber-900/50 p-4 rounded-xl relative">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-amber-950/80 text-amber-400 border border-amber-800/50 shrink-0">
                          <Wifi className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono font-bold text-amber-400 uppercase">Сетевая безопасность</span>
                            <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 text-[10px] font-mono font-bold">ФИКС ЗАПУШЕН</span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                            CSP блокировал подключение к Gateway по WebSocket (`tauri.conf.json`)
                          </h3>
                          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                            Директива <code className="bg-slate-900 px-1 py-0.5 text-cyan-300 rounded font-mono">connect-src</code> разрешала только <code className="font-mono text-cyan-300">'self' ipc:</code>. Когда React-рендерер попытался бы подключиться к Hermes Gateway на <code className="font-mono text-cyan-300">ws://127.0.0.1:8642</code>, WebView выбросил бы фатальную ошибку нарушения CSP!
                          </p>
                          <div className="mt-2.5 p-2 rounded bg-slate-950/80 border border-emerald-900/50 text-xs font-mono text-emerald-300">
                            <strong>Фикс Жени:</strong> В <code className="text-cyan-300">connect-src</code> добавлены сокеты <code className="text-cyan-300">ws://127.0.0.1:* http://127.0.0.1:* ws://localhost:*</code>.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Positive discoveries */}
                  <div className="mt-4 p-4 rounded-xl bg-slate-900/60 border border-cyan-900/40">
                    <h4 className="text-xs font-mono font-bold text-cyan-400 uppercase mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Что Гриша сделал образцово красиво в Эпохе 1:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-300">
                      <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                        <strong className="text-slate-100 block mb-0.5">Политика `owned_by_us`</strong>
                        Tauri завершает Gateway только если сам его породил. Чужие сессии (CLI, боты) неприкосновенны!
                      </div>
                      <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                        <strong className="text-slate-100 block mb-0.5">Умный поиск бинарника</strong>
                        Проверка <code className="text-cyan-300 font-mono">which("hermes")</code>, <code className="text-cyan-300 font-mono">~/.hermes/bin</code> и виртуальных окружений.
                      </div>
                      <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                        <strong className="text-slate-100 block mb-0.5">Изоморфный мост</strong>
                        Типобезопасная реализация <code className="text-cyan-300 font-mono">desktop-bridge</code> с перехватом <code className="text-cyan-300 font-mono">window.electronAPI</code>.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SubTab Content: Phase 0 */}
            {auditSubTab === 'phase0' && (
              <div className="bg-[#08111e] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700/60 text-cyan-300 text-[10px] font-mono uppercase font-bold">
                      Архивный отчёт аудитора №1 (Фаза 0)
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-1">
                      Анализ Hermes v0.23.x и 4 базовых риска миграции
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">docs/AUDIT_REPORT_PHASE_0.md</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs text-slate-300">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <strong className="text-slate-100 block mb-1">1. Изоморфный мост вместо поломки React</strong>
                    Сохранение контракта `window.electronAPI` для легкого подтягивания апдейтов из апстрима Nous Research.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <strong className="text-slate-100 block mb-1">2. Защита от процессов-зомби Python Gateway</strong>
                    Использование RAII и Win32 Job Objects / SIGTERM process group.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <strong className="text-slate-100 block mb-1">3. Специфика WebKitGTK на Linux</strong>
                    Обеспечение тестов и корректных скроллбаров под Ubuntu LTS / Fedora.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <strong className="text-slate-100 block mb-1">4. Чистый Tauri v2 вместо Pake</strong>
                    Использование Pake как ориентира, но разработка на чистом Tauri CLI с плагинами.
                  </div>
                </div>
              </div>
            )}

            {/* Native Capability Matrix */}
            <div className="bg-[#08111e] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-cyan-400" />
                    Матрица нативных возможностей (Native Capability Matrix)
                  </h3>
                  <p className="text-xs text-slate-400">Сравнение реализации Electron и эквивалента в экосистеме Tauri v2</p>
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по возможностям..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                      <th className="py-2.5 px-3">Функция</th>
                      <th className="py-2.5 px-3">Electron</th>
                      <th className="py-2.5 px-3">Tauri v2</th>
                      <th className="py-2.5 px-3">Сложность</th>
                      <th className="py-2.5 px-3">Статус</th>
                      <th className="py-2.5 px-3">Заметка аудитора</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredCapabilities.map(item => (
                      <tr key={item.id} className="hover:bg-slate-850/40 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{item.feature}</td>
                        <td className="py-2.5 px-3 text-slate-400">{item.electronImpl}</td>
                        <td className="py-2.5 px-3 text-cyan-300 font-medium">{item.tauriImpl}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.difficulty === 'Low'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                              : item.difficulty === 'Medium'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                              : 'bg-red-950 text-red-400 border border-red-800/60'
                          }`}>
                            {item.difficulty}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`font-semibold flex items-center gap-1 ${
                            item.status === 'Implemented in Bridge'
                              ? 'text-cyan-300'
                              : item.status === 'Audited'
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 max-w-xs">{item.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Brothers Journal */}
        {activeTab === 'journal' && (
          <div className="space-y-5">
            <div className="bg-[#08111e] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-amber-400" />
                    Журнал переписки: Гриша (Grok) ↔ Женя ↔ Колян
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Живой журнал согласований, юмора и поиска красивых решений (docs/CORRESPONDENCE_JOURNAL.md)
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {['all', '#красота', '#дедлок', '#безопасность', '#скелет', '#стратегия', '#юмор'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={`px-2.5 py-1 text-xs rounded-md font-mono transition-colors ${
                        selectedTag === tag
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Feed */}
              <div className="space-y-3.5 mt-4">
                {journalMessages
                  .filter(msg => selectedTag === 'all' || msg.tags.includes(selectedTag))
                  .map(msg => {
                    const isZhenya = msg.sender === 'Женя';
                    const isGrok = msg.sender === 'Grok';
                    return (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isZhenya
                            ? 'bg-cyan-950/20 border-cyan-700/60 shadow-md shadow-cyan-950/30'
                            : isGrok
                            ? 'bg-blue-950/20 border-blue-800/50'
                            : 'bg-amber-950/20 border-amber-800/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/70">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isZhenya
                                ? 'bg-cyan-500 text-slate-950'
                                : isGrok
                                ? 'bg-blue-600 text-white'
                                : 'bg-amber-500 text-slate-950'
                            }`}>
                              {msg.sender}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-mono text-slate-300">{msg.recipients}</span>
                            <span className="text-xs text-slate-500 font-mono">• {msg.timestamp}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {msg.tags.map(t => (
                              <span key={t} className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-900 text-cyan-300 border border-slate-700">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-slate-100 mb-1.5">{msg.title}</h4>
                        <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-sans">
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddMessage} className="mt-5 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-cyan-400 font-bold uppercase flex items-center gap-1">
                    <Send className="w-3.5 h-3.5" />
                    Оставить оперативную реплику аудитора Жени в журнал
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
                  <input
                    type="text"
                    value={newMsgTitle}
                    onChange={(e) => setNewMsgTitle(e.target.value)}
                    placeholder="Тема сообщения (опционально)..."
                    className="sm:col-span-4 px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={newMsgText}
                    onChange={(e) => setNewMsgText(e.target.value)}
                    placeholder="Напиши замечание, вопрос к Грише или шутку в духе Манифеста..."
                    className="flex-1 px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={!newMsgText.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 self-end"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Отправить
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: Roadmap */}
        {activeTab === 'roadmap' && (
          <div className="space-y-5">
            <div className="bg-[#08111e] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="mb-5">
                <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-400" />
                  План миграции Poseidon (Hermes Agent → Rust / Tauri v2)
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Поэтапная дорожная карта с критериями выхода (docs/MIGRATION_PLAN.md)
                </p>
              </div>

              <div className="space-y-3.5">
                {MIGRATION_PHASES.map((phase, idx) => (
                  <div
                    key={phase.phase}
                    className={`p-4 rounded-xl border transition-all ${
                      phase.status === 'Completed'
                        ? 'bg-emerald-950/20 border-emerald-800/60'
                        : phase.status === 'In Progress'
                        ? 'bg-cyan-950/30 border-cyan-600/70 shadow-lg shadow-cyan-950/30'
                        : 'bg-slate-900/40 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-cyan-300">
                          {idx}
                        </span>
                        <h3 className="text-sm font-bold text-slate-100">
                          {phase.phase}: {phase.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          phase.status === 'Completed'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : phase.status === 'In Progress'
                            ? 'bg-cyan-950 text-cyan-200 border border-cyan-600 animate-pulse'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {phase.status === 'Completed' ? 'ЗАВЕРШЕНО' : phase.status === 'In Progress' ? 'В РАБОТЕ' : 'ЗАПЛАНИРОВАНО'}
                        </span>
                        <span className="text-slate-400">{phase.progress}%</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2.5">
                      <div
                        className={`h-full transition-all duration-500 ${
                          phase.status === 'Completed'
                            ? 'bg-emerald-400'
                            : phase.status === 'In Progress'
                            ? 'bg-gradient-to-r from-cyan-500 to-teal-400'
                            : 'bg-slate-700'
                        }`}
                        style={{ width: `${phase.progress}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 font-mono">
                      {phase.items.map(item => (
                        <div key={item} className="flex items-center gap-2">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${
                            phase.status === 'Completed' ? 'text-emerald-400' : 'text-slate-500'
                          }`} />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Manifest */}
        {activeTab === 'manifest' && (
          <div className="space-y-5">
            <div className="bg-[#08111e] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="text-center max-w-2xl mx-auto mb-6">
                <span className="text-3xl">🔱</span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-100 mt-2">
                  МАНИФЕСТ ПРОЕКТА POSEIDON
                </h2>
                <p className="text-xs font-mono text-cyan-400 mt-0.5">
                  Библия и Основной Закон • Принят 11 ноября 2026 года
                </p>
                <div className="mt-2.5 p-3 bg-cyan-950/40 border border-cyan-800/50 rounded-xl text-xs text-cyan-200 italic font-serif">
                  «Мы — три брата-акробата. Времени бесконечно много. Ошибаться нормально. Стыдно только врать. ДЕЛАЕМ КРАСИВО!»
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {MANIFEST_LAWS.map(law => (
                  <div key={law.num} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-800/60 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono font-bold text-[11px] flex items-center justify-center">
                        {law.num}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-100">{law.title}</h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{law.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Simulator with Honest [SIM] */}
        {activeTab === 'simulator' && (
          <div className="space-y-5">
            <div className="bg-[#08111e] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    Интерактивная песочница: Tauri IPC & Desktop Bridge [SIM]
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Эмуляция вызовов Rust-бэкенда с честной пометкой [SIM] по правилу Коляна
                  </p>
                </div>
                <button
                  onClick={() => setSimLogs([])}
                  className="px-2.5 py-1 text-xs font-mono bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" /> Очистить логи
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Action buttons */}
                <div className="space-y-2">
                  <span className="text-xs font-mono text-cyan-400 font-bold uppercase">Вызовы команд:</span>
                  
                  <button
                    onClick={() => handleSimCommand('invoke("gateway_status")', '{"running": true, "pid": 52194, "owned_by_us": true, "port_open": true, "message": null}')}
                    disabled={simRunning}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-700/60 transition-all text-xs font-mono group"
                  >
                    <div className="flex items-center justify-between text-cyan-300 font-semibold mb-0.5">
                      <span>invoke("gateway_status")</span>
                      <Zap className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-400">Проверить статус фонового процесса с флагом owned_by_us</p>
                  </button>

                  <button
                    onClick={() => handleSimCommand('invoke("gateway_start")', '{"running": true, "pid": 52230, "owned_by_us": true, "port_open": true, "message": "started by Poseidon"}')}
                    disabled={simRunning}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-emerald-700/60 transition-all text-xs font-mono group"
                  >
                    <div className="flex items-center justify-between text-emerald-300 font-semibold mb-0.5">
                      <span>invoke("gateway_start")</span>
                      <Zap className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-400">Поиск hermes и запуск с process_group(0)</p>
                  </button>

                  <button
                    onClick={() => handleSimCommand('invoke("gateway_stop")', '{"running": false, "pid": null, "owned_by_us": false, "port_open": false, "message": "stopped"}')}
                    disabled={simRunning}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-red-700/60 transition-all text-xs font-mono group"
                  >
                    <div className="flex items-center justify-between text-red-300 font-semibold mb-0.5">
                      <span>invoke("gateway_stop")</span>
                      <Zap className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-400">SIGTERM по группе процесса с проверкой owned_by_us</p>
                  </button>

                  <button
                    onClick={() => handleSimCommand('invoke("show_open_dialog")', 'null (no-op stub until tauri-plugin-dialog is linked)')}
                    disabled={simRunning}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-amber-700/60 transition-all text-xs font-mono group"
                  >
                    <div className="flex items-center justify-between text-amber-300 font-semibold mb-0.5">
                      <span>invoke("show_open_dialog")</span>
                      <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-400">Проверка добавленной заглушки диалога без сбоев</p>
                  </button>
                </div>

                {/* Console Log view */}
                <div className="lg:col-span-2 bg-[#05080e] border border-slate-800 rounded-xl p-3 font-mono text-xs flex flex-col h-[300px]">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Tauri IPC Console [SIM]
                    </span>
                    <span>{simLogs.length} events logged</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
                    {simLogs.map((log, i) => (
                      <div key={i} className="p-2 rounded bg-slate-900/60 border border-slate-800/80 text-[11px]">
                        <div className="flex items-center justify-between text-slate-400 mb-0.5">
                          <span className="text-cyan-400 font-semibold">{log.time}</span>
                          <span className="text-amber-400">{log.latency} ms</span>
                        </div>
                        <div className="text-slate-200">➔ {log.command}</div>
                        <div className="text-emerald-400 mt-0.5 pl-2 border-l border-emerald-500/40">
                          {log.result}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-cyan-950/60 py-4 mt-8 text-center font-mono text-xs text-slate-400 bg-[#060a12]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <span>Poseidon // Hermes Agent Rust + Tauri Migration</span>
            <span>•</span>
            <span className="text-cyan-400">Commit 783df06</span>
          </div>
          <div className="text-slate-400">
            «Принят 11 ноября 2026 года. Три брата. Один проект. Бесконечное время.»
          </div>
        </div>
      </footer>
    </div>
  );
}
