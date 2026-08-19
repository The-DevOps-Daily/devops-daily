---
title: 'The 9 Types of API Testing, and Where Each One Belongs in Your Pipeline'
excerpt: 'Knowing the difference between load testing and stress testing is the easy part. The decision that actually shapes your delivery is which of the nine runs on every pull request, which runs after merge, and which only ever runs against production.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-08-19'
publishedAt: '2026-08-19T16:00:00Z'
updatedAt: '2026-08-19T16:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - CI/CD
  - Testing
  - API
  - DevOps
  - Security
---

There are nine widely recognised types of API testing, and most articles about them stop at the definitions. Smoke checks availability, load measures latency under expected traffic, stress finds the breaking point, and so on. That part takes ten minutes to learn and does not change anything about how you ship.

The decision that changes how you ship is placement. Every one of those nine has to answer three questions: when does it run, what does it block, and how long is it allowed to take. Get those wrong and you end up in one of two familiar places. Either everything runs on every pull request, the pipeline takes forty minutes, and people stop reading the output. Or the slow ones were quietly moved to a nightly job that has been red since March and nobody has noticed.

So this is the nine types arranged by where they belong rather than by what they are, plus the three that most teams place wrong.

## TLDR

- **Only three of the nine belong on every pull request**: functional, contract, and a fast regression subset. They are quick and deterministic, and everything else fails the budget.
- **A pull request check that takes longer than about ten minutes stops being a gate** and becomes something people merge around.
- **Smoke tests belong after deploy, not in CI.** They are the only type whose job is to run against the environment you just shipped to.
- **Contract testing is the highest-leverage and most skipped.** It is the one that lets services deploy independently, and skipping it usually means paying for the same coverage in slow integration tests.
- **Load and stress answer different questions.** Does it meet the SLO, versus where does it fall over. Teams that conflate them get neither answer.
- **Security testing that matters most is authorization logic**, and scanners do not find it, because "User A can fetch User B's order" is business logic, not a CVE.

## Prerequisites

- An API with some tests, even a thin layer of them
- A CI system that runs on pull requests
- Somewhere to deploy that is not production, though the post covers what to do if you do not have one

## The placement table

The whole argument on one screen. Budget means the time it is allowed to take before it starts damaging the thing it is protecting.

| Type | Runs | Blocks | Budget | Failure means |
| --- | --- | --- | --- | --- |
| Functional | Every PR | Merge | Seconds | The endpoint does the wrong thing |
| Contract | Every PR | Merge | Seconds | You are about to break a consumer |
| Regression (subset) | Every PR | Merge | Under 5 min | A previously fixed bug came back |
| Regression (full) | On merge | Deploy | Under 20 min | Same, on the paths nobody touches often |
| Integration | On merge | Deploy | Under 20 min | The services disagree about a workflow |
| Security | On merge, plus nightly | Deploy | Under 20 min | Someone can read data that is not theirs |
| Fuzz | Nightly | Nothing, files a ticket | Hours | An input class you never considered |
| Load | Before release, on a schedule | Release sign-off | Tens of minutes | You will miss the SLO under normal traffic |
| Stress | Before capacity decisions | Nothing, informs planning | Tens of minutes | You do not know where the cliff is |
| Smoke | After every deploy | Rollout progression | Under 60 seconds | Roll back now |

Two things fall out of that table immediately. The pull request gate is a small club, and smoke testing is not really a test type at all in the way the others are. It is a deploy control.

## The three tiers

```diagram
{
  "type": "flow",
  "title": "Where each type runs",
  "nodes": [
    { "label": "Pull request", "sub": "functional, contract, fast regression", "icon": "branch", "tone": "blue" },
    { "label": "On merge", "sub": "integration, full regression, security", "icon": "gear", "tone": "violet" },
    { "label": "Pre-release", "sub": "load, stress, nightly fuzz", "icon": "activity", "tone": "amber" },
    { "label": "After deploy", "sub": "smoke, against the real environment", "icon": "check", "tone": "green" }
  ]
}
```

The tiers are not about importance. Fuzz testing is not less valuable than functional testing. They are about **what the feedback is worth against what the wait costs**, and that ratio is completely different at each stage.

On a pull request you are interrupting a person who is waiting. The feedback has to arrive while they still have the change in their head, which in practice means minutes. After merge nobody is blocked, so twenty minutes is fine. Nightly, hours are fine, because the alternative is not running it at all.

## The pull request budget is the real constraint

Here is the thing that governs everything else, and it is not a testing insight so much as a human one.

**A gate that is slower than a developer's patience stops being a gate.** They do not sit and watch it. They context switch, come back later, and if it fails on something unrelated they re-run it rather than read it. Once re-running becomes the reflex, the suite has stopped providing information and started providing delay.

Roughly ten minutes is where most teams find that line, and the exact number matters less than the direction of travel. If your PR check has grown from four minutes to eleven over a year, the useful question is not "how do we make it faster", it is "which of these belongs at a later stage".

That is what the tiers buy you. Not less testing, but testing that arrives when someone can act on it.

:::tip
A quick diagnostic: look at how often people re-run a failed pipeline without reading the log. If that is common, your suite has a flakiness or duration problem, and adding more tests to the PR stage will make both worse.
:::

## Contract testing: the one that changes your deploy order

Of the nine, this is the one worth the most and the one most often missing, so it is worth being concrete about what it does.

A contract test checks that the consumer's expectations and the provider's actual responses agree, without running both services together. The consumer declares what it needs, the provider verifies it can supply that, and both checks run independently in each service's own pipeline.

The reason that matters operationally has nothing to do with test coverage. It is about **deploy independence**.

Without contract tests, the only way to know that Service A still works with Service B is to run them together, which means an environment where both exist, which means a queue for that environment, which means coordinated releases. That is how teams end up with a release train and a Thursday deploy window.

With contract tests, the provider knows before merging whether it is about to break a consumer. Each service deploys on its own schedule, because the compatibility question was answered in CI rather than in a shared environment.

```yaml
# The shape of the thing: a consumer states what it needs.
# The provider's own pipeline replays these and must satisfy them.
- description: fetching a product returns the fields the cart relies on
  request:
    method: GET
    path: /products/42
  response:
    status: 200
    body:
      id: 42
      price_cents: 1999      # cart does the arithmetic, so this must stay an integer
      currency: "EUR"
      available: true
```

The failure this catches is the quiet one. A provider renames `price_cents` to `price`, every one of its own tests passes because they were updated together, and the cart service breaks in production. No integration environment catches that until both are deployed. A contract test catches it in the provider's pull request, which is the only place the fix is cheap.

:::warning
Contract testing has a real cost, and it is not the tooling. It is that the contracts must be verified in the provider's pipeline, which means the provider team has to care about consumers they may never talk to. Teams that adopt the tool but skip the provider-side verification get a directory of YAML files and none of the benefit.
:::

## Smoke tests belong after the deploy

Smoke testing gets grouped with the others as if it runs in CI. It should not. Its entire purpose is to answer one question about one environment: **did the thing I just shipped come up correctly?**

Which means it runs after the deploy, against the real environment, and its result gates the rollout rather than the merge.

```terminal
{
  "title": "post-deploy smoke",
  "prompt": "$",
  "steps": [
    { "comment": "deploy to one instance, then check before sending it traffic" },
    { "cmd": "kubectl rollout status deploy/orders --timeout=120s", "output": "deployment \"orders\" successfully rolled out" },
    { "cmd": "./smoke.sh https://orders.internal", "output": "GET  /health          200  12ms\nGET  /products/42     200  38ms\nPOST /orders (dry)    201  71ms\nGET  /orders/{id}     200  24ms\n\n4 passed in 1.4s" },
    { "comment": "only now widen the rollout" },
    { "cmd": "kubectl argo rollouts promote orders", "output": "rollout 'orders' promoted" }
  ]
}
```

The common mistake is a smoke test that only calls `/health`. That endpoint usually proves the process started and can serve HTTP. It does not prove the database credentials are right, the migration ran, the downstream service is reachable, or the config for this environment loaded.

A useful smoke test touches one endpoint from each critical dependency: something that reads from the database, something that calls the main downstream service, something that exercises auth. Four or five requests, under a minute, and it should be the thing that decides whether the rollout continues or reverses.

If you are running progressive delivery, this is the check that feeds the promotion decision. If you are not, it is still the difference between finding out from a synthetic check and finding out from a customer.

## Load and stress answer different questions

These two get conflated constantly, and the cost of conflating them is that you run one test and believe it answered both questions.

**Load testing** asks whether the system meets its targets under the traffic you expect. It is a pass or fail against an SLO. Expected concurrency, realistic mix of endpoints, sustained for long enough to matter, and the result is a number you compare to a threshold.

**Stress testing** asks where it breaks and how. It is not pass or fail. You ramp until something gives, and the output is knowledge: the concurrency at which latency leaves acceptable bounds, what fails first, and whether it degrades or collapses.

The operational difference is what you do with the result. A failed load test blocks a release. A stress test does not block anything; it informs capacity planning and tells you what your autoscaling thresholds should actually be.

```tabs
{
  "title": "Same tool, different question",
  "tabs": [
    {
      "label": "Load: does it meet the SLO?",
      "lang": "javascript",
      "code": "// k6: hold expected traffic, assert against the target.\nexport const options = {\n  stages: [\n    { duration: '2m', target: 200 },   // ramp to expected peak\n    { duration: '10m', target: 200 },  // hold: this is where truth lives\n    { duration: '2m', target: 0 },\n  ],\n  thresholds: {\n    // The test fails the build if these are missed.\n    http_req_duration: ['p(95)<400'],\n    http_req_failed: ['rate<0.01'],\n  },\n};"
    },
    {
      "label": "Stress: where does it break?",
      "lang": "javascript",
      "code": "// k6: keep climbing past expected load. No thresholds, because\n// there is no pass or fail here. The output is the breaking point.\nexport const options = {\n  stages: [\n    { duration: '3m', target: 200 },\n    { duration: '3m', target: 500 },\n    { duration: '3m', target: 1000 },\n    { duration: '3m', target: 2000 },  // keep going until it hurts\n  ],\n};\n// Watch for the knee in the latency curve and what errors first:\n// connection refused, pool exhaustion, OOM, or upstream timeouts."
    }
  ]
}
```

One practical warning about both: do not run them on shared CI runners. A load test competing with three other builds on the same machine produces numbers that describe the runner, not your API. Run them against a dedicated environment, from a machine that is not also the thing under test, or the results are worse than not measuring, because they look like data.

## The security testing that scanners miss

Security testing in the API context covers auth, access control, input handling and data protection. Automated scanners are good at a subset of that: known CVEs in dependencies, missing headers, TLS configuration, obvious injection.

They are close to useless at the class of bug that actually leaks customer data, which is **broken object level authorization**. The canonical shape is one request:

```bash
# Authenticate as user A, then ask for user B's resource.
curl -H "Authorization: Bearer $USER_A_TOKEN" https://api.example.com/orders/$USER_B_ORDER_ID
# The only acceptable answers are 403 or 404. A 200 here is a data breach
# that no dependency scanner will ever report.
```

No scanner finds that reliably, because nothing in the request is malformed. It is a perfectly valid request that the application should refuse and does not. The knowledge that order 1234 belongs to someone else lives in your domain model, not in a signature database.

The fix is unglamorous: for every endpoint that returns something owned by someone, write the test that asks for it as the wrong user. It is a handful of tests per resource type, it runs in seconds, and it belongs in the on-merge tier.

## Fuzz testing is cheaper than its reputation

Fuzz testing has a reputation as something security researchers do, which keeps it off pipelines where it would pay for itself.

Modern API fuzzing is mostly schema-driven. Point a tool at your OpenAPI spec and it generates inputs that satisfy and deliberately violate the schema: nulls in non-nullable fields, huge strings, negative quantities, unexpected types, malformed JSON. It then checks that the API responds sensibly rather than returning a 500 or, worse, accepting it.

The bugs it finds are rarely dramatic. They are the quantity of `-1` that passes validation and produces a negative invoice, the string field with no maximum length that fills a column, and the endpoint that returns a stack trace when handed a malformed body. Cheap bugs to fix, embarrassing bugs to ship.

It belongs nightly because it is slow and non-deterministic, and it should file a ticket rather than break a build. A fuzz run that blocks deploys will be disabled within a month of its first false alarm.

## Putting it together

The shape of a pipeline that respects the budget:

```yaml
# Fast, deterministic, blocks the merge.
on_pull_request:
  - functional            # does each endpoint behave
  - contract              # are we about to break a consumer
  - regression:fast       # the subset covering critical paths
  # target: under 10 minutes total

# Slower, blocks the deploy, nobody is watching the clock.
on_merge_to_main:
  - regression:full
  - integration           # real workflows across services
  - security:authz        # the wrong-user tests
  # target: under 20 minutes

# Runs against the environment you just deployed to.
post_deploy:
  - smoke                 # 4-5 requests, gates rollout progression
  # target: under 60 seconds, and it must be able to trigger a rollback

# Nobody is waiting. Files tickets, does not block.
nightly:
  - fuzz
  - security:scanners

# Explicitly scheduled, against a dedicated environment.
before_release:
  - load                  # pass or fail against the SLO
  - stress                # informational, feeds capacity planning
```

The point is not the exact grouping, which will differ for your system. It is that every one of the nine has an answer to when it runs and what it blocks, and none of them is "all of them, on every push, and we will see how it goes".

## Summary

The nine types are worth knowing, but the definitions are not where the value is. The value is in three decisions per type.

Keep the pull request gate small and fast, because a slow gate is one people learn to work around. Put contract testing in it, because that is the test that lets services ship independently and the one whose absence you pay for in coordination. Move the slow, valuable, non-deterministic work to stages where nobody is waiting on it.

And treat smoke testing as what it is: not the first test in your suite, but the last check before you let traffic near what you just shipped.

If you want the same mindset applied to failures rather than correctness, [running a first chaos engineering experiment](/posts/running-first-chaos-engineering-experiment-litmus) covers the other half, which is what happens when the dependencies these tests assume are healthy stop being healthy.

## FAQ

**How do I split a regression suite into fast and full?**
By what it covers, not by runtime. The fast subset is the paths that would be a serious incident if broken: auth, payment, the two or three endpoints that carry most traffic. Everything else can wait for merge.

**Do I need contract testing with a single team and three services?**
Probably yes, and more than you would guess. The benefit is not team coordination, it is that you stop needing all three running together to know they still agree. Three services is exactly the size where an integration environment starts becoming a bottleneck.

**Where do end-to-end tests fit in this?**
They are integration testing with a wider blast radius, and they belong in the on-merge tier at the latest. They are the slowest and flakiest thing most teams own, so keep the count small and the coverage deliberate.

**Can smoke tests run against production?**
They should. That is the environment whose health you actually care about. Use a read-mostly path or a synthetic account, keep the writes reversible or clearly marked as test data, and make sure the result can trigger a rollback rather than just log a failure.

**Is it worth load testing if we cannot replicate production scale?**
Yes, if you are honest about what the result means. A load test at a tenth of production traffic will not tell you whether you survive peak, but it will catch a regression that doubles p95 latency, which is the more common failure anyway.

**We have none of this. Where do we start?**
Functional tests on the critical endpoints, then a smoke test that runs after deploy and can roll you back. Those two cover the largest share of real incidents for the least effort. Contract testing next, before the number of services grows.
