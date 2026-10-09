# Phase 2 — character design review

Updated 9 October 2026 · **All six character designs approved; Phase 3 storyboard awaiting approval**

The user approved proceeding and supplied all eight zoo-book reference photographs. All were viewed; the [reference review](reference-review.md) describes the general traits used to refine the creative bible. The photographs were not copied into final assets or supplied to the generation tool. This production set uses original designs and our own revised Alex sheet as a visual reference.

## Approved core cast

| Character | Source sheet | Distinctive design |
| --- | --- | --- |
| Alex | [alex-v2.png](../../../assets/comics/git-blame/characters/alex-v2.png) | Dark curls, short beard, warm olive skin, navy hoodie, charcoal trousers, gray sneakers, cream mug with navy rim |
| Maya | [maya-v1.png](../../../assets/comics/git-blame/characters/maya-v1.png) | Chin-length dark bob, round dark glasses, warm brown skin, green overshirt over ivory crewneck, charcoal trousers, slate notebook |
| Sam | [sam-v1.png](../../../assets/comics/git-blame/characters/sam-v1.png) | Tousled auburn hair, clean-shaven freckled face, mustard crewneck sweatshirt, blue jeans, off-white sneakers |
| Chris | [chris-v1.png](../../../assets/comics/git-blame/characters/chris-v1.png) | Gray-templed salt-and-pepper hair, clean-shaven mature face, rust cardigan over cream collared shirt, taupe chinos, brown shoes, green mug |

Each sheet contains front, three-quarter and side full-body views, six expression studies, clothing/accessory details and unlabeled color swatches. These sheets have no baked dialogue, captions or character names. Their arrangement is left-to-right: neutral, amused, skeptical, worried, concentrating and relieved. Subtle expression differences are deliberate, though amusement and relief could be differentiated more strongly if desired.

## Generation and review evidence

The initial core-cast pass produced five actual PNGs through `image_gen.imagegen`: Alex v1, its revised v2, and one sheet each for Maya, Sam and Chris. Every output measures **1536 × 1024** pixels; no resolution was invented or upscaled. All five files were copied into the repository from tool-produced output paths, leaving the original files in place. Every saved PNG decoded successfully and has a SHA-256 checksum in [character-assets.json](character-assets.json).

Exact prompts are saved in [prompts/](prompts/), with reference paths, versions, tool name and approval statuses in the manifest. Alex v1 is retained as a superseded generation record and must not be used as the active visual reference: its facial rendering and shading were too realistic. Alex v2 simplifies facial marks, keeps stronger ink boundaries and reduces tonal modeling. Maya, Sam and Chris were generated with Alex v2 supplied as a local image reference, not from unrelated text prompts alone.

Visual inspection of each tool output checked the turnarounds, recognizable face/hair/clothing, whole-body framing, accessory identity, hands and image text. No obvious extra limbs or illegible generated text were observed at full-sheet viewing size. Fine hand anatomy and perspective must still be checked in future scene-specific artwork; a reference sheet cannot certify those future outputs.

Across this set, warm paper, descriptive ink, muted textured fills and simplified expressions are coherent. Figures have adult body proportions rather than oversized chibi heads. The sheets are cleaner and less densely populated than the reference spreads by design. The eventual narrative environments should add the books' observational richness without repeating their compositions.

## Approved core design locks

- Preserve each sheet's actual face geometry, observed skin color, hairstyle, clothing cuts and footwear; prompt color codes are approximate intentions, not exact rendered-pixel matches.
- Alex's hoodie has a pouch, drawstrings and ribbed edges. Chris has a cardigan with buttons and pockets. Sam has neither hood nor cardigan. Maya's glasses remain round and her overshirt retains the ivory layer beneath it.
- Chris's mug is muted green; Alex's is cream with navy rim. Incident inscriptions are later authored overlays rather than generated letters.
- Maya's notebook is a useful reference prop, not a requirement to carry it in every scene. Sam's closed laptop in the detail column is also optional.
- Suggested relative height order: Sam slightly taller than Alex, then Chris, then Maya. Standalone sheets are not a scale chart and do not yet validate these relationships; specify and check them when characters first share a scene.
- Alex v2, Maya v1, Sam v1 and Chris v1 were approved by the user on 9 October 2026. The manifest records those exact approved files. Future scenes must use those approved versions with matching continuity notes.

## Review considerations for future scene proofs

1. Does this cleaner storybook drawing treatment fit the desired aesthetic? It is less densely detailed than the book environments; scenery belongs in the later scene proof.
2. Do the faces, proposed skin tones, silhouettes and clothing feel right for the cast? In particular, assess whether Sam reads approximately 27 and Chris approximately 43.
3. Are the understated expressions sufficient, or should skepticism, worry and relief be more pronounced?

Clothing folds retain more detail than the small people in the book panoramas. That may be useful at character-sheet scale, but the later scene proof should establish how much detail to retain at mobile reading size. Do not claim consistency across lighting or shared camera angles until a real scene has been reviewed.

## Scope and next step

No website routes/components, chapter scenes, final storyboard or production deployment were created. Source sheets remain under `assets/`, outside deployed `public/`. At these measured sizes the small candidate set is stored locally in the repository; no LFS or external storage was introduced. This does not settle storage for a future volume of large masters.

**The original four sheets are approved.** Two additional recurring supporting characters have now been requested; see [supporting cast review](supporting-cast.md). The supporting designs and Nora’s updated name are now approved. Phase 3 prepares the complete Chapter 1 storyboard, with compositions, dialogue, bubble positions, technical notes and scene prompts. That phase must stop for review before any chapter illustration is generated.


## Supporting-cast expansion

Nora v1 (database engineer) and Eli v1 (FinOps engineer) were generated on 9 October 2026 using the approved Alex v2 and Maya v1 sheets as image references. They use the same three full-body views, six expressions and accessory/swatch format, at 1536 × 1024. Both outputs were visually inspected for style, framing, identity and obvious anatomy/text defects; both decoded and have checksums in the manifest. Their exact prompts are saved. Both supporting designs are approved. The original core four stay approved. Seven output PNGs now exist in total, including the superseded Alex v1.
