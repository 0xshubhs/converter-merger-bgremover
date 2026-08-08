import { NextRequest } from 'next/server';
import { mergePdfs } from '@/lib/merge-pdf';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files').filter((item): item is File => item instanceof File);

    if (files.length < 2) {
      return new Response('Upload at least two PDF files to merge.', { status: 400 });
    }

    const result = await mergePdfs(files);

    return new Response(result.buffer, {
      headers: {
        'Content-Type': result.mime,
        'Content-Disposition': 'attachment; filename="merged.pdf"'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF merge failed unexpectedly.';
    return new Response(message, { status: 500 });
  }
}