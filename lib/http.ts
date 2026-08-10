import { HttpError } from './errors';
import { MAX_FILES, MAX_FILE_SIZE, MAX_TOTAL_SIZE } from './limits';

export { HttpError };

function formatMb(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

/** Parses a multipart body, turning a malformed request into a 400 rather than a 500. */
export async function readFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new HttpError(400, 'Expected a multipart form upload.');
  }
}

type CollectOptions = {
  key?: string;
  minimum?: number;
  label?: string;
  maxFiles?: number;
  maxFileSize?: number;
  maxTotalSize?: number;
};

/**
 * Pulls uploaded files off a form body and enforces count/size limits before any
 * of them reach an image or PDF decoder.
 */
export function collectFiles(formData: FormData, options: CollectOptions = {}): File[] {
  const {
    key = 'files',
    minimum = 1,
    label = 'file',
    maxFiles = MAX_FILES,
    maxFileSize = MAX_FILE_SIZE,
    maxTotalSize = MAX_TOTAL_SIZE
  } = options;

  const files = formData.getAll(key).filter((item): item is File => item instanceof File && item.size > 0);

  if (files.length < minimum) {
    throw new HttpError(400, `Upload at least ${minimum} ${label}${minimum === 1 ? '' : 's'}.`);
  }

  if (files.length > maxFiles) {
    throw new HttpError(413, `Too many files. The limit is ${maxFiles} per request.`);
  }

  let total = 0;

  for (const file of files) {
    if (file.size > maxFileSize) {
      throw new HttpError(413, `"${file.name}" is larger than the ${formatMb(maxFileSize)} per-file limit.`);
    }

    total += file.size;
  }

  if (total > maxTotalSize) {
    throw new HttpError(413, `The upload totals more than the ${formatMb(maxTotalSize)} limit.`);
  }

  return files;
}

/** Reads a bounded numeric field, falling back when it is missing or unparsable. */
export function readNumber(formData: FormData, key: string, fallback: number, min: number, max: number) {
  const raw = formData.get(key);

  // Number(null) is 0, which would silently clamp a missing field to `min`.
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;

  const value = Number(raw);

  if (!Number.isFinite(value)) return fallback;

  return Math.max(min, Math.min(max, value));
}

/**
 * Builds a Content-Disposition value that cannot break out of the header.
 * The ASCII form is sanitised and the original name is carried in filename*.
 */
export function contentDisposition(filename: string) {
  const trimmed = filename.split(/[\\/]/).pop() ?? '';
  const ascii = trimmed.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_').trim() || 'download';

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(trimmed || ascii)}`;
}

export function stripExtension(name: string) {
  return name.replace(/\.[^/.]+$/, '');
}

/** Responds with binary data without copying the payload again. */
export function binaryResponse(data: Uint8Array, mime: string, filename: string) {
  // A view over the existing memory, so large payloads are not copied again.
  const body = new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);

  return new Response(body, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(body.byteLength),
      'Content-Disposition': contentDisposition(filename),
      'Cache-Control': 'no-store'
    }
  });
}

export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    return new Response(error.message, { status: error.status });
  }

  const message = error instanceof Error ? error.message : fallback;

  return new Response(message || fallback, { status: 500 });
}
