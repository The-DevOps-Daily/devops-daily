export function isDynamicRedirect(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return false;
  const source = trimmed.split(/\s+/)[0];
  return source.includes('*') || source.includes('/:');
}

// Cloudflare applies a static redirect only when it comes before the first
// dynamic one (a splat or a placeholder), so new static lines go above it.
export function insertStaticRedirects(current: string, block: string[]): string {
  const lines = current.replace(/\n+$/, '').split('\n');
  let at = lines.findIndex(isDynamicRedirect);
  if (at === -1) return `${[...lines, ...block].join('\n')}\n`;
  // Keep the comment lines that introduce the dynamic block with it.
  while (at > 0 && lines[at - 1].trim().startsWith('#')) at -= 1;
  while (at > 0 && lines[at - 1].trim() === '') at -= 1;
  return `${[...lines.slice(0, at), ...block, ...lines.slice(at)].join('\n')}\n`;
}
