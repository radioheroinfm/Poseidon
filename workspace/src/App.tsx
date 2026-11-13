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
  Wifi,
  ShieldCheck,
  FileCheck2,
  Palette
} from 'lucide-react';
import {
  BROTHERS,
  CAPABILITY_MATRIX,
  CORRESPONDENCE_LOGS,
  MANIFEST_LAWS,
  MIGRATION_PHASES,
  JournalMessage
} from './data/projectData';
import ComicReader from './components/ComicReader';

export default function App() {
  const [activeTab, setActiveTab] = useState<'audit' | 'journal' | 'roadmap' | 'manifest' | 'simulator' | 'comic'>('audit');
  const [auditSubTab, setAuditSubTab] = useState<'epoch3' | 'epoch2' | 'kolyan' | 'epoch1' | 'phase0'>('epoch3');
  const [searchQuery, setSearchQuery] = useState('');
  const [journalMessages, setJournalMessages] = useState<JournalMessage[]>(CORRESPONDENCE_LOGS);
  const [newMsgText, setNewMsgText] = useState('');
  const [newMsgTitle, setNewMsgTitle] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [isComicModalOpen, setIsComicModalOpen] = useState(false);

  // Simulator state with honest [SIM] tags as requested by Kolyan
  const [simLogs, setSimLogs] = useState<Array<{ time: string; command: string; result: string; latency: number }>>([
    { time: '02:15:01', command: 'invoke("get_platform")', result: '[SIM] "linux" (OS converted to Electron standard darwin/win32/linux)', latency: 2 },
    { time: '02:15:02', command: 'invoke("get_system_info")', result: '[SIM] {"platform":"linux","arch":"x64","version":"0.1.0","tauriVersion":"2.x","isTauri":true} (camelCase aligned)', latency: 3 },
    { time: '02:15:03', command: 'invoke("show_open_dialog", {directory: true})', result: '[SIM] ["/home/user/workspace/hermes-agent"] (pick_folder implemented)', latency: 5 },
    { time: '02:15:04', command: 'check_main_rs_entry()', result: '[SIM] src-tauri/src/main.rs verified -> poseidon_desktop_lib::run() exists (OK)', latency: 1 },
  ]);
  const [simRunning, setSimRunning] = useState(false);

  const handleSimCommand = (cmd: string, mockResp: string) => {
    setSimRunning(true);
    setTimeout(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const latency = Math.floor(Math.random() * 8) + 2;
      setSimLogs(prev => [
        { time: timeStr, command: cmd, result: `[SIM] ${mockResp}`, latency },
        ...prev
      ]);
      setSimRunning(false);
    }, 220);
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
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-amber-950/90 text-amber-300 border border-amber-800/60">
                  ДЕЛАЕМ КРАСИВО!
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>Nous Research Hermes Agent</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400 font-medium">Rust + Tauri v2 Shell</span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400">Комикс & Дашборд</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Comic Button in Header */}
            <button
              onClick={() => {
                setActiveTab('comic');
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-cyan-500/20 hover:from-amber-500/30 hover:to-cyan-500/30 border border-amber-500/50 text-amber-300 transition-all shadow-md group animate-pulse"
            >
              <Palette className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
              <span className="font-bold">Комикс: Рождение Посейдона</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-900/80 text-[10px] text-amber-200">8 кадров</span>
            </button>

            <a
              href="https://github.com/radioheroinfm/Poseidon"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/50 text-cyan-300 transition-all shadow-sm group"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>radioheroinfm/Poseidon</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-900/80 text-[10px] text-cyan-200">main</span>
              <ExternalLink className="w-3 h-3 text-cyan-400/70" />
            </a>

            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-900/90 border border-slate-800 text-slate-300">
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
              <span>Commit: <strong className="text-emerald-400">8035e77</strong> • Эпоха 3</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto border-t border-slate-900/90 pt-1">
          <button
            onClick={() => setActiveTab('comic')}
            className={`px-4 py-2 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'comic'
                ? 'border-amber-400 text-amber-300 bg-amber-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            Комикс: Рождение Посейдона
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-900/80 text-amber-200 font-mono">NEW</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
            Центр аудита (Колян + Женя)
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`px-4 py-2 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'journal'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            Журнал братьев
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 font-mono">
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
            План миграции
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
            Манифест (11 Законов)
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
                Совет трёх братьев-акробатов
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline-block">
              «Времени бесконечно много. ДЕЛАЕМ КРАСИВО!»
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {BROTHERS.map(brother => {
              const isKolyan = brother.id === 'kolyan';
              const isZhenya = brother.id === 'zhenya';
              const isGrok = brother.id === 'grok';
              return (
                <div
                  key={brother.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isKolyan
                      ? 'bg-amber-950/20 border-amber-600/70'
                      : isZhenya
                      ? 'bg-cyan-950/20 border-cyan-700/60 shadow-lg shadow-cyan-950/40 relative overflow-hidden'
                      : 'bg-blue-950/20 border-blue-800/60'
                  }`}
                >
                  {isZhenya && (
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-cyan-500 to-teal-500 text-[10px] text-slate-950 font-bold px-2 py-0.5 rounded-bl-lg">
                      ЖЕНЯ (АРТ & АУДИТ)
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
                          isKolyan
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                            : isZhenya
                            ? 'bg-cyan-900/80 text-cyan-200 border border-cyan-700/60'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
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

        {/* Tab: Comic Reader */}
        {activeTab === 'comic' && (
          <ComicReader />
        )}

        {/* Tab 1: Audit Center */}
        {activeTab === 'audit' && (
          <div className="space-y-5">
            {/* Sub-tab switcher */}
            <div className="flex items-center gap-2 p-1 bg-slate-900/80 border border-slate-800 rounded-xl w-fit flex-wrap">
              <button
                onClick={() => setAuditSubTab('epoch3')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  auditSubTab === 'epoch3'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Отчёт №6: Закрытие Эпохи 2 & Эпоха 3 (8035e77)
                <span className="px-1.5 py-0.2 rounded bg-slate-950 text-cyan-300 text-[10px]">NEW</span>
              </button>
              <button
                onClick={() => setAuditSubTab('epoch2')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  auditSubTab === 'epoch2'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Отчёт №4: Rust-фиксы Эпохи 2 🟢
              </button>
              <button
                onClick={() => setAuditSubTab('kolyan')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  auditSubTab === 'kolyan'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Отчёт №3: Стратегический вердикт Коляна
              </button>
              <button
                onClick={() => setAuditSubTab('epoch1')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  auditSubTab === 'epoch1'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Отчёт №2: Аудит Эпохи 1 (Deadlock & CSP)
              </button>
              <button
                onClick={() => setAuditSubTab('phase0')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  auditSubTab === 'phase0'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                Отчёт №1: Фаза 0
              </button>
            </div>

            {/* SubTab Content: Epoch 2 Closure & Epoch 3 Start (#6) */}
            {auditSubTab === 'epoch3' && (
              <div className="space-y-4">
                <div className="bg-[#08111e] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-300 text-[10px] font-mono uppercase font-bold">
                          Эпоха 2 ЗАКРЫТА • 3 ОС CI GREEN 🟢
                        </span>
                        <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700/60 text-cyan-300 text-[10px] font-mono font-bold">
                          Release deb 4.07 MiB • Эпоха 3: Spike 1
                        </span>
                        <span className="text-xs text-slate-400 font-mono">docs/AUDIT_REPORT_EPOCH_3_START.md</span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-1.5">
                        Отчёт №6 Жени: Эпоха 2 закрыта по ADR-012, ответ Коляну и 4 замечания до Spike 1
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        CI на <code className="text-cyan-300">ubuntu / macos / windows</code> зелёный (runs #1–#2), R1 и SIGKILL группы закрыты, в Эпохе 3 принят <code className="text-cyan-300">ADR-014</code> (nested <code className="text-cyan-300">window.hermesDesktop</code>).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
                    <div className="p-4 rounded-xl bg-emerald-950/15 border border-emerald-800/60">
                      <span className="text-xs font-mono font-bold text-emerald-400 block mb-2">
                        ✅ Факты закрытия Эпохи 2 + старт Эпохи 3
                      </span>
                      <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                        <li><strong>CI 3 ОС:</strong> <code className="text-cyan-300 font-mono">.github/workflows/ci.yml</code> зелёный (<code className="text-cyan-300 font-mono">tsc --noEmit</code>, 8/8 <code className="text-cyan-300 font-mono">cargo test</code>, <code className="text-cyan-300 font-mono">tauri build</code>).</li>
                        <li><strong>Release-размер:</strong> Linux <code className="text-emerald-300 font-mono">.deb 4.07 MiB</code> / <code className="text-emerald-300 font-mono">.rpm 4.08 MiB</code> (в 13 раз меньше debug!).</li>
                        <li><strong>R1 & R5 закрыты:</strong> владение пишется ДО ожидания READY, <code className="text-cyan-300 font-mono">SIGKILL</code> бьёт по группе <code className="text-cyan-300 font-mono">-pid</code>, живой JSON в окне подтверждён.</li>
                        <li><strong>Эпоха 3:</strong> черновик <code className="text-cyan-300 font-mono">PRELOAD_MAP.md</code> (166 ключей), <code className="text-cyan-300 font-mono">get_gateway_ws_url</code> и <code className="text-cyan-300 font-mono">gateway_ensure</code>.</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-950/15 border border-amber-800/60">
                      <span className="text-xs font-mono font-bold text-amber-400 block mb-2">
                        🟠 4 замечания Жени до Spike 1 (и хвосты Эпохи 2)
                      </span>
                      <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                        <li><strong>Дубль моста:</strong> <code className="text-cyan-300 font-mono">install-hermes-desktop.ts</code> и <code className="text-cyan-300 font-mono">&lt;script&gt;</code> в <code className="text-cyan-300 font-mono">index.html</code> дублируют <code className="text-cyan-300 font-mono">hermesDesktop</code> (TS-модуль пока не подключён).</li>
                        <li><strong>Гипотеза WS URL & R3:</strong> <code className="text-cyan-300 font-mono">get_gateway_ws_url</code> не сверен с путём/токеном в <code className="text-cyan-300 font-mono">hermes-agent</code>, а attach ищет только порт 8642.</li>
                        <li><strong>Слепой stderr & stop():</strong> <code className="text-cyan-300 font-mono">stderr</code> всё ещё в <code className="text-cyan-300 font-mono">Stdio::null()</code>, в <code className="text-cyan-300 font-mono">stop()</code> остался <code className="text-cyan-300 font-mono">port: Some(port_now)</code>, а <code className="text-cyan-300 font-mono">find_hermes_binary</code> не знает путей Windows.</li>
                        <li><strong>Хвосты Эпохи 2:</strong> закоммитить <code className="text-cyan-300 font-mono">Cargo.lock</code>/<code className="text-cyan-300 font-mono">package-lock.json</code>, добавить <code className="text-cyan-300 font-mono">clippy</code>, заменить 8-байтный <code className="text-cyan-300 font-mono">icon.icns</code>, снять Electron baseline и написать в Nous Research.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SubTab Content: Zhenya Epoch 2 Audit (#4 accepted) */}
            {auditSubTab === 'epoch2' && (
              <div className="space-y-4">
                <div className="bg-[#08111e] border border-emerald-900/60 rounded-2xl p-5 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-300 text-[10px] font-mono uppercase font-bold">
                          Приёмка Жени • Отчёт №4 (Раздел 6)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700/60 text-cyan-300 text-[10px] font-mono font-bold">
                          cargo test 8/8 🟢 • Arc + spawn_blocking 🟢
                        </span>
                        <span className="text-xs text-slate-400 font-mono">docs/AUDIT_REPORT_EPOCH_2.md</span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-1.5">
                        Срез e82cbac: Rust-слой принят — все критические баги и внешний Mutex закрыты!
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Гриша оперативно убрал внешний <code className="text-cyan-300">Mutex</code>, перевёл <code className="text-cyan-300">gateway_start</code> на <code className="text-cyan-300">Arc + spawn_blocking</code>, починил <code className="text-cyan-300">":"</code> в путях и убрал <code className="text-cyan-300">|| true</code> из <code className="text-cyan-300">tsc</code> в CI.
                      </p>
                    </div>
                  </div>

                  {/* Verified Fixed vs Remaining */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
                    <div className="p-4 rounded-xl bg-emerald-950/15 border border-emerald-800/60">
                      <span className="text-xs font-mono font-bold text-emerald-400 block mb-2">
                        ✅ Закрыто и принято по Rust + CI (bf48e6e → e82cbac)
                      </span>
                      <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                        <li><code className="text-cyan-300 font-mono">Arc&lt;GatewayManager&gt;</code> + <code className="text-cyan-300 font-mono">spawn_blocking</code> + <code className="text-cyan-300 font-mono">start_guard</code> — <code className="text-cyan-300 font-mono">status/stop/Exit</code> не блокируются на 60с!</li>
                        <li><code className="text-cyan-300 font-mono">PYTHONUNBUFFERED=1</code> + фоновый drainer до EOF — Python не падает от <code className="text-cyan-300 font-mono">SIGPIPE</code>.</li>
                        <li><code className="text-cyan-300 font-mono">validate_open_path</code> режет <code className="text-cyan-300 font-mono">javascript:foo</code> и пропускает <code className="text-cyan-300 font-mono">/tmp/12:30.txt</code> (8/8 тестов OK).</li>
                        <li>В CI <code className="text-cyan-300 font-mono">npx tsc --noEmit</code> теперь строгий (без <code className="text-cyan-300 font-mono">|| true</code>).</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-950/15 border border-amber-800/60">
                      <span className="text-xs font-mono font-bold text-amber-400 block mb-2">
                        🟡 Последние 3 шага до сдачи Эпохи 2 Коляну
                      </span>
                      <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                        <li><strong>Живой смоук кнопок:</strong> подключить в <code className="text-cyan-300 font-mono">renderer-placeholder/index.html</code> реальный <code className="text-cyan-300 font-mono">window.__TAURI__.core.invoke</code>, чтобы кнопки отдавали живой JSON вместо <em>placeholder mode</em>.</li>
                        <li><strong>Диалоги и иконка:</strong> вернуть <code className="text-cyan-300 font-mono">filters</code> в Rust, убрать <code className="text-cyan-300 font-mono">shell:allow-open</code> и нарезать непустой <code className="text-cyan-300 font-mono">icon.icns</code> (сейчас 8 байт).</li>
                        <li><strong>Закон №11:</strong> перенести workflow в <code className="text-cyan-300 font-mono">.github/workflows/ci.yml</code>, получить зелёный CI на 3 ОС и снять <strong>release</strong>-метрики в <code className="text-cyan-300 font-mono">METRICS.md</code>.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SubTab Content: Kolyan's Strategic Audit */}
            {auditSubTab === 'kolyan' && (
              <div className="space-y-4">
                <div className="bg-[#08111e] border border-amber-900/60 rounded-2xl p-5 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-700/60 text-amber-300 text-[10px] font-mono uppercase font-bold">
                          Вердикт стратегического аудитора
                        </span>
                        <span className="text-xs text-slate-400 font-mono">docs/AUDIT_REPORT_EPOCH_1_STRATEGIC.md</span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-1">
                        [ЭПОХА 1: КАРКАС ПРИНЯТ, ЗАКРЫТИЕ НЕ ПОДТВЕРЖДЕНО]
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Колян: 5 блокеров 🔴 · 7 высоких рисков 🟠 · 8 средних 🟡. Закон №11: «закрыто» ставит только зелёный CI на 3 ОС!
                      </p>
                    </div>
                    <div className="text-xs font-mono text-emerald-400 font-semibold">
                      ✓ Блокеры B1–B5 оперативно зачищены Женей (коммит dac4ea4)
                    </div>
                  </div>

                  {/* 5 Blockers Status Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-emerald-900/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-red-400">🔴 Блокер B1: Отсутствие `main.rs`</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 font-bold">ИСПРАВЛЕНО</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        В `src-tauri/src/` лежал только `lib.rs`, бинарник не имел точки входа.
                      </p>
                      <div className="mt-2 text-xs font-mono text-emerald-400">
                        ✓ Женя создал <code className="bg-slate-950 px-1 py-0.5 rounded text-cyan-300">src-tauri/src/main.rs</code> с вызовом <code className="text-cyan-300">poseidon_desktop_lib::run()</code>.
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-emerald-900/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-red-400">🔴 Блокер B2: Иконки и защита почты</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 font-bold">ИСПРАВЛЕНО</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Скрипт защиты e-mail подменил строку <code className="text-cyan-300 font-mono">128x128@2x.png</code> на <code className="text-cyan-300 font-mono">henry.w@example.net</code>.
                      </p>
                      <div className="mt-2 text-xs font-mono text-emerald-400">
                        ✓ Женя восстановил путь в <code className="bg-slate-950 px-1 py-0.5 rounded text-cyan-300">tauri.conf.json</code> и <code className="bg-slate-950 px-1 py-0.5 rounded text-cyan-300">icons/README.md</code>.
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-emerald-900/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-red-400">🔴 Блокер B4: Значения платформ darwin/win32</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 font-bold">ИСПРАВЛЕНО</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Rust отдавал <code className="text-cyan-300 font-mono">"macos"</code> и <code className="text-cyan-300 font-mono">"windows"</code>, а TypeScript ждёт контракт Electron <code className="text-cyan-300 font-mono">"darwin" | "win32"</code>.
                      </p>
                      <div className="mt-2 text-xs font-mono text-emerald-400">
                        ✓ Женя добавил маппинг <code className="bg-slate-950 px-1 py-0.5 rounded text-cyan-300">get_platform()</code> в <code className="text-cyan-300 font-mono">bridge.rs</code>.
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-emerald-900/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-red-400">🔴 Блокер B5: Рассинхрон camelCase/snake_case</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 font-bold">ИСПРАВЛЕНО</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        В моке возвращались <code className="text-cyan-300 font-mono">tauriVersion/isTauri</code>, а Rust сериализовал в snake_case, поля были бы <code className="text-cyan-300 font-mono">undefined</code>.
                      </p>
                      <div className="mt-2 text-xs font-mono text-emerald-400">
                        ✓ Женя добавил <code className="bg-slate-950 px-1 py-0.5 rounded text-cyan-300">#[serde(rename_all = "camelCase")]</code> на все структуры.
                      </div>
                    </div>
                  </div>

                  {/* Highlights from Kolyan */}
                  <div className="mt-4 p-4 rounded-xl bg-slate-900/60 border border-amber-900/40">
                    <h4 className="text-xs font-mono font-bold text-amber-400 uppercase mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      Стратегические рекомендации Коляна на Эпоху 2:
                    </h4>
                    <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                      <li><strong>Закон №11:</strong> Статус «закрыто» ставит только зелёный CI на трёх ОС (Linux, macOS, Windows).</li>
                      <li><strong>Диалоги папки (M1):</strong> Женя уже добавил <code className="text-cyan-300 font-mono">pick_folder()</code> в <code className="text-cyan-300 font-mono">show_open_dialog</code> при <code className="text-cyan-300 font-mono">directory: true</code>!</li>
                      <li><strong>Жизненный цикл на Windows:</strong> Реализовать Win32 Job Objects, чтобы подпроцессы Python завершались вместе с окном.</li>
                      <li><strong>Безопасность open_path:</strong> Ограничить запуск произвольных файлов, внедрить проверку безопасных схем https/http.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* SubTab Content: Epoch 1 */}
            {auditSubTab === 'epoch1' && (
              <div className="bg-[#08111e] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-300 text-[10px] font-mono uppercase font-bold">
                      Оперативный аудит Эпохи 1 (Женя)
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-1">
                      Разбор реализации Гриши: Deadlock в Drop и CSP сокетов
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">docs/AUDIT_REPORT_EPOCH_1.md</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4 text-xs text-slate-300">
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <strong className="text-slate-100 block mb-1">1. Deadlock в Drop GatewayManager</strong>
                    Блокировка `owned_by_us` не сбрасывалась до вызова `stop()`. Женя исправил на `map(|g| *g)`.
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <strong className="text-slate-100 block mb-1">2. CSP блокировал сокеты Gateway</strong>
                    В `connect-src` добавлены `ws://127.0.0.1:*` и `http://127.0.0.1:*`.
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
                    Сохранение контракта `window.electronAPI` для легкого подтягивания апдейтов.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <strong className="text-slate-100 block mb-1">2. Защита от процессов-зомби Python Gateway</strong>
                    Использование RAII и process group.
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
                  {['all', '#аудит', '#эпоха_3', '#эпоха_2', '#честность', '#красота', '#блокер', '#закон_11', '#стратегия'].map(tag => (
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
                  Библия и 11 Законов • Включая Закон Коляна №11
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
                    onClick={() => handleSimCommand('invoke("get_platform")', '"darwin" (platform conversion verified)')}
                    disabled={simRunning}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-700/60 transition-all text-xs font-mono group"
                  >
                    <div className="flex items-center justify-between text-cyan-300 font-semibold mb-0.5">
                      <span>invoke("get_platform")</span>
                      <Zap className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-400">Проверка конвертации macos/windows в darwin/win32 (B4)</p>
                  </button>

                  <button
                    onClick={() => handleSimCommand('invoke("get_system_info")', '{"platform":"darwin","arch":"arm64","version":"0.1.0","tauriVersion":"2.x","isTauri":true}')}
                    disabled={simRunning}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-emerald-700/60 transition-all text-xs font-mono group"
                  >
                    <div className="flex items-center justify-between text-emerald-300 font-semibold mb-0.5">
                      <span>invoke("get_system_info")</span>
                      <Zap className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-400">Проверка camelCase-сериализации структуры SystemInfo (B5)</p>
                  </button>

                  <button
                    onClick={() => handleSimCommand('invoke("show_open_dialog", {directory: true})', '["/home/user/workspace/hermes-agent"]')}
                    disabled={simRunning}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-amber-700/60 transition-all text-xs font-mono group"
                  >
                    <div className="flex items-center justify-between text-amber-300 font-semibold mb-0.5">
                      <span>invoke("show_open_dialog", &#123;directory: true&#125;)</span>
                      <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-400">Проверка выбора папки проекта через pick_folder() (M1)</p>
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
            <span className="text-cyan-400">Commit 8035e77 • Эпоха 3</span>
          </div>
          <div className="text-slate-400">
            «Закон №11: Статус 'закрыто' ставит только зелёный CI на трёх ОС. ДЕЛАЕМ КРАСИВО!»
          </div>
        </div>
      </footer>
    </div>
  );
}
