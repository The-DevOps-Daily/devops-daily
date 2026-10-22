---
title: 'A Service Catalog Nobody Updates Is Worse Than None: We Checked 217 Entries Against GitHub'
excerpt: 'We checked 217 public Backstage catalog entries from 30 organizations against GitHub. One in ten was provably wrong, three owners in four could not be checked from outside, and where the catalog and CODEOWNERS both named an owner, they agreed only half the time. Here is the checker, the method, and how to keep a catalog honest.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-27'
publishedAt: '2026-10-27T09:00:00Z'
updatedAt: '2026-10-27T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Backstage
  - Service Catalog
  - Platform Engineering
  - CODEOWNERS
  - GitHub
  - Internal Developer Portal
---

We took 217 service catalog entries that 30 organizations publish on GitHub, in the Backstage `catalog-info.yaml` format, and checked each one against what GitHub says today. One in ten (21 entries) was provably wrong: an owner team GitHub cannot resolve, a CODEOWNERS file that names people or teams GitHub no longer accepts, a repository that was renamed while the catalog kept the old name, a dead link. That is the floor, not the total. For three entries in four, the owner could not be checked at all from outside the organization. And where the catalog and CODEOWNERS both named an owner for the same file, the two agreed, with every owner resolving, only half the time.

That matters most at the worst moment. During an incident, someone opens the catalog to find out who owns the failing service. With no entry, they go and ask. With a wrong entry, they page a team that was reorganized away, or a person who left, and they do it with confidence because the catalog said so. This post shows the checker we built, how we picked the sample, what it found, four bugs we found in our own method, and the habits that keep a catalog true.

## TL;DR

- 217 Component entries from 30 public GitHub organizations, checked on 2026-10-22: **21 (9.7%) had at least one provable drift**, 60 (27.6%) had only warnings, 136 (62.7%) had nothing we could find.
- Ownership is where catalogs go wrong. Of 73 entries whose catalog file is also covered by a CODEOWNERS rule, 37 agree and every owner resolves. 14 name owners that GitHub cannot resolve, and 22 name different owners (7 of those are probably the same team under two names).
- 158 entries (72.8%) have an owner nobody outside the org can verify, because GitHub teams are only visible to members. Inside your org you can check all of them, and the script does when its token can read the org.
- Links barely rotted: 2 of 152 were dead. But only 70 entries had any link, and none was labelled as a runbook. Public catalogs do not carry the links that rot fastest, so we could not test that part.
- We expected older catalog files to drift more. Drift was 7.1% for files changed in the last year and 12.4% for older ones, a gap this sample cannot tell apart from noise (p = 0.25).
- The fixes are boring and they work: derive owners from the source of truth, check `catalog-info.yaml` in CI, use GitHub's own CODEOWNERS validation, and delete entries nobody claims.

## Prerequisites

- Python 3.10 or later (the checker uses only the standard library)
- A GitHub token in `GITHUB_TOKEN`, or a logged-in `gh` CLI. To check owners inside your own org, the token needs to read the org's teams and members
- A catalog in the Backstage `catalog-info.yaml` format, or the public sample in the repository

```github
The-DevOps-Daily/service-catalog-drift
```

## Why a catalog drifts

A catalog entry is usually written once, by a scaffolder template, on the day the repository is created. After that, teams get reorganized and renamed, people move on, repositories are renamed or transferred, and documentation moves from one wiki to the next. None of those changes touch `catalog-info.yaml`.

None of them break anything either. Backstage's own [FAQ](https://backstage.io/docs/features/software-catalog/faq) tells plugin authors: "Never throw errors due to "soft" errors, in particular relations not matching an existing target". So an owner that points at a team that no longer exists loads and shows up like any other. GitHub [redirects a renamed repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository), so a catalog that still uses the old name keeps working, and nobody has a reason to look. The catalog stays green while it drifts away from the truth.

That is why a stale catalog can be worse than none. An empty owner field sends you looking. A wrong one sends you to the wrong place, quickly.

## What the checker compares

`drift.py` reads Backstage `Component` entities and checks five things against GitHub, all read-only:

| Check      | Drift (provably wrong)                                                                                                                      | Warning (look at it)                                                                                       | Cannot tell from outside                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| owner      | no `spec.owner`; a team GitHub cannot resolve; with org access, a team that does not exist or has no members, or a user who is not a member | a `user:` with no GitHub account of that name                                                              | a team that no CODEOWNERS file names; a user who is not a public member |
| repo       | the slug redirects (renamed or transferred); archived while the catalog does not say `deprecated`                                           | no human commit on the default branch in a year; a root catalog file that describes a different repository | a repository that is not visible (deleted or private)                   |
| codeowners | the CODEOWNERS rule for the catalog file names owners GitHub cannot resolve                                                                 | CODEOWNERS and the catalog name different owners                                                           |                                                                         |
| links      | 404 or 410, or a GitHub file, branch or repository that is gone                                                                             |                                                                                                            | 401, 403, 429, 5xx, timeouts, internal hostnames                        |
| lifecycle  |                                                                                                                                             | `production` or `experimental` with no human commit in a year; no lifecycle                                |                                                                         |

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "catalog-info.yaml", "sub": "Component entities", "icon": "box", "tone": "slate" },
    { "label": "Owner", "sub": "teams API or CODEOWNERS errors", "icon": "shield", "tone": "violet" },
    { "label": "Repository", "sub": "redirects, archive, commits", "icon": "branch", "tone": "blue" },
    { "label": "Links", "sub": "public addresses only", "icon": "globe", "tone": "green" },
    { "label": "Report", "sub": "reasons and exit code", "icon": "check", "tone": "amber" }
  ]
}
```

Only `drift` means the catalog is wrong. A warning is a fact worth a look: a library that works may not need a commit for a year. "Cannot tell" is reported as its own status and never counted as either.

### Checking an owner from outside the org

Inside your org, checking an owner is a lookup: does the team exist, does it have members, is this user a member. From outside, GitHub hides teams. But GitHub validates CODEOWNERS files, and it publishes the result. For a public repository, anyone can call [`GET /repos/{owner}/{repo}/codeowners/errors`](https://docs.github.com/en/rest/repos/repos#list-codeowners-errors-for-a-repository), and it lists every owner GitHub cannot resolve, with messages such as:

```text
Unknown owner on line 3: make sure the team @org/team exists, is publicly visible, and has write access to the repository
```

So if any CODEOWNERS file in the org names the catalog's owner team, GitHub can tell us whether that team resolves. The checker looks in the entry's own repository first, then runs one code search for the team in the org's other CODEOWNERS files. A team that no CODEOWNERS file names stays "cannot tell".

### Links come from strangers

The links in a catalog file are written by whoever wrote the file, so link checks are opt-in (`--check-links`) and careful. The token only ever goes to `api.github.com`, and github.com links are checked through the API with every path segment validated and quoted. Everything else gets a `HEAD`, then a `GET`, with no credentials and no cookies, at most one request per second per host. The host name is resolved once, every address must be public, and the request goes to that pinned address, so a second DNS answer cannot point it at an internal service. Every redirect hop is checked the same way.

## The sample

We wanted catalogs that real organizations maintain, not tutorials. The selection, all recorded in the repository:

1. GitHub code search for `filename:catalog-info.yaml path:/` on 2026-10-22, between 07:08 and 07:23 UTC. Code search returns at most 1,000 results per query, so `sample.py` splits the query by file size into 16 ranges. GitHub reported 8,864 matches; we fetched 9,761 unique repositories (code search counts are estimates).
2. 3,579 of those repositories belong to personal accounts and were dropped. The other 6,182 belong to 984 organizations. Code search returned no forks.
3. 53 organizations had a root `catalog-info.yaml` in 20 or more repositories. Many turned out to be test, demo or QA organizations for developer portals, so we kept the 30 that have a website on their GitHub profile and at least one repository with 10 or more stars. The excluded ones are stored as hashes, because many are named after a person.
4. From each of the 30, 8 repositories at random (seed 20261022): 240 files. One was a scaffolder template, one was not valid YAML, and 24 held no Component entity, only other kinds. That leaves **217 Component entries in 213 repositories**.

The 30 organizations are a mix of companies, public bodies, research institutes and open-source projects: bcgov, broadinstitute, cds-snc, Clever, contentful, cultureamp, DEFRA, dell, DiamondLightSource, dwp, eduNEXT, elastic, equinor, grafana, hmcts, Invoca, Kajabi, kartverket, open-dxp, openedx, pantheon-systems, prime-radiant-inc, radiorabe, reearth, sendbird, snyk, sourcefuse, spotify, Unity-Technologies and vtex-apps.

Every organization contributes the same 8 repositories, so the totals are an average over organizations, not over every public catalog entry.

## The run

One pass makes about 1,700 GitHub API requests, cached on disk so a re-run repeats none of them, plus 166 requests for the links. `--redact` keeps people out of the output: user logins become `user:<redacted>`, and owner and team names become a hash that is only stable within one run, which is why you see `group:<e4d6ef>` below. The committed results name organizations, repositories and services, never a person.

```terminal
{
  "title": "drift.py on the public sample",
  "steps": [
    {
      "cmd": "python3 drift.py --sample sample/sample-2026-10-22.json --check-links --redact --quiet > report.txt 2>/dev/null",
      "output": ""
    },
    {
      "cmd": "echo $?",
      "output": "1"
    },
    {
      "cmd": "tail -7 report.txt",
      "output": "217 entries from 238 files (1 templates, 1 unparsed, 0 unreadable skipped)\n  drift 21 (9.7%), warn 60, ok 136\n  owner      drift 4, ok 54, unverifiable 158, warn 1\n  repo       drift 4, ok 170, warn 43\n  codeowners drift 14, n/a 144, ok 37, warn 22\n  links      drift 2, n/a 147, ok 63, unverifiable 5\n  lifecycle  n/a 38, ok 148, warn 31"
    },
    {
      "cmd": "grep -A2 -E '^DRIFT +(com.unity.services.samples.relationships|loopback4-microservice-catalog|kaizen-design-system) ' report.txt",
      "output": "DRIFT  com.unity.services.samples.relationships  (Unity-Technologies/com.unity.services.samples.friends:catalog-info.yaml)  owner group:<e4d6ef>\n         repo       drift        Unity-Technologies/com.unity.services.samples.relationships moved to Unity-Technologies/com.unity.services.samples.friends\n         codeowners drift        CODEOWNERS line 2 names owners GitHub cannot resolve: @Unity-Technologies/<bacfce>\n--\nDRIFT  kaizen-design-system  (cultureamp/kaizen-design-system:catalog-info.yaml)  owner group:<29be1f>\n         codeowners drift        CODEOWNERS line 4 names owners GitHub cannot resolve: @cultureamp/<4f0a78>\n         links      drift        1 of 5 links dead: other https://cultureamp.design/<path 642625a6c6> (HTTP 404)\n--\nDRIFT  loopback4-microservice-catalog  (sourcefuse/loopback4-microservice-catalog:catalog-info.yaml)  owner group:<f0110c>\n         owner      drift        GitHub cannot resolve @sourcefuse/<f0110c> in .github/CODEOWNERS of this repository (team deleted, renamed, secret, or without write access)\n         codeowners drift        .github/CODEOWNERS line 5 names owners GitHub cannot resolve: @sourcefuse/<f0110c>"
    }
  ]
}
```

The exit code is 1 because drift was found, so the same command can fail a CI job. Three of the 21 entries show the main kinds of drift. The Unity sample was renamed from `relationships` to `friends`, and its catalog entry still points at the old name, while line 2 of its CODEOWNERS names a team GitHub cannot resolve. In cultureamp's design system, a CODEOWNERS team does not resolve and the Storybook link answers 404. In sourcefuse's microservice catalog, the catalog's own owner team is the one GitHub cannot resolve in the same repository's CODEOWNERS.

## What it found

```chart
{
  "type": "bar",
  "title": "What 217 public catalog entries got wrong",
  "unit": "%",
  "caption": "Share of all 217 entries with each finding; an entry can have more than one. 30 GitHub organizations, 8 random repositories each, checked 2026-10-22. Source: results/summary-20261022T081013Z.json in the demo repository.",
  "rows": [
    { "label": "CODEOWNERS names an owner GitHub cannot resolve (14)", "value": 6.5, "series": "Drift" },
    { "label": "Repository renamed, catalog has the old name (4)", "value": 1.8, "series": "Drift" },
    { "label": "Owner team GitHub cannot resolve (3)", "value": 1.4, "series": "Drift" },
    { "label": "Dead link (2)", "value": 0.9, "series": "Drift" },
    { "label": "No owner at all (1)", "value": 0.5, "series": "Drift" },
    { "label": "No human commit in a year (41)", "value": 18.9, "series": "Warning" },
    { "label": "Says production or experimental, idle a year (28)", "value": 12.9, "series": "Warning" },
    { "label": "Catalog and CODEOWNERS name different owners (22)", "value": 10.1, "series": "Warning" }
  ],
  "series": [
    { "name": "Drift", "color": "#ef4444" },
    { "name": "Warning", "color": "#f59e0b" }
  ]
}
```

### Ownership is the part that is wrong

Most of the drift is about who owns what. The clearest view is the 73 entries whose catalog file is also covered by a CODEOWNERS rule, so there are two records of the owner to compare:

```terminal
{
  "title": "summarize.py",
  "steps": [
    {
      "cmd": "python3 summarize.py results/run-20261022T081013Z.json | sed -n '/^catalog vs CODEOWNERS/,/Fisher/p'",
      "output": "catalog vs CODEOWNERS: 73 entries with both; agree and resolve 37 (50.7%); unknown owners 14 (teams 8, users 6)\n  disagree:   4  catalog names a team, CODEOWNERS people\n  disagree:  11  different team names\n  disagree:   7  one team name contains the other\ndrift by file age: under 1 year {'entries': 112, 'drift': 8, 'pct': 7.1}, 1 year or more {'entries': 105, 'drift': 13, 'pct': 12.4}, Fisher p = 0.251"
    }
  ]
}
```

```chart
{
  "type": "bar",
  "title": "73 entries with both a catalog owner and a CODEOWNERS rule",
  "caption": "One team name contains the other, for example a short catalog name inside a longer GitHub team slug: probably the same team. Unresolvable owners are what GitHub's CODEOWNERS validation reports for the rule that covers the catalog file.",
  "rows": [
    { "label": "Agree, every owner resolves", "value": 37, "series": "Agree" },
    { "label": "Same team under two names", "value": 7, "series": "Probably fine" },
    { "label": "Different team names", "value": 11, "series": "Wrong somewhere" },
    { "label": "Catalog names a team, CODEOWNERS people", "value": 4, "series": "Wrong somewhere" },
    { "label": "CODEOWNERS owner GitHub cannot resolve", "value": 14, "series": "Wrong somewhere" }
  ],
  "series": [
    { "name": "Agree", "color": "#10b981" },
    { "name": "Probably fine", "color": "#38bdf8" },
    { "name": "Wrong somewhere", "color": "#ef4444" }
  ]
}
```

37 agree. 7 more probably name the same team twice: in four snyk repositories, the catalog uses a short team name that is part of the longer GitHub team slug in CODEOWNERS. That leaves 29 of 73 entries, 40%, where at least one of the two ownership records points at the wrong owner or at an owner GitHub cannot resolve. Of the 14 with unresolvable owners, 8 involve a team and 6 involve individual users. GitHub reports a team as unknown when it was deleted or renamed, is secret, or has no write access to the repository; any of those means the team no longer reviews that code.

Unresolvable owners repeat. In vtex-apps, the same unknown team sits on line 3 of the CODEOWNERS in three of the eight sampled repositories, which looks like a file copied from a template and never updated. Three organizations hold 12 of the 21 drifted entries, and 19 of the 30 had none.

The owner field itself could be checked for only 59 entries (27%): 38 through the entry's own CODEOWNERS, 18 through another repository's CODEOWNERS, one through GitHub's public membership list, one that had no owner at all, and one user ID GitHub does not know (more on that below). 3 of the 59 named a team GitHub cannot resolve anywhere it is named. Backstage [requires](https://backstage.io/docs/features/software-catalog/descriptor-format) `spec.owner` on a Component, so the entry without an owner probably never loaded into anyone's catalog.

### Repositories that moved

4 entries (1.8%) point at a repository by a name it no longer has. GitHub redirects the old name, so links and API calls keep working. But GitHub's documentation warns that if anyone creates a new repository with the old name, "redirects to the renamed repository will no longer work", and the catalog entry then points at someone else's code. 2 more entries live in one repository but describe another, which is what a catalog file copied from a sibling repository and never edited looks like.

We found no archived repositories. That is a gap in the sample, not good news: code search returned no archived repositories at all, and Backstage's [GitHub discovery](https://backstage.io/docs/integrations/github/discovery) skips them by default (`allowArchived` defaults to `false`).

### Idle, but still "production"

41 entries (18.9%) live in repositories whose default branch had no human commit for over a year (39), or only bot commits among its last 30 (2). We do not count Dependabot, Renovate or other bot commits as activity. 28 of those 41 still say `production` (19) or `experimental` (9). A stable library can go a year without a change, so this is a warning, not drift. An `experimental` service with no human commit for a year is a decision nobody made.

### Links

Only 70 of 217 entries (32%) had any link at all. Of 152 links, 133 answered, 2 were dead, and 17 could not be checked: 12 pointed at hostnames that do not resolve in public DNS (internal tools, most likely), and 5 answered 403. The two dead ones were a Storybook page and a vulnerability report page on a vendor's site; both answer 404, also to a browser.

None of the 152 links was a runbook, an on-call schedule or a dashboard behind a login, which are the links most likely to rot. Public catalogs do not publish them. If you run this on your own catalog, the link check is where we would expect your numbers to differ most from ours.

### Does a catalog decay with age?

```chart
{
  "type": "bar",
  "title": "Drift by when the catalog file last changed",
  "unit": "%",
  "caption": "Share of entries with at least one drift, by the date of the last commit that touched catalog-info.yaml. Under one year: 8 of 112. One year or more: 13 of 105. Fisher's exact test p = 0.25.",
  "rows": [
    { "label": "Under 6 months (81)", "value": 9.9 },
    { "label": "6 to 12 months (31)", "value": 0 },
    { "label": "1 to 2 years (48)", "value": 12.5 },
    { "label": "Over 2 years (57)", "value": 12.3 }
  ]
}
```

We expected a clear slope. There is a small one: 7.1% for files changed in the last year against 12.4% for older files. With 112 and 105 entries, Fisher's exact test gives p = 0.25, so a difference this size could easily be chance. Drift and warnings together do climb with age, from 25% to 54%, but mostly by construction: a repository with no commits for a year also has a catalog file that nobody touched for a year. The median catalog file in the sample was last changed 352 days before we checked it.

A single snapshot also cannot see the worst decay. Entries that rotted badly enough to be noticed may have been deleted, and deleted entries are not in a sample of files that still exist.

## Four bugs in our own checker

Each of these changed, or could have changed, a number in this post. Two of them made the result look worse than it is.

1. **A user ID that looks like a GitHub login.** One organization names users by an ID from its own directory, three letters and five digits, which is also a valid GitHub login. GitHub had no account by that name, and the first version reported a departed owner. A missing account is now a warning, unless you pass `--users-are-github-logins` for a catalog where you know users are GitHub logins. This lowered drift from 22 to 21 entries.
2. **GitHub's two error formats.** For a user, the CODEOWNERS error says `make sure @user exists`; for a team, `make sure the team @org/team exists, is publicly visible, ...`. The first version only parsed the user form, and for teams it fell back to marking every owner on the line as unknown. It changed no result in this sample, because no affected line also named a valid owner, but on another catalog it would have.
3. **A YAML reader that was too forgiving.** The checker has its own small YAML reader to stay dependency-free. One sampled file had `description:` at the wrong indentation, which swallowed the `annotations:` block below it. PyYAML rejects that file, and so would Backstage; our reader accepted it. It now raises the same error, and a cross-check against PyYAML on all 240 files agrees on every field the checker reads, with the one invalid file rejected by both. This removed one entry (218 to 217).
4. **People in the output.** A bare owner such as `owner: someone` is treated as a team by Backstage, but it is sometimes a person's login, and one owner was an email address. The first full run printed them. That file was deleted, and owner and team names are now hashed with a key that is never written down.

A fifth problem was smaller: a link with a space in it stopped the first run after about 100 entries. Links are now percent-encoded the way a browser does it, and an error in one entry no longer stops the run.

## False positives, and what we could not check

- **A team GitHub cannot resolve is not always deleted.** GitHub's message covers deleted, renamed, secret, and teams without write access to that repository. All four mean the team does not own reviews there, but only the first two mean it is gone.
- **Different names can be the same people.** A parent team and a child team, or a Backstage group name that differs from the GitHub team slug, show up as a disagreement. That is why disagreement is a warning.
- **A link that answers is not always alive.** A 200 can be a login page, or a "page not found" that answers 200. We count both as working. A 403 from a site that blocks scripts is "cannot tell".
- **Bot detection is by name.** A person merging a bot's pull request counts as human activity, so "no human commit in a year" is an undercount.
- **Owner coverage is uneven.** We could check 27% of owners, and only those named in some CODEOWNERS file. Teams that appear in CODEOWNERS may be better or worse kept than the rest; we cannot tell which.
- **Private catalogs are not in the sample.** Public open-source repositories may be kept better or worse than internal ones, and internal catalogs carry the runbook, on-call and dashboard links we could not test.

## How to keep a catalog honest

### Derive owners, do not type them

Most of the disagreements above are two hand-typed names for the same thing. Load groups from the source of truth instead: Backstage's [GitHub org provider](https://backstage.io/docs/integrations/github/org) mirrors GitHub teams as Groups on a schedule, and the catalog products sync from identity providers. Then the owner in `catalog-info.yaml` and the handle in CODEOWNERS are the same string, and a machine can compare them:

```yaml
# catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payments-api
  annotations:
    github.com/project-slug: acme/payments-api
spec:
  type: service
  lifecycle: production
  owner: group:default/payments # the GitHub team slug, not a display name
```

```text
# .github/CODEOWNERS: the same team, so the two can be checked against each other
*    @acme/payments
```

### Check the catalog file in CI

Drift arrives two ways: someone edits the file badly, or the world changes while nobody touches it. A pull request check catches the first, a weekly scheduled run catches the second. The repository ships this workflow in `examples/`:

```yaml
name: catalog drift

on:
  pull_request:
    paths: ['catalog-info.yaml', '.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']
  schedule:
    - cron: '17 6 * * 1'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/checkout@v5
        with:
          repository: The-DevOps-Daily/service-catalog-drift
          ref: main # pin this to a commit SHA you have read
          path: .catalog-drift
      - uses: actions/setup-python@v6
        with:
          python-version: '3.13'
      - name: check catalog-info.yaml
        env:
          # The default token cannot read org teams; use a token with Members: read for full owner checks
          GITHUB_TOKEN: ${{ secrets.CATALOG_DRIFT_TOKEN || github.token }}
          REPO: ${{ github.repository }}
        run: python .catalog-drift/drift.py catalog-info.yaml --repo "$REPO" --check-links --no-org-search
```

### Use the check GitHub already runs

You do not need our script to find the worst cases. GitHub already validates every CODEOWNERS file, and one call per repository lists what it cannot resolve:

```bash
# Owners GitHub cannot resolve in this repository's CODEOWNERS
gh api repos/OWNER/REPO/codeowners/errors \
  --jq '.errors[] | "line \(.line): \(.message | split("\n")[0])"'
```

Loop it over every repository in your org once a month. Each line it prints is a review request that goes nowhere, and usually a catalog owner that is wrong too.

### Give the scorecard consequences

Every catalog product has scorecards, and so does Backstage through the Tech Insights plugin. The useful checks are the ones in this post: the owner resolves, the runbook link answers, the lifecycle matches the activity. A score only changes behaviour when it is attached to something people see, such as a comment on the pull request or a weekly list sent to each owning team, rather than a dashboard nobody opens.

### Delete what nobody claims

An entry whose owner does not resolve and whose repository has been idle for a year has nobody to fix it. Open an issue for the last known owner, mark the entry `deprecated` if nobody answers in 30 days, and remove it 30 days later. A missing entry is honest. A wrong one is not.

## Build or buy

Every catalog product handles freshness with some mix of the same three tools: sync from a source of truth, automatic discovery, and scorecards. Here is what each one's public documentation says, in alphabetical order:

- **Backstage** (open source) mirrors GitHub teams and users with its [org provider](https://backstage.io/docs/integrations/github/org), finds `catalog-info.yaml` files with [GitHub discovery](https://backstage.io/docs/integrations/github/discovery), and removes [orphaned entities](https://backstage.io/docs/features/software-catalog/life-of-an-entity). As quoted above, it accepts relations that point at nothing. Checks on catalog data, including the owner field, come from the [Tech Insights](https://github.com/backstage/community-plugins/tree/main/workspaces/tech-insights/plugins/tech-insights-backend) community plugin.
- **Cortex** has [scorecard rules](https://docs.cortex.io/scorecards/scorecard-examples) such as "has an owner" and "has a runbook", syncs [ownership](https://docs.cortex.io/ingesting-data-into-cortex/entities/ownership) daily from identity providers, Git hosts and HR systems, and can [auto-archive](https://docs.cortex.io/ingesting-data-into-cortex/entities-overview/entities/archiving-entities/auto-archive) entities whose repository was deleted or archived.
- **Humanitec** says in its [own docs](https://developer.humanitec.com/platform-orchestrator/docs/humanitec-vs-others/overview/) that it is not an internal developer portal: the Platform Orchestrator is the backend of a platform and [complements](https://developer.humanitec.com/platform-orchestrator/docs/humanitec-vs-others/backstage-port-cortex-etc./) portals such as Backstage, Port and Cortex. Catalog freshness is the portal's job in that setup.
- **OpsLevel** has a [component ownership check](https://docs.opslevel.com/docs/getting-started-with-rubrics) in its rubric, [syncs GitHub teams](https://docs.opslevel.com/docs/github-teams-sync) every 12 hours (the page notes that deleted teams and users are not synced), [detects services](https://docs.opslevel.com/docs/service-detection) from repositories and suggests owners from commit authors, and [removes repositories](https://docs.opslevel.com/docs/repositories) deleted at the Git provider.
- **Port** has [scorecards](https://docs.port.io/governance/standards-and-compliance/examples/scorecard-use-cases/) with a "has a team" rule, [syncs users and teams](https://docs.port.io/context-lake/business-context/ownership/) from SSO and Git providers, deletes entities that are gone from the source on a [full resync](https://docs.port.io/context-lake/ingestion/ingest-data-into-port/native-integrations/sync-mechanisms/full-resync/), and has a [guide for mapping CODEOWNERS](https://www.docs.port.io/guides/all/connect-github-codeowners-with-service-team-and-user) to teams.
- **Roadie** is managed Backstage: `catalog-info.yaml` is its [native format](https://roadie.io/docs/catalog/overview), it discovers files from Git providers, runs [Tech Insights](https://roadie.io/docs/tech-insights/introduction/) scorecards, and its Catalog Completeness beta [suggests owners](https://roadie.io/docs/catalog/repositories/) for repositories.

If you already run Backstage, the checks in this post fit in a standard-library Python script that runs in CI. What the products add is the plumbing around them: syncing from HR and identity systems, a scorecard people actually look at, and someone else keeping it running. Whichever way you go, test it the way we tested ours. The repository has a fixture catalog with one of each kind of drift; point your tool at something like it and confirm it fails on each one. A tool you have only seen report "all good" has not shown you that it can find anything.

## What we could not conclude

- **Whether catalogs decay with age.** The slope we saw (7.1% to 12.4%) is within chance for this sample, and one snapshot cannot measure a rate.
- **Whether three owners in four are right.** 158 owners were invisible from outside. The 7% drift rate among the owners we could check does not carry over to them.
- **Whether runbooks and on-call links rot.** None were public.
- **How private catalogs compare.** Every entry here is in a public repository.
- **Whether a wrong entry ever caused a bad page.** "Worse than none" is an argument about how people use catalogs during incidents, not something this data measures.

## Summary

- Check a catalog against the systems it describes, not against itself. Ours found 21 provably wrong entries in 217 that all looked fine in their own files.
- Ownership is the weak part. Where two records of the owner existed, 40% disagreed or named someone GitHub could not resolve.
- From outside an org, most owners cannot be checked at all. From inside, they all can, so run the check where the token can see your teams.
- Make owners the same string everywhere by deriving them from GitHub teams or your identity provider, then compare catalog and CODEOWNERS in CI.
- Run the check on a schedule too: a team deleted in a reorg changes no file.
- Remove entries nobody claims. A gap sends people asking; a wrong answer sends them to the wrong place.

The checker, the sample, every result and the tests are in [The-DevOps-Daily/service-catalog-drift](https://github.com/The-DevOps-Daily/service-catalog-drift). Run it against your own catalog, with a token that can see your teams, and see how your numbers compare.
