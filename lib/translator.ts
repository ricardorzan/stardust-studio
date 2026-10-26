import { GoogleGenAI } from '@google/genai';

export interface TranslatedLine {
  original: string;
  translated: string;
}

export interface TranslationResult {
  lyrics: TranslatedLine[];
  source: 'gemini' | 'google-translate' | 'fallback';
  message?: string;
}

/**
 * Limpia puntos finales innecesarios si el verso original en inglés no tenía punto.
 */
export function cleanTrailingPeriod(original: string, translated: string): string {
  let clean = translated.trim();
  if (!original.trim().endsWith('.') && clean.endsWith('.')) {
    clean = clean.replace(/\.+$/, '').trim();
  }
  return clean;
}

/**
 * Traduce una lista de versos al español.
 * 1. Intenta con Gemini IA (si GEMINI_API_KEY / GOOGLE_API_KEY está configurada)
 * 2. Si falla o no hay API key, recurre automáticamente a Google Translate gratuito
 * 3. Si todo falla, recurre a un fallback seguro
 */
export async function translateLyrics(lines: string[]): Promise<TranslationResult> {
  const cleanLines = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (cleanLines.length === 0) {
    return { lyrics: [], source: 'fallback', message: 'No hay líneas para traducir.' };
  }

  // Identificar y preservar líneas puramente instrumentales (♪)
  const isInst = (l: string) => l === '♪' || l === '♪♪' || /^\(?(instrumental|solo|music)\)?$/i.test(l);
  const vocalIndices: number[] = [];
  const vocalLines: string[] = [];

  cleanLines.forEach((line, idx) => {
    if (!isInst(line)) {
      vocalIndices.push(idx);
      vocalLines.push(line);
    }
  });

  if (vocalLines.length === 0) {
    return {
      lyrics: cleanLines.map((l) => ({ original: l, translated: '♪ Instrumental' })),
      source: 'fallback',
      message: 'Pistas instrumentales identificadas.',
    };
  }

  // 1. Intentar con Gemini si existe clave
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  if (apiKey && apiKey !== 'tu_api_key_aqui') {
    try {
      const geminiResult = await translateWithGemini(vocalLines, apiKey);
      if (geminiResult && geminiResult.length === vocalLines.length) {
        // Reensamblar con las líneas instrumentales intactas
        const fullResults: TranslatedLine[] = [];
        let vocalPtr = 0;
        for (let i = 0; i < cleanLines.length; i++) {
          if (isInst(cleanLines[i])) {
            fullResults.push({ original: '♪', translated: '♪ Instrumental' });
          } else {
            fullResults.push(geminiResult[vocalPtr++]);
          }
        }

        return {
          lyrics: fullResults,
          source: 'gemini',
          message: '¡Traducido poéticamente con Google Gemini AI!',
        };
      }
    } catch (geminiError) {
      console.warn('Fallo en traducción con Gemini, recurriendo a Google Translate:', geminiError);
    }
  }

  // 2. Fallback transparente y gratuito a Google Translate
  try {
    const googleResult = await translateWithGoogle(vocalLines);
    if (googleResult && googleResult.length === vocalLines.length) {
      const fullResults: TranslatedLine[] = [];
      let vocalPtr = 0;
      for (let i = 0; i < cleanLines.length; i++) {
        if (isInst(cleanLines[i])) {
          fullResults.push({ original: '♪', translated: '♪ Instrumental' });
        } else {
          fullResults.push(googleResult[vocalPtr++]);
        }
      }

      return {
        lyrics: fullResults,
        source: 'google-translate',
        message: apiKey
          ? 'Traducido al español con Google Translate (cuota diaria de Gemini alcanzada o motor alternativo).'
          : 'Traducido al español con Google Translate. (Opcional: configura GEMINI_API_KEY en .env.local para adaptación artística con IA)',
      };
    }
  } catch (googleError) {
    console.warn('Fallo en Google Translate gratuito:', googleError);
  }

  // 3. Fallback de emergencia
  return {
    lyrics: cleanLines.map((original) => ({
      original,
      translated: isInst(original) ? '♪ Instrumental' : original,
    })),
    source: 'fallback',
    message: 'No se pudo conectar con los servicios de traducción.',
  };
}

async function translateWithGemini(lines: string[], apiKey: string): Promise<TranslatedLine[] | null> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Eres un traductor lírico musical profesional para videos de Spotify y YouTube.
Traduce la siguiente letra del inglés al español latino neutro verso por verso con emoción y ritmo poético.
Reglas estrictas:
1. Responde ÚNICAMENTE con un arreglo JSON válido en este formato exacto:
[
  { "original": "verso en inglés", "translated": "verso en español" }
]
2. Debe contener exactamente ${lines.length} elementos en el mismo orden 1 a 1.
3. IMPORTANTE: NUNCA agregues punto final (.) a los versos traducidos a menos que el verso original termine explícitamente en punto.

Letra original:
${lines.join('\n')}`;

  // Priorizamos modelos con cuota gratuita activa en el proyecto
  const modelsToTry = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
  ];

  for (const model of modelsToTry) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout generateContent')), 5000)
      );
      const genPromise = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });
      const response: any = await Promise.race([genPromise, timeoutPromise]);
      const rawText = response.text || '';

      if (rawText) {
        const raw = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```$/i, '')
          .trim();

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === lines.length) {
          return parsed.map((item, idx) => {
            const trans = typeof item.translated === 'string' ? item.translated.trim() : lines[idx];
            return {
              original: lines[idx],
              translated: cleanTrailingPeriod(lines[idx], trans),
            };
          });
        }
      }
    } catch (err: any) {
      console.warn(`Modelo ${model} no disponible o cuota agotada:`, err?.status || err?.message || err);
      // Continúa de inmediato con el siguiente modelo sin retardos innecesarios
    }
  }

  return null;
}

async function translateWithGoogle(lines: string[]): Promise<TranslatedLine[]> {
  // Intento 1: Traducir en bloque (1 sola solicitud HTTP rápida)
  try {
    const joined = lines.join('\n');
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=' +
      encodeURIComponent(joined);

    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const data = await res.json();
      const combinedText = Array.isArray(data[0])
        ? data[0].map((item: any) => item[0]).join('')
        : '';
      const splitLines = combinedText.split('\n').map((l: string) => l.trim());

      if (splitLines.length === lines.length) {
        return lines.map((original, idx) => ({
          original,
          translated: cleanTrailingPeriod(original, splitLines[idx] || original),
        }));
      }
    }
  } catch (err) {
    console.warn('Error en traducción en bloque, pasando a línea por línea:', err);
  }

  // Intento 2: Traducir línea por línea (garantiza coincidencia exacta 1 a 1)
  const results: TranslatedLine[] = [];
  const chunkSize = 5;

  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(async (line) => {
      try {
        const singleUrl =
          'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=' +
          encodeURIComponent(line);
        const sRes = await fetch(singleUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (sRes.ok) {
          const sData = await sRes.json();
          const translated = sData[0]?.map((x: any) => x[0]).join('').trim();
          if (translated) {
            return {
              original: line,
              translated: cleanTrailingPeriod(line, translated),
            };
          }
        }
      } catch {
        // Fallback individual
      }
      return { original: line, translated: line };
    });

    const translatedChunk = await Promise.all(chunkPromises);
    results.push(...translatedChunk);
  }

  return results;
}
