# git blame — creative bible and implementation proposal

Phase 1 direction and core cast approved; supporting designs pending · 8 October 2026 · Published by DevOps Daily

**Production is down. Everyone has a theory.**

## Status and evidence

The user approved the run on 8 October 2026 and supplied eight visual-reference photographs. The original four character sheets were approved on 9 October 2026. Two requested supporting-character sheets now require review before Phase 3. No website implementation is authorized at this checkpoint.

Repository inspected: `The-DevOps-Daily/devops-daily`, local HEAD `5534807445dec7e5e2f31e057700b71813bb3fc5`. Reviewed repository agent instructions, package and lockfile presence, routing, layout, styles, content loaders, metadata and image helpers, sitemap, image-generation scripts, testing configuration and CI.

**Reference photographs inspected:** `IMG_6551.HEIC` through `IMG_6558.HEIC` (eight files). The cover reads *Velká knížka ZOO PRAHA pro malé vypravěče*. See [reference review](reference-review.md) for observations and the translation into an original office-comic aesthetic. Uploaded photographs remain outside the repository; no book spreads will be published as comic assets.

## Creative promise

A warm illustrated workplace comedy about capable people maintaining a system that remembers every compromise. Readers should care about the people before they care about the deployment. The team wins through observation, collaboration and tradeoffs; nobody is the permanent fool or all-knowing rescuer.

Keep the lower-case title **git blame** and Volume 1 title **Everything Is Fine**. The title is an ironic invitation to investigate history, not to blame coworkers. Incidents expose system conditions and decisions. Humor comes from the gap between a reasonable local assumption and the complicated world around it.

Each chapter offers a complete short story in roughly six scenes, with room for five or seven. Aim for a few minutes of reading, one or two operational insights, and an ending that rewards the setup. Dialogue should usually fit in one or two short bubbles per scene. A character need not narrate every action. Let a mug, an exchanged glance or an empty chair finish a joke.

No jokes targeting users, junior engineers, gender, ethnicity, accents or exhaustion. Avoid presenting late-night heroics as the price of being a good engineer. Chris can protect the team; Sam can see what others miss; Alex can revise an old assumption; Maya can choose simplicity.

## Visual direction — informed by reference review

European illustrated storybook sensibility adapted to adult workplace observation: crisp, fine, irregular dark contours; controlled translucent color washes with slightly mottled fills, occasional opaque highlights and restrained paper grain. The photographs show more definite edges and livelier colors than a diffuse sepia watercolor treatment; preserve those qualities. The exact original medium cannot be established from photographs. Natural adult proportions; readable silhouettes; modest expressive exaggeration in brows, posture and hands. Texture should survive at mobile size without obscuring faces.

Warm daylight and desk lamps, believable materials, slightly worn furniture. Deep space and occasional elevated wide views give the office a geography. Focus contrast around faces and meaningful actions. Background objects support the story rather than compete with it. Use one principal background joke per scene, with quieter continuity details only where space allows.

| Color | Role |
| --- | --- |
| `#F6F0DF` warm paper | Page and bubble surfaces within the comic |
| `#273746` dark ink | Contours and readable dialogue |
| `#56856C` muted green | Maya, plants, selected environmental accents |
| `#D7A35F` warm amber | Sam, lamplight, wood and restrained highlights |
| `#B95C50` soft red | Chris, small incident accents |

The actual site's brand uses amber/orange `--primary` (light: `32 95% 44%`, dark: `38 92% 55%`). Keep navigation, links and buttons on existing semantic tokens. Scope the paper palette to the comic canvas and artwork, preserving warm art in dark mode. Do not recolor the whole site. Use the existing Inter font for readable dialogue initially; express hand-drawn character through bubble contours, not a hard-to-read novelty font.

Regular scenes: portrait 4:5. Reserve roughly the upper quarter or another deliberately composed quiet area for dialogue, without placing it over faces or essential hands. Landscape scenes are exceptions; a technical inset should still be readable on a phone. Never crop a scene to fit a responsive frame. No generated lettering, terminal logs, labels or diagram text; add essential text separately as HTML or controlled SVG in a later phase.

Reject glossy rendering, neon, chibi proportions, anime styling, superhero poses, generic corporate vectors and indiscriminate clutter. A restrained office scene is preferable to a beautiful but inconsistent illustration.

## Character bible

The original four sheets are approved and establish their faces, observed skin colors and attire. Preserve those exact visual identities across scenes. Relative heights still require validation in a shared scene.

| Character | Appearance and silhouette | Voice and strengths | Fallibility and growth |
| --- | --- | --- | --- |
| Alex, 38, senior SRE | Dark curly hair, short beard, navy hoodie, casual trousers; relaxed grounded posture; substantial ceramic mug | Calm, pragmatic, dry; remembers incident history and asks what changed | An older successful fix can become an untested assumption; learns to make reliability knowledge shared |
| Maya, 32, platform engineer | Dark bob, round glasses, forest-green overshirt over a neutral top; practical trousers and shoes; upright deliberate posture | Precise questions, loves automation and developer experience; notices operational detail | Can design more machinery than needed; learns to make the safe path simple |
| Sam, 27, software engineer | Messy auburn hair, mustard sweatshirt, jeans and sneakers; open gestures, energetic forward lean | Curious, talented, optimistic; understands customer-facing code and spots useful connections | Confuses code diff size with operational risk; becomes a strong collaborator without losing enthusiasm |
| Chris, 43, engineering manager | Salt-and-pepper hair, rust cardigan, neutral shirt and casual business trousers; usually a mug | Brief, practical, well-intentioned; understands delivery, cost and reliability tensions | Asks contradictory things under pressure; grows better at explicitly choosing tradeoffs |

### Consistency contract

Each Phase 2 sheet must include full-body front, three-quarter and side views; neutral, pleased, skeptical, worried, concentrated and relieved expressions; clothing swatches; accessories and close details. Preserve adult anatomy and distinguish both mug-carrying characters by silhouette, mug shape and posture. Alex's curls/beard, Maya's bob/glasses, Sam's auburn hair and Chris's salt-and-pepper hair must remain readable in silhouette and reduced thumbnails.

Lock face shape, skin tone, height relationships, build, hairline, glasses geometry, clothing cut, footwear and canonical colors when approved. No age, hair, beard or outfit changes without a continuity entry. Lighting may change observed colors, not design identity. Keep a reference version and approval status per character. Use approved image files as references for every relevant generated scene; prompts alone cannot guarantee consistency.

Review sheets together before approval, then compare every scene against the same sheets. Inspect hands, eyelines, anatomy, glasses, mugs and accessories. Regenerate or edit inconsistencies before producing derivatives. Exact expressions and poses can vary; distinctive anatomy cannot.

### Recurring supporting cast

The four approved characters remain the narrative leads. Noor (database engineer, approximately 36) and Eli (FinOps engineer, approximately 40) recur when their expertise matters. Their proposed designs, voices, fallibility and continuity rules are documented in [supporting-cast.md](supporting-cast.md); the two added sheets are pending approval. Noor contributes to the mixed-version migration story, and Eli to the cost-and-ownership story. Neither joins every incident or replaces another engineer's judgment.

## ShipIt and its world

ShipIt is a growing B2B SaaS company providing storefront and order-management tools to small merchants. A failed checkout affects real customers. It has grown from a small team into a moderately complex platform with more services than documented owners. Our four leads represent a larger engineering team; they are not solely responsible for every system.

### Proposed canonical architecture

- AWS, one primary region, Kubernetes on EKS across multiple availability zones. No implied multi-region failover.
- Browser → public AWS Application Load Balancer → `checkout-api` pod IP targets, managed by AWS Load Balancer Controller through Kubernetes Ingress and Service definitions. This uses ALB IP target mode, not an additional ingress proxy hop.
- `web`, `checkout-api`, `catalog-api` and background workers run as Deployments. `checkout-api` is a Node.js HTTP application with bounded request timeouts and explicit shutdown handling.
- RDS PostgreSQL owns orders and configuration. Chapter 1 does not change checkout's transaction model; avoid implying that HTTP retries make writes safe. Later discussions require idempotency keys and transaction boundaries.
- Amazon MSK Kafka carries order events to workers. Event delivery and database writes are not magically atomic; an outbox can become a later design improvement.
- Terraform provisions infrastructure; CI builds immutable container images, runs tests and deploys them. Runtime configuration is separate from the image.
- Prometheus/Grafana-style metrics, centralized structured logs and OpenTelemetry traces exist, but coverage and customer-journey signals are incomplete.
- `receipt-bridge` is the legacy service Maya wants to retire. It handles an undocumented merchant receipt integration; it is not secretly the cause of every incident.

These are fictional choices, not claims about DevOps Daily's own hosting. Record architecture changes by chapter, including date, owner, reason, affected dependency and residual risks. Never insert a new service solely to make a joke work.

### Recurring environments

Office geography: windows and plant shelf on the left; adjacent team desks in the center; whiteboard and small meeting nook to the right; old hardware shelf near the kitchenette behind them. Lock this map before detailed scene generation. Screen closeups and the incident nook provide quieter compositions without relocating doors or desks.

| Detail | Initial state | Use and possible evolution |
| --- | --- | --- |
| Plant `production-db` | A slightly neglected but living plant by the window | Watering becomes a quiet maintenance metaphor; name is overlaid, not generated |
| Availability whiteboard | Aspirational `99.9999%` beside an overdue action list | Later becomes a customer-centered SLO rather than an arbitrary promise |
| Sticky note | `Temporary fix, 2021` on hardware shelf | Moves to a documented retirement ticket; never moves randomly between scenes |
| `receipt-bridge` | Faded service card on architecture board | Dependency discovered in chapter 2; owner and migration work gradually clarified |
| Alex's mugs | One incident mug on desk, others on shelf | Chapter 1 earns a new mug; inscriptions added as controlled text only when legible |
| Old server equipment | Retired switch and neatly stacked cables | One discreet visual gag, not an impossible production server under a desk |

Running jokes should change meaning: Sam's “small change” becomes a question about blast radius; Maya's retirement ticket gains useful evidence; Chris's end-of-day request sometimes gets answered with a sensible smaller scope. Cap repetition so familiarity supports rather than replaces a joke.

## Volume 1: Everything Is Fine

| Chapter | Story and engineering focus | Character / continuity payoff |
| --- | --- | --- |
| 1. The Pod That Wouldn't Die | Friday rollout, healthy replacements, intermittent checkout 502s. Investigate the mismatch between serving traffic and process lifetime; fix and test shutdown/draining together. | Sam supplies request evidence; Alex revisits assumptions; the first new incident mug |
| 2. It Worked on My Machine | A receipt feature works in Sam's container locally but production uses different runtime configuration and an unexpected legacy integration. Same image does not mean same environment. | Maya finds why `receipt-bridge` still exists; Sam improves configuration validation |
| 3. The $47,000 Cloud Bill | Invoice prompts a cost investigation. An orphaned load-test environment, excessive logging and Kafka capacity contribute; quantify each rather than blame one NAT gateway. Ownership and cost visibility beat indiscriminate cuts. | Chris protects reliability-critical capacity; the retirement board gains owners. Exact fictional cost breakdown requires checking rates and period in Phase 3 for that chapter |
| 4. The 3 AM Incident | Infrastructure dashboards are green while a customer path fails. A scoped mitigation and customer-journey signals replace guesswork. SLOs describe user outcomes; symptoms guide paging. | Alex delegates; Chris coordinates customer updates and recovery time; whiteboard changes |
| 5. The Database Migration | A renamed column breaks old application instances during a rolling release. Expand/contract and compatibility windows replace a one-step migration. Locks and backfills need separate planning. | Sam catches mixed-version behavior; Maya chooses a staged migration over a clever shortcut |
| 6. Everything Is Finally Stable | Fixes have made ShipIt more reliable. A major feature request introduces new load and uncertain dependencies. Team negotiates staged delivery, ownership and error-budget-informed risk. | Chris arrives with an actual scoped plan; “before end of day” means a proposal, not an untested launch |

Connected arc: invisible assumptions become observable responsibilities. Improvements survive into later chapters, but they do not eliminate every new problem. Each installment remains readable independently.

## Chapter 1 narrative approach — not the final storyboard

The title deliberately suggests a stubborn pod, while the actual failure is an application that exits before its traffic path has finished draining. The mystery resolves when the team compares failed requests with terminating old targets. Do not show a pod surviving SIGKILL or endlessly routing because Kubernetes forgot it.

1. **Friday, 4:57 PM.** Cozy end-of-week wide view. Sam: “Two lines. Tests passed.” Maya: “How many systems do the two lines touch?” Establish competence and optimism without condemning Friday as inherently unsafe.
2. **Green replacements.** Sam: “New pods are ready.” Alex: “Good. What are the old ones doing?” Show healthy replacements and a rollout still in progress, not a universal green status.
3. **The customer signal.** Chris: “Checkout's failing for some customers.” Sam: “Only during the rollout…” Customer failures are intermittent, not proof every checkout is broken. Pause the rollout and assess mitigation while investigating.
4. **The overlap.** Sam correlates a failed request with an old target; Maya compares target draining and process-exit timestamps. Alex: “We closed the shop before the queue cleared.” A landscape desk scene with a later authored diagram inset shows old target, replacement and in-flight request; illustrated objects carry no generated labels.
5. **A tested handoff.** Team fixes signal handling and budgets draining time, then tests a controlled rollout under representative traffic. Maya: “Wait for traffic. Finish the work. Then stop.” Sam: “And test the part after green.” No universal magic duration in dialogue.
6. **The earned silence.** Successful rollout, error rate returns to baseline. Chris: “One more small change?” Everyone closes their laptop. Chris closes his too: “Monday.” Leave an understated mug callback for the reader to discover.

These are tonal sketches for approval. Phase 3 will specify complete scene compositions, bubble coordinates, exact dialogue, technical notes and prompts.

### Engineering guardrails for the final script

- Kubernetes deletion starts termination and control-plane endpoint updates; it is not a synchronous barrier that guarantees no traffic can still arrive. Terminating EndpointSlices expose termination state and normally mark `ready` false; serving/draining behavior depends on consumers and versions.
- ALB target deregistration and draining are asynchronous. Existing in-flight work and propagation delays can overlap process shutdown. Prove the fictional 502 mechanism with target/app evidence; do not attribute every ALB 502 to a terminating pod.
- With a nonzero grace period, a configured `preStop` hook normally runs before the runtime sends the container stop signal (typically SIGTERM). The grace countdown includes hook execution; it does not start afterward. Kubernetes may grant a small one-off extension for an over-running hook; this is not a design budget.
- Ensure the real application process receives the signal, including its container entrypoint. SIGTERM handling must coordinate traffic acceptance, draining active requests, bounded timeouts and cleanup. Abruptly rejecting still-routed traffic can itself cause errors. Readiness alone cannot finish in-flight work or synchronously drain an ALB.
- A measured `preStop` delay may cover propagation in a specific configuration; sleeping alone does not implement graceful shutdown or guarantee safety. Do not imply that toggling readiness in a hook synchronously updates every router.
- Align the application shutdown timeout, tested traffic propagation/draining window, ALB deregistration settings and `terminationGracePeriodSeconds`. At grace expiry remaining processes can be forcibly killed; use margins and document long requests, keep-alive connections and protocol-specific behavior.
- Test both new requests and in-flight requests during repeated representative rollouts. Healthy replacement pods, `maxSurge` and `maxUnavailable` do not prove a lossless handoff. Do not disable probes to get a green result.
- Distinguish an incident mitigation (pause rollout, restore stable capacity if appropriate) from the durable fix. Retrying checkout is unsafe without established idempotency.

Before Phase 3 approval, verify these details against current Kubernetes Pod lifecycle and EndpointSlice documentation, AWS ALB deregistration/502 documentation and the selected Node.js runtime's HTTP shutdown behavior. This phase did not perform a live documentation audit or runtime reproduction; the story is a technically constrained proposal.

Under the Hood should be an optional short ending: what failed, why signals and traffic propagation overlapped, how the tested fix worked, and caveats. Link to inspected existing material such as `/guides/introduction-to-kubernetes/04-deployments-and-replicasets` and `/guides/introduction-to-kubernetes/05-services-and-networking`. Verify exported routes and article claims before publication; these introductory guides are not substitutes for authoritative shutdown documentation.

## Image-generation capability and asset workflow

The environment exposes `image_gen.imagegen`, supporting new generation and edits with local `referenced_image_paths`, or recent conversation images. It supports transparent output when needed. No separate image-generation skill is listed; the onboarding skill is the only available cloud skill. The tool is callable without a user-supplied API key in its schema. During authorized Phase 2 it successfully produced seven local PNGs at 1536 × 1024, including one superseded Alex pass; see [character design review](character-design-review.md). No additional credential was requested. Scene-generation quality and mobile reading remain to be tested in Phase 4.

The tool does not expose explicit model, seed, dimension or quality controls in its current schema. Request portrait 4:5 and the highest practical source quality in the prompt, then inspect the actual dimensions. Do not promise a particular pixel size or deterministic regeneration. Prefer local paths for approved references, inspect them before edits and keep the reference set small and relevant.

After approval: generate and review character sheets first. Save actual returned source files, then use approved sheets and an approved environment reference for scenes. Phase 4 produces only one proof scene, without baked dialogue, followed by the overlay prototype and desktop/mobile review. Generate the remaining scenes only after that proof is approved.

Proposed asset records include prompt version, exact prompt, generation date, returned filename and dimensions, reference filenames/versions, approval status and review notes. Keep prompts and asset manifests alongside chapter documentation; no secrets. Inspect faces, hands, objects, reference consistency, negative space and implied architecture before accepting any image. Use the tool for artwork edits; use Sharp later for delivery resizing/encoding, not for repainting artwork.

Keep full-resolution masters and character production references outside deployed `public/` (for example `assets/comics/git-blame/` if storage size is acceptable). Only approved delivery images and social cards belong in `public/comics/git-blame/`. Decide Git versus approved external storage after measuring file sizes; do not introduce Git LFS without checking deployment support. Store a checksum and provenance for each accepted master. Asset storage is a Phase 2 decision, not an invented existing feature.

## Implementation proposal based on this repository

### Observed foundations

- Next.js **16.3.8**, React **19.3** dependency range, TypeScript **6** range; App Router. `next.config.mjs` enables static `output: 'export'`, with `images.unoptimized: true` and build-time TypeScript errors ignored.
- Tailwind **4**, existing configured theme, shadcn/Radix UI and Lucide. Root layout supplies Inter, header/footer, skip link, themes and site metadata.
- File-backed Markdown/frontmatter through `gray-matter`/`marked`, plus JSON content types. `lib/guides.ts` demonstrates filesystem loaders and related content. No CMS or database is needed for comics.
- Dynamic detail pages use awaited params, `generateStaticParams`, `dynamicParams = false`, and `notFound()`; use the same approach for published comic routes.
- Reuse `detailPageMetadata`, `truncateMetaDescription`, Breadcrumb and BreadcrumbSchema where appropriate. Existing technical-article schema is not automatically the right semantic type for a comic; consider ComicStory/CreativeWork and series relationships with truthful properties.
- `lib/image-utils.ts` primarily resolves existing PNG/SVG/JPG content covers. It does not currently provide comic variants or runtime optimization. Existing cover scripts generate SVG/PNG title cards; they are not narrative-art generators.
- Vitest uses a Node environment; Playwright already covers desktop Chromium and Pixel 7. CI runs frozen dependency install, tests and `build:fast`; lint/typecheck have acknowledged baselines. Cloudflare deployment has a 20,000-file ceiling checked by CI.

### Proposed files — create only in later approved phases

```text
content/comics/git-blame/
  series.json
  characters.json
  continuity.md
  chapter-01.json
  prompts/                 # prompts and reference-version manifests
assets/comics/git-blame/    # source masters and approved reference sheets; storage decision pending
public/comics/git-blame/
  chapter-01/               # optimized reader images only
  covers/                  # optimized cover and 1200×630 social card
lib/comics.ts              # file-backed loader, types and validation
components/comics/
  series-landing.tsx
  chapter-reader.tsx
  comic-scene.tsx
  speech-bubble.tsx
  chapter-navigation.tsx
  technical-notes.tsx
app/comics/page.tsx
app/comics/[series]/page.tsx
app/comics/[series]/[chapter]/page.tsx
```

Use JSON for chapter data with TypeScript types and narrow runtime validation, following existing JSON content patterns. No executable MDX dependency needed. Store series title, description, volume, cover, chapter order and explicit publication status. Chapter records contain slug, title, description, dates, scene array, notes and related tutorial paths. Character production metadata is separate from content sent to readers.

Each scene contains stable ID, image sources and intrinsic dimensions, aspect ratio, scene description/alt text, caption and ordered dialogue. Each utterance has stable ID, speaker ID, text, normalized x/y position, bubble width and optional tail direction/anchor. Positions refer to the uncropped artwork coordinate space. Dialogue order, not visual coordinates, defines reading order. Reserve a distinct source manifest so generation notes do not ship into the reader.

Server components can render most of the experience, including HTML bubbles. Use CSS for responsive positioning; no client state is required for baseline reading. Native `<details>` can implement Under the Hood. Existing optional client components should be reused only where they serve the reading experience. Do not introduce a visual editor, animation library, CMS or database.

### Readability and accessibility

At wide widths, position bubbles over reserved space with fluid text constrained to a readable minimum. Below a tested breakpoint (initial proposal: 640px), display the same dialogue elements in normal flow beneath each complete image, with speaker labels and tails removed. Use the same DOM content to avoid duplicate screen-reader dialogue. At 200% text zoom, ensure a flow layout is available rather than allowing bubbles to collide.

Use a figure and figcaption per scene; alt text describes visual action, not a redundant copy of all dialogue. Bubbles have real selectable text and identifiable speakers; decorative tails are hidden from accessibility APIs. Provide an accessible chapter transcript with ordered scene descriptions and dialogue if it adds value, ensuring the default reading experience does not announce duplicate text. Keep semantic heading order within the root layout's existing main landmark. Navigation names previous/next chapter titles, hides unpublished next links and offers a series contents link. No empty “next chapter” destinations.

Check keyboard access, contrast, 320px width, tablet, desktop, long dialogue and text zoom. Do not rely on color to distinguish speakers or technical states. Place related tutorials and technical notes after the punchline, not between scenes. Avoid adding interruptions or extra sticky controls inside the story.

### Images, performance and publication

Generate source masters at the highest quality actually supported, then create a small set of measured reader variants using the existing Sharp dependency: initially widths around 480, 960 and 1600, never upscale a smaller source. Prefer WebP with a JPEG fallback; add AVIF only if visual/size comparison justifies another variant. Use `<picture>`/`srcset`/`sizes` with explicit dimensions; `next/image` alone will not optimize this static export. Preserve the paper texture and thin lines when evaluating compression. Reserve space to prevent layout shift; prioritize only the first scene, lazy-load later scenes.

Target roughly 150–300 KB for a mobile scene as a provisional budget, adjusting after a quality comparison. Do not sacrifice facial expression or legible linework to hit a number. Keep production references, prompts and source masters outside `public/`, since public files ship in the export. Check Cloudflare file-count and asset-size limits when measuring the actual build. No image API, runtime server or credentials are needed by the deployed reader.

Generate explicit published-series/chapter static params. Extend sitemap and the relevant discovery/navigation surfaces deliberately; do not expose drafts. Existing search/feed scripts will not discover comics automatically: add search integration when shipping the reader, and decide separately whether comics join existing feeds. Use `detailPageMetadata` for canonical and social fields, a pre-generated 1200×630 share image, accurate titles/descriptions and breadcrumb schema. Keep chapter navigation based on published order, not guessed numeric URLs.

### Validation plan for approved implementation

Vitest: published route enumeration, unique scene/dialogue IDs, valid speaker references, normalized coordinates, existing image files and dimensions, chapter ordering and related link integrity. Test malformed content rejection rather than only checking a happy-path JSON parse.

Playwright: desktop overlay placement and mobile flow fallback; real dialogue visible and ordered; no horizontal overflow; chapter/contents navigation; keyboard and zoom behavior. Manually review art and speech-tail attribution at realistic reading sizes. Verify performance and image quality on the proof before expanding artwork.

Required before reader completion: targeted tests, relevant lint/typecheck review, `pnpm build:fast`, static export route/image/link inspection and a representative browser reading check. Run the full content suite when shared loaders or discovery integrations change. Baseline type/lint failures must be distinguished from introduced failures; a successful build alone does not prove type safety because errors are ignored by Next configuration. No deployment without explicit approval.

## Environment observations and scope (Phase 1 inspection)

The running machine has Node `v24.19.0` (within the declared >=22.13.1 <25 range) and pnpm `11.19.0` (outside the repository's >=10 <11 requirement). The package pins `pnpm@10.34.5`; `.nvmrc` pins Node `22.13.1`, while CI uses Node 22. Dependencies are not installed in this checkout.

Before later frontend work, activate the pinned pnpm 10.34.5 and preferably the repository's Node 22 toolchain, use a frozen-lockfile install and verify startup/build. Current pnpm 11 reports that the package's pnpm override settings are ignored; do not use it and silently lose those settings. Do not change package declarations or lockfiles to accommodate the machine.

The initial Phase 1 request limited that turn to discovery and documentation; the subsequent approval authorized Phase 2 character design. No dependency installation, server startup, build, tests or environment configuration save was performed, and no runtime readiness claim is made. No application secrets or services are needed for Phase 1. Future cloud startup instructions should use the existing isolated checkout, not create a worktree, and must include tested working directories and readiness checks after actual setup.

## Decisions and next checkpoint

Approve or revise:

1. The warm workplace-comedy direction, palette, cast and continuity rules.
2. ShipIt's merchant SaaS premise and the ALB-to-pod-IP architecture for Chapter 1.
3. The six-chapter arc and the shutdown/draining investigation rather than a literal immortal pod.
4. File-backed JSON, static React reader, editable HTML dialogue and mobile dialogue beneath uncropped art.

The eight zoo-book reference photographs have now been inspected; the reference review refines the visual direction. The user approved proceeding with Phase 2; its original four character sheets are now approved. The additional Noor and Eli designs require approval. Core character skin tones and face geometry are fixed by the approved sheets; the supporting designs and shared-scene height relationships still require review. Source-asset storage needs a size-based decision when actual masters exist; character-generation success is now verified, and supporting-character approval remains pending. Scene-generation quality is still untested.

**Phase 1 checkpoint cleared.** Phase 2 has saved and received approval for the four leads. It has added two requested supporting sheets and pauses for their approval. Phase 3 finalizes the six-scene script and stops. Phase 4 generates one scene and a responsive overlay proof and stops. Phase 5 completes Chapter 1 only after proof approval. Publishing remains a separate explicit approval.
