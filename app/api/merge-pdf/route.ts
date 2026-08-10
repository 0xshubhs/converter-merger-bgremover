import { NextRequest } from 'next/server';
import { binaryResponse, collectFiles, errorResponse, readFormData } from '@/lib/http';
import { mergePdfs } from '@/lib/merge-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await readFormData(request);
    const files = collectFiles(formData, { minimum: 2, label: 'PDF' });

    const inputs = await Promise.all(
      files.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }))
    );

    const result = await mergePdfs(inputs);

    return binaryResponse(result.bytes, result.mime, 'merged.pdf');
  } catch (error) {
    return errorResponse(error, 'PDF merge failed unexpectedly.');
  }
}
