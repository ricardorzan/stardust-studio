import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo de imagen' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Carpeta destino public/downloads/images
    const imagesDir = path.join(process.cwd(), 'public', 'downloads', 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const safeOriginal = (file.name || 'image.jpg')
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .toLowerCase();
    const fileName = `bg_${Date.now()}_${safeOriginal}`;
    const filePath = path.join(imagesDir, fileName);

    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      success: true,
      url: `/downloads/images/${fileName}`,
      fileName,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[Upload Image Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al subir la imagen' },
      { status: 500 }
    );
  }
}
