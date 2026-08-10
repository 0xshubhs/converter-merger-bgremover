'use client';

import { useMemo, useState } from 'react';
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
  RangeField,
  SecondaryButton,
  SegmentedControl,
  SelectField,
  StatList,
  StatRow,
  ToolLayout
} from '@/components/ui';
import { formatBytes, postForm } from '@/lib/client/transfer';
import { useFileSelection } from '@/lib/client/use-file-selection';
import { useToolRun } from '@/lib/client/use-tool-run';
import { isLossyFormat, outputExtension, type SupportedOutputFormat } from '@/lib/image-format';
import { MAX_SERVER_REQUEST_BYTES } from '@/lib/limits';

const formatOptions = [
  { value: 'jpeg', label: 'JPEG (.jpg)' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'avif', label: 'AVIF' },
  { value: 'tiff', label: 'TIFF' },
  { value: 'gif', label: 'GIF' }
] as const satisfies ReadonlyArray<{ value: SupportedOutputFormat; label: string }>;

const modeOptions = [
  { value: 'quality', label: 'Quality' },
  { value: 'compression', label: 'Compression' }
] as const;

type CompressionMode = (typeof modeOptions)[number]['value'];

/** Higher compression means lower encoder quality, floored so output stays usable. */
function compressionToQuality(compression: number) {
  return Math.max(40, Math.round(100 - compression * 0.6));
}

export function ImageConverter() {
  const selection = useFileSelection({ withPreview: true, accept: (file) => !file.type || file.type.startsWith('image/'), rejectMessage: 'Only image files can be converted.' });
  const { busy, error, setError, results, clearResults, run } = useToolRun();

  const [format, setFormat] = useState<SupportedOutputFormat>('jpeg');
  const [quality, setQuality] = useState(92);
  const [mode, setMode] = useState<CompressionMode>('compression');
  const [compression, setCompression] = useState(50);

  const qualityMatters = isLossyFormat(format) || format === 'png';
  const effectiveQuality = mode === 'compression' ? compressionToQuality(compression) : quality;

  const estimatedSize = useMemo(
    () => Math.round(selection.totalSize * (1 - compression / 100)),
    [compression, selection.totalSize]
  );

  function handleConvert() {
    // Convert is the one tool that still uploads, so the platform cap applies.
    if (selection.totalSize > MAX_SERVER_REQUEST_BYTES) {
      setError(
        `This batch is ${formatBytes(selection.totalSize)}. Conversion runs on the server, which accepts up to ${formatBytes(MAX_SERVER_REQUEST_BYTES)} per batch — convert fewer images at a time.`
      );

      return;
    }

    const formData = new FormData();
    selection.files.forEach((item) => formData.append('files', item.file, item.file.name));
    formData.append('format', format);
    formData.append('quality', String(effectiveQuality));

    void run(() => postForm('/api/convert', formData, `converted-images-${Date.now()}.zip`));
  }

  return (
    <>
      <ToolLayout>
      <Panel>
        <PanelHeading
          title="Upload images"
          description="Select multiple images and convert them in one batch."
          action={<AddFilesButton label="Add images" accept="image/*,.heic,.heif" onChange={selection.addFromInput} />}
        />

        <Dropzone
          isDragging={selection.isDragging}
          idleTitle="Drag and drop images here"
          activeTitle="Drop images here to add them to the batch"
          hint="Multiple files are supported. You can also use the upload button."
          handlers={selection.dropzoneProps}
        />

        <FileGrid>
          {selection.files.map((item) => (
            <FileTile key={item.id} item={item} onRemove={() => selection.remove(item.id)} />
          ))}
        </FileGrid>
      </Panel>

      <Panel tinted>
        <h2 className="text-xl font-semibold text-white">Conversion settings</h2>
        <div className="mt-5 space-y-5">
          <SelectField label="Output format" value={format} options={formatOptions} onChange={setFormat} />

          <SegmentedControl label="Compression control" value={mode} options={modeOptions} onChange={setMode} />

          {mode === 'quality' ? (
            <RangeField
              label="Quality:"
              valueLabel={qualityMatters ? String(quality) : 'not used by GIF'}
              value={quality}
              min={40}
              max={100}
              disabled={!qualityMatters}
              onChange={setQuality}
            />
          ) : (
            <RangeField
              label="Compression strength:"
              valueLabel={`${compression}%`}
              value={compression}
              min={10}
              max={90}
              onChange={setCompression}
            />
          )}

          <StatList>
            <StatRow label="Files" value={selection.files.length} />
            <StatRow label="Total size" value={formatBytes(selection.totalSize)} />
            <StatRow
              label={mode === 'compression' ? 'Rough output estimate' : 'Encoder quality'}
              value={mode === 'compression' ? formatBytes(estimatedSize) : `${effectiveQuality}%`}
            />
            <StatRow label="Output extension" value={`.${outputExtension(format)}`} />
          </StatList>

          <ErrorBanner message={error ?? selection.error} />

          <div className="flex flex-wrap gap-3">
            <PrimaryButton disabled={!selection.files.length || busy} onClick={handleConvert}>
              {busy ? 'Converting...' : 'Convert all'}
            </PrimaryButton>
            <SecondaryButton disabled={!selection.files.length || busy} onClick={selection.clear}>
              Clear files
            </SecondaryButton>
          </div>

          <Hint>
            Results appear below for you to check before downloading &mdash; nothing is saved automatically. The size estimate
            is a guide only; the real result depends on the image. HEIC, JPEG, PNG, WebP, AVIF, TIFF, and GIF inputs are
            handled on the server, which is why this tool has an upload limit and the others do not.
          </Hint>
        </div>
      </Panel>
      </ToolLayout>

      <ResultPreview results={results} onClear={clearResults} />
    </>
  );
}
