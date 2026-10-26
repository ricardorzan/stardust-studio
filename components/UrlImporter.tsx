'use client';

import React, { useState, useRef } from 'react';
import { Link2, Loader2, ChevronDown, ChevronUp, AlertCircle, Upload, Music, FileText } from 'lucide-react';
import { LyricLine } from '@/types/lyrics';
import { generateEstimatedTimings } from '@/lib/lyricsScraper';

interface UrlImporterProps {
  onImportSuccess: (data: {
    audioUrl?: string;
    lyrics: LyricLine[];
    title: string;
    artist: string;
    coverUrl?: string;
  }) => void;
  onStatusChange: (status: string | null) => void;
}

export const UrlImporter: React.FC<UrlImporterProps> = ({
  onImportSuccess,
  onStatusChange,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Estados para subida de archivo local
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localSongTitle, setLocalSongTitle] = useState('');
  const [localArtist, setLocalArtist] = useState('');
  const [localRawLyrics, setLocalRawLyrics] = useState('');
  const [isTranslatingLocal, setIsTranslatingLocal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    onStatusChange('Procesando enlace: resolviendo canción y buscando letra...');

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el enlace.');
      }

      const trackLabel = data.downloadedTrackName ? `"${data.downloadedTrackName}"` : `"${data.title} - ${data.artist}"`;
      onStatusChange(
        data.syncedWithLRC
          ? `Audio descargado: ${trackLabel}. Letras y tiempos sincronizados.`
          : `Audio descargado: ${trackLabel}. Listo para reproducir.`
      );

      onImportSuccess({
        audioUrl: data.audioUrl,
        lyrics: data.lyrics || [],
        title: data.title || '',
        artist: data.artist || '',
        coverUrl: data.coverUrl,
      });

      setUrl('');
      setTimeout(() => onStatusChange(null), 5000);
    } catch (err: unknown) {
      const error = err as Error;
      console.error(error);
      setErrorMsg(error.message || 'Error al importar.');
      onStatusChange(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalFile(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    if (!localSongTitle) {
      setLocalSongTitle(cleanName);
    }
  };

  const handleProcessLocalUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localFile && !localRawLyrics.trim()) {
      setErrorMsg('Debes seleccionar un archivo de audio o pegar la letra.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      let audioBlobUrl = '';
      if (localFile) {
        audioBlobUrl = URL.createObjectURL(localFile);
      }

      let parsedLyrics: LyricLine[] = [];

      if (localRawLyrics.trim()) {
        setIsTranslatingLocal(true);
        onStatusChange('Traduciendo letra al español con Gemini...');
        const res = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawLyrics: localRawLyrics }),
        });

        const data = await res.json();
        const items: { original: string; translated: string }[] = data.lyrics || data.lines || [];

        if (items.length > 0) {
          const estimated = generateEstimatedTimings(items.map((it) => it.original));
          parsedLyrics = items.map((item, idx) => ({
            id: `line-${idx + 1}`,
            original: item.original,
            translated: item.translated,
            startTime: estimated[idx]?.startTime ?? parseFloat((10 + idx * 4).toFixed(2)),
            endTime: estimated[idx]?.endTime ?? parseFloat((14 + idx * 4).toFixed(2)),
          }));
        }
      }

      onImportSuccess({
        audioUrl: audioBlobUrl,
        lyrics: parsedLyrics,
        title: localSongTitle.trim() || (localFile ? localFile.name.replace(/\.[^/.]+$/, '') : 'Canción'),
        artist: localArtist.trim() || 'Artista',
      });

      onStatusChange('Archivo de audio y versos cargados con éxito.');
      setTimeout(() => onStatusChange(null), 4000);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(`Error procesando archivo: ${error.message}`);
    } finally {
      setLoading(false);
      setIsTranslatingLocal(false);
    }
  };

  return (
    <div className="bg-[#12151f] border border-zinc-800 rounded-2xl p-4 sm:p-5 transition-all text-zinc-100 shadow-xl">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left text-xs font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Método alternativo: Enlace web o Archivo Local</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-4">
          {/* Sub-tabs: URL vs Archivo Local */}
          <div className="flex items-center gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl max-w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'url'
                  ? 'bg-zinc-800 text-emerald-400 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Link2 className="w-3 h-3" />
              <span>Enlace (YouTube / Spotify / Genius)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'file'
                  ? 'bg-zinc-800 text-emerald-400 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>Subir MP3 / WAV Local</span>
            </button>
          </div>

          {/* Tab 1: Enlace Web */}
          {activeTab === 'url' && (
            <div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                Pega un enlace directo de Spotify, YouTube o Genius. El sistema descargará el audio oficial y preparará las letras sincronizadas.
              </p>

              <form onSubmit={handleImportUrl} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Link2 className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="https://open.spotify.com/track/..., youtube.com/..., o genius.com/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={loading}
                    className="w-full bg-[#0a0c12] border border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500 text-xs font-medium rounded-xl py-2.5 pl-10 pr-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap shadow-md flex items-center justify-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Importando...</span>
                    </>
                  ) : (
                    <span>Importar Enlace</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: Archivo Local */}
          {activeTab === 'file' && (
            <form onSubmit={handleProcessLocalUpload} className="space-y-3">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Selecciona tu archivo de audio desde tu equipo y opcionalmente pega la letra para traducirla automáticamente con IA.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Título de la Canción
                  </label>
                  <input
                    type="text"
                    value={localSongTitle}
                    onChange={(e) => setLocalSongTitle(e.target.value)}
                    placeholder="Nombre del tema..."
                    className="w-full bg-[#0a0c12] border border-zinc-700/80 text-zinc-100 placeholder:text-zinc-600 text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Artista
                  </label>
                  <input
                    type="text"
                    value={localArtist}
                    onChange={(e) => setLocalArtist(e.target.value)}
                    placeholder="Nombre del artista..."
                    className="w-full bg-[#0a0c12] border border-zinc-700/80 text-zinc-100 placeholder:text-zinc-600 text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Archivo de Audio (MP3, WAV, M4A)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{localFile ? 'Cambiar archivo' : 'Elegir archivo de audio'}</span>
                  </button>

                  <span className="text-xs text-zinc-400 truncate flex-1">
                    {localFile ? localFile.name : 'Ningún archivo seleccionado'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Letra Original en Inglés (Opcional, verso por verso)
                </label>
                <textarea
                  rows={4}
                  value={localRawLyrics}
                  onChange={(e) => setLocalRawLyrics(e.target.value)}
                  placeholder="Pega la letra aquí si no la tienes en audio..."
                  className="w-full bg-[#0a0c12] border border-zinc-700/80 text-zinc-100 placeholder:text-zinc-600 text-xs rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 resize-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading || (!localFile && !localRawLyrics.trim())}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {loading || isTranslatingLocal ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando archivo y traducción...</span>
                  </>
                ) : (
                  <span>Continuar a Revisión de Letra (Paso 2)</span>
                )}
              </button>
            </form>
          )}

          {errorMsg && (
            <div className="mt-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
