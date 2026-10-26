'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Loader2,
  Music,
  ArrowRight,
  Disc3,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Link2,
  Upload,
  Clock,
  FileText,
} from 'lucide-react';
import { LyricLine } from '@/types/lyrics';
import { GeniusTrackItem } from '@/lib/geniusClient';

interface QuickSongSearchProps {
  onImportSuccess: (data: {
    audioUrl?: string;
    lyrics: LyricLine[];
    title: string;
    artist: string;
    coverUrl?: string;
  }) => void;
  onStatusChange: (status: string | null) => void;
}

interface ProcessState {
  track: GeniusTrackItem | null;
  isOpen: boolean;
  isProcessing: boolean;
  lyricsStatus: 'loading' | 'success' | 'warning' | 'error';
  lyricsMessage: string;
  translationStatus: 'pending' | 'loading' | 'success' | 'warning' | 'error';
  translationMessage: string;
  audioStatus: 'pending' | 'loading' | 'success' | 'warning' | 'error';
  audioMessage: string;
  // Resultados acumulados
  recoveredLyrics: LyricLine[];
  recoveredTitle: string;
  recoveredArtist: string;
  recoveredCover: string;
  downloadedAudioUrl: string;
  // Estado para fallback de audio
  needsAudioFallback: boolean;
  fallbackUrl: string;
  isDownloadingFallback: boolean;
  fallbackError: string | null;
}

export const QuickSongSearch: React.FC<QuickSongSearchProps> = ({
  onImportSuccess,
  onStatusChange,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeniusTrackItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [source, setSource] = useState<'genius' | 'lrclib'>('genius');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Estado del proceso interactivo con retroalimentación completa
  const [processState, setProcessState] = useState<ProcessState>({
    track: null,
    isOpen: false,
    isProcessing: false,
    lyricsStatus: 'loading',
    lyricsMessage: 'Consultando bases de datos de LRCLIB y Genius...',
    translationStatus: 'pending',
    translationMessage: 'En cola para traducción con Gemini IA...',
    audioStatus: 'pending',
    audioMessage: 'En cola para descarga de audio oficial con yt-dlp...',
    recoveredLyrics: [],
    recoveredTitle: '',
    recoveredArtist: '',
    recoveredCover: '',
    downloadedAudioUrl: '',
    needsAudioFallback: false,
    fallbackUrl: '',
    isDownloadingFallback: false,
    fallbackError: null,
  });

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const fallbackFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setErrorMsg(null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!text.trim()) {
      setResults([]);
      setIsDropdownOpen(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/genius/search?q=${encodeURIComponent(text.trim())}`);
        if (!res.ok) throw new Error('Error al buscar canciones');
        const data = await res.json();
        setResults(data.results || []);
        setSource(data.source || 'genius');
        setIsDropdownOpen(true);
      } catch (err: unknown) {
        console.warn('Fallo búsqueda en vivo:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleSelectTrack = async (track: GeniusTrackItem) => {
    setIsDropdownOpen(false);
    setErrorMsg(null);

    // Iniciar el modal interactivo con feedback visual real
    setProcessState({
      track,
      isOpen: true,
      isProcessing: true,
      lyricsStatus: 'loading',
      lyricsMessage: 'Buscando letras sincronizadas (LRCLIB) y fuente oficial (Genius)...',
      translationStatus: 'loading',
      translationMessage: 'Preparando motor de traducción lírica con Gemini IA...',
      audioStatus: 'loading',
      audioMessage: 'Buscando audio oficial de alta calidad con yt-dlp...',
      recoveredLyrics: [],
      recoveredTitle: track.title,
      recoveredArtist: track.artist,
      recoveredCover: track.thumbnailUrl,
      downloadedAudioUrl: '',
      needsAudioFallback: false,
      fallbackUrl: '',
      isDownloadingFallback: false,
      fallbackError: null,
    });

    onStatusChange(`Iniciando ingesta 1-Click para "${track.title}"...`);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          albumArt: track.thumbnailUrl,
          geniusUrl: track.url,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo procesar la canción seleccionada.');
      }

      const lyricsCount = (data.lyrics || []).length;
      const lyricsSourceLabel =
        data.lyricsSource === 'lrclib-synced'
          ? 'LRCLIB (Marcas de tiempo oficiales sincronizadas)'
          : data.lyricsSource === 'lrclib-plain'
          ? 'LRCLIB (Texto plano)'
          : data.lyricsSource === 'genius-plain'
          ? 'Genius (Texto plano)'
          : 'Fuente alternativa';

      const hasAudio = Boolean(data.audioUrl && data.audioUrl.trim().length > 0);

      // Actualizar estado con retroalimentación exacta y verídica
      setProcessState((prev) => ({
        ...prev,
        isProcessing: false,
        recoveredLyrics: data.lyrics || [],
        recoveredTitle: data.title || track.title,
        recoveredArtist: data.artist || track.artist,
        recoveredCover: data.coverUrl || track.thumbnailUrl,
        downloadedAudioUrl: data.audioUrl || '',
        lyricsStatus: lyricsCount > 0 ? 'success' : 'warning',
        lyricsMessage:
          lyricsCount > 0
            ? `${lyricsCount} versos recuperados con éxito desde ${lyricsSourceLabel}.`
            : 'No se encontraron versos para este tema.',
        translationStatus: data.isTranslated && lyricsCount > 0 ? 'success' : 'warning',
        translationMessage:
          data.isTranslated && lyricsCount > 0
            ? `${lyricsCount} versos traducidos al español con Gemini IA.`
            : 'Traducción omitida o no requerida.',
        audioStatus: hasAudio ? 'success' : 'warning',
        audioMessage: hasAudio
          ? `Audio oficial descargado correctamente: "${data.downloadedTrackName || track.title}".`
          : 'No se pudo descargar el audio automáticamente de YouTube.',
        needsAudioFallback: !hasAudio,
      }));

      // Si el audio se descargó correctamente, avanzar automáticamente tras breve feedback
      if (hasAudio) {
        onStatusChange(`"${track.title}" lista con audio y versos sincronizados.`);
        setTimeout(() => {
          onImportSuccess({
            audioUrl: data.audioUrl,
            lyrics: data.lyrics || [],
            title: data.title || track.title,
            artist: data.artist || track.artist,
            coverUrl: data.coverUrl || track.thumbnailUrl,
          });
          setProcessState((prev) => ({ ...prev, isOpen: false }));
          setQuery('');
          setResults([]);
        }, 1200);
      } else {
        onStatusChange(`Letra recuperada para "${track.title}". Falta el audio para reproducir.`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error(error);
      setProcessState((prev) => ({
        ...prev,
        isProcessing: false,
        lyricsStatus: 'error',
        lyricsMessage: 'Error al contactar con el servicio de importación.',
        audioStatus: 'error',
        audioMessage: error.message || 'Error desconocido.',
      }));
      setErrorMsg(error.message || 'Error en la importación 1-Click.');
    }
  };

  // Descargar audio mediante enlace de fallback (YouTube o Spotify)
  const handleDownloadFallbackAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processState.fallbackUrl.trim()) return;

    setProcessState((prev) => ({
      ...prev,
      isDownloadingFallback: true,
      fallbackError: null,
      audioStatus: 'loading',
      audioMessage: 'Descargando audio desde el enlace proporcionado...',
    }));

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'download_audio_only',
          url: processState.fallbackUrl.trim(),
          title: processState.recoveredTitle,
          artist: processState.recoveredArtist,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo descargar el audio del enlace.');

      setProcessState((prev) => ({
        ...prev,
        isDownloadingFallback: false,
        downloadedAudioUrl: data.audioUrl,
        audioStatus: 'success',
        audioMessage: `Audio vinculado exitosamente desde el enlace proporcionado.`,
        needsAudioFallback: false,
      }));

      // Enviar a la aplicación y proceder
      onImportSuccess({
        audioUrl: data.audioUrl,
        lyrics: processState.recoveredLyrics,
        title: processState.recoveredTitle,
        artist: processState.recoveredArtist,
        coverUrl: processState.recoveredCover,
      });

      setTimeout(() => {
        setProcessState((prev) => ({ ...prev, isOpen: false }));
        setQuery('');
        setResults([]);
      }, 1000);
    } catch (err: unknown) {
      const error = err as Error;
      setProcessState((prev) => ({
        ...prev,
        isDownloadingFallback: false,
        fallbackError: error.message || 'Fallo al descargar el audio.',
        audioStatus: 'warning',
        audioMessage: 'No se pudo obtener el audio de ese enlace. Prueba con otro enlace o sube un archivo MP3.',
      }));
    }
  };

  // Subir archivo local como fallback
  const handleLocalFileFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const audioUrl = URL.createObjectURL(file);

    onImportSuccess({
      audioUrl,
      lyrics: processState.recoveredLyrics,
      title: processState.recoveredTitle,
      artist: processState.recoveredArtist,
      coverUrl: processState.recoveredCover,
    });

    setProcessState((prev) => ({
      ...prev,
      downloadedAudioUrl: audioUrl,
      audioStatus: 'success',
      audioMessage: `Archivo de audio local cargado: "${file.name}".`,
      needsAudioFallback: false,
      isOpen: false,
    }));

    setQuery('');
    setResults([]);
  };

  // Continuar al Paso 2 sin audio por el momento
  const handleContinueWithoutAudio = () => {
    onImportSuccess({
      audioUrl: '',
      lyrics: processState.recoveredLyrics,
      title: processState.recoveredTitle,
      artist: processState.recoveredArtist,
      coverUrl: processState.recoveredCover,
    });

    setProcessState((prev) => ({ ...prev, isOpen: false }));
    setQuery('');
    setResults([]);
  };

  return (
    <div ref={wrapperRef} className="bg-[#12151f] border border-zinc-800 rounded-2xl p-5 space-y-4 text-zinc-100 shadow-xl">
      {/* Header del Buscador */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Disc3 className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-1.5 font-display">
              Buscador 1-Click
            </h3>
            <span className="text-[11px] text-zinc-400">
              Escribe el nombre de la canción para preparar audio y timestamps automáticamente.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {source === 'genius' ? (
            <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
              Genius Direct
            </span>
          ) : (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
              LRCLIB Synced
            </span>
          )}
        </div>
      </div>

      {/* Input de Búsqueda */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Busca por canción o artista (ej: The Weeknd Blinding Lights, Gotye, Coldplay...)"
          className="w-full bg-[#0a0c12] border border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500 text-xs font-medium rounded-xl py-3 pl-10 pr-10 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
        />
        {isSearching && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          </div>
        )}
      </div>

      {/* Desplegable de Resultados */}
      {isDropdownOpen && results.length > 0 && (
        <div className="bg-[#0e111a] border border-zinc-700/80 rounded-xl overflow-hidden shadow-2xl max-h-72 overflow-y-auto divide-y divide-zinc-800/80 animate-in fade-in duration-150">
          {results.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => handleSelectTrack(track)}
              className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/70 text-left transition cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                {track.thumbnailUrl ? (
                  <img
                    src={track.thumbnailUrl}
                    alt={track.title}
                    className="w-10 h-10 rounded-lg object-cover border border-zinc-700/80 flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-400">
                    <Music className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-200 group-hover:text-emerald-400 truncate transition-colors">
                    {track.title}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">{track.artist}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 group-hover:bg-emerald-500 group-hover:text-black px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1">
                  <span>Importar</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Error inline */}
      {errorMsg && (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL / PANEL DE RETROALIMENTACIÓN DETALLADA EN TIEMPO REAL              */}
      {/* ========================================================================= */}
      {processState.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12151f] border border-zinc-700/90 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            {/* Cabecera del Proceso */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                {processState.track?.thumbnailUrl ? (
                  <img
                    src={processState.track.thumbnailUrl}
                    alt="Cover"
                    className="w-12 h-12 rounded-xl object-cover border border-zinc-700 flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-zinc-100 truncate">
                    {processState.recoveredTitle || processState.track?.title}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate">
                    {processState.recoveredArtist || processState.track?.artist}
                  </p>
                </div>
              </div>

              {!processState.isProcessing && (
                <button
                  type="button"
                  onClick={() => setProcessState((prev) => ({ ...prev, isOpen: false }))}
                  className="text-zinc-500 hover:text-zinc-300 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Los 3 Pasos con Estado Real */}
            <div className="space-y-3">
              {/* Paso 1: Letras */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="mt-0.5">
                  {processState.lyricsStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
                  {processState.lyricsStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {processState.lyricsStatus === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  {processState.lyricsStatus === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-200">1. Extracción de Letras</span>
                    <span className="text-[10px] text-zinc-500 font-mono">LRCLIB / Genius</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{processState.lyricsMessage}</p>
                </div>
              </div>

              {/* Paso 2: Traducción con IA */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="mt-0.5">
                  {processState.translationStatus === 'pending' && <Clock className="w-4 h-4 text-zinc-600" />}
                  {processState.translationStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
                  {processState.translationStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {processState.translationStatus === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  {processState.translationStatus === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-200">2. Traducción Lírica</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Gemini 2.5 Flash</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{processState.translationMessage}</p>
                </div>
              </div>

              {/* Paso 3: Descarga de Audio */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="mt-0.5">
                  {processState.audioStatus === 'pending' && <Clock className="w-4 h-4 text-zinc-600" />}
                  {processState.audioStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
                  {processState.audioStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {processState.audioStatus === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  {processState.audioStatus === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-200">3. Descarga de Audio Oficial</span>
                    <span className="text-[10px] text-zinc-500 font-mono">yt-dlp</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{processState.audioMessage}</p>
                </div>
              </div>
            </div>

            {/* SECCIÓN DE FALLBACK CUANDO EL AUDIO FALLA (REQUISITO CLAVE) */}
            {processState.needsAudioFallback && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-200">
                      Se recuperó todo menos el audio oficial
                    </h4>
                    <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                      Tus versos y traducciones están 100% listos. Para poder reproducir y sincronizar tiempos, inserta un enlace de YouTube/Spotify o sube tu archivo MP3:
                    </p>
                  </div>
                </div>

                {/* Formulario para insertar enlace de YouTube / Spotify */}
                <form onSubmit={handleDownloadFallbackAudio} className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={processState.fallbackUrl}
                        onChange={(e) =>
                          setProcessState((prev) => ({ ...prev, fallbackUrl: e.target.value }))
                        }
                        placeholder="https://youtube.com/watch?v=... o open.spotify.com/..."
                        disabled={processState.isDownloadingFallback}
                        className="w-full bg-[#0a0c12] border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 text-xs rounded-xl py-2 pl-9 pr-3 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={processState.isDownloadingFallback || !processState.fallbackUrl.trim()}
                      className="bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {processState.isDownloadingFallback ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Descargando...</span>
                        </>
                      ) : (
                        <span>Vincular Audio</span>
                      )}
                    </button>
                  </div>

                  {processState.fallbackError && (
                    <div className="text-[11px] text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{processState.fallbackError}</span>
                    </div>
                  )}
                </form>

                {/* Alternativa: Subir archivo MP3 local o continuar sin audio */}
                <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2">
                  <input
                    ref={fallbackFileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleLocalFileFallback}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fallbackFileInputRef.current?.click()}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-zinc-700 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-3 h-3 text-emerald-400" />
                    <span>Subir archivo MP3 local</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleContinueWithoutAudio}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                  >
                    Continuar al editor de letra sin audio por ahora
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
