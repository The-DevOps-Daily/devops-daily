---
title: 'What Can You Learn by Experimenting With AI?'
excerpt: 'Give AI one small DevOps task and see what holds up. Try four experiments with a runbook, a status update, a Kubernetes lab, or a delayed migration.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-11-16'
publishedAt: '2026-11-16T09:00:00Z'
updatedAt: '2026-11-16T12:28:38Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - AI
  - Kubernetes
  - On-Call
---

It’s 3:07 a.m. The runbook says “check the dashboard.” There are six dashboards. Which one shows whether the fix worked?

Ask AI to read that runbook as a new on-call engineer and it might spot the missing instruction in seconds. That’s useful. It can also be unsettling to watch a tool do a piece of work your team used to depend on you for. The same capability that helps an engineer can lead a company to pay for less of that engineer’s work.

The career question is real. Alongside it is a question you can test this week. **Give AI one part of a job you know, then check whether it helped.** Here are four experiments worth trying.

## Prerequisites

- A task you can check yourself and an AI tool you can use with sanitized or fictional inputs.
- A disposable Kubernetes cluster if you pick the lab.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Pick a task", "sub": "One runbook step", "icon": "server", "tone": "blue" },
    { "label": "Define success", "sub": "Name the right dashboard", "icon": "gear", "tone": "violet" },
    { "label": "Try AI", "sub": "Ask what a newcomer would miss", "icon": "cpu", "tone": "amber" },
    { "label": "Check the result", "sub": "Have a teammate follow it", "icon": "check", "tone": "green" }
  ]
}
```

## 1. Find the gaps in a runbook

**Try it.** Pick a short runbook from your [on-call rotation](/posts/on-call-rotation-escalation-policy-guide). Remove sensitive details and give it to AI with this prompt.

```text
You’re new to the on-call rotation.
Read the runbook and flag where
you’d have to guess what to check,
what healthy looks like, or when
to escalate. Quote the step that
led to each question.
```

**Check it.** Fix one gap and hand the runbook to a teammate. Can they find the right panel and tell whether the service is recovering? If AI suggests skipping a verification step, see whether the runbook explains why it’s there.

## 2. Time the work through the final draft

A project update takes thirty seconds to generate. If it takes twenty minutes to check the dates, put the events in order, and remove promises nobody made, you spent twenty minutes and thirty seconds.

Try two approaches on the same set of notes. Time each one through to a draft you’d actually send.

```tabs
{
  "tabs": [
    {
      "label": "Draft the update",
      "lang": "text",
      "code": "Draft a short project update.\nUse the notes to cover progress,\nblockers, and the next decision.\nFlag missing dates or owners."
    },
    {
      "label": "Outline the update",
      "lang": "text",
      "code": "Suggest three outlines for these\nnotes. For each, say which point\nshould lead and why.\nLeave the draft to the author."
    }
  ]
}
```

**Check it.** Compare the total time and the edits each approach needed. That tells you where to ask for help on the next update.

## 3. Test a Kubernetes explanation

**Try it.** Ask AI to explain what happens when a [readiness probe fails](/guides/introduction-to-kubernetes/03-pods-and-containers-in-kubernetes). Before touching the lab, write down two predictions.

- Will the container restart, or will the pod keep running?
- What will the [Service’s EndpointSlice](/guides/introduction-to-kubernetes/05-services-and-networking) report about that pod?

**Check it.** Make the readiness check fail in the lab and inspect the pod and its EndpointSlice. If the explanation says the container restarts, you’ve found a claim to investigate. Keep the smallest example that makes the behavior clear so you can rerun it later.

## 4. Rehearse a conversation about a delay

**Try it.** Describe a delayed migration using fictional details. Ask AI to play a colleague whose team was counting on the original date.

```text
Your team’s rollout depends on
this migration. Ask one question
at a time about the delay.
If an answer is vague, ask for
a date, an owner, or a fallback.
```

**Check it.** Write down the first question you couldn’t answer. If it’s “What can our team ship while we wait?”, you now know who to talk to before the meeting.

## What happens when the first draft gets cheap?

AI can turn notes into an [incident summary](/posts/the-postmortem-nobody-reads). It still takes someone to resolve conflicting timestamps and find out what customers actually experienced. If assembling that timeline used to teach new engineers how to investigate an outage, the team has to decide how they’ll get that practice.

Those choices matter. Knowing how to use AI can change how you do a task. It can’t decide whether your employer cuts a role, raises a quota, or invests in training.

:::tip
**Try one experiment in 20 minutes.** Pick a task already on your list, write down what a good result would look like, and give AI one part of the job. When time’s up, write down what you’d use again and what you’d check more carefully next time.
:::
