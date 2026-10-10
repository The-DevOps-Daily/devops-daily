# Sponsorship in git blame

9 October 2026 · Editorial and implementation proposal

The series should be able to feature a sponsor naturally inside an engineering story. This is part of the plan from the start. **No new sponsor or campaign is confirmed. Neon is a hypothetical example requested by the user.**

## How a placement earns its scene

Start with the team’s problem, then select a product task that actually belongs in their workflow. A character can use the tool to gather evidence, rehearse a change or make an operational decision. The product has a bounded role; the team still reasons, tests and owns the outcome. The scene should work as a story when read by someone who has never heard of that product.

Give the product one meaningful beat, usually one short mention and an authored screen/logo detail. Add a small “This chapter is supported by …” credit below the chapter heading, before the first scene, and a contextual link after the punchline. Readers can enjoy the complete chapter without following that link. Under the Hood explains the technical role and limitations in the same plain language used for the rest of the chapter.

Characters do not suddenly recite feature lists, pricing copy or a sponsor’s slogan. Humor remains about engineering situations, not endorsements. A product can reveal a problem without resolving every part of it. Editorial and technical review must approve the specific claims; a sponsor can check factual details and branding without being promised an infallible portrayal.

## Neon example: Chapter 5, The Database Migration

**Potential role:** a dedicated migration-rehearsal environment using a Neon PostgreSQL project populated with representative synthetic or appropriately sanitized test data. The team could create a branch for a candidate schema change and run both old and new application versions against it. Actual branching behavior and supported project features must be checked against current Neon documentation before finalizing the sponsored script.

Potential dialogue sketch, not an approved final Chapter 5 script:

> Sam: “I made a Neon branch for the migration.”
>
> Nora: “Great. Try the old app against it too.”
>
> Sam: “That is a much less cheerful result.”

The product provides a useful place to rehearse; the discovery is that rolling releases need compatibility across application versions. The fix remains expand/contract, a planned backfill and careful lock/load management. A branch experiment alone does not prove the production rollout is safe.

**Continuity:** ShipIt’s canonical production PostgreSQL is RDS. A Neon test branch is created within a Neon project; it does not directly branch the RDS instance. Introducing this rehearsal project is an explicit environment addition in Chapter 5. A later production-provider migration would require a separately motivated story and architecture update.

**What to verify for a real campaign:** the current branch semantics, PostgreSQL version/extensions, application connection behavior, pooling and connection limits relevant to the scenes, and the actual test-data setup. Model production-relevant schema and compatibility, then separately validate production locking, workload and failure behavior. Only make cost or performance comparisons using a stated workload and checked rates; no invented savings percentage or promise that a branch guarantees safe migration.

The sponsor role can be replaced before story approval with a provider-independent rehearsal workflow. Published technical facts about the chosen tool remain part of the chapter’s history after a campaign ends; changing a sponsor does not retroactively change the fictional infrastructure.

## Volume 1 opportunities

| Chapter | A plausible sponsor-supported beat | The engineering result that still belongs to the team |
| --- | --- | --- |
| 1. The Pod That Wouldn’t Die | Observability or platform tooling helps correlate a failing request with old-pod termination | Correct shutdown, draining budgets and representative rollout testing |
| 2. It Worked on My Machine | Configuration or preview tooling exposes a meaningful environment difference | Validate configuration and understand runtime dependencies |
| 3. The $47,000 Cloud Bill | Cost/ownership tooling helps Eli attribute usage and find an orphaned environment | Choose sensible savings without removing needed reliability capacity |
| 4. The 3 AM Incident | Traces, logs or customer-journey monitoring connect symptoms to impact | Incident coordination, mitigation and useful SLO-based signals |
| 5. The Database Migration | Database tooling supports rehearsal; Neon branching is one hypothetical fit | Mixed-version compatibility, expand/contract, locks and backfills |
| 6. Everything Is Finally Stable | A delivery/platform tool enables a staged feature experiment | Negotiate scope, capacity, ownership and reliability tradeoffs |

These are editorial opportunities, not reserved advertising inventory or promises about specific vendors. A chapter can be unsponsored. Prefer one named product integration per chapter so reader attention stays on the cast. A useful sponsored task may occur in investigation or validation rather than being the final “fix.”

## Proposed content model and UI

The existing repository’s `lib/sponsors.ts` is the source of active site sponsor names, logos, URLs and descriptions. `InlineSponsors`, `SponsorLogo` and `SponsorSidebar` already exist. This phase does not add Neon to that registry, imply a partnership or change application components.

A future chapter may have optional `sponsorship` metadata. Resolve an active sponsor by its existing registry name when practical; the current registry does not expose stable IDs. Keep chapter campaign/editorial information separate from general sponsor descriptions. Proposed fields:

- `sponsorName`: registry-backed active sponsor name, populated only for an agreed campaign.
- `disclosure`: short explicit reader-facing support credit.
- `storyIntegration`: role, affected scene IDs and factual claims to verify.
- `cta`: short contextual label and approved destination, shown after the story.
- `editorialStatus`: proposed, fact-checked or approved; never publish an unapproved placement.
- `publishedCredit`: the historical campaign name and credit text captured when publishing, so archived chapters retain accurate disclosure after the active registry changes.

Chapter 1’s draft JSON stores `sponsorship: null`. These fields are a proposal, not a runtime schema or implemented feature. The future loader should accept absence as an unsponsored chapter, validate scene references and reject incomplete publishable placements.

Render credits and logos as accessible HTML or controlled assets. Keep sponsor labels, UI screenshots, links and product text out of generated artwork so they remain correctable. Preserve approved brand assets and usage notes separately from scene masters. Mark commercial links with the repository’s existing `rel="sponsored"` convention, with `noopener noreferrer` when opening a new tab. Avoid adding tracking scripts merely to support a credit or link.

Use a restrained chapter-specific credit and footer treatment. The general sponsor components can supply established styling and logo rendering, but repeating a large all-sponsors grid between scenes would disrupt the reading experience.

## Approval workflow

For a real sponsored chapter, record the product, actual workflow, desired claim, chapter/scene fit and disclosure before final storyboard approval. Check current product documentation, then obtain editorial approval of the natural story beat. Generate text-free art after that approval, and review the overlays as part of the artwork proof. Keep the existing character, storyboard and production-deployment checkpoints.

This plan authorizes planning, not sponsor outreach, promises, contract acceptance or a new site sponsor listing. No messages were sent to sponsors.
