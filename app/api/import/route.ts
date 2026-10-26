import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getSpotifyMetadata, fetchLyricsFromLRCLIB, parseLRC, generateEstimatedTimings } from '@/lib/lyricsScraper';
import { fetchGeniusLyrics, getGeniusMetadataFromUrl } from '@/lib/geniusClient';
import { translateLyrics } from '@/lib/translator';
import { LyricLine } from '@/types/lyrics';

const execFileAsync = promisify(execFile);

/**
 * Limpia parámetros superfluos de enlaces de YouTube (listas de reproducción, radio, etc.)
 */
function cleanYouTubeUrl(urlStr: string): string {
  try {
    const match = urlStr.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  } catch {
    // fallback
  }
  return urlStr;
}

/**
 * Limpia títulos de YouTube para separar Artista y Título de la canción
 */
function parseArtistAndTitle(rawTitle: string, channelName?: string): { artist: string; title: string } {
  let cleaned = rawTitle
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/official\s*(music\s*)?video/gi, '')
    .replace(/official\s*audio/gi, '')
    .replace(/official\s*lyric\s*video/gi, '')
    .replace(/lyric\s*video/gi, '')
    .replace(/visualizer/gi, '')
    .replace(/audio/gi, '')
    .replace(/video/gi, '')
    .trim();

  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ');
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(' - ').trim(),
    };
  }

  return {
    artist: channelName ? channelName.replace(/ - Topic$/i, '').trim() : '',
    title: cleaned,
  };
}

/**
 * Extrae metadatos oficiales de un video de YouTube mediante yt-dlp
 */
async function getYouTubeMetadata(cleanUrl: string): Promise<{
  title: string;
  artist: string;
  thumbnailUrl: string;
  rawTitle: string;
} | null> {
  const ytdlpPath = path.join(process.cwd(), 'bin', 'yt-dlp.exe');
  if (!fs.existsSync(ytdlpPath)) return null;

  try {
    const { stdout } = await execFileAsync(
      ytdlpPath,
      ['--no-playlist', '--print', '%(title)s', '--print', '%(channel)s', '--print', '%(thumbnail)s', cleanUrl],
      { timeout: 20000 }
    );

    const lines = stdout.trim().split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const rawTitle = lines[0] || '';
    const channel = lines[1] || '';
    const thumbnailUrl = lines[2] || '';

    const parsed = parseArtistAndTitle(rawTitle, channel);

    return {
      title: parsed.title || rawTitle,
      artist: parsed.artist || channel,
      thumbnailUrl,
      rawTitle,
    };
  } catch (err) {
    console.warn('Error extrayendo metadatos rápidos de YouTube:', err);
    return null;
  }
}

/**
 * Descarga audio usando yt-dlp con fallback y soporte para node runtime
 */
async function downloadAudioWithYtDlp(
  searchQueryOrUrl: string,
  artistName: string,
  titleName: string
): Promise<{ audioUrl: string; downloadedTitle: string; error?: string }> {
  const publicAudiosDir = path.join(process.cwd(), 'public', 'downloads', 'audios');
  if (!fs.existsSync(publicAudiosDir)) {
    fs.mkdirSync(publicAudiosDir, { recursive: true });
  }

  const ytdlpPath = path.join(process.cwd(), 'bin', 'yt-dlp.exe');
  if (!fs.existsSync(ytdlpPath)) {
    return { audioUrl: '', downloadedTitle: '', error: 'yt-dlp no encontrado en bin/yt-dlp.exe' };
  }

  const safeArtist = (artistName || '').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 50);
  const safeTitle = (titleName || 'audio').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
  const fileBaseName = safeArtist ? `${safeArtist} - ${safeTitle}` : safeTitle;
  const outputTemplate = path.join(publicAudiosDir, `${fileBaseName}.%(ext)s`);

  // Detectar ruta de node.exe para el argumento --js-runtimes
  const nodeRuntimeArg = process.execPath ? `node:${process.execPath}` : 'node';

  const baseArgs = [
    '--js-runtimes',
    nodeRuntimeArg,
    '--no-playlist',
    '-f',
    'ba[ext=m4a]/ba[ext=mp3]/ba/b',
    '-o',
    outputTemplate,
    '--print',
    '%(title)s',
    '--print',
    'after_move:filepath',
  ];

  try {
    const { stdout } = await execFileAsync(ytdlpPath, [...baseArgs, searchQueryOrUrl], { timeout: 70000 });
    const lines = stdout.trim().split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const downloadedFilePath = lines.pop();
    const downloadedTitle = lines.pop() || '';

    if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
      const fileName = path.basename(downloadedFilePath);
      return { audioUrl: `/downloads/audios/${fileName}`, downloadedTitle };
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.warn('Primer intento de descarga con yt-dlp falló:', error?.message);

    // Intento secundario con query alternativa
    try {
      const fallbackQuery = searchQueryOrUrl.startsWith('http')
        ? searchQueryOrUrl
        : `ytsearch1:${artistName} ${titleName} official audio`;
      const { stdout } = await execFileAsync(ytdlpPath, [...baseArgs, fallbackQuery], { timeout: 70000 });
      const lines = stdout.trim().split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      const downloadedFilePath = lines.pop();
      const downloadedTitle = lines.pop() || '';

      if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
        const fileName = path.basename(downloadedFilePath);
        return { audioUrl: `/downloads/audios/${fileName}`, downloadedTitle };
      }
    } catch (fallbackErr: unknown) {
      const fError = fallbackErr as Error;
      console.warn('Fallback de descarga también falló:', fError?.message);
      return { audioUrl: '', downloadedTitle: '', error: fError?.message || 'Fallo al descargar audio' };
    }
  }

  return { audioUrl: '', downloadedTitle: '', error: 'No se pudo obtener el archivo de audio' };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action,
      url: rawUrl,
      title: directTitle,
      artist: directArtist,
      coverUrl: directCover,
      geniusUrl: directGeniusUrl,
    } = body;

    const url = rawUrl ? rawUrl.trim() : '';

    // MODO ESPECIAL: Solo descargar / vincular audio para una canción existente
    if (action === 'download_audio_only') {
      const targetUrl = url || '';
      const songTitle = directTitle || 'audio';
      const songArtist = directArtist || '';

      if (!targetUrl) {
        return NextResponse.json({ error: 'Debes proporcionar un enlace de YouTube o Spotify.' }, { status: 400 });
      }

      let query = targetUrl;
      let resolvedTitle = songTitle;
      let resolvedArtist = songArtist;

      if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
        query = cleanYouTubeUrl(targetUrl);
      } else if (targetUrl.includes('spotify.com')) {
        try {
          const meta = await getSpotifyMetadata(targetUrl);
          resolvedTitle = meta.title || resolvedTitle;
          resolvedArtist = meta.artist || resolvedArtist;
          query = resolvedArtist ? `ytsearch1:${resolvedArtist} - ${resolvedTitle}` : `ytsearch1:${resolvedTitle}`;
        } catch {
          query = `ytsearch1:${songArtist} - ${songTitle}`;
        }
      }

      const audioResult = await downloadAudioWithYtDlp(query, resolvedArtist, resolvedTitle);

      if (!audioResult.audioUrl) {
        return NextResponse.json(
          { error: audioResult.error || 'No se pudo descargar el audio del enlace proporcionado.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        audioUrl: audioResult.audioUrl,
        downloadedTitle: audioResult.downloadedTitle,
        title: resolvedTitle,
        artist: resolvedArtist,
      });
    }

    // FLUJO NORMAL: Ingesta Completa (Letras + Traducción + Audio)
    let searchTitle = directTitle || '';
    let artist = directArtist || '';
    let coverUrl = directCover || '';
    let geniusUrl = directGeniusUrl || '';
    let searchQuery = '';

    // Si viene por búsqueda directa 1-Click
    if (searchTitle) {
      searchQuery = artist ? `ytsearch1:${artist} - ${searchTitle}` : `ytsearch1:${searchTitle}`;
    } else if (url) {
      const isSpotify = url.includes('spotify.com');
      const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
      const isGenius = url.includes('genius.com');

      if (isYouTube) {
        const cleanUrl = cleanYouTubeUrl(url);
        searchQuery = cleanUrl;

        // Extraer título, artista y miniatura del video de YouTube antes de buscar letras
        const ytMeta = await getYouTubeMetadata(cleanUrl);
        if (ytMeta) {
          searchTitle = ytMeta.title;
          artist = ytMeta.artist;
          coverUrl = ytMeta.thumbnailUrl;
        }
      } else if (isGenius) {
        geniusUrl = url;
        const meta = await getGeniusMetadataFromUrl(url);
        if (meta) {
          searchTitle = meta.title;
          artist = meta.artist;
          coverUrl = meta.coverUrl || '';
          searchQuery = artist ? `ytsearch1:${artist} - ${searchTitle}` : `ytsearch1:${searchTitle}`;
        } else {
          return NextResponse.json({ error: 'No se pudo leer la información de la URL de Genius.' }, { status: 400 });
        }
      } else if (isSpotify) {
        try {
          const meta = await getSpotifyMetadata(url);
          searchTitle = meta.title;
          artist = meta.artist;
          coverUrl = meta.thumbnailUrl || '';
          searchQuery = meta.artist ? `ytsearch1:${meta.artist} - ${meta.title}` : `ytsearch1:${meta.title}`;
        } catch (err: unknown) {
          console.warn('Error resolviendo Spotify oEmbed:', err);
          return NextResponse.json({ error: 'No se pudo leer la información de Spotify. Verifica el enlace.' }, { status: 400 });
        }
      } else {
        searchQuery = `ytsearch1:${url}`;
      }
    } else {
      return NextResponse.json({ error: 'Debes proporcionar una canción o un enlace válido.' }, { status: 400 });
    }

    // 1. Resolver Letras (LRCLIB primero para timestamps sincronizados; Genius como respaldo universal)
    let parsedLyrics: LyricLine[] = [];
    let lyricsSource = 'none';

    if (searchTitle) {
      try {
        const lyricsData = await fetchLyricsFromLRCLIB(searchTitle, artist);
        if (lyricsData?.syncedLyrics) {
          parsedLyrics = parseLRC(lyricsData.syncedLyrics);
          lyricsSource = 'lrclib-synced';
        } else if (lyricsData?.plainLyrics) {
          const lines = lyricsData.plainLyrics.split('\n').filter((l) => l.trim().length > 0);
          parsedLyrics = generateEstimatedTimings(lines);
          lyricsSource = 'lrclib-plain';
        }
      } catch (err) {
        console.warn('Fallo consulta a LRCLIB:', err);
      }
    }

    // Si LRCLIB no arrojó resultados y tenemos URL de Genius, extraer de Genius
    if (parsedLyrics.length === 0 && geniusUrl) {
      try {
        const geniusText = await fetchGeniusLyrics(geniusUrl);
        if (geniusText) {
          const lines = geniusText
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith('[')); // descarta tags de estructura como [Chorus]

          parsedLyrics = generateEstimatedTimings(lines);
          lyricsSource = 'genius-plain';
        }
      } catch (err) {
        console.warn('Fallo consulta a Genius:', err);
      }
    }

    // 2. Traducir automáticamente al español con Gemini
    let translationDone = false;
    if (parsedLyrics.length > 0) {
      parsedLyrics = await translateLyricsWithAI(parsedLyrics);
      translationDone = true;
    }

    // 3. Descargar Audio con yt-dlp
    const audioResult = await downloadAudioWithYtDlp(searchQuery, artist, searchTitle);

    return NextResponse.json({
      success: true,
      title: searchTitle || audioResult.downloadedTitle || 'Pista Importada',
      artist: artist || 'Artista',
      downloadedTrackName: audioResult.downloadedTitle,
      coverUrl,
      audioUrl: audioResult.audioUrl,
      audioDownloaded: Boolean(audioResult.audioUrl),
      audioError: audioResult.error || null,
      lyrics: parsedLyrics,
      lyricsCount: parsedLyrics.length,
      syncedWithLRC: lyricsSource === 'lrclib-synced',
      lyricsSource,
      isTranslated: translationDone,
    });
  } catch (error) {
    console.error('Error en importación automática:', error);
    return NextResponse.json({ error: 'Ocurrió un error procesando la canción.' }, { status: 500 });
  }
}

async function translateLyricsWithAI(lyrics: LyricLine[]): Promise<LyricLine[]> {
  try {
    const originalTexts = lyrics.map((l) => l.original);
    const result = await translateLyrics(originalTexts);

    if (result.lyrics && result.lyrics.length === lyrics.length) {
      return lyrics.map((l, i) => ({
        ...l,
        translated: result.lyrics[i].translated || l.original,
      }));
    }
  } catch (err) {
    console.warn('Fallo en traducción automática durante import:', err);
  }

  return lyrics;
}
