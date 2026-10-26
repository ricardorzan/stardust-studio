import { NextRequest, NextResponse } from 'next/server';
import { searchGenius } from '@/lib/geniusClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ results: [], source: 'genius' });
    }

    const data = await searchGenius(q.trim());
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error en /api/genius/search:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al buscar canciones en Genius' },
      { status: 500 }
    );
  }
}
