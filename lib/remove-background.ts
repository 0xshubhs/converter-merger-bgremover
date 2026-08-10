import sharp from 'sharp';
import { decodeHeicIfNeeded } from './decode-heic';
import { MAX_IMAGE_DIMENSION } from './limits';

type RemoveBackgroundOptions = {
  tolerance?: number;
  feather?: number;
  inputName?: string;
  inputType?: string;
};

type Rgb = { r: number; g: number; b: number };

/**
 * Averages the one-pixel border of the image, which is the cheapest reliable
 * guess at the background colour for a subject-on-backdrop photo.
 */
function sampleEdgeBackground(pixels: Uint8Array, width: number, height: number): Rgb {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  const addRow = (y: number) => {
    let offset = y * width * 4;

    for (let x = 0; x < width; x += 1) {
      red += pixels[offset];
      green += pixels[offset + 1];
      blue += pixels[offset + 2];
      offset += 4;
      count += 1;
    }
  };

  addRow(0);
  if (height > 1) addRow(height - 1);

  for (let y = 1; y < height - 1; y += 1) {
    const left = y * width * 4;
    const right = left + (width - 1) * 4;

    red += pixels[left] + pixels[right];
    green += pixels[left + 1] + pixels[right + 1];
    blue += pixels[left + 2] + pixels[right + 2];
    count += 2;
  }

  const total = count || 1;

  return { r: red / total, g: green / total, b: blue / total };
}

export async function removeBackground(buffer: Buffer, options: RemoveBackgroundOptions = {}) {
  const tolerance = Math.max(0, Math.min(441, options.tolerance ?? 42));
  const feather = Math.max(0, Math.min(441, options.feather ?? 32));
  const decoded = await decodeHeicIfNeeded(buffer, options.inputName, options.inputType);

  const { data, info } = await sharp(decoded, { failOn: 'none' })
    .rotate()
    .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const background = sampleEdgeBackground(pixels, info.width, info.height);

  // Compare squared distances so the inner loop needs no sqrt for opaque pixels.
  const toleranceSquared = tolerance * tolerance;
  const outerEdge = tolerance + feather;
  const outerSquared = outerEdge * outerEdge;

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const red = pixels[offset] - background.r;
    const green = pixels[offset + 1] - background.g;
    const blue = pixels[offset + 2] - background.b;
    const distanceSquared = red * red + green * green + blue * blue;

    if (distanceSquared <= toleranceSquared) {
      pixels[offset + 3] = 0;
    } else if (feather > 0 && distanceSquared < outerSquared) {
      const alpha = ((Math.sqrt(distanceSquared) - tolerance) / feather) * 255;
      const scaled = (alpha * pixels[offset + 3]) / 255;
      pixels[offset + 3] = scaled < 0 ? 0 : scaled > 255 ? 255 : Math.round(scaled);
    }
  }

  const png = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png({ compressionLevel: 9, effort: 7 })
    .toBuffer();

  return {
    buffer: png,
    mime: 'image/png',
    extension: 'png'
  };
}
