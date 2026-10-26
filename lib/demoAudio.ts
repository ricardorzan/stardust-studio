/**
 * Genera un breve audio sintetizado (WAV en formato Blob URL) con un patrón rítmico de bajo y acordes
 * para que el usuario pueda probar la sincronización inmediatamente sin necesidad de buscar un MP3 externo.
 */
export function generateDemoAudioBuffer(): string {
  if (typeof window === 'undefined') return '';

  const sampleRate = 44100;
  const duration = 24; // 24 segundos
  const numSamples = sampleRate * duration;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // Escribir cabecera WAV
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Sintetizar ritmo: Beat kick cada 0.5s (120 BPM) + acordes suaves
  const bpm = 120;
  const beatInterval = 60 / bpm; // 0.5s

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beatPos = t % beatInterval;

    // Kick de grave
    let kick = 0;
    if (beatPos < 0.15) {
      const kickFreq = 110 * (1 - beatPos / 0.15) + 45;
      kick = Math.sin(2 * Math.PI * kickFreq * beatPos) * Math.exp(-beatPos * 25);
    }

    // Melodía suave de fondo (acorde ambiental)
    const chord =
      (Math.sin(2 * Math.PI * 220 * t) +
        Math.sin(2 * Math.PI * 261.63 * t) +
        Math.sin(2 * Math.PI * 329.63 * t)) *
      0.15;

    let sample = kick * 0.7 + chord * 0.3;
    sample = Math.max(-1, Math.min(1, sample));

    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
