import { NextRequest } from 'next/server';
import { removeBackground } from '@/lib/remove-background';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return new Response('A single image file is required.', { status: 400 });
    }

    const tolerance = Number(formData.get('tolerance') ?? 42);
    const feather = Number(formData.get('feather') ?? 32);
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const result = await removeBackground(inputBuffer, { tolerance, feather });

    return new Response(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': result.mime,
        'Content-Disposition': `attachment; filename="${file.name.replace(/\.[^/.]+$/, '')}-no-background.png"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Background removal failed unexpectedly.';
    return new Response(message, { status: 500 });
  }
}