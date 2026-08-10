'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ResultPreview } from '@/components/result-preview';
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
  width: number;
};

type DragState = {
  id: number;
  page: number;
  mode: 'move' | 'resize';
  /** Pointer offset from the box origin at grab time, so the box does not jump. */
  offsetX: number;
  offsetY: number;
};

const MIN_WIDTH = 0.05;
const MAX_WIDTH = 0.9;

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

let placementId = 0;

export function SignPdf() {
  const selection = useFileSelection({ multiple: false, accept: isPdf, rejectMessage: 'Only PDF files can be signed.' });
  const { busy, error, results, clearResults, run } = useToolRun();

  const file = selection.files[0]?.file ?? null;
  const { pages, loading, error: previewError } = usePdfPreview(file);

  const [signature, setSignature] = useState<Blob | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureAspect, setSignatureAspect] = useState(1 / 3);
  const [defaultWidth, setDefaultWidth] = useState(0.25);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const surfaces = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    setPlacements([]);
    setSelectedId(null);
  }, [file]);

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

  const selected = placements.find((placement) => placement.id === selectedId) ?? null;

  // Drag is tracked on the window so the pointer may leave the box mid-drag.
  useEffect(() => {
    if (!drag) return;

    function handleMove(event: PointerEvent) {
      const surface = surfaces.current.get(drag!.page);
      if (!surface) return;

      const rect = surface.getBoundingClientRect();
      const pointerX = (event.clientX - rect.left) / rect.width;
      const pointerY = (event.clientY - rect.top) / rect.height;

      setPlacements((current) =>
        current.map((placement) => {
          if (placement.id !== drag!.id) return placement;

          if (drag!.mode === 'resize') {
            const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, pointerX - placement.x));

            return { ...placement, width: Math.min(width, 1 - placement.x) };
          }

          const height = placement.width * signatureAspect;

          return {
            ...placement,
            x: Math.min(1 - placement.width, Math.max(0, pointerX - drag!.offsetX)),
            y: Math.min(1 - height, Math.max(0, pointerY - drag!.offsetY))
          };
        })
      );
    }

    function handleUp() {
      setDrag(null);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [drag, signatureAspect]);

  function addPlacement(event: ReactPointerEvent<HTMLDivElement>, page: number) {
    if (!signatureUrl || drag) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = (event.clientX - rect.left) / rect.width;
    const pointerY = (event.clientY - rect.top) / rect.height;
    const height = defaultWidth * signatureAspect;

    placementId += 1;

    setPlacements((current) => [
      ...current,
      {
        id: placementId,
        page,
        x: Math.min(1 - defaultWidth, Math.max(0, pointerX - defaultWidth / 2)),
        y: Math.min(1 - height, Math.max(0, pointerY - height / 2)),
        width: defaultWidth
      }
    ]);
    setSelectedId(placementId);
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>, placement: Placement, mode: 'move' | 'resize') {
    event.stopPropagation();

    const surface = surfaces.current.get(placement.page);
    if (!surface) return;

    const rect = surface.getBoundingClientRect();

    setSelectedId(placement.id);
    setDrag({
      id: placement.id,
      page: placement.page,
      mode,
      offsetX: (event.clientX - rect.left) / rect.width - placement.x,
      offsetY: (event.clientY - rect.top) / rect.height - placement.y
    });
  }

  /** The slider retargets the selected signature, or sets the size for the next one. */
  function resizeSelected(percent: number) {
    const width = percent / 100;

    if (!selected) {
      setDefaultWidth(width);

      return;
    }

    setPlacements((current) =>
      current.map((placement) =>
        placement.id === selected.id ? { ...placement, width: Math.min(width, 1 - placement.x) } : placement
      )
    );
  }

  function removePlacement(id: number) {
    setPlacements((current) => current.filter((placement) => placement.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }

  function handleClear() {
    selection.clear();
    setPlacements([]);
    setSelectedId(null);
    clearResults();
  }

  const handleSignatureChange = useCallback((next: Blob | null) => setSignature(next), []);

  function handleSign() {
    if (!file || !signature || !placements.length) return;

    const boxes = placements.map(({ page, x, y, width }) => ({ page, x, y, width }));

    void run(() => signPdfInBrowser(file, signature, boxes));
  }

  const perPage = useMemo(() => {
    const grouped = new Map<number, Placement[]>();
    placements.forEach((placement) => {
      grouped.set(placement.page, [...(grouped.get(placement.page) ?? []), placement]);
    });

    return grouped;
  }, [placements]);

  const sliderWidth = Math.round((selected?.width ?? defaultWidth) * 100);

  return (
    <>
      <ToolLayout>
        <Panel>
          <PanelHeading
            title="Upload PDF"
            description="Click a page to drop your signature, then drag it to move or pull its corner to resize."
            action={
              <AddFilesButton
                label="Add PDF"
                accept="application/pdf,.pdf"
                multiple={false}
                onChange={selection.addFromInput}
              />
            }
          />

          {!file ? (
            <Dropzone
              isDragging={selection.isDragging}
              idleTitle="Drag and drop a PDF here"
              activeTitle="Drop the PDF here"
              hint="Create a signature on the right, then click the page to place it."
              handlers={selection.dropzoneProps}
            />
          ) : null}

          {loading ? <p className="mt-5 text-sm text-slate-400">Rendering pages...</p> : null}
          {previewError ? (
            <div className="mt-5">
              <ErrorBanner message={previewError} />
            </div>
          ) : null}

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
                    ref={(element) => {
                      if (element) surfaces.current.set(pageNumber, element);
                      else surfaces.current.delete(pageNumber);
                    }}
                    onPointerDown={(event) => addPlacement(event, pageNumber)}
                    className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white ${
                      signatureUrl ? 'cursor-copy' : 'cursor-default'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- rendered locally to a blob URL */}
                    <img src={page.url} alt={`Page ${pageNumber}`} className="block w-full" draggable={false} />

                    {(perPage.get(pageNumber) ?? []).map((placement) => {
                      const isSelected = placement.id === selectedId;

                      return (
                        <div
                          key={placement.id}
                          onPointerDown={(event) => startDrag(event, placement, 'move')}
                          style={{
                            left: `${placement.x * 100}%`,
                            top: `${placement.y * 100}%`,
                            width: `${placement.width * 100}%`,
                            touchAction: 'none'
                          }}
                          className={`absolute cursor-move rounded border-2 transition-colors ${
                            isSelected ? 'border-sky-500 bg-sky-400/10' : 'border-dashed border-sky-500/50'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- canvas-generated blob URL */}
                          <img
                            src={signatureUrl ?? ''}
                            alt="Signature"
                            className="pointer-events-none block w-full select-none"
                            draggable={false}
                          />

                          <button
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={() => removePlacement(placement.id)}
                            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow"
                            aria-label="Remove this signature"
                          >
                            ×
                          </button>

                          {isSelected ? (
                            <span
                              onPointerDown={(event) => startDrag(event, placement, 'resize')}
                              role="slider"
                              tabIndex={0}
                              aria-label="Resize signature"
                              aria-valuenow={Math.round(placement.width * 100)}
                              aria-valuemin={MIN_WIDTH * 100}
                              aria-valuemax={MAX_WIDTH * 100}
                              style={{ touchAction: 'none' }}
                              className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-sky-500 shadow"
                            />
                          ) : null}
                        </div>
                      );
                    })}
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
              label={selected ? 'Selected signature size:' : 'Size for new signatures:'}
              valueLabel={`${sliderWidth}% of page width`}
              value={sliderWidth}
              min={MIN_WIDTH * 100}
              max={MAX_WIDTH * 100}
              onChange={resizeSelected}
            />

            <StatList>
              <StatRow label="Document" value={file ? file.name : 'None selected'} />
              <StatRow label="Size" value={file ? formatBytes(file.size) : '—'} />
              <StatRow label="Pages" value={pages.length || '—'} />
              <StatRow label="Signatures placed" value={placements.length} />
            </StatList>

            <ErrorBanner message={error ?? selection.error} />

            {file && signatureUrl && !placements.length ? (
              <p className="text-sm text-sky-200">Click a page on the left to place your signature.</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <PrimaryButton disabled={!file || !signature || !placements.length || busy} onClick={handleSign}>
                {busy ? 'Signing...' : 'Finish & sign'}
              </PrimaryButton>
              <SecondaryButton disabled={!file || busy} onClick={handleClear}>
                Clear document
              </SecondaryButton>
            </div>

            <Hint>
              Click a signature to select it, drag it to move, and pull the blue corner handle to resize just that one.
              Everything happens in your browser: the document is never uploaded, so there is no size limit. This is an
              electronic signature &mdash; an image drawn into the page &mdash; not a cryptographic digital signature.
            </Hint>
          </div>
        </Panel>
      </ToolLayout>

      <ResultPreview results={results} onClear={clearResults} />
    </>
  );
}
