---
title: 'The Postmortem Nobody Reads, and the One They Do'
excerpt: 'Most incident write-ups are compliance artifacts: written once, filed, and never opened again. The difference between those and the postmortems engineers actually forward to each other comes down to a handful of choices about audience, structure, and follow-through.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-25'
publishedAt: '2026-08-25T09:00:00Z'
updatedAt: '2026-08-25T09:00:00Z'
readingTime: '10 min read'
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

Every engineering org above a certain size produces incident write-ups. Very few produce ones anyone reads twice.

You know the artifact: a template in Confluence or Notion, filled in three days after the incident by whoever was unlucky enough to hold the pager. A timeline pasted from Slack. A "root cause" section containing one sentence. Five action items, two of which are "add monitoring." It gets linked in a channel, skimmed by a manager, and never opened again. The next incident, sometimes the same incident, happens six months later to a team that had no idea the document existed.

Then there is the other kind. The write-up that gets forwarded between teams, quoted in design reviews a year later, and shows up in onboarding docs. GitHub's outage reports and the classic Cloudflare deep-dives get read by people who do not even use those products. The gap between the two kinds is not writing talent. It is a short list of structural choices, and they are learnable.

## TL;DR

- Most postmortems fail because they are written **for the filing cabinet**: the implicit audience is a compliance checkbox, not a future engineer with a decision to make.
- The readable ones are built around **a surprise**: the specific belief the team held that turned out to be false. No surprise, no reader.
- **Timelines are evidence, not narrative.** Lead with the story and the lesson; attach the minute-by-minute log for the people who need it.
- Replace the single **root cause** with contributing factors, and say plainly **where you got lucky**, which is where the next incident is hiding.
- Action items decay unless they have owners, dates, and someone tracking them; an untracked action item is a wish.
- Write for the engineer who was not there, one year from now, on a different team. Everything else follows from picking that reader.

## Prerequisites

- You have been part of at least one incident and its aftermath
- Your team runs some form of incident review, however informal
- No tooling required, though we touch on where it helps

## Why the default postmortem is unreadable

Start with an uncomfortable question: who is the write-up for? In most orgs, the honest answer is "the process." The template exists, the incident happened, therefore the template must be filled. The author's goal, consciously or not, is completion, and every section gets exactly the minimum that lets the meeting end.

That produces recognizable symptoms:

- **The timeline-as-narrative.** Forty lines of `14:02 - alert fired`, `14:07 - X joined the call`. A timeline is evidence. Making it the body of the document forces every reader to reconstruct the story themselves, and nobody does.
- **The one-sentence root cause.** "Root cause: misconfigured health check." That sentence is where the interesting part *begins*: why was it misconfigured, what made the misconfiguration invisible, what did the team believe about it that was wrong?
- **Blameless theater.** The org adopted blameless language without the substance, so the document carefully avoids naming anything at all: no decisions, no assumptions, no "we believed X." What remains is passive-voice fog: "an error was introduced." Blameless means you do not punish people for decisions that made sense at the time. It does not mean the decisions go unexamined; the decisions are the entire content.
- **Action-item confetti.** A list generated in the last five minutes of the review meeting, unowned, undated, unfollowed. Six months later, half are done by accident and nobody can say which.

None of this is malicious. It is what you get when the deliverable is "a document exists" rather than "someone learns something."

## The one they do read

Flip the audience. The readable postmortem is written for a specific person: **an engineer who was not in the incident, reading it a year later, because they are about to touch the same system.** That reader does not care who joined which call at 14:07. They have three questions:

1. What did the team believe that turned out to be false?
2. How did the system actually behave, and why was that surprising?
3. What would I need to know to not do this again?

Everything good about the format follows from serving that reader.

### Lead with the surprise

Every incident worth writing up contains a moment where reality disagreed with the team's mental model. The retry logic everyone trusted amplified the load instead of shedding it. The failover that had been tested quarterly depended on a DNS TTL nobody knew about. The [GitHub outage](/posts/github-2-9-billion-monthly-commits-outage) write-ups are compelling for exactly this reason: they name the assumption before showing its collapse.

Open with that. One paragraph: what we believed, what was actually true, what it cost. If you cannot find the surprise, you have not finished investigating; "we understood the system perfectly and it broke anyway" is almost never the honest summary.

### Structure as story, attach the evidence

A shape that consistently works:

```text
1. Summary        - 3 sentences: impact, duration, the surprise
2. Background     - the 2 paragraphs of context the outside reader needs
3. What happened  - the story, in prose, with the wrong turns included
4. Why it happened- contributing factors, plural (see below)
5. Where we got lucky
6. What changes   - each item: owner, date, and the factor it addresses
7. Appendix       - the full timeline, graphs, links to dashboards
```

The wrong turns matter more than the fix. The forty minutes spent restarting the wrong service *because its dashboard happened to look scary* teaches the reader how diagnosis actually failed, which is usually more valuable than the eventual cause. Write-ups that sand off the confusion read like the team teleported from alert to answer, and teach nothing about the part of incidents that is actually hard.

### Contributing factors, not root cause

"Root cause" implies the incident was a chain with one first link. Real incidents are a lattice: a latent bug, plus a config that widened the blast radius, plus a gap in alerting, plus a deploy at the wrong time. Pick any one "root" and the others stay armed, waiting for a different trigger.

Listing four contributing factors instead of one root cause does something subtle: it makes the follow-up list honest. Each factor either gets an action item or an explicit "accepted risk" label. The single-root-cause format lets the other three factors quietly disappear.

### Say where you got lucky

The most underused section in incident writing. The outage lasted 40 minutes, but only because the one person who knew the replication topology happened to be awake. The corrupted batch stopped at 3 percent of users because a rate limit, added for an unrelated reason, held.

Luck is a list of incidents you have not had yet. Writing it down converts near-misses into the cheapest learning available, and it is the section experienced engineers flip to first, because it is where the honesty lives. Our [use1-az4 write-up](/posts/aws-use1-az4-thermal-event-single-az-lessons) leans on exactly this: most of the lessons came from what almost went wrong.

## Follow-through is a system, not a section

The action-item list is where good postmortems go to die. The pattern is well documented: items created in the review meeting decay within weeks unless three things are true:

- **Each item has one owner**, not a team name. "Platform team" owns nothing.
- **Each item has a date and lives in the same tracker as normal work.** A wiki list is not a backlog; if the fix competes with feature work, it must be visible in the same place feature work lives.
- **Someone re-reads old incidents.** A monthly pass over the last quarter's write-ups, checking which "what changes" items shipped, is the single cheapest reliability practice we know of. It also surfaces repeat patterns that no individual incident shows.

This is the one place where tooling genuinely earns its keep. Purpose-built incident platforms like incident.io, Rootly, and FireHydrant automate the mechanical parts: capturing the timeline from Slack while the incident runs (so the appendix builds itself instead of consuming an afternoon), nagging action-item owners, and reporting which follow-ups actually closed. Tooling does not make anyone write a better narrative, and none of it rescues a write-up with no surprise in it. But removing the transcription grind is often the difference between a review that happens and one that gets skipped, and follow-up tracking is precisely the kind of work humans reliably drop.

## The review meeting is for questions, not for reading

A quick word on the meeting, because it shapes the document. If the review meeting is where attendees hear the story for the first time, the meeting becomes a read-through and the discussion never gets past clarifications. The write-up should circulate before; the meeting is for the questions the document cannot answer: was this decision reasonable, is that accepted risk acceptable, who else has this pattern?

The meeting also has a tell that predicts document quality: whether anyone senior asks "what did we believe beforehand?" Teams where that question is normal produce readable postmortems almost automatically, because everyone knows the narrative will be examined, not filed. Pair this with a sane [on-call and escalation setup](/posts/on-call-rotation-escalation-policy-guide) and the whole loop, from page to lesson, starts compounding instead of resetting each quarter.

## Summary

- Pick the reader first: an engineer who was not there, a year later. Write everything for them.
- Open with the surprise, the false belief, not the timeline. Timeline goes in the appendix as evidence.
- Contributing factors, plural, each one either addressed or explicitly accepted. Retire the single root cause.
- Keep the wrong turns in the story; sanded-smooth narratives teach nothing.
- Add a "where we got lucky" section and treat it as a list of future incidents.
- Action items need an owner, a date, a home in the real backlog, and a monthly re-read. Tooling helps with the mechanics; it cannot supply the surprise.

The test for whether it worked is simple: six months from now, does anyone open the document without being told to? Write for that, and the answer starts being yes.
