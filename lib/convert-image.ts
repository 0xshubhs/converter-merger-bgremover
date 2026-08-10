import sharp, { type Sharp } from 'sharp';
import { decodeHeicIfNeeded } from './decode-heic';
import { mimeForFormat, normalizeFormat, outputExtension, type SupportedOutputFormat } from './image-format';
import { MAX_IMAGE_DIMENSION } from './limits';

type ConversionOptions = {
  format: string;
  quality: number;
  inputName?: string;
  inputType?: string;
  maxDimension?: number;
};

function encode(instance: Sharp, format: SupportedOutputFormat, quality: number) {
  switch (format) {
    case 'jpeg':
      return instance.jpeg({ quality, mozjpeg: true, progressive: true, chromaSubsampling: quality >= 90 ? '4:4:4' : '4:2:0' });
    case 'png':
      // Palette quantisation is what makes the quality slider mean anything for PNG.
      return instance.png({ compressionLevel: 9, effort: 7, palette: quality < 100, quality });
    case 'webp':
      return instance.webp({ quality, effort: 4 });
    case 'avif':
      return instance.avif({ quality, effort: 4 });
    case 'tiff':
      return instance.tiff({ quality, compression: 'jpeg' });
    case 'gif':
      return instance.gif();
  }
}

export async function convertImage(buffer: Buffer, options: ConversionOptions) {
  const format = normalizeFormat(options.format);
  const quality = Math.max(1, Math.min(100, Math.round(options.quality)));
  const limit = options.maxDimension ?? MAX_IMAGE_DIMENSION;
  const decoded = await decodeHeicIfNeeded(buffer, options.inputName, options.inputType);

  const instance = sharp(decoded, { failOn: 'none' })
    .rotate()
    .resize({ width: limit, height: limit, fit: 'inside', withoutEnlargement: true });

  const output = await encode(instance, format, quality).toBuffer();

  return {
    buffer: output,
    extension: outputExtension(format),
    mime: mimeForFormat(format)
  };
}
