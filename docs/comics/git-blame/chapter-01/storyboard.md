# Chapter 1: The Pod That Wouldn’t Die

Phase 3 storyboard · 9 October 2026 · **Approved; Phase 4 cleared; Phase 5 complete chapter in review**

**A tiny Friday deployment turns green. Checkout has other ideas.**

All seven character designs are approved, including Sophia with requested blue eyes. Chapter 1 features the original four leads; Nora, Eli and Sophia enter later stories. Seven scenes separate the investigation, corrective work and validation so the resolution feels earned. The Phase 4 opening-scene proof is approved; all seven narrative scenes are now generated. Final runtime placements and delivery assets live in `content/comics/git-blame/chapter-01.json`; the composition notes below preserve the approved storyboard.

The title is a playful misdirection: the old application stops too early, while its responsibility to an in-flight request persists. Do not depict an immortal process or a pod ignoring SIGKILL. Sam brings useful request evidence, Maya coordinates investigation, Alex owns an old assumption and Chris shares the decision to defer another feature.

## Leadership roles in this chapter

Chris is ShipIt’s engineering manager. He coordinates delivery expectations and customer-impact communication, protects time for diagnosis, and shares the decision to defer another non-urgent feature. He is technically literate rather than a clueless boss.

Alex, the senior SRE, acts as the incident’s technical lead. Maya leads the platform/routing investigation; Sam leads the application/request evidence and participates in the fix. These are contextual technical-lead responsibilities, not new people-management titles. Nora and Eli lead their own areas when later chapters call for their expertise. No separate tech lead character is introduced in Volume 1.

## Review and production conventions

The [structured storyboard](storyboard.json) is the source for dialogue order, provisional bubble coordinates, reference paths and scene metadata. Coordinates are normalized to the complete image: x/y give a bubble’s top-left corner and width is a fraction of image width. The tail target is an image-space anchor. These are composition targets, not verified layout coordinates; adjust them against the real proof image. Dialogue always reads in the array order. On narrow screens or at text zoom, it flows below the uncropped artwork with speaker names.

Generate scenes without any text, bubbles, logos or technical diagrams. Use the exact approved character-reference files listed per scene. Technical insets, product branding and readable status labels are separately authored overlays. Preserve faces, hands, props and negative space. Artwork dimensions are requested as aspect ratios; actual generation output must be inspected rather than promised.

Office geography stays consistent: left window/plant shelf, center desks, right whiteboard/meeting nook, rear hardware shelf/kitchenette. No generated readable lettering on the plant, whiteboard, sticky notes or mugs. Add a continuity label later only if it remains legible. Keep at most one clear background joke per scene.

Every prompt below is saved as a complete production prompt in the linked file. It has not been executed. The drawing style stays tied to the approved cast sheets, rather than to a named external illustrator.


## Scene 1 — Two lines

**Format:** 4:5. **Characters:** Sam, Maya.

**Narrative purpose:** Establish the warm office, Sam’s optimism and the recurring small-change joke. Unit tests passed; the line count is not a risk estimate.

**Camera:** Slightly elevated three-quarter medium-wide view, focused on adjacent desks.

**Composition:** Sam sits left/center at a laptop, turning toward Maya at the right-hand desk. Their faces sit below the upper third. Keep the upper-left and upper-right wall quiet for two short bubbles. Window and plant shelf remain on the left; the whiteboard belongs to the right side of the established office. Keep the scene focused on Sam and Maya.


**External caption:** Friday, 4:57 PM.


**Background details:**

- One plant by the left window, its production-db label added later as optional authored text.
- One old switch on the rear shelf; no second background joke.
- A blank small clock face or leave clock out: the time belongs in the external caption.


**Dialogue and bubble placement:**

| Order | Speaker | Dialogue | x / y / width | Tail target |
| --- | --- | --- | --- | --- |

| 1 | Sam | It's literally a two-line change. | 0.060 / 0.06 / 0.40 | 0.32, 0.37 |

| 2 | Maya | That's what you said last Friday. | 0.530 / 0.17 / 0.40 | 0.72, 0.40 |


**Reserved overlay spaces:**

- Quiet upper third for dialogue; no essential faces, hands or objects beneath bubbles.


**Accessible visual description:** Sam turns from his laptop toward Maya in the warm office; Maya raises an eyebrow.


**Technical accuracy notes:**

- The two lines adjust receipt wording in an ordinary successful checkout response; this change does not introduce the termination defect.
- Existing unit tests pass. A production rollout exposes a pre-existing abrupt-exit handler under real request timing. Avoid identifying Sam as the cause simply because he deployed.


**Approved image references:** [sam-v1.png](../../../../assets/comics/git-blame/characters/sam-v1.png); [maya-v1.png](../../../../assets/comics/git-blame/characters/maya-v1.png)


**Image-generation prompt:** [scene-01.txt](prompts/scene-01.txt)

```text
Original adult workplace storybook artwork in the exact drawing treatment of the supplied approved character reference sheets: crisp fine irregular dark ink contours, bounded subtly mottled watercolor washes, warm paper, restrained opaque highlights, natural adult anatomy and understated expressive faces. Match each supplied character image rather than inventing a new face. Keep clothing, hair, glasses, skin color and accessories consistent. No glossy 3D, anime, chibi or flat corporate vectors. No lettering, labels, numbers, UI text, logos, speech bubbles, captions or watermark anywhere. Screens and boards have blank quiet surfaces for later authored overlays. Highest practical source quality. Preserve whole intended composition and generous safe margins.

Portrait 4:5. Sam on the left with messy auburn hair, mustard sweatshirt and jeans, turning from a plain laptop with a small confident grin. Maya on the right in round glasses, dark bob and green overshirt, giving a restrained raised-eyebrow response. Warm afternoon office, wood desks, left window and one plant, rear shelf with one old switch. Clear human gestures. Heads around 40 percent down the frame; reserve quiet wall across upper third, particularly upper left and upper right. Lived-in but uncluttered. No Alex, Chris, Nora or Eli. No generated text on plant, screens, clocks or walls.
```


## Scene 2 — Half a deployment

**Format:** 4:5. **Characters:** Sam, Alex.

**Narrative purpose:** Make the reassuring green result real, then point attention toward the old instances. Alex asks a useful question rather than mocking Sam.

**Camera:** Eye-level medium two-shot from the side of Sam’s desk.

**Composition:** Sam left, Alex right holding his cream mug; a laptop occupies the lower-middle area. Reserve two calm dialogue spaces above their heads. Screen remains a blank dark rectangle for later small authored target-status cards, not a generated dashboard.


**Background details:**

- Alex’s navy-rim cream mug is unlettered; an incident inscription may be added later.
- One cable neatly escaping a desk clip; no hardware cascade.


**Dialogue and bubble placement:**

| Order | Speaker | Dialogue | x / y / width | Tail target |
| --- | --- | --- | --- | --- |

| 1 | Sam | New pods are healthy. We're done. | 0.060 / 0.06 / 0.40 | 0.33, 0.38 |

| 2 | Alex | That's half a deployment. | 0.540 / 0.18 / 0.38 | 0.74, 0.42 |


**Reserved overlay spaces:**

- Upper-third bubbles; an optional compact status panel on the lower laptop screen.


**Accessible visual description:** Sam looks pleased with the rollout status while Alex watches over his shoulder, holding a cream mug.


**Technical accuracy notes:**

- Replacement containers are ready and their ALB target health has been checked. ShipIt already uses ALB IP-target readiness gates for replacement admission; this chapter diagnoses departure, not new-target registration.
- Pod Ready alone is not proof of ALB registration or successful user traffic. Never label an uncompleted rollout as globally healthy.
- An optional screen overlay says “new targets: healthy / old targets: retiring,” with explicit words rather than green color alone.


**Approved image references:** [sam-v1.png](../../../../assets/comics/git-blame/characters/sam-v1.png); [alex-v2.png](../../../../assets/comics/git-blame/characters/alex-v2.png)


**Image-generation prompt:** [scene-02.txt](prompts/scene-02.txt)

```text
Original adult workplace storybook artwork in the exact drawing treatment of the supplied approved character reference sheets: crisp fine irregular dark ink contours, bounded subtly mottled watercolor washes, warm paper, restrained opaque highlights, natural adult anatomy and understated expressive faces. Match each supplied character image rather than inventing a new face. Keep clothing, hair, glasses, skin color and accessories consistent. No glossy 3D, anime, chibi or flat corporate vectors. No lettering, labels, numbers, UI text, logos, speech bubbles, captions or watermark anywhere. Screens and boards have blank quiet surfaces for later authored overlays. Highest practical source quality. Preserve whole intended composition and generous safe margins.

Portrait 4:5. Sam left in mustard crewneck, auburn tousled hair, hopeful small smile. Alex right with dark curls, short beard and navy hoodie, relaxed shoulders, cream mug with navy rim, calmly looking at the laptop. Same office and desks as scene 1 from a closer eye-level angle. A plain dark laptop screen in the lower middle awaits controlled overlay; draw no text or symbolic Kubernetes logos. Keep quiet upper wall spaces for bubbles at upper left and upper right. Preserve simple adult faces and fine ink rather than portrait realism.
```


## Scene 3 — Checkout disagrees

**Format:** 4:5. **Characters:** Chris, Maya, Sam.

**Narrative purpose:** Introduce a concrete customer impact and show immediate incident containment. The team investigates while preserving healthy capacity.

**Camera:** Medium-wide eye-level view from the meeting nook toward the desks.

**Composition:** Chris enters at left holding his green mug and a phone, Maya at right reaches toward her laptop, Sam sits lower/center comparing request evidence. Two upper dialogue zones. Concern is focused, not panicked. A small phone error overlay can be authored after artwork; it cannot cover his hand.


**Background details:**

- Availability whiteboard visible but blank for an optional small later text overlay.
- Keep production-db off frame here; do not repeat every office prop.


**Dialogue and bubble placement:**

| Order | Speaker | Dialogue | x / y / width | Tail target |
| --- | --- | --- | --- | --- |

| 1 | Chris | Checkout's failing for some customers. | 0.050 / 0.06 / 0.43 | 0.27, 0.39 |

| 2 | Maya | Pause the rollout. Let's trace one failed request. | 0.510 / 0.18 / 0.43 | 0.73, 0.41 |


**Reserved overlay spaces:**

- Two upper bubbles; optional small phone status “checkout: 502”.


**Accessible visual description:** Chris shows the team a checkout failure; Maya reaches for the rollout controls while Sam examines a request.


**Technical accuracy notes:**

- Failures are intermittent and concentrated around old-pod termination. Attribute the visible 502 to the ALB only after correlated evidence.
- Pausing the Deployment’s rollout stops further rollout progression; it does not resurrect a terminated pod or instantly cancel an already-started termination. Keep healthy replacements serving and verify service recovery.
- Do not add blind checkout retries. This chapter does not establish safe retry behavior for a possibly committed order.


**Approved image references:** [chris-v1.png](../../../../assets/comics/git-blame/characters/chris-v1.png); [maya-v1.png](../../../../assets/comics/git-blame/characters/maya-v1.png); [sam-v1.png](../../../../assets/comics/git-blame/characters/sam-v1.png)


**Image-generation prompt:** [scene-03.txt](prompts/scene-03.txt)

```text
Original adult workplace storybook artwork in the exact drawing treatment of the supplied approved character reference sheets: crisp fine irregular dark ink contours, bounded subtly mottled watercolor washes, warm paper, restrained opaque highlights, natural adult anatomy and understated expressive faces. Match each supplied character image rather than inventing a new face. Keep clothing, hair, glasses, skin color and accessories consistent. No glossy 3D, anime, chibi or flat corporate vectors. No lettering, labels, numbers, UI text, logos, speech bubbles, captions or watermark anywhere. Screens and boards have blank quiet surfaces for later authored overlays. Highest practical source quality. Preserve whole intended composition and generous safe margins.

Portrait 4:5. Chris on left, salt-and-pepper hair and rust cardigan over cream collared shirt, muted-green mug set securely on nearby desk, showing a plain phone screen with his free hand. Maya right in green overshirt and round glasses, attentive, reaching toward her plain laptop; Sam lower center, auburn hair and mustard sweatshirt, studying another blank screen. An organized lived-in office meeting nook, whiteboard on right wall without marks or lettering. Calm concern and purposeful action, no panic poses. Leave upper-left and upper-right areas quiet for readable later bubbles. No text on screens, mugs or board.
```


## Scene 4 — Mid-sentence

**Format:** 4:3. **Characters:** Sam, Maya, Alex.

**Narrative purpose:** Reveal the actual failure with Sam supplying the request evidence and Maya correlating process lifetime. Let one clear diagram support the scene without turning it into a lesson.

**Camera:** Slightly elevated landscape view across the shared incident table.

**Composition:** Sam left, Maya center, Alex right, faces in the upper-middle band. Sam points toward one request record, Maya toward its exit timestamp; Alex has set his mug down. Reserve upper band for three short bubbles and a wide empty physical paper/board area across the lower third for a controlled technical inset. No generated arrows, pods or diagram nodes.


**Background details:**

- Maya’s slate notebook beside her keyboard.
- Only Alex’s mug in this frame; Chris and his green mug are off frame.


**Dialogue and bubble placement:**

| Order | Speaker | Dialogue | x / y / width | Tail target |
| --- | --- | --- | --- | --- |

| 1 | Sam | This request went to an old pod. | 0.040 / 0.04 / 0.29 | 0.23, 0.33 |

| 2 | Maya | It exited before the reply. | 0.355 / 0.06 / 0.29 | 0.52, 0.35 |

| 3 | Alex | We hung up mid-sentence. | 0.670 / 0.09 / 0.29 | 0.81, 0.36 |


**Reserved overlay spaces:**

- Top band for three short utterances; heads below it.
- Blank lower paper area: x .08, y .57, width .84, height .35. The diagram is separate structured content on mobile.


**Accessible visual description:** Sam, Maya and Alex compare a failed request with the old process’s exit; a clear inset explains the interrupted response.


**Technical accuracy notes:**

- Selected request was already in flight before termination. ALB awaited its response; the old Node process exited immediately on SIGTERM, closing the backend connection before a complete response. A replacement cannot take over this live request.
- ALB deregistration stops routing new requests when effective; control-plane propagation before that point is asynchronous. Do not depict ALB routinely selecting an already-deregistered target for brand-new requests.
- The inset’s replacement branch is a different request, not a replay or automatic transfer of the interrupted checkout.


**Approved image references:** [sam-v1.png](../../../../assets/comics/git-blame/characters/sam-v1.png); [maya-v1.png](../../../../assets/comics/git-blame/characters/maya-v1.png); [alex-v2.png](../../../../assets/comics/git-blame/characters/alex-v2.png)


**Image-generation prompt:** [scene-04.txt](prompts/scene-04.txt)

```text
Original adult workplace storybook artwork in the exact drawing treatment of the supplied approved character reference sheets: crisp fine irregular dark ink contours, bounded subtly mottled watercolor washes, warm paper, restrained opaque highlights, natural adult anatomy and understated expressive faces. Match each supplied character image rather than inventing a new face. Keep clothing, hair, glasses, skin color and accessories consistent. No glossy 3D, anime, chibi or flat corporate vectors. No lettering, labels, numbers, UI text, logos, speech bubbles, captions or watermark anywhere. Screens and boards have blank quiet surfaces for later authored overlays. Highest practical source quality. Preserve whole intended composition and generous safe margins.

Landscape 4:3, same original storybook style. Three engineers gathered around a wooden incident table: Sam left, Maya center with round glasses and dark bob, Alex right with dark curls, beard and navy hoodie. Sam points toward a blank laptop screen; Maya compares a second blank screen; Alex has placed his cream navy-rim mug on the table and watches quietly. Faces around the upper-middle band. Leave the upper quarter quiet for three later speech bubbles. Across lower third lay a broad completely blank ivory paper sheet or clean board surface, no fingers, cups or cables covering it: it will host a separately authored traffic diagram. Include Maya’s closed slate notebook off to one side. No text, arrows, diagrams, Kubernetes icons, mini-pod mascots or charts in the generated image.
```


## Scene 5 — The old goodbye

**Format:** 4:5. **Characters:** Sam, Alex, Maya.

**Narrative purpose:** Own the pre-existing bug without blame. Show the fix as coordinated application and infrastructure work, not a magic sleep.

**Camera:** Closer three-quarter view of the three engineers at the table, emphasizing faces and hands.

**Composition:** Sam left looking at the old shutdown handler; Alex center acknowledging it with a small rueful smile; Maya right with a plain note card. Three staggered quiet bubble zones above the heads. Their hands rest naturally; nobody delivers a presentation.


**External caption:** The two-line change gets a slightly larger companion.


**Background details:**

- A small hardware shelf at far rear with one blank sticky note; “Temporary fix, 2021” may be authored later.
- Alex’s mug on table, not held in every frame.


**Dialogue and bubble placement:**

| Order | Speaker | Dialogue | x / y / width | Tail target |
| --- | --- | --- | --- | --- |

| 1 | Sam | Codex traced it: we exit on SIGTERM. | 0.040 / 0.05 / 0.29 | 0.27, 0.39 |

| 2 | Alex | That's my old handler. Let's fix it. | 0.355 / 0.13 / 0.29 | 0.52, 0.44 |

| 3 | Maya | Claude Code can draft the test. We run it. | 0.670 / 0.05 / 0.29 | 0.77, 0.46 |


**Reserved overlay spaces:**

- Staggered upper dialogue band to .36; heads and essential gestures remain below .39.
- No live code listing in the illustration.


**Accessible visual description:** Alex acknowledges an old shutdown handler as Sam and Maya work with him on a safer handoff.


**Technical accuracy notes:**

- Remove abrupt process.exit on SIGTERM; make shutdown idempotent and bounded. Keep the app capable of serving residual traffic during the measured withdrawal phase, then stop accepting connections and finish active responses before resource cleanup.
- A supported preStop phase may cover measured propagation while the app remains alive; it runs before the normal stop signal and consumes the same Pod grace budget. Sleeping alone is not request draining.
- Verify signal delivery to the actual Node process. Align request bounds, ALB deregistration allowance, application shutdown deadline and total Pod grace budget.
- This is a separate deliberate corrective change, tested before release, not an unreviewed Friday hot edit.


**Approved image references:** [sam-v1.png](../../../../assets/comics/git-blame/characters/sam-v1.png); [alex-v2.png](../../../../assets/comics/git-blame/characters/alex-v2.png); [maya-v1.png](../../../../assets/comics/git-blame/characters/maya-v1.png)


**Image-generation prompt:** [scene-05.txt](prompts/scene-05.txt)

```text
Original adult workplace storybook artwork in the exact drawing treatment of the supplied approved character reference sheets: crisp fine irregular dark ink contours, bounded subtly mottled watercolor washes, warm paper, restrained opaque highlights, natural adult anatomy and understated expressive faces. Match each supplied character image rather than inventing a new face. Keep clothing, hair, glasses, skin color and accessories consistent. No glossy 3D, anime, chibi or flat corporate vectors. No lettering, labels, numbers, UI text, logos, speech bubbles, captions or watermark anywhere. Screens and boards have blank quiet surfaces for later authored overlays. Highest practical source quality. Preserve whole intended composition and generous safe margins.

Portrait 4:5. Sam left with auburn hair and mustard sweatshirt, looking at a plain laptop. Alex center with navy hoodie, curls and short beard, small rueful accepting half-smile and one relaxed open hand, never a shamed caricature. Maya right with round glasses, green overshirt and a plain unmarked note card, engaged in the decision. Same incident table and mug as previous scene. Reserve staggered quiet bubble spaces from top down to about 36 percent; faces and important hands must stay below 39 percent. Background hardware shelf with a single blank sticky note, unobtrusive. No source-code text, logs or generated words anywhere. Calm collaborative work.
```


## Scene 6 — Boring graphs

**Format:** 4:5. **Characters:** Sam, Alex, Maya.

**Narrative purpose:** Give validation its own beat. Completion of in-flight work, not merely replacement health, makes the resolution credible.

**Camera:** Eye-level medium-wide two-speaker view, Maya visible quietly at the right.

**Composition:** Sam left has a small relieved smile; Alex center/right glances at a quiet monitor; Maya further right checks a final request record without speaking. Keep screens clean for a compact later test-environment label and completion markers. Two upper bubbles, hands resting naturally.


**External caption:** Test environment first. A watched production rollout afterward.


**Background details:**

- Afternoon light slightly warmer; weather, desk positions and clothing unchanged.
- Plant may be barely visible at far left, not a new joke.


**Dialogue and bubble placement:**

| Order | Speaker | Dialogue | x / y / width | Tail target |
| --- | --- | --- | --- | --- |

| 1 | Sam | Even the slow request finished. | 0.050 / 0.06 / 0.42 | 0.29, 0.40 |

| 2 | Alex | Excellent. Boring graphs. | 0.530 / 0.19 / 0.39 | 0.66, 0.42 |


**Reserved overlay spaces:**

- Upper bubbles; a simple separate authored test summary rather than a screenshot full of microtext.


**Accessible visual description:** Sam smiles with relief as a deliberately slow test request completes; Alex and Maya check the rollout results.


**Technical accuracy notes:**

- Story action: repeat representative staging rollouts with overlapping HTTP requests, including a bounded slow request and connection reuse; correlate request IDs, Pod termination and ALB target state.
- Also test the forced-timeout path and readiness/startup behavior separately. A bounded grace period does not promise all arbitrarily long requests will finish.
- The first corrective production cutover keeps existing old processes alive until routing is withdrawn and in-flight work is observed complete. A parallel fixed deployment/target group supplies healthy capacity; the new handler is not assumed to exist in old replicas. Both versions use compatible unchanged database schema/configuration. Controller-owned changes avoid a conflicting manual ALB edit.
- Then observe a limited production rollout with stable capacity and mitigation ready. Show “no shutdown-related failures observed in these tests,” not an absolute zero-downtime guarantee.
- These are fictional story results. No actual ShipIt rollout or application test has been executed in this repository.


**Approved image references:** [sam-v1.png](../../../../assets/comics/git-blame/characters/sam-v1.png); [alex-v2.png](../../../../assets/comics/git-blame/characters/alex-v2.png); [maya-v1.png](../../../../assets/comics/git-blame/characters/maya-v1.png)


**Image-generation prompt:** [scene-06.txt](prompts/scene-06.txt)

```text
Original adult workplace storybook artwork in the exact drawing treatment of the supplied approved character reference sheets: crisp fine irregular dark ink contours, bounded subtly mottled watercolor washes, warm paper, restrained opaque highlights, natural adult anatomy and understated expressive faces. Match each supplied character image rather than inventing a new face. Keep clothing, hair, glasses, skin color and accessories consistent. No glossy 3D, anime, chibi or flat corporate vectors. No lettering, labels, numbers, UI text, logos, speech bubbles, captions or watermark anywhere. Screens and boards have blank quiet surfaces for later authored overlays. Highest practical source quality. Preserve whole intended composition and generous safe margins.

Portrait 4:5. Sam left in mustard sweatshirt smiles with quiet relief at a plain laptop; Alex center/right in navy hoodie looks at a larger blank dark monitor with an understated satisfied expression; Maya farther right in green overshirt and round glasses checks another plain screen attentively. Same desks and incident nook, slightly warmer late-afternoon light, unchanged hair and clothes. Screens remain blank for authored test-result overlays; do not draw graphs, ticks, words or digits. Two quiet spaces above heads for later speech bubbles. Clear ordinary adult hands at rest. No celebration confetti or heroic poses.
```


## Scene 7 — Monday

**Format:** 4:5. **Characters:** Chris, Sam, Maya, Alex.

**Narrative purpose:** Deliver the silent laptop-close punchline and let Chris share the decision. Finish on the people, not on a checklist.

**Camera:** Slightly elevated wide portrait view of the team desks and meeting nook.

**Composition:** Chris upper-right/middle catches the hint with an amused half-smile as the other three gently close their laptops. His own lid is halfway down too. Keep heads and laptop-closing hands distinct. First bubble above Chris; short “Monday” bubble in a second quiet area with tail to the same speaker. The image captures the response to the first utterance; bubbles establish a brief pause, not simultaneous speech.


**Background details:**

- A discreet mug on Alex’s desk, no newly materialized souvenir.
- Plant by original window; no appearance by Nora or Eli.


**Dialogue and bubble placement:**

| Order | Speaker | Dialogue | x / y / width | Tail target |
| --- | --- | --- | --- | --- |

| 1 | Chris | One more tiny change before we go? | 0.500 / 0.04 / 0.44 | None; final bubble carries the tail |

| 2 | Chris | Monday. | 0.650 / 0.20 / 0.28 | 0.73, 0.43 |


**Reserved overlay spaces:**

- Two ordered bubble areas above Chris at the right: question first, then Monday; only the final bubble has a tail.
- Protect laptop-closing hands and all four faces; final anchors must be adjusted after artwork.


**Accessible visual description:** Alex, Maya and Sam quietly close their laptops. Chris notices, smiles and closes his own as well.


**Technical accuracy notes:**

- The team has confirmed customer recovery and ownership of monitoring before packing up. No one abandons an active incident for a joke.
- The decision defers another non-urgent feature; Friday is not presented as inherently unsafe for all deployments.
- Alex’s new incident mug appears only in a later chapter after it could have been made; this scene keeps the existing mug.


**Approved image references:** [chris-v1.png](../../../../assets/comics/git-blame/characters/chris-v1.png); [sam-v1.png](../../../../assets/comics/git-blame/characters/sam-v1.png); [maya-v1.png](../../../../assets/comics/git-blame/characters/maya-v1.png); [alex-v2.png](../../../../assets/comics/git-blame/characters/alex-v2.png)


**Image-generation prompt:** [scene-07.txt](prompts/scene-07.txt)

```text
Original adult workplace storybook artwork in the exact drawing treatment of the supplied approved character reference sheets: crisp fine irregular dark ink contours, bounded subtly mottled watercolor washes, warm paper, restrained opaque highlights, natural adult anatomy and understated expressive faces. Match each supplied character image rather than inventing a new face. Keep clothing, hair, glasses, skin color and accessories consistent. No glossy 3D, anime, chibi or flat corporate vectors. No lettering, labels, numbers, UI text, logos, speech bubbles, captions or watermark anywhere. Screens and boards have blank quiet surfaces for later authored overlays. Highest practical source quality. Preserve whole intended composition and generous safe margins.

Portrait 4:5, slightly elevated view of the established warm office. The original FOUR leads only: Alex with dark curls, beard and navy hoodie; Maya with dark bob, round glasses and green overshirt; Sam with messy auburn hair and mustard sweatshirt; Chris with salt-and-pepper hair and rust cardigan. Alex, Maya and Sam each quietly close one plain laptop, with separate clear hands and lids. Chris notices with a small amused half-smile, his own laptop lid halfway down as he joins them. Natural relaxed posture after recovery, not anger at Chris. Preserve left window/plant and right meeting nook geography. Faces below upper third, two separate quiet spaces above Chris at the right for a question and then a single-word answer. No new souvenir mug; Alex’s existing cream navy-rim mug can sit discreetly on his desk. No words, generated bubbles or text.
```


## Scene 4’s authored diagram

The lower reserved paper area receives an accessible, controlled diagram, with “Load balancer,” “Old pod: app exits” and “New pod: healthy.” The earlier request to the old pod is labeled “Already in flight”; its response path is interrupted. A separate request succeeds through the replacement. Never imply that the failed request teleports, retries itself or is reprocessed safely by the new pod.

Use legible concise labels and distinct line styles as well as color. On mobile, place the same diagram in normal flow below the scene dialogue so it remains readable rather than squeezing microtext onto a narrow image. It is authored SVG on desktop and semantic text on phones/enlarged text, implemented in Phase 5. The JSON preserves intended nodes, edge meanings and accessible summary.

## Technical explanation and validation status

The optional end-of-chapter [Under the Hood draft](under-the-hood.md) explains the specific failure, signal/hook/grace relationship, traffic draining and caveats. The [engineering review](technical-notes.md) records the fixed scenario, first corrected-release cutover and source audit.

The fictional successful rollouts in scene 6 are scripted story events, not tests run here. Current Kubernetes, official controller and Node.js documentation were inspected. Live AWS documentation was blocked during Phase 3, when an explicitly archived official source supported the ALB notes. Both canonical live pages have since been fetched and checked in Phase 5; the audit records that resolved limitation.

## AI agents as everyday tools

In Scene 5, Sam uses Codex to inspect the shutdown path; Maya uses Claude Code to help draft a regression test. The team has already correlated request and process evidence. They review code, run the tests and own the production decision. Agent output is a useful hypothesis or draft, never an unverified declaration that the rollout is safe. The tools are neutral editorial mentions, not confirmed sponsors or new illustrated mascots.

This is an ordinary part of ShipIt’s 2026 development workflow. Keep the dialogue casual and the tool role bounded. Add tool names as editable text, not generated logos or screenshots. Neither agent caused the existing defect or rescues an incompetent team.

## Sponsorship fit

No Chapter 1 sponsor is confirmed. Its optional sponsorship field is empty. An observability or platform sponsor could earn a bounded role in request correlation or rollout validation, subject to the [series sponsorship plan](../sponsor-integration.md), technical verification and storyboard review. Neon’s proposed role belongs to Chapter 5’s migration rehearsal, not to this shutdown fix. Disclose support before a sponsored story and put its contextual link after the punchline.

## Continuity after Chapter 1

- The SIGTERM handler and retirement tests become shared reliability work; future chapters do not forget the fix.
- Preserve the same ALB-to-pod traffic path. The first corrective cutover’s temporary resources are retired deliberately.
- Record Alex’s authorship of the old handler without making him a permanent source of mistakes.
- Alex earns the idea for a new incident mug. It can appear in Chapter 2 after manufacture; it does not materialize during this incident.
- The plant, legacy service and availability whiteboard persist. None is secretly the cause of every chapter.
- Chris’s “Monday” is a small shared decision about a non-urgent change, not abandonment of customers or a universal no-Friday policy.

## Approval checkpoint

Phase 3 and the Phase 4 opening proof are approved. Phase 5 has produced all seven illustrations and the complete chapter draft, including editable dialogue and the request diagram. Review [the complete chapter](production-review/README.md) before Phase 6 site integration begins. Publishing requires separate approval.
