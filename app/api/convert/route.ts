import { NextRequest } from 'next/server';
import { mapWithConcurrency } from '@/lib/concurrency';
import { convertImage } from '@/lib/convert-image';
import { binaryResponse, collectFiles, errorResponse, HttpError, readFormData, readNumber, stripExtension } from '@/lib/http';
import { normalizeFormat, outputExtension } from '@/lib/image-format';
import { createNameDeduper, zipEntries } from '@/lib/zip';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await readFormData(request);
    const files = collectFiles(formData, { label: 'image' });
    const format = normalizeFormat(String(formData.get('format') ?? 'jpeg'));
    const quality = readNumber(formData, 'quality', 92, 1, 100);

    const results = await mapWithConcurrency(files, async (file) => {
      const inputBuffer = Buffer.from(await file.arrayBuffer());

      return convertImage(inputBuffer, { format, quality, inputName: file.name, inputType: file.type });
    });

    const nextName = createNameDeduper();
    const entries: Array<{ name: string; data: Uint8Array; mime: string }> = [];
    const failures: string[] = [];

    results.forEach((result, index) => {
      const file = files[index];

      if (result.status === 'rejected') {
        const message = result.reason instanceof Error ? result.reason.message : 'Unknown conversion error';
        failures.push(`${file.name}: ${message}`);
        return;
      }

      const extension = result.value.extension || outputExtension(format);

      entries.push({
        name: nextName(`${stripExtension(file.name)}.${extension}`),
        data: result.value.buffer,
        mime: result.value.mime
      });
    });

    if (!entries.length) {
      throw new HttpError(422, failures.join('\n') || 'No files could be converted.');
    }

    // A single image does not need an archive around it.
    if (entries.length === 1 && !failures.length) {
      const [only] = entries;

      return binaryResponse(only.data, only.mime, only.name);
    }

    if (failures.length) {
      entries.push({
        name: 'conversion-errors.txt',
        data: new TextEncoder().encode(failures.join('\n')),
        mime: 'text/plain'
      });
    }

    // Encoded images are already compressed, so DEFLATE would only burn CPU.
    const archive = await zipEntries(entries, { store: true });

    return binaryResponse(archive, 'application/zip', 'converted-images.zip');
  } catch (error) {
    return errorResponse(error, 'Conversion failed unexpectedly.');
  }
}
