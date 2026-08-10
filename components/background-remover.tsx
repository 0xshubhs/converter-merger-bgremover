'use client';

import { useState } from 'react';
import { ResultPreview } from '@/components/result-preview';
import {
  AddFilesButton,
  Dropzone,
  ErrorBanner,
  Hint,
  Panel,
  PanelHeading,
  PrimaryButton,
  ProgressBar,
  RangeField,
  RemoveButton,
  SecondaryButton,
  StatList,
  StatRow,
  ToolLayout
} from '@/components/ui';
import { removeBackgroundInBrowser } from '@/lib/browser/tools';
import { formatBytes } from '@/lib/client/transfer';
import { useFileSelection } from '@/lib/client/use-file-selection';
import { useToolRun } from '@/lib/client/use-tool-run';

export function BackgroundRemover() {
  const selection = useFileSelection({
    multiple: false,
    withPreview: true,
    accept: (file) => !file.type || file.type.startsWith('image/'),
    rejectMessage: 'Only image files are supported.'
  });
  const { busy, error, progress, results, clearResults, run } = useToolRun();

  const [softness, setSoftness] = useState(30);

  const selected = selection.files[0] ?? null;

  function handleRemoveBackground() {
    if (!selected) return;

    const file = selected.file;

    void run((report) => removeBackgroundInBrowser(file, softness / 100, report));
  }

  return (
    <>
      <ToolLayout>
      <Panel>
        <PanelHeading
          title="Upload image"
          description="Works on people, products, and busy backgrounds."
          action={
            <AddFilesButton label="Add image" accept="image/*,.heic,.heif" multiple={false} onChange={selection.addFromInput} />
          }
        />

        <Dropzone
          isDragging={selection.isDragging}
          idleTitle="Drag and drop an image here"
          activeTitle="Drop the image here"
          hint="The subject is detected automatically. Output is a transparent PNG."
          handlers={selection.dropzoneProps}
        />

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
          <div className="flex min-h-[300px] items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(125,211,252,0.08),_transparent_42%)] p-4">
            {selected?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob URLs cannot use the image optimizer
              <img className="max-h-[360px] w-full rounded-2xl object-contain" src={selected.previewUrl} alt={selected.file.name} />
            ) : (
              <div className="max-w-sm text-center text-sm leading-6 text-slate-400">
Upload a photo and the AI model will cut the subject out for you.
              </div>
            )}
          </div>
          {selected ? (
            <div className="flex items-start justify-between gap-3 border-t border-white/10 p-4">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-white">{selected.file.name}</h3>
                <p className="text-xs text-slate-400">{formatBytes(selected.file.size)}</p>
              </div>
              <RemoveButton onClick={selection.clear} />
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel tinted>
        <h2 className="text-xl font-semibold text-white">Removal settings</h2>
        <div className="mt-5 space-y-5">
          <RangeField
            label="Edge softness:"
            valueLabel={softness <= 5 ? 'Hard cut' : `${softness}%`}
            value={softness}
            min={1}
            max={100}
            onChange={setSoftness}
          />

          <StatList>
            <StatRow label="Selected image" value={selected ? '1' : '0'} />
            <StatRow label="Output" value="Transparent PNG" />
            <StatRow label="Model" value="RMBG-1.4" />
          </StatList>

          {progress ? <ProgressBar {...progress} /> : null}

          <ErrorBanner message={error ?? selection.error} />

          <div className="flex flex-wrap gap-3">
            <PrimaryButton disabled={!selected || busy} onClick={handleRemoveBackground}>
              {busy ? 'Removing...' : 'Remove background'}
            </PrimaryButton>
            <SecondaryButton disabled={!selected || busy} onClick={selection.clear}>
              Clear image
            </SecondaryButton>
          </div>

          <Hint>
            Uses the RMBG-1.4 segmentation model, the same class of AI that remove.bg runs. It handles people, products,
            hair, and busy backgrounds rather than just flat ones. The model is about 44 MB and downloads once on first
            use, then stays cached; your image itself is never uploaded. Licensed CC BY-NC &mdash; non-commercial use only.
          </Hint>
        </div>
      </Panel>
      </ToolLayout>

      <ResultPreview results={results} onClear={clearResults} />
    </>
  );
}
