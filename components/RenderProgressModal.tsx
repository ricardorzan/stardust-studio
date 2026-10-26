'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Download, X, Film, Activity } from 'lucide-react';

interface RenderProgressModalProps {
  jobId: string | null;
  songTitle: string;
  artist: string;
  aspectRatio: string;
  onClose: () => void;
  onSuccess?: (videoUrl: string) => void;
}

export const RenderProgressModal: React.FC<RenderProgressModalProps> = ({
  jobId,
  songTitle,
  artist,
  aspectRatio,
  onClose,
  onSuccess,
}) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Iniciando renderizador Remotion...');
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [status, setStatus] = useState<'bundling' | 'rendering' | 'encoding' | 'completed' | 'error'>('bundling');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const downloadedJobsRef = useRef<Set<string>>(new Set());
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!jobId) return;

    setProgress(0);
    setStatus('bundling');
    setStage('Preparando assets y aceleración por GPU...');
    setErrorMsg(null);

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/render/progress?jobId=${jobId}`);
        if (!res.ok) throw new Error('Error consultando el progreso del video.');

        const data = await res.json();

        setProgress(data.progress || 0);
        setStatus(data.status);
        if (data.stage) setStage(data.stage);
        if (data.timeRemaining) setTimeRemaining(data.timeRemaining);

        if (data.status === 'completed' && data.videoUrl) {
          clearInterval(pollInterval);
          setVideoUrl(data.videoUrl);

          if (!downloadedJobsRef.current.has(jobId)) {
            downloadedJobsRef.current.add(jobId);

            const a = document.createElement('a');
            a.href = data.videoUrl;
            a.download = data.fileName || `${artist} - ${songTitle}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (onSuccessRef.current) {
              onSuccessRef.current(data.videoUrl);
            }
          }
        } else if (data.status === 'error') {
          clearInterval(pollInterval);
          setErrorMsg(data.error || 'Ocurrió un error inesperado durante el renderizado.');
        }
      } catch (err: unknown) {
        console.warn('Fallo polling de progreso:', err);
      }
    }, 900);

    return () => clearInterval(pollInterval);
  }, [jobId, artist, songTitle]);

  if (!jobId) return null;

  const handleCancel = async () => {
    try {
      await fetch(`/api/render/progress?jobId=${jobId}`, { method: 'DELETE' });
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#12151f] border border-zinc-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 relative overflow-hidden text-zinc-100">
        {/* Glow de acento superior esmeralda */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        {/* Header con botón de cerrar */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              {status === 'completed' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : status === 'error' ? (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              ) : (
                <Film className="w-5 h-5 animate-pulse text-emerald-400" />
              )}
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-zinc-100">
                {status === 'completed'
                  ? 'Video MP4 Listo'
                  : status === 'error'
                  ? 'Error de Renderizado'
                  : 'Renderizando Video a 60 FPS'}
              </h3>
              <p className="text-xs text-zinc-400 truncate max-w-[280px]">
                {artist ? `${artist} - ` : ''}{songTitle} · {aspectRatio}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={status === 'completed' || status === 'error' ? onClose : handleCancel}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Progreso */}
        {status !== 'error' && (
          <div className="space-y-4 my-6">
            {/* Porcentaje y tiempo restante */}
            <div className="flex items-end justify-between">
              <div>
                <span className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">
                  {progress}%
                </span>
                <span className="text-xs text-zinc-400 ml-2">completado</span>
              </div>
              {timeRemaining && status === 'rendering' && (
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
                  {timeRemaining}
                </span>
              )}
            </div>

            {/* Barra de progreso */}
            <div className="w-full bg-[#0a0c12] h-2.5 rounded-full overflow-hidden p-0.5 border border-zinc-800">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-emerald-500 to-teal-400"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>

            {/* Etapa actual */}
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              {status !== 'completed' && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400 flex-shrink-0" />}
              <span className="truncate">{stage}</span>
            </div>
          </div>
        )}

        {/* Mensaje de Error */}
        {status === 'error' && (
          <div className="my-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
            <div className="font-bold">No se pudo completar el render:</div>
            <div className="font-mono text-[11px] leading-relaxed break-words">{errorMsg}</div>
          </div>
        )}

        {/* Acciones del Modal */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
          {status === 'completed' && videoUrl && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/80 font-semibold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
              <a
                href={videoUrl}
                download={`${artist} - ${songTitle}.mp4`}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-4 py-2 rounded-xl shadow-md transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar MP4 Ahora</span>
              </a>
            </>
          )}

          {status === 'error' && (
            <button
              type="button"
              onClick={onClose}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/80 font-semibold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
            >
              Cerrar
            </button>
          )}

          {status !== 'completed' && status !== 'error' && (
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 font-medium transition cursor-pointer"
            >
              Cancelar Renderizado
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
