/**
 * Most libvips builds ship without HEIF support, so HEIC/HEIF inputs are decoded
 * to JPEG in JS first and only then handed to Sharp.
 */
export function isHeicLike(inputName?: string, mimeType?: string) {
  if (mimeType && /^image\/(heic|heif)/i.test(mimeType)) return true;

  return Boolean(inputName && /\.(heic|heif)$/i.test(inputName));
}

export async function decodeHeicIfNeeded(buffer: Buffer, inputName?: string, mimeType?: string) {
  if (!isHeicLike(inputName, mimeType)) {
    return buffer;
  }

  try {
    const heicConvert = (await import('heic-convert')).default;
    const converted = await heicConvert({ buffer, format: 'JPEG', quality: 1 });

    return Buffer.from(converted);
  } catch {
    // Sharp may still handle it if libvips was built with HEIF support.
    return buffer;
  }
}
