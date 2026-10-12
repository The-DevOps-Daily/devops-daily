# Downloadable comic PDF

9 October 2026 · Implemented preview artifact, ready for review.

The chapter PDF uses the same source images, structured dialogue and scene components as the website. It contains a cover, seven full, uncropped scenes and Under the Hood with credits: nine A4 pages. Dialogue and diagram labels remain selectable text. The drawn diagram is part of the illustration. This is a preview edition; publication remains pending review.

## Build and delivery

`pnpm build:comics` generates static OG assets, exports the Next.js site, renders the print route with Playwright Chromium, and verifies the resulting download. `pnpm comics:pdf` renders an already-current export; `pnpm comics:check` fails if the committed PDF or its input fingerprint is stale. Run the combined command after artwork, dialogue, print styles or other fingerprinted inputs change.

The exporter serves local `out/` resources temporarily, waits for fonts, image decoding and hydrated bubble geometry, blocks external requests, checks clipping, and cleans up its browser/server. It writes the PDF to both `public/comics/git-blame/downloads/chapter-01.pdf` and `out/comics/git-blame/downloads/chapter-01.pdf`. Native JPEG artwork avoids Chromium expanding WebP images into excessively large PDF bitmaps. No generation-model call occurs in the build.

Ordinary `build`, `build:fast` and `build:cf` validate and copy the prebuilt PDF, so they do not require Chromium. The explicit PDF job provisions the version of Chromium pinned by the existing Playwright dependency. Local generation can use `COMICS_CHROMIUM_PATH=/usr/bin/chromium`. The path-filtered, read-only Comic PDF workflow uploads the preview download as a CI artifact; it does not deploy.

The input manifest in [site-review/pdf-manifest.json](site-review/pdf-manifest.json) records actual source hashes, size and PDF checksum. The print export is fingerprint-stamped to reject old exported HTML. A final source fingerprint check also rejects inputs changed during generation.

## Reading and validation

The noindex `/comics/git-blame/print` route supplies one scene per page, readable authored text, folios, title/publisher and clickable tutorial links. The reader and series pages offer the actual download. Landscape scenes retain their aspect ratio within portrait pages. Site navigation and cookie UI are excluded from print.

Use `pdfinfo`, actual text extraction and representative page renders to check page count/order, font embedding, clipping, bounds, links and readability. Tagged output is enabled; this is not a claim of PDF/UA conformance or a complete assistive-technology audit. The accessible HTML reader remains alongside the PDF.

A collected volume is future work once its chapters exist. It will need a contents page and approved chapter ordering; no placeholder pages or unconfirmed sponsor credits belong in the current edition.
