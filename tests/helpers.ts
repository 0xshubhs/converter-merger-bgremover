import sharp from 'sharp';

/** Builds a solid-colour test image in memory so tests need no fixture files. */
export function makeImage(width: number, height: number, background = '#3355aa', format: 'png' | 'jpeg' = 'png') {
  const image = sharp({ create: { width, height, channels: 3, background } });

  return (format === 'png' ? image.png() : image.jpeg()).toBuffer();
}

/** A red square centred on a white field — a clean subject for background removal. */
export async function makeSubjectOnWhite(size = 200, subject = 80) {
  const block = await sharp({ create: { width: subject, height: subject, channels: 3, background: '#cc0000' } })
    .png()
    .toBuffer();

  return sharp({ create: { width: size, height: size, channels: 3, background: '#ffffff' } })
    .composite([{ input: block, top: Math.round((size - subject) / 2), left: Math.round((size - subject) / 2) }])
    .png()
    .toBuffer();
}

export function makeFile(name: string, data: Uint8Array | string, type = 'application/octet-stream') {
  return new File([data as BlobPart], name, { type });
}

export async function readPixel(png: Buffer, x: number, y: number) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * 4;

  return { r: data[offset], g: data[offset + 1], b: data[offset + 2], a: data[offset + 3] };
}
