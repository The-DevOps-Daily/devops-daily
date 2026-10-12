# git blame — production and site integration roadmap

Updated 9 October 2026. The user approved adding Phase 6 to separate chapter production from the polished DevOps Daily site launch. The user subsequently authorized Phase 6 site edits and generation of the remaining revised scenes. Deployment remains a separate approval.

| Phase                   | Deliverable                                                                                                                                                                                                                                                        | Approval checkpoint                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 1. Discovery            | Repository assessment, visual reference review, creative bible and architecture proposal                                                                                                                                                                           | Cleared                                                                   |
| 2. Character design     | Reference sheets, prompts, continuity rules                                                                                                                                                                                                                        | Cleared; Sophia v2 applies requested blue eyes                            |
| 3. Chapter 1 storyboard | Seven scenes, dialogue, compositions, technical notes and prompts; supervised Codex/Claude Code use appears naturally in Scene 5                                                                                                                                   | Cleared                                                                   |
| 4. Artwork proof        | One complete text-free Scene 1, editable HTML bubbles, uncropped responsive image, desktop/mobile/large-text checks                                                                                                                                                | Cleared                                                                   |
| 5. Chapter production   | Remaining six illustrations, final dialogue positions, model-illustrated Scene 4 whiteboard with editable labels, accessible scene descriptions, Under the Hood and verified related links; assemble and validate the complete chapter using the reader components | Revised artwork and reader ready for review                               |
| 6. Site integration     | New Comics section and publication-quality browsing/reading experience inside the existing Next.js app                                                                                                                                                             | Stop for site review; production deployment still needs explicit approval |

## Current review

The user requested stronger visual storytelling, then explicitly approved site integration and all remaining revised illustrations on 9 October 2026. The approved opening is retained; Scenes 2–7 now use revised staging. The whiteboard sketch is generated in the artwork, with editable HTML labels and an accessible request trace. Earlier masters and generation records are retained.

The library, series, chapter, proof and paginated print routes exist in this PR branch. Preview metadata is deliberately noindex, and previews stay out of sitemap, search and feeds until publication. See [site review](site-review/README.md) for routes, screenshots, PDF and checks. This is a review edition, not a production deployment.

### Latest reader and artwork feedback

The user found the revised artwork still too generic and requested more technical moments, plus a better chapter hero and bottom navigation. The reader now uses a book-style opening and paper-colored completion navigation in both site themes. See the current [UI review](site-review/README.md).

The next artwork revision is a [fourteen-panel storyboard proposal](chapter-01/panel-expansion-proposal.md), including customer impact, an illustrated Kubernetes cutaway, correlated request evidence, the shutdown handler, an overlap test and a watched handoff. It has not been generated or placed in the runtime reader. Review this storyboard under the user's original checkpoint, then produce one technical proof before the remaining inserts. The current seven illustrations remain review assets rather than approved final art.

## Phase 6 scope

- `/comics`: a focused library with the series cover, title, premise and clear entry point. One series needs no elaborate filters or empty categories.
- `/comics/git-blame`: Volume 1 overview, published chapter contents, restrained cast introduction and prominent start/continue links. Upcoming chapters are clearly labelled, with no dead links.
- `/comics/git-blame/chapter-01` and future chapter routes: comfortably spaced vertical art, editable bubbles and phone/large-text fallback, previous/next navigation, contents link, optional Under the Hood and related tutorials after the punchline.
- Add Comics to the actual desktop/mobile navigation configuration and consider one restrained homepage discovery card. Keep chapter reading free from competing promotions or unnecessary animation. Use existing UI primitives and semantic brand tokens around the warm paper artwork.
- Generate complete titles/descriptions, self-canonical URLs, social metadata and static 1200 × 630 OG images with approved artwork plus authored title lettering. Build these with the repository's existing Sharp/Resvg tooling, not a runtime image endpoint incompatible with static export. Check real sharing crops and long titles.
- Include published series/chapters in the existing sitemap with real publication/update dates. Keep drafts and the Phase 4 proof unlinked and `noindex`; `noindex` is not access control. Do not add unpublished chapters to search, feeds or discovery. Decide deliberately whether published chapters should appear in the existing search index.
- Validate semantic headings, one main landmark, logical dialogue order, descriptive alt text, keyboard navigation, visible focus, contrast, zoom, narrow phones, landscape reading and both site themes. Reserve image dimensions, serve measured responsive variants and lazy-load later scenes. Keep the opening illustration prioritized. No new database, CMS, comic editor or reader dependency is required.
- Sponsorship uses the existing registry where applicable, clear support credit, historically accurate chapter attribution and a contextual post-story link. The Neon migration rehearsal remains hypothetical; it does not claim direct branching of RDS or a confirmed campaign.

- Add downloadable chapter PDFs and, later, a collected volume through an explicit post-export build step. Reuse chapter content and authored dialogue in a paginated print layout. See the [PDF export plan](pdf-export-plan.md) for browser provisioning, deploy-artifact ordering and review checks. The explicit `pnpm build:comics` command and chapter download are implemented; ordinary builds verify the committed PDF rather than requiring a browser.

## Acceptance and limits

Run existing relevant tests, reader browser checks and a static production build. Verify exported routes/assets/metadata, crawlable approved content, sitemap entries, internal navigation and social previews. Measure representative chapter image transfer and layout stability before setting realistic budgets from actual artwork; do not invent performance scores.

The Phase 4 text-resize check exposed a pre-existing desktop navigation overflow when the entire page's root font size doubles at a 1280px viewport. The comic itself returns dialogue to normal flow and fits its container. Phase 6 now uses a font-relative navigation container to switch to the mobile menu before links overflow, including at doubled root text. Browser checks cover 320px and 1280px layouts. Do not hide page overflow to conceal this problem.

Phase 6 does not implement all of Volume 1, imply a sponsor agreement or authorize production deployment. The draft PR stays open as approved phases progress. Deployment is a separate explicit approval after a concrete, tested result is reviewable.
