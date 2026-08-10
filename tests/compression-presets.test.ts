import { describe, expect, it } from 'vitest';
import {
  canRecompressImage,
  detectType,
  imageMaxDimension,
  normalizeResolution,
  pdfRenderScale,
  resolutionPresets
} from '@/lib/compression-presets';

describe('normalizeResolution', () => {
  it('accepts every preset', () => {
    resolutionPresets.forEach((preset) => expect(normalizeResolution(preset)).toBe(preset));
  });

  it('falls back to high for anything unknown', () => {
    expect(normalizeResolution('gigantic')).toBe('high');
    expect(normalizeResolution(undefined)).toBe('high');
  });
});

describe('imageMaxDimension', () => {
  it('leaves the original untouched', () => {
    expect(imageMaxDimension('original')).toBe(Number.POSITIVE_INFINITY);
  });

  it('gets smaller as the preset gets smaller', () => {
    expect(imageMaxDimension('high')).toBeGreaterThan(imageMaxDimension('medium'));
    expect(imageMaxDimension('medium')).toBeGreaterThan(imageMaxDimension('small'));
  });
});

describe('pdfRenderScale', () => {
  it('never drops below screen resolution', () => {
    resolutionPresets.forEach((preset) => expect(pdfRenderScale(preset)).toBeGreaterThanOrEqual(1));
  });

  it('gets smaller as the preset gets smaller', () => {
    expect(pdfRenderScale('original')).toBeGreaterThan(pdfRenderScale('high'));
    expect(pdfRenderScale('high')).toBeGreaterThan(pdfRenderScale('medium'));
    expect(pdfRenderScale('medium')).toBeGreaterThan(pdfRenderScale('small'));
  });
});

describe('canRecompressImage', () => {
  it('accepts what a canvas can encode', () => {
    expect(canRecompressImage('image/jpeg')).toBe(true);
    expect(canRecompressImage('image/png')).toBe(true);
    expect(canRecompressImage('image/webp')).toBe(true);
  });

  it('rejects formats a canvas cannot write', () => {
    expect(canRecompressImage('image/gif')).toBe(false);
    expect(canRecompressImage('image/heic')).toBe(false);
    expect(canRecompressImage('application/pdf')).toBe(false);
    expect(canRecompressImage('')).toBe(false);
  });
});

describe('detectType', () => {
  it('trusts the reported MIME type', () => {
    expect(detectType('thing.bin', 'image/jpeg')).toBe('image/jpeg');
  });

  it('falls back to the extension when the browser reports nothing', () => {
    expect(detectType('scan.PDF', '')).toBe('application/pdf');
    expect(detectType('photo.jpg', '')).toBe('image/jpeg');
    expect(detectType('photo.webp', '')).toBe('image/webp');
  });

  it('returns empty for anything it cannot place', () => {
    expect(detectType('notes.xyz', '')).toBe('');
  });
});
