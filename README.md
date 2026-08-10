# Converter

A set of local file tools built with Next.js. Every operation runs on your own server — nothing is sent to a third-party
service.

## Tools

| Tool | Input | Output |
| --- | --- | --- |
| Convert | Images (incl. HEIC/HEIF) | JPEG, PNG, WebP, AVIF, TIFF, or GIF — one file, or a ZIP for a batch |
| Image to PDF | Images | A single PDF, one page per image |
| Compress | Any files | A lossless ZIP archive |
| Remove background | One image | A transparent PNG |
| Merge PDF | Two or more PDFs | One combined PDF |
| Sign PDF | One PDF + a drawn, typed, or uploaded signature | The same PDF with the signature drawn in |

## Run locally

```bash
bun install
bun run dev
```

Then open <http://localhost:3000>.

## Checks

```bash
bun run test    # vitest, unit tests for lib/
bun run lint    # eslint
bun run check   # typecheck + lint + tests, same as CI
```

## How it works

- `app/api/*` are Node runtime route handlers; each one validates the upload, then delegates to a module in `lib/`.
- Image work goes through [Sharp](https://sharp.pixelplumbing.com/); PDFs are assembled with
  [pdf-lib](https://pdf-lib.js.org/).
- Batch conversions run several images at a time (`lib/concurrency.ts`) rather than one after another.
- Converted images are stored in the ZIP uncompressed, since re-DEFLATing an already-compressed image only costs CPU.

## Limits

Upload limits live in `lib/limits.ts`: 60 files, 50 MB per file, and 250 MB per request by default. Requests that exceed
them are rejected with a `413` before anything is decoded. Images longer than 12000 px on their longest edge are scaled
down to bound memory use (4000 px when placed into a PDF).

## Notes

- HEIC/HEIF inputs are decoded with `heic-convert` when libvips was built without HEIF support.
- Background removal samples the border of the image to guess the backdrop colour, so it works best on photos with a
  plain or lightly textured background.
- Sign PDF applies an **electronic** signature — an image drawn into the page content. It is not a cryptographic
  digital signature and carries no certificate-based identity guarantee.
