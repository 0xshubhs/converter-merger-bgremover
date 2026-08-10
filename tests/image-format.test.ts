import { describe, expect, it } from 'vitest';
import {
  isLossyFormat,
  mimeForFormat,
  normalizeFormat,
  outputExtension,
  supportedOutputFormats
} from '@/lib/image-format';

describe('normalizeFormat', () => {
  it('folds aliases onto the canonical encoder name', () => {
    expect(normalizeFormat('jpg')).toBe('jpeg');
    expect(normalizeFormat('JPEG')).toBe('jpeg');
    expect(normalizeFormat('  tif ')).toBe('tiff');
  });

  it('falls back to jpeg for anything unsupported', () => {
    expect(normalizeFormat('bmp')).toBe('jpeg');
    expect(normalizeFormat('')).toBe('jpeg');
    expect(normalizeFormat('__proto__')).toBe('jpeg');
  });

  it('accepts every supported format', () => {
    supportedOutputFormats.forEach((format) => {
      expect(normalizeFormat(format)).toBe(format);
    });
  });
});

describe('outputExtension', () => {
  it('uses .jpg for jpeg and the format name otherwise', () => {
    expect(outputExtension('jpeg')).toBe('jpg');
    expect(outputExtension('webp')).toBe('webp');
  });
});

describe('mimeForFormat', () => {
  it('returns an image mime for every supported format', () => {
    supportedOutputFormats.forEach((format) => {
      expect(mimeForFormat(format)).toMatch(/^image\//);
    });
  });
});

describe('isLossyFormat', () => {
  it('marks the quality-driven encoders', () => {
    expect(isLossyFormat('jpeg')).toBe(true);
    expect(isLossyFormat('webp')).toBe(true);
    expect(isLossyFormat('avif')).toBe(true);
    expect(isLossyFormat('png')).toBe(false);
    expect(isLossyFormat('gif')).toBe(false);
  });
});
