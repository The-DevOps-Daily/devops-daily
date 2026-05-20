---
title: 'AI Is Reshaping DevOps. The Practitioners Are Faster Than the Vendors.'
excerpt: 'GitHub, Datadog, HashiCorp and friends are moving carefully. The engineers running their stacks are wiring AI into kubectl and pull-request review on a Tuesday afternoon. Here is what is actually changing in 2026, what is not, and where the gap between vendors and practitioners is widest.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-05-20'
publishedAt: '2026-05-20T09:00:00Z'
updatedAt: '2026-05-20T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - AI
  - AIOps
  - Automation
  - Developer Tools
---

A question gets asked in every DevOps Slack channel right now: how will AI change our work? The honest answer is that no one knows the final shape yet. What we can say with confidence is who is moving faster. It is not the dominant vendors. GitHub, HashiCorp, Datadog, and Red Hat are being careful, because they have customers to keep and revenue to defend, and a wrong AI bet would cost them years. Meanwhile, individual engineers are wiring Claude Code into their kubectl wrappers, training small models on their own incident postmortems, and shipping internal pull-request review agents to teams of five. The Reddit thread that prompted this post is a fair sample of the energy: practitioners trying things, sharing what works, and being honest about what does not.

This post is a working snapshot of where AI is actually changing DevOps in May 2026. What you can use today, what the incumbents are doing, what the practitioners are doing that the incumbents are not, and which corners are still pure hype.

## TLDR

- Code authoring is the area where AI is most useful and least controversial. Pull-request review, test generation, and dependency upgrade chores are the next layer in.
- Observability and incident response are getting natural-language query interfaces faster than the vendors expected. Honeycomb's MCP server, Datadog's Bits AI, New Relic's Grok all work. The deeper bet (autonomous root-cause analysis) is still flaky.
- Infrastructure-as-code is the slowest moving area. Terraform's plan/apply loop punishes hallucinations harder than any other surface in the stack.
- Big incumbents move slowly because they own the workflow. A bad AI feature ships to thousands of paying teams and the support tickets compound. Practitioners move fast because they only have to please themselves.
- The single highest-leverage thing for a DevOps engineer to try this week: an MCP server that exposes your own infrastructure (kubectl, terraform state, observability) to your AI assistant of choice. The local connection beats every SaaS AIOps tool we have tried.

## What has actually changed for DevOps engineers

Five concrete shifts you can see in the work right now. None of them are speculative.

### 1. Code authoring is solved enough that nobody talks about it

Two years ago, GitHub Copilot was the headline. Today nobody at a DevOps conference mentions it because everyone has it. The question is no longer "will AI write code for me" but "which AI, in which IDE, with what context window." Claude Code, Cursor, Windsurf, Zed, JetBrains AI Assistant, Aider, Continue all do credible work on Terraform modules, Helm charts, GitHub Actions workflows, and Bash scripts. The differentiator is now the editor experience and the size of the context window, not whether the suggestions are good.

The interesting failure mode: AI is fine at writing the next function. It is bad at writing the next module if "next module" requires holding the system architecture in working memory. A senior engineer's job has not moved much; the boilerplate has moved a lot.

### 2. Pull-request review is the next surface, and it is messy

Three patterns are competing:

- **Vendor agents.** GitHub Copilot Code Review, GitLab Duo, CodeRabbit. These plug into the PR, leave comments, sometimes suggest patches. Quality varies. The honest take is that they catch a lot of style nits and miss most architectural issues, which is the inverse of what you want.
- **Self-hosted agents.** A 200-line script that calls Claude with the diff and a project-specific prompt, posted as a check via the GitHub API. Several engineers we know are running these against their own repos. Hit rate is higher than vendor tools because the prompt is tuned to the codebase. Maintenance overhead is real.
- **PR-triggered agentic workflows.** Devin, OpenHands, Claude Code in headless mode. Pick up a PR, run the tests, push a fix commit if a failure looks recoverable. Works for small classes of bug (linting, type errors). Falls over on anything that requires judgement.

Nobody has the answer yet. The space is moving fast enough that what we wrote three months ago is already stale. If you are picking one to evaluate this quarter, the self-hosted script gives you the cleanest mental model of what AI is actually doing on your codebase.

### 3. Observability is getting a natural-language interface, fast

Datadog Bits AI, New Relic Grok, Honeycomb's MCP server, Grafana's natural-language query feature in Loki, Splunk SPL2 with AI assists. The pattern is the same: type a question in English, get a query in the vendor's DSL plus the result. It works because the search surface is well-defined and bounded. A bad PromQL query returns no rows; a bad Terraform plan can destroy production.

The harder bet from the same vendors is "AI-driven root cause analysis." The marketing claims are aggressive. The reality, when we have run the products on real incidents, is that they are good at correlating signals and bad at picking the load-bearing one. Useful as a second opinion. Not yet a replacement for an experienced engineer reading the same dashboards.

### 4. Dependency management is being eaten by agents

Dependabot was the start. The current wave is more ambitious: an agent that runs the upgrade, reads the changelog, updates the calling code, runs the tests, and opens the PR with a summary of what changed. RenovateBot has supported this shape for a while; what is new is that the LLM step in the middle is now reliable enough to ship.

The practitioners are running this on Tuesday afternoons against their own monorepos. The vendors are catching up. GitHub Copilot now has a "fix the failing PR" mode that does roughly this; Mend, Snyk, and JFrog have variants.

What still does not work well: major-version upgrades that change semantics. The LLM does not know whether `removed deprecated foo()` means "delete the call" or "migrate to bar()." Senior judgement still wins here.

### 5. Incident response is the loudest, but the slowest

The pitches: an AI agent that auto-pages, summarises the incident, drafts the postmortem, suggests the fix, runs the rollback. Several vendors sell this story. Cortex, PagerDuty, Rootly, FireHydrant, Incident.io all have an AI feature.

What actually ships well today is the boring part: the summary. Take 30 minutes of Slack messages and produce a five-bullet recap that the incident commander can paste into the postmortem template. Good models do this reliably. Vendors do it. Practitioners with a Claude API key do it for free.

What does not ship well is the action. An AI suggesting "roll back deployment X" is fine. An AI executing the rollback against production needs a level of confidence we do not have yet, and the engineering teams we trust are not letting AI write to prod systems without a human in the loop. That layer of the pitch is still aspirational.

## What has not changed

Infrastructure-as-code is the surface where AI has had the least real impact. The reasons are honest:

- A Terraform plan is unforgiving. A hallucinated resource is a 500-line diff at apply time. Even if the engineer catches it, the trust cost is real.
- State is hard to read. The LLM does not know what is in your remote state file unless you give it. Many tools cannot give it because the state has secrets in it.
- Module conventions are project-specific. The "right" way to write a Terraform module varies by org, and the LLM cannot infer it from the public docs.

There are early attempts (Pulumi Copilot, HashiCorp's Terraform AI features, atmos with AI assists) but none of them have produced the "wow" moment that pair-programming with Claude Code has for application code. The terraform plan loop punishes mistakes harder than any other tool in the DevOps stack, which is exactly why the LLMs struggle there.

Secrets management, kernel-level tooling (eBPF, kprobes), and database schema migrations are in the same bucket. AI assists at the margins; the load-bearing decisions are still human.

## Why the big vendors are moving slowly

This is the question the snippet that inspired this post got right. GitHub does not ship a half-broken AI feature because their userbase is too large to absorb the support burden of a regression. Datadog does not auto-route alerts via an LLM because a single false negative in a production incident becomes a customer-leaving event. HashiCorp does not auto-write Terraform plans because the plan is the last line of defense between an engineer and an outage.

The economics are asymmetric. A vendor that ships a great AI feature gets a press cycle. A vendor that ships a bad one loses three of its biggest customers. So they ship slowly, in betas, with opt-in flags, behind feature toggles.

This is rational for them. It also leaves a gap that practitioners are filling.

## What practitioners are doing that vendors are not

The shape that matters: practitioners build narrow, opinionated tools for their specific stack. A vendor ships something general for everyone. The narrow one is more useful to the team that built it. Examples we have seen in the last six months:

- **A kubectl wrapper that pipes commands and output to Claude with a prompt about the cluster's deployment conventions.** Replaces the "ask the senior engineer what to do" Slack message for routine debugging.
- **A pre-commit hook that runs the diff through a local model and refuses to commit if it spots a likely secret leak.** The local model is small; the false-positive rate is high but acceptable when the alternative is committing an AWS key.
- **A Slack bot that watches incident channels, drafts a postmortem skeleton when the channel goes quiet for 30 minutes, and pings the IC to review.** Saves two hours of writing per incident.
- **A custom MCP server that exposes Prometheus, the cluster's events API, and the deployment history to Claude Code.** The engineer asks "why is this pod restarting?" and the model runs the queries it needs. This is what Datadog and New Relic are trying to sell, but built on top of the open standards in 45 minutes.
- **A nightly job that runs a model against the last day's CI failures and groups them by likely cause.** Replaces the "is this a known flake?" triage question.

None of these are products. All of them are 200-line scripts an engineer wrote in an afternoon. Cumulatively, they are doing more for the day-to-day of a DevOps team than any vendor announcement we have seen this year.

## Where to start this week

If you have not built anything AI-shaped into your workflow yet, pick one of these. They are ordered by impact-to-effort ratio.

1. **Run Claude Code (or Cursor, or Aider) against your infrastructure repos.** Not for new code; for reading. Ask it to summarise a Terraform module you did not write. Ask it to map the data flow through your Helm chart. The "explain this codebase to me" use case is the most underrated AI application in DevOps.
2. **Wire one MCP server.** The Anthropic Model Context Protocol now has servers for kubectl, GitHub, Prometheus, Loki, Postgres, and most of the tools you already use. Connecting Claude to your own infra (read-only) takes 20 minutes and immediately makes the rest of this list 10x more useful.
3. **Pick one chore and write a script.** Dependency triage, PR summarisation, incident notes, on-call schedule rotation explainers. Whatever takes 30 minutes of your week and is mostly the same each time. A 200-line wrapper around an LLM API will replace it for a one-time cost.
4. **Set up a self-hosted PR review agent.** Not a vendor product. A script. Tune the prompt to your codebase's conventions. Run it as a GitHub Actions check. Iterate weekly.

## Where not to start this week

Equally important. These are the corners where the hype is well ahead of the substance, and you will burn time you do not get back.

- **"AI ops platforms" that promise auto-remediation against production.** The good ones do not actually do this; the marketing implies they do. Read the docs carefully.
- **LLMs in the critical path of a deployment pipeline.** A flaky model becomes a flaky deploy. Use AI to suggest, not to gate.
- **Custom training on your incident data, hoping for "predictive AIOps."** The dataset is too small. The signal is too noisy. Three years from now this might work; today it does not.
- **Replacing a senior engineer with an agent.** No vendor sells this in those words, but several pitches imply it. The senior engineer's judgement on what to do with the LLM's output is the load-bearing piece.

## What the next year probably looks like

A short list of predictions, marked clearly as predictions:

- The PR review surface will get a clear winner. Either GitHub Copilot Code Review levels up enough to be the default, or one of the agent startups (Greptile, CodiumAI, Sweep, others) wins on quality.
- MCP becomes standard. The protocol is the right shape, the vendors are adopting it, and the network effect compounds with every new server.
- Terraform gets an "AI plan summary" feature from HashiCorp. It will explain what an apply will change in English. It will not write the apply for you. That is the right balance.
- One major outage will be partially-attributed-to-AI in its postmortem. It will become a case study. We will all learn from it.
- The vendors will catch up. By mid-2027, the gap between "what your custom 200-line script does" and "what your platform vendor ships" will be much smaller than it is today.

## Summary

AI is reshaping DevOps. Not evenly. Code authoring and observability querying are the surfaces moving fastest. Infrastructure-as-code, secret management, and autonomous remediation are the surfaces moving slowest, for honest reasons. The big vendors are moving carefully because the downside of a wrong move is large; the individual engineers are moving fast because their downside is just an afternoon.

If you are in DevOps and you have not yet built an AI-shaped tool of your own into your workflow, this week is the right time. The bar to ship something useful has never been lower. The thing you build for yourself today is the thing your vendor will sell back to you in two years. Get ahead of it.
