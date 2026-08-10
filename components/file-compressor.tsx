'use client';

import { useState } from 'react';
import { ResultPreview } from '@/components/result-preview';
import {
  AddFilesButton,
  Dropzone,
  ErrorBanner,
  FileGrid,
  FileTile,
  Hint,
  Panel,
  PanelHeading,
  PrimaryButton,
  ProgressBar,
  RangeField,
  SecondaryButton,
  SegmentedControl,
  StatList,
  StatRow,
  ToolLayout
} from '@/components/ui';
import { compressFilesInBrowser } from '@/lib/browser/tools';
import { formatBytes } from '@/lib/client/transfer';
import { useFileSelection } from '@/lib/client/use-file-selection';
import { useToolRun } from '@/lib/client/use-tool-run';
import { canRecompressImage, detectType, type ResolutionPreset } from '@/lib/compression-presets';

const resolutionOptions = [
  { value: 'original', label: 'Best' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'small', label: 'Small' }
] as const satisfies ReadonlyArray<{ value: ResolutionPreset; label: string }>;

export function FileCompressor() {
  const selection = useFileSelection();
  const { busy, error, progress, results, clearResults, run } = useToolRun();

  const [quality, setQuality] = useState(75);
  const [resolution, setResolution] = useState<ResolutionPreset>('high');

  const supported = selection.files.filter((item) => {
    const type = detectType(item.file.name, item.file.type);

    return type === 'application/pdf' || canRecompressImage(type);
  }).length;

  function handleCompress() {
    const files = selection.files.map((item) => item.file);

    void run((report) => compressFilesInBrowser(files, { quality, resolution }, report));
  }

  function handleClear() {
    selection.clear();
    clearResults();
  }

  return (
    <>
      <ToolLayout>
        <Panel>
          <PanelHeading
            title="Upload files"
            description="Shrink PDFs and images without changing their format."
            action={<AddFilesButton label="Add files" onChange={selection.addFromInput} />}
          />

          <Dropzone
            isDragging={selection.isDragging}
            idleTitle="Drag and drop files here"
            activeTitle="Drop files here to compress them"
            hint="PDFs and JPEG, PNG, or WebP images are compressed in place. A PDF comes back as a PDF."
            handlers={selection.dropzoneProps}
          />

          <FileGrid>
            {selection.files.map((item) => (
              <FileTile key={item.id} item={item} onRemove={() => selection.remove(item.id)} />
            ))}
          </FileGrid>
        </Panel>

        <Panel tinted>
          <h2 className="text-xl font-semibold text-white">Compression settings</h2>
          <div className="mt-5 space-y-5">
            <RangeField
              label="Quality:"
              valueLabel={`${quality}%`}
              value={quality}
              min={30}
              max={95}
              onChange={setQuality}
            />

            <SegmentedControl
              label="Resolution"
              value={resolution}
              options={resolutionOptions}
              onChange={setResolution}
            />

            <StatList>
              <StatRow label="Files" value={selection.files.length} />
              <StatRow label="Can be compressed" value={`${supported} of ${selection.files.length}`} />
              <StatRow label="Total size" value={formatBytes(selection.totalSize)} />
              <StatRow label="Output" value="Same format as the input" />
            </StatList>

            {progress ? <ProgressBar {...progress} /> : null}

            <ErrorBanner message={error ?? selection.error} />

            <div className="flex flex-wrap gap-3">
              <PrimaryButton disabled={!selection.files.length || busy} onClick={handleCompress}>
                {busy ? 'Compressing...' : 'Compress files'}
              </PrimaryButton>
              <SecondaryButton disabled={!selection.files.length || busy} onClick={handleClear}>
                Clear files
              </SecondaryButton>
            </div>

            <Hint>
              This is real compression, not an archive: a PDF comes back as a smaller PDF and a JPEG as a smaller JPEG.
              PDF pages are re-rendered as images, which is what makes scanned documents shrink dramatically &mdash; the
              trade-off is that text in them stops being selectable. Files the browser cannot re-encode are passed through
              untouched and labelled as such.
            </Hint>
          </div>
        </Panel>
      </ToolLayout>

      <ResultPreview results={results} onClear={clearResults} />
    </>
  );
}
