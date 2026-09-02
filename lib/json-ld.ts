/**
 * Serialize structured data for an inline <script type="application/ld+json">.
 *
 * JSON.stringify leaves `<`, `>` and `&` alone, so a title or excerpt
 * containing `</script>` would end the block and run markup. Escaping them
 * as \u sequences keeps the payload valid JSON and inert in HTML.
 */
export function toJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
