import { LyricLine } from '@/types/lyrics';

export interface SpotifyTrackInfo {
  title: string;
  artist: string;
  thumbnailUrl?: string;
  duration?: number;
  query: string;
}

/**
 * Extrae información exacta y oficial de un link de Spotify (soporta links con /intl-es/, parámetros ?si=, etc.)
 * utilizando el endpoint de datos JSON oficial de Spotify Embed.
 */
export async function getSpotifyMetadata(spotifyUrl: string): Promise<SpotifyTrackInfo> {
  // Extraer el track ID del link
  const trackIdMatch = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
  if (!trackIdMatch) {
    throw new Error('No se encontró un ID de canción válido en el enlace de Spotify.');
  }

  const trackId = trackIdMatch[1];
  const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;

  try {
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (res.ok) {
      const html = await res.text();
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);

      if (nextDataMatch) {
        const json = JSON.parse(nextDataMatch[1]);
        const entity = json?.props?.pageProps?.state?.data?.entity;

        if (entity) {
          const title: string = entity.title || entity.name || '';
          const artistsList: { name: string }[] = entity.artists || [];
          const artist = artistsList.map((a) => a.name).join(', ');
          const thumbnail = entity.visualIdentity?.image?.[0]?.url || '';
          const duration = entity.duration ? entity.duration / 1000 : undefined;

          return {
            title,
            artist,
            thumbnailUrl: thumbnail,
            duration,
            query: artist ? `${artist} - ${title}` : title,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Error leyendo embed directo de Spotify, probando fallback:', err);
  }

  // Fallback con oEmbed si falla el scraping de embed
  const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`;
  const oembedRes = await fetch(oembedUrl);
  if (!oembedRes.ok) {
    throw new Error('No se pudo obtener información de Spotify. Verifica que el enlace sea público.');
  }

  const data = await oembedRes.json();
  const rawTitle: string = (data.title || '').trim();
  const thumbnail: string = data.thumbnail_url || '';

  return {
    title: rawTitle,
    artist: '',
    thumbnailUrl: thumbnail,
    query: rawTitle,
  };
}

function cleanTrackString(str: string): string {
  return str
    .replace(/\[.*?\]/g, '') // [Official Video], [Remastered]
    .replace(/\(.*?\)/g, '') // (feat. ...), (Audio)
    .replace(/official\s*(music\s*)?video/gi, '')
    .replace(/official\s*audio/gi, '')
    .replace(/official\s*lyric\s*video/gi, '')
    .replace(/lyric\s*video/gi, '')
    .replace(/visualizer/gi, '')
    .replace(/remastered(\s*\d{4})?/gi, '')
    .trim();
}

function cleanArtistString(str: string): string {
  return str
    .replace(/ - Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/Official$/i, '')
    .trim();
}

async function fetchWithRetry(url: string, maxRetries = 2): Promise<Response | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'StardustStudio/1.0 (https://github.com/stardust-studio)',
        },
      });
      if (res.status === 503 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      return res;
    } catch {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }
  return null;
}

/**
 * Consulta la API abierta de LRCLIB para obtener letras sincronizadas (.lrc con timestamps).
 * Aplica estrategia multi-etapa (/api/get prioritario, búsqueda de campos y query combinada)
 * para garantizar la recuperación de marcas de tiempo reales en lugar de texto plano.
 */
export async function fetchLyricsFromLRCLIB(
  trackName: string,
  artistName: string
): Promise<{ syncedLyrics?: string; plainLyrics?: string; source?: string } | null> {
  const cleanTrack = cleanTrackString(trackName);
  const cleanArtist = cleanArtistString(artistName);

  // 1. Probar endpoint directo oficial: /api/get?track_name=...&artist_name=...
  if (cleanTrack && cleanArtist) {
    try {
      const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      const res = await fetchWithRetry(getUrl);
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.syncedLyrics) {
          return {
            syncedLyrics: data.syncedLyrics,
            plainLyrics: data.plainLyrics || undefined,
            source: 'lrclib-get',
          };
        }
      }
    } catch (e) {
      console.warn('LRCLIB api/get fallo:', e);
    }
  }

  // 2. Probar /api/search con parámetros separados: track_name y artist_name
  if (cleanTrack && cleanArtist) {
    try {
      const searchParamsUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      const res = await fetchWithRetry(searchParamsUrl);
      if (res && res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          const matchWithSync = items.find((i: any) => i.syncedLyrics);
          if (matchWithSync && matchWithSync.syncedLyrics) {
            return {
              syncedLyrics: matchWithSync.syncedLyrics,
              plainLyrics: matchWithSync.plainLyrics || undefined,
              source: 'lrclib-search-params',
            };
          }
        }
      }
    } catch (e) {
      console.warn('LRCLIB api/search params fallo:', e);
    }
  }

  // 3. Probar /api/search con query combinada: q=Artista Canción
  const queriesToTry: string[] = [];
  if (cleanArtist && cleanTrack) queriesToTry.push(`${cleanArtist} ${cleanTrack}`);
  if (cleanTrack) queriesToTry.push(cleanTrack);
  if (trackName && trackName !== cleanTrack) queriesToTry.push(trackName);

  let fallbackPlain: string | undefined = undefined;

  for (const q of queriesToTry) {
    try {
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
      const res = await fetchWithRetry(searchUrl);
      if (res && res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          // Priorizar cualquier resultado con timestamps reales
          const matchWithSync = items.find((i: any) => i.syncedLyrics);
          if (matchWithSync && matchWithSync.syncedLyrics) {
            return {
              syncedLyrics: matchWithSync.syncedLyrics,
              plainLyrics: matchWithSync.plainLyrics || undefined,
              source: 'lrclib-search-q',
            };
          }
          if (!fallbackPlain && items[0]?.plainLyrics) {
            fallbackPlain = items[0].plainLyrics;
          }
        }
      }
    } catch (e) {
      console.warn('LRCLIB search q fallo:', e);
    }
  }

  if (fallbackPlain) {
    return { plainLyrics: fallbackPlain, source: 'lrclib-plain' };
  }

  return null;
}

/**
 * Parsea un string en formato LRC ([00:12.34] Letra) a una lista de LyricLine con startTime y endTime.
 */
export function parseLRC(lrcText: string, audioDuration = 240): LyricLine[] {
  const lines = lrcText.split('\n');
  const result: { time: number; text: string }[] = [];

  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = parseFloat(`0.${match[3]}`);
      const totalSeconds = minutes * 60 + seconds + ms;
      const text = match[4].trim();

      if (text.length > 0) {
        result.push({
          time: parseFloat(totalSeconds.toFixed(2)),
          text,
        });
      }
    }
  }

  // Ordenar por tiempo
  result.sort((a, b) => a.time - b.time);

  // Convertir a LyricLine calculando endTimes e insertando pausas instrumentales ♪ en silencios largos
  const lyricLines: LyricLine[] = [];
  let lineCounter = 1;

  for (let idx = 0; idx < result.length; idx++) {
    const item = result[idx];
    const nextTime = idx < result.length - 1 ? result[idx + 1].time : audioDuration;
    const delta = nextTime - item.time;
    const isExplicitInst =
      item.text === '♪' ||
      item.text === '♪♪' ||
      /^\(?(instrumental|solo|music|interlude)\)?$/i.test(item.text);

    // Duración estimada del canto del verso:
    // Si la distancia al siguiente verso es moderada (<= 4.5s), el verso fluye continuamente
    // hacia el siguiente para evitar vacíos o transiciones raras.
    let vocalDuration: number;
    if (isExplicitInst) {
      vocalDuration = delta;
    } else if (delta > 0 && delta <= 4.5) {
      vocalDuration = delta;
    } else {
      vocalDuration = Math.min(Math.max(3.0, item.text.length * 0.15), Math.min(6.5, delta));
    }
    const calculatedEndTime = parseFloat((item.time + vocalDuration).toFixed(2));

    lyricLines.push({
      id: `lrc-${lineCounter++}`,
      original: isExplicitInst ? '♪' : item.text,
      translated: isExplicitInst ? '♪ Instrumental' : '',
      startTime: item.time,
      endTime: isExplicitInst ? parseFloat(nextTime.toFixed(2)) : calculatedEndTime,
      isInstrumental: isExplicitInst,
    });

    // Si entre el final estimado del verso y el siguiente hay un silencio instrumental notable (> 4.0s)
    // insertamos automáticamente la línea ♪ estilo Spotify
    if (!isExplicitInst && delta > 5.5 && (nextTime - calculatedEndTime) > 3.0) {
      lyricLines.push({
        id: `lrc-${lineCounter++}`,
        original: '♪',
        translated: '♪ Instrumental',
        startTime: calculatedEndTime,
        endTime: parseFloat(nextTime.toFixed(2)),
        isInstrumental: true,
      });
    }
  }

  return lyricLines;
}

/**
 * Genera una distribución temporal proporcional e inteligente para canciones
 * que solo cuentan con texto plano (sin timestamps LRC en línea).
 * - No inicia en 0s (reserva una introducción instrumental realista).
 * - Asigna duraciones variables según la extensión de palabras de cada verso.
 */
export function generateEstimatedTimings(
  rawLines: string[],
  audioDuration = 180
): LyricLine[] {
  const cleanLines = rawLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('['));

  if (cleanLines.length === 0) return [];

  const totalDuration = audioDuration && audioDuration > 30 ? audioDuration : Math.max(120, cleanLines.length * 4.2 + 25);
  // Introducción realista de 8 a 16 segundos
  const introTime = Math.min(14, Math.max(8, totalDuration * 0.06));
  const outroMargin = 10;
  const availableTime = Math.max(30, totalDuration - introTime - outroMargin);

  // Ponderar versos según longitud de texto
  const lineWeights = cleanLines.map((line) => {
    const words = line.split(/\s+/).length;
    return Math.max(2.2, Math.min(6.5, words * 0.45 + line.length * 0.06));
  });

  const totalWeight = lineWeights.reduce((a, b) => a + b, 0);
  const scale = availableTime / totalWeight;

  let currentStart = introTime;
  const result: LyricLine[] = [];

  for (let i = 0; i < cleanLines.length; i++) {
    const text = cleanLines[i];
    const duration = parseFloat((lineWeights[i] * scale).toFixed(2));
    const start = parseFloat(currentStart.toFixed(2));
    const end = parseFloat((start + duration).toFixed(2));

    result.push({
      id: `plain-${i + 1}`,
      original: text,
      translated: '',
      startTime: start,
      endTime: end,
      isInstrumental: false,
    });

    currentStart = end;
  }

  return result;
}
