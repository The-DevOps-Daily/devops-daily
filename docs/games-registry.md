# Games and Simulator Registry

`lib/games.ts` is the source of truth for game metadata. Active games should also have:

- `app/games/{slug}/page.tsx`
- an entry in `components/games/game-component-registry.ts` for embeds
- a cover at `public/images/games/{slug}-og.jpg`, made with `npx tsx scripts/generate-content-og.ts --only=game/{slug}` (see Cover images below)

Run this before opening a PR that adds or changes a game:

```bash
pnpm validate:games
```

The validator catches duplicate slugs, missing page routes, missing embed wiring, missing or incorrectly sized social images, and active games without `createdAt`.

## Simulator UI

Shared simulator controls and display primitives live in `components/games/simulator-primitives.tsx`.
Use them for new simulators before creating one-off metric cards, sliders, topology nodes, flow lines, mode buttons, or status readouts.

## Cover images

Game and simulator covers come only from `scripts/generate-content-og.ts`, like every other content type:

```bash
npx tsx scripts/generate-content-og.ts --only=game/{slug}
```

It reads the title and category from `lib/games.ts` and writes `public/images/games/{slug}-og.jpg`. Add `--force` to replace it. Do not hand-make a cover, write a one-off generator, or add a PNG: the old dark template is gone. `pnpm validate:games` fails without the JPG, and `tests/content-covers.test.ts` fails on any PNG cover.
