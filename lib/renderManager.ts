import net from 'net';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

export interface RenderJob {
  id: string;
  status: 'bundling' | 'rendering' | 'encoding' | 'completed' | 'error';
  progress: number; // 0 a 100
  stage: string;
  timeRemaining?: string;
  currentFrame?: number;
  totalFrames?: number;
  videoUrl?: string;
  fileName?: string;
  error?: string;
  createdAt: number;
  process?: ChildProcess;
  tempPropsPath?: string;
}

// Directorio para persistencia compartida entre rutas y workers de Next.js
const JOBS_DIR = path.join(process.cwd(), 'public', 'downloads', '.jobs');

// Mapa en globalThis para evitar aislamiento de módulos en Next.js App Router
const globalForJobs = globalThis as unknown as {
  renderJobs?: Map<string, RenderJob>;
};

const jobs = globalForJobs.renderJobs || new Map<string, RenderJob>();
if (!globalForJobs.renderJobs) {
  globalForJobs.renderJobs = jobs;
}

/**
 * Guarda el estado del job en disco para que cualquier worker de Next.js
 * lo pueda leer de inmediato sin desincronización de memoria.
 */
function persistJob(job: RenderJob) {
  try {
    if (!fs.existsSync(JOBS_DIR)) {
      fs.mkdirSync(JOBS_DIR, { recursive: true });
    }
    const safeData = {
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
      createdAt: job.createdAt,
    };
    fs.writeFileSync(path.join(JOBS_DIR, `${job.id}.json`), JSON.stringify(safeData), 'utf-8');
  } catch (err) {
    console.warn('[RenderManager] Error persistiendo estado de job:', err);
  }
}

/**
 * Encuentra un puerto libre de forma dinámica para evitar colisiones.
 */
export async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 3044;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Inicia un job de renderizado en segundo plano con seguimiento en tiempo real.
 */
export async function startRenderJob(params: {
  title: string;
  artist: string;
  theme: any;
  audioDuration: number;
  lyrics: any[];
  beats: number[];
  cymbals?: number[];
  audioUrl: string;
}): Promise<string> {
  const {
    title = 'Lyric Video',
    artist = 'Artist',
    theme,
    audioDuration = 30,
    lyrics = [],
    beats = [],
    cymbals = [],
    audioUrl = '',
  } = params;

  const jobId = `render-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const publicVideosDir = path.join(process.cwd(), 'public', 'downloads', 'videos');

  if (!fs.existsSync(publicVideosDir)) {
    fs.mkdirSync(publicVideosDir, { recursive: true });
  }
  if (!fs.existsSync(JOBS_DIR)) {
    fs.mkdirSync(JOBS_DIR, { recursive: true });
  }

  const safeArtist = (artist || '').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 50);
  const safeTitle = (title || 'video').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
  const aspectLabel = theme?.aspectRatio === '9:16' ? 'Shorts 9-16' : '16-9';
  const outputFileName = `${safeArtist ? `${safeArtist} - ` : ''}${safeTitle} (${aspectLabel}).mp4`;
  const outputPath = path.join(publicVideosDir, outputFileName);

  // Audio relativo accesible vía HTTP localhost:3000
  let resolvedAudioUrl = audioUrl;
  if (audioUrl && audioUrl.startsWith('/')) {
    resolvedAudioUrl = `http://localhost:3000${audioUrl}`;
  }

  // Resolver imagen de fondo si está presente (convertir a Base64 para que Chromium la renderice 100% garantizado)
  const resolvedTheme = { ...theme };
  if (resolvedTheme?.backgroundType === 'image' && resolvedTheme.backgroundUrl) {
    const bgUrl = resolvedTheme.backgroundUrl.trim();
    if (bgUrl.startsWith('/')) {
      // Archivo local en public/
      const localImgPath = path.join(process.cwd(), 'public', bgUrl.replace(/^\//, ''));
      if (fs.existsSync(localImgPath)) {
        try {
          const ext = path.extname(localImgPath).toLowerCase().replace('.', '');
          const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
          const imgBuffer = fs.readFileSync(localImgPath);
          resolvedTheme.backgroundUrl = `data:${mime};base64,${imgBuffer.toString('base64')}`;
          console.log(`[RenderManager] Imagen de fondo local convertida a Base64 (${(imgBuffer.length / 1024).toFixed(1)} KB)`);
        } catch (e) {
          console.warn('[RenderManager] Error leyendo imagen local:', e);
          resolvedTheme.backgroundUrl = `http://localhost:3000${bgUrl}`;
        }
      } else {
        resolvedTheme.backgroundUrl = `http://localhost:3000${bgUrl}`;
      }
    } else if (bgUrl.startsWith('http://') || bgUrl.startsWith('https://')) {
      try {
        const imgRes = await fetch(bgUrl);
        if (imgRes.ok) {
          const ab = await imgRes.arrayBuffer();
          const cType = imgRes.headers.get('content-type') || 'image/jpeg';
          resolvedTheme.backgroundUrl = `data:${cType};base64,${Buffer.from(ab).toString('base64')}`;
          console.log(`[RenderManager] Imagen de fondo remota precargada y convertida a Base64`);
        }
      } catch (e) {
        console.warn('[RenderManager] Error precargando imagen remota:', e);
      }
    }
  }

  // Guardar archivo temporal dentro de .jobs para mantener la carpeta de descargas limpia
  const tempPropsPath = path.join(JOBS_DIR, `props-${jobId}.json`);
  const propsPayload = {
    lyrics,
    theme: resolvedTheme,
    audioDuration,
    beats,
    cymbals,
    audioUrl: resolvedAudioUrl,
  };
  fs.writeFileSync(tempPropsPath, JSON.stringify(propsPayload, null, 2), 'utf-8');

  const compositionId =
    theme?.aspectRatio === '9:16' ? 'SpotifyLyricsPortrait' : 'SpotifyLyricsLandscape';
  const fps = 30;
  const totalFrames = Math.max(30, Math.ceil(audioDuration * fps));

  const port = await getAvailablePort();
  const entryPoint = path.join(process.cwd(), 'remotion', 'index.ts');
  const cliScript = path.join(process.cwd(), 'node_modules', '@remotion', 'cli', 'remotion-cli.js');

  const args = [
    cliScript,
    'render',
    entryPoint,
    compositionId,
    outputPath,
    `--props=${tempPropsPath}`,
    `--frames=0-${totalFrames - 1}`,
    `--port=${port}`,
    '--overwrite',
    '--concurrency=4',
    '--x264-preset=veryfast',
    '--gl=angle',
    '--image-format=jpeg',
    '--jpeg-quality=85',
    '--pixel-format=yuv420p',
  ];

  const job: RenderJob = {
    id: jobId,
    status: 'bundling',
    progress: 0,
    stage: 'Iniciando empaquetado y aceleración GPU...',
    totalFrames,
    fileName: `${artist ? `${artist} - ` : ''}${title} (${theme?.aspectRatio?.replace(':', '-') || '16-9'}).mp4`,
    createdAt: Date.now(),
    tempPropsPath,
  };

  jobs.set(jobId, job);
  persistJob(job);

  // Lanzar proceso hijo de renderizado
  const child = spawn(process.execPath, args, {
    windowsHide: true,
  });

  job.process = child;

  let lastPersist = Date.now();

  const handleOutput = (data: Buffer) => {
    const text = data.toString();
    const lines = text.split('\n');
    let hasChanged = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Detectar fase de Bundling
      const bundleMatch = line.match(/Bundling\s+(\d+)%/i);
      if (bundleMatch) {
        const bundlePercent = parseInt(bundleMatch[1], 10);
        job.status = 'bundling';
        job.progress = Math.min(10, Math.round(bundlePercent * 0.1));
        job.stage = `Preparando composición (${bundlePercent}%)...`;
        hasChanged = true;
        continue;
      }

      // Detectar fase de Render de cuadros
      const renderMatch = line.match(/Rendered\s+(\d+)\/(\d+)(?:,\s*time remaining:\s*([^\r\n]+))?/i);
      if (renderMatch) {
        const current = parseInt(renderMatch[1], 10);
        const total = parseInt(renderMatch[2], 10) || totalFrames;
        const timeRemaining = renderMatch[3] ? renderMatch[3].trim() : undefined;

        job.status = 'rendering';
        job.currentFrame = current;
        job.totalFrames = total;
        job.timeRemaining = timeRemaining;

        const renderRatio = total > 0 ? current / total : 0;
        job.progress = Math.min(90, Math.round(10 + renderRatio * 80));
        job.stage = `Renderizando cuadro ${current.toLocaleString()} de ${total.toLocaleString()}`;
        hasChanged = true;
        continue;
      }

      // Detectar fase de Encode
      const encodeMatch = line.match(/Encoded\s+(\d+)\/(\d+)/i);
      if (encodeMatch) {
        const current = parseInt(encodeMatch[1], 10);
        const total = parseInt(encodeMatch[2], 10) || totalFrames;

        job.status = 'encoding';
        const encodeRatio = total > 0 ? current / total : 0;
        job.progress = Math.min(99, Math.round(90 + encodeRatio * 9));
        job.stage = `Codificando archivo MP4 final (${Math.round(encodeRatio * 100)}%)...`;
        hasChanged = true;
        continue;
      }
    }

    // Persistir si ha cambiado y pasaron al menos 300ms
    if (hasChanged && Date.now() - lastPersist > 300) {
      lastPersist = Date.now();
      persistJob(job);
    }
  };

  let lastStderr = '';
  child.stdout.on('data', handleOutput);
  child.stderr.on('data', (data) => {
    const text = data.toString();
    if (text.includes('Version mismatch') || text.includes('zod')) return;
    lastStderr = (lastStderr + '\n' + text).slice(-1000);
    if (text.toLowerCase().includes('error:')) {
      console.warn(`[Remotion Job ${jobId} Stderr]:`, text);
    }
  });

  child.on('close', (code) => {
    // Limpiar archivo temporal de props
    if (fs.existsSync(tempPropsPath)) {
      try {
        fs.unlinkSync(tempPropsPath);
      } catch (e) {
        console.warn('Error borrando temp props:', e);
      }
    }

    if (code === 0 && fs.existsSync(outputPath)) {
      job.status = 'completed';
      job.progress = 100;
      job.stage = '¡Video renderizado con éxito!';
      job.videoUrl = `/downloads/videos/${encodeURIComponent(outputFileName)}`;
      job.fileName = outputFileName;
    } else {
      job.status = 'error';
      job.error = lastStderr.trim() || `El renderizado finalizó con código ${code}.`;
    }

    persistJob(job);
  });

  child.on('error', (err) => {
    job.status = 'error';
    job.error = err.message || 'Error inesperado al iniciar el render.';
    persistJob(job);
  });

  return jobId;
}

export function getRenderJob(jobId: string): RenderJob | undefined {
  // 1. Intentar memoria global primero
  const memoryJob = jobs.get(jobId);
  if (memoryJob) return memoryJob;

  // 2. Fallback a persistencia en disco
  const jobFilePath = path.join(JOBS_DIR, `${jobId}.json`);
  if (fs.existsSync(jobFilePath)) {
    try {
      const data = fs.readFileSync(jobFilePath, 'utf-8');
      return JSON.parse(data) as RenderJob;
    } catch (e) {
      console.warn('[RenderManager] Error leyendo job de disco:', e);
    }
  }

  return undefined;
}

export function cancelRenderJob(jobId: string): boolean {
  const job = jobs.get(jobId);

  if (job?.process && !job.process.killed) {
    job.process.kill();
  }

  if (job?.tempPropsPath && fs.existsSync(job.tempPropsPath)) {
    try {
      fs.unlinkSync(job.tempPropsPath);
    } catch {}
  }

  // Eliminar de disco
  const jobFilePath = path.join(JOBS_DIR, `${jobId}.json`);
  if (fs.existsSync(jobFilePath)) {
    try {
      fs.unlinkSync(jobFilePath);
    } catch {}
  }

  jobs.delete(jobId);
  return true;
}
