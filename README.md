# Converter

A set of file tools built with Next.js. Five of the six run **entirely in your browser** — the files are never uploaded,
so there is no size limit and nothing to trust.

## Tools

| Tool | Runs | Input | Output |
| --- | --- | --- | --- |
| Convert | Server | Images (incl. HEIC/HEIF) | JPEG, PNG, WebP, AVIF, TIFF, GIF |
| Image to PDF | Browser | Images | A single PDF, one page per image |
| Compress | Browser | Any files | A lossless ZIP archive |
| Remove background | Browser | One image | A transparent PNG |
| Merge PDF | Browser | Two or more PDFs | One combined PDF |
| Sign PDF | Browser | One PDF + a drawn, typed, or uploaded signature | The same PDF with the signature drawn in |

Only **Convert** uses the server, because Sharp is needed for HEIC decoding and AVIF/TIFF encoding — a canvas cannot do
those. Everything else uses `pdf-lib`, `jszip`, and the Canvas API, which all run client-side.

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

- `lib/` holds isomorphic logic. `merge-pdf.ts`, `sign-pdf.ts`, and `zip.ts` run unchanged in Node and the browser,
  which is why their unit tests cover the code that actually ships to users.
- `lib/pdf-page-layout.ts` and `lib/remove-background-pixels.ts` are pure functions, so the geometry and pixel maths stay
  testable even though the decoding around them happens on a canvas.
- `lib/browser/` holds the canvas adapters and the entry points the tools call.
- `app/api/convert` is the only route handler left. It validates the upload and delegates to `lib/convert-image.ts`.
- `pdf-lib`, `jszip`, and `pdf.js` are all loaded with dynamic `import()`, so first-load JS stays around 116 kB instead
  of 325 kB.

## Limits

The browser tools have **no size limit** — nothing is uploaded.

Convert uploads, so it is bound by whatever your host allows. `MAX_SERVER_REQUEST_BYTES` in `lib/limits.ts` defaults to
**4.5 MB**, which is the hard, non-configurable request body cap on Vercel Functions. The client checks against it before
sending so you get a clear message instead of a platform error page. Raise it if you self-host somewhere without the cap.

Server-side limits (`MAX_FILES`, `MAX_FILE_SIZE`, `MAX_TOTAL_SIZE`) still apply as a backstop, and images longer than
12000 px on their longest edge are scaled down to bound memory.

## Notes

- HEIC/HEIF works in Convert via `heic-convert`. The browser tools can only open HEIC on Safari, which decodes it
  natively; elsewhere they tell you to run the file through Convert first.
- Background removal samples the border of the image to guess the backdrop colour, so it works best on photos with a
  plain or lightly textured background.
- Sign PDF applies an **electronic** signature — an image drawn into the page content. It is not a cryptographic
  digital signature and carries no certificate-based identity guarantee.
