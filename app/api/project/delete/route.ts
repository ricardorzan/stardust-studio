import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawFileName = body.fileName;

    if (!rawFileName || typeof rawFileName !== 'string') {
      return NextResponse.json({ error: 'Nombre de archivo no proporcionado o inválido' }, { status: 400 });
    }

    // Evitar ataques de path traversal usando path.basename
    const safeFileName = path.basename(rawFileName);

    if (!safeFileName.endsWith('.json')) {
      return NextResponse.json({ error: 'Solo se pueden eliminar archivos de proyecto (.json)' }, { status: 400 });
    }

    const projectsDir = path.join(process.cwd(), 'public', 'downloads', 'projects');
    const fullPath = path.join(projectsDir, safeFileName);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return NextResponse.json({ success: true, message: `Proyecto "${safeFileName}" eliminado.` });
    } else {
      return NextResponse.json({ error: 'El archivo de proyecto no existe.' }, { status: 404 });
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error eliminando proyecto:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al eliminar el proyecto.' },
      { status: 500 }
    );
  }
}
