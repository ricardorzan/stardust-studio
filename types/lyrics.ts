export interface LyricLine {
  id: string;
  original: string;
  translated: string;
  startTime: number; // en segundos
  endTime: number;   // en segundos
  isInstrumental?: boolean;
}

export type AspectRatio = '16:9' | '9:16';

export type BackgroundType = 'gradient' | 'solid' | 'image' | 'video';

export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';

export type TextShadowStyle = 'none' | 'subtle' | 'glow' | 'strong' | 'backdrop';

export type FontPreset =
  | 'spotify-sans'
  | 'modern-inter'
  | 'poppins'
  | 'montserrat'
  | 'playfair-serif'
  | 'roboto-mono';

export type BeatDecaySpeed = 'punchy' | 'smooth' | 'ambient';

export type TransitionCurve = 'smooth' | 'cinematic' | 'snappy';

export interface VideoTheme {
  aspectRatio: AspectRatio;
  backgroundType: BackgroundType;
  backgroundUrl?: string;
  gradientPreset: string;
  accentColor: string;
  highlightColor: string;
  textColor: string;
  fontSize: number; // en px (se adapta a 16:9 / 9:16)
  secondaryFontSize?: number; // en px opcional (default ~68% del tamaño principal)
  showOriginal: boolean;
  showTranslation: boolean;
  enableBeatEffect: boolean;
  beatSensitivity: number; // 0.1 a 1.5
  fontFamily: string;
  textAlign?: 'left' | 'center';
  primaryText?: 'original' | 'translated';
  languageOrder?: 'english-top' | 'spanish-top';
  dimInactiveOpacity?: number;

  // Personalización de Fondo e Imagen
  backgroundDim?: number;        // 0 a 100% de oscurecimiento
  backgroundBlur?: number;       // 0 a 25px de desenfoque
  imageScale?: number;           // 100 a 250% zoom
  imagePositionX?: number;       // 0 a 100% horizontal
  imagePositionY?: number;       // 0 a 100% vertical
  imageMirror?: boolean;         // Reflejar / invertir horizontalmente (efecto espejo)

  // Personalización Tipográfica & Contraste
  primaryFontWeight?: TextWeight;   // Peso de la letra principal grande
  secondaryFontWeight?: TextWeight; // Peso de la letra secundaria
  textShadowStyle?: TextShadowStyle; // Sombra / cápsula para legibilidad
  fontPreset?: FontPreset;           // Familia tipográfica seleccionada
  verseSpacing?: number;             // Separación vertical entre versos en px (14 a 70px)

  // Personalización Rítmica y Reactividad Audiovisual (Efectos de Entorno y Video)
  beatOffsetMs?: number;            // Calibración de desfase en ms (-200ms a +200ms)
  beatDecaySpeed?: BeatDecaySpeed;  // Curva de respuesta: 'punchy' (seco), 'smooth' (suave), 'ambient'
  enableEdgePulse?: boolean;        // Pulso sutil y cinemático en los bordes del video (Bajos/Bombos)
  edgePulseColor?: string;          // Color del halo de borde (default: '#000000' / negro neutro cinematográfico)
  enableCymbalShimmer?: boolean;    // Destellos en partículas de polvo estelar y borde superior (Platos/Agudos)
  enableVocalGlow?: boolean;        // Obsoleto (las letras se mantienen limpias y sin distracción)
  enableParticles?: boolean;        // Partículas atmosféricas flotantes (polvo estelar)
  bassScaleIntensity?: number;      // Factor de micro-zoom en el fondo (0.5 a 1.5)

  // Dinámica de Transición y Fluidez de Letras
  transitionDuration?: number;       // Duración de la transición entre versos en segundos (0.4s a 1.4s, default 0.8s)
  transitionCurve?: TransitionCurve; // Estilo de aceleración/desaceleración ('smooth' | 'cinematic' | 'snappy')
  enableMicroScale?: boolean;        // Elevación sutil de escala en el verso activo (default true)
}

export interface AudioAnalysisResult {
  duration: number;
  beats: number[];           // Timestamps en segundos de los beats de graves/kicks
  downbeats?: number[];       // Compases fuertes / acentos primarios
  beatStrengths?: number[];   // Intensidad normalizada (0.2 a 1.0) para cada beat
  cymbals?: number[];        // Timestamps en segundos de los platos/agudos (hi-hats, crash)
}

export interface VideoProject {
  title: string;
  artist: string;
  audioUrl: string;
  audioDuration: number; // en segundos
  lyrics: LyricLine[];
  theme: VideoTheme;
  beats: number[]; // timestamps en segundos donde hay beats
  cymbals?: number[]; // timestamps de platillos/agudos
  version?: number;
  exportedAt?: string;
}
