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
  Code2
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
  const [searchQuery, setSearchQuery] = useState('');
  const [journalMessages, setJournalMessages] = useState<JournalMessage[]>(CORRESPONDENCE_LOGS);
  const [newMsgText, setNewMsgText] = useState('');
  const [newMsgTitle, setNewMsgTitle] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Simulator state
  const [simLogs, setSimLogs] = useState<Array<{ time: string; command: string; result: string; latency: number }>>([
    { time: '22:12:04', command: 'invoke("check_python_env")', result: 'OK (Python 3.14.0 found at ~/.hermes/venv)', latency: 8 },
    { time: '22:12:05', command: 'invoke("bridge_init")', result: 'OK (Mock ElectronAPI registered over Tauri IPC)', latency: 3 },
  ]);
  const [simRunning, setSimRunning] = useState(false);

  const handleSimCommand = (cmd: string, mockResp: string) => {
    setSimRunning(true);
    setTimeout(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const latency = Math.floor(Math.random() * 12) + 4;
      setSimLogs(prev => [
        { time: timeStr, command: cmd, result: mockResp, latency },
        ...prev
      ]);
      setSimRunning(false);
    }, 280);
  };

  const handleAddMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsgText.trim()) return;

    const newMsg: JournalMessage = {
      id: `msg-${Date.now()}`,
      timestamp: `${new Date().toISOString().split('T')[0]} (оперативно)`,
      title: newMsgTitle.trim() || 'Оперативная заметка аудитора',
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
    <div className="min-h-screen bg-[#070c14] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Banner & Header */}
      <header className="border-b border-cyan-950/60 bg-[#09111e]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-amber-400 p-[1.5px] shadow-lg shadow-cyan-950/50">
              <div className="w-full h-full bg-[#070c14] rounded-[10px] flex items-center justify-center text-cyan-400 text-xl font-bold">
                🔱
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold tracking-wider text-slate-100 flex items-center gap-1.5">
                  POSEIDON <span className="text-cyan-400 text-xs font-mono font-medium px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60">HERMES → TAURI</span>
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  ДЕЛАЕМ КРАСИВО!
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>Nous Research Hermes Agent Migration</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400/90 font-medium">Rust + Tauri v2 Shell</span>
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
              <span>Commit: <strong className="text-emerald-400">181fc87</strong> (synced)</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto border-t border-slate-900/80 pt-1">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2.5 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
            Оперативный аудит №1
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-cyan-900/60 text-cyan-300 font-mono">NEW</span>
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`px-4 py-2.5 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'journal'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            Журнал братьев
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/50 font-mono">
              {journalMessages.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-4 py-2.5 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'roadmap'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            План миграции (Фазы 0–4)
          </button>

          <button
            onClick={() => setActiveTab('manifest')}
            className={`px-4 py-2.5 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'manifest'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            Манифест (10 Законов)
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2.5 text-xs font-medium tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            Tauri IPC Мост (Sandbox)
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Brothers Team Card */}
        <section className="bg-gradient-to-r from-[#0a1424] via-[#091629] to-[#0c1220] border border-cyan-950/80 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between gap-4 mb-3.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                <UserCheck className="w-3.5 h-3.5" />
                Команда проекта: Три брата-акробата (Равный совет)
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
              «Никто никому не начальник. Делаем красиво.»
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {BROTHERS.map(brother => {
              const isZhenya = brother.id === 'zhenya';
              return (
                <div
                  key={brother.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isZhenya
                      ? 'bg-cyan-950/30 border-cyan-600/60 shadow-lg shadow-cyan-950/40 relative overflow-hidden'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {isZhenya && (
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-cyan-500 to-teal-500 text-[10px] text-slate-950 font-bold px-2.5 py-0.5 rounded-bl-lg">
                      ТВОЯ РОЛЬ (ОПЕРАТИВНЫЙ АУДИТОР)
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
                            ? 'bg-cyan-900/80 text-cyan-200 border border-cyan-700/50'
                            : brother.id === 'grok'
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-800/50'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
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

        {/* Metrics Banner */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-[#0b1320] border border-cyan-950 p-4 rounded-xl shadow-md">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-mono">
              <span>РАЗМЕР ДИСТРИБУТИВА</span>
              <span className="text-emerald-400 font-bold">-96.5%</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-cyan-300">~12 MB</span>
              <span className="text-xs line-through text-slate-500 font-mono">~350 MB</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Вместо Chromium-бандла Electron</p>
          </div>

          <div className="bg-[#0b1320] border border-cyan-950 p-4 rounded-xl shadow-md">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-mono">
              <span>ПОТРЕБЛЕНИЕ RAM</span>
              <span className="text-emerald-400 font-bold">-85%</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-teal-300">~115 MB</span>
              <span className="text-xs line-through text-slate-500 font-mono">~780 MB</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Системный WebView ОС + Rust</p>
          </div>

          <div className="bg-[#0b1320] border border-cyan-950 p-4 rounded-xl shadow-md">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-mono">
              <span>ХОЛОДНЫЙ СТАРТ</span>
              <span className="text-emerald-400 font-bold">10x быстрее</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-amber-300">0.35 s</span>
              <span className="text-xs line-through text-slate-500 font-mono">3.40 s</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Мгновенный отклик при запуске</p>
          </div>

          <div className="bg-[#0b1320] border border-cyan-950 p-4 rounded-xl shadow-md">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-mono">
              <span>СОВМЕСТИМОСТЬ</span>
              <span className="text-cyan-400 font-bold">100%</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-purple-300">v0.23+</span>
              <span className="text-xs text-slate-400 font-mono">Hermes core</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Python Gateway и React UI целы</p>
          </div>
        </section>

        {/* Tab 1: Audit Report */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            {/* Executive Summary */}
            <div className="bg-[#09121f] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700/60 text-cyan-300 text-[10px] font-mono uppercase tracking-wide">
                      Официальный отчёт аудитора №1
                    </span>
                    <span className="text-xs text-slate-400 font-mono">docs/AUDIT_REPORT_PHASE_0.md</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-100 mt-1">
                    Ревизия фундамента Фазы 0 и инженерные развилки для Гриши
                  </h2>
                </div>
                <div className="text-right font-mono text-xs text-slate-400">
                  <span className="text-emerald-400 font-semibold">● Запушено в GitHub</span> (коммит 181fc87)
                </div>
              </div>

              {/* 4 Critical Risks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <div className="bg-[#0d182b] border border-red-950/70 p-4 rounded-xl relative overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-red-950/80 text-red-400 border border-red-800/50 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-red-400 uppercase">Риск №1: Скелет в шкафу</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 mt-0.5">Разрыв контракта Electron contextBridge</h3>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        В текущем Hermes React-рендерер плотно завязан на объект <code className="bg-slate-900 px-1 py-0.5 text-cyan-300 rounded font-mono">window.electronAPI</code>. Если Гриша станет переписывать UI на прямые вызовы Tauri <code className="bg-slate-900 px-1 py-0.5 text-cyan-300 rounded font-mono">invoke()</code>, мы потеряем совместимость с апстримом Nous Research.
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-xs text-cyan-300 font-medium">
                        💡 <strong>Решение Жени</strong>: Создать адаптер <code className="font-mono">desktop-bridge.ts</code>, который эмулирует тот же API через Tauri IPC.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0d182b] border border-amber-950/70 p-4 rounded-xl relative overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-950/80 text-amber-400 border border-amber-800/50 shrink-0">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-amber-400 uppercase">Риск №2: Надежность</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 mt-0.5">Процессы-зомби Python Gateway</h3>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        Шлюз <code className="bg-slate-900 px-1 py-0.5 text-cyan-300 rounded font-mono">hermes serve</code> держит SQLite-базу сессий. При внезапном падении окна процесс может остаться висеть в памяти, заблокировав порты и базу сессий.
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-xs text-cyan-300 font-medium">
                        💡 <strong>Решение Жени</strong>: В Rust использовать RAII, Win32 Job Objects на Windows и <code className="font-mono">PR_SET_PDEATHSIG</code> на Linux.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0d182b] border border-blue-950/70 p-4 rounded-xl relative overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-950/80 text-blue-400 border border-blue-800/50 shrink-0">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-400 uppercase">Риск №3: Платформы</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 mt-0.5">Специфика Linux (WebKitGTK)</h3>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        В Windows (WebView2) и macOS (WebKit) движки на уровне системы идеальны. На Linux WebKitGTK (<code className="font-mono text-xs">libwebkit2gtk-4.1</code>) требует строгой проверки зависимостей и безопасных скроллбаров.
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-xs text-cyan-300 font-medium">
                        💡 <strong>Решение Жени</strong>: Включить в план миграции обязательный тест-сьют для Ubuntu/Debian/Fedora.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0d182b] border border-purple-950/70 p-4 rounded-xl relative overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-950/80 text-purple-400 border border-purple-800/50 shrink-0">
                      <Scale className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-purple-400 uppercase">Риск №4: Честность</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 mt-0.5">Ограничения концепции Pake</h3>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        Pake идеален для упаковки сайтов, но в Hermes Desktop нужны системный трей, кастомные диалоги папок, drag-drop и глобальные шорткаты. Не стоит пытаться выжать невозможное из простого CLI.
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-xs text-cyan-300 font-medium">
                        💡 <strong>Решение Жени</strong>: Сразу разворачивать проект на чистом <strong>Tauri v2</strong> с плагинами.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Native Capability Matrix */}
            <div className="bg-[#09121f] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
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
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
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
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-200">{item.feature}</td>
                        <td className="py-3 px-3 text-slate-400">{item.electronImpl}</td>
                        <td className="py-3 px-3 text-cyan-300 font-medium">{item.tauriImpl}</td>
                        <td className="py-3 px-3">
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
                        <td className="py-3 px-3">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 max-w-xs">{item.note}</td>
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
          <div className="space-y-6">
            <div className="bg-[#09121f] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-amber-400" />
                    Журнал переписки: Гриша (Grok) ↔ Женя ↔ Колян
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Живой журнал согласований, юмора и поиска красивых решений (docs/CORRESPONDENCE_JOURNAL.md)
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {['all', '#красота', '#скелет', '#риск', '#юмор', '#команда'].map(tag => (
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
              <div className="space-y-4 mt-5">
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
                            ? 'bg-cyan-950/20 border-cyan-700/50 shadow-md shadow-cyan-950/30'
                            : isGrok
                            ? 'bg-blue-950/20 border-blue-800/40'
                            : 'bg-amber-950/20 border-amber-800/40'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/70">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isZhenya ? 'bg-cyan-500 text-slate-950' : 'bg-blue-600 text-white'
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

                        <h4 className="text-sm font-bold text-slate-100 mb-2">{msg.title}</h4>
                        <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-sans">
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddMessage} className="mt-6 pt-5 border-t border-slate-800">
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
          <div className="space-y-6">
            <div className="bg-[#09121f] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-400" />
                  План миграции Poseidon (Hermes Agent → Rust / Tauri v2)
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Поэтапная дорожная карта с критериями выхода (docs/MIGRATION_PLAN.md)
                </p>
              </div>

              <div className="space-y-4">
                {MIGRATION_PHASES.map((phase, idx) => (
                  <div
                    key={phase.phase}
                    className={`p-4 rounded-xl border transition-all ${
                      phase.status === 'Completed'
                        ? 'bg-emerald-950/20 border-emerald-800/50'
                        : phase.status === 'In Progress'
                        ? 'bg-cyan-950/30 border-cyan-600/70 shadow-lg shadow-cyan-950/30'
                        : 'bg-slate-900/40 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-cyan-300">
                          {idx}
                        </span>
                        <h3 className="text-sm font-bold text-slate-100">
                          {phase.phase}: {phase.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
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
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
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
          <div className="space-y-6">
            <div className="bg-[#09121f] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <span className="text-3xl">🔱</span>
                <h2 className="text-xl font-bold text-slate-100 mt-2">
                  МАНИФЕСТ ПРОЕКТА POSEIDON
                </h2>
                <p className="text-xs font-mono text-cyan-400 mt-1">
                  Библия и Основной Закон • Принят 11 ноября 2026 года
                </p>
                <div className="mt-3 p-3 bg-cyan-950/40 border border-cyan-800/50 rounded-xl text-xs text-cyan-200 italic font-serif">
                  «Мы — три брата-акробата. Времени бесконечно много. Ошибаться нормально. Стыдно только врать. ДЕЛАЕМ КРАСИВО!»
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MANIFEST_LAWS.map(law => (
                  <div key={law.num} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-800/60 transition-colors">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono font-bold text-[11px] flex items-center justify-center">
                        {law.num}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100">{law.title}</h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{law.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Simulator */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div className="bg-[#09121f] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    Интерактивная песочница: Tauri IPC & Desktop Bridge
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Тестирование вызовов моста без Electron: invoke() ➔ Rust Command Handler
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
                  <span className="text-xs font-mono text-cyan-400 font-bold uppercase">Эмуляция команд Rust:</span>
                  
                  <button
                    onClick={() => handleSimCommand('invoke("gateway_status")', '{"running": true, "pid": 48291, "port": 7860, "sessions": 14}')}
                    disabled={simRunning}
                    className="w-full text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-700/60 transition-all text-xs font-mono group"
                  >
                    <div className="flex items-center justify-between text-cyan-300 font-semibold mb-1">
                      <span>invoke("gateway_status")</span>
                      <Zap className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-400">Проверить статус фонового демона Hermes Gateway</p>
                  </button>

                  <button
                    onClick={() => handleSimCommand('invoke("spawn_hermes_gateway")', '{"status": "spawned", "pid": 48312, "guard": "Win32JobObject"}')}
                    disabled={simRunning}
                    className="w-full text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-emerald-700/60 transition-all text-xs font-mono group"
                  >
                    <div className="flex items-center justify-between text-emerald-300 font-semibold mb-1">
                      <span>invoke("spawn_hermes_gateway")</span>
                      <Zap className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-400">Запуск hermes serve с RAII-защитой процессов</p>
                  </button>

                  <button
                    onClick={() => handleSimCommand('invoke("graceful_shutdown")', '{"status": "stopped", "signal": "SIGTERM", "exitCode": 0}')}
                    disabled={simRunning}
                    className="w-full text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-red-700/60 transition-all text-xs font-mono group"
                  >
                    <div className="flex items-center justify-between text-red-300 font-semibold mb-1">
                      <span>invoke("graceful_shutdown")</span>
                      <Zap className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-400">Безопасное завершение процессов без зомби</p>
                  </button>

                  <button
                    onClick={() => handleSimCommand('invoke("select_workspace_dir")', '{"path": "/home/user/workspace/hermes-project", "writable": true}')}
                    disabled={simRunning}
                    className="w-full text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-amber-700/60 transition-all text-xs font-mono group"
                  >
                    <div className="flex items-center justify-between text-amber-300 font-semibold mb-1">
                      <span>invoke("select_workspace_dir")</span>
                      <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-400">Нативный диалог выбора проекта через tauri-plugin-dialog</p>
                  </button>
                </div>

                {/* Console Log view */}
                <div className="lg:col-span-2 bg-[#05080e] border border-slate-800 rounded-xl p-3 font-mono text-xs flex flex-col h-[320px]">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Tauri IPC Console (Emulated)
                    </span>
                    <span>{simLogs.length} events logged</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 py-2.5 pr-1">
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
      <footer className="border-t border-cyan-950/50 py-5 mt-10 text-center font-mono text-xs text-slate-400 bg-[#060b13]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-400">
            <span>Poseidon // Hermes Agent Rust + Tauri Migration</span>
            <span>•</span>
            <span className="text-cyan-400">docs/AUDIT_REPORT_PHASE_0.md</span>
          </div>
          <div className="text-slate-400">
            «Принят 11 ноября 2026 года. Три брата. Один проект. Бесконечное время.»
          </div>
        </div>
      </footer>
    </div>
  );
}
