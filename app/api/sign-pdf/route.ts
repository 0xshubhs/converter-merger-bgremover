import { NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { binaryResponse, collectFiles, errorResponse, HttpError, readFormData, stripExtension } from '@/lib/http';
import { parsePlacements, signPdf } from '@/lib/sign-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await readFormData(request);
    const [document] = collectFiles(formData, { key: 'file', label: 'PDF', maxFiles: 1 });
    const [signature] = collectFiles(formData, { key: 'signature', label: 'signature image', maxFiles: 1 });

    const pdfBytes = new Uint8Array(await document.arrayBuffer());

    // Page count is needed to validate placements before any drawing happens.
    let pageCount: number;

    try {
      pageCount = (await PDFDocument.load(pdfBytes, { ignoreEncryption: false })).getPageCount();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'could not be read';
      throw new HttpError(422, `The PDF could not be opened. ${reason}`);
    }

    const placements = parsePlacements(formData.get('placements') as string | null, pageCount);

    const result = await signPdf({
      pdfBytes,
      signaturePng: Buffer.from(await signature.arrayBuffer()),
      placements
    });

    const response = binaryResponse(result.bytes, result.mime, `${stripExtension(document.name)}-signed.pdf`);

    response.headers.set('X-Signature-Count', String(result.signatureCount));

    return response;
  } catch (error) {
    return errorResponse(error, 'Signing failed unexpectedly.');
  }
}
