'use client';

import {
  AddFilesButton,
  Dropzone,
  ErrorBanner,
  Hint,
  Panel,
  PanelHeading,
  PrimaryButton,
  ProgressBar,
  RemoveButton,
  ReorderButtons,
  SecondaryButton,
  StatList,
  StatRow,
  ToolLayout
} from '@/components/ui';
import { mergePdfsInBrowser } from '@/lib/browser/tools';
import { formatBytes } from '@/lib/client/transfer';
import { useFileSelection } from '@/lib/client/use-file-selection';
import { useToolRun } from '@/lib/client/use-tool-run';

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function PdfMerger() {
  const selection = useFileSelection({ accept: isPdf, rejectMessage: 'Only PDF files can be merged.' });
  const { busy, error, progress, run } = useToolRun();

  function handleMerge() {
    const files = selection.files.map((item) => item.file);

    void run((report) => mergePdfsInBrowser(files, report));
  }

  return (
    <ToolLayout>
      <Panel>
        <PanelHeading
          title="Upload PDFs"
          description="Combine multiple PDFs into one file in the order you choose."
          action={<AddFilesButton label="Add PDFs" accept="application/pdf,.pdf" onChange={selection.addFromInput} />}
        />

        <Dropzone
          isDragging={selection.isDragging}
          idleTitle="Drag and drop PDFs here"
          activeTitle="Drop PDFs here to queue them"
          hint="Files will merge from top to bottom in the list."
          handlers={selection.dropzoneProps}
        />

        <div className="mt-6 grid gap-3">
          {selection.files.map((item, index) => (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sky-400/15 px-2 py-1 text-[11px] font-semibold text-sky-100">
                      {index + 1}
                    </span>
                    <h3 className="truncate text-sm font-semibold text-white" title={item.file.name}>
                      {item.file.name}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{formatBytes(item.file.size)}</p>
                </div>
                <RemoveButton onClick={() => selection.remove(item.id)} />
              </div>

              <div className="mt-3">
                <ReorderButtons index={index} count={selection.files.length} onMove={selection.move} />
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel tinted>
        <h2 className="text-xl font-semibold text-white">Merge settings</h2>
        <div className="mt-5 space-y-5">
          <StatList>
            <StatRow label="Selected PDFs" value={selection.files.length} />
            <StatRow label="Total size" value={formatBytes(selection.totalSize)} />
            <StatRow label="Output" value="Single PDF" />
            <StatRow label="Order" value="Manual" />
          </StatList>

          {progress ? <ProgressBar {...progress} /> : null}

          <ErrorBanner message={error ?? selection.error} />

          <div className="flex flex-wrap gap-3">
            <PrimaryButton disabled={selection.files.length < 2 || busy} onClick={handleMerge}>
              {busy ? 'Merging...' : 'Merge PDFs'}
            </PrimaryButton>
            <SecondaryButton disabled={!selection.files.length || busy} onClick={selection.clear}>
              Clear list
            </SecondaryButton>
          </div>

          <Hint>
            Merging happens in your browser, so the PDFs are never uploaded and there is no size limit. Pages are combined
            in the order shown above. Password-protected files have to be unlocked first.
          </Hint>
        </div>
      </Panel>
    </ToolLayout>
  );
}
