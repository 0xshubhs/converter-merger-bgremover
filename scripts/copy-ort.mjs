// Copies the ONNX Runtime WASM binaries into public/ort so the browser loads
// them from this app's own domain rather than a CDN. Run before dev and build.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const target = join(root, 'public', 'ort');

// The single-threaded SIMD build; threads would need cross-origin isolation.
const wanted = /^ort-wasm-simd-threaded\.(wasm|mjs)$/;

await mkdir(target, { recursive: true });

const files = (await readdir(source)).filter((name) => wanted.test(name));

if (!files.length) {
  console.error('No ONNX Runtime WASM files found. Is onnxruntime-web installed?');
  process.exit(1);
}

await Promise.all(files.map((name) => copyFile(join(source, name), join(target, name))));

console.log(`Copied ${files.length} ONNX Runtime file(s) to public/ort`);
