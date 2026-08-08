# Converter

A universal batch image converter built with Next.js.

## What it does

- Upload multiple images at once
- Convert to JPEG, JPG, PNG, WebP, AVIF, or TIFF
- Bundle converted files into a single ZIP download
- Handle common source formats including HEIC when the runtime supports it through Sharp

## Run locally

1. Install dependencies
2. Start the development server with `npm run dev`
3. Open the local app and upload files

## Notes

- HEIC input support depends on the underlying Sharp/libvips build in your environment.
- Drag-and-drop upload can be added next if you want it.