export const MAX_FILES = 60;
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 250 * 1024 * 1024;

/** Bound on the longest edge of an image before it is re-encoded, to cap peak memory. */
export const MAX_IMAGE_DIMENSION = 12000;

/** Longest edge kept when rasterising an image into a PDF page. */
export const MAX_PDF_IMAGE_DIMENSION = 4000;
