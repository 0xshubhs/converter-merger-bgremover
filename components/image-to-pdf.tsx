'use client';

import { useState } from 'react';
import {
  AddFilesButton,
  Dropzone,
  ErrorBanner,
  FileGrid,
  FileTile,
  Hint,
  NoticeBanner,
  Panel,
  PanelHeading,
  PrimaryButton,
  RangeField,
  ReorderButtons,
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
import type { PdfOrientation, PdfPageSize } from '@/lib/images-to-pdf';

const pageSizeOptions = [
  { value: 'a4', label: 'A4 (210 × 297 mm)' },
  { value: 'letter', label: 'US Letter (8.5 × 11 in)' },
  { value: 'legal', label: 'US Legal (8.5 × 14 in)' },
  { value: 'fit', label: 'Fit page to each image' }
] as const satisfies ReadonlyArray<{ value: PdfPageSize; label: string }>;

const orientationOptions = [
  { value: 'auto', label: 'Auto' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' }
] as const satisfies ReadonlyArray<{ value: PdfOrientation; label: string }>;

export function ImageToPdf() {
  const selection = useFileSelection({
    withPreview: true,
    accept: (file) => !file.type || file.type.startsWith('image/'),
    rejectMessage: 'Only image files can be placed in a PDF.'
  });
  const { busy, error, notice, run } = useToolRun();

  const [pageSize, setPageSize] = useState<PdfPageSize>('a4');
  const [orientation, setOrientation] = useState<PdfOrientation>('auto');
  const [margin, setMargin] = useState(24);
  const [quality, setQuality] = useState(85);

  function handleCreate() {
    const formData = new FormData();
    selection.files.forEach((item) => formData.append('files', item.file, item.file.name));
    formData.append('pageSize', pageSize);
    formData.append('orientation', orientation);
    formData.append('margin', String(margin));
    formData.append('quality', String(quality));

    void run(() => postForm('/api/image-to-pdf', formData, `images-${Date.now()}.pdf`));
  }

  return (
    <ToolLayout>
      <Panel>
        <PanelHeading
          title="Upload images"
          description="Each image becomes one page, in the order shown below."
          action={<AddFilesButton label="Add images" accept="image/*,.heic,.heif" onChange={selection.addFromInput} />}
        />

        <Dropzone
          isDragging={selection.isDragging}
          idleTitle="Drag and drop images here"
          activeTitle="Drop images here to add pages"
          hint="Reorder the pages with the move buttons on each image."
          handlers={selection.dropzoneProps}
        />

        <FileGrid>
          {selection.files.map((item, index) => (
            <FileTile key={item.id} item={item} badge={`Page ${index + 1}`} onRemove={() => selection.remove(item.id)}>
              <ReorderButtons index={index} count={selection.files.length} onMove={selection.move} />
            </FileTile>
          ))}
        </FileGrid>
      </Panel>

      <Panel tinted>
        <h2 className="text-xl font-semibold text-white">PDF settings</h2>
        <div className="mt-5 space-y-5">
          <SelectField label="Page size" value={pageSize} options={pageSizeOptions} onChange={setPageSize} />

          <SegmentedControl
            label="Orientation"
            value={orientation}
            options={orientationOptions}
            onChange={setOrientation}
          />

          <RangeField label="Margin:" valueLabel={`${margin} pt`} value={margin} min={0} max={96} step={4} onChange={setMargin} />

          <RangeField label="Image quality:" valueLabel={`${quality}%`} value={quality} min={30} max={100} onChange={setQuality} />

          <StatList>
            <StatRow label="Images" value={selection.files.length} />
            <StatRow label="Pages" value={selection.files.length} />
            <StatRow label="Total size" value={formatBytes(selection.totalSize)} />
            <StatRow label="Output" value="Single PDF" />
          </StatList>

          <ErrorBanner message={error ?? selection.error} />
          <NoticeBanner message={notice ? `Some images were skipped — ${notice}` : null} />

          <div className="flex flex-wrap gap-3">
            <PrimaryButton disabled={!selection.files.length || busy} onClick={handleCreate}>
              {busy ? 'Building PDF...' : 'Create PDF'}
            </PrimaryButton>
            <SecondaryButton disabled={!selection.files.length || busy} onClick={selection.clear}>
              Clear images
            </SecondaryButton>
          </div>

          <Hint>
            Images are rotated using their EXIF orientation, flattened onto white, and centred on the page. Lower the quality
            slider to shrink the PDF, or pick &ldquo;Fit page to each image&rdquo; to keep the original aspect ratio on every page.
          </Hint>
        </div>
      </Panel>
    </ToolLayout>
  );
}
