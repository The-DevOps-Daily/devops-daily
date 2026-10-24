---
title: 'Caching Dependencies and Sharing Artifacts'
description: 'Speed up GitHub Actions with the npm cache and actions/cache, and pass build output between jobs with upload-artifact v7 and download-artifact v8.'
order: 4
---

Every job on a GitHub-hosted runner starts on an empty machine. That keeps runs repeatable, but it means two things have to be solved explicitly: downloading the same dependencies again in every job is slow, and the site that the `build` job produces disappears when that job ends. GitHub Actions has a separate tool for each problem. **Caches** keep files between runs to save time. **Artifacts** keep the output of a run so that later jobs and people can use it.

In this part you look at what the npm cache did in the Part 3 runs, use `actions/cache` for other files, and extend the CI workflow to upload the test reports and the built site as artifacts.

## Prerequisites

- The repository and CI workflow from [Part 3](/guides/introduction-to-cicd/03-building-and-testing-applications).

## Cache or Artifact?

|                  | Cache                                                                                                                  | Artifact                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Purpose          | Make later runs faster                                                                                                 | Keep the output of this run                                                          |
| Typical content  | Package manager downloads, compiler caches                                                                             | Built apps, test reports, logs                                                       |
| If it is missing | The job is slower but still correct                                                                                    | The job that needs it fails                                                          |
| Who can use it   | Later runs on the same branch, pull requests based on that branch, and every branch for caches from the default branch | Later jobs of the same run, other workflows with a token, people who download it     |
| Lifetime         | Removed after 7 days without use                                                                                       | 90 days by default, set per upload with `retention-days`                             |
| Size             | 10 GB per repository by default; if you raise the limit, usage above 10 GB is billed                                   | Counts toward your plan's storage (500 MB on GitHub Free, private repositories only) |

The rule of thumb: if a job would still produce the right result without the files, it is a cache. If not, it is an artifact.

## What the npm Cache Did

`cache: npm` in `actions/setup-node` caches npm's download cache (`~/.npm`), not `node_modules`. The cache key contains the operating system, the architecture and a hash of `package-lock.json`, so it changes exactly when the dependencies change. In the first CI run, `lint` and the three test jobs started at the same time, before any cache existed, and `build` started after them:

```terminal
{
  "title": "the first run",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40063854303 --log | grep -E 'npm cache is not found|Cache restored from key|Cache saved|Failed to save|Cache hit occurred' | cut -f1,3",
      "output": "lint\t2026-10-24T04:49:32.4402080Z npm cache is not found\nlint\t2026-10-24T04:49:34.9684309Z Failed to save: Unable to reserve cache with key node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59, another job may be creating this cache.\ntest (26)\t2026-10-24T04:49:38.9159950Z Cache restored from key: node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59\ntest (26)\t2026-10-24T04:49:40.2758274Z Cache hit occurred on the primary key node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59, not saving cache.\ntest (22)\t2026-10-24T04:49:32.5596693Z npm cache is not found\ntest (22)\t2026-10-24T04:49:35.5032582Z Cache saved with the key: node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59\ntest (24)\t2026-10-24T04:49:32.6805684Z npm cache is not found\ntest (24)\t2026-10-24T04:49:35.9385587Z Failed to save: Unable to reserve cache with key node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59, another job may be creating this cache.\nbuild\t2026-10-24T04:49:49.2682379Z Cache restored from key: node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59\nbuild\t2026-10-24T04:49:50.8280106Z Cache hit occurred on the primary key node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59, not saving cache."
    }
  ]
}
```

The log tells the whole story. `lint`, `test (22)` and `test (24)` looked for the cache at the same moment and found none. After `npm ci`, all three tried to save it under the same key. `test (22)` reserved the key first and saved it; `lint` and `test (24)` could not reserve it, because a cache key can be written only once ("another job may be creating this cache"). `test (26)` started at the same time but spent 2.6 seconds downloading Node.js 26, so its lookup came after the save and restored the cache, and `build` started after the tests. All three Node.js versions share one key, because npm's download cache does not depend on the Node.js version.

From the second run on, every job restores it:

```terminal
{
  "title": "the second run",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40063966854 --log | grep 'Cache restored from key' | cut -f1,3",
      "output": "lint\t2026-10-24T04:51:16.2048807Z Cache restored from key: node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59\ntest (22)\t2026-10-24T04:51:13.6746428Z Cache restored from key: node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59\ntest (26)\t2026-10-24T04:51:20.1142541Z Cache restored from key: node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59\ntest (24)\t2026-10-24T04:51:14.8334075Z Cache restored from key: node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59\nbuild\t2026-10-24T04:51:31.7955628Z Cache restored from key: node-cache-Linux-x64-npm-57cf33755a309dbd3bbcf41cff1299547abfe1c9d90e5ec56ea6bdc764d4ed59"
    },
    {
      "comment": "the cache itself, 2.39 MiB",
      "cmd": "gh cache list",
      "output": "Showing 1 of 1 cache in The-DevOps-Daily/guide-cicd-demo-2026-10-24\n\nID          KEY                                               SIZE      CREATED             ACCESSED\n9435141837  node-cache-Linux-x64-npm-57cf33755a309dbd3bbc...  2.39 MiB  about 1 minute ago  about 1 minute ago"
    }
  ]
}
```

For this small app the cache saves little time: `npm ci` took about 1 second without it and 0.8 seconds with it. For an app with hundreds of dependencies, or behind a slow registry, it saves minutes. `gh cache delete <key>` removes an entry if you suspect a bad one.

Since setup-node v6, caching turns on automatically for npm projects whose `package.json` has a `packageManager` (or `devEngines.packageManager`) field set to npm. The log line `package-manager-cache: true` refers to that. For Yarn and pnpm, set `cache: yarn` or `cache: pnpm`.

## Caching Other Files With actions/cache

For anything a `setup-*` action does not cache, use `actions/cache`. It restores a path at the start of the job if the key matches, and saves it at the end of the job if there was no exact match. This job (not part of the example app) caches the Playwright browsers, which take a few hundred megabytes and a minute to download:

```yaml
name: Browser tests

on:
  pull_request:

permissions:
  contents: read

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Cache the Playwright browsers
        id: browsers
        uses: actions/cache@v6
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('package-lock.json') }}
      - name: Download the browsers on a cache miss
        if: steps.browsers.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps chromium
      - name: Install only the system packages on a cache hit
        if: steps.browsers.outputs.cache-hit == 'true'
        run: npx playwright install-deps chromium
      - run: npx playwright test
```

How the cache action behaves:

- **`key`** is the exact match. Build it from everything that changes the content: the OS, the architecture and a `hashFiles()` of the lockfile. `hashFiles()` accepts globs, such as `'**/package-lock.json'` in a monorepo.
- **`cache-hit`** is `'true'` only for an exact key match, which lets you skip the download step.
- **`restore-keys`** is an optional list of key prefixes for a partial match, for example `playwright-${{ runner.os }}-${{ runner.arch }}-`. A partial match restores the newest cache with that prefix and still saves a new entry under the full key at the end. Use it for build caches that stay useful when they are slightly out of date; skip it when an old cache could be wrong.
- **`actions/cache/restore`** and **`actions/cache/save`** are the two halves as separate actions, for example to save a cache even when a later step fails, or only on `main`.
- **Scope.** A run can restore caches created on its own branch, on the base branch of a pull request, and on the default branch. A cache saved by a pull request is visible only to later runs of that pull request.

## Caches and Trust

A cache is code that a later run executes, so a poisoned cache is an attack path. Since [June 2026](https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/), events that outsiders can trigger and that run in the default branch's cache scope, such as `pull_request_target` and `issue_comment`, get read-only access to the cache by default. `pull_request` runs keep write access, but only to their own pull request's scope, which trusted runs on other branches never restore. The "Cache mode: write" line in every "Set up job" log shows the access the job got. Since [September 2026](https://github.blog/changelog/2026-09-10-control-github-actions-cache-access-with-cache-mode/) you can also set `cache-mode: read`, `write`, `write-only` or `none` for a workflow or a job, for example `cache-mode: none` for a release job that should never use a cache. Setting `write` or `write-only` on an untrusted trigger removes the read-only default, and GitHub then adds a warning annotation. setup-node's documentation recommends `package-manager-cache: false` in workflows that hold secrets or write permissions.

## Upload the Test Reports and the Site

Now the artifacts. Update `ci.yml` so the test jobs write a JUnit report and upload it, the build job uploads `dist/`, and a new `check-site` job downloads the site and checks it:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      fail-fast: false
      matrix:
        node: [22, 24, 26]
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - name: Run the tests and write a JUnit report
        run: >-
          npm test --
          --test-reporter=spec --test-reporter-destination=stdout
          --test-reporter=junit --test-reporter-destination=test-results.xml
      - name: Upload the test report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: test-results-node-${{ matrix.node }}
          path: test-results.xml
          retention-days: 7

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Upload the site
        uses: actions/upload-artifact@v7
        with:
          name: site
          path: dist/
          retention-days: 14
          if-no-files-found: error

  check-site:
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Download the site
        uses: actions/download-artifact@v8
        with:
          name: site
          path: site
      - name: Check the files
        run: |
          ls -l site
          grep -q '<h1>' site/index.html
          cat site/version.json
```

The changes:

- **Two test reporters.** Node.js's test runner accepts several `--test-reporter` and `--test-reporter-destination` pairs: `spec` for the log, `junit` for a file that test-report tools understand. `>-` is YAML for "one line, joined with spaces".
- **`if: ${{ !cancelled() }}`** uploads the report also when the tests fail, which is when you need it most.
- **Unique names.** Each matrix job uploads `test-results-node-<version>`. Since v4, artifacts are immutable and a name can be used only once per run, so a fixed name in a matrix fails.
- **`retention-days`** keeps the reports for 7 days and the site for 14, instead of the default 90.
- **`if-no-files-found: error`** fails the upload when `dist/` is empty, instead of the default warning.
- **`check-site`** has no checkout and no Node.js. It gets the files only from the artifact, the same way a deployment job will in Part 6.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "build", "sub": "npm run build", "icon": "gear", "tone": "blue" },
    { "label": "upload-artifact", "sub": "site, 14 days", "icon": "box", "tone": "violet" },
    { "label": "artifact store", "sub": "zip + SHA-256", "icon": "database", "tone": "slate" },
    { "label": "download-artifact", "sub": "digest checked", "icon": "box", "tone": "violet" },
    { "label": "check-site", "sub": "a new runner", "icon": "check", "tone": "green" }
  ]
}
```

## The Run

```terminal
{
  "title": "artifacts",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40063966854",
      "output": "✓ main CI · 40063966854\nTriggered via push less than a minute ago\n\nJOBS\n✓ lint in 12s (ID 120783188134)\n✓ test (22) in 8s (ID 120783188320)\n✓ test (26) in 14s (ID 120783188333)\n✓ test (24) in 9s (ID 120783188404)\n✓ build in 9s (ID 120783243916)\n✓ check-site in 5s (ID 120783280867)\n\nANNOTATIONS\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nlint: .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\ntest (22): .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\ntest (26): .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\ntest (24): .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nbuild: .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\ncheck-site: .github#1\n\n\nARTIFACTS\ntest-results-node-24\nsite\ntest-results-node-26\ntest-results-node-22\n\nFor more information about a job, try: gh run view --job=<job-id>\nView this run on GitHub: https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24/actions/runs/40063966854"
    }
  ]
}
```

The upload log shows what was stored, and its SHA-256 digest:

```terminal
{
  "title": "upload and download",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view --job 120783243916 --log | grep 'Upload the site' | cut -f3- | grep -E 'files uploaded|digest|successfully uploaded'",
      "output": "2026-10-24T04:51:32.9745797Z With the provided path, there will be 2 files uploaded\n2026-10-24T04:51:33.4333426Z SHA256 digest of uploaded artifact is cd57655209a690046e0290c0f4b98bd7725e02d2a0463bd773a77064740f5ca9\n2026-10-24T04:51:33.9016552Z Artifact site has been successfully uploaded! Final size is 919 bytes. Artifact ID is 12548670845"
    },
    {
      "cmd": "gh run view --job 120783280867 --log | grep 'Download the site' | cut -f3- | grep -E 'Expected Digest|digest of downloaded|completed successfully'",
      "output": "2026-10-24T04:51:41.7222196Z - site (ID: 12548670845, Size: 919, Expected Digest: sha256:cd57655209a690046e0290c0f4b98bd7725e02d2a0463bd773a77064740f5ca9)\n2026-10-24T04:51:42.3783893Z SHA256 digest of downloaded artifact is cd57655209a690046e0290c0f4b98bd7725e02d2a0463bd773a77064740f5ca9\n2026-10-24T04:51:42.3786641Z Artifact download completed successfully."
    }
  ]
}
```

`download-artifact` compared the digest of what it downloaded with the digest recorded at upload. Since v8 (February 2026), a mismatch fails the step instead of printing a warning.

You can download artifacts yourself, and the API shows when they expire:

```terminal
{
  "title": "download from your computer",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run download 40063966854 --name site --dir site && ls -l site && cat site/version.json",
      "output": "total 8\n-rw-r--r-- 1 dev dev 1509 Oct 24 04:52 index.html\n-rw-r--r-- 1 dev dev   81 Oct 24 04:52 version.json\n{\n  \"version\": \"1.0.0\",\n  \"commit\": \"239b4ba55cccc7198720a3d5428996c6e8925cee\"\n}"
    },
    {
      "comment": "the reports expire after 7 days, the site after 14",
      "cmd": "gh api repos/{owner}/{repo}/actions/runs/40063966854/artifacts --jq '.artifacts[] | [.name, .size_in_bytes, .expires_at] | @tsv'",
      "output": "test-results-node-24\t467\t2026-10-31T04:51:16Z\nsite\t919\t2026-11-07T04:51:32Z\ntest-results-node-26\t469\t2026-10-31T04:51:21Z\ntest-results-node-22\t417\t2026-10-31T04:51:16Z"
    }
  ]
}
```

This time `version.json` has the real commit SHA, which `GITHUB_SHA` provided in the build job.

## Artifact Facts Worth Knowing

- **Versions.** `upload-artifact` and `download-artifact` v3 stopped working on github.com on [30 January 2025](https://github.blog/changelog/2024-04-16-deprecation-notice-v3-of-the-artifact-actions/). Since v4, uploads are immutable and available to other jobs as soon as the step finishes. The current majors are `upload-artifact@v7` and `download-artifact@v8`.
- **Hidden files are left out.** Since v4.4, files and directories whose names start with a dot are not uploaded unless you set `include-hidden-files: true`. That protects you from uploading `.git` or `.env` by accident.
- **One file without a zip.** Since v7, `archive: false` uploads a single file as it is, so it downloads as that file instead of a zip.
- **Limits.** A job can upload up to 500 artifacts. Retention can be set between 1 and 90 days in public repositories and up to 400 days in private ones.
- **From another run.** `download-artifact` can read artifacts of other runs and repositories with `run-id`, `repository` and a `github-token` that has `actions: read`.
- **Who can download them.** Anyone with read access to the repository, which for a public repository means any signed-in GitHub user. Never put secrets in an artifact.

## Common Mistakes

- **Caching `node_modules`.** It depends on the Node.js version and the OS, and `npm ci` deletes it anyway. Cache the package manager's download cache, as setup-node does.
- **A cache key without the lockfile hash.** The cache never updates, and new dependencies are downloaded in every run.
- **Using a cache to pass build output between jobs.** A cache can be missing or old. Use an artifact.
- **The same artifact name in every matrix job.** Add the matrix values to the name.
- **Uploading the whole workspace.** It is slow, and with `persist-credentials` left on, older checkout versions wrote the token into `.git/config`. Upload only the directory you need.

## Summary

- Caches make later runs faster and may be missing; artifacts carry the output of a run and must be there.
- setup-node caches `~/.npm` under a key built from the OS, the architecture and the lockfile hash; the first job to finish saves it.
- `actions/cache` with a good key, and `restore-keys` only where an old cache is safe, covers everything else.
- `upload-artifact@v7` and `download-artifact@v8` pass files between jobs with digest checks; name artifacts uniquely and set `retention-days`.

In [Part 5](/guides/introduction-to-cicd/05-environment-variables-and-secrets) you move configuration and credentials out of the workflow files into variables and secrets, and replace long-lived cloud keys with OIDC.

## Keep Learning

- [Why Your CI/CD Pipeline Is Slower Than It Should Be (and How to Fix It)](/posts/why-your-ci-pipeline-is-slower)
- [Artifactory vs GitHub Packages](/comparisons/artifactory-vs-github-packages)
- [CI/CD Pipelines Quiz](/quizzes/cicd-pipelines-quiz)
