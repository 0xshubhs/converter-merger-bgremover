## Project Notes

- Next.js (App Router) file-tool suite: image conversion, image-to-PDF, ZIP compression, background removal,
  PDF merging, and PDF signing.
- **Most tools run in the browser, not on the server.** Only Convert uses an API route, because Sharp is required for
  HEIC decoding and AVIF/TIFF encoding. Do not add new server routes for work that `pdf-lib`, `jszip`, or a canvas can
  do client-side — the deployment target caps request bodies at 4.5 MB.
- Keep logic isomorphic and dependency-free where possible (`lib/merge-pdf.ts`, `lib/sign-pdf.ts`, `lib/zip.ts`) so the
  same code is unit tested and shipped. Put pure maths in its own module (`lib/pdf-page-layout.ts`,
  `lib/remove-background-pixels.ts`) rather than burying it in a canvas or Sharp call.
- `lib/browser/` holds canvas adapters; `lib/client/` holds shared React hooks (`useFileSelection`, `useToolRun`);
  `components/ui.tsx` holds shared UI. Reuse these instead of re-implementing drag-and-drop or busy/error state.
- Import heavy libraries with dynamic `import()` inside the function that needs them, so they stay out of first-load JS.
- Validate uploads with `collectFiles` from `lib/http.ts`; build responses with `binaryResponse` so filenames are
  sanitised. Never interpolate a user-supplied filename into a header directly.
- Tests live in `tests/` and run with `bun run test`. Run `bun run check` (typecheck + lint + tests) before pushing.
