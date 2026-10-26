'use client';

import React, { useState, useRef } from 'react';
import { VideoTheme, TextWeight, TextShadowStyle, FontPreset, TransitionCurve } from '@/types/lyrics';
import {
  Sliders,
  Palette,
  Zap,
  Type,
  AlignLeft,
  AlignCenter,
  Image as ImageIcon,
  ZoomIn,
  Move,
  Sun,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Clock,
  Activity,
  Layers,
  FlipHorizontal,
  Upload,
  X,
  Loader2,
} from 'lucide-react';

interface ThemeCustomizerProps {
  theme: VideoTheme;
  onChangeTheme: (updated: Partial<VideoTheme>) => void;
  className?: string;
}

const GRADIENT_PRESETS = [
  { id: 'spotify-moss', name: 'Spotify Oliva', color: 'from-[#3a4736] to-[#181d16]' },
  { id: 'spotify', name: 'Spotify Verde', color: 'from-emerald-800 to-zinc-950' },
  { id: 'midnight', name: 'Midnight', color: 'from-slate-900 to-black' },
  { id: 'sunset', name: 'Sunset Glow', color: 'from-rose-900 via-indigo-950 to-black' },
  { id: 'cyberpunk', name: 'Cyberpunk', color: 'from-purple-900 via-sky-950 to-black' },
  { id: 'emerald', name: 'Emerald Wave', color: 'from-teal-900 to-black' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Blanco Puro', hex: '#ffffff' },
  { name: 'Verde Spotify', hex: '#1db954' },
  { name: 'Cian Neón', hex: '#38bdf8' },
  { name: 'Azul Eléctrico', hex: '#3b82f6' },
  { name: 'Amarillo', hex: '#facc15' },
  { name: 'Fucsia Neón', hex: '#f43f5e' },
];

const FONT_PRESETS: { id: FontPreset; name: string; styleName: string }[] = [
  { id: 'spotify-sans', name: 'Spotify Sans', styleName: 'font-sans' },
  { id: 'modern-inter', name: 'Inter (Moderna)', styleName: 'font-sans' },
  { id: 'poppins', name: 'Poppins (Geométrica)', styleName: 'font-sans' },
  { id: 'montserrat', name: 'Montserrat (Elegante)', styleName: 'font-sans' },
  { id: 'playfair-serif', name: 'Playfair (Editorial)', styleName: 'font-serif' },
  { id: 'roboto-mono', name: 'Roboto Mono (Lo-Fi)', styleName: 'font-mono' },
];

const FONT_WEIGHTS: { id: TextWeight; label: string }[] = [
  { id: 'normal', label: 'Normal (400)' },
  { id: 'medium', label: 'Medio (500)' },
  { id: 'semibold', label: 'Semibold (600)' },
  { id: 'bold', label: 'Negrita (700)' },
  { id: 'extrabold', label: 'Extra Negrita (800)' },
];

const SHADOW_STYLES: { id: TextShadowStyle; name: string; desc: string }[] = [
  { id: 'subtle', name: 'Sombra Sutil', desc: 'Natural y cinemática' },
  { id: 'glow', name: 'Resplandor Oscuro', desc: 'Aura difusa' },
  { id: 'strong', name: 'Contorno Marcado', desc: 'Máxima separación' },
  { id: 'backdrop', name: 'Cápsula Glass', desc: 'Fondo esmerilado' },
  { id: 'none', name: 'Sin Sombra', desc: 'Texto plano' },
];

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  theme,
  onChangeTheme,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'beat' | 'transition' | 'background' | 'typography' | 'layers'>('beat');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);

  const isImageBg = theme.backgroundType === 'image';
  const bgDim = theme.backgroundDim ?? 50;
  const shadowStyle = theme.textShadowStyle || 'subtle';

  // Validador de contraste inteligente
  const isContrastAtRisk = isImageBg && bgDim < 35 && shadowStyle === 'none';

  const applyOptimalContrast = () => {
    onChangeTheme({
      backgroundDim: 55,
      textShadowStyle: 'subtle',
      backgroundBlur: Math.max(theme.backgroundBlur || 0, 3),
    });
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);

    // 1. Vista previa inmediata usando Base64 (compatible con navegador y renderizador)
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        onChangeTheme({
          backgroundType: 'image',
          backgroundUrl: dataUrl,
        });
      }
    };
    reader.readAsDataURL(file);

    // 2. Subida persistente al servidor en public/downloads/images
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          onChangeTheme({
            backgroundType: 'image',
            backgroundUrl: data.url,
          });
        }
      }
    } catch (err) {
      console.warn('Error subiendo imagen al servidor, conservando Data URL:', err);
    } finally {
      setIsUploadingImage(false);
      if (imageFileInputRef.current) {
        imageFileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={`bg-[#12141a] border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3.5 text-zinc-100 shadow-xl ${className}`}>
      {/* Barra Superior del Dock: Pestañas de Edición Horizontal */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-display">
            Propiedades & Efectos Visuales
          </span>
        </div>

        {/* Pestañas de acceso inmediato */}
        <div className="flex items-center bg-[#181a22] p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('beat')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'beat'
                ? 'bg-zinc-800 text-emerald-400 shadow-xs border border-zinc-700 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>Beat & Ritmo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transition')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'transition'
                ? 'bg-zinc-800 text-emerald-400 shadow-xs border border-zinc-700 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span>Transición & Fluidez</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('background')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'background'
                ? 'bg-zinc-800 text-emerald-400 shadow-xs border border-zinc-700 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <span>Fondo & Estilo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('typography')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'typography'
                ? 'bg-zinc-800 text-emerald-400 shadow-xs border border-zinc-700 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Type className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span>Tipografía</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('layers')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'layers'
                ? 'bg-zinc-800 text-emerald-400 shadow-xs border border-zinc-700 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>Idiomas & Capas</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO DE PESTAÑA 1: BEAT & RITMO */}
      {activeTab === 'beat' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start pt-1">
          {/* Col 1: Sensibilidad y Offset */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 cursor-pointer">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Efectos Rítmicos en el Video
              </label>
              <input
                type="checkbox"
                checked={theme.enableBeatEffect}
                onChange={(e) => onChangeTheme({ enableBeatEffect: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-500 accent-emerald-500 cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-zinc-400">
              Afecta el entorno, bordes y partículas del video. Las letras se mantienen 100% limpias y legibles.
            </p>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>Intensidad de Pulsación</span>
                <span className="font-mono font-semibold text-emerald-400">{(theme.beatSensitivity * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.05"
                value={theme.beatSensitivity}
                onChange={(e) => onChangeTheme({ beatSensitivity: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  Sincronización Rítmica (Offset)
                </span>
                <span className="font-mono font-semibold text-emerald-400">
                  {(theme.beatOffsetMs ?? 0) > 0 ? `+${theme.beatOffsetMs}ms` : `${theme.beatOffsetMs ?? 0}ms`}
                </span>
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="5"
                value={theme.beatOffsetMs ?? 0}
                onChange={(e) => onChangeTheme({ beatOffsetMs: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-[10px] text-zinc-500">
                Compensa si el golpe se ve antes o después del audio.
              </p>
            </div>
          </div>

          {/* Col 2: Estilo de Respuesta Física */}
          <div className="space-y-2 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <span className="text-[11px] font-bold text-zinc-200 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Estilo de Respuesta Física (Curva ADSR)
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: 'punchy', label: 'Punchy (Seco e Instantáneo)', sub: 'Ataque cero y decaimiento rápido (Kicks, Trap, Pop).' },
                { id: 'smooth', label: 'Smooth (Suave & Flotante)', sub: 'Decaimiento fluido (R&B, Lo-Fi, baladas).' },
                { id: 'ambient', label: 'Ambient (Cinemático)', sub: 'Respiración prolongada para música atmosférica.' },
              ].map((mode) => {
                const isSelected = (theme.beatDecaySpeed || 'punchy') === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onChangeTheme({ beatDecaySpeed: mode.id as any })}
                    className={`p-2 rounded-lg text-left transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/60 shadow-xs'
                        : 'bg-zinc-800/40 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className={`text-xs font-bold leading-tight ${isSelected ? 'text-emerald-400' : 'text-zinc-200'}`}>
                      {mode.label}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
                      {mode.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Col 3: Capas Atmosféricas Sutiles */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <span className="text-xs font-bold text-zinc-200 block">
              Efectos de Entorno & Instrumentos
            </span>

            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Pulso en bordes del video (Bajos)
              </span>
              <input
                type="checkbox"
                checked={theme.enableEdgePulse !== false}
                onChange={(e) => onChangeTheme({ enableEdgePulse: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
              />
            </div>
            <p className="text-[10px] text-zinc-500">
              Una viñeta de sombra sutil en los bordes del video con cada golpe de bombo o bajo.
            </p>

            {theme.enableEdgePulse !== false && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-400">Tono de la viñeta:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeTheme({ edgePulseColor: '#000000' })}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded border cursor-pointer ${
                      !theme.edgePulseColor || theme.edgePulseColor === '#000000'
                        ? 'bg-zinc-700 text-white border-zinc-500'
                        : 'bg-zinc-800/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    Negro neutro
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeTheme({ edgePulseColor: theme.accentColor || '#1db954' })}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded border cursor-pointer ${
                      theme.edgePulseColor && theme.edgePulseColor !== '#000000'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                        : 'bg-zinc-800/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    Color de acento
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-zinc-300 pt-2 border-t border-zinc-800">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Destello de platos en polvo estelar (Agudos)
              </span>
              <input
                type="checkbox"
                checked={theme.enableCymbalShimmer !== false}
                onChange={(e) => onChangeTheme({ enableCymbalShimmer: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
              />
            </div>
            <p className="text-[10px] text-zinc-500">
              Los platillos de la batería y agudos provocan un destello fino en las partículas.
            </p>

            <div className="flex items-center justify-between text-xs text-zinc-300 pt-2 border-t border-zinc-800">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                Polvo estelar cinemático (Stardust)
              </span>
              <input
                type="checkbox"
                checked={theme.enableParticles !== false}
                onChange={(e) => onChangeTheme({ enableParticles: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
              />
            </div>
            <p className="text-[10px] text-zinc-500">
              Micro-partículas atmosféricas de fondo que flotan suavemente.
            </p>
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA: TRANSICIÓN & FLUIDEZ */}
      {activeTab === 'transition' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start pt-1">
          {/* Col 1: Duración de Transición */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-zinc-200">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" /> Duración de Transición
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {(theme.transitionDuration ?? 0.8).toFixed(2)}s
                </span>
              </div>
              <input
                type="range"
                min="0.35"
                max="1.40"
                step="0.05"
                value={theme.transitionDuration ?? 0.8}
                onChange={(e) =>
                  onChangeTheme({ transitionDuration: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-[10px] text-zinc-400 leading-relaxed pt-1">
                Tiempo que dura el desplazamiento y desvanecimiento suave al cambiar entre versos. Un valor más alto hace la transición más pausada y continua.
              </p>
            </div>

            {/* Presets de duración */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
              <span className="text-[11px] font-semibold text-zinc-300 block">
                Presets de Duración:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Rápida', val: 0.5, sub: '0.50s' },
                  { label: 'Spotify', val: 0.8, sub: '0.80s (Óptimo)' },
                  { label: 'Balada', val: 1.15, sub: '1.15s (Lenta)' },
                ].map((item) => {
                  const isSel = Math.abs((theme.transitionDuration ?? 0.8) - item.val) < 0.04;
                  return (
                    <button
                      type="button"
                      key={item.label}
                      onClick={() => onChangeTheme({ transitionDuration: item.val })}
                      className={`p-1.5 rounded-lg text-center border transition text-xs flex flex-col items-center justify-center cursor-pointer ${
                        isSel
                          ? 'border-emerald-500 bg-emerald-500/10 font-bold text-emerald-300'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="text-[9px] text-zinc-500">{item.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Col 2: Curva de Aceleración y Micro-escala */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-zinc-200 block flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Curva de Movimiento
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'smooth', name: 'Suave', desc: 'Orgánica Spotify' },
                  { id: 'cinematic', name: 'Cinemática', desc: 'Apple Music' },
                  { id: 'snappy', name: 'Dinámica', desc: 'Precisa' },
                ].map((curve) => {
                  const isSelected = (theme.transitionCurve || 'smooth') === curve.id;
                  return (
                    <button
                      type="button"
                      key={curve.id}
                      onClick={() => onChangeTheme({ transitionCurve: curve.id as TransitionCurve })}
                      className={`p-1.5 rounded-lg text-left border transition text-xs flex flex-col cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 font-bold text-emerald-300'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="truncate">{curve.name}</span>
                      <span className="text-[9px] text-zinc-500 truncate">{curve.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-200">
                <span className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Micro-Zoom táctil en verso activo
                </span>
                <input
                  type="checkbox"
                  checked={theme.enableMicroScale !== false}
                  onChange={(e) => onChangeTheme({ enableMicroScale: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
                />
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                El verso en reproducción se expande suavemente hacia el espectador (1.02x) para darle relieve y foco natural.
              </p>
            </div>
          </div>

          {/* Col 3: Atenuación y Contraste de Versos Inactivos */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-zinc-200">
                <span>Opacidad de Versos Inactivos</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {theme.dimInactiveOpacity ?? 38}%
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="65"
                step="1"
                value={theme.dimInactiveOpacity ?? 38}
                onChange={(e) =>
                  onChangeTheme({ dimInactiveOpacity: parseInt(e.target.value, 10) })
                }
                className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-[10px] text-zinc-500 leading-relaxed pt-1">
                Controla cuánto se atenúan las estrofas anteriores y siguientes respecto al verso activo. Un valor entre 30% y 40% ofrece el equilibrio perfecto de legibilidad y contraste.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span>Transición matemática a 60 FPS garantizada sin tirones de fotogramas.</span>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA 2: FONDO & ESTILO */}
      {activeTab === 'background' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start pt-1">
          {/* Col 1: Tipo y Presets de Fondo */}
          <div className="space-y-2.5 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeTheme({ backgroundType: 'gradient' })}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  !isImageBg
                    ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-400 font-bold'
                    : 'border-zinc-800 bg-zinc-800/40 text-zinc-400'
                }`}
              >
                Gradientes Spotify
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeTheme({
                    backgroundType: 'image',
                    backgroundDim: theme.backgroundDim ?? 50,
                    imageScale: theme.imageScale ?? 100,
                    imagePositionX: theme.imagePositionX ?? 50,
                    imagePositionY: theme.imagePositionY ?? 50,
                  })
                }
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  isImageBg
                    ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-400 font-bold'
                    : 'border-zinc-800 bg-zinc-800/40 text-zinc-400'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Imagen Propia
              </button>
            </div>

            {!isImageBg ? (
              <div className="grid grid-cols-3 gap-1.5">
                {GRADIENT_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => onChangeTheme({ backgroundType: 'gradient', gradientPreset: preset.id })}
                    className={`p-1.5 rounded-lg text-left text-xs border transition flex flex-col gap-1 cursor-pointer ${
                      theme.backgroundType === 'gradient' && theme.gradientPreset === preset.id
                        ? 'border-emerald-500/80 bg-emerald-500/10 font-bold text-emerald-400'
                        : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className={`w-full h-3 rounded bg-gradient-to-r ${preset.color}`} />
                    <span className="truncate text-[10px]">{preset.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Input de archivo oculto */}
                <input
                  type="file"
                  ref={imageFileInputRef}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImageFileSelect}
                  className="hidden"
                />

                {/* Botón para subir imagen propia desde PC */}
                <button
                  type="button"
                  onClick={() => imageFileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="w-full py-2 px-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-100 rounded-xl text-xs font-semibold border border-zinc-700/80 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Cargando imagen...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Subir imagen desde tu PC</span>
                    </>
                  )}
                </button>

                {/* Campo para ingresar URL externa */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-400 block">
                    O pegar enlace / URL de imagen:
                  </label>
                  <input
                    type="text"
                    placeholder="https://ejemplo.com/fondo.jpg"
                    value={theme.backgroundUrl && !theme.backgroundUrl.startsWith('data:') ? theme.backgroundUrl : ''}
                    onChange={(e) => onChangeTheme({ backgroundUrl: e.target.value })}
                    className="w-full bg-black/60 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 font-mono focus:border-emerald-500 outline-hidden"
                  />
                </div>

                {/* Miniatura de la imagen cargada actualmente */}
                {theme.backgroundUrl && (
                  <div className="flex items-center gap-2.5 p-2 bg-black/50 rounded-xl border border-zinc-800">
                    <img
                      src={theme.backgroundUrl}
                      alt="Miniatura fondo"
                      className="w-10 h-10 rounded-lg object-cover border border-zinc-700 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-zinc-200 block truncate">
                        Imagen activa
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono block truncate">
                        {theme.backgroundUrl.startsWith('data:')
                          ? 'Archivo local de tu equipo'
                          : theme.backgroundUrl.startsWith('/downloads/')
                          ? 'Guardada en descargas'
                          : theme.backgroundUrl}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChangeTheme({ backgroundUrl: '' })}
                      className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                      title="Quitar imagen"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Col 2: Zoom, Posición y Reflejar Imagen */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                <span className="flex items-center gap-1">
                  <ZoomIn className="w-3.5 h-3.5 text-emerald-400" /> Escala / Zoom
                </span>
                <span className="font-mono text-emerald-400">{theme.imageScale || 100}%</span>
              </div>
              <input
                type="range"
                min="100"
                max="250"
                step="5"
                value={theme.imageScale || 100}
                onChange={(e) => onChangeTheme({ imageScale: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                <span className="flex items-center gap-1">
                  <Move className="w-3.5 h-3.5 text-emerald-400" /> Posición Vertical
                </span>
                <span className="font-mono">{theme.imagePositionY ?? 50}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={theme.imagePositionY ?? 50}
                onChange={(e) => onChangeTheme({ imagePositionY: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Checkbox para Reflejar / Invertir Imagen (Efecto Espejo) */}
            <div className="pt-2 border-t border-zinc-800/80">
              <label className="flex items-center justify-between text-xs font-semibold text-zinc-200 cursor-pointer select-none">
                <span className="flex items-center gap-1.5">
                  <FlipHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Reflejar imagen (espejo)</span>
                </span>
                <input
                  type="checkbox"
                  checked={!!theme.imageMirror}
                  onChange={(e) => onChangeTheme({ imageMirror: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </label>
              <p className="text-[10px] text-zinc-500 mt-1 leading-tight">
                Invierte la imagen horizontalmente para balancear la composición visual.
              </p>
            </div>
          </div>

          {/* Col 3: Oscurecimiento (Dimmer) y Bokeh Blur */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-zinc-200">
                <span className="flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-emerald-400" /> Oscurecer (Contraste)
                </span>
                <span className="font-mono text-emerald-400">{bgDim}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="95"
                step="5"
                value={bgDim}
                onChange={(e) => onChangeTheme({ backgroundDim: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-zinc-200">
                <span>Desenfoque (Bokeh)</span>
                <span className="font-mono">{theme.backgroundBlur || 0}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={theme.backgroundBlur || 0}
                onChange={(e) => onChangeTheme({ backgroundBlur: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {isContrastAtRisk && (
              <button
                type="button"
                onClick={applyOptimalContrast}
                className="w-full py-1.5 px-2 bg-amber-500 text-black font-bold rounded-lg text-[10px] hover:bg-amber-400 transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" /> Aplicar Contraste Óptimo
              </button>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA 3: TIPOGRAFÍA */}
      {activeTab === 'typography' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start pt-1">
          {/* Col 1: Fuente y Tamaño */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Familia Tipográfica:
              </label>
              <select
                value={theme.fontPreset || 'spotify-sans'}
                onChange={(e) => onChangeTheme({ fontPreset: e.target.value as FontPreset })}
                className="w-full bg-black/60 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 font-medium"
              >
                {FONT_PRESETS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Separación entre Versos */}
            <div className="space-y-1 pt-1 border-t border-zinc-800/70">
              <div className="flex justify-between text-xs font-semibold text-zinc-200">
                <span className="flex items-center gap-1">
                  <Move className="w-3.5 h-3.5 text-cyan-400" /> Separación entre Versos
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {theme.verseSpacing ?? 32}px
                </span>
              </div>
              <input
                type="range"
                min="14"
                max="70"
                step="2"
                value={theme.verseSpacing ?? 32}
                onChange={(e) => onChangeTheme({ verseSpacing: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-[10px] text-zinc-400">
                Ajusta el espacio vertical entre cada estrofa de la letra.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-zinc-200">
                <span>Tamaño Letra Principal</span>
                <span className="font-mono text-emerald-400 font-bold">{theme.fontSize || 56}px</span>
              </div>
              <input
                type="range"
                min="32"
                max="72"
                step="2"
                value={theme.fontSize || 56}
                onChange={(e) => onChangeTheme({ fontSize: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-1 pt-1 border-t border-zinc-800">
              <div className="flex justify-between text-xs font-semibold text-zinc-200">
                <span>Tamaño Letra Secundaria</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {theme.secondaryFontSize || 38}px
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="52"
                step="1"
                value={theme.secondaryFontSize || 38}
                onChange={(e) => onChangeTheme({ secondaryFontSize: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-[10px] text-zinc-400">
                Tamaño predeterminado: 38px (proporción óptima con principal 56px).
              </p>
            </div>
          </div>

          {/* Col 2: Negrilla Principal y Secundaria */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Grosor Letra Principal:
              </label>
              <select
                value={theme.primaryFontWeight || 'extrabold'}
                onChange={(e) => onChangeTheme({ primaryFontWeight: e.target.value as TextWeight })}
                className="w-full bg-black/60 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 font-medium"
              >
                {FONT_WEIGHTS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Grosor Letra Secundaria:
              </label>
              <select
                value={theme.secondaryFontWeight || 'medium'}
                onChange={(e) => onChangeTheme({ secondaryFontWeight: e.target.value as TextWeight })}
                className="w-full bg-black/60 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 font-medium"
              >
                <option value="normal">Normal (400)</option>
                <option value="medium">Medio (500)</option>
                <option value="semibold">Semibold (600)</option>
                <option value="bold">Negrita (700)</option>
              </select>
            </div>
          </div>

          {/* Col 3: Efecto de Sombra / Contraste */}
          <div className="space-y-1.5 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
              Efecto de Legibilidad / Sombra:
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {SHADOW_STYLES.map((st) => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => onChangeTheme({ textShadowStyle: st.id })}
                  className={`p-1.5 rounded-lg text-left border transition text-xs flex flex-col cursor-pointer ${
                    shadowStyle === st.id
                      ? 'border-emerald-500/80 bg-emerald-500/10 font-bold text-emerald-400'
                      : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="truncate">{st.name}</span>
                  <span className="text-[9px] opacity-75 truncate">{st.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA 4: IDIOMAS & JERARQUÍA */}
      {activeTab === 'layers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start pt-1">
          {/* Col 1: Color del Verso Activo & Alineación */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 mb-1 block">
                Color de Resaltado Activo:
              </label>
              <div className="flex items-center gap-2">
                {HIGHLIGHT_COLORS.map((col) => (
                  <button
                    type="button"
                    key={col.hex}
                    onClick={() => onChangeTheme({ highlightColor: col.hex })}
                    style={{ backgroundColor: col.hex }}
                    className={`w-6 h-6 rounded-full border border-black/40 transition transform hover:scale-110 flex items-center justify-center cursor-pointer shadow-sm ${
                      theme.highlightColor === col.hex
                        ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-black scale-110'
                        : ''
                    }`}
                    title={col.name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Alineación del Texto:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChangeTheme({ textAlign: 'left' })}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    (theme.textAlign || 'left') === 'left'
                      ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-400'
                      : 'border-zinc-800 bg-zinc-800/40 text-zinc-400'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" /> Izquierda
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTheme({ textAlign: 'center' })}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    theme.textAlign === 'center'
                      ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-400'
                      : 'border-zinc-800 bg-zinc-800/40 text-zinc-400'
                  }`}
                >
                  <AlignCenter className="w-3.5 h-3.5" /> Centrado
                </button>
              </div>
            </div>
          </div>

          {/* Col 2: Jerarquía de Idiomas */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Texto Principal (Letra Grande):
              </label>
              <select
                value={theme.primaryText || 'translated'}
                onChange={(e) => onChangeTheme({ primaryText: e.target.value as 'original' | 'translated' })}
                className="w-full bg-black/60 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 font-medium"
              >
                <option value="translated">Español (Traducción en Grande)</option>
                <option value="original">Inglés (Original en Grande)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Orden Vertical de los Idiomas:
              </label>
              <select
                value={theme.languageOrder || 'english-top'}
                onChange={(e) => onChangeTheme({ languageOrder: e.target.value as 'english-top' | 'spanish-top' })}
                className="w-full bg-black/60 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 font-medium"
              >
                <option value="english-top">Inglés arriba / Español abajo</option>
                <option value="spanish-top">Español arriba / Inglés abajo</option>
              </select>
            </div>
          </div>

          {/* Col 3: Switches de Visualización */}
          <div className="space-y-3 bg-[#161820] p-3.5 rounded-xl border border-zinc-800/80">
            <div className="flex items-center justify-between text-xs text-zinc-200">
              <span>Mostrar verso original</span>
              <input
                type="checkbox"
                checked={theme.showOriginal}
                onChange={(e) => onChangeTheme({ showOriginal: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-200 pt-2 border-t border-zinc-800">
              <span>Mostrar traducción</span>
              <input
                type="checkbox"
                checked={theme.showTranslation}
                onChange={(e) => onChangeTheme({ showTranslation: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
