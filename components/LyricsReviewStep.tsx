'use client';

import React, { useState, useMemo, useRef } from 'react';
import { LyricLine } from '@/types/lyrics';
import {
  Play,
  Pause,
  Sparkles,
  RefreshCw,
  Search,
  Replace,
  Plus,
  Trash2,
  Music,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Wand2,
  Rewind,
  FastForward,
  Upload,
  Link2,
  Loader2,
  FileJson,
  Clock,
  ArrowRightLeft,
  Merge,
  MoveHorizontal,
  Pencil,
  Check,
} from 'lucide-react';

interface LyricsReviewStepProps {
  lyrics: LyricLine[];
  onUpdateLyrics: (newLyrics: LyricLine[]) => void;
  songInfo: { title: string; artist: string; coverUrl?: string };
  audioUrl: string;
  audioDuration: number;
  currentTime: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onProceedToEditor: () => void;
  onBackToSearch: () => void;
  onAudioUpload?: (file: File) => void;
  onAudioUrlAttached?: (audioUrl: string) => void;
  onSaveProject?: () => void;
}

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const LyricsReviewStep: React.FC<LyricsReviewStepProps> = ({
  lyrics,
  onUpdateLyrics,
  songInfo,
  audioUrl,
  audioDuration,
  currentTime,
  isPlaying,
  onTogglePlay,
  onSeek,
  onProceedToEditor,
  onBackToSearch,
  onAudioUpload,
  onAudioUrlAttached,
  onSaveProject,
}) => {
  const [filterText, setFilterText] = useState('');
  const [showSearchReplace, setShowSearchReplace] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [searchTarget, setSearchTarget] = useState<'translated' | 'original'>('translated');
  const [showOffsetTool, setShowOffsetTool] = useState(false);
  const [offsetInput, setOffsetInput] = useState('');
  const [autoSyncCoros, setAutoSyncCoros] = useState(true);
  const [translatingLineId, setTranslatingLineId] = useState<string | null>(null);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [activeChorusFilterKey, setActiveChorusFilterKey] = useState<string | null>(null);
  const [editingTimeLineId, setEditingTimeLineId] = useState<string | null>(null);

  // Estados para vincular audio si no está presente
  const [fallbackUrlInput, setFallbackUrlInput] = useState('');
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);
  const [audioAttachError, setAudioAttachError] = useState<string | null>(null);

  const audioUploadInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Mapear repeticiones por texto original normalizado
  const repetitionsMap = useMemo(() => {
    const map = new Map<string, { count: number; indices: number[] }>();
    lyrics.forEach((line, index) => {
      const key = normalizeKey(line.original);
      if (!key) return;
      const current = map.get(key) || { count: 0, indices: [] };
      current.count += 1;
      current.indices.push(index);
      map.set(key, current);
    });
    return map;
  }, [lyrics]);

  // Verso activo en reproducción actual
  const activeLineIndex = useMemo(() => {
    if (!audioUrl || lyrics.length === 0) return -1;
    // 1. Coincidencia exacta dentro del intervalo [startTime, endTime]
    const exact = lyrics.findIndex((l) => currentTime >= l.startTime && currentTime <= l.endTime);
    if (exact !== -1) return exact;
    // 2. Si currentTime está en la brecha entre el verso y el siguiente
    for (let i = 0; i < lyrics.length; i++) {
      const cur = lyrics[i];
      const next = lyrics[i + 1];
      if (currentTime >= cur.startTime && (!next || currentTime < next.startTime)) {
        return i;
      }
    }
    return -1;
  }, [lyrics, currentTime, audioUrl]);

  const activeLine = activeLineIndex !== -1 ? lyrics[activeLineIndex] : null;
  const nextLineOfActive = activeLineIndex !== -1 && activeLineIndex + 1 < lyrics.length ? lyrics[activeLineIndex + 1] : null;

  // Extender un verso específico para que su endTime conecte con el startTime del siguiente
  const handleExtendToNextLine = (lineId: string) => {
    const idx = lyrics.findIndex((l) => l.id === lineId);
    if (idx === -1 || idx >= lyrics.length - 1) return;
    const cur = lyrics[idx];
    const nxt = lyrics[idx + 1];
    const newEnd = parseFloat(nxt.startTime.toFixed(2));
    const updated = lyrics.map((l, i) => (i === idx ? { ...l, endTime: newEnd } : l));
    onUpdateLyrics(updated);
    showToast(`Verso #${idx + 1} extendido hasta ${newEnd}s (unido con verso #${idx + 2}).`);
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
      showToast(`Se unieron ${fixedCount} versos para transiciones continuas sin cortes.`);
    } else {
      showToast('Todos los versos ya tienen transiciones continuas o pausas instrumentales largas.');
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
    showToast(`Versos #${index + 1} y #${index + 2} mezclados con éxito.`);
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
    showToast(`Versos desplazados ${offsetSeconds > 0 ? '+' : ''}${offsetSeconds}s con éxito.`);
  };

  // Alinear el inicio del primer verso a la posición actual de reproducción
  const handleAlignToCurrentPlayback = () => {
    if (lyrics.length === 0 || currentTime <= 0) return;
    const firstLine = lyrics[0];
    const delta = parseFloat((currentTime - firstLine.startTime).toFixed(2));
    if (Math.abs(delta) < 0.05) {
      showToast('Los versos ya están alineados con el segundo actual.');
      return;
    }
    handleApplyOffset(delta);
    showToast(`Todos los versos alineados al segundo ${currentTime.toFixed(2)}s (${delta > 0 ? '+' : ''}${delta}s).`);
  };

  // Actualizar un campo específico de una línea
  const handleUpdateLine = (id: string, field: 'original' | 'translated', value: string) => {
    const targetLine = lyrics.find((l) => l.id === id);
    if (!targetLine) return;

    if (field === 'translated' && autoSyncCoros) {
      const key = normalizeKey(targetLine.original);
      const rep = repetitionsMap.get(key);
      if (rep && rep.count > 1) {
        const updated = lyrics.map((l) => {
          if (normalizeKey(l.original) === key) {
            return { ...l, translated: value };
          }
          return l;
        });
        onUpdateLyrics(updated);
        return;
      }
    }

    const updated = lyrics.map((l) => (l.id === id ? { ...l, [field]: value } : l));
    onUpdateLyrics(updated);
  };

  // Sincronizar traducción de un verso a todas sus apariciones en el coro
  const handleSyncChorusOccurrences = (line: LyricLine) => {
    const key = normalizeKey(line.original);
    const rep = repetitionsMap.get(key);
    if (!rep || rep.count <= 1) return;

    const newLyrics = lyrics.map((l) => {
      if (normalizeKey(l.original) === key) {
        return { ...l, translated: line.translated };
      }
      return l;
    });

    onUpdateLyrics(newLyrics);
    showToast(`Traducción sincronizada en las ${rep.count} apariciones del coro.`);
  };

  // Buscar y Reemplazar globalmente
  const handleExecuteReplace = () => {
    if (!searchTerm.trim()) return;

    let matchCount = 0;
    const newLyrics = lyrics.map((line) => {
      const text = line[searchTarget];
      if (text.includes(searchTerm)) {
        matchCount++;
        const replaced = text.split(searchTerm).join(replaceTerm);
        return { ...line, [searchTarget]: replaced };
      }
      return line;
    });

    if (matchCount > 0) {
      onUpdateLyrics(newLyrics);
      showToast(`Se reemplazaron ${matchCount} apariciones de "${searchTerm}".`);
      setSearchTerm('');
      setReplaceTerm('');
      setShowSearchReplace(false);
    } else {
      showToast(`No se encontraron coincidencias para "${searchTerm}".`);
    }
  };

  // Re-traducir un solo verso con Gemini
  const handleTranslateSingleLine = async (line: LyricLine) => {
    if (!line.original.trim()) return;
    setTranslatingLineId(line.id);

    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawLyrics: line.original }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error traduciendo verso');

      const translatedLine = data.lyrics?.[0]?.translated || data.lines?.[0]?.translated;
      if (translatedLine) {
        handleUpdateLine(line.id, 'translated', translatedLine);
        showToast('Verso re-traducido con éxito.');
      }
    } catch (err: unknown) {
      const error = err as Error;
      showToast(`Error: ${error.message}`);
    } finally {
      setTranslatingLineId(null);
    }
  };

  // Re-traducir toda la letra con Gemini
  const handleTranslateAll = async () => {
    if (lyrics.length === 0) return;
    setIsTranslatingAll(true);
    showToast('Re-traduciendo todos los versos con Gemini...');

    try {
      const rawText = lyrics.map((l) => l.original).join('\n');
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawLyrics: rawText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al traducir');

      const items: { original: string; translated: string }[] = data.lyrics || data.lines || [];
      if (items.length > 0) {
        const updated = lyrics.map((line, idx) => ({
          ...line,
          translated: items[idx]?.translated || line.translated,
        }));
        onUpdateLyrics(updated);
        showToast('Todas las traducciones fueron actualizadas.');
      }
    } catch (err: unknown) {
      const error = err as Error;
      showToast(`Fallo: ${error.message}`);
    } finally {
      setIsTranslatingAll(false);
    }
  };

  // Descargar audio directo desde el Paso 2 si faltaba
  const handleDownloadMissingAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fallbackUrlInput.trim()) return;

    setIsDownloadingAudio(true);
    setAudioAttachError(null);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'download_audio_only',
          url: fallbackUrlInput.trim(),
          title: songInfo.title,
          artist: songInfo.artist,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo descargar el audio del enlace.');

      if (onAudioUrlAttached) {
        onAudioUrlAttached(data.audioUrl);
      }
      setFallbackUrlInput('');
      showToast('Audio oficial descargado y reproductor activado.');
    } catch (err: unknown) {
      const error = err as Error;
      setAudioAttachError(error.message || 'Error descargando audio.');
    } finally {
      setIsDownloadingAudio(false);
    }
  };

  // Alternar instrumental (con extensión automática si es el último verso)
  const handleToggleInstrumental = (id: string) => {
    const lastIndex = lyrics.length - 1;
    const updated = lyrics.map((l, idx) => {
      if (l.id === id) {
        const isInst = !l.isInstrumental;
        let newEnd = l.endTime;
        if (isInst && idx === lastIndex && audioDuration > l.startTime) {
          newEnd = parseFloat(audioDuration.toFixed(2));
        }
        return {
          ...l,
          endTime: newEnd,
          isInstrumental: isInst,
          original: isInst ? '♪ Instrumental ♪' : '',
          translated: isInst ? '♪ Instrumental ♪' : '',
        };
      }
      return l;
    });
    onUpdateLyrics(updated);
  };

  // Insertar un interludio instrumental
  const handleInsertInstrumental = (afterIndex?: number) => {
    const targetIdx = afterIndex !== undefined ? afterIndex : lyrics.length - 1;
    const prevLine = lyrics[targetIdx];
    const startTime = prevLine ? (prevLine.endTime || prevLine.startTime + 3) : currentTime;
    const nextLine = lyrics[targetIdx + 1];

    let endTime: number;
    if (nextLine) {
      endTime = nextLine.startTime;
    } else if (audioDuration > 0 && audioDuration > startTime) {
      endTime = audioDuration;
    } else {
      endTime = startTime + 4;
    }

    const instrumentalLine: LyricLine = {
      id: `inst-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      original: '♪ Instrumental ♪',
      translated: '♪ Instrumental ♪',
      startTime: parseFloat(startTime.toFixed(2)),
      endTime: parseFloat(endTime.toFixed(2)),
      isInstrumental: true,
    };

    const insertPosition = targetIdx >= 0 ? targetIdx + 1 : 0;
    const newLyrics = [...lyrics];
    newLyrics.splice(insertPosition, 0, instrumentalLine);
    onUpdateLyrics(newLyrics);
    showToast('Interludio instrumental insertado.');
  };

  // Agregar nuevo verso (con cálculo inteligente al final)
  const handleAddLine = (afterIndex: number) => {
    const prev = lyrics[afterIndex];
    const newStart = prev ? parseFloat((prev.endTime + 0.1).toFixed(2)) : 0;
    const isAtEnd = afterIndex === lyrics.length - 1 || (afterIndex === -1 && lyrics.length === 0);
    const newEnd = isAtEnd && audioDuration > 0 && audioDuration > newStart
      ? parseFloat(audioDuration.toFixed(2))
      : parseFloat((newStart + 3.5).toFixed(2));

    const newLine: LyricLine = {
      id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      original: '',
      translated: '',
      startTime: newStart,
      endTime: newEnd,
    };

    const newLyrics = [...lyrics];
    newLyrics.splice(afterIndex + 1, 0, newLine);
    onUpdateLyrics(newLyrics);
  };

  // Modificar tiempo de un verso
  const handleUpdateLineTimes = (id: string, newStart: number, newEnd: number) => {
    const updated = lyrics.map((l) => {
      if (l.id === id) {
        const validStart = Math.max(0, parseFloat(newStart.toFixed(2)));
        const validEnd = parseFloat(Math.max(validStart + 0.2, newEnd).toFixed(2));
        return {
          ...l,
          startTime: validStart,
          endTime: validEnd,
        };
      }
      return l;
    });
    onUpdateLyrics(updated);
  };

  // Ajustar duración (+/- delta en segundos)
  const handleAdjustDuration = (id: string, delta: number) => {
    const line = lyrics.find((l) => l.id === id);
    if (!line) return;
    const newEnd = Math.max(line.startTime + 0.3, parseFloat((line.endTime + delta).toFixed(2)));
    handleUpdateLineTimes(id, line.startTime, newEnd);
  };

  // Extender verso hasta el final del audio
  const handleExtendLineToEndOfAudio = (id: string) => {
    if (audioDuration <= 0) return;
    const line = lyrics.find((l) => l.id === id);
    if (!line) return;
    if (audioDuration <= line.startTime) return;
    handleUpdateLineTimes(id, line.startTime, parseFloat(audioDuration.toFixed(2)));
    showToast(`Verso extendido hasta el final del audio (${audioDuration.toFixed(2)}s).`);
  };

  // Fijar inicio del verso en la posición actual del audio
  const handleSetLineStartToCurrentPlayback = (id: string) => {
    const line = lyrics.find((l) => l.id === id);
    if (!line || currentTime < 0) return;
    const newStart = parseFloat(currentTime.toFixed(2));
    const curDuration = Math.max(0.5, line.endTime - line.startTime);
    const newEnd = parseFloat((newStart + curDuration).toFixed(2));
    handleUpdateLineTimes(id, newStart, newEnd);
    showToast(`Inicio fijado en ${newStart.toFixed(2)}s`);
  };

  // Fijar fin del verso en la posición actual del audio
  const handleSetLineEndToCurrentPlayback = (id: string) => {
    const line = lyrics.find((l) => l.id === id);
    if (!line || currentTime <= line.startTime) {
      showToast('El punto de reproducción debe ser posterior al inicio del verso.');
      return;
    }
    const newEnd = parseFloat(currentTime.toFixed(2));
    handleUpdateLineTimes(id, line.startTime, newEnd);
    showToast(`Fin fijado en ${newEnd.toFixed(2)}s`);
  };

  // Eliminar verso
  const handleDeleteLine = (id: string) => {
    const updated = lyrics.filter((l) => l.id !== id);
    onUpdateLyrics(updated);
  };

  // Cambio de velocidad de audio
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.playbackRate = speed;
    }
  };

  // Filtrado de versos
  const filteredLyrics = useMemo(() => {
    return lyrics.filter((line) => {
      if (activeChorusFilterKey) {
        if (normalizeKey(line.original) !== activeChorusFilterKey) return false;
      }
      if (!filterText.trim()) return true;
      const q = filterText.toLowerCase();
      return line.original.toLowerCase().includes(q) || line.translated.toLowerCase().includes(q);
    });
  }, [lyrics, filterText, activeChorusFilterKey]);

  return (
    <div className="flex-1 py-5 px-3 sm:px-6 max-w-[1560px] mx-auto w-full space-y-4">
      {/* ========================================================================= */}
      {/* 1. HEADER DEL PASO 2: TÍTULO Y LLAMADO A LA ACCIÓN                        */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide mb-1">
            PASO 2 DE 3: CORRECCIÓN DE LETRA & TRADUCCIÓN
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-zinc-100 tracking-tight">
            Revisión y Ajuste de Traducción
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Escucha la canción, corrige versos y sincroniza repeticiones o coros. Una vez revisada, avanza al editor de marcas de tiempo.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            type="button"
            onClick={onBackToSearch}
            className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-700/60 transition cursor-pointer flex items-center gap-1.5"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Volver a Búsqueda</span>
          </button>

          {onSaveProject && (
            <button
              type="button"
              onClick={onSaveProject}
              className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-700/60 transition cursor-pointer flex items-center gap-1.5"
              title="Guardar el proyecto en el catálogo de proyectos"
            >
              <FileJson className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Guardar Proyecto</span>
            </button>
          )}

          <button
            type="button"
            onClick={onProceedToEditor}
            disabled={lyrics.length === 0}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs px-4 py-2 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
          >
            <span>Ir al Editor de Video</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toast Flotante / Notificación sutil (Overlay sin desplazar el layout) */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#0f121a]/95 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. REPRODUCTOR DE AUDIO PRINCIPAL (AL PRINCIPIO DE LA PANTALLA)          */}
      {/* ========================================================================= */}
      <div className="bg-[#12151f] border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-xl text-zinc-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Metadata de la Canción */}
          <div className="flex items-center gap-3 min-w-0">
            {songInfo.coverUrl ? (
              <img
                src={songInfo.coverUrl}
                alt="Carátula"
                className="w-12 h-12 rounded-xl object-cover border border-zinc-700 flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Music className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base text-zinc-100 truncate">
                {songInfo.title || 'Canción sin título'}
              </h2>
              <p className="text-xs text-zinc-400 truncate">
                {songInfo.artist || 'Artista desconocido'} · {lyrics.length} versos cargados
              </p>
            </div>
          </div>

          {/* Controles de Reproducción y Scrub Bar */}
          <div className="flex-1 max-w-2xl flex flex-col gap-2">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onSeek(Math.max(0, currentTime - 5))}
                disabled={!audioUrl}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 disabled:opacity-30 transition cursor-pointer"
                title="Retroceder 5 segundos"
              >
                <Rewind className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                disabled={!audioUrl}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold p-3 rounded-full shadow-lg transition cursor-pointer flex items-center justify-center"
                title={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={() => onSeek(Math.min(audioDuration, currentTime + 5))}
                disabled={!audioUrl}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 disabled:opacity-30 transition cursor-pointer"
                title="Adelantar 5 segundos"
              >
                <FastForward className="w-4 h-4" />
              </button>
            </div>

            {/* Barra de progreso */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-zinc-400 min-w-[36px] text-right">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min="0"
                max={audioDuration || 60}
                step="0.05"
                value={currentTime}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                disabled={!audioUrl}
                className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
              />
              <span className="text-[11px] font-mono text-zinc-400 min-w-[36px]">
                {formatTime(audioDuration)}
              </span>
            </div>
          </div>

          {/* Velocidad y Audio Local */}
          <div className="flex items-center justify-end gap-2">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-[11px]">
              {[0.75, 1, 1.25].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => handleSpeedChange(speed)}
                  className={`px-2 py-0.5 rounded-lg font-mono font-semibold transition cursor-pointer ${
                    playbackSpeed === speed
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {onAudioUpload && (
              <>
                <input
                  ref={audioUploadInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onAudioUpload(f);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioUploadInputRef.current?.click()}
                  className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-zinc-700/60 transition cursor-pointer flex items-center gap-1.5"
                  title="Cambiar o subir archivo de audio"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden xl:inline">{audioUrl ? 'Cambiar Audio' : 'Subir MP3'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MONITOR DE VERSO ACTIVO EN TIEMPO REAL                                   */}
        {/* ========================================================================= */}
        {audioUrl && activeLine && (
          <div className="pt-3 border-t border-zinc-800/80">
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#0a0d14] border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-inner">
              <div className="flex items-start md:items-center gap-3 min-w-0">
                <span className="flex h-2.5 w-2.5 relative flex-shrink-0 mt-1 md:mt-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 font-mono">
                    <span className="font-bold text-emerald-400">VERSO ACTIVO #{activeLineIndex + 1}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-100 font-semibold bg-zinc-800/90 px-2 py-0.5 rounded-md border border-zinc-700/80">
                      {activeLine.startTime.toFixed(2)}s → {activeLine.endTime.toFixed(2)}s
                    </span>
                    <span className="text-emerald-300 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[11px]">
                      Duración: {(activeLine.endTime - activeLine.startTime).toFixed(2)}s
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-300 truncate">
                    <span className="font-semibold text-zinc-100">"{activeLine.original}"</span>
                    {activeLine.translated && (
                      <span className="text-emerald-400/90 ml-1.5 font-medium">({activeLine.translated})</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Estado de Transición con el siguiente verso */}
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                {nextLineOfActive ? (
                  activeLine.endTime < nextLineOfActive.startTime - 0.08 ? (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg text-amber-300 text-[11px]">
                      <span>
                        Pausa de {(nextLineOfActive.startTime - activeLine.endTime).toFixed(2)}s antes de #{activeLineIndex + 2}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExtendToNextLine(activeLine.id)}
                        className="bg-amber-400 hover:bg-amber-300 text-black font-bold px-2 py-0.5 rounded text-[10px] transition cursor-pointer"
                        title="Extender este verso hasta el inicio del siguiente para que no se corte antes"
                      >
                        Unir con #{activeLineIndex + 2}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Conexión continua hacia verso #{activeLineIndex + 2}
                    </span>
                  )
                ) : (
                  <span className="text-[11px] text-zinc-400 bg-zinc-800/80 px-2.5 py-1 rounded-lg">
                    Último verso de la canción
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ALERTA Y FORMULARIO INLINE SI FALTA EL AUDIO */}
        {!audioUrl && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">El audio no se encuentra descargado o vinculado todavía.</span>
                <p className="text-[11px] text-zinc-300 mt-0.5">
                  Tus letras y traducciones están listas. Para escuchar y sincronizar marcas de tiempo, pega un enlace de YouTube o sube tu archivo MP3:
                </p>
              </div>
            </div>

            <form onSubmit={handleDownloadMissingAudio} className="flex flex-col sm:flex-row gap-2 pt-1">
              <div className="relative flex-1">
                <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=... o spotify.com/..."
                  value={fallbackUrlInput}
                  onChange={(e) => setFallbackUrlInput(e.target.value)}
                  disabled={isDownloadingAudio}
                  className="w-full bg-[#0a0c12] border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 text-xs rounded-xl py-2 pl-9 pr-3 focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={isDownloadingAudio || !fallbackUrlInput.trim()}
                className="bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {isDownloadingAudio ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Descargando...</span>
                  </>
                ) : (
                  <span>Descargar y Vincular Audio</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => audioUploadInputRef.current?.click()}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Subir MP3</span>
              </button>
            </form>

            {audioAttachError && (
              <div className="text-[11px] text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{audioAttachError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. BARRA DE HERRAMIENTAS: BÚSQUEDA, REEMPLAZO Y AUTO-SYNC COROS          */}
      {/* ========================================================================= */}
      <div className="bg-[#12151f] border border-zinc-800/90 rounded-2xl p-3 sm:p-4 shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Filtro de texto rápido */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Buscar versos o palabras en la lista..."
              className="w-full bg-[#0a0c12] border border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500 text-xs rounded-xl py-1.5 pl-8 pr-3 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filtro activo de coro */}
          {activeChorusFilterKey && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-1 rounded-xl">
              <span>Filtrando ocurrencias del coro</span>
              <button
                type="button"
                onClick={() => setActiveChorusFilterKey(null)}
                className="hover:text-white cursor-pointer ml-1 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Herramientas de Coros y Reemplazo */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Switch de Auto-Sincronización de Coros */}
            <label className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSyncCoros}
                onChange={(e) => setAutoSyncCoros(e.target.checked)}
                className="accent-emerald-500 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span className="font-medium">Auto-sincronizar coros al editar</span>
            </label>

            {/* Abrir herramienta Buscar y Reemplazar */}
            <button
              type="button"
              onClick={() => setShowSearchReplace(!showSearchReplace)}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                showSearchReplace
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-zinc-800/80 text-zinc-300 hover:text-white border-zinc-700/60'
              }`}
            >
              <Replace className="w-3.5 h-3.5 text-emerald-400" />
              <span>Buscar y Reemplazar</span>
            </button>

            {/* Unir transiciones continuas */}
            <button
              type="button"
              onClick={handleSnapAllContinuousTransitions}
              disabled={lyrics.length === 0}
              className="bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 hover:text-white px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-700/60 transition cursor-pointer flex items-center gap-1.5"
              title="Ajusta el final de cada verso para que conecte con el siguiente sin cortes artificiales"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Unir Transiciones</span>
            </button>

            {/* Offset global de tiempos */}
            <button
              type="button"
              onClick={() => setShowOffsetTool(!showOffsetTool)}
              disabled={lyrics.length === 0}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                showOffsetTool
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-zinc-800/80 text-zinc-300 hover:text-white border-zinc-700/60'
              }`}
              title="Adelantar o retrasar todos los versos (+/- segundos o milisegundos)"
            >
              <MoveHorizontal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Offset Global</span>
            </button>

            {/* Re-traducir todo con IA */}
            <button
              type="button"
              onClick={handleTranslateAll}
              disabled={isTranslatingAll || lyrics.length === 0}
              className="bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 hover:text-white px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-700/60 transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isTranslatingAll ? 'Traduciendo...' : 'Re-traducir todo con IA'}</span>
            </button>

            {/* Añadir verso al inicio */}
            <button
              type="button"
              onClick={() => handleAddLine(-1)}
              className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-zinc-700/60 transition cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Añadir Verso</span>
            </button>

            {/* Añadir interludio al final */}
            <button
              type="button"
              onClick={() => handleInsertInstrumental(lyrics.length - 1)}
              className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-zinc-700/60 transition cursor-pointer flex items-center gap-1"
              title="Añadir pausa o solo instrumental al final (cubre el resto del audio)"
            >
              <Music className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ ♪ Interludio</span>
            </button>
          </div>
        </div>

        {/* Panel Desplegable: Buscar y Reemplazar */}
        {showSearchReplace && (
          <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center gap-2.5 text-xs animate-in slide-in-from-top-1">
            <span className="text-zinc-400 font-medium">Reemplazar en:</span>
            <select
              value={searchTarget}
              onChange={(e) => setSearchTarget(e.target.value as 'translated' | 'original')}
              className="bg-[#0a0c12] border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            >
              <option value="translated">Traducción (Español)</option>
              <option value="original">Original (Inglés)</option>
            </select>

            <input
              type="text"
              placeholder="Buscar texto exacto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#0a0c12] border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 text-xs rounded-lg px-2.5 py-1.5 flex-1 min-w-[150px] focus:outline-none focus:border-emerald-500"
            />

            <input
              type="text"
              placeholder="Reemplazar por..."
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              className="bg-[#0a0c12] border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 text-xs rounded-lg px-2.5 py-1.5 flex-1 min-w-[150px] focus:outline-none focus:border-emerald-500"
            />

            <button
              type="button"
              onClick={handleExecuteReplace}
              disabled={!searchTerm.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold text-xs px-3.5 py-1.5 rounded-lg transition cursor-pointer"
            >
              Aplicar Reemplazo
            </button>
          </div>
        )}

        {/* Panel Desplegable: Offset Global de Tiempos */}
        {showOffsetTool && (
          <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-top-1 bg-[#0a0d14] p-3 rounded-xl border border-zinc-700/60">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Desplazar todos los versos:</span>
              </span>

              {/* Input en segundos (+/-) */}
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  placeholder="+2.0 o -1.5"
                  value={offsetInput}
                  onChange={(e) => setOffsetInput(e.target.value)}
                  className="w-24 bg-[#12151f] border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 text-xs rounded-lg px-2.5 py-1.5 font-mono text-center focus:outline-none focus:border-emerald-500"
                />
                <span className="text-zinc-400 font-mono text-[11px]">segundos</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(offsetInput);
                  if (!isNaN(val) && val !== 0) {
                    handleApplyOffset(val);
                    setOffsetInput('');
                  }
                }}
                disabled={!offsetInput || isNaN(parseFloat(offsetInput)) || parseFloat(offsetInput) === 0}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold text-xs px-3.5 py-1.5 rounded-lg transition cursor-pointer"
              >
                Aplicar Offset
              </button>
            </div>

            {/* Presets rápidos de un clic */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-zinc-500 text-[11px]">Rápidos:</span>
              {[-2, -1, -0.5, 0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleApplyOffset(s)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-2 py-1 rounded-md text-[11px] font-mono border border-zinc-700/60 transition cursor-pointer"
                  title={`Desplazar todos los versos ${s > 0 ? '+' : ''}${s} segundos`}
                >
                  {s > 0 ? `+${s}s` : `${s}s`}
                </button>
              ))}

              {/* Botón especial: Alinear al segundo actual de reproducción */}
              {currentTime > 0 && lyrics.length > 0 && (
                <button
                  type="button"
                  onClick={handleAlignToCurrentPlayback}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ml-1"
                  title={`Alinear el inicio del primer verso al segundo actual de reproducción (${currentTime.toFixed(2)}s)`}
                >
                  Alinear al audio ({currentTime.toFixed(1)}s)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. TABLA LADO A LADO: ORIGINAL (IZQUIERDA) Y TRADUCCIÓN (DERECHA)        */}
      {/* ========================================================================= */}
      <div className="bg-[#12151f] border border-zinc-800/90 rounded-2xl shadow-xl overflow-hidden">
        {/* Encabezados de Columna */}
        <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#0d1017] border-b border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          <div className="col-span-2 text-center"># / Inicio → Fin (Duración)</div>
          <div className="col-span-4 flex items-center justify-between">
            <span>Letra Original (Inglés / Fuente)</span>
            <span className="text-[10px] text-zinc-500 font-normal">Editable</span>
          </div>
          <div className="col-span-5 flex items-center justify-between">
            <span className="text-emerald-400">Traducción Generada (Español)</span>
            <span className="text-[10px] text-emerald-500/80 font-normal">Edición & Sincronización de Coro</span>
          </div>
          <div className="col-span-1 text-right">Acciones</div>
        </div>

        {/* Lista de Versos */}
        <div className="divide-y divide-zinc-800/70 max-h-[600px] overflow-y-auto">
          {filteredLyrics.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              No hay versos que coincidan con la búsqueda.
            </div>
          ) : (
            filteredLyrics.map((line) => {
              const originalIndex = lyrics.findIndex((l) => l.id === line.id);
              const key = normalizeKey(line.original);
              const rep = repetitionsMap.get(key);
              const isRepeated = rep && rep.count > 1;
              const isCurrentActive = activeLineIndex === originalIndex;
              const nextLine = originalIndex < lyrics.length - 1 ? lyrics[originalIndex + 1] : null;
              const gapBeforeNext = nextLine ? parseFloat((nextLine.startTime - line.endTime).toFixed(2)) : 0;
              const duration = parseFloat(((line.endTime || line.startTime) - line.startTime).toFixed(2));

              return (
                <div
                  key={line.id}
                  className={`grid grid-cols-12 gap-3 px-4 py-3 items-start transition-colors ${
                    isCurrentActive
                      ? 'bg-emerald-500/10 border-l-4 border-l-emerald-400 shadow-xs'
                      : 'hover:bg-zinc-900/50'
                  }`}
                >
                  {/* Columna 1 (2/12): Número de Verso, Rango de Tiempo y Duración */}
                  <div className="col-span-2 flex flex-col items-center justify-center gap-1.5 pt-0.5 text-center">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-mono font-bold ${isCurrentActive ? 'text-emerald-400' : 'text-zinc-400'}`}>
                        #{originalIndex + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingTimeLineId(editingTimeLineId === line.id ? null : line.id)}
                        className={`p-1 rounded transition cursor-pointer ${
                          editingTimeLineId === line.id
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800'
                        }`}
                        title={editingTimeLineId === line.id ? 'Cerrar edición de tiempos' : 'Editar tiempos e inicio/fin'}
                      >
                        {editingTimeLineId === line.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Pencil className="w-3 h-3" />
                        )}
                      </button>
                      {isCurrentActive && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                          ACTIVO
                        </span>
                      )}
                    </div>

                    {editingTimeLineId === line.id ? (
                      /* Formulario de Edición Precisa de Tiempos */
                      <div className="w-full space-y-1.5 p-2 bg-[#0c0f17] rounded-xl border border-emerald-500/40 text-[10px] animate-in fade-in-50">
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          <div>
                            <label className="text-[9px] text-zinc-400 block font-semibold">Inicio (s)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={line.startTime}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v)) handleUpdateLineTimes(line.id, v, line.endTime);
                              }}
                              className="w-full bg-[#151924] border border-zinc-700 rounded px-1 py-0.5 text-zinc-100 font-mono text-center focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-400 block font-semibold">Fin (s)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={line.endTime}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v)) handleUpdateLineTimes(line.id, line.startTime, v);
                              }}
                              className="w-full bg-[#151924] border border-zinc-700 rounded px-1 py-0.5 text-zinc-100 font-mono text-center focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        {/* Duración y botones +/- */}
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-[9px] text-zinc-300 font-mono">
                            Dur: <strong>{duration.toFixed(2)}s</strong>
                          </span>
                          <div className="flex items-center gap-0.5">
                            {[-1, -0.5, 0.5, 1].map((delta) => (
                              <button
                                key={delta}
                                type="button"
                                onClick={() => handleAdjustDuration(line.id, delta)}
                                className="px-1 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-mono text-[9px] border border-zinc-700/60 cursor-pointer"
                                title={`Ajustar duración ${delta > 0 ? `+${delta}` : delta}s`}
                              >
                                {delta > 0 ? `+${delta}` : delta}s
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Botones de Captura con Audio */}
                        {audioUrl && (
                          <div className="grid grid-cols-2 gap-1 pt-1 border-t border-zinc-800">
                            <button
                              type="button"
                              onClick={() => handleSetLineStartToCurrentPlayback(line.id)}
                              className="px-1 py-0.5 bg-zinc-800 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 rounded text-[9px] truncate cursor-pointer border border-zinc-700/50"
                              title={`Fijar inicio en posición actual (${currentTime.toFixed(1)}s)`}
                            >
                              Inic = {currentTime.toFixed(1)}s
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetLineEndToCurrentPlayback(line.id)}
                              disabled={currentTime <= line.startTime}
                              className="px-1 py-0.5 bg-zinc-800 hover:bg-emerald-500/20 disabled:opacity-30 text-zinc-300 hover:text-emerald-300 rounded text-[9px] truncate cursor-pointer border border-zinc-700/50"
                              title={`Fijar fin en posición actual (${currentTime.toFixed(1)}s)`}
                            >
                              Fin = {currentTime.toFixed(1)}s
                            </button>
                          </div>
                        )}

                        {/* Botón Extender al final */}
                        {(originalIndex === lyrics.length - 1 || line.endTime < audioDuration - 1) && audioDuration > line.startTime && (
                          <button
                            type="button"
                            onClick={() => handleExtendLineToEndOfAudio(line.id)}
                            className="w-full mt-1 px-1.5 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded text-[9px] font-bold cursor-pointer truncate"
                            title="Extender este verso hasta el final del audio"
                          >
                            Hasta el fin ({audioDuration.toFixed(1)}s)
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Visualización Estándar con Botón de Reproducir */
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (!audioUrl) return;
                            onSeek(line.startTime);
                            if (!isPlaying) onTogglePlay();
                          }}
                          disabled={!audioUrl}
                          className={`w-full text-[10px] font-mono px-2 py-1.5 rounded-xl border transition cursor-pointer flex flex-col items-center gap-0.5 ${
                            isCurrentActive
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-xs'
                              : 'bg-zinc-800/70 hover:bg-zinc-800 border-zinc-700/60 text-zinc-300 hover:text-white'
                          }`}
                          title={audioUrl ? 'Reproducir desde este verso' : 'Falta audio'}
                        >
                          <div className="flex items-center gap-1 font-semibold">
                            <Play className="w-2.5 h-2.5 fill-current text-emerald-400" />
                            <span>{line.startTime.toFixed(2)}s → {line.endTime.toFixed(2)}s</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 font-sans">
                            Duración: <strong className="text-zinc-200">{duration.toFixed(2)}s</strong>
                          </div>
                        </button>

                        {/* Alerta interactiva si el verso termina antes del siguiente */}
                        {gapBeforeNext > 0.15 && (
                          <div className="w-full flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10px] text-amber-300">
                            <span title={`Hay un silencio de ${gapBeforeNext}s antes de que inicie el verso #${originalIndex + 2}`}>
                              Pausa {gapBeforeNext.toFixed(1)}s
                            </span>
                            <button
                              type="button"
                              onClick={() => handleExtendToNextLine(line.id)}
                              className="font-bold text-amber-400 hover:text-amber-200 underline cursor-pointer text-[10px]"
                              title="Extender este verso hasta el inicio del siguiente para que no se corte antes"
                            >
                              Unir
                            </button>
                          </div>
                        )}

                        {/* Botón rápido si es el último verso y sobra audio al final */}
                        {originalIndex === lyrics.length - 1 && audioDuration > line.endTime + 0.5 && (
                          <button
                            type="button"
                            onClick={() => handleExtendLineToEndOfAudio(line.id)}
                            className="w-full px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-mono text-[9px] font-bold cursor-pointer transition flex items-center justify-center gap-1"
                            title={`Extender este verso hasta el final del audio (${audioDuration.toFixed(2)}s)`}
                          >
                            <span>Hasta el final ({audioDuration.toFixed(1)}s)</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Columna 2 (4/12): Letra Original */}
                  <div className="col-span-4 space-y-1.5">
                    <textarea
                      rows={2}
                      value={line.original}
                      onChange={(e) => handleUpdateLine(line.id, 'original', e.target.value)}
                      placeholder="Letra original..."
                      className="w-full bg-[#0a0c12] border border-zinc-700/80 rounded-xl p-2.5 text-xs font-sans text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none leading-relaxed"
                    />

                    {isRepeated && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChorusFilterKey(activeChorusFilterKey === key ? null : key);
                          }}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition cursor-pointer inline-flex items-center gap-1 ${
                            activeChorusFilterKey === key
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-zinc-800/80 text-amber-300 border-amber-500/30 hover:bg-zinc-800'
                          }`}
                          title="Hacer clic para ver solo las apariciones de este coro"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>Coro / Repetido ({rep?.count} veces)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Columna 3 (5/12): Traducción Generada */}
                  <div className="col-span-5 space-y-1.5">
                    <textarea
                      rows={2}
                      value={line.translated}
                      onChange={(e) => handleUpdateLine(line.id, 'translated', e.target.value)}
                      placeholder="Traducción al español..."
                      className="w-full bg-[#0d131f] border border-emerald-500/30 focus:border-emerald-400 rounded-xl p-2.5 text-xs font-sans font-medium text-emerald-200 placeholder:text-zinc-600 focus:outline-none resize-none leading-relaxed"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      {/* Botón de Sincronización Manual del Coro */}
                      {isRepeated ? (
                        <button
                          type="button"
                          onClick={() => handleSyncChorusOccurrences(line)}
                          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                          title="Copiar esta traducción a todas las demás apariciones del coro"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>Aplicar a las {rep?.count} apariciones del coro</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-500 italic">Verso único</span>
                      )}

                      {/* Re-traducir este verso con Gemini */}
                      <button
                        type="button"
                        onClick={() => handleTranslateSingleLine(line)}
                        disabled={translatingLineId === line.id}
                        className="text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                        title="Re-traducir este verso con Gemini"
                      >
                        {translatingLineId === line.id ? (
                          <Wand2 className="w-2.5 h-2.5 animate-spin text-emerald-400" />
                        ) : (
                          <Wand2 className="w-2.5 h-2.5 text-emerald-400" />
                        )}
                        <span>Re-traducir verso</span>
                      </button>
                    </div>
                  </div>

                  {/* Columna 4: Acciones Adicionales */}
                  <div className="col-span-1 flex items-center justify-end gap-1 pt-2">
                    {/* Botón Mezclar con el verso siguiente */}
                    {originalIndex < lyrics.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMergeWithNextLine(originalIndex)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition cursor-pointer"
                        title={`Mezclar con verso #${originalIndex + 2} (combina letras y duración)`}
                      >
                        <Merge className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleInsertInstrumental(originalIndex)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition cursor-pointer"
                      title="Insertar solo / interludio instrumental debajo de este verso"
                    >
                      <Music className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleInstrumental(line.id)}
                      className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                        line.isInstrumental
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                      title={line.isInstrumental ? 'Desmarcar instrumental' : 'Marcar como instrumental (solo música)'}
                    >
                      ♪
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddLine(originalIndex)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition cursor-pointer"
                      title="Insertar verso debajo"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteLine(line.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer"
                      title="Eliminar verso"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. FOOTER DE NAVEGACIÓN Y RESUMEN DEL PASO 2                              */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>
            {lyrics.length} versos listos para el editor. Todos los cambios se guardan automáticamente.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToSearch}
            className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white px-4 py-2.5 text-xs font-semibold rounded-xl border border-zinc-700/60 transition cursor-pointer flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Volver a Ingesta</span>
          </button>

          <button
            type="button"
            onClick={onProceedToEditor}
            disabled={lyrics.length === 0}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
          >
            <span>Proceder al Editor de Marcas de Tiempo (Paso 3)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
