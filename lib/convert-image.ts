import sharp from 'sharp';
import { normalizeFormat, outputExtension, type SupportedOutputFormat } from './image-format';

type ConversionOptions = {
  format: string;
  quality: number;
  inputName?: string;
};

type HeicConverterModule = {
  default?: (options: { buffer: Buffer; format: 'JPEG' | 'PNG'; quality?: number }) => Promise<Buffer>;
};

function outputOptions(format: SupportedOutputFormat, quality: number) {
  if (format === 'jpeg') {
    return { quality, mozjpeg: true };
  }

  if (format === 'png') {
    return { compressionLevel: 9 };
  }

  if (format === 'webp') {
    return { quality };
  }

  if (format === 'avif') {
    return { quality };
  }

  if (format === 'tiff') {
    return { quality };
  }

  return {};
}

function isHeicLike(inputName?: string) {
  return Boolean(inputName && /\.(heic|heif)$/i.test(inputName));
}

async function decodeHeic(buffer: Buffer, inputName?: string) {
  if (!isHeicLike(inputName)) {
    return buffer;
  }

  try {
    const heicConvert = (await import('heic-convert')) as HeicConverterModule;
    const converted = await heicConvert.default?.({ buffer, format: 'JPEG', quality: 1 });
    return converted ?? buffer;
  } catch {
    return buffer;
  }
}

export async function convertImage(buffer: Buffer, options: ConversionOptions) {
  const format = normalizeFormat(options.format);
  const quality = Math.max(1, Math.min(100, options.quality));
  const decodedBuffer = await decodeHeic(buffer, options.inputName);
  const instance = sharp(decodedBuffer, { failOn: 'none' }).rotate();

  const output = await instance.toFormat(format, outputOptions(format, quality)).toBuffer();

  return {
    buffer: output,
    extension: outputExtension(format),
    mime: `image/${format === 'jpeg' ? 'jpeg' : format}`
  };
}