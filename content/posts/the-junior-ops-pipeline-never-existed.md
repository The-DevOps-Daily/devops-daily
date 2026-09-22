---
title: 'The Junior Ops Pipeline Did Not Collapse. It Never Existed.'
excerpt: 'Junior developer hiring is reportedly down 60 to 70 percent since 2022. We counted fifteen years of job postings to see what happened to entry level operations roles, and found something stranger: there were never any to lose.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-22'
publishedAt: '2026-09-22T09:00:00Z'
updatedAt: '2026-09-22T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Career
  - SRE
  - Hiring
  - Data
---

The story going round is about developers. Junior job postings down 60 to 70 percent since 2022. Stanford research showing a 20 percent employment drop for developers aged 22 to 25. AI ate the boilerplate, the CRUD endpoints and the routine tickets, which is exactly the work that used to teach people how to build software.

It is a good story and the developer numbers are real. The obvious next question is what it means for operations, and the obvious way to answer it is to take those figures and change the job title.

Do not do that. We counted, and operations has a different problem. A worse one, and much older.

## TLDR

- We parsed **92,195 job postings** from every monthly Hacker News "Who is hiring?" thread, March 2011 to September 2026.
- **3,386 of them were operations roles.** SRE, DevOps, platform, infrastructure, sysadmin.
- **17 asked for a junior.** That is **0.50 percent**, across fifteen years.
- The rate never rose above 1.1 percent in any year, including the 2021 hiring boom. It was **zero** in 2016, 2021, 2024 and 2025.
- Operations demand is fine. Ops is 5.4 percent of all postings this year against 6.4 percent in 2019. **The jobs exist. The bottom rung does not, and never did.**
- So "AI removed the entry level" cannot be the explanation here. The entry level was already missing when the boom was on and hiring managers were taking anyone with a pulse.
- We checked the other side too: **36,202 candidate postings** from the matching "Who wants to be hired?" threads. **Eleven juniors asked for operations work in twelve years.** Nobody is offering, and almost nobody is asking.

## Where the data comes from

Hacker News runs a "Who is hiring?" thread on the first working day of every month. Each top level comment is one company's posting. The threads go back to March 2011, the format has barely changed, and every word is public and addressable through the API.

That matters because the usual sources report an index. An index tells you a number went down. It cannot tell you whether a posting wanted a junior, because somebody else already decided what the categories were.

Here the raw text is available, so the question "does this posting want a junior" is one we answer ourselves and you can check.

**What this dataset is not** is a census. It is startups and small companies, skewed to the US and remote, and a company posting there is already unusual. A big bank hiring forty graduate operations engineers will never appear. What it is good for is a long series measured exactly the same way for fifteen years, which is what a claim about change over time needs.

```terminal
{
  "title": "collecting the postings",
  "prompt": "$",
  "steps": [
    { "cmd": "node fetch-threads.mjs", "output": "186 monthly threads, 2011-03 to 2026-09" },
    { "cmd": "node fetch-postings.mjs", "output": "92195 postings collected" },
    { "cmd": "node classify.mjs", "output": "92195 postings, 21195 without a parseable role segment (23%)" }
  ]
}
```

## How a posting gets classified

This is the part that decides the answer, so it is written down rather than summarised.

HN postings follow a convention: `Company | Role | Location | Type`. The role is the second field. Classification reads **only that field**, for both the role and the seniority.

That restraint matters more than it sounds. Consider a real posting from the dataset:

```text
SendGrid | Sr. Software Engineers (Security, Platform, Test, and DevOps) and more!
```

A naive search of the whole posting for "DevOps" and "senior" counts that as a senior ops role. It is four roles in a trench coat, and only part of one of them is operations. Reading the role field keeps that honest, and postings that do not follow the convention are counted separately rather than guessed at.

How many that is depends entirely on the era, which matters for reading the charts:

```text
2011-2014    97% unparseable    the convention barely existed
2015-2019    17% unparseable
2020-2026     7% unparseable
```

That is why the charts start in 2015. Before that we are excluding almost everything and whatever is left is not a sample of anything.

### Checking what the method throws away

Two ways this could be wrong, both tested rather than assumed.

**Does the regex miss junior ops roles that do not use the word?** A posting could want an entry level person and never say "junior". So we sampled 25 operations postings that did **not** match, and read their bodies for entry level language of any kind. One matched, and it read:

```text
This is not an entry-level DevOps position; this role requires
senior-level skills
```

A true negative, found by looking for the opposite. Zero of 25 were missed junior roles.

**Do the excluded postings hide them?** The ones that do not follow the convention have a higher junior ops rate, 1.73 percent against 0.50, which would matter a lot if it were spread evenly. It is not. Sixteen of the twenty one are from 2012 to 2014, when 97 percent of postings were unparseable and which the charts already exclude. From 2015 onward there are five, and reading them, three are the same company posting "hiring in many roles" and one lists a DevOps role and a junior role separately.

So the exclusion could add roughly one junior ops posting to the modern period. Seventeen would become eighteen.

## The result

```chart
{
  "type": "line",
  "title": "Operations postings on HN Who is Hiring, by seniority",
  "caption": "Counts, not rates. 2011 to 2014 omitted: too few postings used the pipe convention to classify reliably.",
  "x": ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"],
  "series": [
    { "name": "senior, staff, principal, lead", "data": [7, 19, 95, 124, 110, 126, 153, 81, 49, 41, 57, 63], "color": "#8b5cf6" },
    { "name": "junior, graduate, intern", "data": [1, 0, 5, 2, 3, 1, 0, 2, 2, 0, 0, 1], "color": "#10b981" }
  ]
}
```

That green line along the bottom is the entire junior operations market, for fifteen years.

| year | ops postings | junior | senior |
| --- | --- | --- | --- |
| 2017 | 462 | 5 | 95 |
| 2018 | 516 | 2 | 124 |
| 2019 | 509 | 3 | 110 |
| 2020 | 372 | 1 | 126 |
| 2021 | 504 | 0 | 153 |
| 2022 | 327 | 2 | 81 |
| 2023 | 144 | 2 | 49 |
| 2024 | 132 | 0 | 41 |
| 2025 | 160 | 0 | 57 |
| 2026 | 133 | 1 | 63 |

**2021 is the line to look at.** That was the peak of the hiring boom. Companies were hiring aggressively, salaries were rising, and there were 153 senior operations postings. Junior operations postings that year: **zero**.

Whatever is keeping juniors out of operations, it was doing it at full strength when money was free and nobody could hire fast enough. It is not AI. AI was not writing anybody's Terraform in 2021.

## But is ops hiring just down generally?

No, and this is the part that rules out the easy explanation.

```chart
{
  "type": "line",
  "title": "Operations roles as a share of all classified postings",
  "unit": "%",
  "caption": "Ops demand tracks the overall market. The collapse people feel is the whole board shrinking, not ops specifically.",
  "x": ["2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"],
  "series": [
    { "name": "ops share of postings", "data": [5.7, 6.1, 6.4, 5.3, 5.3, 4.6, 3.7, 3.6, 4.3, 5.4], "color": "#f59e0b" }
  ]
}
```

Operations is 5.4 percent of postings in 2026 against 6.4 percent in 2019. The board is much smaller in absolute terms, 2,455 classified postings this year against 7,921 in 2019, but operations holds its share of it.

So the story is not "ops hiring collapsed". It is "hiring shrank, and ops shrank with it, while the junior end of ops stayed at the zero it has always been".

## The other side of the board

The employer threads answer "are there junior operations jobs". They cannot answer "is anybody asking for one", and those are different failures with different fixes. If juniors are applying and nobody hires them, that is a hiring problem. If nobody is applying either, the shortage starts further upstream.

Hacker News runs the mirror thread, "Ask HN: Who wants to be hired?", in the same format on the same day. So we counted that too: **36,202 candidate postings** across 12 years.

The classification here is weaker and it is worth saying why. A candidate posting has no role field, just prose and a list of technologies, so the patterns have to read the whole thing. The first attempt matched 224 postings and was **wrong most of the time**. Three failure modes did the damage:

```text
"fully self-taught"            a ten year veteran, not a junior
"junior to CTO level"          describing people they mentored
"Clojure (no professional      attached to one language, not to the person
 experience)"
```

After tightening to first person claims and excluding mentoring language, 31 matches remained. We read all 31. **Eleven were genuinely a junior asking for operations work**, as opposed to a junior asking for something else while happening to list Docker.

**Eleven people in twelve years.**

Set that beside seventeen jobs in fifteen years and the picture is not the one we expected. This is not a market where frustrated juniors queue at doors that will not open. **Almost nobody is offering junior operations work, and almost nobody is asking for it.**

Both sides behave as though the entry level operations job does not exist, which is consistent with it never having existed.

One thing in the noise: nine of those eleven appear from 2023 onward. That could be juniors starting to ask for operations work as developer entry level roles disappear, which would be the first sign of the effect arriving. With eleven data points it could equally be nothing, and we are not going to pretend otherwise.

## Why operations never had a bottom rung

The data says what happened. The reason is not in the data, so here it is as argument rather than evidence.

**Operations has always been a second job.** Nobody graduates into it. People arrive from support, from development, from being the person on the team who kept the build working and gradually stopped doing anything else. The job has no graduate scheme because the thing it asks for, judgement about systems under stress, is not something a degree produces.

**The blast radius is the whole company.** A junior developer's mistake gets caught in review. A junior operations engineer's mistake takes production with it. That is an unfair comparison in one direction only, and it is why the instinct to hire "someone experienced" is so hard to argue with in the moment.

**The learning path was other people's work.** You learned operations by having a system, breaking it, and being there when it broke on its own. Managed services took away most of the breaking. That is a good trade for the business and it removed the apprenticeship.

Here is the uncomfortable part. **If operations is a second career, and the first career's entry level is being removed, then operations is losing its supply and will not notice for five years.**

The developer figures are about now. The operations consequence arrives later, one step removed, and by the time it shows up in a chart the cause will be a decade old and impossible to prove.

## What we got wrong on the way

The regex found **33** postings that mentioned both an operations role and junior language. Publishing 33 would have been easy and wrong.

We read all 33 by hand. **16 were false positives**, almost all of the same shape: a multi-role posting where the junior word belongs to a different job.

```text
Senior Software Engineer, Senior DevOps Engineer, Software Engineering Intern
```

That intern is not an operations intern. Counting it as one inflates the junior number by nearly half.

Precision of the automated classifier on junior matches: **52 percent**. Every junior number in this post is the hand checked count, and the rejected 16 are listed in the data with a reason each.

**The senior counts are not hand checked, and you should know that before comparing them.** We read the 63 senior matches from 2026 and found the same failure mode at a much lower rate, roughly 85 percent precision: a few are postings where the seniority word belongs to a different role in the list, like "Senior/Staff Fullstack Engineer, DevOps Engineer" where the DevOps role carries no level at all.

So the comparison in this post is a verified junior number against an approximate senior one. Corrected, 2026 would read about 54 senior against 1 junior instead of 63 against 1. It does not change anything, and it is the kind of asymmetry a reader deserves to be told about rather than discover.

If you take one methodological thing from this: a regex over job postings is right about half the time, and the half it gets wrong all points the same way.

## What to do with this

**If you are trying to get into operations.** Stop looking for the junior opening. There is about one a year in this dataset and it is not the route. The route is the one everybody actually took: get hired to do something adjacent, be the person who fixes the pipeline, and let the title follow the work. That is not encouraging advice, but pretending the front door exists is worse.

**If you are hiring.** You are competing for the same senior people as everyone else, in a market where roughly 54 postings this year wanted a senior operations engineer and one wanted a junior. The arithmetic does not improve by waiting. The teams that will have operations engineers in 2030 are the ones growing them now, out of the support and development people already on staff.

**If you are writing about the AI hiring story.** Check whether the thing you are describing actually changed. For operations it did not. The entry level was missing in 2016, missing at the peak of the boom in 2021, and missing now. A story about AI closing a door works much better when the door was open to begin with.

## Method, so you can argue with it

- Source: every "Ask HN: Who is hiring?" thread, March 2011 to September 2026, 186 threads, via the Algolia API.
- Postings: top level comments only. Replies are questions and chatter.
- 92,195 postings. 21,195, or 23 percent, did not follow the pipe convention and were excluded from classification rather than guessed at.
- Role and seniority are read from the role field only, never the body.
- Operations means SRE, site reliability, DevOps, platform engineer, infrastructure engineer, systems engineer, sysadmin, production engineer, cloud engineer.
- Every junior match was reviewed by hand. 33 matched, 17 survived.
- Years before 2015 are excluded from the charts: too few postings used the convention for the classification to mean anything.

Candidate side: every "Ask HN: Who wants to be hired?" thread, 36,202 postings. There is no role field there, so the patterns read the whole posting, which makes it weaker evidence and it is treated as such. 31 matched after excluding mentoring language and self taught veterans, and 11 survived reading.

The obvious weakness is the source. This is one job board, with one kind of company on it. If you have a dataset that covers the rest of the market, the same question is worth asking of it, and we would like to see the answer.
