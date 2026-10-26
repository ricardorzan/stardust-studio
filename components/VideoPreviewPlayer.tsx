'use client';

import React, { useRef, useState } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { SpotifyLyricsComposition } from '@/remotion/SpotifyLyricsComposition';
import { LyricLine, VideoTheme } from '@/types/lyrics';
import { Monitor, Smartphone, Sparkles, Maximize2, Minimize2, Activity } from 'lucide-react';

interface VideoPreviewPlayerProps {
  lyrics: LyricLine[];
  theme: VideoTheme;
  audioUrl?: string;
  audioDuration: number;
  beats: number[];
  cymbals?: number[];
  onChangeAspectRatio: (ratio: '16:9' | '9:16') => void;
  className?: string;
}

export const VideoPreviewPlayer: React.FC<VideoPreviewPlayerProps> = ({
  lyrics,
  theme,
  audioUrl,
  audioDuration,
  beats,
  cymbals,
  onChangeAspectRatio,
  className = '',
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const [stageSize, setStageSize] = useState<'normal' | 'theater'>('theater');

  const isVertical = theme.aspectRatio === '9:16';
  const compositionWidth = isVertical ? 1080 : 1920;
  const compositionHeight = isVertical ? 1920 : 1080;
  const fps = 30;
  const durationInFrames = Math.max(30, Math.ceil((audioDuration || 30) * fps));

  const isTheater = stageSize === 'theater';
  const stageWidth = isVertical
    ? isTheater
      ? '330px'
      : '250px'
    : '100%';

  const stageMaxWidth = isVertical
    ? isTheater
      ? '360px'
      : '270px'
    : isTheater
    ? '740px'
    : '540px';

  return (
    <div className={`bg-[#12141a] border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 text-zinc-100 shadow-xl overflow-hidden h-full ${className}`}>
      {/* Controles de Vista y Escenario */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-display flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Monitor de Video Remotion
          </span>
          <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold">
            <Sparkles className="w-3 h-3" /> 60 FPS
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Switch 16:9 vs 9:16 */}
          <div className="flex items-center bg-[#181a22] p-1 rounded-xl border border-zinc-800" role="tablist" aria-label="Relación de aspecto">
            <button
              type="button"
              role="tab"
              aria-selected={!isVertical}
              onClick={() => onChangeAspectRatio('16:9')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                !isVertical
                  ? 'bg-zinc-800 text-emerald-400 shadow-xs border border-zinc-700 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Formato Horizontal (YouTube)"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">16:9</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isVertical}
              onClick={() => onChangeAspectRatio('9:16')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isVertical
                  ? 'bg-zinc-800 text-emerald-400 shadow-xs border border-zinc-700 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Formato Vertical (Shorts / TikTok)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">9:16</span>
            </button>
          </div>

          {/* Toggle de Tamaño de Escenario */}
          <button
            type="button"
            onClick={() => setStageSize(isTheater ? 'normal' : 'theater')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              isTheater
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold'
                : 'bg-[#181a22] border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title={isTheater ? 'Tamaño compacto' : 'Escenario grande'}
          >
            {isTheater ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isTheater ? 'Teatro' : 'Normal'}</span>
          </button>
        </div>
      </div>

      {/* Contenedor del Player de Remotion con Stage Escalable y Centrado */}
      <div className={`w-full flex-1 flex justify-center items-center bg-[#07080b] rounded-xl overflow-hidden p-3 transition-all border border-zinc-800/80 shadow-inner ${
        isTheater ? (isVertical ? 'min-h-[340px] sm:min-h-[420px]' : 'min-h-[320px]') : 'min-h-[300px]'
      }`}>
        <div
          style={{
            width: stageWidth,
            maxWidth: stageMaxWidth,
            aspectRatio: isVertical ? '9/16' : '16/9',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9), 0 0 1px rgba(255,255,255,0.15)',
            borderRadius: '12px',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Player
            ref={playerRef}
            component={SpotifyLyricsComposition}
            durationInFrames={durationInFrames}
            compositionWidth={compositionWidth}
            compositionHeight={compositionHeight}
            fps={fps}
            controls
            autoPlay={false}
            loop
            acknowledgeRemotionLicense
            style={{
              width: '100%',
              height: '100%',
            }}
            inputProps={{
              lyrics,
              theme,
              audioUrl,
              audioDuration,
              beats,
              cymbals,
            }}
          />
        </div>
      </div>

      {/* Barra de Acceso Rápido y Status */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1 pt-0.5">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {beats.length > 0 ? `${beats.length} beats rítmicos sincronizados` : 'Beats en tiempo real'}
        </span>
        <span className="font-mono text-zinc-400">
          {isVertical ? '1080 × 1920 (9:16)' : '1920 × 1080 (16:9)'}
        </span>
      </div>
    </div>
  );
};
