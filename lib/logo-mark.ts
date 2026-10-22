// The terminal mark (a ">" prompt and a "_" cursor on a rounded square), drawn on
// a 32-unit grid. components/ui/logo.tsx and scripts/generate-logo-icons.ts both
// read it, so the header logo and the favicon files stay identical.
export const LOGO_MARK = {
  viewBox: '0 0 32 32',
  // The square is inset by half a unit so a 1-unit border stays inside the box.
  square: { x: 0.5, y: 0.5, size: 31, radius: 6 },
  chevron: 'M8 10l6 5.75-6 5.75',
  cursor: 'M16.5 21.5H24',
  strokeWidth: 3,
} as const;
