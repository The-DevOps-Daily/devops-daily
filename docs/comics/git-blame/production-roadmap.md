# git blame — production and site integration roadmap

Updated 9 October 2026. The user approved adding Phase 6 to separate chapter production from the polished DevOps Daily site launch. This extends the original five-phase plan; it does not authorize starting later phases early.

| Phase                   | Deliverable                                                                                                                                                                                                                       | Approval checkpoint                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Discovery            | Repository assessment, visual reference review, creative bible and architecture proposal                                                                                                                                          | Cleared                                                                   |
| 2. Character design     | Reference sheets, prompts, continuity rules                                                                                                                                                                                       | Cleared; Sophia v2 applies requested blue eyes                            |
| 3. Chapter 1 storyboard | Seven scenes, dialogue, compositions, technical notes and prompts; supervised Codex/Claude Code use appears naturally in Scene 5                                                                                                  | Cleared                                                                   |
| 4. Artwork proof        | One complete text-free Scene 1, editable HTML bubbles, uncropped responsive image, desktop/mobile/large-text checks                                                                                                               | Cleared                                                                   |
| 5. Chapter production   | Remaining six illustrations, final dialogue positions, authored Scene 4 diagram, accessible scene descriptions, Under the Hood and verified related links; assemble and validate the complete chapter using the reader components | Draft assembled; visual pacing revision requested                         |
| 6. Site integration     | New Comics section and publication-quality browsing/reading experience inside the existing Next.js app                                                                                                                            | Stop for site review; production deployment still needs explicit approval |

## Current review

The user requested stronger visual storytelling on 9 October 2026. The existing chapter remains a draft; review the [revised composition plan](chapter-01/visual-pacing-revision.md) before generating replacements. Phase 6 is pending complete-chapter approval.

## Phase 6 scope

- `/comics`: a focused library with the series cover, title, premise and clear entry point. One series needs no elaborate filters or empty categories.
- `/comics/git-blame`: Volume 1 overview, published chapter contents, restrained cast introduction and prominent start/continue links. Upcoming chapters are clearly labelled, with no dead links.
- `/comics/git-blame/chapter-01` and future chapter routes: comfortably spaced vertical art, editable bubbles and phone/large-text fallback, previous/next navigation, contents link, optional Under the Hood and related tutorials after the punchline.
- Add Comics to the actual desktop/mobile navigation configuration and consider one restrained homepage discovery card. Keep chapter reading free from competing promotions or unnecessary animation. Use existing UI primitives and semantic brand tokens around the warm paper artwork.
- Generate complete titles/descriptions, self-canonical URLs, social metadata and static 1200 × 630 OG images with approved artwork plus authored title lettering. Build these with the repository's existing Sharp/Resvg tooling, not a runtime image endpoint incompatible with static export. Check real sharing crops and long titles.
- Include published series/chapters in the existing sitemap with real publication/update dates. Keep drafts and the Phase 4 proof unlinked and `noindex`; `noindex` is not access control. Do not add unpublished chapters to search, feeds or discovery. Decide deliberately whether published chapters should appear in the existing search index.
- Validate semantic headings, one main landmark, logical dialogue order, descriptive alt text, keyboard navigation, visible focus, contrast, zoom, narrow phones, landscape reading and both site themes. Reserve image dimensions, serve measured responsive variants and lazy-load later scenes. Keep the opening illustration prioritized. No new database, CMS, comic editor or reader dependency is required.
- Sponsorship uses the existing registry where applicable, clear support credit, historically accurate chapter attribution and a contextual post-story link. The Neon migration rehearsal remains hypothetical; it does not claim direct branching of RDS or a confirmed campaign.

- Add downloadable chapter PDFs and, later, a collected volume through an explicit post-export build step. Reuse chapter content and authored dialogue in a paginated print layout. See the [PDF export plan](pdf-export-plan.md) for browser provisioning, deploy-artifact ordering and review checks. No PDF command or download exists yet.

## Acceptance and limits

Run existing relevant tests, reader browser checks and a static production build. Verify exported routes/assets/metadata, crawlable approved content, sitemap entries, internal navigation and social previews. Measure representative chapter image transfer and layout stability before setting realistic budgets from actual artwork; do not invent performance scores.

The Phase 4 text-resize check exposed a pre-existing desktop navigation overflow when the entire page's root font size doubles at a 1280px viewport. The comic itself returns dialogue to normal flow and fits its container. Phase 6 must resolve or otherwise demonstrate an accessible global navigation layout at enlarged text before publication. Do not hide page overflow to conceal this problem.

Phase 6 does not implement all of Volume 1, imply a sponsor agreement or authorize production deployment. The draft PR stays open as approved phases progress. Deployment is a separate explicit approval after a concrete, tested result is reviewable.
