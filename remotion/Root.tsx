import React from 'react';
import { Composition } from 'remotion';
import {
  SpotifyLyricsComposition,
  SpotifyLyricsCompositionProps,
} from './SpotifyLyricsComposition';
import { LyricLine, VideoTheme } from '@/types/lyrics';

const defaultLyrics: LyricLine[] = [];

const defaultTheme: VideoTheme = {
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
  primaryFontWeight: 'bold',
  secondaryFontWeight: 'medium',
  textShadowStyle: 'subtle',
  fontPreset: 'spotify-sans',
  beatOffsetMs: 0,
  beatDecaySpeed: 'punchy',
  enableVocalGlow: true,
  enableParticles: true,
  bassScaleIntensity: 1.0,
  transitionDuration: 0.8,
  transitionCurve: 'smooth',
  dimInactiveOpacity: 38,
  enableMicroScale: true,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Composición YouTube 16:9 */}
      <Composition<any, any>
        id="SpotifyLyricsLandscape"
        component={SpotifyLyricsComposition}
        durationInFrames={30 * 30}
        fps={30}
        width={1920}
        height={1080}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(30, Math.ceil(Number(props?.audioDuration || 30) * 30)),
          props,
        })}
        defaultProps={{
          lyrics: defaultLyrics,
          theme: defaultTheme,
          audioDuration: 30,
          beats: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5],
          cymbals: [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0],
        }}
      />

      {/* Composición Shorts / TikTok 9:16 */}
      <Composition<any, any>
        id="SpotifyLyricsPortrait"
        component={SpotifyLyricsComposition}
        durationInFrames={30 * 30}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(30, Math.ceil(Number(props?.audioDuration || 30) * 30)),
          props,
        })}
        defaultProps={{
          lyrics: defaultLyrics,
          theme: { ...defaultTheme, aspectRatio: '9:16' },
          audioDuration: 30,
          beats: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5],
          cymbals: [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0],
        }}
      />
    </>
  );
};
