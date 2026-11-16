---
title: 'What Can You Learn by Experimenting With AI?'
excerpt: 'Try AI on a runbook, a project update, a Kubernetes lab, or a difficult meeting. See where it helps while taking the fear of job loss seriously.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-11-16'
publishedAt: '2026-11-16T09:00:00Z'
updatedAt: '2026-11-16T09:00:00Z'
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

“Could AI replace part of your job?” is a reasonable question. If you’ve spent years learning how to troubleshoot systems, write reliable automation, or explain incidents, it can be unsettling to watch a tool produce something that looks like your work in seconds. A team might be expected to handle the same workload with fewer people. A client might stop paying for work they think they can do themselves. When your livelihood is involved, being told to “just embrace AI” can feel like someone is brushing off the question.

There’s another question you can investigate on a smaller scale. What could you learn by trying AI on a task you already know how to do?

## Prerequisites

- An AI tool you can use for the task and a copy of the material with sensitive details removed.
- A disposable Kubernetes environment if you want to try the readiness probe experiment.

## Review a runbook

Start with a runbook your team uses. Give AI a version with sensitive details removed and ask it to read the instructions as an engineer on their [first on-call shift](/posts/on-call-rotation-escalation-policy-guide). Where would they get stuck? It might flag that step three tells the reader to check a dashboard without saying which panel to open or what a healthy result looks like. It might also suggest combining two steps your team keeps separate so someone can verify the state of the system before moving on. Both responses give you something to work with. Add the missing detail, explain why the steps are separate, and ask a teammate who’s new to the rotation to try the revised runbook.

## Measure the time it takes to finish

You can also test whether AI saves time on work that’s easy to underestimate. Take a project update you’d normally write from a page of rough notes. Ask AI for a draft and keep track of how long it takes to get to a version you’d actually send. Count the time spent checking dates, fixing the order of events, and rewriting sentences that imply more certainty than the team has. On the next update, ask for three possible outlines and write the text yourself. That comparison can tell you which part of the work you’d want help with next time.

## Test an explanation in a lab

A small lab can help you learn something unfamiliar. Say you can read a Kubernetes manifest but still get tripped up by what happens when a [readiness probe fails](/guides/introduction-to-kubernetes/03-pods-and-containers-in-kubernetes). Use a disposable environment and ask AI to walk through a minimal example. Before changing anything, predict what you should see in the pod status and the [Service’s endpoints](/guides/introduction-to-kubernetes/05-services-and-networking). Then make the probe fail and check both. If the explanation falls apart, you have a specific discrepancy to look up in the documentation. If it holds up, you’ve got a reproducible example you can revisit the next time a pod is running but receiving no traffic.

## Rehearse a difficult conversation

Some experiments are about getting practice you rarely get on the job. Before a meeting about a delayed migration, ask AI to play the part of a colleague whose team was counting on the original date. Have it ask one question at a time, and answer each as you would in the meeting. You might discover you can explain what caused the delay but have no answer for what the other team should do in the meantime. That gives you time to talk to the people involved and work out what can still move forward.

## What changes when work gets automated

The same capability can make AI useful to an engineer and make some of that engineer’s work easier to automate. A tool that helps write the first version of an [incident summary](/posts/the-postmortem-nobody-reads) may also lead a manager to assume summaries now take a few minutes. Assembling a timeline from notes is one part of the job. Figuring out why two timestamps disagree or checking what customers experienced can still take careful work. If the first pass was also how newer engineers learned to reconstruct an incident, the team has to decide where they’ll get that practice. Knowing how to use AI gives you more say in how you approach a task. Staffing decisions and training opportunities still depend on what the organization chooses to do.

## Pick one small experiment

That’s a good reason to keep the experiments small enough to judge. Pick a task with a result you can check and leave room for the possibility that your usual process works better. If AI helps, get specific about where. “It caught a missing prerequisite in the runbook” is something a teammate can try for themselves. “It wrote the runbook in thirty seconds” tells them very little about whether they could follow it at 3 a.m.

The next time the question of being replaced comes up, it may still feel just as urgent. There’s room alongside it for a twenty-minute experiment. Pick one thing already on your list, decide what a good result would look like, and try a different way of getting there. By the end, you’ll have something concrete to go on when that task comes around again.
