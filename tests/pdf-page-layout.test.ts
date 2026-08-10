import { describe, expect, it } from 'vitest';
import { normalizeMargin, normalizeOrientation, normalizePageSize, planImagePage } from '@/lib/pdf-page-layout';

const A4_SHORT = 595.28;
const A4_LONG = 841.89;

describe('option normalisation', () => {
  it('defaults unknown page sizes to A4', () => {
    expect(normalizePageSize('tabloid')).toBe('a4');
    expect(normalizePageSize(undefined)).toBe('a4');
    expect(normalizePageSize('letter')).toBe('letter');
  });

  it('defaults unknown orientations to auto', () => {
    expect(normalizeOrientation('sideways')).toBe('auto');
    expect(normalizeOrientation('landscape')).toBe('landscape');
  });

  it('clamps the margin', () => {
    expect(normalizeMargin(-10)).toBe(0);
    expect(normalizeMargin(9999)).toBe(200);
    expect(normalizeMargin(undefined)).toBe(24);
  });
});

describe('planImagePage', () => {
  it('orients A4 to match the image when set to auto', () => {
    const wide = planImagePage(800, 600, { pageSize: 'a4', orientation: 'auto' });
    const tall = planImagePage(600, 800, { pageSize: 'a4', orientation: 'auto' });

    expect(wide.pageWidth).toBeCloseTo(A4_LONG, 1);
    expect(wide.pageHeight).toBeCloseTo(A4_SHORT, 1);
    expect(tall.pageWidth).toBeCloseTo(A4_SHORT, 1);
    expect(tall.pageHeight).toBeCloseTo(A4_LONG, 1);
  });

  it('forces the requested orientation over the image aspect', () => {
    const layout = planImagePage(800, 600, { pageSize: 'a4', orientation: 'portrait' });

    expect(layout.pageHeight).toBeGreaterThan(layout.pageWidth);
  });

  it('sizes the page to the image when fitting, converting pixels to points', () => {
    const layout = planImagePage(800, 600, { pageSize: 'fit', margin: 0 });

    expect(layout.pageWidth).toBeCloseTo(600, 1);
    expect(layout.pageHeight).toBeCloseTo(450, 1);
    expect(layout.drawWidth).toBeCloseTo(600, 1);
    expect(layout.drawHeight).toBeCloseTo(450, 1);
  });

  it('adds the margin to both edges when fitting', () => {
    const layout = planImagePage(800, 600, { pageSize: 'fit', margin: 20 });

    expect(layout.pageWidth).toBeCloseTo(640, 1);
    expect(layout.pageHeight).toBeCloseTo(490, 1);
    expect(layout.x).toBeCloseTo(20, 1);
    expect(layout.y).toBeCloseTo(20, 1);
  });

  it('centres the image inside the page', () => {
    const layout = planImagePage(400, 400, { pageSize: 'a4', orientation: 'portrait', margin: 0 });

    expect(layout.x).toBeCloseTo((layout.pageWidth - layout.drawWidth) / 2, 3);
    expect(layout.y).toBeCloseTo((layout.pageHeight - layout.drawHeight) / 2, 3);
  });

  it('never enlarges an image beyond its natural size', () => {
    const layout = planImagePage(100, 100, { pageSize: 'a4', margin: 0 });

    expect(layout.drawWidth).toBeCloseTo(75, 1);
  });

  it('shrinks a large image to fit inside the margins', () => {
    const layout = planImagePage(4000, 3000, { pageSize: 'a4', orientation: 'portrait', margin: 40 });

    expect(layout.drawWidth).toBeLessThanOrEqual(layout.pageWidth - 80 + 0.01);
    expect(layout.drawHeight).toBeLessThanOrEqual(layout.pageHeight - 80 + 0.01);
    // Aspect ratio preserved.
    expect(layout.drawWidth / layout.drawHeight).toBeCloseTo(4000 / 3000, 3);
  });
});
