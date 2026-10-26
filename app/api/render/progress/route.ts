import { NextRequest, NextResponse } from 'next/server';
import { getRenderJob, cancelRenderJob } from '@/lib/renderManager';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Falta el parámetro jobId' }, { status: 400 });
  }

  const job = getRenderJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job no encontrado o expirado' }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    timeRemaining: job.timeRemaining,
    currentFrame: job.currentFrame,
    totalFrames: job.totalFrames,
    videoUrl: job.videoUrl,
    fileName: job.fileName,
    error: job.error,
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Falta el parámetro jobId' }, { status: 400 });
  }

  const cancelled = cancelRenderJob(jobId);
  return NextResponse.json({ success: cancelled });
}
