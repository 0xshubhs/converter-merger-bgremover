## Project Notes

- Next.js (App Router) file-tool suite: image conversion, image-to-PDF, ZIP compression, background removal,
  PDF merging, and PDF signing.
- All processing happens server-side in `app/api/*` route handlers (Node runtime), which stay thin and delegate to
  `lib/`. Put logic in `lib/` so it can be unit tested.
- Sharp handles images; pdf-lib handles PDFs; pdf.js renders page previews in the browser only.
- Shared client behaviour lives in `lib/client/` (`useFileSelection`, `useToolRun`, `postForm`) and shared UI in
  `components/ui.tsx`. Reuse these instead of re-implementing drag-and-drop or busy/error state per tool.
- Validate uploads with `collectFiles` from `lib/http.ts`; build responses with `binaryResponse` so filenames are
  sanitised. Never interpolate a user-supplied filename into a header directly.
- Tests live in `tests/` and run with `bun run test`. Run `bun run check` (typecheck + lint + tests) before pushing.
