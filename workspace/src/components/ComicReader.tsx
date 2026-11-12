import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LayoutGrid,
  Maximize2,
  X,
  Volume2,
  BookOpenCheck
} from 'lucide-react';
import { COMIC_FRAMES, ComicFrame } from '../data/comicData';

interface ComicReaderProps {
  onClose?: () => void;
  isModal?: boolean;
}

export default function ComicReader({ onClose, isModal = false }: ComicReaderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'reader' | 'grid'>('reader');

  const currentFrame = COMIC_FRAMES[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : COMIC_FRAMES.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < COMIC_FRAMES.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className={`flex flex-col bg-[#050810] text-slate-100 ${isModal ? 'h-full' : 'rounded-2xl border border-cyan-950/80 shadow-2xl p-4 sm:p-6'}`}>
      {/* Comic Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-cyan-950/90 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-cyan-400 to-teal-500 p-[1.5px] shadow-md shadow-amber-950/50">
            <div className="w-full h-full bg-[#070c14] rounded-[10px] flex items-center justify-center text-amber-300 text-base font-bold">
              🎨
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                РОЖДЕНИЕ ПОСЕЙДОНА
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase">
                  8 Кадров
                </span>
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Стиль: Киберпанк + Ван Гог + Гауди • Хроника восшествия Владыки Кода
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('reader')}
              className={`px-3 py-1 rounded-md font-mono flex items-center gap-1.5 transition-colors ${
                viewMode === 'reader'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Листать
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-md font-mono flex items-center gap-1.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Все кадры
            </button>
          </div>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Reader View */}
      {viewMode === 'reader' && (
        <div className="flex-1 flex flex-col space-y-4">
          {/* Frame Stage */}
          <div className="relative rounded-2xl overflow-hidden border border-cyan-900/60 bg-black/60 shadow-2xl group flex items-center justify-center aspect-[16/9] max-h-[520px]">
            <img
              src={currentFrame.image}
              alt={currentFrame.title}
              className="w-full h-full object-contain select-none"
            />

            {/* Act & Number Tag */}
            <div className="absolute top-3 left-3 bg-[#060a12]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-700/50 text-xs font-mono flex items-center gap-2 shadow-lg">
              <span className="text-amber-400 font-bold">{currentFrame.act}</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-300 font-bold">{currentIndex + 1} / {COMIC_FRAMES.length}</span>
            </div>

            {/* Navigation Arrows on Hover */}
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 hover:bg-cyan-500 hover:text-slate-950 border border-slate-700 text-slate-200 transition-all opacity-80 group-hover:opacity-100 shadow-xl"
              title="Предыдущий кадр (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 hover:bg-cyan-500 hover:text-slate-950 border border-slate-700 text-slate-200 transition-all opacity-80 group-hover:opacity-100 shadow-xl"
              title="Следующий кадр (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Description & Speech Bubble Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Story narration */}
            <div className="md:col-span-2 p-4 rounded-xl bg-[#091220] border border-cyan-950/80 space-y-2">
              <div className="flex items-center gap-2">
                <BookOpenCheck className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100 font-mono uppercase tracking-wide">
                  {currentFrame.title}
                </h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {currentFrame.caption}
              </p>
              <p className="text-[11px] text-slate-400 italic">
                🎨 {currentFrame.notes}
              </p>
            </div>

            {/* Dialogue Speech Bubble */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/30 to-[#0e1726] border border-amber-600/50 relative overflow-hidden flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-mono font-bold uppercase mb-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                Реплика / Диалог:
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-amber-800/40 text-xs text-amber-200/90 font-serif italic leading-snug">
                {currentFrame.dialogue}
              </div>
            </div>
          </div>

          {/* Thumbnail Ribbon */}
          <div className="pt-2 border-t border-slate-900/90">
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
              {COMIC_FRAMES.map((f, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <button
                    key={f.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`shrink-0 w-24 rounded-lg overflow-hidden border-2 transition-all relative group text-left ${
                      isActive
                        ? 'border-cyan-400 shadow-md shadow-cyan-950/80 scale-105'
                        : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="aspect-[16/9] w-full bg-slate-950">
                      <img src={f.image} alt={f.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-1 bg-[#070d18] text-[9px] font-mono truncate text-slate-300">
                      {idx + 1}. {f.title}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto max-h-[700px] pr-1">
          {COMIC_FRAMES.map((f, idx) => (
            <div
              key={f.id}
              onClick={() => {
                setCurrentIndex(idx);
                setViewMode('reader');
              }}
              className="cursor-pointer rounded-xl overflow-hidden border border-slate-800 bg-[#09111e] hover:border-cyan-600 transition-all group flex flex-col"
            >
              <div className="aspect-[16/9] w-full bg-black relative overflow-hidden">
                <img
                  src={f.image}
                  alt={f.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-1.5 left-1.5 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-amber-300">
                  #{idx + 1}
                </div>
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between space-y-1.5">
                <h4 className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition-colors truncate">
                  {f.title}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  {f.caption}
                </p>
                <div className="text-[10px] text-amber-300/90 font-serif italic line-clamp-1 pt-1 border-t border-slate-800/80">
                  {f.dialogue}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
