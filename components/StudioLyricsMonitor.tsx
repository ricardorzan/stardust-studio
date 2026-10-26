'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LyricLine } from '@/types/lyrics';
import {
  Play,
  Pause,
  Pencil,
  Check,
  RotateCcw,
  Sparkles,
  Eraser,
  Clock,
  Music,
  Plus,
  Trash2,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Merge,
  MoveHorizontal,
} from 'lucide-react';

interface StudioLyricsMonitorProps {
  lyrics: LyricLine[];
  onUpdateLyrics: (newLyrics: LyricLine[]) => void;
  currentTime: number;
  audioDuration: number;
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
  isPlaying: boolean;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const StudioLyricsMonitor: React.FC<StudioLyricsMonitorProps> = ({
  lyrics,
  onUpdateLyrics,
  currentTime,
  audioDuration,
  onSeek,
  onTogglePlay,
  isPlaying,
}) => {
  const [currentSyncIndex, setCurrentSyncIndex] = useState<number>(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showOffsetTool, setShowOffsetTool] = useState<boolean>(false);
  const [offsetInput, setOffsetInput] = useState<string>('');
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Diagnóstico en vivo de marcas de tiempo
  const timingIssues: { index: number; type: 'overlap' | 'inverted' | 'gap'; desc: string }[] = [];
  for (let i = 0; i < lyrics.length - 1; i++) {
    const cur = lyrics[i];
    const nxt = lyrics[i + 1];

    if (nxt.startTime < cur.startTime) {
      timingIssues.push({
        index: i,
        type: 'inverted',
        desc: `Verso ${i + 2} (${nxt.startTime}s) inicia antes que el verso ${i + 1} (${cur.startTime}s)`,
      });
    } else if (cur.endTime > nxt.startTime + 0.05) {
      const overlap = (cur.endTime - nxt.startTime).toFixed(2);
      timingIssues.push({
        index: i,
        type: 'overlap',
        desc: `Verso ${i + 1} solapa ${overlap}s con verso ${i + 2}`,
      });
    }
  }

  // Calcular índice del verso que está sonando en este momento
  let currentActiveIndex = 0;
  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i];
    const lineEnd = line.endTime || (lyrics[i + 1] ? lyrics[i + 1].startTime : line.startTime + 4);
    if (currentTime >= line.startTime && currentTime <= lineEnd) {
      currentActiveIndex = i;
      break;
    }
    if (currentTime >= line.startTime) {
      currentActiveIndex = i;
    }
  }

  // Auto-scroll suave para mantener el verso activo a la vista
  useEffect(() => {
    if (activeRowRef.current && listContainerRef.current) {
      const container = listContainerRef.current;
      const row = activeRowRef.current;
      const topOffset = row.offsetTop - container.offsetTop;
      container.scrollTo({
        top: Math.max(0, topOffset - 80),
        behavior: 'smooth',
      });
    }
  }, [currentActiveIndex]);

  // Tap-to-sync con barra espaciadora
  const handleTapSync = useCallback(() => {
    if (lyrics.length === 0) return;

    const time = parseFloat(currentTime.toFixed(2));
    const newLyrics = [...lyrics];

    if (currentSyncIndex < newLyrics.length) {
      newLyrics[currentSyncIndex] = {
        ...newLyrics[currentSyncIndex],
        startTime: time,
      };

      if (currentSyncIndex > 0) {
        newLyrics[currentSyncIndex - 1] = {
          ...newLyrics[currentSyncIndex - 1],
          endTime: Math.max(0, time - 0.05),
        };
      }

      if (currentSyncIndex === newLyrics.length - 1) {
        newLyrics[currentSyncIndex].endTime = audioDuration > 0 ? audioDuration : time + 4;
      }

      onUpdateLyrics(newLyrics);

      if (currentSyncIndex < newLyrics.length - 1) {
        setCurrentSyncIndex((prev) => prev + 1);
      }
    }
  }, [lyrics, currentTime, currentSyncIndex, audioDuration, onUpdateLyrics]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onTogglePlay]);

  const handleFineTune = (index: number, delta: number) => {
    const newLyrics = [...lyrics];
    const item = newLyrics[index];
    const newStart = Math.max(0, parseFloat((item.startTime + delta).toFixed(2)));
    newLyrics[index] = { ...item, startTime: newStart };

    if (index > 0 && newLyrics[index - 1].endTime > newStart) {
      newLyrics[index - 1].endTime = newStart;
    }

    onUpdateLyrics(newLyrics);
  };

  const handleUpdateLineText = (index: number, field: 'original' | 'translated', value: string) => {
    const newLyrics = [...lyrics];
    newLyrics[index] = {
      ...newLyrics[index],
      [field]: value,
    };
    onUpdateLyrics(newLyrics);
  };

  const handleInsertInstrumental = (afterIndex?: number) => {
    const newLyrics = [...lyrics];
    const targetIdx = afterIndex !== undefined ? afterIndex : Math.min(currentActiveIndex, lyrics.length - 1);
    const prevLine = newLyrics[targetIdx];
    const startTime = prevLine ? (prevLine.endTime || prevLine.startTime + 3) : currentTime;
    const nextLine = newLyrics[targetIdx + 1];
    const endTime = nextLine ? nextLine.startTime : startTime + 4;

    const instrumentalLine: LyricLine = {
      id: `inst-${Date.now()}`,
      original: '♪',
      translated: '♪ Instrumental',
      startTime: parseFloat(startTime.toFixed(2)),
      endTime: parseFloat(endTime.toFixed(2)),
      isInstrumental: true,
    };

    const insertPosition = targetIdx >= 0 ? targetIdx + 1 : 0;
    newLyrics.splice(insertPosition, 0, instrumentalLine);
    onUpdateLyrics(newLyrics);
  };

  const handleDeleteLine = (index: number) => {
    if (lyrics.length <= 1) return;
    const newLyrics = lyrics.filter((_, i) => i !== index);
    onUpdateLyrics(newLyrics);
  };

  const handleAutoRepairTimestamps = () => {
    if (lyrics.length === 0) return;

    // 1. Asegurar orden cronológico estricto
    const sorted = [...lyrics].sort((a, b) => a.startTime - b.startTime);

    // 2. Normalizar endTimes para que no solapen con el siguiente verso
    const repaired: LyricLine[] = sorted.map((line, i) => {
      const nextLine = sorted[i + 1];
      const maxAllowedEnd = nextLine ? nextLine.startTime : (audioDuration > 0 ? audioDuration : line.startTime + 4);

      let newEnd = line.endTime;
      if (!newEnd || newEnd <= line.startTime || newEnd > maxAllowedEnd) {
        newEnd = parseFloat(Math.max(line.startTime + 0.8, nextLine ? nextLine.startTime - 0.05 : line.startTime + 4).toFixed(2));
      }

      return {
        ...line,
        startTime: parseFloat(line.startTime.toFixed(2)),
        endTime: parseFloat(newEnd.toFixed(2)),
      };
    });

    onUpdateLyrics(repaired);
  };

  const handleRemoveAllTrailingPeriods = () => {
    const cleaned = lyrics.map((line) => ({
      ...line,
      original: line.original.replace(/\.+$/, '').trim(),
      translated: line.translated.replace(/\.+$/, '').trim(),
    }));
    onUpdateLyrics(cleaned);
  };

  const handleAutoDistribute = () => {
    if (lyrics.length === 0 || audioDuration <= 0) return;
    const interval = audioDuration / lyrics.length;
    const distributed = lyrics.map((line, i) => ({
      ...line,
      startTime: parseFloat((i * interval).toFixed(2)),
      endTime: parseFloat(((i + 1) * interval).toFixed(2)),
    }));
    onUpdateLyrics(distributed);
  };

  // Extender un verso específico para que su endTime conecte con el startTime del siguiente
  const handleExtendToNextLine = (idx: number) => {
    if (idx < 0 || idx >= lyrics.length - 1) return;
    const nxt = lyrics[idx + 1];
    const newEnd = parseFloat(nxt.startTime.toFixed(2));
    const updated = lyrics.map((l, i) => (i === idx ? { ...l, endTime: newEnd } : l));
    onUpdateLyrics(updated);
  };

  // Desplazar todos los versos por un offset en segundos (+/-)
  const handleApplyOffset = (offsetSeconds: number) => {
    if (lyrics.length === 0 || isNaN(offsetSeconds) || offsetSeconds === 0) return;

    const updated = lyrics.map((line) => {
      const newStart = Math.max(0, parseFloat((line.startTime + offsetSeconds).toFixed(2)));
      const duration = Math.max(0.5, line.endTime - line.startTime);
      const newEnd = parseFloat((newStart + duration).toFixed(2));
      return {
        ...line,
        startTime: newStart,
        endTime: newEnd,
      };
    });

    onUpdateLyrics(updated);
  };

  // Alinear el inicio del primer verso a la posición actual de reproducción
  const handleAlignToCurrentPlayback = () => {
    if (lyrics.length === 0 || currentTime <= 0) return;
    const firstLine = lyrics[0];
    const delta = parseFloat((currentTime - firstLine.startTime).toFixed(2));
    if (Math.abs(delta) < 0.05) return;
    handleApplyOffset(delta);
  };

  // Unir transiciones continuas de toda la canción (cerrar pausas < 3.5s)
  const handleSnapAllContinuousTransitions = () => {
    let fixedCount = 0;
    const updated = lyrics.map((line, idx) => {
      const next = lyrics[idx + 1];
      if (!next || line.isInstrumental) return line;
      const gap = next.startTime - line.endTime;
      if (gap > 0.05 && gap <= 3.5) {
        fixedCount++;
        return {
          ...line,
          endTime: parseFloat(next.startTime.toFixed(2)),
        };
      }
      return line;
    });

    if (fixedCount > 0) {
      onUpdateLyrics(updated);
    }
  };

  // Mezclar dos versos (el actual con el siguiente) en texto y duración
  const handleMergeWithNextLine = (index: number) => {
    if (index < 0 || index >= lyrics.length - 1) return;
    const cur = lyrics[index];
    const nxt = lyrics[index + 1];

    const mergedOriginal = [cur.original.trim(), nxt.original.trim()].filter(Boolean).join(' ');
    const mergedTranslated = [cur.translated.trim(), nxt.translated.trim()].filter(Boolean).join(' ');
    const newStart = cur.startTime;
    const newEnd = parseFloat(Math.max(cur.endTime, nxt.endTime).toFixed(2));

    const updated = [...lyrics];
    updated[index] = {
      ...cur,
      original: mergedOriginal,
      translated: mergedTranslated,
      startTime: newStart,
      endTime: newEnd,
      isInstrumental: Boolean(cur.isInstrumental && nxt.isInstrumental),
    };
    updated.splice(index + 1, 1);

    onUpdateLyrics(updated);
  };

  // Desplazar todos los versos por un offset en segundos (+/-)
  const handleApplyOffset = (offsetSeconds: number) => {
    if (lyrics.length === 0 || isNaN(offsetSeconds) || offsetSeconds === 0) return;

    const updated = lyrics.map((line) => {
      const newStart = Math.max(0, parseFloat((line.startTime + offsetSeconds).toFixed(2)));
      const duration = Math.max(0.5, line.endTime - line.startTime);
      const newEnd = parseFloat((newStart + duration).toFixed(2));
      return {
        ...line,
        startTime: newStart,
        endTime: newEnd,
      };
    });

    onUpdateLyrics(updated);
  };

  // Alinear el inicio del primer verso a la posición actual de reproducción
  const handleAlignToCurrentPlayback = () => {
    if (lyrics.length === 0 || currentTime <= 0) return;
    const firstLine = lyrics[0];
    const delta = parseFloat((currentTime - firstLine.startTime).toFixed(2));
    if (Math.abs(delta) < 0.05) return;
    handleApplyOffset(delta);
  };

  return (
    <div className="bg-[#12141a] border border-zinc-800 rounded-2xl flex flex-col h-full text-zinc-100 shadow-xl overflow-hidden">
      {/* Cabecera del Monitor de Letras */}
      <div className="p-3.5 px-4 bg-[#181a22] border-b border-zinc-800/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100 font-display">
            Guión & Sincronización Lírica
          </h3>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
            {lyrics.length} versos
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleSnapAllContinuousTransitions}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-md transition flex items-center gap-1 border border-emerald-500/30 cursor-pointer font-bold"
            title="Unir transiciones continuas (cerrar pausas cortas < 3.5s)"
          >
            <Clock className="w-3 h-3 text-emerald-400" />
            <span>Unir Transiciones</span>
          </button>

          <button
            type="button"
            onClick={() => handleInsertInstrumental()}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-md transition flex items-center gap-1 border border-emerald-500/30 cursor-pointer font-bold"
            title="Insertar pausa instrumental ♪ en la posición actual"
          >
            <Music className="w-3 h-3" />
            <span>+ ♪ Interludio</span>
          </button>

          <button
            type="button"
            onClick={handleRemoveAllTrailingPeriods}
            className="text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 px-2 py-1 rounded-md transition flex items-center gap-1 border border-zinc-700/50 cursor-pointer"
            title="Quitar puntos finales de todos los versos"
          >
            <Eraser className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Sin puntos</span>
          </button>

          <button
            type="button"
            onClick={handleAutoDistribute}
            className="text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 px-2 py-1 rounded-md transition border border-zinc-700/50 cursor-pointer"
            title="Repartir tiempos equitativamente en la duración del audio"
          >
            Auto-repartir
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentSyncIndex(0);
              onSeek(0);
            }}
            className="text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 p-1 rounded-md transition border border-zinc-700/50 cursor-pointer"
            title="Reiniciar índice de sincronización al inicio"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Barra de Diagnóstico en Vivo de Marcas de Tiempo */}
      {timingIssues.length > 0 && (
        <div className="p-2.5 px-4 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2 truncate">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
            <span className="font-semibold truncate">
              {timingIssues.length} {timingIssues.length === 1 ? 'marca solapada' : 'marcas solapadas'} detectadas: causan cortes o parpadeo.
            </span>
          </div>

          <button
            type="button"
            onClick={handleAutoRepairTimestamps}
            className="bg-amber-400 hover:bg-amber-300 text-black font-bold text-[11px] px-2.5 py-1 rounded-lg transition flex items-center gap-1 flex-shrink-0 cursor-pointer shadow-sm"
            title="Ajusta automáticamente los tiempos finales para eliminar solapamientos"
          >
            <Wrench className="w-3 h-3" />
            <span>Auto-Reparar Tiempos</span>
          </button>
        </div>
      )}

      {/* Lista de Versos con Scroll y Resaltado de Verso Activo */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[300px] max-h-[380px] sm:max-h-[440px] pr-2 scrollbar-thin scrollbar-thumb-zinc-700"
      >
        {lyrics.map((line, idx) => {
          const isActive = idx === currentActiveIndex;
          const isTargetSync = idx === currentSyncIndex;
          const isEditing = editingIndex === idx;
          const isInstrumental = line.isInstrumental || line.original.trim() === '♪';
          const lineIssue = timingIssues.find((iss) => iss.index === idx);
          const nextLine = lyrics[idx + 1];
          const gapBeforeNext = nextLine ? parseFloat((nextLine.startTime - line.endTime).toFixed(2)) : 0;

          return (
            <div
              key={line.id || idx}
              ref={isActive ? activeRowRef : null}
              onClick={() => onSeek(line.startTime)}
              className={`p-3 rounded-xl transition-all duration-150 border cursor-pointer ${
                isActive
                  ? 'bg-[#18231c] border-emerald-500/80 shadow-md ring-1 ring-emerald-500/30'
                  : lineIssue
                  ? 'bg-amber-950/20 border-amber-500/50 text-zinc-300'
                  : isTargetSync
                  ? 'bg-zinc-800/50 border-amber-500/50 text-zinc-300'
                  : isInstrumental
                  ? 'bg-[#131a1f]/60 border-emerald-900/40 text-emerald-300/80 hover:bg-[#162128]'
                  : 'bg-[#151720]/80 border-zinc-800/60 text-zinc-400 hover:bg-[#1a1d27] hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5 ${
                      isActive
                        ? 'bg-emerald-500 text-black font-black'
                        : lineIssue
                        ? 'bg-amber-400 text-black font-black'
                        : isTargetSync
                        ? 'bg-amber-500 text-black'
                        : isInstrumental
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {isInstrumental ? '♪' : idx + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={line.original}
                          onChange={(e) => handleUpdateLineText(idx, 'original', e.target.value)}
                          className="w-full bg-black/60 border border-zinc-700 rounded-lg p-1.5 text-xs text-zinc-200 font-mono"
                          placeholder="Verso en inglés o ♪..."
                        />
                        <input
                          type="text"
                          value={line.translated}
                          onChange={(e) => handleUpdateLineText(idx, 'translated', e.target.value)}
                          className="w-full bg-black/60 border border-zinc-700 rounded-lg p-1.5 text-xs text-emerald-400 font-mono"
                          placeholder="Traducción en español..."
                        />
                      </div>
                    ) : isInstrumental ? (
                      <div className="flex items-center gap-2">
                        <Music className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
                        <span className={`text-xs font-bold tracking-wider ${isActive ? 'text-emerald-300' : 'text-zinc-400'}`}>
                          Solo / Interludio Instrumental
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ({Math.max(0, (line.endTime || line.startTime + 4) - line.startTime).toFixed(1)}s)
                        </span>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`text-sm font-bold tracking-tight leading-snug truncate ${
                            isActive ? 'text-white' : 'text-zinc-300'
                          }`}
                        >
                          {line.translated || line.original}
                        </div>
                        {line.translated && (
                          <div className="text-xs text-zinc-500 mt-0.5 truncate font-normal">
                            {line.original}
                          </div>
                        )}
                        {lineIssue && (
                          <div className="text-[10px] text-amber-400 flex items-center gap-1 mt-1 font-mono font-medium">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span>{lineIssue.desc}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Controles de Tiempo, Interludio, Unir, Mezclar y Edición */}
                <div
                  className="flex items-center gap-1.5 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Botón Unir si hay separación con el siguiente verso */}
                  {gapBeforeNext > 0.15 && (
                    <button
                      type="button"
                      onClick={() => handleExtendToNextLine(idx)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono text-amber-300 hover:text-black hover:bg-amber-400 bg-amber-500/15 border border-amber-500/30 transition cursor-pointer flex items-center gap-1 font-semibold"
                      title={`Extender fin hasta ${nextLine.startTime.toFixed(2)}s (eliminar pausa de ${gapBeforeNext.toFixed(1)}s)`}
                    >
                      <span>Unir</span>
                      <span className="text-[9px] opacity-75">({gapBeforeNext.toFixed(1)}s)</span>
                    </button>
                  )}

                  {/* Botón Mezclar con el verso siguiente */}
                  {idx < lyrics.length - 1 && (
                    <button
                      type="button"
                      onClick={() => handleMergeWithNextLine(idx)}
                      className="p-1 rounded-md text-zinc-400 hover:text-emerald-400 bg-zinc-800/80 hover:bg-zinc-700 transition cursor-pointer"
                      title={`Mezclar con verso #${idx + 2} (unir letras y duración)`}
                    >
                      <Merge className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleInsertInstrumental(idx)}
                    className="p-1 rounded-md text-zinc-400 hover:text-emerald-400 bg-zinc-800/80 hover:bg-zinc-700 transition cursor-pointer"
                    title="Insertar interludio ♪ después de este verso"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingIndex(isEditing ? null : idx)}
                    className="p-1 rounded-md text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 transition cursor-pointer"
                    title={isEditing ? 'Guardar edición' : 'Editar texto del verso'}
                  >
                    {isEditing ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Pencil className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteLine(idx)}
                    className="p-1 rounded-md text-zinc-500 hover:text-rose-400 bg-zinc-800/80 hover:bg-zinc-700 transition cursor-pointer"
                    title="Eliminar este verso"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <span className="font-mono text-[10px] text-zinc-300 bg-black/40 px-2 py-1 rounded-md border border-zinc-800" title={`Duración: ${(line.endTime - line.startTime).toFixed(2)}s`}>
                    {line.startTime.toFixed(1)}s → {line.endTime.toFixed(1)}s
                  </span>

                  <button
                    type="button"
                    onClick={() => handleFineTune(idx, -0.1)}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 cursor-pointer"
                    title="Adelantar 100ms"
                  >
                    -0.1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFineTune(idx, 0.1)}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 cursor-pointer"
                    title="Retrasar 100ms"
                  >
                    +0.1
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra Inferior del Monitor: Reproducción y Pausa */}
      <div className="p-3 bg-[#181a22] border-t border-zinc-800/80 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-black'
              : 'bg-emerald-500 hover:bg-emerald-400 text-black'
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{isPlaying ? 'Pausar Reproducción' : 'Reproducir Audio / Video'}</span>
          <span className="px-1.5 py-0.5 bg-black/20 text-black/80 rounded font-mono text-[10px] font-black tracking-wide ml-1">
            ESPACIO
          </span>
        </button>

        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/80 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-300 flex-shrink-0">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span>{formatTime(currentTime)}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-500">{formatTime(audioDuration)}</span>
        </div>
      </div>
    </div>
  );
};
