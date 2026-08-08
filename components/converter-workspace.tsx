'use client';

import { BackgroundRemover } from '@/components/background-remover';
import { ImageConverter } from '@/components/image-converter';
import { PdfMerger } from '@/components/pdf-merger';
import { useState } from 'react';

type TabKey = 'convert' | 'remove' | 'merge';

const tabs: Array<{ key: TabKey; label: string; description: string }> = [
  { key: 'convert', label: 'Convert', description: 'Batch image conversion' },
  { key: 'remove', label: 'Remove background', description: 'Cut out the subject' },
  { key: 'merge', label: 'Merge PDF', description: 'Combine PDF files' }
];

export function ConverterWorkspace() {
  const [activeTab, setActiveTab] = useState<TabKey>('convert');

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-glow backdrop-blur-xl sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(125,211,252,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(196,181,253,0.12),_transparent_26%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.35em] text-sky-200/80">Image tools</p>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Switch between image conversion, background removal, and PDF merging in one interface.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Use the converter for multi-file output ZIPs, switch to background removal for a transparent PNG cutout, or merge PDFs into one file.
              </p>
            </div>
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <span>Tabs</span>
                <span className="text-sky-200">2 tools</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <span>Conversion output</span>
                <span className="text-sky-200">ZIP bundle</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <span>Background output</span>
                <span className="text-sky-200">Transparent PNG</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <span>PDF output</span>
                <span className="text-sky-200">Single merged PDF</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-3 shadow-glow backdrop-blur-xl sm:p-4">
          <div className="flex flex-wrap gap-3 p-2">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 rounded-2xl border px-4 py-4 text-left transition ${
                    active
                      ? 'border-sky-300/40 bg-sky-400/15 text-white shadow-[0_0_0_1px_rgba(125,211,252,0.2)]'
                      : 'border-white/10 bg-slate-950/30 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="text-sm font-semibold">{tab.label}</div>
                  <div className="mt-1 text-xs text-slate-400">{tab.description}</div>
                </button>
              );
            })}
          </div>

          <div className="p-2 sm:p-3">
            {activeTab === 'convert' ? <ImageConverter /> : activeTab === 'remove' ? <BackgroundRemover /> : <PdfMerger />}
          </div>
        </section>
      </div>
    </main>
  );
}