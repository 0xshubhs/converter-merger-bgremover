'use client';

import { useState, type ComponentType } from 'react';
import { BackgroundRemover } from '@/components/background-remover';
import { FileCompressor } from '@/components/file-compressor';
import { ImageConverter } from '@/components/image-converter';
import { ImageToPdf } from '@/components/image-to-pdf';
import { PdfMerger } from '@/components/pdf-merger';
import { SignPdf } from '@/components/sign-pdf';

type Tool = {
  key: string;
  label: string;
  description: string;
  output: string;
  Component: ComponentType;
};

const tools: Tool[] = [
  {
    key: 'convert',
    label: 'Convert',
    description: 'Batch image conversion',
    output: 'JPEG, PNG, WebP, AVIF, TIFF, GIF',
    Component: ImageConverter
  },
  {
    key: 'image-to-pdf',
    label: 'Image to PDF',
    description: 'Images into one document',
    output: 'Single PDF',
    Component: ImageToPdf
  },
  {
    key: 'compress',
    label: 'Compress',
    description: 'Lossless ZIP compression',
    output: 'Lossless ZIP',
    Component: FileCompressor
  },
  {
    key: 'remove',
    label: 'Remove background',
    description: 'Cut out the subject',
    output: 'Transparent PNG',
    Component: BackgroundRemover
  },
  {
    key: 'merge',
    label: 'Merge PDF',
    description: 'Combine PDF files',
    output: 'Single merged PDF',
    Component: PdfMerger
  },
  {
    key: 'sign',
    label: 'Sign PDF',
    description: 'Draw, type, or upload',
    output: 'Signed PDF',
    Component: SignPdf
  }
];

export function ConverterWorkspace() {
  const [activeKey, setActiveKey] = useState(tools[0].key);
  const active = tools.find((tool) => tool.key === activeKey) ?? tools[0];
  const ActiveTool = active.Component;

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-glow backdrop-blur-xl sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(125,211,252,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(196,181,253,0.12),_transparent_26%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.35em] text-sky-200/80">File tools</p>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Convert images, build PDFs, compress files, and cut out backgrounds in one interface.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Everything runs on your own server: nothing is uploaded to a third-party service, and every tool hands back a
                single download when it finishes.
              </p>
            </div>
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-300">
              {tools.map((tool) => (
                <div
                  key={tool.key}
                  className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 transition ${
                    tool.key === active.key ? 'bg-sky-400/15 text-white' : 'bg-white/5'
                  }`}
                >
                  <span>{tool.label}</span>
                  <span className="text-right text-sky-200">{tool.output}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-3 shadow-glow backdrop-blur-xl sm:p-4">
          <div role="tablist" aria-label="File tools" className="flex flex-wrap gap-3 p-2">
            {tools.map((tool) => {
              const isActive = tool.key === active.key;

              return (
                <button
                  key={tool.key}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  onClick={() => setActiveKey(tool.key)}
                  className={`min-w-[10rem] flex-1 rounded-2xl border px-4 py-4 text-left transition ${
                    isActive
                      ? 'border-sky-300/40 bg-sky-400/15 text-white shadow-[0_0_0_1px_rgba(125,211,252,0.2)]'
                      : 'border-white/10 bg-slate-950/30 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="text-sm font-semibold">{tool.label}</div>
                  <div className="mt-1 text-xs text-slate-400">{tool.description}</div>
                </button>
              );
            })}
          </div>

          <div role="tabpanel" className="p-2 sm:p-3">
            <ActiveTool />
          </div>
        </section>
      </div>
    </main>
  );
}
