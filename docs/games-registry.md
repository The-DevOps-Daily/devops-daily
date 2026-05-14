# Games and Simulator Registry

`lib/games.ts` is the source of truth for game metadata. Active games should also have:

- `app/games/{slug}/page.tsx`
- an entry in `components/games/game-component-registry.ts` for embeds
- a social image at `public/images/games/{slug}-og.png` or `public/images/games/{slug}.png`

Run this before opening a PR that adds or changes a game:

```bash
pnpm validate:games
```

The validator catches duplicate slugs, missing page routes, missing embed wiring, missing or incorrectly sized social images, and active games without `createdAt`.

## Simulator UI

Shared simulator controls and display primitives live in `components/games/simulator-primitives.tsx`.
Use them for new simulators before creating one-off metric cards, sliders, topology nodes, flow lines, mode buttons, or status readouts.

## OG Images

Shared OG image helpers live in `scripts/og-utils.ts`.
Use `buildSiteOgSvg` for new generators so images stay aligned with the site’s neutral surface and amber primary color scheme. Keep diagrams clean and content-led; avoid random decorative shapes or unrelated color palettes.
