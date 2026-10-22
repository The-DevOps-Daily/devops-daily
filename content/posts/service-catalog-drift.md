---
title: 'A Service Catalog Nobody Updates Can Be Worse Than None: We Checked 217 Entries Against GitHub'
excerpt: 'We checked 217 public Backstage catalog entries from 30 organizations against GitHub. One in ten had a record GitHub contradicts, three owners in four could not be checked from outside, and where the catalog and CODEOWNERS both named an owner, they agreed only half the time. Here is the checker, the method, and how to keep a catalog honest.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-22'
publishedAt: '2026-10-22T09:00:00Z'
updatedAt: '2026-10-22T09:00:00Z'
readingTime: '20 min read'
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

We took 217 service catalog entries that 30 organizations publish on GitHub, in the Backstage `catalog-info.yaml` format, and checked each one against what GitHub says today. For one in ten (21 entries), GitHub contradicted a record: in 9 the catalog entry itself was wrong (a repository renamed while the catalog kept the old name, a repository reference without its owner, a dead link, no owner at all), and in 12 the CODEOWNERS file next to it named people or teams GitHub no longer accepts. That is a floor, not a total. For three entries in four, the owner could not be checked at all from outside the organization. And where the catalog and CODEOWNERS both named an owner for the same file, the two agreed, with every owner resolving, only half the time.

That matters most at the worst moment. During an incident, someone opens the catalog to find out who owns the failing service. With no entry, they go and ask. With a wrong entry, they can page a team that was reorganized away, or a person who left, and do it with confidence because the catalog said so. We did not measure that happening; it is the reason the measurement is worth doing. This post shows the checker we built, how we picked the sample, what it found, the bugs two reviews found in our own method, and the habits that keep a catalog true.

## TL;DR

- 217 Component entries from 214 public repositories in 30 GitHub organizations, checked on 2026-10-22: **21 (9.7%) had at least one record GitHub contradicts**, 9 of them in the catalog entry itself and 12 only in the CODEOWNERS file next to it. 62 (28.6%) had only warnings, and 134 (61.8%) had nothing we could find.
- Ownership is where the records disagree. Of 73 entries whose catalog file is also covered by a CODEOWNERS rule, 37 agree and every owner resolves. 14 name owners that GitHub cannot resolve, and 22 name different owners (in 7 of those, one team name contains the other, which may be the same team).
- 159 entries (73.3%) have an owner nobody outside the org can check: GitHub teams are only visible to members, and some owners come from other directories. With a token that can read your org, the script checks teams and members directly.
- Links barely rotted: 2 of 152 were dead. But only 70 entries had any link, and none was titled as a runbook or a dashboard. We could not test the links that probably matter most during an incident.
- We expected older catalog files to drift more. Drift was 8.0% for files changed in the last year and 11.4% for older ones, a gap this sample cannot tell apart from chance.
- The fixes are boring and they work: derive owners from the source of truth, check `catalog-info.yaml` in CI, use GitHub's own CODEOWNERS validation, and retire entries nobody claims.

## Prerequisites

- Python 3.10 or later (the checker uses only the standard library)
- A GitHub token in `GITHUB_TOKEN`, or a logged-in `gh` CLI. To check owners inside your own org, the token needs to read the org's teams and members
- A catalog in the Backstage `catalog-info.yaml` format, or the public sample in the repository

```github
The-DevOps-Daily/service-catalog-drift
```

## Why a catalog drifts

A catalog entry is usually written once, by a scaffolder template, on the day the repository is created. After that, teams get reorganized and renamed, people move on, repositories are renamed or transferred, and documentation moves from one wiki to the next. None of those changes touch `catalog-info.yaml`.

None of them break anything either. Backstage's own [FAQ](https://backstage.io/docs/features/software-catalog/faq), answering whether a plugin should reject entities that fail validation, says: "Never throw errors due to "soft" errors, in particular relations not matching an existing target". So an owner that points at a team that no longer exists loads and shows up like any other. GitHub [redirects a renamed repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository), so a catalog that still uses the old name keeps working, and nobody has a reason to look. The catalog stays green while it drifts away from the truth.

That is why a stale catalog can be worse than none. An empty owner field sends you looking. A wrong one can send you to the wrong place, quickly.

## What the checker compares

`drift.py` reads Backstage `Component` entities and checks five things against GitHub, all read-only:

| Check      | Drift (GitHub contradicts it)                                                                                                                           | Warning (look at it)                                                                                             | Cannot tell from outside                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| owner      | no `spec.owner`; with org access, a team that does not exist or has no members                                                                          | a team GitHub cannot resolve in the CODEOWNERS files that name it; a `user:` with no GitHub account of that name | a team no CODEOWNERS file names; a user who is not a public member; a group in another directory |
| repo       | the slug redirects (renamed or transferred); a `github.com/project-slug` that is not `owner/repo`; archived while the catalog does not say `deprecated` | no human commit on the default branch in a year; a root catalog file that describes a different repository       | a repository that is not visible (deleted or private)                                            |
| codeowners | the CODEOWNERS rule for the catalog file names owners GitHub's validation cannot resolve                                                                | CODEOWNERS and the catalog name different owners                                                                 | GitHub's validation not readable                                                                 |
| links      | 404 or 410; a GitHub file missing at a ref that exists                                                                                                  |                                                                                                                  | 401, 403, 429, 5xx, timeouts, internal hostnames, pages below a GitHub repository                |
| lifecycle  |                                                                                                                                                         | `production` or `experimental` with no human commit in a year; no lifecycle                                      |                                                                                                  |

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

A drift on the CODEOWNERS check is about the file that routes code reviews, not about the catalog entry itself. We count both because both are ownership records people rely on, but we report them separately below. A warning is a fact worth a look: a library that works may not need a commit for a year. "Cannot tell" is its own status and never counted as either.

### Checking an owner from outside the org

Inside your org, checking an owner is a lookup: does the team exist, does it have members, is this user a member. From outside, GitHub hides teams. But GitHub validates CODEOWNERS files, and it publishes the result. For a public repository, anyone can call [`GET /repos/{owner}/{repo}/codeowners/errors`](https://docs.github.com/en/rest/repos/repos#list-codeowners-errors-for-a-repository), and it lists every owner GitHub cannot resolve, with messages such as:

```text
Unknown owner on line 3: make sure the team @org/team exists, is publicly visible, and has write access to the repository
```

So if any CODEOWNERS file in the org names the catalog's owner team, GitHub can tell us whether that team resolves. The checker looks in the entry's own repository first, then runs one code search for the team in the org's other CODEOWNERS files. A team that resolves exists. A team that does not resolve might be deleted, renamed, secret, or only lack write access there, so on the owner check it is a warning, not drift. A team that no CODEOWNERS file names stays "cannot tell". All of this assumes Backstage group names are GitHub team slugs, which is what Backstage's GitHub org provider produces; groups from other namespaces are not mapped.

### Links come from strangers

The links in a catalog file are written by whoever wrote the file, so link checks are opt-in (`--check-links`) and careful. The token only ever goes to `api.github.com`, and github.com links are checked through the API with every path segment validated and quoted. Everything else gets a `HEAD`, then a `GET`, with no credentials and no cookies, at most one request per second per host. The host name is resolved once, every address must be public, and the request goes to that pinned address, so a second DNS answer cannot point it at an internal service. Every redirect hop is checked the same way.

## The sample

We wanted catalogs that real organizations maintain, not tutorials. The selection, all recorded in the repository:

1. GitHub code search for `filename:catalog-info.yaml path:/` (files up to 20,000 bytes) on 2026-10-22, between 07:08 and 07:23 UTC. Code search returns at most 1,000 results per query, so `sample.py` splits the query by file size into 16 ranges. GitHub reported 8,864 matches; we fetched 9,761 unique repositories (code search counts are estimates).
2. 3,579 of those repositories belong to personal accounts and were dropped. The other 6,182 belong to 984 organizations. Code search returned no forks.
3. 53 organizations had a root `catalog-info.yaml` in 20 or more repositories. Many turned out to be test, demo or QA organizations for developer portals, so we kept the 30 that have a website on their GitHub profile and at least one repository with 10 or more stars. That rule keeps out obvious test orgs; it does not prove that every sampled repository is a real service, and a few are demos or samples. The excluded orgs are stored as hashes, because many are named after a person.
4. From each of the 30, 8 repositories at random (seed 20261022): 240 files. One was a scaffolder template, one was not valid YAML, and 24 held no Component entity, only other kinds. That leaves **217 Component entries from 214 repositories**.

The 30 organizations are a mix of companies, public bodies, research institutes and open-source projects: bcgov, broadinstitute, cds-snc, Clever, contentful, cultureamp, DEFRA, dell, DiamondLightSource, dwp, eduNEXT, elastic, equinor, grafana, hmcts, Invoca, Kajabi, kartverket, open-dxp, openedx, pantheon-systems, prime-radiant-inc, radiorabe, reearth, sendbird, snyk, sourcefuse, spotify, Unity-Technologies and vtex-apps.

Every organization contributed 8 repositories, but a repository can hold several entries or none, so organizations contribute between 1 and 10 entries. The shares in this post are pooled over entries. Averaged per organization instead, the drift share is 10.7% rather than 9.7%.

So the population this describes is narrow: root-level `catalog-info.yaml` files in public repositories of organizations that use them widely. Catalog files elsewhere in a repository, catalogs kept in a separate repository, and private catalogs are not in it.

## The run

One pass makes about 1,700 GitHub API requests, cached on disk per token for 24 hours. `--redact` keeps people out of the output: user logins become `user:<redacted>`, and owner and team names become a hash with a key that is random per run, which is why you see `group:<56b023>` below and different hashes in the committed results. The results name organizations, repositories and services, never a person.

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
      "output": "217 entries from 238 files (1 templates, 1 unparsed, 0 unreadable skipped)\n  drift 21 (9.7%), warn 62, ok 134\n  owner      drift 1, ok 53, unverifiable 159, warn 4\n  repo       drift 6, ok 168, warn 43\n  codeowners drift 14, n/a 144, ok 37, warn 22\n  links      drift 2, n/a 147, ok 63, unverifiable 5\n  lifecycle  n/a 38, ok 148, warn 31"
    },
    {
      "cmd": "awk '/^(DRIFT|WARN) /{p=($2==\"com.unity.services.samples.relationships\"||$2==\"changelog-github\"||$2==\"kaizen-design-system\"||$2==\"loopback4-microservice-catalog\")} p' report.txt",
      "output": "DRIFT  com.unity.services.samples.relationships  (Unity-Technologies/com.unity.services.samples.friends:catalog-info.yaml)  owner group:<56b023>\n         repo       drift        Unity-Technologies/com.unity.services.samples.relationships moved to Unity-Technologies/com.unity.services.samples.friends\n         codeowners drift        CODEOWNERS line 2 names owners GitHub cannot resolve: @Unity-Technologies/<072a85>\nDRIFT  changelog-github  (cultureamp/changelog-github:catalog-info.yaml)  owner group:<ffb463>\n         repo       drift        github.com/project-slug is not a valid owner/repo\nDRIFT  kaizen-design-system  (cultureamp/kaizen-design-system:catalog-info.yaml)  owner group:<159434>\n         codeowners drift        CODEOWNERS line 4 names owners GitHub cannot resolve: @cultureamp/<15544f>\n         links      drift        1 of 5 links dead: other https://cultureamp.design/<path 642625a6c6> (HTTP 404)\nDRIFT  loopback4-microservice-catalog  (sourcefuse/loopback4-microservice-catalog:catalog-info.yaml)  owner group:<046fce>\n         owner      warn         GitHub cannot resolve @sourcefuse/<046fce> in the CODEOWNERS files that name it (deleted, renamed, secret, or without write access)\n         codeowners drift        .github/CODEOWNERS line 5 names owners GitHub cannot resolve: @sourcefuse/<046fce>"
    }
  ]
}
```

The exit code is 1 because drift was found, so the same command can fail a CI job. The four entries above show the main kinds. The Unity sample was renamed from `relationships` to `friends`, its catalog entry still uses the old name, and line 2 of its CODEOWNERS names a team GitHub cannot resolve. cultureamp's changelog tool sets `github.com/project-slug` to the repository name without its owner, which Backstage's GitHub integrations cannot use. In cultureamp's design system, a CODEOWNERS team does not resolve and the Storybook link answers 404. In sourcefuse's microservice catalog, the catalog's own owner team is the one GitHub cannot resolve in the same repository's CODEOWNERS: drift for the CODEOWNERS file, a warning for the owner.

## What it found

```chart
{
  "type": "bar",
  "title": "What 217 public catalog entries got wrong",
  "unit": "%",
  "caption": "Share of all 217 entries with each finding; an entry can have more than one. 30 GitHub organizations, 8 random repositories each, checked 2026-10-22. Source: results/summary-20261022T091627Z.json in the demo repository.",
  "rows": [
    { "label": "CODEOWNERS names an owner GitHub cannot resolve (14)", "value": 6.5, "series": "Drift" },
    { "label": "Repository renamed, catalog has the old name (4)", "value": 1.8, "series": "Drift" },
    { "label": "project-slug is not owner/repo (2)", "value": 0.9, "series": "Drift" },
    { "label": "Dead link (2)", "value": 0.9, "series": "Drift" },
    { "label": "No owner at all (1)", "value": 0.5, "series": "Drift" },
    { "label": "No human commit in a year (39)", "value": 18.0, "series": "Warning" },
    { "label": "Says production or experimental, idle a year (28)", "value": 12.9, "series": "Warning" },
    { "label": "Catalog and CODEOWNERS name different owners (22)", "value": 10.1, "series": "Warning" },
    { "label": "Owner team does not resolve where it is named (3)", "value": 1.4, "series": "Warning" }
  ],
  "series": [
    { "name": "Drift", "color": "#ef4444" },
    { "name": "Warning", "color": "#f59e0b" }
  ]
}
```

### Ownership is where the records disagree

Most findings are about who owns what. The clearest view is the 73 entries whose catalog file is also covered by a CODEOWNERS rule, so there are two records of the owner to compare:

```terminal
{
  "title": "summarize.py",
  "steps": [
    {
      "cmd": "python3 summarize.py results/run-20261022T091627Z.json | sed -n '/^catalog vs CODEOWNERS/,/Fisher/p'",
      "output": "catalog vs CODEOWNERS: 73 entries with both; agree and resolve 37 (50.7%); unknown owners 14 (teams 8, users 6)\n  disagree:   4  catalog names a team, CODEOWNERS people\n  disagree:  11  different team names\n  disagree:   7  one team name contains the other\ndrift by file age: under 1 year {'entries': 112, 'drift': 9, 'pct': 8.0}, 1 year or more {'entries': 105, 'drift': 12, 'pct': 11.4}, Fisher p = 0.493"
    }
  ]
}
```

```chart
{
  "type": "bar",
  "title": "73 entries with both a catalog owner and a CODEOWNERS rule",
  "caption": "\"One name contains the other\" is, for example, a short catalog name inside a longer GitHub team slug; it may be the same team, but the data cannot show it. Unresolvable owners are what GitHub's CODEOWNERS validation reports for the rule that covers the catalog file.",
  "rows": [
    { "label": "Agree, every owner resolves", "value": 37, "series": "Agree" },
    { "label": "One team name contains the other", "value": 7, "series": "Disagree" },
    { "label": "Different team names", "value": 11, "series": "Disagree" },
    { "label": "Catalog names a team, CODEOWNERS people", "value": 4, "series": "Disagree" },
    { "label": "CODEOWNERS owner GitHub cannot resolve", "value": 14, "series": "Cannot resolve" }
  ],
  "series": [
    { "name": "Agree", "color": "#10b981" },
    { "name": "Disagree", "color": "#f59e0b" },
    { "name": "Cannot resolve", "color": "#ef4444" }
  ]
}
```

37 agree. The other 36, almost half, either name different owners or name owners GitHub cannot resolve. In 7 of them one team name contains the other: in four snyk repositories, for example, the catalog uses a short team name that is part of the longer GitHub team slug in CODEOWNERS. Those may well be the same team. Leave them out and 29 of 73 (40%) still disagree or cannot be resolved. Of the 14 with unresolvable owners, 8 involve a team and 6 involve individual users.

Two caveats keep this from being a verdict on the catalog. CODEOWNERS says who reviews code, which is not always who owns the service, so a disagreement means one record is stale or the two mean different things. And GitHub reports a team as unknown when it was deleted or renamed, is secret, or has no write access to the repository; any of those means the team does not review that code, but only the first two mean it is gone.

Unresolvable owners repeat. In vtex-apps, the same unknown team sits on line 3 of the CODEOWNERS in three of the eight sampled repositories, which looks like a file copied from a template and never updated. Four organizations hold 14 of the 21 drifted entries, and 20 of the 30 had none.

The owner field itself could be checked for only 58 entries (27%): 37 resolved in the entry's own CODEOWNERS, 15 in another repository's, 3 named a team GitHub could not resolve in any CODEOWNERS file that names it, 2 were checked through GitHub's user API, and 1 had no owner at all. Backstage [requires](https://backstage.io/docs/features/software-catalog/descriptor-format) `spec.owner` on a Component, so that entry probably never loaded into anyone's catalog. The 159 we could not check are 142 groups and 17 users: hidden teams, groups that do not look like GitHub teams, users who are not public members of the org, and user IDs that are not GitHub logins.

### Repositories that moved

4 entries (1.8%) point at a repository by a name it no longer has. GitHub redirects the old name, so links and API calls keep working. But GitHub's documentation warns that if anyone creates a new repository with the old name, "redirects to the renamed repository will no longer work", and the catalog entry then points at someone else's code. 2 more entries set `github.com/project-slug` to a bare repository name without the owner, and 2 live in one repository but describe another, which is what a catalog file copied from a sibling repository and never edited looks like.

We found no archived repositories. That is a gap in the sample, not good news: none of the 211 repositories the checker read was archived (each entry records the flag), a code search we tried with `archived:true` returned nothing (so archived repositories are probably missing from the index), and Backstage's [GitHub discovery](https://backstage.io/docs/integrations/github/discovery) skips them by default (`allowArchived` defaults to `false`).

### Idle, but still "production"

39 entries (18.0%) live in repositories with no human commit on the default branch for over a year, and 2 more where the last 30 commits are all from bots. We do not count commits authored by Dependabot, Renovate or other bots as activity. 28 of the 39 still say `production` (19) or `experimental` (9). A stable library can go a year without a change, so this is a warning, not drift. An `experimental` service with no human commit for a year is a decision nobody made.

### Links

Only 70 of 217 entries (32%) had any link at all. Of 152 links, 132 answered, 2 were dead, and 18 could not be checked: 12 pointed at hostnames that do not resolve in public DNS (internal tools, most likely), 5 answered 403, and 1 was a page below a GitHub repository that we do not check. The two dead ones were a Storybook page and a vulnerability report page on a vendor's site.

None of the 152 links was titled as a runbook, an on-call schedule or a dashboard. Public catalogs may simply not publish them, or may title them differently; either way we could not test those links, and they are the ones you would want to work during an incident. If you run this on your own catalog, the link check is where we would expect your numbers to differ most from ours.

### Does a catalog decay with age?

```chart
{
  "type": "bar",
  "title": "Drift by when the catalog file last changed",
  "unit": "%",
  "caption": "Share of entries with at least one drift, by the date of the last commit that touched catalog-info.yaml. Under one year: 9 of 112. One year or more: 12 of 105. Fisher's exact test p = 0.49, which also treats entries as independent although entries from one organization share habits.",
  "rows": [
    { "label": "Under 6 months (81)", "value": 9.9 },
    { "label": "6 to 12 months (31)", "value": 3.2 },
    { "label": "1 to 2 years (48)", "value": 12.5 },
    { "label": "Over 2 years (57)", "value": 10.5 }
  ]
}
```

We expected a clear slope and did not find one: 8.0% for files changed in the last year against 11.4% for older files. Fisher's exact test gives p = 0.49, and it assumes the entries are independent, which they are not quite: entries from one organization share templates and habits. So this sample cannot tell the difference from chance. Drift and warnings together are far more common in older files (24.7% and 19.4% under a year, 54.2% and 54.4% over), but mostly by construction: a repository with no commits for a year also has a catalog file nobody touched for a year. The median catalog file in the sample was last changed 352 days before we checked it.

A single snapshot also cannot see the worst decay. Entries that rotted badly enough to be noticed may have been deleted, and deleted entries are not in a sample of files that still exist.

## The bugs two reviews found in our checker

The first version of the checker and of this post had problems, found by our own runs and by a second review of the code and the draft. Several changed numbers you just read, and some of the corrections made the result look worse, others better.

1. **An unresolvable team was called a missing owner.** The first version reported a catalog owner as drift when GitHub could not resolve the team in a CODEOWNERS file, including one in another repository. But a team can exist and simply lack write access there. That is now a warning on the owner, and only the broken CODEOWNERS file counts as drift. Three entries moved from owner drift to a warning; two of them had no other drift.
2. **An invalid repository reference was quietly replaced.** Two entries set `github.com/project-slug` to a repository name without its owner. The first version fell back to the repository the file lives in and reported nothing. It now reports the annotation as drift, which added two drifted entries just as the first fix removed two. The headline stayed at 21 by coincidence.
3. **A user ID that looks like a GitHub login.** One organization names users by an ID from its own directory, three letters and five digits, which is also a valid GitHub login. GitHub had no account by that name, and the first version reported a departed owner. A missing account is now a warning, unless you pass `--users-are-github-logins` for a catalog where you know users are GitHub logins.
4. **GitHub's two error formats.** For a user, the CODEOWNERS error says `make sure @user exists`; for a team, `make sure the team @org/team exists, is publicly visible, ...`. The first version only parsed the user form, and for teams it fell back to marking every owner on the line as unknown. It changed no result in this sample, but on another catalog it would have.
5. **A YAML reader that was too forgiving.** The checker has its own small YAML reader to stay dependency-free. One sampled file had `description:` at the wrong indentation, which swallowed the `annotations:` block below it. PyYAML rejects that file, and our reader accepted it. It now raises the same error, and a cross-check against PyYAML on all 240 files agrees on every field the checker reads, with the one invalid file rejected by both. The review also found that it decoded some escapes in quoted strings wrongly; it now handles them or refuses the file.
6. **Too generous with links and CODEOWNERS.** Any page below an existing GitHub repository counted as a working link, a redirect loop counted as an answer, `docs/*` in CODEOWNERS also matched files in subdirectories (GitHub's own docs say it does not), and an unreadable CODEOWNERS validation could still report agreement. Each now reports "cannot tell" or matches GitHub's rules.
7. **People in the output.** A bare owner such as `owner: someone` is treated as a team by Backstage, but it is sometimes a person's login, and one owner was an email address. An early run printed them. That file was deleted, and owner and team names are now hashed with a key that is never written down.

Smaller fixes: a link with a space in it stopped an early run; cached answers now expire after a day and are kept per token; CODEOWNERS lines with invalid syntax are skipped, as GitHub skips them; a file link is not called dead when its ref might contain a slash; and an error in one entry, or a 401 or 5xx from GitHub, makes the run exit with 2 instead of stopping or passing. None of these changed a count in this sample. Every superseded run that left a file is kept in `results/` with a note on what changed.

## False positives, and what we could not check

- **A team GitHub cannot resolve is not always deleted.** GitHub's message covers deleted, renamed, secret, and teams without write access to that repository.
- **Different names can be the same people.** A parent team and a child team, or a Backstage group name that differs from the GitHub team slug, show up as a disagreement. That is why disagreement is a warning.
- **A link that answers is not always alive.** A 200 can be a login page, or a "page not found" that answers 200. We count both as working. A 403 from a site that blocks scripts is "cannot tell".
- **Bot detection is by commit author.** A merge commit by a person counts as human activity even when it merges a bot's change, so "no human commit in a year" can undercount idle repositories.
- **Owner coverage is uneven.** We could check 27% of owners, mostly those named in some CODEOWNERS file. Those may be better or worse kept than the rest; we cannot tell which.
- **Private catalogs are not in the sample.** Public repositories may be kept better or worse than internal ones, and internal catalogs carry the runbook, on-call and dashboard links we could not test.

## How to keep a catalog honest

### Derive owners, do not type them

Many of the disagreements above look like two hand-typed names for the same thing. Load groups from the source of truth instead: Backstage's [GitHub org provider](https://backstage.io/docs/integrations/github/org) mirrors GitHub teams as Groups on a schedule, and the catalog products sync from identity providers. Then the owner in `catalog-info.yaml` and the handle in CODEOWNERS are the same string, and a machine can compare them:

```yaml
# catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payments-api
  annotations:
    github.com/project-slug: acme/payments-api # owner/repo, not just the repository name
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
          # on a pull request, read CODEOWNERS as the pull request changes it
          REF: ${{ github.event.pull_request.head.sha || github.sha }}
        run: python .catalog-drift/drift.py catalog-info.yaml --repo "$REPO" --ref "$REF" --check-links --no-org-search --cache-hours 0
```

It exits with 1 on drift or on a catalog file that does not parse, and with 2 when it could not check what it was given, so a broken run never passes quietly.

### Use the check GitHub already runs

You do not need our script to find the worst cases. GitHub already validates every CODEOWNERS file, and one call per repository lists what it cannot resolve:

```bash
# Owners GitHub cannot resolve in this repository's CODEOWNERS
gh api repos/OWNER/REPO/codeowners/errors \
  --jq '.errors[] | "line \(.line): \(.message | split("\n")[0])"'
```

Loop it over every repository in your org once a month. Each line it prints is an owner or a rule GitHub cannot use, which can leave reviews without the reviewer you meant, and is often a sign that the catalog owner is stale too.

### Give the scorecard consequences

Every catalog product has scorecards, and so does Backstage through the Tech Insights plugin. The useful checks are the ones in this post: the owner resolves, the runbook link answers, the lifecycle matches the activity. Put the result where people already work, such as a comment on the pull request or a weekly list sent to each owning team, and not only on a dashboard.

### Retire what nobody claims

An entry whose owner does not resolve and whose repository has been idle for a year may have nobody to fix it. One workflow we would suggest: open an issue for the last known owner, and if nobody confirms ownership within 30 days, mark the entry `deprecated`; remove it 30 days later unless someone claims it. A missing entry sends people asking. A wrong one can send them to the wrong place.

## Build or buy

Every catalog product handles freshness with some mix of the same three tools: sync from a source of truth, automatic discovery, and scorecards. Here is what each one's public documentation says, in alphabetical order, with one documented limit each where we found one:

- **Backstage** (open source) mirrors GitHub teams and users with its [org provider](https://backstage.io/docs/integrations/github/org), finds `catalog-info.yaml` files with [GitHub discovery](https://backstage.io/docs/integrations/github/discovery), and removes [orphaned entities](https://backstage.io/docs/features/software-catalog/life-of-an-entity). Checks on catalog data, including the owner field, come from the [Tech Insights](https://github.com/backstage/community-plugins/tree/main/workspaces/tech-insights/plugins/tech-insights-backend) community plugin. Limit: as quoted above, relations that point at nothing are accepted.
- **Cortex** has [scorecard rules](https://docs.cortex.io/scorecards/scorecard-examples) such as "has an owner" and "has a runbook", syncs [ownership](https://docs.cortex.io/ingesting-data-into-cortex/entities/ownership) daily from identity providers, Git hosts and HR systems, and [auto-archives](https://docs.cortex.io/ingesting-data-into-cortex/entities-overview/entities/archiving-entities/auto-archive) entities whose repository was deleted or archived. Limit: in GitOps mode, a YAML file that is moved rather than deleted is not archived.
- **Humanitec** says in its [own docs](https://developer.humanitec.com/platform-orchestrator/docs/humanitec-vs-others/overview/) that it is not an internal developer portal: the Platform Orchestrator is the backend of a platform and [complements](https://developer.humanitec.com/platform-orchestrator/docs/humanitec-vs-others/backstage-port-cortex-etc./) portals such as Backstage, Port and Cortex.
- **OpsLevel** has a [component ownership check](https://docs.opslevel.com/docs/getting-started-with-rubrics) in its rubric, [syncs GitHub teams](https://docs.opslevel.com/docs/github-teams-sync) every 12 hours, [detects services](https://docs.opslevel.com/docs/service-detection) from repositories and suggests owners from commit authors, and [removes repositories](https://docs.opslevel.com/docs/repositories) deleted at the Git provider. Limit: the team sync page says deleted GitHub teams and users are not synced.
- **Port** has [scorecards](https://docs.port.io/governance/standards-and-compliance/examples/scorecard-use-cases/) with a "has a team" rule, [syncs users and teams](https://docs.port.io/context-lake/business-context/ownership/) from SSO and Git providers, deletes entities that are gone from the source on a [full resync](https://docs.port.io/context-lake/ingestion/ingest-data-into-port/native-integrations/sync-mechanisms/full-resync/), and has a [guide for mapping CODEOWNERS](https://www.docs.port.io/guides/all/connect-github-codeowners-with-service-team-and-user) to teams. Limit: entities of a resource type removed from the mapping are [not deleted automatically](https://docs.port.io/context-lake/ingestion/configure-mapping/entity-cleanup/).
- **Roadie** is managed Backstage: `catalog-info.yaml` is its [native format](https://roadie.io/docs/catalog/overview), it discovers files from Git providers, runs [Tech Insights](https://roadie.io/docs/tech-insights/introduction/) scorecards, and its Catalog Completeness beta [suggests owners](https://roadie.io/docs/catalog/repositories/) for repositories. Limit: deleting a location [does not remove](https://roadie.io/docs/catalog/location-management/) the entities found through it.

If you already run Backstage, the checks in this post fit in a standard-library Python script that runs in CI. What the products add is the plumbing around them: syncing from HR and identity systems, a place where scores are shown, and someone else keeping it running. Whichever way you go, test it the way we tested ours. The repository has a fixture catalog with one of each kind of drift; point your tool at something like it and confirm it fails on each one. A tool you have only seen report "all good" has not shown you that it can find anything.

## What we could not conclude

- **Whether catalogs decay with age.** The difference we saw (8.0% against 11.4%) is within chance for this sample, and one snapshot cannot measure a rate.
- **Whether three owners in four are right.** 159 owners could not be checked from outside. Among the 58 we could check, 1 entry had no owner and 4 drew a warning, and that rate does not carry over to the rest.
- **Whether a disagreement means a wrong owner.** CODEOWNERS and the catalog can mean different things by "owner".
- **Whether runbooks and on-call links rot.** None were identified in public catalogs.
- **How private catalogs compare.** Every entry here is in a public repository.
- **Whether a wrong entry ever caused a bad page.** "Can be worse than none" is an argument about how people use catalogs during incidents, not something this data measures.

## Summary

- Check a catalog against the systems it describes, not against itself. Ours found 21 entries out of 217 where GitHub contradicts the entry or its CODEOWNERS, all of which looked fine in their own files.
- Ownership is where the records disagree. Where two records of the owner existed, half disagreed or named an owner GitHub could not resolve.
- From outside an org, most owners cannot be checked at all. Run the check where the token can see your teams, and map directory groups to GitHub teams explicitly.
- Make owners the same string everywhere by deriving them from GitHub teams or your identity provider, then compare catalog and CODEOWNERS in CI.
- Run the check on a schedule too: a team deleted in a reorg changes no file.
- Retire entries nobody claims. A gap sends people asking; a wrong answer can send them to the wrong place.

The checker, the sample, every result and the tests are in [The-DevOps-Daily/service-catalog-drift](https://github.com/The-DevOps-Daily/service-catalog-drift). Run it against your own catalog, with a token that can see your teams, and see how your numbers compare.
