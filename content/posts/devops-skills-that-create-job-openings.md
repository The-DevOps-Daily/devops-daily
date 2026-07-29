---
title: 'The DevOps Skills That Create Openings, Not Just Pass Filters'
excerpt: 'Most skill lists tell you what gets you past a screening. They do not tell you what makes a company decide to hire someone in the first place. Those are different lists, and the second one is shorter, more specific, and worth a lot more.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-29'
publishedAt: '2026-07-29T09:00:00Z'
updatedAt: '2026-07-29T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Career
  - Kubernetes
  - Terraform
  - FinOps
  - SRE
---

Every list of "DevOps skills for 2026" contains the same twelve items: Linux, Docker, Kubernetes, a cloud, Terraform, CI/CD, Python, monitoring, Git, Ansible, security, soft skills.

That list is not wrong. It is just answering a different question than the one you probably have.

Those skills get you through a screening. They are what a recruiter checks before forwarding your CV, and lacking them will lose you a role. But nobody has ever sat in a planning meeting and said "we should open a headcount because we need someone who knows Git". Roles do not get created because a skill exists. They get created because something is hurting enough that a budget appears.

So there are two lists. The one everyone publishes is table stakes: necessary, insufficient, and shared by every other applicant. The one worth studying is shorter, and it maps to the sentence a hiring manager actually said to get the role approved.

## Who this is for

- Engineers deciding what to learn next and tired of lists that recommend everything
- People with the table stakes already, wondering why the responses are thin
- Anyone who wants to understand hiring from the side that writes the budget

If you are earlier than that and trying to choose a direction, our post on [five DevOps career paths](/posts/devops-engineer-career-paths-next-five-years) covers the tracks themselves. This one is about what creates the vacancy.

## Why the table stakes do not create openings

A quick note on the market before the list. Demand is genuinely there: the Burning Glass Institute reported DevOps engineer postings growing around 18% annually since 2020, and the SRE and platform engineering titles have grown out of the same demand rather than replacing it.

But growth in postings does not mean growth in every skill equally, and the reason is structural. The table-stakes skills have been commoditised by the platforms themselves.

Nobody is paid to install Kubernetes any more. Managed control planes made that a solved problem: DigitalOcean's DOKS, EKS, GKE and AKS all hand you a working cluster from a form or an API call. The interesting work moved to everything that happens after the cluster exists, which is a different skill with the same name on a CV.

The same happened to provisioning. Writing HCL is not a differentiator when every platform ships a provider and the docs contain the resource you need. What is hard, and what people are actually hired for, is everything around the HCL: who owns the state, what happens when two teams touch the same resource, how a change gets reviewed when the plan output is four hundred lines.

The pattern repeats. Each generation of tooling makes the mechanical part easy and moves the value to the judgement part. Learning the mechanical part gets you screened in. Learning the judgement part is what someone writes a job description about.

## The skills that create openings

Here is the honest version of the second list. Each one maps to a sentence a manager said to get headcount approved.

### 1. Making a cloud bill go down without breaking anything

**The sentence:** "Our cloud spend went up 60% and nobody can tell me why."

This creates roles more reliably than almost anything else, because it is the rare technical problem with an obvious number attached. A finance team that cannot explain a line item will fund someone to explain it.

The skill is not "knows about reserved instances". It is being able to attribute spend to teams and features, find the three things that account for most of the growth, and change them without an incident. That means tagging discipline, understanding how your provider actually bills (per-second versus per-hour, egress, idle load balancers, orphaned volumes and snapshots nobody deleted), and enough political skill to tell a team their service is the problem.

It is also one of the few areas where you can demonstrate value before you are hired. If you can talk through a real example of finding and fixing a cost problem, that is worth more than a certification.

### 2. Reliability that survives contact with real traffic

**The sentence:** "We were down for four hours in March and the board asked what we are doing about it."

Outages create headcount. Not the small ones, the one that reached a customer or a board deck. The role that follows is usually funded for a year and framed as prevention.

What is being bought is not "knows Prometheus". It is the ability to look at a system and say where it will break first, and then to prove it: capacity that matches actual traffic patterns rather than a guess, alerts that correlate with users being unhappy rather than with CPU being interesting, and a runbook someone can follow at 3am without the person who wrote it.

The clearest signal you can give here is being able to walk someone through a real incident: what you saw, what you tried, what was wrong about your first theory, what you changed afterwards. Almost nobody prepares this and it lands every time.

### 3. Migrations, which are jobs shaped like projects

**The sentence:** "We are moving off the old thing and we do not have anyone who has done it before."

Migration work creates the most explicitly project-shaped hiring in the field: data centre to cloud, one cloud to another, VMs to containers, a monolith to services, or the increasingly common one, an over-engineered setup back to something smaller.

The skill is sequencing. Anyone can describe the target state. Getting from A to B while the business keeps running is the part that needs experience: what moves first, what runs in parallel, how you cut over without a big-bang weekend, and how you roll back when the cutover goes wrong at 2am.

This is also the work where "I have done this before" is worth the most, because the failure modes are not in the documentation.

### 4. Making a compliance question stop blocking a sale

**The sentence:** "We lost a deal because we could not answer their security questionnaire."

SOC 2, ISO 27001, HIPAA and the rest are treated as a tax by engineers and as a revenue blocker by everyone else. When a compliance gap costs a specific deal, headcount appears quickly, because the cost of not hiring has a number on it.

The skill is turning a control into infrastructure rather than a spreadsheet: access reviews that come from the identity provider rather than someone's memory, audit logs that are actually queryable, encryption and key rotation that is enforced rather than documented, and evidence that is generated rather than assembled the week before the audit.

It is not glamorous work and it is well paid for exactly that reason.

### 5. Building the platform your own developers use

**The sentence:** "It takes a new engineer two weeks to get their first change to production."

This is the platform engineering role, and its budget comes from developer productivity rather than infrastructure. That distinction matters: the case is made in terms of the other engineers' time, which is a much bigger number than the platform team's salary.

The skill is product sense applied to internal tools. Knowing which paved road to build, which to leave alone, and how to make the good path the easy path rather than the mandatory one. Platform teams fail when they build something technically impressive that developers work around, and the ability to tell those apart in advance is the thing being hired.

### 6. Running inference in production without a surprise bill

**The sentence:** "The AI feature works in the demo and we have no idea what happens when everyone uses it."

The newest of these, and the least crowded. Plenty of people can call a model API. Far fewer can answer what it costs at ten thousand requests a day, what happens when the provider rate-limits you mid-incident, how to cache and batch, when a smaller model is enough, and how to roll back a prompt change the way you roll back a deploy.

It is infrastructure work with a new failure surface: latency you do not control, costs that scale with usage rather than capacity, and quality regressions that no test catches. We wrote about a small version of this in [explaining CI failures with a GitHub Action](/posts/ci-log-triage-digitalocean-inference), where most of the engineering was reducing the input rather than calling the model.

## What this means for the table stakes

None of this makes the standard list optional. You still need it. The point is what you do with it once you have it.

Take Terraform. Having it on your CV clears a filter. What creates an opening is being the person who can walk into an organisation where three teams share one state file and nobody dares run apply on a Friday, and fix that. The provider is not the skill. Every platform publishes one, DigitalOcean's included, and the resource reference is a web page. The skill is the operating model around it.

Same with Kubernetes. The cluster is a form these days. What is scarce is knowing when a team should not be on Kubernetes at all, how to set requests and limits from real data rather than copied defaults, and how to keep the cost of the thing proportional to what it is running.

The general move is from "I can operate this tool" to "I can tell you what this should cost, when it will break, and what to do instead". That sentence is much harder to write on a CV, which is exactly why it is worth having.

## How to work out which one to chase

Rather than picking from this list by preference, read job descriptions as evidence. Three questions:

**What problem is this role written around?** A description that is a tool list is a screening exercise, and the company probably does not know what they want yet. A description with a paragraph about a specific situation, a migration, a scaling problem, an audit, is a role someone fought to create. Those hire faster and pay better.

**Who is the budget coming from?** Cost roles are funded by finance, reliability roles by whoever owned the outage, platform roles by engineering leadership. It tells you who your actual stakeholder is and what success will be measured on, which is useful before you accept rather than after.

**What did they try first?** Almost every one of these roles exists because someone already tried to solve the problem internally and could not. Asking what has already been attempted is the best interview question available, and the answer tells you whether the problem is technical or organisational. If it is organisational, no amount of Terraform will fix it and you should know that going in.

## The short version

The published skill lists are a floor, not a ladder. They describe what everyone has.

Openings are created by pain with a budget attached: a bill nobody can explain, an outage that reached the board, a migration nobody has done before, a deal blocked by a questionnaire, developers who take two weeks to ship, an AI feature with unknown economics.

Pick the pain you find interesting, get genuinely good at it, and be able to tell one real story about solving it. That story is what turns a filtered application into a conversation.
