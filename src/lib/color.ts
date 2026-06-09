/** Tiny color helpers for tinting lane colors. No deps. */

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** rgba string for a translucent tint of a hex color. */
export function tint(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pick black/white text for best contrast on a solid hex background. */
export function readableText(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  // Relative luminance (sRGB approximation).
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0f172a" : "#ffffff";
}
