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

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const ch = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

function contrast(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * A brand color adjusted to reach WCAG AA text contrast (4.5:1 by default) on
 * the given background, keeping its hue: it is mixed toward white on a dark
 * background and toward black on a light one, only as far as needed.
 */
export function readableOn(hex: string, background: string, minRatio = 4.5): string {
  const color = hexToRgb(hex)
  const bg = hexToRgb(background)
  if (!color || !bg) return hex
  const target = luminance(bg) < 0.5 ? 255 : 0
  for (let t = 0; t <= 1; t += 0.05) {
    const mixed = {
      r: Math.round(color.r + (target - color.r) * t),
      g: Math.round(color.g + (target - color.g) * t),
      b: Math.round(color.b + (target - color.b) * t),
    }
    if (contrast(mixed, bg) >= minRatio) {
      return `#${[mixed.r, mixed.g, mixed.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    }
  }
  return target === 255 ? '#ffffff' : '#000000'
}
