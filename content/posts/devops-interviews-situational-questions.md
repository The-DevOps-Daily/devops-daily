---
title: 'DevOps Interviews Now Test How You Decide. How to Practice Situational Questions'
excerpt: 'Fewer interviewers ask what a Kubernetes Service is. More of them describe a broken system and ask what you do first. Here is what they grade, five worked scenarios with weak and strong answers, and a way to practice making the call.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-12'
publishedAt: '2026-10-12T09:00:00Z'
updatedAt: '2026-10-12T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Interviews
  - Career
  - SRE
  - Incident Response
  - On-call
---

"What is a Kubernetes Service?" is a question you can answer from memory. "Error rates on checkout went from 0.2% to 2.5% ten minutes after your Friday deploy, and the deploy included a database migration. What do you do?" is not. Many DevOps and SRE interviews now include questions like the second one. There is no single correct answer, and the interviewer is not waiting for a specific command. They want to hear how you decide: what you check first, which risk you are willing to take, and what you tell your team while you do it.

You cannot memorize your way through that, but you can practice it. This post covers what interviewers grade in a situational question, a five-step way to structure your answer, five worked scenarios with a weak and a stronger answer for each, and a practice routine that trains the decision instead of the definition.

## TLDR

- Situational questions grade your **reasoning**, not your recall. The same final action can score well or badly depending on how you got there.
- Structure every answer the same way: **scope the problem, name your first check, pick the reversible move, say what you tell people, and say what you change afterwards.**
- Always say the **risk you accept** out loud. "I roll back, and we lose the new feature for the evening" is a stronger answer than "I roll back."
- Practice by **changing one fact and answering again.** The decision changes when the migration is destructive, when it is 3 a.m., or when the VP says no. That boundary is what interviewers probe.

## Prerequisites

- Some hands-on time with production systems. The scenarios assume you know roughly what a deploy pipeline, a Postgres primary, a Terraform plan and an AWS access key are.
- A timer and a way to record yourself. Speaking an answer out loud is a different skill from thinking it.

## What interviewers are actually grading

A situational question is a small simulation of the job. The interviewer has a rough rubric in their head, even if nobody wrote it down. Here is a version of it, with what a weak and a strong signal sound like:

| What they listen for | Weak signal                  | Strong signal                                                      |
| -------------------- | ---------------------------- | ------------------------------------------------------------------ |
| First check          | "I'd check the logs"         | Names one signal and what it rules in or out                       |
| Scope                | Jumps straight to a fix      | Asks who and what is affected, and since when                      |
| Reversibility        | Treats every action the same | Prefers the step that can be undone, and names the one that cannot |
| Risk                 | "There is no risk"           | States the cost of the chosen move                                 |
| Communication        | Fixes it alone and quietly   | Says who hears what, and when the next update is                   |
| Follow-up            | Stops at "fixed"             | Names the change that stops this class of failure                  |

Notice that none of the rows is "knows the right tool". Tools come up, but as evidence for a decision, not as the answer. A candidate who says "I'd run `kubectl rollout undo`" and stops has given a command. A candidate who says "the errors started with the rollout and only on the new pods, so I undo the rollout first, because it takes a minute and can be redone" has given a decision.

## A structure that works for any scenario

You do not need a framework with a clever acronym. You need the same five moves every time, so the interviewer can follow you and you do not forget the communication part under pressure.

```diagram
{
  "type": "loop",
  "nodes": [
    { "label": "Scope", "sub": "who, what, since when", "variant": "soft" },
    { "label": "First check", "sub": "one signal, and why", "variant": "soft" },
    { "label": "Decide", "sub": "reversible move first", "variant": "accent" },
    { "label": "Communicate", "sub": "who hears what, next update", "variant": "soft" },
    { "label": "Follow up", "sub": "fix the class, not the case", "variant": "soft" }
  ],
  "loopBack": "new evidence changes the decision",
  "goal": "Say the risk you accept out loud"
}
```

1. **Scope.** Restate the problem with the facts you have, and ask for the ones you need. "How many users? Is it one region? Did anything change in the last hour?" Asking is not stalling. It is the first thing a good on-call engineer does.
2. **First check.** Name one specific thing you look at first and what each result would mean. Good first checks split the problem in half: "if the spike starts with the rollout, the deploy is the main suspect; if it started before, I look elsewhere first."
3. **Decide.** Pick the move that reduces harm fastest and can be undone. Rollbacks, feature flags, scaling up and failing over are usually reversible. Deleting data, dropping replication slots and force-pushing are not. If you choose an irreversible step, say why the alternative is worse.
4. **Communicate.** Say who you tell, what you say, and when the next update is. Write the actual message if you can. Interviewers notice when candidates forget this, because in real incidents the silence is often what makes it worse.
5. **Follow up.** Say what you change so this does not happen again: a test, an alert, a guardrail in the pipeline, a runbook. This is usually where senior answers separate from junior ones.

:::tip
When new information arrives, say so and go back through the loop: "If the migration turns out to drop a column, the rollback is no longer safe, so I would switch to fixing forward." Interviewers often add a twist on purpose to see whether you update your decision or defend your first one.
:::

## Five scenarios, worked through

Each scenario below has a short weak answer and a stronger one. The stronger answers are not the only right answers. They are examples of reasoning that would score well, and the point of each is the decision and its trade-off, not the specific commands.

### 1. The Friday deploy

> You deployed checkout v2.31 at 16:40. By 16:50 the 5xx rate on checkout is 2.5%, up from 0.2%. The release also ran a database migration. What do you do?

**Weak answer:** "I'd look at the logs, find the bug and fix it." Or: "Roll back immediately."

**A stronger answer:**

1. **Scope:** Is it all checkout requests or one endpoint? Did the error rate jump at the moment the new pods went live? Are payments failing, or only something cosmetic?
2. **First check:** Compare the error graph with the rollout timeline and split errors by version. If the old pods are clean and the new ones fail on the same traffic, the release is the main suspect.
3. **Decide:** The key question is the migration. If it only added a nullable column or a new table, and the old code works with the new schema and with any rows the new code has already written, I roll back the application and leave the migration in place. If the migration dropped or renamed a column the old code needs, a rollback makes things worse, so I fix forward, or turn the feature off behind its flag if the flag really avoids the broken path.
4. **Risk I accept:** Rolling back loses the new feature until Monday and may annoy the team that wanted it out. That is cheaper than a weekend of failed checkouts.
5. **Communicate:** In the incident channel: "Checkout errors at 2.5% since the 16:40 deploy of v2.31. Rolling back the app now; the migration stays because it is additive. Next update 17:15." Then tell support, because they will get the customer emails first.
6. **Follow up:** Why did the canary or the staging run not catch it? Should migrations follow an expand-and-contract sequence, so the previous release always works with the current schema?

### 2. The database disk is almost full

> The primary Postgres instance is at 95% disk and growing by about 1% every ten minutes. What do you do?

**Weak answer:** "I'd delete old files to free up space."

**A stronger answer:**

1. **Scope:** At this rate there are about 50 minutes left. What happens at 100%? Writes fail, and Postgres may shut down. That makes this urgent but not a reason to act blindly.
2. **First check:** What is growing? The usual suspects are WAL files held back by a replication slot whose replica is down, a long-running query writing temp files, a runaway table or log, or a bulk import. `pg_replication_slots` and the size of the WAL directory answer the first question quickly.
3. **Decide:** Buy time with a safe move first. On many managed databases and cloud disks you can grow storage online; on a self-managed disk you also have to extend the filesystem. Check that the resize will finish before the disk fills. Growing is one-way (you usually cannot shrink it back), but it does not risk the data. I do not delete files I do not understand: deleting WAL by hand can corrupt the database.
4. **The trade-off they are fishing for:** If an inactive replication slot is holding the WAL, dropping it lets Postgres remove that WAL at the next checkpoints. But whatever used the slot (a replica, or a logical replication or CDC consumer) may no longer be able to catch up and may need a rebuild or a resync. That is a real decision: I find out who owns the slot, drop it only if the disk cannot grow in time, and say so out loud.
5. **Communicate:** Tell the database owner and the teams whose writes would fail, with the time left and what I am doing. Update when space is secured.
6. **Follow up:** An alert on disk growth rate, not only on percentage. An alert on replication slot lag. A runbook for this exact case.

### 3. The Terraform plan that replaces production

> The release pipeline is blocked on a Terraform plan. It shows `-/+ destroy and then create replacement` for the production RDS instance. The release manager asks you to approve it so the release can go out.

**Weak answer:** "The plan is what the code says, so I'd approve it."

**A stronger answer:**

1. **Scope:** A `-/+` replacement destroys the existing database before it creates the new one. Unless a restore and a cutover are planned, that means downtime and probably data loss. That is not a routine change, whatever the pipeline says.
2. **First check:** Read which attribute the plan marks with `# forces replacement`. Some attributes cannot change in place, so changing them forces a new instance. I also check the rest of the plan: if someone renamed the resource or moved it into a module, Terraform shows a destroy at the old address and a create at the new one instead.
3. **Decide:** Do not approve. If it is a rename or a refactor, the fix is a `moved` block (or `terraform state mv`) so Terraform knows it is the same resource. If the attribute really cannot change in place, that becomes a planned migration with a snapshot, a restore and a maintenance window, not a pipeline click.
4. **Risk I accept:** The release is late, and the release manager is unhappy. I can live with that. I cannot undo a destroyed production database.
5. **Communicate:** Tell the release manager directly: "The plan would replace the production database because of X. I am blocking it; the fix is a `moved` block, and I expect to have a clean plan in an hour."
6. **Follow up:** Add `lifecycle { prevent_destroy = true }` to stateful resources. It only protects a resource while its configuration exists, so also make the pipeline fail on any plan that deletes or replaces a resource tagged as stateful.

### 4. A leaked cloud key

> A developer pushed an AWS access key to a public GitHub repository 20 minutes ago. What do you do?

**Weak answer:** "Remove the commit from the history and force-push."

**A stronger answer:**

1. **Scope:** Public repositories are scanned for keys within minutes, so assume it has already been copied, and treat it as a security incident from the start. Removing the commit does not help with that.
2. **First check:** Which identity does the key belong to, and what can it do? I start a CloudTrail search for its use across accounts and regions, knowing that events arrive with a delay and that a clean result does not prove the key was not used.
3. **Decide:** Deactivate the key now, even though something that depends on it will break. This is the case where the disruptive move is the right one, because the alternative is an attacker with unknown access for an unknown time. Then I check whether anyone used it to create other credentials, roles or temporary sessions, because deactivating the key does not cancel temporary credentials already issued with it.
4. **Risk I accept:** The service using that key goes down until it has a new credential. I say that before I do it, not after.
5. **Communicate:** Tell security and the owner of the affected service right away, and follow the security incident process.
6. **Follow up:** Secret scanning on push, short-lived credentials (for example OIDC federation from CI instead of stored keys), and a check of what else that identity could reach.

### 5. Pressure to skip a check

> A release is promised to a customer today. The security scan in the pipeline fails on a dependency, and the release manager asks you to disable the scan so the release can ship.

**Weak answer:** "I'd disable it, ship, and fix it next sprint." Or: "Absolutely not, security comes first."

**A stronger answer:**

1. **Scope:** What exactly is failing? A known exploitable vulnerability in code we actually call is very different from a low-severity finding in a test-only dependency, or a flaky scanner.
2. **First check:** Read the finding: severity, whether the vulnerable path is reachable, and whether a patched version exists.
3. **Decide:** Do not silently turn the scan off. If the finding is real and reachable, try a patched version first; if there is none, ship without the affected feature, but only if that really removes the vulnerable code from the build. If it is low risk or a false positive, use a documented, time-limited exception for that one finding, with an owner and an expiry date, instead of disabling the whole check.
4. **Risk I accept:** With an exception, we knowingly carry one finding for a few days. That is acceptable only if the risk is assessed, someone with the authority to accept security risk approves it, and it has an owner and an expiry date.
5. **Communicate:** Put the decision and who approved it in writing, in the ticket or the release notes. Interviewers listen for this, because unrecorded exceptions are how temporary bypasses become permanent.
6. **Follow up:** Review why a release promise was made without time for the pipeline to pass, and make exceptions expire automatically.

## How to practice making the call

Reading good answers helps a little. Saying your own answers out loud, under a time limit, helps a lot more. A routine that works:

1. **Build a deck of scenarios.** Write 20 short prompts from your own incidents, from public postmortems, and from the questions above. Keep each one to three or four sentences, like a real interviewer would.
2. **Answer out loud in three minutes.** Use a timer and record yourself. Three minutes forces you to pick a first check instead of listing ten.
3. **Score yourself with the rubric table.** Did you scope? Did you name one first check and what it rules out? Did you say the risk you accept? Did you write the update message? Most people find they skip communication and follow-up.
4. **Change one fact and answer again.** This is the most useful step. Make the migration destructive. Make it 3 a.m. and you are alone. Make the VP say "do not roll back". If your answer does not change when the facts change, you are reciting, not deciding.
5. **Practice with someone who pushes back.** A friend or colleague who interrupts with "the logs show nothing, now what?" is closer to a real interview than any list of questions.
6. **Write the message, literally.** For each scenario, write the two-line update you would post in the incident channel. It takes thirty seconds and it is the part most candidates forget.

You can also practice parts of this in tools that put you under time pressure. The [incident commander simulator](/games/incident-commander-simulator) makes you triage and decide while the impact grows. The [interview questions practice mode](/interview-questions/practice) has scenario-style questions on topics like [incident postmortems](/interview-questions/senior/incident-postmortem) and [progressive delivery rollbacks](/interview-questions/senior/progressive-delivery-rollback-strategy), and the [on-call rotations flashcards](/flashcards/on-call-rotation-escalation-policy) cover the vocabulary. If you want feedback on full written answers, the mock interviews on [DevOps Daily Pro](https://learning.devops-daily.com) ask a follow-up question about your answer, the way a real interviewer would.

:::note
If you are the one running interviews, the same structure works in reverse. Give a short scenario, let the candidate scope it, then change one fact halfway through. The way they update their decision tells you more than any definition question.
:::

## Summary

Situational questions are not a trick. They are a way to watch you work without a real outage. The interviewer wants to see you scope the problem, pick a first check that splits it in half, choose the move you can undo, say the cost of that choice, tell the right people, and fix the class of failure afterwards. You get better at that the same way you get better at incidents: by making the call many times, with the facts changing each time. Build a small deck, answer out loud against a timer, change one fact and answer again. Practice until you use the structure without thinking about it, so in the interview you can think about the problem instead of about how to sound senior.
