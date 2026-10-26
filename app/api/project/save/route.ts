import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { VideoProject } from '@/types/lyrics';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectData, fileName } = body as {
      projectData: VideoProject;
      fileName?: string;
    };

    if (!projectData) {
      return NextResponse.json(
        { error: 'Faltan los datos del proyecto.' },
        { status: 400 }
      );
    }

    const title = (projectData.title || 'proyecto')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);

    const targetFileName = fileName || `stardust_${title || 'proyecto'}.json`;

    // Guardar ÚNICAMENTE en public/downloads/projects/
    const projectsDir = path.join(process.cwd(), 'public', 'downloads', 'projects');

    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }

    const fileContent = JSON.stringify(projectData, null, 2);
    const pathInProjects = path.join(projectsDir, targetFileName);

    fs.writeFileSync(pathInProjects, fileContent, 'utf-8');

    return NextResponse.json({
      success: true,
      fileName: targetFileName,
      fileUrl: `/downloads/projects/${targetFileName}`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[API Project Save Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Error guardando el archivo de proyecto.' },
      { status: 500 }
    );
  }
}
