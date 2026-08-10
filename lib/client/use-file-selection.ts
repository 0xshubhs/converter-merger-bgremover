'use client';

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SelectedFile = {
  id: string;
  file: File;
  previewUrl: string | null;
};

type Options = {
  /** Keeps the most recent file only when false. */
  multiple?: boolean;
  /** Object URLs are only worth creating for tools that render a thumbnail. */
  withPreview?: boolean;
  accept?: (file: File) => boolean;
  rejectMessage?: string;
};

let idCounter = 0;

/** crypto.randomUUID is unavailable on insecure origins, so ids are generated locally. */
function createId(file: File) {
  idCounter += 1;

  return `${file.name}-${file.size}-${file.lastModified}-${idCounter}`;
}

export function useFileSelection(options: Options = {}) {
  const { multiple = true, withPreview = false, accept, rejectMessage } = options;

  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragDepth = useRef(0);
  const filesRef = useRef<SelectedFile[]>([]);

  // Mirrors state so the unmount cleanup can revoke whatever is still open.
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const wrap = useCallback(
    (file: File): SelectedFile => ({
      id: createId(file),
      file,
      previewUrl: withPreview ? URL.createObjectURL(file) : null
    }),
    [withPreview]
  );

  const append = useCallback(
    (incoming: File[]) => {
      if (!incoming.length) return;

      const allowed = accept ? incoming.filter(accept) : incoming;

      if (!allowed.length) {
        setError(rejectMessage ?? 'None of those files are supported.');
        return;
      }

      const wrapped = (multiple ? allowed : allowed.slice(0, 1)).map(wrap);

      setFiles((current) => {
        if (!multiple) {
          current.forEach((item) => {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          });

          return wrapped;
        }

        return [...current, ...wrapped];
      });

      setError(allowed.length === incoming.length ? null : (rejectMessage ?? 'Some files were skipped.'));
    },
    [accept, multiple, rejectMessage, wrap]
  );

  const addFromInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      append(Array.from(event.target.files ?? []));
      event.target.value = '';
    },
    [append]
  );

  const remove = useCallback((id: string) => {
    setFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);

      return current.filter((item) => item.id !== id);
    });
  }, []);

  const move = useCallback((index: number, direction: -1 | 1) => {
    setFiles((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;

      const updated = [...current];
      const [item] = updated.splice(index, 1);
      updated.splice(nextIndex, 0, item);

      return updated;
    });
  }, []);

  const clear = useCallback(() => {
    setFiles((current) => {
      current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });

      return [];
    });
    setError(null);
  }, []);

  const dropzoneProps = useMemo(
    () => ({
      onDragEnter(event: DragEvent<HTMLElement>) {
        event.preventDefault();
        dragDepth.current += 1;
        setIsDragging(true);
      },
      onDragOver(event: DragEvent<HTMLElement>) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDragLeave(event: DragEvent<HTMLElement>) {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);

        if (dragDepth.current === 0) setIsDragging(false);
      },
      onDrop(event: DragEvent<HTMLElement>) {
        event.preventDefault();
        dragDepth.current = 0;
        setIsDragging(false);
        append(Array.from(event.dataTransfer.files ?? []));
      }
    }),
    [append]
  );

  const totalSize = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);

  return {
    files,
    totalSize,
    isDragging,
    dropzoneProps,
    error,
    setError,
    append,
    addFromInput,
    remove,
    move,
    clear
  };
}
