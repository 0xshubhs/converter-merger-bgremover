'use client';

export type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

function looksLikeHeic(file: File) {
  return /^image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/**
 * Decodes an image file for canvas work. Safari decodes HEIC natively; other
 * browsers do not, so that case gets an actionable message instead of a stack.
 */
export async function decodeImageFile(file: File): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(file);

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close()
    };
  } catch {
    // Fall through to the <img> path, which handles a few formats createImageBitmap rejects.
  }

  const url = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('decode failed'));
      image.src = url;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url)
    };
  } catch {
    URL.revokeObjectURL(url);

    if (looksLikeHeic(file)) {
      throw new Error(`"${file.name}" is a HEIC image, which this browser cannot open. Use the Convert tool to turn it into a JPEG or PNG first.`);
    }

    throw new Error(`"${file.name}" could not be read as an image.`);
  }
}

/** Draws a decoded image onto a canvas, scaled to fit within `maxDimension`. */
export function drawToCanvas(decoded: DecodedImage, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('This browser could not provide a 2D canvas.');
  }

  context.drawImage(decoded.source, 0, 0, width, height);

  return { canvas, context, width, height };
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded.'))),
      type,
      quality
    );
  });
}

/** Paints an opaque background behind an image that may carry alpha. */
export function flattenOntoWhite(context: CanvasRenderingContext2D, width: number, height: number) {
  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
}
