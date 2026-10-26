import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const projectsDir = path.join(process.cwd(), 'public', 'downloads', 'projects');

    const projectFiles: Array<{
      fileName: string;
      title: string;
      artist: string;
      lyricsCount: number;
      modifiedAt: string;
      sizeBytes: number;
      filePath: string;
    }> = [];

    if (fs.existsSync(/*turbopackIgnore: true*/ projectsDir)) {
      const entries = fs.readdirSync(/*turbopackIgnore: true*/ projectsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.startsWith('.')) continue;

        try {
          const fullPath = path.join(projectsDir, entry.name);
          const stats = fs.statSync(/*turbopackIgnore: true*/ fullPath);
          const raw = fs.readFileSync(/*turbopackIgnore: true*/ fullPath, 'utf-8');
          const parsed = JSON.parse(raw);

          if (parsed && Array.isArray(parsed.lyrics)) {
            projectFiles.push({
              fileName: entry.name,
              title: parsed.title || entry.name.replace('.json', ''),
              artist: parsed.artist || '',
              lyricsCount: parsed.lyrics.length,
              modifiedAt: stats.mtime.toISOString(),
              sizeBytes: stats.size,
              filePath: `/downloads/projects/${entry.name}`,
            });
          }
        } catch {
          // Ignorar archivos corruptos
        }
      }
    }

    // Ordenar por fecha de modificación más reciente primero
    projectFiles.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    return NextResponse.json({
      success: true,
      projects: projectFiles,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[API Project List Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Error listando proyectos.' },
      { status: 500 }
    );
  }
}
