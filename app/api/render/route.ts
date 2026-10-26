import { NextResponse } from 'next/server';
import { startRenderJob } from '@/lib/renderManager';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const jobId = await startRenderJob(body);

    return NextResponse.json({
      success: true,
      jobId,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[Render API Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Error iniciando el job de renderizado.' },
      { status: 500 }
    );
  }
}
