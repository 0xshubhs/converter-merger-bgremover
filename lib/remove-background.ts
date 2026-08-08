import sharp from 'sharp';

type RemoveBackgroundOptions = {
  tolerance?: number;
  feather?: number;
};

type RgbaSample = {
  r: number;
  g: number;
  b: number;
  a: number;
};

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function sampleEdgeBackground(pixels: Buffer, width: number, height: number) {
  const samples: RgbaSample[] = [];

  for (let x = 0; x < width; x += 1) {
    samples.push(readPixel(pixels, x, 0, width));
    samples.push(readPixel(pixels, x, height - 1, width));
  }

  for (let y = 1; y < height - 1; y += 1) {
    samples.push(readPixel(pixels, 0, y, width));
    samples.push(readPixel(pixels, width - 1, y, width));
  }

  const total = samples.length || 1;

  return samples.reduce(
    (accumulator, sample) => ({
      r: accumulator.r + sample.r / total,
      g: accumulator.g + sample.g / total,
      b: accumulator.b + sample.b / total,
      a: accumulator.a + sample.a / total
    }),
    { r: 0, g: 0, b: 0, a: 0 }
  );
}

function readPixel(pixels: Buffer, x: number, y: number, width: number): RgbaSample {
  const offset = (y * width + x) * 4;
  return {
    r: pixels[offset] ?? 0,
    g: pixels[offset + 1] ?? 0,
    b: pixels[offset + 2] ?? 0,
    a: pixels[offset + 3] ?? 255
  };
}

function colorDistance(sample: RgbaSample, background: RgbaSample) {
  const red = sample.r - background.r;
  const green = sample.g - background.g;
  const blue = sample.b - background.b;
  return Math.sqrt(red * red + green * green + blue * blue);
}

export async function removeBackground(buffer: Buffer, options: RemoveBackgroundOptions = {}) {
  const tolerance = Math.max(0, Math.min(255, options.tolerance ?? 42));
  const feather = Math.max(0, Math.min(255, options.feather ?? 32));

  const image = sharp(buffer, { failOn: 'none' }).rotate().ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const background = sampleEdgeBackground(data, info.width, info.height);
  const output = Buffer.alloc(data.length);

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      const pixel = readPixel(data, x, y, info.width);
      const distance = colorDistance(pixel, background);

      let alpha = pixel.a;
      if (distance <= tolerance) {
        alpha = 0;
      } else if (feather > 0 && distance < tolerance + feather) {
        alpha = clampByte(((distance - tolerance) / feather) * 255);
      }

      output[offset] = pixel.r;
      output[offset + 1] = pixel.g;
      output[offset + 2] = pixel.b;
      output[offset + 3] = alpha;
    }
  }

  const png = await sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .png()
    .toBuffer();

  return {
    buffer: png,
    mime: 'image/png',
    extension: 'png'
  };
}