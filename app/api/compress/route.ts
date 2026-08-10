import { NextRequest } from 'next/server';
import { binaryResponse, collectFiles, errorResponse, readFormData, readNumber } from '@/lib/http';
import { createNameDeduper, zipEntries } from '@/lib/zip';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await readFormData(request);
    const files = collectFiles(formData);
    const level = readNumber(formData, 'level', 9, 1, 9);

    const nextName = createNameDeduper();
    const entries = [];

    for (const file of files) {
      entries.push({ name: nextName(file.name || 'file'), data: await file.arrayBuffer() });
    }

    const archive = await zipEntries(entries, { level });

    return binaryResponse(archive, 'application/zip', 'compressed-files.zip');
  } catch (error) {
    return errorResponse(error, 'Compression failed unexpectedly.');
  }
}
