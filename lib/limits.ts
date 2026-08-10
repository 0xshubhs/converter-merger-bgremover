/**
 * Vercel Functions reject any request body over 4.5 MB at the infrastructure
 * level, before the handler runs — it cannot be raised in vercel.json. Only the
 * Convert tool still uploads, so it checks against this before sending.
 * Raise it if you self-host somewhere without the cap.
 */
export const MAX_SERVER_REQUEST_BYTES = Math.floor(4.5 * 1024 * 1024);

export const MAX_FILES = 60;
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 250 * 1024 * 1024;

/** Bound on the longest edge of an image before it is re-encoded, to cap peak memory. */
export const MAX_IMAGE_DIMENSION = 12000;

/** Longest edge kept when rasterising an image into a PDF page. */
export const MAX_PDF_IMAGE_DIMENSION = 4000;
