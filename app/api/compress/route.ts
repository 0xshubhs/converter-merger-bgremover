import { NextRequest } from 'next/server';
import JSZip from 'jszip';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files').filter((item): item is File => item instanceof File);

    if (!files.length) {
      return new Response('At least one file is required to create a compressed archive.', { status: 400 });
    }

    const level = Math.max(1, Math.min(9, Number(formData.get('level') ?? 9)));
    const zip = new JSZip();
    const nameCounts = new Map<string, number>();

    for (const file of files) {
      const baseName = file.name || 'file';
      const count = (nameCounts.get(baseName) ?? 0) + 1;
      nameCounts.set(baseName, count);
      const outputName = count === 1 ? baseName : `${baseName.replace(/\.[^/.]+$/, '')}-${count}${baseName.includes('.') ? baseName.slice(baseName.lastIndexOf('.')) : ''}`;
      zip.file(outputName, await file.arrayBuffer(), { binary: true });
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level }
    });

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="compressed-files.zip"'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Compression failed unexpectedly.';
    return new Response(message, { status: 500 });
  }
}