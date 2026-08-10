'use client';

import { useState } from 'react';
import {
  AddFilesButton,
  Dropzone,
  ErrorBanner,
  Hint,
  Panel,
  PanelHeading,
  PrimaryButton,
  RangeField,
  RemoveButton,
  SecondaryButton,
  StatList,
  StatRow,
  ToolLayout
} from '@/components/ui';
import { formatBytes, postForm } from '@/lib/client/transfer';
import { useFileSelection } from '@/lib/client/use-file-selection';
import { useToolRun } from '@/lib/client/use-tool-run';

export function BackgroundRemover() {
  const selection = useFileSelection({
    multiple: false,
    withPreview: true,
    accept: (file) => !file.type || file.type.startsWith('image/'),
    rejectMessage: 'Only image files are supported.'
  });
  const { busy, error, run } = useToolRun();

  const [tolerance, setTolerance] = useState(42);
  const [feather, setFeather] = useState(32);

  const selected = selection.files[0] ?? null;

  function handleRemoveBackground() {
    if (!selected) return;

    const formData = new FormData();
    formData.append('file', selected.file, selected.file.name);
    formData.append('tolerance', String(tolerance));
    formData.append('feather', String(feather));

    const fallback = `${selected.file.name.replace(/\.[^/.]+$/, '')}-no-background.png`;

    void run(() => postForm('/api/remove-background', formData, fallback));
  }

  return (
    <ToolLayout>
      <Panel>
        <PanelHeading
          title="Upload image"
          description="Best for plain or near-uniform backgrounds."
          action={
            <AddFilesButton label="Add image" accept="image/*,.heic,.heif" multiple={false} onChange={selection.addFromInput} />
          }
        />

        <Dropzone
          isDragging={selection.isDragging}
          idleTitle="Drag and drop an image here"
          activeTitle="Drop the image here"
          hint="The output will be a transparent PNG."
          handlers={selection.dropzoneProps}
        />

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
          <div className="flex min-h-[300px] items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(125,211,252,0.08),_transparent_42%)] p-4">
            {selected?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob URLs cannot use the image optimizer
              <img className="max-h-[360px] w-full rounded-2xl object-contain" src={selected.previewUrl} alt={selected.file.name} />
            ) : (
              <div className="max-w-sm text-center text-sm leading-6 text-slate-400">
                Upload an image with a visible background and the tool will try to cut the subject out.
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
          <RangeField label="Tolerance:" valueLabel={String(tolerance)} value={tolerance} min={0} max={200} onChange={setTolerance} />
          <RangeField label="Feather:" valueLabel={String(feather)} value={feather} min={0} max={200} onChange={setFeather} />

          <StatList>
            <StatRow label="Selected image" value={selected ? '1' : '0'} />
            <StatRow label="Output" value="Transparent PNG" />
            <StatRow label="Edge softness" value={feather === 0 ? 'Hard cut' : `${feather} levels`} />
          </StatList>

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
            The background colour is sampled from the border of the image, then pixels close to it are made transparent.
            Raise the tolerance if parts of the background remain, and lower it if the subject starts disappearing.
          </Hint>
        </div>
      </Panel>
    </ToolLayout>
  );
}
