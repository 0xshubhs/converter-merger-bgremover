
type ZipEntry = {
  name: string;
  data: Uint8Array | ArrayBuffer;
};

/**
 * Returns a function that hands out collision-free archive names.
 * Duplicates get a numeric suffix before the extension: photo.jpg, photo-2.jpg.
 */
export function createNameDeduper() {
  const used = new Set<string>();

  return (name: string) => {
    const safe = (name.split(/[\\/]/).pop() || 'file').replace(/^\.+/, '') || 'file';

    if (!used.has(safe)) {
      used.add(safe);
      return safe;
    }

    const dot = safe.lastIndexOf('.');
    const base = dot > 0 ? safe.slice(0, dot) : safe;
    const extension = dot > 0 ? safe.slice(dot) : '';

    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${base}-${suffix}${extension}`;

      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
    }
  };
}

type ZipOptions = {
  /** Skip DEFLATE for payloads that are already compressed (JPEG, PNG, PDF...). */
  store?: boolean;
  level?: number;
};

export async function zipEntries(entries: ZipEntry[], options: ZipOptions = {}) {
  // Loaded on demand so the ~100 kB deflate implementation stays out of first paint.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (const entry of entries) {
    zip.file(entry.name, entry.data, { binary: true });
  }

  return zip.generateAsync({
    type: 'uint8array',
    compression: options.store ? 'STORE' : 'DEFLATE',
    compressionOptions: { level: Math.max(1, Math.min(9, options.level ?? 6)) }
  });
}
