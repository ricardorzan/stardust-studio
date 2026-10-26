'use client';

import React, { useMemo } from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  Audio,
  Img,
} from 'remotion';
import { LyricLine, VideoTheme, TransitionCurve } from '@/types/lyrics';

export interface SpotifyLyricsCompositionProps {
  lyrics: LyricLine[];
  audioUrl?: string;
  theme: VideoTheme;
  beats?: number[];
  cymbals?: number[];
  audioDuration: number;
}

const FONT_PRESET_MAP: Record<string, string> = {
  'spotify-sans': '-apple-system, BlinkMacSystemFont, "Circular", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  'modern-inter': '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  'poppins': '"Poppins", sans-serif',
  'montserrat': '"Montserrat", sans-serif',
  'playfair-serif': '"Playfair Display", Georgia, serif',
  'roboto-mono': '"Roboto Mono", monospace',
};

const WEIGHT_MAP: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
};

// Partículas flotantes de polvo estelar atmosférico (determinísticas para Remotion)
const STARDUST_PARTICLES = [
  { x: 14, y: 16, size: 2.4, speed: 0.035, phase: 0.2 },
  { x: 82, y: 14, size: 1.8, speed: 0.045, phase: 0.8 },
  { x: 28, y: 38, size: 2.6, speed: 0.025, phase: 1.5 },
  { x: 88, y: 55, size: 1.5, speed: 0.055, phase: 2.2 },
  { x: 20, y: 72, size: 2.1, speed: 0.038, phase: 1.1 },
  { x: 68, y: 82, size: 2.3, speed: 0.032, phase: 3.1 },
  { x: 42, y: 22, size: 1.7, speed: 0.048, phase: 1.9 },
  { x: 92, y: 32, size: 2.0, speed: 0.042, phase: 2.8 },
  { x: 12, y: 52, size: 1.9, speed: 0.028, phase: 0.5 },
  { x: 52, y: 64, size: 2.5, speed: 0.036, phase: 1.3 },
  { x: 80, y: 88, size: 1.6, speed: 0.052, phase: 2.6 },
  { x: 34, y: 88, size: 2.2, speed: 0.034, phase: 2.9 },
];

/**
 * Curvas de aceleración y desaceleración suaves (Hermite / Bézier / Cubic)
 */
function easeTransition(t: number, curve: TransitionCurve = 'smooth'): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (curve === 'snappy') {
    return clamped < 0.5
      ? 2 * clamped * clamped
      : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
  }
  if (curve === 'cinematic') {
    return clamped < 0.5
      ? 8 * clamped * clamped * clamped * clamped
      : 1 - Math.pow(-2 * clamped + 2, 4) / 2;
  }
  // 'smooth' default: cubic in-out orgánico estilo Spotify
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * Parseo y mezcla de colores RGBA matemática por fotograma
 */
function parseColorToRgba(colorStr: string): [number, number, number, number] {
  if (!colorStr) return [255, 255, 255, 1];
  const str = colorStr.trim();
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        1,
      ];
    }
    if (hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        parseInt(hex.slice(6, 8), 16) / 255,
      ];
    }
  }
  const match = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (match) {
    return [
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      match[4] !== undefined ? parseFloat(match[4]) : 1,
    ];
  }
  return [255, 255, 255, 1];
}

function interpolateColorRgba(
  colorA: string,
  colorB: string,
  factor: number
): string {
  const f = Math.max(0, Math.min(1, factor));
  const c1 = parseColorToRgba(colorA);
  const c2 = parseColorToRgba(colorB);
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * f);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * f);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * f);
  const a = +(c1[3] + (c2[3] - c1[3]) * f).toFixed(3);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Calcula la posición continua del scroll virtual (en índices decimales)
 */
function getScrollProgress(
  lyrics: LyricLine[],
  currentTime: number,
  transitionDuration: number,
  curve: TransitionCurve
): number {
  if (lyrics.length === 0) return 0;
  if (currentTime < lyrics[0].startTime) return 0;

  for (let i = 0; i < lyrics.length - 1; i++) {
    const cur = lyrics[i];
    const nxt = lyrics[i + 1];

    if (nxt.startTime <= cur.startTime) continue;

    const delta = nxt.startTime - cur.startTime;
    const D = Math.min(transitionDuration, Math.max(0.3, delta * 0.5));
    const switchStart = nxt.startTime - D;
    const switchEnd = nxt.startTime;

    if (currentTime < switchStart) {
      return i;
    }
    if (currentTime <= switchEnd) {
      const progress = (currentTime - switchStart) / D;
      return i + easeTransition(progress, curve);
    }
  }

  return lyrics.length - 1;
}

/**
 * Calcula la activación continua (0.0 a 1.0) de un verso específico.
 * Sincronizado estrictamente con el progreso de scroll continuo.
 * Imposibilita cualquier rebote o salto brusco.
 */
function computeLineActivation(
  k: number,
  currentTime: number,
  scrollProgress: number,
  lyrics: LyricLine[]
): number {
  const line = lyrics[k];
  if (!line) return 0;

  // 1. Fade-in inicial elegante antes del primer verso de la canción
  if (k === 0 && currentTime < line.startTime) {
    const introStart = Math.max(0, line.startTime - 1.2);
    if (currentTime < introStart) return 0;
    const introT = (currentTime - introStart) / (line.startTime - introStart);
    return easeTransition(introT, 'smooth');
  }

  // 2. Activación matemática basada en la distancia focal continua al centro del scroll
  const dist = Math.abs(scrollProgress - k);
  if (dist >= 1.0) return 0;

  let activation = easeTransition(1.0 - dist, 'smooth');

  // 3. Atenuación limpia durante puentes o silencios largos entre versos (> 1.2s de silencio)
  const next = lyrics[k + 1];
  const nextStart = next ? next.startTime : Infinity;
  const lineEnd = line.endTime && line.endTime > line.startTime ? line.endTime : nextStart;

  if (nextStart - lineEnd > 1.2 && currentTime > lineEnd) {
    const fadeOutDuration = 0.6;
    const elapsed = currentTime - lineEnd;
    const fadeFactor = Math.max(0, 1.0 - elapsed / fadeOutDuration);
    activation *= easeTransition(fadeFactor, 'smooth');
  }

  return activation;
}

let measurementCanvas: HTMLCanvasElement | null = null;

/**
 * Mide con precisión sub-pixel el número exacto de líneas que ocupará el texto en el motor tipográfico del navegador.
 * Elimina cualquier desajuste o salto de línea fantasma generado por caracteres invisibles o aproximaciones.
 */
function measureTextLines(
  text: string,
  fontSize: number,
  fontWeight: number,
  fontFamily: string,
  availableWidth: number
): number {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 0;

  if (typeof window === 'undefined') {
    const avgWidth = fontSize * 0.45;
    const charsPerLine = Math.max(10, Math.floor(availableWidth / avgWidth));
    return Math.max(1, Math.ceil(clean.length / charsPerLine));
  }

  if (!measurementCanvas) {
    measurementCanvas = document.createElement('canvas');
  }

  const ctx = measurementCanvas.getContext('2d');
  if (!ctx) return 1;

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const singleLineWidth = ctx.measureText(clean).width;

  // Si cabe en una sola línea en el lienzo real, es 100% una sola línea
  if (singleLineWidth <= availableWidth) {
    return 1;
  }

  // Simulación fiel de salto de palabra por palabra idéntica al layout CSS
  const words = clean.split(' ');
  let lineCount = 1;
  let currentLineWidth = 0;
  const spaceWidth = ctx.measureText(' ').width;

  for (let i = 0; i < words.length; i++) {
    const wordWidth = ctx.measureText(words[i]).width;
    if (i === 0) {
      currentLineWidth = wordWidth;
    } else {
      if (currentLineWidth + spaceWidth + wordWidth <= availableWidth) {
        currentLineWidth += spaceWidth + wordWidth;
      } else {
        lineCount++;
        currentLineWidth = wordWidth;
      }
    }
  }

  return Math.max(1, lineCount);
}

interface VerseLayout {
  heights: number[];
  topOffsets: number[];
  centerOffsets: number[];
  totalHeight: number;
}

/**
 * Precalcula la altura exacta y el centro vertical de cada verso en la composición.
 * Esto erradica por completo la deriva vertical acumulativa debida a versos densos o multilínea.
 */
function computeVersesLayout(
  lyrics: LyricLine[],
  width: number,
  isVertical: boolean,
  primaryPx: number,
  secondaryPx: number,
  primaryWeight: number,
  secondaryWeight: number,
  fontFamily: string,
  isEnglishPrimary: boolean,
  showSpanish: boolean,
  showEnglish: boolean,
  isBackdrop: boolean,
  verseSpacing?: number
): VerseLayout {
  const horizPadding = isVertical ? 80 : 160;
  const containerWidth = Math.max(200, width - horizPadding * 2);
  const textMaxWidth = containerWidth * (isVertical ? 1.0 : 0.88);

  const heights: number[] = [];
  const topOffsets: number[] = [];
  const centerOffsets: number[] = [];

  const baseSpacing = verseSpacing !== undefined ? verseSpacing : (isVertical ? 40 : 30);
  const paddingBottom = isBackdrop ? Math.max(16, Math.round(baseSpacing * 0.85)) : baseSpacing;

  let currentTop = 0;

  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i];
    const isInstrumental = line.isInstrumental || line.original.trim() === '♪';

    let verseHeight = 0;

    const hasEnglish = showEnglish && !!line.original && line.original.trim() !== '' && line.original.trim() !== '♪';
    const hasSpanish = showSpanish && !!line.translated && line.translated.trim() !== '';

    if (isInstrumental) {
      const primaryHeight = primaryPx * 1.15;
      const secondaryHeight = (showSpanish && showEnglish)
        ? (secondaryPx * 1.32 + (isVertical ? 10 : 7))
        : 0;
      const paddingTop = isBackdrop ? 16 : 0;
      verseHeight = Math.round(primaryHeight + secondaryHeight + paddingBottom + paddingTop);
    } else {
      const origFontSize = isEnglishPrimary ? primaryPx : secondaryPx;
      const origWeight = isEnglishPrimary ? primaryWeight : secondaryWeight;
      const origLineHeight = isEnglishPrimary ? 1.15 : 1.32;
      const origLines = hasEnglish
        ? measureTextLines(line.original, origFontSize, origWeight, fontFamily, textMaxWidth)
        : 0;
      const origHeight = origLines * origFontSize * origLineHeight;

      const transFontSize = !isEnglishPrimary ? primaryPx : secondaryPx;
      const transWeight = !isEnglishPrimary ? primaryWeight : secondaryWeight;
      const transLineHeight = !isEnglishPrimary ? 1.15 : 1.32;
      const transLines = hasSpanish
        ? measureTextLines(line.translated || '', transFontSize, transWeight, fontFamily, textMaxWidth)
        : 0;
      const transHeight = transLines * transFontSize * transLineHeight;

      const hasBoth = hasEnglish && hasSpanish;
      const interMargin = hasBoth ? (isVertical ? 10 : 7) : 0;
      const paddingTop = isBackdrop ? 16 : 0;

      verseHeight = Math.round(origHeight + transHeight + interMargin + paddingBottom + paddingTop);
    }

    heights.push(verseHeight);
    topOffsets.push(currentTop);
    centerOffsets.push(currentTop + verseHeight / 2);
    currentTop += verseHeight;
  }

  return {
    heights,
    topOffsets,
    centerOffsets,
    totalHeight: currentTop,
  };
}

export const SpotifyLyricsComposition: React.FC<SpotifyLyricsCompositionProps> = ({
  lyrics,
  audioUrl,
  theme,
  beats = [],
  cymbals = [],
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentTime = frame / fps;

  // 1. Reactividad rítmica de alta precisión separada por instrumentos (Bajos vs. Platos)
  const beatOffsetSec = (theme.beatOffsetMs || 0) / 1000;
  const audioSyncTime = currentTime - beatOffsetSec;

  // --- A. Frecuencias Bajas (Kicks / Bombos / Bajos) -> Retumbo ambiental en bordes y fondo ---
  const decayStyle = theme.beatDecaySpeed || 'punchy';
  const decayWindow = decayStyle === 'punchy' ? 0.16 : decayStyle === 'smooth' ? 0.28 : 0.42;
  const decayExponent = decayStyle === 'punchy' ? 2.6 : decayStyle === 'smooth' ? 1.8 : 1.3;

  let bassPulse = 0;
  let isDownbeatPulse = false;

  if (theme.enableBeatEffect && beats.length > 0) {
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      const elapsed = audioSyncTime - b;

      if (elapsed >= 0 && elapsed <= decayWindow) {
        const progress = elapsed / decayWindow;
        const envelope = Math.pow(1 - progress, decayExponent);
        const currentIntensity = envelope * (theme.beatSensitivity || 0.7);

        if (currentIntensity > bassPulse) {
          bassPulse = currentIntensity;
          if (i % 4 === 0) {
            isDownbeatPulse = true;
          }
        }
      }
      if (b > audioSyncTime + 0.1) break;
    }
  }

  // --- B. Frecuencias Altas (Platos de la batería / Hi-Hats / Agudos) -> Destellos en polvo estelar ---
  const resolvedCymbals = useMemo(() => {
    if (cymbals && cymbals.length > 0) return cymbals;
    if (beats && beats.length > 1) {
      const derived: number[] = [];
      for (let i = 0; i < beats.length - 1; i++) {
        derived.push((beats[i] + beats[i + 1]) / 2);
      }
      return derived;
    }
    return [];
  }, [cymbals, beats]);

  let cymbalPulse = 0;
  const cymbalDecayWindow = 0.13; // Ataque instantáneo y decaimiento rápido de plato metálico

  if (theme.enableBeatEffect && resolvedCymbals.length > 0) {
    for (let i = 0; i < resolvedCymbals.length; i++) {
      const c = resolvedCymbals[i];
      const elapsed = audioSyncTime - c;

      if (elapsed >= 0 && elapsed <= cymbalDecayWindow) {
        const progress = elapsed / cymbalDecayWindow;
        const envelope = Math.pow(1 - progress, 2.4);
        const currentIntensity = envelope * (theme.beatSensitivity || 0.7);

        if (currentIntensity > cymbalPulse) {
          cymbalPulse = currentIntensity;
        }
      }
      if (c > audioSyncTime + 0.1) break;
    }
  }

  // 2. Ken Burns y micro-profundidad cinemática en el fondo (NUNCA en la letra)
  const backgroundZoom = 1 + (frame / (30 * 60)) * 0.05;
  const bassScaleMultiplier = theme.bassScaleIntensity || 1.0;
  const finalBgScale = backgroundZoom + bassPulse * 0.02 * bassScaleMultiplier;

  // 3. Tipografía, Dimensiones y Modos de visualización
  const isVertical = theme.aspectRatio === '9:16';
  const isCenter = theme.textAlign === 'center';
  const isSpanishPrimary = theme.primaryText !== 'original';
  const isEnglishPrimary = theme.primaryText === 'original';
  const isBackdrop = theme.textShadowStyle === 'backdrop';

  // Tipografía y Pesos
  const selectedFontFamily =
    (theme.fontPreset && FONT_PRESET_MAP[theme.fontPreset]) ||
    theme.fontFamily ||
    FONT_PRESET_MAP['spotify-sans'];

  const primaryWeight = WEIGHT_MAP[theme.primaryFontWeight || 'extrabold'] || 800;
  const secondaryWeight = WEIGHT_MAP[theme.secondaryFontWeight || 'normal'] || 500;

  // Dimensiones de texto calibradas estilo Spotify
  const primaryPx = theme.fontSize || 56;
  const secondaryPx = theme.secondaryFontSize || 38;

  const primaryFontSize = `${primaryPx}px`;
  const secondaryFontSize = `${secondaryPx}px`;

  // 4. Modelo de Layout Físico Dinámico y Centrado Focal Continuo
  const layout = useMemo(
    () =>
      computeVersesLayout(
        lyrics,
        width,
        isVertical,
        primaryPx,
        secondaryPx,
        primaryWeight,
        secondaryWeight,
        selectedFontFamily,
        isEnglishPrimary,
        theme.showTranslation,
        theme.showOriginal,
        isBackdrop,
        theme.verseSpacing
      ),
    [
      lyrics,
      width,
      isVertical,
      primaryPx,
      secondaryPx,
      primaryWeight,
      secondaryWeight,
      selectedFontFamily,
      isEnglishPrimary,
      theme.showTranslation,
      theme.showOriginal,
      isBackdrop,
      theme.verseSpacing,
    ]
  );

  const transitionDuration = theme.transitionDuration ?? 0.8;
  const transitionCurve = theme.transitionCurve ?? 'smooth';

  const currentLyricProgress = getScrollProgress(
    lyrics,
    currentTime,
    transitionDuration,
    transitionCurve
  );

  // Línea de lectura focal (38% vertical para formato 9:16 / 36% para 16:9)
  const anchorY = height * (isVertical ? 0.38 : 0.36);

  // Posición focal exacta e interpolada continuamente según el progreso de scroll
  let targetCenter = 0;
  if (lyrics.length > 0) {
    const baseIdx = Math.floor(currentLyricProgress);
    const fraction = currentLyricProgress - baseIdx;
    const clampedBase = Math.max(0, Math.min(lyrics.length - 1, baseIdx));
    const nextIdx = Math.min(lyrics.length - 1, clampedBase + 1);

    const centerA = layout.centerOffsets[clampedBase] ?? 0;
    const centerB = layout.centerOffsets[nextIdx] ?? centerA;

    targetCenter = centerA + (centerB - centerA) * fraction;
  }

  const currentScrollY = anchorY - targetCenter;

  // Paleta de gradientes Spotify
  const gradientStyles: Record<string, string> = {
    'spotify-moss': 'linear-gradient(175deg, #374233 0%, #262e23 45%, #181d16 100%)',
    spotify: 'radial-gradient(circle at 50% 25%, #1e4d2b 0%, #112618 55%, #0b130e 100%)',
    midnight: 'linear-gradient(180deg, #1f2228 0%, #121417 60%, #0a0a0c 100%)',
    sunset: 'linear-gradient(160deg, #421c28 0%, #22121e 55%, #0d0910 100%)',
    cyberpunk: 'linear-gradient(160deg, #1c2742 0%, #121829 55%, #0a0d14 100%)',
    emerald: 'linear-gradient(180deg, #134e4a 0%, #042f2e 60%, #021a19 100%)',
  };

  const currentGradient =
    gradientStyles[theme.gradientPreset] ||
    gradientStyles['spotify-moss'] ||
    gradientStyles.midnight;

  // Estilos de sombra y contraste tipográfico nítido y legible (sin distorsión de ritmo en la letra)
  const getShadowStyle = (activation: number, isPrimary: boolean): string => {
    const shadowType = theme.textShadowStyle || 'subtle';
    let base = '0 2px 10px rgba(0, 0, 0, 0.75)';

    if (shadowType === 'none') {
      base = activation > 0.4 && isPrimary ? '0 1px 4px rgba(0,0,0,0.3)' : 'none';
    } else if (shadowType === 'subtle') {
      const subtleBlur = Math.round(6 + 4 * activation);
      const alpha1 = (0.55 + 0.25 * activation).toFixed(2);
      const alpha2 = (0.65 + 0.25 * activation).toFixed(2);
      base = `0 2px ${subtleBlur}px rgba(0, 0, 0, ${alpha1}), 0 1px 3px rgba(0, 0, 0, ${alpha2})`;
    } else if (shadowType === 'glow') {
      const glowBlur = Math.round(8 + 8 * activation);
      const alphaGlow = (0.6 + 0.35 * activation).toFixed(2);
      base = `0 0 ${glowBlur}px rgba(0, 0, 0, ${alphaGlow}), 0 2px 8px rgba(0, 0, 0, 0.75)`;
    } else if (shadowType === 'strong') {
      const alphaEdge = (0.6 + 0.4 * activation).toFixed(2);
      base = `0 3px 14px rgba(0, 0, 0, ${alphaEdge}), 0 1px 4px #000000`;
    } else if (shadowType === 'backdrop') {
      base = '0 1px 4px rgba(0, 0, 0, 0.4)';
    }

    return base;
  };

  // Parámetros de imagen de fondo
  const bgScalePercent = theme.imageScale || 100;
  const bgPosX = theme.imagePositionX ?? 50;
  const bgPosY = theme.imagePositionY ?? 50;
  const bgBlurPx = theme.backgroundBlur || 0;
  const bgDimPercent = theme.backgroundDim ?? 50;

  // Atenuación de versos inactivos (configurable, default 38%)
  const inactiveOpacityRatio = (theme.dimInactiveOpacity ?? 38) / 100;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#0a0d0a',
        overflow: 'hidden',
        fontFamily: selectedFontFamily,
      }}
    >
      {/* Pista de Audio de Remotion */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* Capa de Fondo: Gradiente O Imagen con componente <Img> garantizado de Remotion */}
      {theme.backgroundType === 'gradient' || !theme.backgroundUrl ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#0a0d0a',
            backgroundImage: currentGradient,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: `scale(${finalBgScale})`,
            zIndex: 1,
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#0a0d0a',
            overflow: 'hidden',
            zIndex: 1,
          }}
        >
          <Img
            src={theme.backgroundUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `${bgPosX}% ${bgPosY}%`,
              transform: `scale(${finalBgScale * (bgScalePercent / 100)}) ${theme.imageMirror ? 'scaleX(-1)' : ''}`.trim(),
              transformOrigin: 'center center',
              filter: bgBlurPx > 0 ? `blur(${bgBlurPx}px)` : 'none',
            }}
          />
        </div>
      )}

      {/* Partículas de polvo estelar cinemático reactivo a los platillos/agudos ("Stardust Atmosphere") */}
      {theme.enableParticles !== false && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 2,
            overflow: 'hidden',
          }}
        >
          {STARDUST_PARTICLES.map((p, idx) => {
            const driftY = (p.y + frame * p.speed) % 100;
            const driftX = p.x + Math.sin(frame * 0.015 + p.phase) * 1.8;
            const baseAlpha = 0.16 + Math.sin(frame * 0.025 + p.phase) * 0.08;
            // Los platillos de la batería y agudos provocan un destello fino exclusivo en las partículas
            const cymbalGlint = theme.enableCymbalShimmer !== false ? cymbalPulse * 0.45 : 0;
            const alpha = Math.min(0.85, Math.max(0.12, baseAlpha + cymbalGlint));
            const particleScale = 1 + cymbalGlint * 0.35;

            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${driftX}%`,
                  top: `${driftY}%`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: `0 0 ${Math.round(p.size * (2.0 + cymbalGlint * 2.5))}px rgba(255, 255, 255, ${alpha})`,
                  opacity: alpha,
                  transform: `scale(${particleScale.toFixed(3)})`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Capa de oscurecimiento (Dimmer) regulable para contraste garantizado */}
      {theme.backgroundType === 'image' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#000000',
            opacity: bgDimPercent / 100,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Pulso de viñeta cinemática en los bordes del video (Bajos & Bombos) - Por defecto negro neutro sin alterar colores */}
      {theme.enableBeatEffect && theme.enableEdgePulse !== false && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 3,
            boxShadow:
              theme.edgePulseColor && theme.edgePulseColor !== '#000000' && theme.edgePulseColor !== 'black'
                ? `inset 0 0 ${Math.round(45 + bassPulse * 70)}px rgba(0, 0, 0, ${(0.38 + bassPulse * 0.3).toFixed(3)}), inset 0 0 ${Math.round(20 + bassPulse * 50)}px ${interpolateColorRgba('rgba(0,0,0,0)', theme.edgePulseColor, Math.min(1, bassPulse * 0.35))}`
                : `inset 0 0 ${Math.round(45 + bassPulse * 70)}px rgba(0, 0, 0, ${(0.42 + bassPulse * 0.38).toFixed(3)})`,
          }}
        />
      )}

      {/* Iluminación sutil superior para profundidad de color */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 40% 15%, rgba(255,255,255,0.06) 0%, transparent 65%)',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />

      {/* Máscara de desvanecimiento superior e inferior (Signature Spotify Fade) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(10,13,10,0.92) 0%, rgba(10,13,10,0) 18%, rgba(10,13,10,0) 80%, rgba(8,10,8,0.96) 100%)',
        }}
      />

      {/* Contenedor desplazable de versos estilo Spotify */}
      {lyrics.length === 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '40px',
            color: '#ffffff',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              backgroundColor: 'rgba(29, 185, 84, 0.15)',
              border: '1px solid rgba(29, 185, 84, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: '#1db954',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div
            style={{
              fontSize: isVertical ? '26px' : '32px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: '8px',
              fontFamily: selectedFontFamily,
            }}
          >
            Esperando Canción
          </div>
          <div
            style={{
              fontSize: isVertical ? '15px' : '17px',
              opacity: 0.6,
              maxWidth: '440px',
              lineHeight: 1.4,
              fontFamily: selectedFontFamily,
            }}
          >
            Pega un enlace de Spotify o YouTube, o busca una canción para comenzar a componer
          </div>
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            zIndex: 4,
            paddingLeft: isVertical ? '80px' : '160px',
            paddingRight: isVertical ? '80px' : '160px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isCenter ? 'center' : 'flex-start',
            textAlign: isCenter ? 'center' : 'left',
            transform: `translateY(${currentScrollY}px)`,
          }}
        >
          {lyrics.map((line, idx) => {
          // Virtualización inteligente por distancia en píxeles para mantener 60 FPS
          const verseCenter = layout.centerOffsets[idx] ?? 0;
          const distFromFocusPixels = Math.abs(verseCenter - targetCenter);
          if (distFromFocusPixels > height * 1.35) {
            return (
              <div
                key={line.id || idx}
                style={{
                  height: `${layout.heights[idx]}px`,
                  minHeight: `${layout.heights[idx]}px`,
                  width: '100%',
                }}
              />
            );
          }

          // Activación continua del verso (0.0 a 1.0)
          const activation = computeLineActivation(
            idx,
            currentTime,
            currentLyricProgress,
            lyrics
          );

          // Elevación focal táctil estilo Spotify (100% estática, sin distorsión por ritmo en el texto)
          const enableMicroScale = theme.enableMicroScale !== false;
          const lineScale = enableMicroScale ? 0.965 + 0.055 * activation : 1.0;

          // Desenfoque cinemático suave en versos fuera de foco (Aperture blur)
          const apertureBlur = (1 - activation) * 0.55;
          const filterBlur = apertureBlur > 0.08 ? `blur(${apertureBlur.toFixed(2)}px)` : 'none';

          // Colores de resaltado calibrados según la referencia visual de Spotify
          const activeHighlight = theme.highlightColor || '#ffffff';
          const inactivePrimaryRgba = 'rgba(215, 226, 212, 0.65)';
          const inactiveSecondaryRgba = 'rgba(195, 210, 192, 0.48)';

          const isEnglishPrimary = theme.primaryText === 'original';

          // Estilo para el texto PRINCIPAL (Grande, destacado)
          const mainColor = interpolateColorRgba(inactivePrimaryRgba, activeHighlight, activation);
          const mainOpacity = inactiveOpacityRatio + (1.0 - inactiveOpacityRatio) * activation;

          // Estilo para el texto SECUNDARIO (Pequeño, subtítulo subordinado)
          const subColor = interpolateColorRgba(inactiveSecondaryRgba, 'rgba(255, 255, 255, 0.85)', activation);
          const subOpacity = inactiveOpacityRatio * 0.9 + (0.88 - inactiveOpacityRatio * 0.9) * activation;

          // Asignación inequívoca según idioma seleccionado como principal
          const englishStyle = isEnglishPrimary
            ? {
                fontSize: primaryFontSize,
                fontWeight: primaryWeight,
                lineHeight: 1.15,
                letterSpacing: '-0.025em',
                color: mainColor,
                opacity: mainOpacity,
                isPrimary: true,
              }
            : {
                fontSize: secondaryFontSize,
                fontWeight: secondaryWeight,
                lineHeight: 1.32,
                letterSpacing: '-0.005em',
                color: subColor,
                opacity: subOpacity,
                isPrimary: false,
              };

          const spanishStyle = !isEnglishPrimary
            ? {
                fontSize: primaryFontSize,
                fontWeight: primaryWeight,
                lineHeight: 1.15,
                letterSpacing: '-0.025em',
                color: mainColor,
                opacity: mainOpacity,
                isPrimary: true,
              }
            : {
                fontSize: secondaryFontSize,
                fontWeight: secondaryWeight,
                lineHeight: 1.32,
                letterSpacing: '-0.005em',
                color: subColor,
                opacity: subOpacity,
                isPrimary: false,
              };

          const cleanSpanish = (line.translated || '').trim();
          const cleanEnglish = (line.original || '').trim();
          const showSpanish = theme.showTranslation && !!cleanSpanish;
          const showEnglish = theme.showOriginal && !!cleanEnglish && cleanEnglish !== '♪';
          const order = theme.languageOrder || 'english-top';

          // Componente de texto en ESPAÑOL
          const renderSpanish = (hasTopMargin: boolean) => (
            <div
              key="spanish"
              style={{
                fontSize: spanishStyle.fontSize,
                fontWeight: spanishStyle.fontWeight,
                letterSpacing: spanishStyle.letterSpacing,
                lineHeight: spanishStyle.lineHeight,
                color: spanishStyle.color,
                opacity: spanishStyle.opacity,
                maxWidth: isVertical ? '100%' : '88%',
                wordBreak: 'break-word',
                marginTop: hasTopMargin ? (isVertical ? '10px' : '7px') : 0,
                textShadow: getShadowStyle(activation, spanishStyle.isPrimary),
              }}
            >
              {cleanSpanish}
            </div>
          );

          // Componente de texto en INGLÉS
          const renderEnglish = (hasTopMargin: boolean) => (
            <div
              key="english"
              style={{
                fontSize: englishStyle.fontSize,
                fontWeight: englishStyle.fontWeight,
                letterSpacing: englishStyle.letterSpacing,
                lineHeight: englishStyle.lineHeight,
                color: englishStyle.color,
                opacity: englishStyle.opacity,
                maxWidth: isVertical ? '100%' : '88%',
                wordBreak: 'break-word',
                marginTop: hasTopMargin ? (isVertical ? '10px' : '7px') : 0,
                textShadow: getShadowStyle(activation, englishStyle.isPrimary),
              }}
            >
              {cleanEnglish}
            </div>
          );

          const isInstrumental = line.isInstrumental || line.original.trim() === '♪';

          if (isInstrumental) {
            const noteColor = interpolateColorRgba(
              inactivePrimaryRgba,
              activeHighlight,
              activation
            );

            return (
              <div
                key={line.id || idx}
                style={{
                  boxSizing: 'border-box',
                  overflow: 'visible',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: isCenter ? 'center' : 'flex-start',
                  width: '100%',
                  paddingTop: isBackdrop ? `${Math.round(16 * activation)}px` : '0px',
                  paddingBottom: isBackdrop
                    ? `${Math.round((theme.verseSpacing ?? (isVertical ? 40 : 30)) * 0.75 + 8 * activation)}px`
                    : `${theme.verseSpacing ?? (isVertical ? 40 : 30)}px`,
                  paddingLeft: isBackdrop ? `${Math.round(24 * activation)}px` : '0px',
                  paddingRight: isBackdrop ? `${Math.round(24 * activation)}px` : '0px',
                  backgroundColor: isBackdrop
                    ? `rgba(0, 0, 0, ${(0.52 * activation).toFixed(3)})`
                    : 'transparent',
                  backdropFilter:
                    isBackdrop && activation > 0.08
                      ? `blur(${Math.round(12 * activation)}px)`
                      : 'none',
                  WebkitBackdropFilter:
                    isBackdrop && activation > 0.08
                      ? `blur(${Math.round(12 * activation)}px)`
                      : 'none',
                  borderRadius: isBackdrop ? `${Math.round(20 * activation)}px` : '0px',
                  border: isBackdrop
                    ? `1px solid rgba(255, 255, 255, ${(0.15 * activation).toFixed(3)})`
                    : 'none',
                  boxShadow: isBackdrop
                    ? `0 8px 32px rgba(0,0,0, ${(0.45 * activation).toFixed(3)})`
                    : 'none',
                  transformOrigin: isCenter ? 'center center' : 'left center',
                  transform: `scale(${lineScale.toFixed(4)})`,
                  filter: filterBlur,
                }}
              >
                <div
                  style={{
                    fontSize: primaryFontSize,
                    fontWeight: primaryWeight,
                    lineHeight: 1.15,
                    letterSpacing: '-0.025em',
                    color: noteColor,
                    opacity: mainOpacity,
                    textShadow: getShadowStyle(activation, true),
                  }}
                >
                  ♪
                </div>
                {/* Espacio inferior reservado para mantener el ritmo visual y altura equivalente a la línea secundaria */}
                {showSpanish && showEnglish && (
                  <div
                    style={{
                      height: `${Math.round(secondaryPx * 1.32)}px`,
                      marginTop: isVertical ? '10px' : '7px',
                      width: '100%',
                    }}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          }

          return (
            <div
              key={line.id || idx}
              style={{
                boxSizing: 'border-box',
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                width: '100%',
                paddingTop: isBackdrop ? `${Math.round(16 * activation)}px` : '0px',
                paddingBottom: isBackdrop
                  ? `${Math.round((theme.verseSpacing ?? (isVertical ? 40 : 30)) * 0.75 + 8 * activation)}px`
                  : `${theme.verseSpacing ?? (isVertical ? 40 : 30)}px`,
                paddingLeft: isBackdrop ? `${Math.round(24 * activation)}px` : '0px',
                paddingRight: isBackdrop ? `${Math.round(24 * activation)}px` : '0px',
                backgroundColor: isBackdrop
                  ? `rgba(0, 0, 0, ${(0.52 * activation).toFixed(3)})`
                  : 'transparent',
                backdropFilter:
                  isBackdrop && activation > 0.08
                    ? `blur(${Math.round(12 * activation)}px)`
                    : 'none',
                WebkitBackdropFilter:
                  isBackdrop && activation > 0.08
                    ? `blur(${Math.round(12 * activation)}px)`
                    : 'none',
                borderRadius: isBackdrop ? `${Math.round(20 * activation)}px` : '0px',
                border: isBackdrop
                  ? `1px solid rgba(255, 255, 255, ${(0.15 * activation).toFixed(3)})`
                  : 'none',
                boxShadow: isBackdrop
                  ? `0 8px 32px rgba(0,0,0, ${(0.45 * activation).toFixed(3)})`
                  : 'none',
                transformOrigin: isCenter ? 'center center' : 'left center',
                transform: `scale(${lineScale.toFixed(4)})`,
                filter: filterBlur,
              }}
            >
              {order === 'spanish-top' ? (
                <>
                  {showSpanish && renderSpanish(false)}
                  {showEnglish && renderEnglish(showSpanish)}
                </>
              ) : (
                <>
                  {showEnglish && renderEnglish(false)}
                  {showSpanish && renderSpanish(showEnglish)}
                </>
              )}
            </div>
          );
        })}
        </div>
      )}

      {/* Marca de agua sutil y minimalista en la esquina */}
      <div
        style={{
          position: 'absolute',
          bottom: isVertical ? '48px' : '32px',
          right: isVertical ? '64px' : '48px',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          opacity: 0.45,
          fontSize: isVertical ? '18px' : '13px',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        }}
      >
        <span
          style={{
            width: isVertical ? '10px' : '7px',
            height: isVertical ? '10px' : '7px',
            borderRadius: '50%',
            backgroundColor: theme.highlightColor || '#ffffff',
            boxShadow: '0 0 8px rgba(255,255,255,0.8)',
          }}
        />
        <span>Stardust</span>
      </div>
    </div>
  );
};
