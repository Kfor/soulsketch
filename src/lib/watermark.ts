/**
 * Apply a watermark overlay to an image URL.
 * For free tier users, images get a watermark.
 * In production, this would be done server-side with canvas/sharp.
 * For MVP, we use CSS overlay on the client side.
 */
export function getWatermarkedUrl(originalUrl: string): string {
  // In MVP, watermark is applied via CSS overlay in the component
  // The URL remains unchanged; the component adds the overlay
  return originalUrl;
}

export const WATERMARK_TEXT = "SoulSketch";
export const WATERMARK_OPACITY = 0.3;
