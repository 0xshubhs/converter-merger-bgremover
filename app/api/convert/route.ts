import { NextRequest } from 'next/server';
import JSZip from 'jszip';
import { convertImage } from '@/lib/convert-image';
import { normalizeFormat, outputExtension } from '@/lib/image-format';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files').filter((item): item is File => item instanceof File);

    if (!files.length) {
      return new Response('At least one image file is required.', { status: 400 });
    }

    const format = normalizeFormat(String(formData.get('format') ?? 'jpeg'));
    const quality = Number(formData.get('quality') ?? 92);
    const zip = new JSZip();
    const nameCounts = new Map<string, number>();
    const failures: string[] = [];

    for (const file of files) {
      try {
        const inputBuffer = Buffer.from(await file.arrayBuffer());
        const converted = await convertImage(inputBuffer, { format, quality, inputName: file.name });
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const extension = converted.extension || outputExtension(format);
        const key = `${baseName}.${extension}`;
        const count = (nameCounts.get(key) ?? 0) + 1;
        nameCounts.set(key, count);
        const outputName = count === 1 ? key : `${baseName}-${count}.${extension}`;
        zip.file(outputName, converted.buffer);
      } catch (fileError) {
        const message = fileError instanceof Error ? fileError.message : 'Unknown conversion error';
        failures.push(`${file.name}: ${message}`);
      }
    }

    if (!Object.keys(zip.files).length) {
      return new Response(failures.join('\n') || 'No files could be converted.', { status: 422 });
    }

    if (failures.length) {
      zip.file('conversion-errors.txt', failures.join('\n'));
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="converted-images.zip"'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Conversion failed unexpectedly.';
    return new Response(message, { status: 500 });
  }
}