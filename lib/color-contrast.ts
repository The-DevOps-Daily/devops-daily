/**
 * Ensures a hex color has sufficient contrast on a dark background.
 * Returns a lightened version for colors that are too dark.
 */
export function ensureContrastOnDark(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#94a3b8' // fallback slate

  // Calculate relative luminance
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b

  // Too dark for dark backgrounds - lighten it
  if (luminance < 100) {
    // Shift toward a lighter version of the same hue
    const factor = 2.2
    const r = Math.min(255, Math.round(rgb.r * factor + 60))
    const g = Math.min(255, Math.round(rgb.g * factor + 60))
    const b = Math.min(255, Math.round(rgb.b * factor + 60))
    return `rgb(${r}, ${g}, ${b})`
  }

  return hex
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}
