'use client';

export type DownloadPayload = {
  blob: Blob;
  filename: string;
  warning: string | null;
};

const FILENAME_STAR = /filename\*=UTF-8''([^;]+)/i;
const FILENAME_PLAIN = /filename="([^"]+)"/i;

function filenameFromResponse(response: Response, fallback: string) {
  const header = response.headers.get('Content-Disposition');

  if (!header) return fallback;

  const encoded = header.match(FILENAME_STAR);

  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      // Fall through to the ASCII form.
    }
  }

  return header.match(FILENAME_PLAIN)?.[1] ?? fallback;
}

/** Posts a form body and returns the resulting file plus the name the server chose. */
export async function postForm(endpoint: string, formData: FormData, fallbackName: string): Promise<DownloadPayload> {
  const response = await fetch(endpoint, { method: 'POST', body: formData });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message.trim() || `Request failed with status ${response.status}`);
  }

  const skipped = response.headers.get('X-Skipped-Files');

  return {
    blob: await response.blob(),
    filename: filenameFromResponse(response, fallbackName),
    warning: skipped ? decodeURIComponent(skipped) : null
  };
}

/** Saves a blob to disk and releases the object URL once the browser has taken it. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
