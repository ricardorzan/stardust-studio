import { AudioAnalysisResult } from '@/types/lyrics';

/**
 * Filtro pasa-altos IIR digital de 1er orden (~3200Hz)
 * Aísla frecuencias altas y transientes metálicos (platillos, crash, hi-hats, percusión brillante),
 * descartando fundamentales de voz y frecuencias graves/medias.
 */
function filterHighFrequencies(channelData: Float32Array, sampleRate: number, cutoff = 3200): Float32Array {
  const filtered = new Float32Array(channelData.length);
  const rc = 1.0 / (2.0 * Math.PI * cutoff);
  const dt = 1.0 / sampleRate;
  const alpha = rc / (rc + dt);

  let prevInput = 0;
  let prevOutput = 0;

  for (let i = 0; i < channelData.length; i++) {
    const input = channelData[i];
    const output = alpha * (prevOutput + input - prevInput);
    prevInput = input;
    prevOutput = output;
    filtered[i] = output;
  }

  return filtered;
}

/**
 * Detecta transientes de agudos (platillos de la batería, hi-hats, crash) a partir del canal filtrado en altas frecuencias.
 */
function extractCymbalHits(highChannel: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.015)); // Ventanas de 15ms
  const numWindows = Math.floor(highChannel.length / windowSize);
  const energies = new Float32Array(numWindows);

  for (let i = 0; i < numWindows; i++) {
    let sumSquares = 0;
    const start = i * windowSize;
    const end = start + windowSize;
    for (let j = start; j < end; j++) {
      sumSquares += highChannel[j] * highChannel[j];
    }
    energies[i] = Math.sqrt(sumSquares / windowSize);
  }

  const localRadius = Math.floor(0.4 / 0.015); // ~400ms entorno
  const minDistanceWindows = Math.floor(0.14 / 0.015); // Mínimo 140ms entre platos

  const cymbals: number[] = [];
  let lastHitWindow = -minDistanceWindows;

  for (let i = 1; i < numWindows - 1; i++) {
    const winStart = Math.max(0, i - localRadius);
    const winEnd = Math.min(numWindows, i + localRadius);
    let sum = 0;
    for (let k = winStart; k < winEnd; k++) {
      sum += energies[k];
    }
    const localAvg = sum / (winEnd - winStart);
    const dynamicThreshold = Math.max(0.003, localAvg * 1.45);

    if (
      energies[i] > dynamicThreshold &&
      energies[i] > energies[i - 1] &&
      energies[i] >= energies[i + 1] &&
      i - lastHitWindow >= minDistanceWindows
    ) {
      const timestamp = (i * windowSize) / sampleRate;
      cymbals.push(parseFloat(timestamp.toFixed(3)));
      lastHitWindow = i;
    }
  }

  return cymbals;
}
function filterBassFrequencies(channelData: Float32Array, sampleRate: number, cutoff = 140): Float32Array {
  const filtered = new Float32Array(channelData.length);
  const rc = 1.0 / (2.0 * Math.PI * cutoff);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);

  // Dos etapas en serie para pendiente de corte de 12dB/octava
  let stage1 = 0;
  let stage2 = 0;

  for (let i = 0; i < channelData.length; i++) {
    stage1 += alpha * (channelData[i] - stage1);
    stage2 += alpha * (stage1 - stage2);
    filtered[i] = stage2;
  }

  return filtered;
}

/**
 * Utilidad avanzada para analizar audio y detectar picos rítmicos reales (kicks y transientes de graves),
 * separando frecuencias bajas y aplicando detección adaptativa local de energía.
 */
export async function analyzeAudioBeats(audioFileOrUrl: File | string): Promise<AudioAnalysisResult> {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();
    let arrayBuffer: ArrayBuffer;

    if (typeof audioFileOrUrl === 'string') {
      const response = await fetch(audioFileOrUrl);
      arrayBuffer = await response.arrayBuffer();
    } else {
      arrayBuffer = await audioFileOrUrl.arrayBuffer();
    }

    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const rawChannel = audioBuffer.getChannelData(0);

    // 1. Filtrar canal en frecuencias bajas (Kick + Bass) para evitar falsos positivos con voz o platillos
    const bassChannel = filterBassFrequencies(rawChannel, sampleRate, 140);

    // 2. Filtrar canal en frecuencias altas para transientes de platillos (crash, hi-hats, agudos)
    const highChannel = filterHighFrequencies(rawChannel, sampleRate, 3200);
    const rawCymbals = extractCymbalHits(highChannel, sampleRate);

    // 3. Procesar bajos en ventanas de 20ms para mayor precisión temporal (50fps de audio)
    const windowSize = Math.max(1, Math.floor(sampleRate * 0.02));
    const numWindows = Math.floor(bassChannel.length / windowSize);
    const energies = new Float32Array(numWindows);

    for (let i = 0; i < numWindows; i++) {
      let sumSquares = 0;
      const start = i * windowSize;
      const end = start + windowSize;
      for (let j = start; j < end; j++) {
        sumSquares += bassChannel[j] * bassChannel[j];
      }
      energies[i] = Math.sqrt(sumSquares / windowSize); // Valor RMS de la ventana
    }

    // 3. Ventana deslizante local adaptativa (~1.2s antes y después) para umbral dinámico
    const localWindowRadius = Math.floor(0.6 / 0.02); // 30 ventanas
    const minDistanceWindows = Math.floor(0.22 / 0.02); // Mínimo 220ms entre beats (~270 BPM max)

    const rawBeats: { time: number; energy: number }[] = [];
    let lastBeatWindow = -minDistanceWindows;

    for (let i = 1; i < numWindows - 1; i++) {
      // Calcular promedio local en el entorno de la ventana
      const winStart = Math.max(0, i - localWindowRadius);
      const winEnd = Math.min(numWindows, i + localWindowRadius);
      let localSum = 0;
      for (let k = winStart; k < winEnd; k++) {
        localSum += energies[k];
      }
      const localAvg = localSum / (winEnd - winStart);
      const dynamicThreshold = Math.max(0.005, localAvg * 1.38);

      // Pico local que supera el umbral y respeta la distancia mínima
      if (
        energies[i] > dynamicThreshold &&
        energies[i] > energies[i - 1] &&
        energies[i] >= energies[i + 1] &&
        i - lastBeatWindow >= minDistanceWindows
      ) {
        const timestamp = (i * windowSize) / sampleRate;
        rawBeats.push({
          time: parseFloat(timestamp.toFixed(3)),
          energy: energies[i],
        });
        lastBeatWindow = i;
      }
    }

    audioContext.close();

    if (rawBeats.length < 5) {
      return {
        duration,
        beats: generateFallbackBeats(duration, 120),
        downbeats: generateFallbackBeats(duration, 30),
        beatStrengths: new Array(Math.ceil(duration / (60 / 120))).fill(0.8),
      };
    }

    // Calcular intensidades relativas y clasificar downbeats (los más fuertes)
    const maxEnergy = Math.max(...rawBeats.map((b) => b.energy), 0.01);
    const beats: number[] = [];
    const beatStrengths: number[] = [];
    const downbeats: number[] = [];

    rawBeats.forEach((b, idx) => {
      beats.push(b.time);
      const normalizedStrength = Math.min(1.0, Math.max(0.3, b.energy / maxEnergy));
      beatStrengths.push(parseFloat(normalizedStrength.toFixed(2)));

      // Identificar downbeats: beats en el percentil superior o cada 4 golpes destacados
      if (normalizedStrength > 0.75 || idx % 4 === 0) {
        downbeats.push(b.time);
      }
    });

    const cymbals =
      rawCymbals.length >= 4
        ? rawCymbals
        : generateFallbackCymbals(beats.length > 0 ? beats : generateFallbackBeats(duration, 120));

    return {
      duration,
      beats,
      cymbals,
      downbeats,
      beatStrengths,
    };
  } catch (err) {
    console.warn('No se pudo analizar el audio detalladamente, usando beats estimados:', err);
    const fallbackBeats = generateFallbackBeats(30, 120);
    return {
      duration: 30,
      beats: fallbackBeats,
      cymbals: generateFallbackCymbals(fallbackBeats),
      downbeats: generateFallbackBeats(30, 30),
      beatStrengths: new Array(Math.ceil(30 / (60 / 120))).fill(0.8),
    };
  }
}

/**
 * Genera timestamps de platillos/agudos a contratiempo (off-beats) o subdivisión rítmica musical.
 */
export function generateFallbackCymbals(beats: number[]): number[] {
  const cymbals: number[] = [];
  for (let i = 0; i < beats.length - 1; i++) {
    const mid = (beats[i] + beats[i + 1]) / 2;
    cymbals.push(parseFloat(mid.toFixed(3)));
  }
  return cymbals;
}

/**
 * Genera beats periódicos cuando no hay archivo real o falla la decodificación (e.g. 120 BPM).
 */
export function generateFallbackBeats(duration: number, bpm = 120): number[] {
  const interval = 60 / bpm;
  const beats: number[] = [];
  for (let t = 0; t < duration; t += interval) {
    beats.push(parseFloat(t.toFixed(3)));
  }
  return beats;
}
