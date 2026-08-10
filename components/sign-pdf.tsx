'use client';

import { useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { SignaturePad } from '@/components/signature-pad';
import {
  AddFilesButton,
  Dropzone,
  ErrorBanner,
  Hint,
  Panel,
  PanelHeading,
  PrimaryButton,
  RangeField,
  SecondaryButton,
  StatList,
  StatRow,
  ToolLayout
} from '@/components/ui';
import { signPdfInBrowser } from '@/lib/browser/tools';
import { formatBytes } from '@/lib/client/transfer';
import { useFileSelection } from '@/lib/client/use-file-selection';
import { usePdfPreview } from '@/lib/client/use-pdf-preview';
import { useToolRun } from '@/lib/client/use-tool-run';

type Placement = {
  id: number;
  page: number;
  x: number;
  y: number;
};

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

let placementId = 0;

export function SignPdf() {
  const selection = useFileSelection({ multiple: false, accept: isPdf, rejectMessage: 'Only PDF files can be signed.' });
  const { busy, error, run } = useToolRun();

  const document = selection.files[0]?.file ?? null;
  const { pages, loading, error: previewError } = usePdfPreview(document);

  const [signature, setSignature] = useState<Blob | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureAspect, setSignatureAspect] = useState(1 / 3);
  const [width, setWidth] = useState(0.25);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);

  // Placements are meaningless once a different document is loaded.
  useEffect(() => {
    setPlacements([]);
  }, [document]);

  useEffect(() => {
    if (!signature) {
      setSignatureUrl(null);

      return;
    }

    const url = URL.createObjectURL(signature);
    setSignatureUrl(url);

    const image = new Image();
    image.onload = () => setSignatureAspect(image.height / image.width || 1 / 3);
    image.src = url;

    return () => URL.revokeObjectURL(url);
  }, [signature]);

  const handleSignatureChange = useCallback((next: Blob | null) => setSignature(next), []);

  function pointOn(event: ReactPointerEvent<HTMLElement>, element: HTMLElement) {
    const rect = element.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    };
  }

  function addPlacement(event: ReactPointerEvent<HTMLDivElement>, page: number) {
    if (!signatureUrl || dragging !== null) return;

    const point = pointOn(event, event.currentTarget);
    placementId += 1;

    // Drop it centred under the cursor.
    setPlacements((current) => [
      ...current,
      {
        id: placementId,
        page,
        x: Math.min(1 - width, Math.max(0, point.x - width / 2)),
        y: Math.min(1, Math.max(0, point.y - (width * signatureAspect) / 2))
      }
    ]);
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>, id: number) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(id);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>, id: number) {
    if (dragging !== id) return;

    const surface = event.currentTarget.parentElement;
    if (!surface) return;

    const point = pointOn(event, surface);
    const height = width * signatureAspect;

    setPlacements((current) =>
      current.map((placement) =>
        placement.id === id
          ? {
              ...placement,
              x: Math.min(1 - width, Math.max(0, point.x - width / 2)),
              y: Math.min(1 - height, Math.max(0, point.y - height / 2))
            }
          : placement
      )
    );
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragging === null) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    // Deferred so the click that ends a drag does not also drop a new signature.
    setTimeout(() => setDragging(null), 0);
  }

  function removePlacement(id: number) {
    setPlacements((current) => current.filter((placement) => placement.id !== id));
  }

  function handleClear() {
    selection.clear();
    setPlacements([]);
  }

  function handleSign() {
    if (!document || !signature || !placements.length) return;

    const file = document;
    const png = signature;
    const boxes = placements.map(({ page, x, y }) => ({ page, x, y, width }));

    void run(() => signPdfInBrowser(file, png, boxes));
  }

  const perPage = useMemo(() => {
    const grouped = new Map<number, Placement[]>();
    placements.forEach((placement) => {
      grouped.set(placement.page, [...(grouped.get(placement.page) ?? []), placement]);
    });

    return grouped;
  }, [placements]);

  return (
    <ToolLayout>
      <Panel>
        <PanelHeading
          title="Upload PDF"
          description="Click anywhere on a page to drop your signature, then drag it into place."
          action={<AddFilesButton label="Add PDF" accept="application/pdf,.pdf" multiple={false} onChange={selection.addFromInput} />}
        />

        {!document ? (
          <Dropzone
            isDragging={selection.isDragging}
            idleTitle="Drag and drop a PDF here"
            activeTitle="Drop the PDF here"
            hint="Create a signature on the right, then click the page to place it."
            handlers={selection.dropzoneProps}
          />
        ) : null}

        {loading ? <p className="mt-5 text-sm text-slate-400">Rendering pages...</p> : null}
        {previewError ? <div className="mt-5"><ErrorBanner message={previewError} /></div> : null}

        <div className="mt-6 space-y-6">
          {pages.map((page, index) => {
            const pageNumber = index + 1;

            return (
              <div key={page.url} className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Page {pageNumber} of {pages.length}
                  </span>
                  <span>{perPage.get(pageNumber)?.length ?? 0} signature(s)</span>
                </div>

                <div
                  onPointerDown={(event) => addPlacement(event, pageNumber)}
                  className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white ${
                    signatureUrl ? 'cursor-copy' : 'cursor-default'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- rendered locally to a blob URL */}
                  <img src={page.url} alt={`Page ${pageNumber}`} className="block w-full" />

                  {(perPage.get(pageNumber) ?? []).map((placement) => (
                    <div
                      key={placement.id}
                      onPointerDown={(event) => startDrag(event, placement.id)}
                      onPointerMove={(event) => moveDrag(event, placement.id)}
                      onPointerUp={endDrag}
                      style={{
                        left: `${placement.x * 100}%`,
                        top: `${placement.y * 100}%`,
                        width: `${width * 100}%`,
                        touchAction: 'none'
                      }}
                      className="absolute cursor-move rounded border border-dashed border-sky-500/70 bg-sky-400/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- canvas-generated blob URL */}
                      <img src={signatureUrl ?? ''} alt="Signature" className="pointer-events-none block w-full" />
                      <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => removePlacement(placement.id)}
                        className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-slate-900 text-xs font-bold text-white shadow"
                        aria-label="Remove this signature"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel tinted>
        <h2 className="text-xl font-semibold text-white">Signature</h2>
        <div className="mt-5 space-y-5">
          <SignaturePad onChange={handleSignatureChange} />

          <RangeField
            label="Size on the page:"
            valueLabel={`${Math.round(width * 100)}% of page width`}
            value={Math.round(width * 100)}
            min={5}
            max={60}
            onChange={(value) => setWidth(value / 100)}
          />

          <StatList>
            <StatRow label="Document" value={document ? document.name : 'None selected'} />
            <StatRow label="Size" value={document ? formatBytes(document.size) : '—'} />
            <StatRow label="Pages" value={pages.length || '—'} />
            <StatRow label="Signatures placed" value={placements.length} />
          </StatList>

          <ErrorBanner message={error ?? selection.error} />

          {document && signatureUrl && !placements.length ? (
            <p className="text-sm text-sky-200">Click a page on the left to place your signature.</p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <PrimaryButton disabled={!document || !signature || !placements.length || busy} onClick={handleSign}>
              {busy ? 'Signing...' : 'Finish & sign'}
            </PrimaryButton>
            <SecondaryButton disabled={!document || busy} onClick={handleClear}>
              Clear document
            </SecondaryButton>
          </div>

          <Hint>
            The signature is drawn into the page content, so it stays where you put it in any PDF reader. This is an
            electronic signature — an image on the page — not a cryptographic digital signature.
          </Hint>
        </div>
      </Panel>
    </ToolLayout>
  );
}
