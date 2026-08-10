'use client';

import { useState } from 'react';
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
  StatList,
  StatRow,
  ToolLayout
} from '@/components/ui';
import { formatBytes, postForm } from '@/lib/client/transfer';
import { useFileSelection } from '@/lib/client/use-file-selection';
import { useToolRun } from '@/lib/client/use-tool-run';

export function FileCompressor() {
  const selection = useFileSelection();
  const { busy, error, run } = useToolRun();

  const [level, setLevel] = useState(9);
  const [resultSize, setResultSize] = useState<number | null>(null);

  async function handleCompress() {
    const formData = new FormData();
    selection.files.forEach((item) => formData.append('files', item.file, item.file.name));
    formData.append('level', String(level));

    const payload = await run(() => postForm('/api/compress', formData, `compressed-files-${Date.now()}.zip`));

    if (payload) setResultSize(payload.blob.size);
  }

  function handleClear() {
    selection.clear();
    setResultSize(null);
  }

  const savings =
    resultSize !== null && selection.totalSize > 0
      ? Math.max(0, 100 - Math.round((resultSize / selection.totalSize) * 100))
      : null;

  return (
    <ToolLayout>
      <Panel>
        <PanelHeading
          title="Upload files"
          description="Compress documents, PDFs, images, and other files without changing their contents."
          action={<AddFilesButton label="Add files" onChange={selection.addFromInput} />}
        />

        <Dropzone
          isDragging={selection.isDragging}
          idleTitle="Drag and drop files here"
          activeTitle="Drop files here to compress them"
          hint="This creates a lossless ZIP archive, so the file contents stay unchanged."
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
            label="Compression level:"
            valueLabel={`${level}/9`}
            value={level}
            min={1}
            max={9}
            onChange={setLevel}
          />

          <StatList>
            <StatRow label="Files" value={selection.files.length} />
            <StatRow label="Total size" value={formatBytes(selection.totalSize)} />
            <StatRow label="Mode" value="Lossless ZIP" />
            <StatRow label="Last result" value={resultSize !== null ? formatBytes(resultSize) : 'Not created yet'} />
            {savings !== null ? <StatRow label="Reduction" value={`${savings}%`} /> : null}
          </StatList>

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
            ZIP compression is lossless, so the files can be extracted back exactly as they were. Files that are already
            compressed, such as JPEG, PNG, or PDF, may not shrink much.
          </Hint>
        </div>
      </Panel>
    </ToolLayout>
  );
}
