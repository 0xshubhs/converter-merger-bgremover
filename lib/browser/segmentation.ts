'use client';

import { RMBG_INPUT_SIZE, applyAlphaMask, normalizeMask, toModelInput } from '@/lib/segmentation-math';
import type { ProgressReporter } from './tools';

/**
 * RMBG-1.4, quantised to ~44 MB. Downloaded once and kept in the Cache Storage
 * API, so later runs start instantly. Set NEXT_PUBLIC_RMBG_MODEL_URL to serve it
 * from your own domain instead of the Hugging Face CDN.
 *
 * Licence: CC BY-NC 4.0 — free for non-commercial use only.
 */
const MODEL_URL =
  process.env.NEXT_PUBLIC_RMBG_MODEL_URL ??
  'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx';

const MODEL_CACHE = 'rmbg-model-v1';

type OrtModule = typeof import('onnxruntime-web');
type Session = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;

let sessionPromise: Promise<Session> | null = null;

async function fetchModel(onProgress: ProgressReporter): Promise<ArrayBuffer> {
  const cache = typeof caches !== 'undefined' ? await caches.open(MODEL_CACHE) : null;
  const cached = await cache?.match(MODEL_URL);

  if (cached) return cached.arrayBuffer();

  const response = await fetch(MODEL_URL);

  if (!response.ok || !response.body) {
    throw new Error(`The background removal model could not be downloaded (${response.status}).`);
  }

  // Stream it so the first run can show real download progress.
  const total = Number(response.headers.get('Content-Length') ?? 0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    received += value.byteLength;

    const mb = (received / 1048576).toFixed(1);
    onProgress(received, total || received, `Downloading the AI model — ${mb} MB${total ? ` of ${(total / 1048576).toFixed(0)} MB` : ''}`);
  }

  const buffer = new Uint8Array(received);
  let position = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, position);
    position += chunk.byteLength;
  }

  await cache?.put(MODEL_URL, new Response(buffer, { headers: { 'Content-Type': 'application/octet-stream' } }));

  return buffer.buffer;
}

async function getSession(onProgress: ProgressReporter) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import('onnxruntime-web');

      // Served from /public/ort by scripts/copy-ort.mjs, so no CDN is involved.
      ort.env.wasm.wasmPaths = '/ort/';
      // Threads need cross-origin isolation headers, which we do not set.
      ort.env.wasm.numThreads = 1;

      const model = await fetchModel(onProgress);

      onProgress(1, 1, 'Starting the AI model');

      return ort.InferenceSession.create(model, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });
    })().catch((error) => {
      // Never cache a failed load, or every later attempt fails too.
      sessionPromise = null;
      throw error;
    });
  }

  return sessionPromise;
}

/**
 * Runs RMBG-1.4 over the canvas and returns a per-pixel foreground mask scaled
 * back to the canvas dimensions.
 */
export async function segmentForeground(
  canvas: HTMLCanvasElement,
  onProgress: ProgressReporter
): Promise<Float32Array> {
  const ort = await import('onnxruntime-web');
  const session = await getSession(onProgress);

  onProgress(0, 1, 'Finding the subject');

  // Squash to the model's square input; the mask is stretched back afterwards.
  const input = document.createElement('canvas');
  input.width = RMBG_INPUT_SIZE;
  input.height = RMBG_INPUT_SIZE;

  const inputContext = input.getContext('2d', { willReadFrequently: true });
  if (!inputContext) throw new Error('This browser could not provide a 2D canvas.');

  inputContext.drawImage(canvas, 0, 0, RMBG_INPUT_SIZE, RMBG_INPUT_SIZE);
  const pixels = inputContext.getImageData(0, 0, RMBG_INPUT_SIZE, RMBG_INPUT_SIZE).data;

  const tensor = new ort.Tensor('float32', toModelInput(pixels, RMBG_INPUT_SIZE), [
    1,
    3,
    RMBG_INPUT_SIZE,
    RMBG_INPUT_SIZE
  ]);

  const outputs = await session.run({ [session.inputNames[0]]: tensor });
  const raw = outputs[session.outputNames[0]].data as Float32Array;
  const normalized = normalizeMask(raw);

  onProgress(1, 1, 'Cutting out the subject');

  // Scale the mask back up using the canvas's own bilinear filtering.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = RMBG_INPUT_SIZE;
  maskCanvas.height = RMBG_INPUT_SIZE;

  const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!maskContext) throw new Error('This browser could not provide a 2D canvas.');

  const maskImage = maskContext.createImageData(RMBG_INPUT_SIZE, RMBG_INPUT_SIZE);

  for (let pixel = 0; pixel < normalized.length; pixel += 1) {
    const value = Math.round(normalized[pixel] * 255);
    const offset = pixel * 4;

    maskImage.data[offset] = value;
    maskImage.data[offset + 1] = value;
    maskImage.data[offset + 2] = value;
    maskImage.data[offset + 3] = 255;
  }

  maskContext.putImageData(maskImage, 0, 0);

  const scaled = document.createElement('canvas');
  scaled.width = canvas.width;
  scaled.height = canvas.height;

  const scaledContext = scaled.getContext('2d', { willReadFrequently: true });
  if (!scaledContext) throw new Error('This browser could not provide a 2D canvas.');

  scaledContext.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
  const scaledPixels = scaledContext.getImageData(0, 0, canvas.width, canvas.height).data;

  const mask = new Float32Array(canvas.width * canvas.height);

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    mask[pixel] = scaledPixels[pixel * 4] / 255;
  }

  // Release the scratch canvases rather than waiting for GC.
  [input, maskCanvas, scaled].forEach((element) => {
    element.width = 0;
    element.height = 0;
  });

  return mask;
}

export { applyAlphaMask };
