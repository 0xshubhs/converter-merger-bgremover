import { describe, expect, it } from 'vitest';
import { applyAlphaMask, normalizeMask, refineAlpha, toModelInput } from '@/lib/segmentation-math';

describe('toModelInput', () => {
  it('splits RGBA into planar channels centred on zero', () => {
    // 2x2 image: red, green, blue, white
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255
    ]);

    const tensor = toModelInput(rgba, 2);
    const plane = 4;

    expect(tensor).toHaveLength(12);
    // Red channel of each pixel.
    expect(Array.from(tensor.slice(0, plane))).toEqual([0.5, -0.5, -0.5, 0.5]);
    // Green channel.
    expect(Array.from(tensor.slice(plane, plane * 2))).toEqual([-0.5, 0.5, -0.5, 0.5]);
    // Blue channel.
    expect(Array.from(tensor.slice(plane * 2))).toEqual([-0.5, -0.5, 0.5, 0.5]);
  });

  it('drops the alpha channel', () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 0]);

    expect(toModelInput(rgba, 1)).toHaveLength(3);
  });
});

describe('normalizeMask', () => {
  it('rescales the range to 0..1', () => {
    const normalized = normalizeMask(new Float32Array([-2, 0, 2]));

    expect(Array.from(normalized)).toEqual([0, 0.5, 1]);
  });

  it('handles negative-only output', () => {
    const normalized = normalizeMask(new Float32Array([-8, -4]));

    expect(Array.from(normalized)).toEqual([0, 1]);
  });

  it('returns all zeroes for a flat mask rather than dividing by zero', () => {
    const normalized = normalizeMask(new Float32Array([3, 3, 3]));

    expect(Array.from(normalized)).toEqual([0, 0, 0]);
    expect(normalized.every((value) => Number.isFinite(value))).toBe(true);
  });

  it('copes with an empty mask', () => {
    expect(normalizeMask(new Float32Array([]))).toHaveLength(0);
  });
});

describe('refineAlpha', () => {
  it('cuts hard at the midpoint when softness is minimal', () => {
    expect(refineAlpha(0.49, 0.001)).toBe(0);
    expect(refineAlpha(0.51, 0.001)).toBe(1);
  });

  it('passes a gradient through at full softness', () => {
    expect(refineAlpha(0.5, 1)).toBeCloseTo(0.5, 5);
    expect(refineAlpha(0.25, 1)).toBeCloseTo(0.25, 5);
  });

  it('stays clamped to 0..1', () => {
    [-5, 0, 0.5, 1, 5].forEach((value) => {
      const alpha = refineAlpha(value, 0.4);

      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1);
    });
  });

  it('is monotonic in the input', () => {
    let previous = -1;

    for (let value = 0; value <= 1; value += 0.05) {
      const alpha = refineAlpha(value, 0.5);
      expect(alpha).toBeGreaterThanOrEqual(previous);
      previous = alpha;
    }
  });
});

describe('applyAlphaMask', () => {
  it('keeps the foreground and clears the background', () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);

    applyAlphaMask(rgba, new Float32Array([1, 0]), 1);

    expect(rgba[3]).toBe(255);
    expect(rgba[7]).toBe(0);
  });

  it('leaves colour channels untouched', () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255]);

    applyAlphaMask(rgba, new Float32Array([0]), 1);

    expect(Array.from(rgba.slice(0, 3))).toEqual([10, 20, 30]);
  });

  it('scales existing transparency rather than overwriting it', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 128]);

    applyAlphaMask(rgba, new Float32Array([0.5]), 1);

    expect(rgba[3]).toBe(64);
  });
});
