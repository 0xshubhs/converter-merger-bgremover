/** RMBG-1.4 was trained at 1024x1024 and expects that input size. */
export const RMBG_INPUT_SIZE = 1024;

/**
 * Packs RGBA bytes into the planar float tensor the model wants: three
 * channel planes, scaled to 0..1 and centred on zero (mean 0.5, std 1).
 */
export function toModelInput(rgba: Uint8ClampedArray | Uint8Array, size: number): Float32Array {
  const plane = size * size;
  const out = new Float32Array(plane * 3);

  for (let pixel = 0, offset = 0; pixel < plane; pixel += 1, offset += 4) {
    out[pixel] = rgba[offset] / 255 - 0.5;
    out[plane + pixel] = rgba[offset + 1] / 255 - 0.5;
    out[plane * 2 + pixel] = rgba[offset + 2] / 255 - 0.5;
  }

  return out;
}

/**
 * The raw model output is unbounded, so it is rescaled to 0..1 against its own
 * range. A flat output means nothing was found; it becomes fully transparent.
 */
export function normalizeMask(mask: Float32Array | number[]): Float32Array {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < mask.length; index += 1) {
    const value = mask[index];
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const out = new Float32Array(mask.length);
  const range = max - min;

  if (!Number.isFinite(range) || range <= 0) return out;

  for (let index = 0; index < mask.length; index += 1) {
    out[index] = (mask[index] - min) / range;
  }

  return out;
}

/**
 * Shapes the mask's transition band. Softness 0 gives a hard cut at the midpoint;
 * 1 passes the model's own gradient through, which keeps hair and fur.
 */
export function refineAlpha(value: number, softness: number) {
  const width = Math.max(0.001, Math.min(1, softness));
  const start = 0.5 - width / 2;
  const scaled = (value - start) / width;

  return scaled < 0 ? 0 : scaled > 1 ? 1 : scaled;
}

/**
 * Multiplies the image's alpha by the mask, in place. `mask` holds one value
 * per pixel, already scaled to the image's dimensions.
 */
export function applyAlphaMask(
  rgba: Uint8ClampedArray | Uint8Array,
  mask: Float32Array | number[],
  softness = 1
) {
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const alpha = refineAlpha(mask[pixel], softness);
    const offset = pixel * 4 + 3;

    rgba[offset] = Math.round(rgba[offset] * alpha);
  }

  return rgba;
}
