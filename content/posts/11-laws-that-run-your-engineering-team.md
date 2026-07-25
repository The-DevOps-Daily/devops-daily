---
title: '11 Laws That Quietly Run Your Engineering Team'
excerpt: 'Parkinson, Goodhart, Brooks, Chesterton. Eleven old "laws" that were not written about software but explain your incidents, your estimates, and your org chart better than most engineering blog posts.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-25'
publishedAt: '2026-07-25T11:00:00Z'
updatedAt: '2026-07-25T11:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Engineering Culture
  - Career
  - Incident Response
  - Best Practices
  - SRE
---

There is a set of old adages that get passed around as motivational-poster material: Parkinson's Law, Occam's Razor, the 80/20 rule. Most of them were coined by economists, physicists, and historians who never touched a terminal. And yet they describe the daily reality of running software better than a lot of writing that is actually about software.

That is not a coincidence. These are laws about systems, incentives, and human behavior under constraint, and an engineering organization is a system built out of humans under constraint. One of them (Brooks's Law) was written about software directly. The rest fit so cleanly that once you see them, you cannot unsee them in every standup, postmortem, and estimation meeting.

Here are eleven of them, each with the version that actually shows up in your work and what to do about it.

## 1. Parkinson's Law: work expands to fill the time available

The original line, from a 1955 essay by Cyril Northcote Parkinson, is that "work expands so as to fill the time available for its completion." Give a task two weeks and it takes two weeks, even if it needed three days.

In engineering this is everywhere. A ticket scoped for a sprint consumes the sprint. A two-week estimate rarely comes in early because the extra time gets absorbed by gold-plating, bikeshedding, and "while I'm in here" refactors. There is an infrastructure version too: allocate a generous disk and it fills up; give a service 8 GB of memory and it grows to need it; open a Slack channel and it expands to consume attention.

The takeaway is not "set impossible deadlines." It is to be deliberate about constraints. Timeboxing works because it turns Parkinson's Law in your favor: a strict two-hour box on a spike forces a decision that an open-ended investigation never reaches. Small batch sizes and short iterations do the same thing.

## 2. Hofstadter's Law: it always takes longer than you expect

Hofstadter's Law is delightfully recursive: "It always takes longer than you expect, even when you take into account Hofstadter's Law." Douglas Hofstadter coined it about how long it takes to finish complex projects, and every migration you have ever run is proof.

The database migration that was "basically a config change" runs into a foreign-key constraint nobody documented. The Kubernetes upgrade that should have been an afternoon uncovers a deprecated API three services still call. You padded the estimate, and it still slipped, because the unknowns were unknown by definition.

You cannot estimate your way out of this, but you can design around it. Break work into pieces small enough that being wrong about one is cheap. Ship behind flags so "done" and "released" are separate events. And when someone asks why the migration is late, the honest answer is usually not incompetence. It is Hofstadter's Law, which brings us to the next one.

## 3. Hanlon's Razor: do not assume malice when a misconfig will do

"Never attribute to malice that which is adequately explained by stupidity." For engineers, replace "stupidity" with "a typo, a stale cache, or a bad deploy," and you have the most important mindset in incident response.

When the site goes down, the reflexive story is dramatic: a breach, an attacker, sabotage. The boring, correct story is almost always a fat-fingered YAML change, an expired certificate nobody renewed, or a deploy that shipped a config for the wrong environment. Reaching for the dramatic explanation wastes the first thirty minutes of an incident chasing ghosts.

This is the intellectual foundation of the blameless postmortem. If a human action caused an outage, the useful question is not "who is at fault" but "what let a normal human mistake reach production." Hanlon's Razor says the mistake was almost certainly not malicious, so the fix is a better guardrail, not a worse opinion of your colleague.

## 4. The Pareto Principle: 80% of the pain comes from 20% of the system

The 80/20 rule, named after economist Vilfredo Pareto, says roughly 80% of effects come from 20% of causes. In a running system the ratio is often more lopsided than that.

Profile any real application and you find a handful of endpoints generating most of the load, a few queries responsible for most of the database time, and a small cluster of modules producing most of the bugs. Your error tracker is a Pareto chart: a short head of noisy, high-frequency errors and a long tail of things that happened once.

```chart
{
  "type": "bar",
  "title": "Request volume by endpoint (typical web app)",
  "unit": "%",
  "caption": "Illustrative distribution. A small number of endpoints usually dominate load, which is where caching and optimization pay off.",
  "rows": [
    { "label": "/api/feed", "value": 38 },
    { "label": "/api/search", "value": 22 },
    { "label": "/api/auth", "value": 14 },
    { "label": "/api/profile", "value": 9 },
    { "label": "everything else (30+ endpoints)", "value": 17 }
  ]
}
```

The practical move is to find your 20% before you optimize anything. Adding a cache to a rarely hit endpoint is wasted work. Adding it to the one serving 38% of requests changes your capacity plan. Error budgets, performance work, and even code review attention all pay off most when aimed at the vital few instead of the trivial many.

## 5. The Peter Principle: things get promoted until they stop working

Laurence Peter's observation is that in a hierarchy, people tend to rise to their level of incompetence. You are promoted for doing your current job well, until you reach a job you do not do well, and there you stay.

The classic engineering version is promoting your strongest individual contributor into management, losing a great engineer and gaining a struggling manager, because the two jobs share almost no skills. The fix organizations reach for is a dual ladder: a senior/staff/principal track that rewards deep technical work without forcing a move into management.

There is a systems version worth naming too. Tools and services get "promoted" past their competence: the SQLite database that was perfect for the prototype gets pushed into a high-write production workload, the cron job that glued two systems together becomes load-bearing infrastructure, the internal script gets promoted to a platform. Same principle, same outcome. Something succeeds its way into a role it was never designed for.

## 6. Hick's Law: more choices, slower decisions

Hick's Law, from psychology, says the time to make a decision grows with the number and complexity of the options. It is usually cited in UI design, but it governs developer experience just as hard.

Every knob you add slows someone down. A config file with 200 options is not more powerful in practice than one with 20 sensible defaults and 5 overrides. It is just harder to use correctly. Feature-flag sprawl, a dashboard with forty panels, a CLI with a hundred subcommands, an internal platform with six ways to deploy: each additional choice is a small tax on every decision, and the taxes compound.

The takeaway is that good defaults are a feature. The most usable tools make the common path obvious and the rare path possible, rather than exposing every option as equally weighted. When you design an internal platform, the number of decisions you save your users is a real metric, even if it never shows up on a dashboard.

## 7. Goodhart's Law: when a metric becomes a target, it breaks

Economist Charles Goodhart gave us the line usually paraphrased as "when a measure becomes a target, it ceases to be a good measure." The moment you reward a number, people optimize the number, and the number stops meaning what it used to.

Engineering is full of this. Reward test coverage percentage and you get tests that assert nothing but touch every line. Reward story-point velocity and points inflate until a "5" means what a "3" used to. Reward closing tickets fast and hard problems get closed and reopened instead of solved. Even good frameworks like DORA metrics rot the instant they become a leaderboard: teams start gaming deploy frequency by splitting one release into ten.

The defense is to treat metrics as signals for conversation, not targets for compensation. Watch several that pull against each other (speed against stability, coverage against defect rate) so that gaming one shows up as damage in another. And be suspicious of any single number that leadership starts quoting in every meeting. It is already halfway to being gamed.

## 8. The Dunning-Kruger Effect: confidence is highest where competence is lowest

The Dunning-Kruger effect describes the gap between how good people think they are and how good they are: with a little knowledge, confidence spikes well past ability, and only with real expertise does confidence come back down to match reality, often overshooting into impostor territory.

Every engineer has lived both ends of this curve. The week after learning Kubernetes, everything looks like it needs Kubernetes. The engineer who just discovered microservices wants to split the monolith on Monday. "It works on my machine" is peak confidence sitting on top of minimal understanding of the production environment. Meanwhile the person who actually knows the system is the one hedging every answer with "it depends," because they have seen how it breaks.

The practical value is calibration. When you feel most certain about a system you just met, that is exactly when to write down your assumptions and have someone check them. And when a senior engineer says "I'm not sure, let me test it," that hesitation is not weakness. It is what the far end of the curve sounds like.

## 9. Occam's Razor: the boring explanation is usually right

Occam's Razor, the medieval principle that you should not multiply entities beyond necessity, reduces in practice to: the simplest explanation that fits the evidence is usually the correct one.

When something breaks right after a deploy, the deploy did it. You do not need a theory involving a kernel bug, a cosmic-ray bit flip, and a leap-second edge case when "the change you shipped four minutes ago" explains everything. The debugging discipline is to check the simple, recent, likely causes first: the last commit, the config change, the expired credential, the full disk.

:::tip
The engineering corollary to Occam's Razor is "it's always DNS." When a distributed system misbehaves in a way that makes no sense, an astonishing fraction of the time the boring root cause is name resolution, a stale record, a TTL, or a resolver pointed at the wrong place. Check it early, not after you have rewritten the retry logic.
:::

Occam's Razor is a razor, not a law. Sometimes it really is the exotic race condition. But you reach the exotic explanation faster by ruling out the boring ones first, in order of likelihood, rather than starting with the most interesting theory.

## 10. Chesterton's Fence: do not delete what you do not understand

G. K. Chesterton's parable: if you find a fence across a road and cannot see why it is there, the answer is not to tear it down. It is to figure out why someone built it, because they probably had a reason, and only then decide whether it can go.

This is the single most useful principle for working in a codebase you did not write. That weird `sleep(200)` before the retry, the config flag that has been `true` since 2019, the seemingly redundant null check, the cron job nobody remembers: each is a fence. Delete it because "it looks pointless" and you have a real chance of rediscovering the exact production incident it was quietly preventing.

```chart
{
  "type": "bar",
  "title": "Why that weird line of code is probably there",
  "caption": "The 'pointless' code you want to delete usually encodes a lesson someone learned the hard way.",
  "rows": [
    { "label": "Fixes a bug you have not hit yet", "value": 40 },
    { "label": "Works around an upstream quirk", "value": 30 },
    { "label": "Handles an edge case in prod data", "value": 20 },
    { "label": "Actually is dead code", "value": 10 }
  ]
}
```

:::warning
Chesterton's Fence is not an argument against ever removing code. It is an argument against removing it *blindly*. The correct sequence is: understand why it exists, confirm that reason no longer applies (with a test, a git blame, an ask in the channel), and then remove it. "I don't know why this is here" is a reason to investigate, not a reason to delete.
:::

## 11. Brooks's Law: adding people to a late project makes it later

The one that was written about software directly. Fred Brooks, in *The Mythical Man-Month* (1975), observed that "adding manpower to a late software project makes it later." New people need onboarding from the people who are already busy, and the communication overhead grows faster than the workforce.

That last part is the math worth internalizing. Communication paths on a team of n people scale as n(n-1)/2. Doubling a team does not double its output. It roughly quadruples the number of connections that have to stay in sync, and much of that new capacity is consumed just keeping everyone aligned.

```chart
{
  "type": "line",
  "title": "Communication paths vs team size",
  "x": ["2", "4", "6", "8", "10", "12"],
  "series": [
    { "name": "Communication links n(n-1)/2", "data": [1, 6, 15, 28, 45, 66], "color": "#f59e0b" }
  ],
  "caption": "Output scales roughly linearly with people; the coordination cost scales quadratically. This is why the fifth engineer helps less than the second."
}
```

The lesson is not "never grow a team." It is that throwing bodies at a slipping deadline is the wrong tool, because the new people make it worse before they make it better. Better levers for a late project are cutting scope, removing blockers from the people already on it, and staffing *before* the crunch so onboarding happens when there is slack to absorb it.

## The pattern behind the laws

Read these together and a theme emerges. Almost every one is a warning about a second-order effect: the metric you optimize corrupts (Goodhart), the people you add slow you down (Brooks), the time you save gets absorbed (Parkinson), the code you remove was load-bearing (Chesterton). Engineering is mostly a fight against second-order effects, and these laws are a compact vocabulary for the ones that recur.

You do not need to memorize them as trivia. The value is that they give a name to a pattern you are already living, and a named pattern is one you can point at in a design review before it bites. The next time someone suggests adding three contractors to hit a deadline, or gaming a coverage number, or ripping out a config nobody understands, you will have a one-line reason to stop and think. That is what these old laws are for.
