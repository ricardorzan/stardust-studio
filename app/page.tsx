'use client';

import React, { useState, useRef } from 'react';
import { LyricLine, VideoTheme, VideoProject } from '@/types/lyrics';
import { analyzeAudioBeats } from '@/lib/audioAnalyzer';
import { StudioLyricsMonitor } from '@/components/StudioLyricsMonitor';
import { ThemeCustomizer } from '@/components/ThemeCustomizer';
import { UrlImporter } from '@/components/UrlImporter';
import { QuickSongSearch } from '@/components/QuickSongSearch';
import { LyricsReviewStep } from '@/components/LyricsReviewStep';
import { RenderProgressModal } from '@/components/RenderProgressModal';
import dynamicImport from 'next/dynamic';
import {
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Radio,
  FolderOpen,
  Plus,
  FilePlus,
  X,
  Clock,
  Save,
  Trash2,
} from 'lucide-react';

const VideoPreviewPlayer = dynamicImport(
  () => import('@/components/VideoPreviewPlayer').then((mod) => mod.VideoPreviewPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 bg-[#090a0f] border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 text-xs font-mono">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span>Cargando monitor de video Remotion a 60 FPS...</span>
        </div>
      </div>
    ),
  }
);

const INITIAL_THEME: VideoTheme = {
  aspectRatio: '16:9',
  backgroundType: 'gradient',
  gradientPreset: 'spotify-moss',
  accentColor: '#1db954',
  highlightColor: '#ffffff',
  textColor: '#ffffff',
  fontSize: 56,
  secondaryFontSize: 38,
  showOriginal: true,
  showTranslation: true,
  enableBeatEffect: true,
  enableEdgePulse: true,
  edgePulseColor: '#000000',
  enableCymbalShimmer: true,
  beatSensitivity: 0.5,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Circular", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  textAlign: 'left',
  primaryText: 'translated',
  languageOrder: 'spanish-top',
  backgroundDim: 50,
  backgroundBlur: 0,
  imageScale: 100,
  imagePositionX: 50,
  imagePositionY: 50,
  imageMirror: false,
  primaryFontWeight: 'bold',
  secondaryFontWeight: 'medium',
  textShadowStyle: 'subtle',
  fontPreset: 'spotify-sans',
  verseSpacing: 32,
  beatOffsetMs: 0,
  beatDecaySpeed: 'punchy',
  enableVocalGlow: true,
  enableParticles: true,
  bassScaleIntensity: 1.0,
};

export default function Home() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [theme, setTheme] = useState<VideoTheme>(INITIAL_THEME);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [beats, setBeats] = useState<number[]>([]);
  const [cymbals, setCymbals] = useState<number[]>([]);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [notification, setNotification] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [showNewProjectConfirm, setShowNewProjectConfirm] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [savedProjectsList, setSavedProjectsList] = useState<Array<{
    fileName: string;
    title: string;
    artist: string;
    modifiedAt: string;
    sizeBytes: number;
    filePath: string;
    lyricsCount?: number;
  }>>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(false);

  const [songInfo, setSongInfo] = useState<{ title: string; artist: string; coverUrl?: string }>({
    title: '',
    artist: '',
    coverUrl: '',
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasActiveProject = lyrics.length > 0 || !!audioUrl || !!songInfo.title;

  const handleAudioFileSelect = async (file: File) => {
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    if (!songInfo.title) {
      setSongInfo((prev) => ({
        ...prev,
        title: file.name.replace(/\.[^/.]+$/, ''),
      }));
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setAudioDuration(decodedBuffer.duration);

      const analysis = await analyzeAudioBeats(file);
      if (analysis.beats && analysis.beats.length > 0) {
        setBeats(analysis.beats);
      }
      if (analysis.cymbals && analysis.cymbals.length > 0) {
        setCymbals(analysis.cymbals);
      }
      setNotification(`Audio cargado: ${analysis.beats.length} golpes de bajo y ${analysis.cymbals?.length || 0} platos identificados.`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      console.warn('Error decodificando audio para beats:', err);
    }
  };

  const handleAudioUrlAttached = (newAudioUrl: string) => {
    setAudioUrl(newAudioUrl);
    const audioEl = new Audio(newAudioUrl);
    audioEl.onloadedmetadata = () => {
      if (audioEl.duration && !isNaN(audioEl.duration)) {
        setAudioDuration(audioEl.duration);
      }
    };

    analyzeAudioBeats(newAudioUrl)
      .then((analysis) => {
        if (analysis.beats && analysis.beats.length > 0) {
          setBeats(analysis.beats);
        }
        if (analysis.cymbals && analysis.cymbals.length > 0) {
          setCymbals(analysis.cymbals);
        }
      })
      .catch((e) => console.warn('Error analizando beats:', e));

    setNotification('Audio vinculado y reproductor activado.');
    setTimeout(() => setNotification(null), 4000);
  };

  const handleImportSuccess = (data: {
    audioUrl?: string;
    lyrics: LyricLine[];
    title: string;
    artist: string;
    coverUrl?: string;
  }) => {
    if (data.audioUrl) {
      setAudioUrl(data.audioUrl);
      const audioEl = new Audio(data.audioUrl);
      audioEl.onloadedmetadata = () => {
        if (audioEl.duration && !isNaN(audioEl.duration)) {
          setAudioDuration(audioEl.duration);
        }
      };

      analyzeAudioBeats(data.audioUrl)
        .then((analysis) => {
          if (analysis.beats && analysis.beats.length > 0) {
            setBeats(analysis.beats);
          }
          if (analysis.cymbals && analysis.cymbals.length > 0) {
            setCymbals(analysis.cymbals);
          }
        })
        .catch((e) => console.warn('Error analizando beats:', e));
    }

    if (data.lyrics && data.lyrics.length > 0) {
      setLyrics(data.lyrics);
    }

    setSongInfo({
      title: data.title || 'Canción',
      artist: data.artist || 'Artista',
      coverUrl: data.coverUrl,
    });

    if (data.coverUrl) {
      setTheme((prev) => ({
        ...prev,
        backgroundType: 'image',
        backgroundUrl: data.coverUrl,
      }));
    }

    setNotification(`"${data.title || 'Canción'}" cargada. Revisa la letra y la traducción.`);
    setTimeout(() => setNotification(null), 4500);

    // Avanzar de inmediato al Paso 2: Corrección de Letra
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStep = (step: 1 | 2 | 3) => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateLyrics = (updated: LyricLine[]) => {
    setLyrics(updated);
  };

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (timeInSeconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = timeInSeconds;
    setCurrentTime(timeInSeconds);
  };

  const handleExportVideo = async () => {
    if (isRendering) return;

    setIsRendering(true);
    setNotification('Conectando con el motor Remotion a 60 FPS...');

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: songInfo.title || 'Cancion',
          artist: songInfo.artist || 'Artista',
          theme,
          audioDuration,
          lyrics,
          beats,
          cymbals,
          audioUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar el renderizado del video.');
      }

      setActiveJobId(data.jobId);
    } catch (err: unknown) {
      const error = err as Error;
      console.error(error);
      setNotification(error?.message || 'Error durante la exportación del video.');
      setTimeout(() => setNotification(null), 6000);
      setIsRendering(false);
    }
  };

  const resetToNewProject = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);

    setLyrics([]);
    setAudioUrl('');
    setAudioDuration(0);
    setBeats([]);
    setCymbals([]);
    setTheme(INITIAL_THEME);
    setSongInfo({ title: '', artist: '', coverUrl: '' });
    setCurrentStep(1);
    setShowNewProjectConfirm(false);

    setNotification('Nuevo proyecto iniciado. Puedes buscar o importar tu próxima canción.');
    setTimeout(() => setNotification(null), 4000);
  };

  const handleStartNewProject = () => {
    if (hasActiveProject) {
      setShowNewProjectConfirm(true);
    } else {
      resetToNewProject();
    }
  };

  const handleExportProject = async () => {
    try {
      const projectData: VideoProject = {
        title: songInfo.title || 'Cancion',
        artist: songInfo.artist || 'Artista',
        audioUrl: audioUrl.startsWith('blob:') ? '' : audioUrl,
        audioDuration,
        lyrics,
        theme,
        beats,
        cymbals,
        version: 1,
        exportedAt: new Date().toISOString(),
      };

      const safeTitle = (songInfo.title || 'proyecto').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `stardust_${safeTitle}.json`;

      // Guardar internamente en el servidor en public/downloads/projects/
      const res = await fetch('/api/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectData, fileName }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar el archivo en el servidor.');
      }

      setNotification(`Proyecto "${songInfo.title || 'Canción'}" guardado con éxito en el catálogo.`);
      setTimeout(() => setNotification(null), 4500);
    } catch (err: unknown) {
      const error = err as Error;
      setNotification(`Error al guardar proyecto: ${error.message}`);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const applyProjectData = (parsed: Partial<VideoProject>, defaultName: string) => {
    if (!parsed.lyrics || !Array.isArray(parsed.lyrics)) {
      throw new Error('El archivo de proyecto no contiene versos válidos.');
    }

    setLyrics(parsed.lyrics);

    if (parsed.theme) {
      setTheme((prev) => ({ ...prev, ...parsed.theme }));
    }

    if (parsed.title || parsed.artist) {
      setSongInfo({
        title: parsed.title || 'Canción',
        artist: parsed.artist || '',
      });
    }

    if (parsed.audioDuration && !isNaN(parsed.audioDuration)) {
      setAudioDuration(parsed.audioDuration);
    }

    if (parsed.beats && Array.isArray(parsed.beats)) {
      setBeats(parsed.beats);
    }

    if (parsed.cymbals && Array.isArray(parsed.cymbals)) {
      setCymbals(parsed.cymbals);
    }

    if (parsed.audioUrl && typeof parsed.audioUrl === 'string' && !parsed.audioUrl.startsWith('blob:')) {
      setAudioUrl(parsed.audioUrl);
    }

    setNotification(`Proyecto "${parsed.title || defaultName}" cargado con éxito.`);
    setTimeout(() => setNotification(null), 5000);

    // Al abrir proyecto, ir directamente al paso 2 para revisar letras
    setCurrentStep(2);
  };

  const handleOpenImportModal = async () => {
    setIsLoadingProjects(true);
    setShowImportModal(true);
    try {
      const res = await fetch('/api/project/list');
      const data = await res.json();
      if (data.projects && Array.isArray(data.projects)) {
        setSavedProjectsList(data.projects);
      }
    } catch (e) {
      console.warn('Error cargando lista de proyectos:', e);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleLoadSavedProject = async (filePath: string) => {
    try {
      const res = await fetch(filePath);
      if (!res.ok) throw new Error('No se pudo leer el archivo de proyecto.');
      const parsed = await res.json();
      applyProjectData(parsed, filePath.split('/').pop() || 'proyecto.json');
      setShowImportModal(false);
    } catch (err: unknown) {
      const error = err as Error;
      setNotification(`Error cargando proyecto: ${error.message}`);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const [deletingFileName, setDeletingFileName] = useState<string | null>(null);

  const handleDeleteProject = async (fileName: string, projectTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Estás seguro de que deseas eliminar el proyecto "${projectTitle}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingFileName(fileName);
    try {
      const res = await fetch('/api/project/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo eliminar el proyecto.');
      }

      setSavedProjectsList((prev) => prev.filter((p) => p.fileName !== fileName));
      setNotification(`Proyecto "${projectTitle}" eliminado del catálogo.`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: unknown) {
      const error = err as Error;
      setNotification(`Error eliminando proyecto: ${error.message}`);
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setDeletingFileName(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-body bg-[#090a0f] text-zinc-100 selection:bg-emerald-500 selection:text-black">
      {/* Audio Element Global */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* ========================================================================= */}
      {/* HEADER DE LA APLICACIÓN                                                  */}
      {/* ========================================================================= */}
      <header className="border-b border-zinc-800/80 sticky top-0 z-50 px-4 sm:px-6 py-2.5 bg-[#0f1219]/95 backdrop-blur-md">
        <div className="max-w-[1560px] mx-auto flex items-center justify-between gap-4">
          {/* Logo y Metadatos de la Canción */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm sm:text-base tracking-tight truncate text-white">
                  Stardust Studio
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border hidden sm:inline-block bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  VIDEO EDITOR
                </span>
              </div>
              {hasActiveProject && songInfo.title && (
                <div className="text-[11px] truncate flex items-center gap-1.5 text-zinc-400">
                  <span className="font-semibold text-zinc-200">{songInfo.title}</span>
                  {songInfo.artist && <span>· {songInfo.artist}</span>}
                  <span className="opacity-60">({audioDuration > 0 ? `${audioDuration.toFixed(1)}s` : '0s'})</span>
                </div>
              )}
            </div>
          </div>

          {/* Acciones Globales Mínimas (no redundantes) */}
          <div className="flex items-center gap-2">
            {/* Comenzar Nuevo Proyecto si ya hay uno activo */}
            {hasActiveProject && (
              <button
                type="button"
                onClick={handleStartNewProject}
                className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-700/60 transition cursor-pointer flex items-center gap-1.5"
                title="Comenzar un nuevo proyecto desde cero"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Nuevo Proyecto</span>
              </button>
            )}

            {/* Abrir JSON: modal interactivo que escanea public/downloads o permite subir archivo local */}
            <button
              type="button"
              onClick={handleOpenImportModal}
              className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-700/60 transition cursor-pointer flex items-center gap-1.5"
              title="Abrir o restaurar un archivo de proyecto (.json)"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Abrir Proyecto</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Flotante Global (Overlay sin desplazar el layout de la pantalla) */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#0f121a]/95 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 1: BUSCADOR DE UN SOLO CLIC O MÉTODO ALTERNATIVO                     */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <main className="flex-1 py-10 px-4 sm:px-8 max-w-[960px] mx-auto w-full space-y-6">
          <div className="text-center space-y-2 border-b border-zinc-800/80 pb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide">
              PASO 1 DE 3: SELECCIÓN DE CANCIÓN
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-zinc-100 tracking-tight">
              Buscador de Canciones & Ingesta
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Escribe el nombre del tema o artista para importar automáticamente el audio y las letras con 1 solo clic, o utiliza el método alternativo por enlace o archivo.
            </p>

            {hasActiveProject && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
                >
                  <span>Continuar proyecto: "{songInfo.title || 'Canción'}"</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleStartNewProject}
                  className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  Descartar y empezar nueva
                </button>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {/* Buscador de un solo clic */}
            <QuickSongSearch
              onImportSuccess={handleImportSuccess}
              onStatusChange={setNotification}
            />

            {/* Método alternativo */}
            <UrlImporter
              onImportSuccess={handleImportSuccess}
              onStatusChange={setNotification}
            />

            {/* Opción 3: Abrir Proyecto Guardado */}
            <div className="bg-[#12141c] border border-zinc-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 text-zinc-200 font-bold text-sm">
                  <FolderOpen className="w-4 h-4 text-emerald-400" />
                  <span>¿Deseas abrir un proyecto guardado?</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Explora el catálogo de tus proyectos guardados para continuar con su edición, sincronización y diseño.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenImportModal}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-700 transition cursor-pointer flex-shrink-0 flex items-center gap-2"
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Explorar Proyectos</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* PASO 2: CORRECCIÓN DE LETRA & TRADUCCIÓN (SPLIT-VIEW + REPRODUCTOR)       */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <LyricsReviewStep
          lyrics={lyrics}
          onUpdateLyrics={handleUpdateLyrics}
          songInfo={songInfo}
          audioUrl={audioUrl}
          audioDuration={audioDuration}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onTogglePlay={togglePlayAudio}
          onSeek={handleSeek}
          onProceedToEditor={() => goToStep(3)}
          onBackToSearch={() => goToStep(1)}
          onAudioUpload={handleAudioFileSelect}
          onAudioUrlAttached={handleAudioUrlAttached}
          onSaveProject={handleExportProject}
        />
      )}

      {/* ========================================================================= */}
      {/* PASO 3: EDITOR DE MARCAS DE TIEMPO, VIDEO Y EFECTOS                       */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <main className="flex-1 py-4 px-3 sm:px-6 max-w-[1560px] mx-auto w-full space-y-4">
          {/* Barra Superior del Editor */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-display flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Estudio de Video & Composición
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                · {songInfo.title} ({audioDuration > 0 ? `${audioDuration.toFixed(1)}s` : '0s'})
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/80 font-semibold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Regresar a Letras (Paso 2)</span>
              </button>

              <button
                type="button"
                onClick={handleExportProject}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/80 font-semibold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                title="Guardar proyecto en el catálogo interno"
              >
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Guardar Proyecto</span>
              </button>

              <button
                type="button"
                onClick={handleExportVideo}
                disabled={isRendering}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs px-4 py-1.5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                {isRendering ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Exportando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar Video MP4</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* FILA SUPERIOR: MONITOR DE VIDEO (IZQ) + GUIÓN DE LETRAS / TAP-TO-SYNC (DER) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* LADO IZQUIERDO (6 DE 12): MONITOR DE VIDEO REMOTION */}
            <div className="lg:col-span-6 flex flex-col">
              <VideoPreviewPlayer
                lyrics={lyrics}
                theme={theme}
                audioUrl={audioUrl}
                audioDuration={audioDuration}
                beats={beats}
                cymbals={cymbals}
                onChangeAspectRatio={(ratio) =>
                  setTheme((prev) => ({
                    ...prev,
                    aspectRatio: ratio,
                  }))
                }
              />
            </div>

            {/* LADO DERECHO (6 DE 12): GUIÓN DE LETRAS & TAP-TO-SYNC */}
            <div className="lg:col-span-6 flex flex-col">
              <StudioLyricsMonitor
                lyrics={lyrics}
                onUpdateLyrics={handleUpdateLyrics}
                currentTime={currentTime}
                audioDuration={audioDuration}
                onSeek={handleSeek}
                onTogglePlay={togglePlayAudio}
                isPlaying={isPlaying}
              />
            </div>
          </div>

          {/* FILA INFERIOR: DOCK DE PROPIEDADES & EFECTOS (HORIZONTAL EN 3 COLUMNAS) */}
          <div className="w-full">
            <ThemeCustomizer
              theme={theme}
              onChangeTheme={(updated) => setTheme((prev) => ({ ...prev, ...updated }))}
            />
          </div>
        </main>
      )}

      {/* Footer Minimalista de la Aplicación */}
      <footer className="border-t border-zinc-800/80 py-3 px-6 text-center text-xs mt-auto bg-[#0f1219] text-zinc-500">
        <div className="max-w-[1560px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 justify-center">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Stardust Studio · Motor de Videos Líricos a 60 FPS con Remotion
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            Web Audio API + Adaptive Frequency Filter
          </span>
        </div>
      </footer>

      {/* Modal Interactivo de Progreso de Renderizado */}
      <RenderProgressModal
        jobId={activeJobId}
        songTitle={songInfo.title}
        artist={songInfo.artist}
        aspectRatio={theme.aspectRatio}
        onClose={() => {
          setActiveJobId(null);
          setIsRendering(false);
        }}
        onSuccess={() => {
          setIsRendering(false);
          setNotification('Video MP4 generado y descargado con éxito.');
          setTimeout(() => setNotification(null), 6000);
        }}
      />

      {/* Modal de Confirmación para Comenzar Nuevo Proyecto */}
      {showNewProjectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#12141a] border border-zinc-800 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-zinc-100">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                <FilePlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display">¿Comenzar un nuevo proyecto?</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Proyecto en curso: <span className="text-zinc-200 font-semibold">{songInfo.title || 'Canción actual'}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed bg-[#161822] p-3 rounded-xl border border-zinc-800/80">
              Al iniciar un nuevo proyecto se limpiará la canción, la letra y las marcas de tiempo actuales para comenzar desde cero. Puedes guardar el proyecto antes de reiniciar si deseas conservar tu progreso.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  await handleExportProject();
                  resetToNewProject();
                }}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Proyecto y Nuevo</span>
              </button>

              <button
                type="button"
                onClick={resetToNewProject}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 font-semibold text-xs py-2 px-3 rounded-xl transition cursor-pointer"
              >
                Comenzar sin guardar
              </button>

              <button
                type="button"
                onClick={() => setShowNewProjectConfirm(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs py-2 px-3 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Catálogo de Proyectos Guardados */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#12141a] border border-zinc-800 p-5 rounded-2xl max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2.5 text-zinc-100">
                <FolderOpen className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold font-display">Catálogo de Proyectos</h3>
                  <p className="text-[11px] text-zinc-400">Selecciona un proyecto para abrirlo y continuar su edición</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Listado de Proyectos del Catálogo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span className="font-semibold text-zinc-300">Proyectos Disponibles</span>
                <span className="text-[10px] font-mono text-zinc-400">{savedProjectsList.length} guardados</span>
              </div>

              {isLoadingProjects ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-zinc-400 text-xs font-mono">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  <span>Cargando catálogo de proyectos...</span>
                </div>
              ) : savedProjectsList.length === 0 ? (
                <div className="p-8 bg-zinc-900/40 rounded-xl border border-zinc-800/60 text-center text-xs text-zinc-400 space-y-2">
                  <FolderOpen className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="font-medium text-zinc-300">No hay proyectos guardados en el catálogo aún.</p>
                  <p className="text-[11px] text-zinc-500">
                    Cuando guardes un proyecto desde el editor de letras o el estudio, aparecerá aquí automáticamente.
                  </p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {savedProjectsList.map((p) => (
                    <div
                      key={p.filePath}
                      className="p-3 bg-zinc-900/60 hover:bg-zinc-800/80 rounded-xl border border-zinc-800/80 hover:border-emerald-500/40 flex items-center justify-between gap-3 transition group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-zinc-100 group-hover:text-emerald-300 transition truncate">
                          {p.title || 'Sin título'}
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          {p.artist && <span className="text-zinc-300 font-medium truncate">{p.artist}</span>}
                          {p.lyricsCount !== undefined && (
                            <span className="text-zinc-500 text-[10px]">· {p.lyricsCount} versos</span>
                          )}
                          <span className="text-zinc-500 text-[10px]">· {(p.sizeBytes / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadSavedProject(p.filePath)}
                          className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:border-emerald-500 transition cursor-pointer flex items-center gap-1.5"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Abrir</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteProject(p.fileName, p.title || p.fileName, e)}
                          disabled={deletingFileName === p.fileName}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                          title="Eliminar proyecto del catálogo"
                        >
                          {deletingFileName === p.fileName ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">
                Almacenado localmente en el servidor
              </span>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs py-1.5 px-3 rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
