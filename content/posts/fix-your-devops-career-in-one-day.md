---
title: 'Fix Your DevOps Career in One Day'
excerpt: 'Not a five-year plan. Eight things you can finish between breakfast and dinner, ordered by how much they change what happens to you next month, with the evidence for why each one is on the list.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-18'
publishedAt: '2026-08-18T09:00:00Z'
updatedAt: '2026-08-18T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Career
  - DevOps
  - Interview
  - Hiring
---

Most career advice for engineers is a five-year plan you will not follow. Learn Kubernetes properly. Contribute to open source. Build a personal brand. All defensible, all impossible to start on a Tuesday evening, and all of it quietly assumes the problem is that you lack skills.

Often it is not. Often the problem is that a filter drops you before a human reads anything, or you cannot describe what you actually did, or the one thing you own has no name attached to it inside your own company.

Those are one-day problems. This is a list of eight, ordered by how much they change what happens to you in the next month rather than the next five years. Several come from things we measured rather than things that sound right, and where that is the case the evidence is linked.

Do the first three even if you do nothing else. They take an afternoon between them.

## TLDR

- **The synonym check is the highest-value 20 minutes** in this list. A plain keyword filter rejected a strong engineer for writing OpenTofu instead of Terraform.
- **Buzzword padding is theatre.** A 30-item skills list did not improve scores in our test. Exact nouns from the posting do.
- **Write the three-boundary story.** Interviewers are testing whether you debug boundaries or brands.
- **Name one thing you own** and tell someone. Most engineers have no answer to "what are you the person for?"
- **Fix your on-call answer.** It is the question candidates lose on and the one they never prepare.
- Career breaks cost points on **six of eight models** we tested. That is worth knowing before you explain yours.

## Prerequisites

- A current CV, even a bad one
- Two or three job postings you would genuinely apply to
- One uninterrupted afternoon

## 1. The synonym pass, 20 minutes

Start here because it is the cheapest thing on the list with the largest failure mode.

When we [tested how AI screens DevOps resumes](/posts/ai-resume-screening-devops-what-i-measured), the models were reasonable. They ranked strong, mid and weak candidates correctly, and swapping tool names for equivalents barely moved the score. Then a plain keyword-and-knockout filter, the kind that runs *before* any model, rejected the same engineer outright for writing OpenTofu where the posting said Terraform.

That filter cannot reason. It matches strings. So the job is to make sure the strings match.

Open the three postings. For every tool, write down the exact form they use. Then make sure your CV contains that exact form, alongside whatever you actually use:

```text
Terraform (and OpenTofu)
Docker (and Podman)
GitHub Actions (previously Jenkins)
Kubernetes / K8s
CI/CD  ← spell it both ways, some filters match "CI/CD", some "CICD"
```

Write years as numerals. "5 years" and "five years" are different strings to a regex, and only one of them is what the pattern is looking for.

This is not keyword stuffing. Stuffing is a 30-item skills list, and we measured that too: it did nothing. This is making sure the words you already earned are written in the form the machine is looking for.

:::tip
Do this per application, not once. It takes two minutes when you already have the list, and the posting's exact vocabulary is the only vocabulary that matters for that application.
:::

## 2. The three-boundary story, 60 minutes

Every DevOps interview eventually asks a version of: something is broken, walk me through it. Most candidates answer with tools. "I'd check the logs. I'd look at Kubernetes."

That answer is weak because it is a list of places, not a method. Under pressure it turns into clicking around hoping something turns red.

Write out three incidents you were actually part of, in this shape:

```text
1. What the user saw          "checkout returned 502s, dashboards all green"
2. What you thought first     "green dashboards means health checks test
                               something different from what users do"
3. How you narrowed it        "walked the request path: DNS, LB, ingress,
                               service, pod, dependency, until it stopped"
4. What it turned out to be   "readiness probe hit /health, which did not
                               touch the database the request needed"
5. What changed after         "probe now exercises the dependency; added an
                               alert on 5xx rate rather than pod status"
```

Step 3 is the one being graded. Interviewers are not checking whether you know what a service mesh is, they are checking whether you narrow systematically or guess. Step 5 is the one that separates senior answers: junior engineers fix the incident, senior engineers change the thing that let it happen.

If you cannot fill in step 5 for any of your three, that is genuinely useful information about your current role.

## 3. Fix your on-call answer, 30 minutes

Almost nobody prepares this and it comes up in nearly every interview, in both directions.

**When they ask you:** they want to know whether you have carried a pager and what you learned. "Yes, one week in four" is a fact, not an answer. Have one specific thing you changed because of on-call: an alert you deleted because it never meant anything, a runbook you wrote after being paged twice for the same thing, a threshold you moved.

Deleting a noisy alert is a genuinely strong answer, and it is one that people undersell because it feels like removing work rather than doing it.

**When you ask them,** and you should ask: how many people are in the rotation, what got paged last month, and what happens when someone is on holiday. A rotation of three is a different job from a rotation of ten. Most candidates find this out in week two of the new job, which is the worst possible time.

## 4. Name the one thing you own, 30 minutes

Ask yourself what you are *the* person for at your company. Not what you work on. What breaks and someone says your name.

A surprising number of experienced engineers cannot answer this, and it is the single biggest difference between people whose careers compound and people who stay level for four years while being very busy.

If you have an answer, say it out loud to your manager this week. "I want to be the person who owns our deployment pipeline" is a sentence that changes what work comes to you.

If you do not have one, pick something small, currently unowned and irritating enough that people complain about it. The flaky test suite. The Terraform module nobody understands. The alert that fires every Sunday. Own it publicly, fix it, and you now have an answer, a story for section 2, and a reason to be in the room next time it is discussed.

## 5. Write the internal README, 45 minutes

Pick the most confusing thing in your infrastructure and document it. Not comprehensively, just the part that costs people an hour whenever they meet it.

This is on the list for three reasons. It is the fastest way to become the person who understands that system, because writing it down is how you find out you did not. It is visible in a way that ordinary work is not. And it is one of the few artefacts you can point at in a performance review that is unambiguously yours.

Keep it to one page. The five-page version does not get written, and the one-page version gets read.

## 6. Update your CV while you still have the details, 45 minutes

Not a rewrite. Add the last six months while you still remember the numbers, because in a year you will not.

For each thing you did, write it in this shape:

```text
Weak:    "Responsible for CI/CD pipelines"
Better:  "Owned the CI pipeline for 40 engineers"
Best:    "Cut CI wall time from 22 to 9 minutes by splitting the test
          suite and caching dependencies, for 40 engineers"
```

The difference is not writing skill, it is whether you kept the numbers. Go and get them now: your CI dashboard, your incident tracker, your cloud bill. Twenty minutes of digging gives you a year of specifics.

One honest note on scope. Say what *you* did. "We migrated to Kubernetes" tells a reader nothing about you. "I moved 12 of our 30 services, and wrote the migration guide the rest of the team used" does, and is checkable.

## 7. Decide what you are aiming at, 30 minutes

DevOps splits into paths that look similar from inside and are quite different jobs: platform engineering, SRE, cloud infrastructure, security, and the generalist who does all of it at a smaller company.

You do not need to commit for five years. You need to know which one you are aiming at *this year*, because it changes what you say yes to. Someone aiming at platform engineering should be taking the internal-tooling work. Someone aiming at SRE should be taking the on-call and reliability work. Both are "DevOps" and they compound in different directions.

We wrote about the five paths [here](/posts/devops-engineer-career-paths-next-five-years) if it helps to see them side by side. The point of this half hour is one sentence: "this year I am aiming at X, so I will take more Y work."

## 8. If you have a career break, decide how you handle it

This one is uncomfortable and it is on the list because we measured it rather than assumed it.

In our resume test, adding a 14-month caregiving break to an otherwise identical CV **cost points on six of the eight models**, from 1.0 up to 7.6 out of 100. Same person, same experience, same everything else. The break was the only difference.

That is not a reason to hide it, and hiding gaps tends to fail anyway. It is a reason to not leave the reader to fill in the blank themselves. A single line stating the period and, if you did anything technical during it, what you kept current, removes the ambiguity the scoring was punishing.

Worth being clear about what this finding is: evidence that the systems in the pipeline treat breaks as a signal. It is not an endorsement of that. If you are on the hiring side of this, the actionable version is to check whether your own screening does the same thing, because it very likely does and nobody has looked.

## What this list deliberately leaves out

No certifications. Not because they are worthless, but because they are not a one-day task and their return varies enormously by market and employer.

No personal brand, no posting cadence, no side project. Those are multi-month commitments and they are what most articles like this recommend precisely because they sound impressive rather than because they are the binding constraint.

The binding constraint, for most people who feel stuck, is one of the first four things on this list. A filter rejecting you on a synonym. Not being able to tell the story of your own work. Nobody knowing what you own.

## The afternoon version

If you only have a few hours:

| | Task | Time |
| --- | --- | --- |
| 1 | Synonym pass against three real postings | 20 min |
| 2 | Write three boundary stories | 60 min |
| 3 | One specific on-call answer, and three questions to ask | 30 min |
| 4 | Name the thing you own, tell one person | 30 min |

Under three hours, and it addresses the reasons people are actually stuck rather than the reasons that are pleasant to talk about.

## FAQ

**Can you really fix a career in a day?**
No, and the title is doing some work. What you can fix in a day is the set of avoidable failures sitting between your actual ability and the outcomes you are getting. That is usually the gap, not the ability.

**Is the keyword thing still true with AI screening everywhere?**
It is more true, because the models are the second reader. In our test the model was the fair part: it ignored tool synonyms and buzzword padding and ranked candidates sensibly. The dumb keyword filter that runs before it is what rejected a strong engineer over OpenTofu.

**I have done all eight. Now what?**
Then your constraint is genuinely skills or scope, and the multi-month advice becomes the right advice. Depth in one area beats familiarity with ten, and the fastest depth is owning something in production that pages you.

**Should I list every tool I have touched?**
No. We measured a 30-item skills list and it did not help. Exact nouns from the posting, plus depth on the handful you can actually be interviewed on.
