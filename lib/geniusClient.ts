import * as cheerio from 'cheerio';

export interface GeniusTrackItem {
  id: number | string;
  title: string;
  artist: string;
  coverUrl: string;
  thumbnailUrl: string;
  url: string;
  hasSyncedLyrics?: boolean;
}

/**
 * Busca canciones utilizando la API oficial de Genius (genius.com).
 * Si no hay GENIUS_ACCESS_TOKEN configurado, utiliza LRCLIB de forma transparente
 * como fallback para que el usuario nunca quede bloqueado.
 */
export async function searchGenius(query: string): Promise<{ results: GeniusTrackItem[]; source: 'genius' | 'lrclib' }> {
  const token = process.env.GENIUS_ACCESS_TOKEN;

  if (token && token.trim() !== '' && token !== 'tu_genius_access_token_aqui') {
    try {
      const res = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'StardustStudio/1.0',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const hits = data?.response?.hits || [];

        const results: GeniusTrackItem[] = hits
          .filter((h: any) => h.type === 'song' && h.result)
          .slice(0, 10)
          .map((h: any) => {
            const r = h.result;
            return {
              id: r.id,
              title: r.title || '',
              artist: r.primary_artist?.name || '',
              coverUrl: r.song_art_image_url || r.header_image_url || '',
              thumbnailUrl: r.song_art_image_thumbnail_url || r.header_image_thumbnail_url || r.song_art_image_url || '',
              url: r.url || '',
            };
          });

        return { results, source: 'genius' };
      } else {
        console.warn(`[Genius API] Respuesta no exitosa (${res.status}). Usando fallback de LRCLIB.`);
      }
    } catch (err) {
      console.warn('[Genius API] Error conectando con Genius:', err);
    }
  }

  // Fallback con LRCLIB search (abierto, gratuito y sin token)
  try {
    const lrcRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'StardustStudio/1.0 (https://github.com/stardust-studio)',
      },
    });

    if (lrcRes.ok) {
      const items = await lrcRes.json();
      if (Array.isArray(items)) {
        const results: GeniusTrackItem[] = items.slice(0, 10).map((item: any) => ({
          id: item.id,
          title: item.trackName || item.name || '',
          artist: item.artistName || '',
          coverUrl: '',
          thumbnailUrl: '',
          url: '',
          hasSyncedLyrics: !!item.syncedLyrics,
        }));
        return { results, source: 'lrclib' };
      }
    }
  } catch (err) {
    console.warn('[LRCLIB Search] Fallback error:', err);
  }

  return { results: [], source: 'genius' };
}

/**
 * Extrae la letra original completa desde una página pública de Genius
 * mediante parsing HTML de alta fidelidad con Cheerio.
 */
export async function fetchGeniusLyrics(songUrl: string): Promise<string | null> {
  if (!songUrl || !songUrl.includes('genius.com')) return null;

  try {
    const res = await fetch(songUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      console.warn(`[Genius Scraper] No se pudo cargar ${songUrl} (Status ${res.status})`);
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Limpiar scripts, estilos y encabezados de colaboradores/traducciones
    $('script, style, noscript').remove();
    $('[class*="LyricsHeader"]').remove();

    const chunks: string[] = [];
    $('[data-lyrics-container="true"]').each((_, el) => {
      // Convertir <br> en saltos de línea reales
      $(el).find('br').replaceWith('\n');
      chunks.push($(el).text());
    });

    let lyrics = chunks.join('\n');
    // Eliminar texto sobrante al final como "142Embed"
    lyrics = lyrics.replace(/\d*Embed$/i, '').trim();

    return lyrics.length > 0 ? lyrics : null;
  } catch (err) {
    console.error('[Genius Scraper] Error extrayendo letra:', err);
    return null;
  }
}

/**
 * Extrae metadatos oficiales (título, artista, portada HD) directamente de un link de Genius.
 */
export async function getGeniusMetadataFromUrl(songUrl: string): Promise<{
  title: string;
  artist: string;
  coverUrl: string;
} | null> {
  try {
    const res = await fetch(songUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';

    // El og:title suele ser "Artista – Canción" o "Canción by Artista"
    let title = ogTitle;
    let artist = '';

    if (ogTitle.includes('–')) {
      const parts = ogTitle.split('–').map((p) => p.trim());
      artist = parts[0] || '';
      title = parts[1] || '';
    } else if (ogTitle.includes(' - ')) {
      const parts = ogTitle.split(' - ').map((p) => p.trim());
      artist = parts[0] || '';
      title = parts[1] || '';
    }

    return {
      title: title || 'Canción',
      artist: artist || '',
      coverUrl: ogImage,
    };
  } catch (err) {
    console.warn('[Genius Metadata] Error leyendo URL:', err);
    return null;
  }
}
