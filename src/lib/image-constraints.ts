/** Safe to import from both client and server modules. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_REQUEST = 10;

// Data URLs are sent in a Server Action body. This leaves headroom under Next's 12 MB limit.
export const MAX_TOTAL_IMAGE_DATA_URL_BYTES = 10 * 1024 * 1024;
export const NEWS_IMAGE_HELP_TEXT = "รองรับ JPG, PNG และ WebP สูงสุด 5 MB ต่อรูป และไม่เกิน 10 รูปต่อข่าว";
