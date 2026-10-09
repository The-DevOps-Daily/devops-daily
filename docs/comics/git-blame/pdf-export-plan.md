# Downloadable comic PDF — Phase 6 plan

9 October 2026 · Proposed build artifact; **not implemented or generated yet.**

Offer a chapter PDF first, then a collected Volume 1 edition when its chapters exist. The PDF includes the approved art **and** authored dialogue, diagram and technical notes: the source illustrations are intentionally text-free. Use the same chapter JSON and reader primitives as the website, with a dedicated paginated print layout, rather than a screenshot of the entire scrolling page.

## Build and delivery

- Add an explicit `pnpm comics:pdf` command using the already-installed Playwright package and its Chromium PDF capability. No PDF library or runtime API is needed. This command is planned, not currently available.
- Run after `pnpm build:fast` or the regular static export. Serve the export locally within the script, load a print-only noindex route, wait for image decoding, fonts and bubble geometry, then generate the file into `out/comics/git-blame/downloads/chapter-01.pdf`. This order ensures the file is included in the deploy artifact. Stop the temporary server/browser in cleanup, including error paths.
- Provision pinned Chromium for the PDF CI/release job using Playwright’s existing installation workflow. The current build job does not install a browser; do not silently make every ordinary site build depend on an unprovisioned system executable. An explicit combined release command/job should run site export then PDF generation, fail if an expected approved download is missing, and deliver that augmented `out/` directory.
- Add a clear “Download chapter PDF” link once the approved artifact is packaged; never show a download that returns 404. Draft exports can be attached as CI artifacts for review before publication. Do not publish the current unapproved artwork as a final ebook.
- For a future volume, compose approved chapters in their order and include a cover, contents and consistent credits. Do not insert placeholder pages for unpublished chapters.

## Print layout and checks

Use portrait pages, one scene per page with deliberate space for dialogue, and separate pages for Under the Hood/credits. Landscape illustrations retain their full composition within a portrait page. Design print-specific type sizes and bubble positions: the screen’s responsive breakpoint is not a print layout. Resolve page breaks and long dialogue before exporting; do not shrink every element to fit an arbitrary screenshot.

Keep dialogue as selectable text and diagrams as vectors. Include title/publisher, page numbers, clickable tutorial links and any actual sponsor disclosure. Use suitable image resolution and measure actual resulting size before setting a download budget. Enable Playwright’s supported tagged-PDF option, then inspect the PDF’s actual text/reading order; a tagging flag is not a claim of PDF/UA compliance. The accessible HTML reader remains available alongside the download.

Validate page count/order, full illustration bounds, bubble/text clipping, font embedding, text extraction, links and absence of site navigation/cookie UI. Review representative desktop/mobile PDF viewers and a downloaded offline copy. Include a reproducibility/content check so artwork or dialogue changes cannot leave an outdated PDF packaged as the current chapter. Build PDF assets from local exported resources, with no generation-model call or external service during publishing.
