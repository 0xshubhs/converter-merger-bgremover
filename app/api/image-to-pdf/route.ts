import { NextRequest } from 'next/server';
import { binaryResponse, collectFiles, errorResponse, readFormData, readNumber } from '@/lib/http';
import { imagesToPdf } from '@/lib/images-to-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await readFormData(request);
    const files = collectFiles(formData, { label: 'image' });

    const inputs = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        type: file.type,
        buffer: Buffer.from(await file.arrayBuffer())
      }))
    );

    const result = await imagesToPdf(inputs, {
      pageSize: String(formData.get('pageSize') ?? 'a4'),
      orientation: String(formData.get('orientation') ?? 'auto'),
      margin: readNumber(formData, 'margin', 24, 0, 200),
      quality: readNumber(formData, 'quality', 85, 30, 100)
    });

    const response = binaryResponse(result.bytes, result.mime, 'images.pdf');

    response.headers.set('X-Page-Count', String(result.pageCount));

    if (result.failures.length) {
      // Header-safe summary so the UI can warn about images that were skipped.
      response.headers.set('X-Skipped-Files', encodeURIComponent(result.failures.join(' | ')));
    }

    return response;
  } catch (error) {
    return errorResponse(error, 'PDF creation failed unexpectedly.');
  }
}
