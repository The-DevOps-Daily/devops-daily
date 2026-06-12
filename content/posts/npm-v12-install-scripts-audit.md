---
title: 'npm v12 Will Stop Running Install Scripts. We Audited Our Repos to See What Actually Breaks'
excerpt: 'Starting with npm v12 (estimated July 2026), dependency install scripts will not run unless you allowlist them. We ran the new audit tooling on our own production repos: 65 packages flagged, 4 that matter, and a surprising amount of nothing breaking.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-12'
publishedAt: '2026-06-12T14:00:00Z'
updatedAt: '2026-06-12T14:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - npm
  - supply-chain
  - security
  - ci-cd
  - nodejs
---

On June 9, GitHub [announced the breaking changes coming in npm v12](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/), estimated to ship in July 2026. The headline change: `npm install` will no longer execute `preinstall`, `install`, or `postinstall` scripts from your dependencies unless you have explicitly approved them. Not as an option you can turn on. As the default, for everyone.

If you have followed the npm worm coverage on this site over the past months ([TanStack](https://devops-daily.com/posts/tanstack-npm-worm-dead-mans-switch), [PyTorch Lightning's mini Shai-Hulud](https://devops-daily.com/posts/mini-shai-hulud-pytorch-lightning-supply-chain-attack), [axios](https://devops-daily.com/posts/axios-supply-chain-attack-what-happened-and-what-to-do), [the AntV wave](https://devops-daily.com/posts/antv-npm-shai-hulud-wave-may-2026)), you already know why. Every one of those campaigns used the same beachhead: a script that runs automatically, with your credentials, the moment you install a package. GitHub calls lifecycle scripts the single largest code-execution surface in the npm ecosystem, and after the June 1 Red Hat compromise shipped credential stealers with valid SLSA provenance, the argument for keeping that surface open by default ran out.

So instead of writing about the policy, we did the thing you should do this week: upgraded npm and ran the new audit tooling against our own production repositories. Here is what v12 will actually do to a real Next.js application and a couple of TypeScript tooling repos, including the part where much less breaks than the audit output suggests.

## What changes, exactly

Three defaults flip in v12:

1. **Dependency lifecycle scripts stop running.** `preinstall`, `install`, and `postinstall` from dependencies are skipped unless the package is on your project's allowlist. This includes implicit builds: a package with a `binding.gyp` and no declared install script still gets blocked, because npm runs an implicit `node-gyp rebuild` for it. `prepare` scripts from git, file, and link dependencies are covered too.
2. **Git dependencies need `--allow-git`.** Direct or transitive git dependencies stop resolving without the flag. This closes an ugly hole: a git dependency's `.npmrc` could override which git executable npm invokes, which meant code execution even under `--ignore-scripts`.
3. **Remote URL dependencies need `--allow-remote`.** Tarballs pulled from HTTPS URLs stop resolving without explicit opt-in. `file:` and directory dependencies keep their current behavior.

Your own project's scripts still run. If your root `package.json` has a `postinstall` that runs `patch-package`, or a `prepare` that installs husky hooks, nothing changes for you. The allowlist is about code arriving from the registry, and it lives in your `package.json`, which means script approvals show up in pull requests and get reviewed like any other change.

All of this is already available as warnings in npm 11.16.0 and later, which is what makes the audit possible before July.

## The audit: 65 warnings, 4 that matter

We ran `npm approve-scripts --allow-scripts-pending` (npm 11.17.0) against this site, a production Next.js application with a fairly typical dependency tree. The output flags 65 packages with lifecycle scripts not yet covered by an allowlist. Out of context, that number reads like a migration project.

It is not, and the breakdown shows why:

```chart
{
  "type": "bar",
  "title": "65 packages flagged in our Next.js repo, by script type",
  "unit": " pkgs",
  "caption": "Output of npm approve-scripts --allow-scripts-pending on a production Next.js app, June 2026.",
  "rows": [
    { "label": "prepare (husky, npm run build, ...)", "value": 61, "series": "noise" },
    { "label": "install (sharp)", "value": 1, "series": "real" },
    { "label": "postinstall (esbuild x2, unrs-resolver)", "value": 3, "series": "real" }
  ],
  "series": [
    { "name": "noise", "color": "#64748b" },
    { "name": "real", "color": "#f59e0b" }
  ]
}
```

Sixty-one of the sixty-five are `prepare` scripts: husky hook installation, `npm run build`, the usual library housekeeping. `prepare` only executes when you install a package from git, a local file, or a link, never from a normal registry install. Unless you are pinning one of those packages to a git ref, these entries are inert. The audit lists them because it cannot know you will not switch a dependency to a git URL tomorrow, but for triage purposes you can put them at the bottom of the pile.

That leaves four entries that run today on every clean install of this repo: `sharp` (image processing, used by Next.js image optimization), `esbuild` twice at different versions, and `unrs-resolver`. All native code. These are the ones that could break a build in July.

Two smaller repos made the point even more cleanly: our open source [benchmark harness](https://github.com/The-DevOps-Daily/serverless-postgres-benchmarks) and its dashboard each flagged exactly one package. Both times it was esbuild.

## The plot twist: we denied them and nothing broke

Here is the part worth the price of admission. We installed `sharp` and `esbuild` into a clean project with scripts disabled, then exercised both:

- `sharp` created and encoded an image without its `install` script ever running.
- `esbuild` transformed TypeScript without its `postinstall`.

No failures, no missing binaries. The reason: both packages migrated their native binary distribution to `optionalDependencies` (`@img/sharp-linux-arm64`, `@esbuild/linux-arm64`, and their platform siblings), which are plain packages that install without any script execution. The lifecycle scripts that the audit flags are validation and fallback paths for platforms without a prebuilt binary, not the primary delivery mechanism.

This is the quiet story behind npm v12: the ecosystem's most depended-on native packages already left install scripts behind, in large part because the worm era made every install-time hook a liability. The default flip in July is less a demolition and more the locking of a door most serious packages already stopped using.

## What will actually break

That does not make the change free. The breakage concentrates in specific places, and they are worth checking deliberately:

- **Long-tail native modules built with node-gyp.** Anything that compiles C++ on install and has not moved to prebuilt binaries stops working until allowlisted, including packages with only an implicit `binding.gyp` build. Older database drivers, hardware bindings, and that one image library from 2019 live here.
- **Downloaders.** Packages whose `postinstall` fetches something big: Puppeteer and Playwright pulling browsers, Cypress pulling its binary. Denied scripts mean the tool installs but fails at runtime with a missing executable, which is a worse failure mode than failing at install.
- **Git and URL dependencies.** Any `"some-fork": "github:org/repo#branch"` in your tree needs `--allow-git` in every CI job and Dockerfile that installs it. Private tarball URLs need `--allow-remote`. These fail loudly at resolve time, so you will notice, but you will notice in the middle of an incident if your first v12 install happens during one.
- **CI images that float npm versions.** If your Dockerfile does `npm install -g npm@latest` or your CI uses a `node:latest` style tag, v12 arrives on its schedule, not yours.

## The checklist

The whole audit took us under fifteen minutes for three repos. Doing it now means July is a non-event:

1. Upgrade to npm 11.16.0 or later somewhere representative (a dev machine is fine, CI is better).
2. Run `npm approve-scripts --allow-scripts-pending` in each repo. Ignore the `prepare` entries from registry packages on the first pass.
3. For each real `install`/`postinstall` entry, decide: approve it with `npm approve-scripts <pkg>`, or test whether the package works without it (as with sharp and esbuild above, the answer is increasingly yes) and deny it with `npm deny-scripts <pkg>`.
4. Commit the resulting allowlist in `package.json`. From now on, a new dependency wanting script execution shows up in code review instead of executing silently.
5. Grep your Dockerfiles and CI for git and URL dependencies, and add the flags where genuinely needed.
6. Pin your npm major version in CI images, and schedule the v12 upgrade like any other dependency upgrade instead of receiving it as a surprise.

One honest caveat: July 2026 is GitHub's estimate, and details of partially shipped behavior have moved before (the git restriction landed in 11.10, remote URLs in 11.15, the full allowlist tooling in 11.16). The direction is not in question, though. Install-time code execution from the registry is ending as a default, three years of worms made the case, and the audit that tells you whether you care takes less time than reading this post did.
