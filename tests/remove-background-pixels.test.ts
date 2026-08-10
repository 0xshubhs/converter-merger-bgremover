import { describe, expect, it } from 'vitest';
import { removeBackgroundPixels, sampleEdgeBackground } from '@/lib/remove-background-pixels';

/** Builds RGBA pixels: a solid field with an optional differently-coloured centre block. */
function makePixels(size: number, background: [number, number, number], subject?: [number, number, number]) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const inset = Math.floor(size / 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const inSubject = subject && x >= inset && x < size - inset && y >= inset && y < size - inset;
      const [r, g, b] = inSubject ? subject : background;

      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = 255;
    }
  }

  return pixels;
}

const alphaAt = (pixels: Uint8ClampedArray, size: number, x: number, y: number) => pixels[(y * size + x) * 4 + 3];

describe('sampleEdgeBackground', () => {
  it('reads the border colour, ignoring the middle', () => {
    const pixels = makePixels(20, [255, 255, 255], [0, 0, 0]);
    const background = sampleEdgeBackground(pixels, 20, 20);

    expect(background.r).toBeCloseTo(255, 0);
    expect(background.g).toBeCloseTo(255, 0);
    expect(background.b).toBeCloseTo(255, 0);
  });

  it('handles a single-row image without dividing by zero', () => {
    const pixels = makePixels(1, [10, 20, 30]);
    const background = sampleEdgeBackground(pixels, 1, 1);

    expect(background.r).toBeCloseTo(10, 0);
  });
});

describe('removeBackgroundPixels', () => {
  it('clears the background and keeps the subject opaque', () => {
    const size = 40;
    const pixels = makePixels(size, [255, 255, 255], [200, 0, 0]);

    removeBackgroundPixels(pixels, size, size, { tolerance: 42, feather: 32 });

    expect(alphaAt(pixels, size, 1, 1)).toBe(0);
    expect(alphaAt(pixels, size, size / 2, size / 2)).toBe(255);
  });

  it('leaves the subject colours untouched', () => {
    const size = 40;
    const pixels = makePixels(size, [255, 255, 255], [200, 10, 20]);

    removeBackgroundPixels(pixels, size, size, {});

    const offset = ((size / 2) * size + size / 2) * 4;
    expect([pixels[offset], pixels[offset + 1], pixels[offset + 2]]).toEqual([200, 10, 20]);
  });

  it('erases everything when the image is one flat colour', () => {
    const size = 10;
    const pixels = makePixels(size, [18, 52, 86]);

    removeBackgroundPixels(pixels, size, size, {});

    expect(alphaAt(pixels, size, 5, 5)).toBe(0);
  });

  it('removes nothing at zero tolerance with no feather', () => {
    const size = 20;
    const pixels = makePixels(size, [255, 255, 255], [0, 0, 0]);

    removeBackgroundPixels(pixels, size, size, { tolerance: 0, feather: 0 });

    expect(alphaAt(pixels, size, size / 2, size / 2)).toBe(255);
  });

  it('feathers pixels that sit between the tolerance and the outer edge', () => {
    const size = 20;
    // Subject only slightly off-white, so it lands inside the feather band.
    const pixels = makePixels(size, [255, 255, 255], [235, 235, 235]);

    removeBackgroundPixels(pixels, size, size, { tolerance: 10, feather: 60 });

    const alpha = alphaAt(pixels, size, size / 2, size / 2);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(255);
  });
});
