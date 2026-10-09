# Supporting cast — Phase 2 expansion

9 October 2026 · **Noor and Eli designs pending user approval**

The user approved Alex, Maya, Sam and Chris and requested a few additional characters. Add two recurring specialists to widen the stories without crowding the main team. The original four remain the leads. Both new sheets were generated with the approved Alex v2 and Maya v1 images as references; actual PNGs, exact prompts, dimensions and hashes are saved in the asset manifest.

## Noor — database engineer

**Approximately 36.** Curly dark hair gathered into a low bun, warm brown skin, softly rounded face, no glasses. Plum V-neck knitted vest over an ivory collared blouse, olive-gray trousers and dark brown flat shoes. The actual sheet establishes the rendered skin color and curls; do not infer an exact complexion from prompt wording or replace the low bun with Maya's bob.

[View Noor's sheet](../../../assets/comics/git-blame/characters/noor-v1.png).

Noor is deliberate and warm, comfortable working across database and application boundaries. She likes making a change boring through a useful test. Her questions focus on people and software still relying on the previous behavior: “Who is still using the old version?” She can get absorbed in one slow query and miss a workload change elsewhere. Her growth is learning when a safe mitigation matters more than a perfect explanation.

Her humor is practical rather than prohibitive. A recurring beat: someone promises a lock will last “briefly”; Noor calmly asks, “How briefly?” Occasionally she is the one who has to revise her estimate. Avoid presenting her as a gatekeeper who says every migration is impossible.

**Primary Volume 1 appearance:** Chapter 5. Sam identifies a mixed-version failure; Noor helps the team use expand/contract, test compatibility and plan the lock/backfill work. She owns relevant expertise rather than rescuing a supposedly incompetent team. A quiet earlier encounter can establish her role without forcing another voice into Chapter 1.

**Reference props:** ochre notebook and graphite pencil. Both optional in scenes. Her notebook is distinct from Maya's slate notebook; she does not need to hold it in every illustration.

**Consistency:** low curly bun, no glasses, plum sleeveless vest and ivory long sleeves. Warm paper/ink treatment follows the approved core. Suggested stature roughly comparable to Maya, with a sturdier silhouette; standalone sheets are not a scale chart.

## Eli — FinOps engineer

**Approximately 40.** Shaved head, warm tan skin, rounded angular face and neatly trimmed short dark facial hair. Dusty slate-blue chore jacket over ivory crewneck T-shirt, brown trousers and off-white sneakers. The generated facial hair is fuller around the chin than the prompt's initial small-goatee description; the visible sheet is the proposed design to approve and reuse, not an invitation to change beard shape between scenes.

[View Eli's sheet](../../../assets/comics/git-blame/characters/eli-v1.png).

Eli combines engineering fluency with curiosity about what money buys. He understands that the cheapest architecture can be the most expensive incident. His first questions are “Who owns it?” and “What would happen if we switched it off?” He helps teams explain costs, utilization and tradeoffs rather than treating the monthly bill as a moral failure.

His blind spot is an attractive savings forecast based on too little history. He is willing to revise it after the team shows seasonal traffic or a recovery requirement. A recurring beat: the tag says `temporary`, but the resource is old enough to have accumulated architectural obligations. Eli supplies an owner and an expiry/review date rather than deleting it for a punchline.

**Primary Volume 1 appearance:** Chapter 3. He reconciles the bill with resource usage and ownership, works with Chris on a sensible plan, and resists cuts to reliability-critical capacity. He is not a separate finance antagonist and does not calculate fictional AWS prices without a dated, checked basis.

**Reference prop:** a closed ochre tablet folio, optional in scenes. No branded laptop, suit, tie or ever-present spreadsheet. His shaved head and blue jacket distinguish him from Alex; avoid replacing the chore jacket with Alex's hoodie.

**Consistency:** bald silhouette, fixed facial-hair pattern, slate-blue jacket, ivory crewneck and brown trousers. Suggested stature close to Alex, broad comfortable adult build; verify relative heights when they share an illustration.

## Ensemble rules

- Most scenes feature two or three speaking characters. A supporting character enters because they affect the decision, not because a full cast must appear.
- Keep Sam's useful discoveries and Chris's engineering judgment. Supporting expertise complements the original four.
- Noor and Eli can be wrong, learn and help others. Neither is an infallible specialist or a source of stereotyped jokes.
- Chapter 1 keeps its original core cast. First substantive introductions belong in the cloud-bill and migration stories.
- Use short dialogue rather than job-title exposition. Establish roles through observations and choices.
- Approve each added sheet before using it as a scene-generation reference. The original four approvals remain recorded independently.

## Review evidence and checkpoint

Both new PNGs are 1536 × 1024, with three full-body views, six expressions, detail studies and swatches. Their identities, attire, framing and shared drawing treatment were visually checked in tool output; no obvious extra limbs or unwanted lettering were observed at sheet scale. Future scene-specific hands, lighting and height relationships still require their own review.

All sources remain outside deployed `public/`. No chapter artwork, storyboard or reader code was created in this expansion. The sheets and profiles are added to the existing draft PR for review. **Stop here for Noor and Eli approval before Phase 3.**
