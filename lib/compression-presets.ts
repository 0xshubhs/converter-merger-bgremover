export const resolutionPresets = ['original', 'high', 'medium', 'small'] as const;

export type ResolutionPreset = (typeof resolutionPresets)[number];

export function normalizeResolution(value: string | undefined): ResolutionPreset {
  return resolutionPresets.includes(value as ResolutionPreset) ? (value as ResolutionPreset) : 'high';
}

/** Longest edge an image is allowed to keep, in pixels. */
export function imageMaxDimension(resolution: ResolutionPreset) {
  switch (resolution) {
    case 'original':
      return Number.POSITIVE_INFINITY;
    case 'high':
      return 3000;
    case 'medium':
      return 2000;
    case 'small':
      return 1400;
  }
}

/**
 * Scale applied when rasterising a PDF page. 1 is 72 DPI, which is screen
 * resolution and far too soft for print; 2 is 144 DPI and reads cleanly.
 */
export function pdfRenderScale(resolution: ResolutionPreset) {
  switch (resolution) {
    case 'original':
      return 2.5;
    case 'high':
      return 2;
    case 'medium':
      return 1.5;
    case 'small':
      return 1;
  }
}

/** Canvas can only re-encode these; anything else has to be passed through. */
const recompressible = new Set(['image/jpeg', 'image/webp', 'image/png']);

export function canRecompressImage(mimeType: string) {
  return recompressible.has(mimeType.toLowerCase());
}

const extensionMimes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf'
};

/** Falls back to the extension when the browser reports no MIME type. */
export function detectType(name: string, type: string) {
  if (type) return type.toLowerCase();

  const extension = name.split('.').pop()?.toLowerCase() ?? '';

  return extensionMimes[extension] ?? '';
}
