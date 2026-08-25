---
title: 'The Postmortem Nobody Reads, and the One They Do'
excerpt: 'Most incident write-ups are compliance artifacts: written once, filed, and never opened again. The difference between those and the postmortems engineers actually forward to each other comes down to a handful of choices about audience, structure, and follow-through.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-25'
publishedAt: '2026-08-25T09:00:00Z'
updatedAt: '2026-08-25T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - SRE
  - Incident Management
  - Postmortems
  - Reliability
---

You know the artifact: a template in Confluence or Notion, filled in three days after the incident by whoever was unlucky enough to hold the pager. A raw log pasted from Slack. A "root cause" section containing one sentence. Five action items, two of which are "add monitoring." It gets linked in a channel, skimmed by a manager, and never opened again. The next incident, sometimes the same incident, happens six months later to a team that had no idea the document existed.

Then there is the other kind. The write-up that gets forwarded between teams, quoted in design reviews a year later, and shows up in onboarding docs. The gap between the two kinds is not writing talent. It is a short list of structural choices, and they are learnable.

## TL;DR

- Most postmortems fail because they are written **for the filing cabinet**: the implicit audience is a compliance checkbox, not a future engineer with a decision to make.
- The strongest hook is **a surprise**: the belief the team held that turned out to be false. Where there is no clean surprise, the hook is the tension: the known risk that finally fired, or the recovery that was harder than it should have been.
- Keep a **curated decision timeline** in the body and move the raw event log to an appendix. The distinction is annotation, not length.
- Replace the single **root cause** with contributing factors, and ask **"what prevented this from being worse?"**, separating working safeguards, human adaptation, and plain luck.
- Reconstruct why decisions **made sense from inside the incident**, not whether they look right in hindsight.
- Action items need an accountable owner, a verifiable completion condition, and cross-incident review, or they decay into wishes.

## Prerequisites

- You have been part of at least one incident and its aftermath
- Your team runs some form of incident review, however informal
- No tooling required, though we touch on where it helps

## Which incidents deserve a review at all

Severity and learning value are not the same thing, so a SEV threshold alone is the wrong trigger. Alongside "material customer or SLO impact," the reviews that pay off tend to follow: data loss or security exposure, a monitoring failure (you found out from a customer), an unusually long or confusing mitigation, a repeat of a low-severity pattern, and, most under-used, the **near miss**: high potential consequence, little realized harm. A recovery that went surprisingly *well* can also be worth a review, because it usually reveals expertise nobody has written down. [Google's SRE book](https://sre.google/sre-book/postmortem-culture/) uses a similar trigger list for the same reason: waiting for a big number misses most of the learning.

Whatever the trigger, stamp the basics on the document so it can be found and compared later: an incident ID, severity, impacted services, detection source, and the detected/declared/mitigated/resolved timestamps.

## Why the default postmortem is unreadable

Start with an uncomfortable question: who is the write-up for? In most orgs, the honest answer is "the process." The template exists, the incident happened, therefore the template must be filled. The author's goal, consciously or not, is completion, and every section gets exactly the minimum that lets the meeting end.

That produces recognizable symptoms:

- **The raw log as narrative.** Forty unannotated lines of `14:02 - alert fired`, `14:07 - X joined the call`. The reader is left to reconstruct the story themselves, and nobody does.
- **The one-sentence root cause.** "Root cause: misconfigured health check." That sentence is where the interesting part *begins*: why was it misconfigured, what made the misconfiguration invisible, what did the team believe about it that was wrong?
- **Blameless theater.** The org adopted blameless language without the substance, so the document carefully avoids naming anything at all: no decisions, no assumptions, no "we believed X." What remains is passive-voice fog: "an error was introduced." Blameless means you do not punish people for decisions that made sense at the time. It does not mean the decisions go unexamined; the decisions are the entire content.
- **Action-item confetti.** A list generated in the last five minutes of the review meeting, unowned, undated, unfollowed. Six months later, half are done by accident and nobody can say which.

None of this is malicious. It is what you get when the deliverable is "a document exists" rather than "someone learns something."

## The one they do read

Flip the audience. The readable postmortem is written for a specific person: **an engineer who was not in the incident, reading it a year later, because they are about to touch the same system.** That reader has three questions:

1. What did the team believe that turned out to be false, or what tension finally snapped?
2. How did the system actually behave, and why was that surprising?
3. What would I need to know to not do this again?

One caveat before the format: a public outage report and an internal learning review are different artifacts. Public reports, like the ones GitHub and Cloudflare publish, optimize for customer trust under legal and security constraints. The internal review can and should preserve the mess: uncertainty, conflicting mental models, organizational pressure. This post is about the internal kind; a public summary can always be distilled from it, as we did when writing up [the GitHub outage](/posts/github-2-9-billion-monthly-commits-outage) from the outside.

### Lead with the surprise, or the tension

Many incidents worth writing up contain a moment where reality disagreed with the team's mental model: the retry logic everyone trusted amplified the load instead of shedding it; the failover that had been tested quarterly depended on a DNS TTL nobody knew about. If that moment exists, open with it. One paragraph: what we believed, what was actually true, what it cost.

Not every incident has a clean revelation, and forcing one produces fiction. The honest alternatives hook just as well: the known risk that was deferred four quarters and finally fired, the familiar failure that recurred under deadline pressure, the response that was far harder than the incident justified. Lead with whichever is true. What kills the document is leading with the timeline.

### Structure as story, attach the evidence

A shape that consistently works:

```text
1. Summary          - 3 sentences: impact, duration, the surprise or tension
2. Background       - the 2 paragraphs of context the outside reader needs
3. What happened    - the story with a curated decision timeline: what
                      responders saw, inferred, and tried at each turn
4. Why it happened  - contributing factors, plural (see below)
5. What kept it from being worse
6. What changes     - each item: owner, completion condition, the factor
                      it addresses
7. Appendix         - the raw event log, graphs, links to dashboards
```

The timeline advice is a distinction, not a ban: a **curated decision timeline** belongs in the body, because "X joined at 14:07" can matter enormously when it explains a handoff, new expertise, or the authority to take a risky action. What belongs in the appendix is the raw, unannotated export. The difference between the two is annotation: each entry in the body should say what responders observed, what they concluded, and what they did about it.

Keep the wrong turns. The forty minutes spent restarting the wrong service teaches how diagnosis failed, and the useful question about that detour is not "why was it wrong" but **what made it compelling at the time**: the dashboard that happened to look scary, the earlier incident it resembled, the alert that pointed sideways. Reconstructing that local view, what each responder could see, what pressure they were under, which plausible alternatives existed, is the core of the [learning-from-incidents school](https://www.adaptivecapacitylabs.com/blog/), and it is what separates a review from a verdict. Different responders often held different models of the system during the same incident; where those models conflicted is usually the most instructive paragraph in the document.

### Contributing factors, not root cause

"Root cause" implies the incident was a chain with one first link. Real incidents are a lattice: a latent bug, plus a config that widened the blast radius, plus a gap in alerting, plus a deploy at the wrong time. Pick any one "root" and the others stay armed, waiting for a different trigger.

Listing four contributing factors instead of one root cause also makes the follow-up list honest. Each factor either gets addressed or gets an explicit "accepted risk" label, with an owner and a review date of its own. The single-root-cause format lets the other three factors quietly disappear.

### What kept it from being worse

The most underused section in incident writing, and "we got lucky" is only a third of it. When impact stops short of catastrophe, sort out why:

- **Safeguards that worked as designed**: the rate limit, added for an unrelated reason, that held the corrupted batch to 3 percent of users. These deserve to be recognized so nobody deletes them in a cleanup.
- **Human adaptation**: someone bridged two teams, improvised a drain script, or noticed the pattern from a previous job. This is skilled work, not luck, and naming it tells you where your real resilience lives, including when it lives dangerously in one person's head.
- **Actual luck**: the failure landed at 4 a.m. on a Tuesday. Luck is a list of incidents you have not had yet.

A near miss surfaced here, high potential harm, none realized, deserves its own review even though no outage occurred. Our [use1-az4 write-up](/posts/aws-use1-az4-thermal-event-single-az-lessons) leans on exactly this section: most of the lessons came from what almost went wrong.

## Follow-through is a system, not a section

The action-item list is where good postmortems go to die. Items created in the review meeting decay within weeks unless the hygiene is real:

- **An accountable individual owner** backed by a durable owning team. "Platform team" alone owns nothing; a name with no team evaporates when that person changes roles.
- **A verifiable completion condition.** "Add monitoring" closes when someone feels like closing it. "An alert fires in staging when replication lag exceeds 30s, verified by test" closes when it is done. Say which factor the item addresses and whether it prevents, contains, detects, or speeds up response.
- **The same tracker as normal work**, so the fix visibly competes with feature work instead of losing silently.
- **Not every factor needs an action.** One high-leverage change can address three factors; a factor can be explicitly accepted. What is not acceptable is the unmarked middle where a factor is neither fixed nor owned.

Then close the loop above the single incident. A periodic pass over the last quarter's write-ups, checking which changes shipped, is cheap; the bigger payoff is **cross-incident synthesis**: tagging recurring conditions (ownership gaps, brittle deploy paths, confusing telemetry, escalation friction) and feeding the patterns into design reviews, game days, and roadmap arguments. No individual write-up shows you the pattern; the stack of them does. And "the action items closed" is not the same claim as "we learned something": a review that changed a design or a runbook succeeded even if the document is never reopened.

This is also the honest place for tooling. Incident platforms such as incident.io, Rootly, and FireHydrant capture timeline material from chat while the incident runs and track follow-ups after it, with the exact mechanics varying by product and configuration. That removes transcription and bookkeeping, which are real costs. What no tool supplies is the analysis: the false belief, the local rationality, the synthesis across incidents. Buy the bookkeeping if it helps; the learning stays manual.

## The review meeting is for questions, not for reading

If the review meeting is where attendees hear the story for the first time, the meeting becomes a read-through and the discussion never gets past clarifications. Circulate the write-up before; spend the meeting on what the document cannot settle: what made the confusing signals compelling, whether an accepted risk is actually acceptable, who else has this pattern.

The strongest predictor of a good session is a prepared facilitator running a psychologically safe inquiry, with the responders and relevant experts in the room and spectators kept few; large audiences reliably reduce candor. And the facilitator's framing matters: "what made this decision reasonable from where you sat?" opens people up; "was this decision reasonable?" convenes a jury. Pair the review loop with a sane [on-call and escalation setup](/posts/on-call-rotation-escalation-policy-guide) and the whole cycle, from page to lesson, compounds instead of resetting each quarter.

## The test

Six months from now, does anyone open the document without being told to, and can you point to a design, runbook, or decision the review changed? Write for the engineer who was not there, keep the mess that made the incident hard, and track the follow-through like it is real work, because it is. The filing cabinet is optional; the learning is the deliverable.
