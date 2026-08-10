import { NextRequest } from 'next/server';
import { binaryResponse, collectFiles, errorResponse, readFormData, readNumber, stripExtension } from '@/lib/http';
import { removeBackground } from '@/lib/remove-background';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await readFormData(request);
    const [file] = collectFiles(formData, { key: 'file', label: 'image', maxFiles: 1 });

    const tolerance = readNumber(formData, 'tolerance', 42, 0, 441);
    const feather = readNumber(formData, 'feather', 32, 0, 441);
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    const result = await removeBackground(inputBuffer, {
      tolerance,
      feather,
      inputName: file.name,
      inputType: file.type
    });

    return binaryResponse(result.buffer, result.mime, `${stripExtension(file.name)}-no-background.png`);
  } catch (error) {
    return errorResponse(error, 'Background removal failed unexpectedly.');
  }
}
