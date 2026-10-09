# Chapter 1 — expanded artwork review

10 October 2026 · Six new illustration candidates · Ready for art feedback in the ongoing draft PR.

The new inserts make the engineering visible and interrupt the repeated office-conversation framing. The release happens under Sam's hand, a customer experiences an uncertain checkout, Alex identifies the faulty code, the team deliberately tests a request during shutdown, and Maya completes the watched handoff. The deployment cutaway is an explicitly logical illustration. These are actual model-generated assets, not placeholder or stock images.

[Read all fourteen panels in order](reading-sequence.md). That review interleaves these six inserts and the earlier request-trace proof with the seven existing character moments. **It is an artwork reading sequence, not an update to the application: the Next.js reader and downloadable PDF still contain seven illustrations.** Further site design was outside this update's scope.

## 2. One click before the weekend

![Sam begins the release.](panel-02-release-desktop.jpg)

[Source art](panel-02-release-source.jpg) · [Phone](panel-02-release-phone.jpg) · [320px phone](panel-02-release-narrow-phone.jpg) · [Enlarged text](panel-02-release-enlarged-text.jpg)

## 4. Green replacements, unfinished departure

![Logical deployment cutaway with direct ALB routes.](panel-04-replicas-desktop.jpg)

[Source art](panel-04-replicas-source.jpg) · [Phone](panel-04-replicas-phone.jpg) · [320px phone](panel-04-replicas-narrow-phone.jpg) · [Enlarged text](panel-04-replicas-enlarged-text.jpg)

One ALB outside the logical cluster, three app pods within it, one app compartment per pod, and exactly three ALB-to-pod paths. There is no pod-to-pod request transfer. Two ready replacements do not establish that accepted old work completed. `Terminating` is a display/deletion state, not a Pod phase; `2/2` counts replacement replicas.

## 5. Meanwhile, at checkout

![A customer receives an uncertain checkout result.](panel-05-customer-desktop.jpg)

[Source art](panel-05-customer-source.jpg) · [Phone](panel-05-customer-phone.jpg) · [320px phone](panel-05-customer-narrow-phone.jpg) · [Enlarged text](panel-05-customer-enlarged-text.jpg)

The customer is unnamed. The message does not assert a lost order or offer an automatic retry; an interrupted HTTP response leaves the write outcome uncertain.

## 9. Alex recognizes the goodbye handler

![Alex identifies the immediate-exit handler.](panel-09-handler-desktop.jpg)

[Source art](panel-09-handler-source.jpg) · [Phone](panel-09-handler-phone.jpg) · [320px phone](panel-09-handler-narrow-phone.jpg) · [Enlarged text](panel-09-handler-enlarged-text.jpg)

The exact code is separately authored and deliberately defective: `process.exit(0)` does not wait for pending HTTP work. It is not a recommended implementation.

## 11. Make the slow request overlap shutdown

![A request finishes after shutdown begins and before exit.](panel-11-overlap-desktop.jpg)

[Source art](panel-11-overlap-source.jpg) · [Phone](panel-11-overlap-phone.jpg) · [320px phone](panel-11-overlap-narrow-phone.jpg) · [Enlarged text](panel-11-overlap-enlarged-text.jpg)

Exactly two tracks. The accepted request stays continuous across the amber shutdown marker; its green completion precedes the process's exit on the second track. This is a fictional authored test view, not infrastructure executed in this environment. The eventual implementation still needs traffic-withdrawal measurements, shared grace-budget accounting, work tracking and bounded deadlines.

## 13. One watched production handoff

![Maya completes the last check of the watched handoff.](panel-13-handoff-desktop.jpg)

[Source art](panel-13-handoff-source.jpg) · [Phone](panel-13-handoff-phone.jpg) · [320px phone](panel-13-handoff-narrow-phone.jpg) · [Enlarged text](panel-13-handoff-enlarged-text.jpg)

Four ordered checks: corrected replicas healthy; new traffic shifted; old accepted work complete; old processes retired. A corrected release cannot inject a new shutdown handler into an old process. The first handoff keeps old processes alive until withdrawal and accepted-work completion; later rollouts use the tested handler.

## Source records and reuse

[panels.json](panels.json) contains source paths, editable status/code/checklist wording, actual reviewed label positions, image descriptions and technical caveats. Your frontend agent can consume these when interleaving the revised chapter. The image model drew every depicted hand, object, routing path and timeline; HTML supplies only exact lettering. On phones and enlarged text, it becomes ordered text below uncropped art. No new dependency or website component was added.

[manifest.json](manifest.json) records all nine generation calls: six initial images and three refinements, resulting in six selected candidate masters. Earlier versions remain marked as superseded. Each record includes the exact prompt, actual tool output filename, reference chain, dimensions and SHA-256. Masters retain the model's actual resolution without upscaling; JPEGs are full-image quality-90 review encodings. The approved character sheets remain the identity anchors. These candidates are not declared final or approved.

The refinements removed the cutaway's physical hut treatment, cleaned the customer's error/keyboard lettering, and corrected the handoff's replica symbols and writing clearance. The final handoff lettering uses the notebook's clear left page opposite its four checks, away from the pen and hand. Manual review covered natural hands, recognizable cuffs/profile/props, diagrams, actual code and final desktop composition.

## Verification and reproducing the review

Twenty-four Chromium panel/layout checks passed: six panels at desktop, 393px phone, 320px phone and doubled root text, all with JavaScript disabled. They loaded the real images, retained their source aspect ratios, exposed complete ordered wording without horizontal overflow, kept desktop annotations inside the art without mutual overlap, and preserved the exact multiline code. [Browser bounds](browser-checks.json) and the captures above belong to this generation batch. Representative phone and enlarged-code views were also visually inspected. These checks verify the art review, not an updated Next.js chapter or real infrastructure behavior.

From the repository root, run `node docs/comics/git-blame/chapter-01/expanded-art-review/render-review.mjs` to encode the selected masters and render this isolated HTML review. Serve the checkout locally on port 3211, then run `node docs/comics/git-blame/chapter-01/expanded-art-review/capture-review.mjs` for captures. `COMIC_ART_REVIEW_URL` and `COMIC_CHROMIUM_PATH` override the internal review address and browser executable. Existing dependencies are used. No production deployment or merge has occurred.
