import { NextResponse } from 'next/server';
import { translateLyrics } from '@/lib/translator';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawLyrics = body.rawLyrics || body.text || '';

    if (!rawLyrics || typeof rawLyrics !== 'string') {
      return NextResponse.json(
        { error: 'Debes proporcionar la letra de la canción.' },
        { status: 400 }
      );
    }

    const lines = rawLyrics
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    if (lines.length === 0) {
      return NextResponse.json({ error: 'La letra está vacía.' }, { status: 400 });
    }

    const result = await translateLyrics(lines);

    return NextResponse.json({
      lyrics: result.lyrics,
      lines: result.lyrics,
      source: result.source,
      message: result.message,
    });
  } catch (error) {
    console.error('Error procesando traducción:', error);
    return NextResponse.json({ error: 'Error al procesar la traducción' }, { status: 500 });
  }
}
