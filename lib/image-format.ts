export const supportedOutputFormats = ['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif'] as const;

export type SupportedOutputFormat = (typeof supportedOutputFormats)[number];

export function normalizeFormat(format: string): SupportedOutputFormat {
  const value = format.toLowerCase();
  if (value === 'jpg') return 'jpeg';
  if (supportedOutputFormats.includes(value as SupportedOutputFormat)) {
    return value as SupportedOutputFormat;
  }
  return 'jpeg';
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