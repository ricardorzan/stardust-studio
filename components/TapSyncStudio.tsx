'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LyricLine } from '@/types/lyrics';
import { RotateCcw, Pencil, Check, Eraser } from 'lucide-react';

interface TapSyncStudioProps {
  lyrics: LyricLine[];
  onUpdateLyrics: (newLyrics: LyricLine[]) => void;
  audioDuration: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentTime: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
}

export const TapSyncStudio: React.FC<TapSyncStudioProps> = ({
  lyrics,
  onUpdateLyrics,
  audioDuration,
  currentTime,
  onSeek,
}) => {
  const [currentSyncIndex, setCurrentSyncIndex] = useState<number>(0);
  const [isSpaceActive, setIsSpaceActive] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const handleTapSync = useCallback(() => {
    if (lyrics.length === 0) return;

    const time = parseFloat(currentTime.toFixed(2));
    const newLyrics = [...lyrics];

    // Asignar el startTime al verso actual
    if (currentSyncIndex < newLyrics.length) {
      newLyrics[currentSyncIndex] = {
        ...newLyrics[currentSyncIndex],
        startTime: time,
      };

      // Si había un verso anterior, fijar su endTime justo en este timestamp
      if (currentSyncIndex > 0) {
        newLyrics[currentSyncIndex - 1] = {
          ...newLyrics[currentSyncIndex - 1],
          endTime: Math.max(0, time - 0.05),
        };
      }

      // Si es el último verso, ponerle endTime al final de la canción
      if (currentSyncIndex === newLyrics.length - 1) {
        newLyrics[currentSyncIndex].endTime = audioDuration > 0 ? audioDuration : time + 4;
      }

      onUpdateLyrics(newLyrics);

      // Avanzar al siguiente verso
      if (currentSyncIndex < newLyrics.length - 1) {
        setCurrentSyncIndex((prev) => prev + 1);
      }
    }
  }, [lyrics, currentTime, currentSyncIndex, audioDuration, onUpdateLyrics]);

  // Escuchar la barra espaciadora para sincronizar
  // El atajo de barra espaciadora para tap-sync fue deshabilitado para evitar alterar marcas de tiempo por accidente

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

  const handleUpdateLineText = (
    index: number,
    field: 'original' | 'translated',
    value: string
  ) => {
    const newLyrics = [...lyrics];
    newLyrics[index] = {
      ...newLyrics[index],
      [field]: value,
    };
    onUpdateLyrics(newLyrics);
  };

  const handleRemoveAllTrailingPeriods = () => {
    const cleaned = lyrics.map((line) => ({
      ...line,
      original: line.original.replace(/\.+$/, '').trim(),
      translated: line.translated.replace(/\.+$/, '').trim(),
    }));
    onUpdateLyrics(cleaned);
  };

  const handleResetSync = () => {
    setCurrentSyncIndex(0);
    onSeek(0);
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

  const currentLine = lyrics[currentSyncIndex];
  const nextLine = lyrics[currentSyncIndex + 1];

  return (
    <div className="dp-card p-5 flex flex-col gap-4 text-zinc-100">
      {/* Cabecera del Tap Studio */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2 text-zinc-100 font-display">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            Tap-to-Sync Studio
          </h3>
          <p className="text-[13px] text-zinc-400 mt-0.5">
            Presiona la <strong className="text-emerald-400 font-semibold">Barra Espaciadora</strong> o el botón
            cada vez que comience un verso en la canción.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRemoveAllTrailingPeriods}
            className="dp-btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1.5"
            title="Eliminar cualquier punto final en versos y traducciones"
          >
            <Eraser className="w-3.5 h-3.5 text-emerald-400" />
            <span>Quitar puntos finales</span>
          </button>
          <button
            type="button"
            onClick={handleAutoDistribute}
            className="dp-btn-secondary text-xs px-3 py-1.5"
            title="Repartir tiempos equitativamente"
          >
            Auto-Repartir
          </button>
          <button
            type="button"
            onClick={handleResetSync}
            className="dp-btn-secondary text-xs p-2"
            title="Reiniciar sincronización"
          >
            <RotateCcw className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Tarjeta de Verso Activo por Sincronizar / Editar */}
      {currentLine ? (
        <div
          className={`p-4 rounded-xl border transition-all duration-150 ${
            isSpaceActive
              ? 'bg-[#10b981]/10 border-emerald-400 ring-2 ring-[#10b981]/20'
              : 'bg-zinc-800 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px]">
              Verso {currentSyncIndex + 1} de {lyrics.length}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">Tiempo: {currentTime.toFixed(2)}s</span>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition ${
                  isEditing
                    ? 'bg-emerald-400 text-white border-emerald-400 shadow-sm'
                    : 'bg-[#12151f] text-zinc-100 border-zinc-800 hover:bg-[#f0f2f5]'
                }`}
                title={isEditing ? 'Guardar y cerrar edición' : 'Editar texto original o traducción de este verso'}
              >
                {isEditing ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Listo</span>
                  </>
                ) : (
                  <>
                    <Pencil className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Editar texto</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Modo Edición Directa de Verso */}
          {isEditing ? (
            <div className="space-y-3 my-2.5 bg-[#12151f] p-3.5 rounded-xl border border-zinc-800 shadow-sm">
              <div>
                <label className="block text-[11px] font-bold text-zinc-100 uppercase tracking-wider mb-1">
                  Verso Original (Inglés):
                </label>
                <input
                  type="text"
                  value={currentLine.original}
                  onChange={(e) => handleUpdateLineText(currentSyncIndex, 'original', e.target.value)}
                  className="dp-input w-full p-2.5 text-xs font-mono rounded-lg"
                  placeholder="Escribe el verso en inglés..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-zinc-100 uppercase tracking-wider">
                    Traducción (Español):
                  </label>
                  {currentLine.translated.endsWith('.') && (
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateLineText(
                          currentSyncIndex,
                          'translated',
                          currentLine.translated.replace(/\.+$/, '').trim()
                        )
                      }
                      className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Eraser className="w-3 h-3" /> Quitar punto final
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={currentLine.translated}
                  onChange={(e) => handleUpdateLineText(currentSyncIndex, 'translated', e.target.value)}
                  className="dp-input w-full p-2.5 text-xs font-mono rounded-lg"
                  placeholder="Escribe la traducción en español..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-0.5 my-2">
              <p className="text-[12px] text-zinc-400 font-normal">
                {currentLine.original}
              </p>
              <p className="text-lg font-bold font-display text-zinc-100 tracking-tight">
                {currentLine.translated || currentLine.original}
              </p>
            </div>
          )}

          {nextLine && !isEditing && (
            <div className="mt-3 pt-2.5 border-t border-zinc-800 text-[12px] text-zinc-400 flex items-center gap-2">
              <span className="text-[#8a92a1] font-semibold text-[11px] uppercase tracking-wider">SIGUIENTE:</span>
              <span className="truncate">{nextLine.original} ({nextLine.translated})</span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 text-center text-zinc-400 bg-zinc-800 rounded-xl border border-zinc-800 text-xs">
          No hay versos para sincronizar. Pega la letra primero.
        </div>
      )}

      {/* Botón Gigante Tap-to-Sync */}
      <button
        type="button"
        onClick={handleTapSync}
        className={`dp-btn-primary w-full py-3.5 px-6 text-sm font-semibold tracking-wide shadow-md ${
          isSpaceActive ? 'scale-98 brightness-95' : ''
        }`}
      >
        <span className="px-2 py-0.5 bg-[#12151f]/20 rounded text-[11px] font-mono font-bold tracking-wider">SPACE</span>
        <span>¡Marcar Verso Actual! (Tap)</span>
      </button>

      {/* Lista Rápida de Versos con Micro-Ajustes y Edición */}
      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 mt-1 text-xs">
        {lyrics.map((line, idx) => {
          const isSelected = idx === currentSyncIndex;
          return (
            <div
              key={line.id || idx}
              onClick={() => setCurrentSyncIndex(idx)}
              className={`p-2.5 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition border ${
                isSelected
                  ? 'bg-[#10b981]/8 border-emerald-400 text-zinc-100'
                  : 'bg-zinc-800/70 border-transparent text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <span
                  className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] ${
                    isSelected ? 'bg-emerald-400 text-white' : 'bg-[#dde0e6] text-zinc-400'
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="truncate">
                  <div className="font-semibold text-zinc-100 truncate text-[13px]">
                    {line.original}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">{line.translated}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSyncIndex(idx);
                    setIsEditing(true);
                  }}
                  className="dp-btn-secondary px-2 py-0.5 text-[11px] flex items-center gap-1"
                  title="Editar letra en inglés o traducción en español de este verso"
                >
                  <Pencil className="w-3 h-3 text-emerald-400" />
                  <span className="hidden sm:inline">Editar</span>
                </button>
                <span className="font-mono text-[11px] text-zinc-400 bg-[#12151f] px-2 py-0.5 rounded border border-zinc-800">
                  {line.startTime.toFixed(2)}s - {line.endTime.toFixed(2)}s
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFineTune(idx, -0.1);
                  }}
                  className="dp-btn-secondary px-2 py-0.5 text-[11px] font-mono"
                  title="Restar 100ms"
                >
                  -0.1s
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFineTune(idx, 0.1);
                  }}
                  className="dp-btn-secondary px-2 py-0.5 text-[11px] font-mono"
                  title="Sumar 100ms"
                >
                  +0.1s
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
