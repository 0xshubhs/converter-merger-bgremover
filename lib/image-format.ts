export const supportedOutputFormats = ['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif'] as const;

export type SupportedOutputFormat = (typeof supportedOutputFormats)[number];

// A Map, not an object literal: the key comes from the request body, and a plain
// object would resolve "__proto__" or "constructor" to something off the prototype.
const formatAliases = new Map<string, SupportedOutputFormat>([
  ['jpg', 'jpeg'],
  ['jpeg', 'jpeg'],
  ['jfif', 'jpeg'],
  ['png', 'png'],
  ['webp', 'webp'],
  ['avif', 'avif'],
  ['tif', 'tiff'],
  ['tiff', 'tiff'],
  ['gif', 'gif']
]);

export function normalizeFormat(format: string): SupportedOutputFormat {
  return formatAliases.get(format.trim().toLowerCase()) ?? 'jpeg';
}

export function outputExtension(format: SupportedOutputFormat) {
  return format === 'jpeg' ? 'jpg' : format;
}

export function mimeForFormat(format: SupportedOutputFormat) {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'tiff':
      return 'image/tiff';
    case 'gif':
      return 'image/gif';
  }
}

/** True when the encoder discards detail as quality drops, so the slider is meaningful. */
export function isLossyFormat(format: SupportedOutputFormat) {
  return format === 'jpeg' || format === 'webp' || format === 'avif';
}
