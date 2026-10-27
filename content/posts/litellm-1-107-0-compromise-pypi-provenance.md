---
title: 'LiteLLM 1.107.0 Was Built From a Lookalike Fork: What PyPI Provenance Can and Cannot Tell You'
excerpt: 'The poisoned LiteLLM release came out of the real release pipeline, fed from a fork one hyphen away. We measured what a PyPI attestation would have shown, what the Docker image provenance showed, and how many of the 1,000 most downloaded PyPI projects publish attestations at all: 39%.'
category:
  name: 'Python'
  slug: 'python'
date: '2026-10-27'
publishedAt: '2026-10-27T09:00:00Z'
updatedAt: '2026-10-27T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Python
  - Security
  - Supply Chain
  - PyPI
  - LiteLLM
  - Provenance
---

On October 21, 2026, `litellm==1.107.0` was on PyPI for about 1 hour 43 minutes, with a credential stealer and a remote-code loader in all seven wheels. Reading `github.com/BerriAI/litellm` would not have shown you anything: LiteLLM's own release pipeline built the release from a lookalike fork, `Berri-AI/litellm`, one hyphen away from the real name.

So we asked a narrower question: which record could have told you where the artifact came from? We checked PyPI, the container registries and the 1,000 most downloaded PyPI projects. The short answer:

- The **Docker images' build provenance** named the fork. It was there to read.
- **PyPI had nothing to check.** litellm published PEP 740 attestations on 15 releases in March and April 2026 and on none of the 214 releases since. Those 15 name the private release repository, `BerriAI/project-releaser`, not the source repository. That is the repository whose release workflows the attacker ran, so an attestation on 1.107.0 would most likely have named the same publisher as every legitimate release.
- Across the 1,000 most downloaded PyPI projects, **39.0% of latest releases carry an attestation**, and **33.4%** carry one from the repository their own metadata names.

This post covers what happened, how to check your environments, lock files, caches and images, what to rotate, the provenance gap with the numbers, and what you can enforce today. Every number we measured comes from a file in the companion repo. Incident facts, such as the timeline, come from the sources we link, and the repo's `SOURCES.md` lists each one.

```github
https://github.com/The-DevOps-Daily/pypi-provenance-check
```

## TLDR

- **What shipped:** 7 wheels (`cp310-abi3`, Linux, macOS, Windows) with `cook.pth`, `cook.py` and `sitecustomize.py`, plus container images under `v1.107.0`, `latest`, `main-latest` and `main-stable` on GHCR and Docker Hub. Clean versions: 1.106.2, 1.107.0rc1 and 1.107.0rc2.
- **Check without starting the suspect Python.** The payload runs whenever an interpreter starts with that site-packages on its path, and that includes `pip`. Our checker runs under `python3 -I -S` and reads files only. It finds the payload in venvs, lock files, pip and uv caches and image tarballs.
- **Rotate** everything the host could reach: cloud role credentials, every provider key stored in the LiteLLM proxy database, the master and virtual keys, `DATABASE_URL`, CI and registry tokens, SSH and TLS keys.
- **The provenance gap:** a PyPI publish attestation names the workflow that uploaded the file, not the source it built. `pypi-attestations verify` against `BerriAI/litellm` fails even on a legitimate litellm release. In the files we sampled from the 396 attested projects in our survey, we found no SLSA provenance attestation, the PyPI type that can record a source repository.
- **23 projects stopped attesting.** They attested an earlier release and not their latest one. Today, 12 of them upload with `uv publish`, which uploads attestations but does not create them.
- **What works today:** a release cooldown (`exclude-newer = "7 days"` in uv, `--uploaded-prior-to P7D` in pip 26.1+), hash-locked installs, image digests plus a provenance source check, and publisher pins for packages that attest. As of October 2026, neither pip nor uv verifies attestations at install time.

## Prerequisites

- Python 3.11 or later on the hosts you want to check (the scripts use only the standard library)
- Read access to your virtual environments, lock files, pip and uv caches, CI logs and container images
- Optional: `uv`, to run the `pypi-attestations` verifier, and `docker` or `podman`, to export images for scanning

## What happened

LiteLLM is a Python SDK and proxy that puts many LLM providers behind one OpenAI-style API. The proxy usually stores every upstream provider key in its database, which made it a valuable target. The timeline below comes from the maintainers' [incident post](https://docs.litellm.ai/blog/security-incident-oct-21-2026) and their [attack-chain post](https://docs.litellm.ai/blog/security-incident-oct-21-2026-attack-chain), which they call the canonical account.

| Time (UTC, Oct 21, 2026) | Event                                                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10:08                    | Branch protection on the private release repo `BerriAI/project-releaser` rejects commit `9cf97e9` ("ci: release from a fork source repository"). A stolen token of a GitHub organization owner disables the protection and force-pushes it. |
| 10:46:39                 | A staging run starts with source `Berri-AI/litellm` at commit `20535d8f`, which "exists only on the attacker's fork".                                                                                                                       |
| 11:11:18                 | A second stolen maintainer token approves the production gate.                                                                                                                                                                              |
| 11:39:51 to 11:40:13     | Seven `litellm==1.107.0` wheels are uploaded to PyPI.                                                                                                                                                                                       |
| 11:46:56                 | Images are pushed under `v1.107.0`, `latest`, `main-latest` and `main-stable`.                                                                                                                                                              |
| 11:53:49 to 11:54:01     | A third stolen token deletes the workflow run records.                                                                                                                                                                                      |
| 12:06:41                 | Upwind opens [issue #47826](https://github.com/BerriAI/litellm/issues/47826).                                                                                                                                                               |
| 13:23                    | PyPI removes 1.107.0.                                                                                                                                                                                                                       |
| 13:51                    | The GHCR tags are gone.                                                                                                                                                                                                                     |
| 14:20                    | The Docker Hub tags are removed or repointed to clean images.                                                                                                                                                                               |

The way in was ordinary. On May 27, a config file with the master key of the LiteLLM Agent Platform was committed to a public repository. The commit was force-pushed over, but the key was not revoked. On October 10, the attacker used it to read a GitHub CLI OAuth token that belonged to an organization owner. More maintainer tokens were taken from repository secrets the same day. A maintainer summed it up in the issue as "use of insufficiently scoped keys combined with failure to revoke after accidental exposure."

The payload sits in `litellm-1.107.0.data/purelib/`, so the installer puts it in the root of site-packages:

- `cook.pth` contains `import cook`, so `cook.py` runs every time that interpreter starts. We covered this startup trick in detail in our post on the [Shai-Hulud Hades wave on PyPI](/posts/shai-hulud-hades-pypi-wave-june-2026).
- `cook.py` is a stealer that calls itself `privcollect`. It encrypts what it collects and POSTs it to `http://www.litellm.dev/healthcheck`, a lookalike domain registered on October 13.
- `sitecustomize.py` forks a daemon that holds `/tmp/remote_code_loader.lock`. Every hour, it reads a domain from `raw.githubusercontent.com/letters9813/pythonclient-test/main/domain.txt` and runs the code at `http://<domain>/codepy`. The issue reports that the file has been empty since October 20, so this stage was dormant.

Early reports said the `v1.107.0` git tag was clean. The maintainers later wrote that "there is no official v.1.107.0 source tag". The tag list we pulled from `BerriAI/litellm` on October 26 has `v1.107.0-dev.1` to `-dev.3` and `v1.107.0-rc.1` and `-rc.2`, and no `v1.107.0`. Either way, the malicious lines were never in `BerriAI/litellm`. The lookalike repository now returns 404.

This is the second LiteLLM poisoning this year. In March, versions 1.82.7 and 1.82.8 were published with a stolen PyPI token, which [Chainguard](https://www.chainguard.dev/unchained/litellm-attacked-again-malicious-1-107-0-wheels-on-pypi-and-docker-hub-october-2026) attributes to TeamPCP, the group in our [PyTorch Lightning post](/posts/mini-shai-hulud-pytorch-lightning-supply-chain-attack). There is no evidence that links the two incidents.

## Check if you were hit

You are exposed if any of these happened:

- A `pip install` or `uv` resolve picked `litellm==1.107.0` between 11:39:51 and 13:23 UTC. This includes unpinned `litellm` and `litellm[proxy]` requirements, and lock files that were refreshed in that window.
- You ran an image pulled by one of the four tags between 11:46:56 and 13:51 UTC (GHCR) or 14:20 UTC (Docker Hub), or you built an image `FROM` one of those tags in that window.

Pulling or unpacking an image does not start Python, so it does not run the payload. Any start of the image's Python with normal site initialization does: a container whose entrypoint runs it, a `RUN` step in a derived build that runs it (`pip install` counts), or `docker exec ... python`.

The most important rule comes from the issue: **do not start with `pip install`.** Any Python process that starts in the affected environment runs `cook.pth` and `sitecustomize.py` again, and pip is a Python process.

### With nothing but a shell

```bash
# The payload files in any site-packages or dist-packages on this host (all mounted filesystems)
find / \( -path /proc -o -path /sys \) -prune -o \
  \( -path '*/site-packages/*' -o -path '*/dist-packages/*' \) \
  \( -name 'cook.pth' -o -name 'cook.py' -o -name 'litellm-1.107.0.dist-info' \) -print 2>/dev/null

# Host markers. The first one is written only after a successful exfiltration POST.
ls -la /tmp/.pc_once_72129118c59f5636c0bb /tmp/remote_code_loader.lock /tmp/.pc_sq_* /tmp/.pc_e_* 2>/dev/null

# Literal 1.107.0 pins in requirements-style files (skips rc, dev, post and local versions)
grep -rniE '^[[:space:]]*litellm(\[[^]]*\])?[[:space:]]*===?[[:space:]]*1\.107\.0([[:space:];,#\\]|$)' \
  --include='*.txt' --include='*.in' --include='*.lock' .
```

A missing marker file proves nothing. Containers and `/tmp` cleanup remove it. The `find` runs without `-xdev` so it covers separately mounted `/home`, `/srv` and volume paths; errors are hidden, so run it as root. The `grep` only sees the literal spelling `1.107.0`.

### With the checker

`ioc_check.py` is one standard-library file. Run it with `-I -S` so that the interpreter running it does not process `.pth` files or import `sitecustomize` from its own site-packages:

```bash
git clone https://github.com/The-DevOps-Daily/pypi-provenance-check
cd pypi-provenance-check

python3 -I -S ioc_check.py                                    # envs, pip/uv caches, host markers
python3 -I -S ioc_check.py lock requirements.txt uv.lock pylock.toml
docker save litellm/litellm:main-stable -o img.tar && python3 -I -S ioc_check.py scan img.tar
```

With no arguments, it searches `/usr/lib`, `/usr/local/lib`, `/opt`, `/srv`, `/app` and your home directory for site-packages, scans the pip, uv, Poetry and PDM caches, and checks the host markers. On Linux it also looks for processes with `PRIVCOLLECT_ACTIVE=1` in their environment or holding the loader's lock file. Run it as root. As a normal user, a directory, file or archive it cannot read is reported as incomplete, so a run that finds nothing else exits 4 instead of 0. Processes it cannot inspect are only listed as a note.

We did not download or run the real wheel. The tests use a harmless stand-in built at test time: its `cook.py` and `sitecustomize.py` are comments, and its `cook.pth` is `import cook`. That 12-byte file has the same sha256 as the real `cook.pth` from the wheel's RECORD, which confirms the published hash. Here is the checker on a venv with the stand-in installed:

```text
$ python3 -I -S ioc_check.py env fx/infected-venv
HIT        installed        fx/infected-venv/lib/python3.12/site-packages/litellm-1.107.0.dist-info
                           litellm 1.107.0 is installed
HIT        payload-file     fx/infected-venv/lib/python3.12/site-packages/cook.pth
                           cook.pth in site-packages root (sha256 matches the published payload); owner: litellm-1.107.0
HIT        payload-file     fx/infected-venv/lib/python3.12/site-packages/cook.py
                           cook.py in site-packages root; owner: litellm-1.107.0
HIT        payload-file     fx/infected-venv/lib/python3.12/site-packages/sitecustomize.py
                           sitecustomize.py installed by litellm-1.107.0
INFO       searched         fx/infected-venv
                           1 site-packages directories checked

INDICATORS FOUND: treat this host as compromised and rotate what it could reach (exit 1)
```

Exit codes: `0` nothing found, `1` an indicator of the payload, `3` something suspicious that is not the payload, `4` incomplete, because a path, directory or archive could not be read. The `lock` check also catches equivalent spellings of the version, such as `==1.107` and `==1.107.0.0`.

A `sitecustomize.py` or a `.pth` file with `import` lines is suspicious only when nothing owns it, so the checker reads every `RECORD` in the site-packages directory. That was not enough on our Debian 12 based test machine: `/usr/lib/python3/dist-packages` holds `distutils-precedence.pth` and a `logilab_common` namespace file, both with `import` lines, and no `RECORD` lists them, because Debian packages installed them. The checker also reads dpkg's file lists, so it reports them as installed by `python3-setuptools` and `python3-logilab-common` and exits 0 (`examples/debian-dist-packages.txt`). Without that, any Debian or Ubuntu host with such packages installed would get exit 3.

### pip and uv caches

A cache can hold the wheel long after the venv is gone, and a CI cache restores it into the next job. We put the stand-in wheel through uv 0.13.0, pip 23.0.1 and pip 26.2.2 (served from a local TLS server, because pip only caches responses from secure origins) and recorded what each one left behind:

| Tool       | What it left behind (path in the cache)                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| uv 0.13.0  | the unpacked wheel, `archive-v0/<id>/litellm-1.107.0.data/purelib/cook.pth`, and an index entry, `wheels-v7/index/<hash>/litellm/1.107.0-py3-none-any` |
| pip 23.0.1 | one file under `http/`, the HTTP response with the wheel inside it                                                                                     |
| pip 26.2.2 | `http-v2/.../<hash>.body`, the raw wheel                                                                                                               |

`scan` found the payload in all three caches (`examples/cache-layout-demo.txt` in the repo). Wheel member names are stored uncompressed in a zip file, so the checker also searches raw bytes for `litellm-1.107.0.data/purelib/cook`, which catches the older pip format. pip 26's `.body` file is the wheel byte for byte (same sha256 in our run), so on a real cache the checker also matches it against the seven published wheel hashes.

### CI runners

- **Hosted runners** are gone after the job. What remains is the job log. Search the logs from October 21 for `litellm-1.107.0` (pip prints `Downloading litellm-1.107.0-...` and `Successfully installed ... litellm-1.107.0`) and `litellm==1.107.0` (uv prints ` + litellm==1.107.0`). We checked these lines with pip 23.0.1, pip 26.2.2 and uv 0.13.0 on the stand-in wheel.
- **Restored dependency caches** can carry the wheel into later jobs. Scan the cache directory, or delete the cache entries created that day.
- **Persistent and self-hosted runners** are hosts. Run the full check on them.

### Images

Scan a saved image: `docker save` or `podman save` output, an OCI archive, or a flat `docker export` tar of a container's filesystem. The checker reads gzip layers and reports zstd layers as unreadable. To compare digests, the platform manifests of the bad `litellm` image are `sha256:bd1aeee4...` (amd64) and `sha256:56b74573...` (arm64), under index `sha256:1bbcb144...`. The checker carries the full list, including the `-database` and `-non_root` variants.

## Rotate what

The stealer does not need the remote loader: it runs in a background thread as soon as the interpreter starts. The [issue](https://github.com/BerriAI/litellm/issues/47826) lists what it collects. Rotate in roughly this order:

1. **Clean up first, from the shell.** Delete `cook.pth`, `cook.py`, `sitecustomize.py` and the matching `__pycache__/cook*.pyc` and `sitecustomize*.pyc` from every affected site-packages. Kill the detached Python daemon that holds `/tmp/remote_code_loader.lock`. Then rebuild the venv or image from scratch with `litellm==1.106.2`.
2. **Cloud credentials.** The stealer reads AWS, Azure and gcloud files and instance metadata (AWS IMDSv2, ECS task credentials, GCP and Azure metadata), and validates AWS credentials with STS `GetCallerIdentity`. Rotate the instance or task role, then search CloudTrail for `GetCallerIdentity` from that role around install time and for use of its credentials from outside your network.
3. **The LiteLLM proxy itself.** If `DATABASE_URL` is set, the stealer dumps `LiteLLM_CredentialsTable` and `LiteLLM_ProxyModelTable`, which hold every upstream provider key. Rotate all of them, the master key, the virtual keys and the database password.
4. **Build and publish credentials.** Kubernetes service account tokens and kubeconfigs, `/run/secrets`, CI secrets (GitLab Runner, Jenkins), Vault and Terraform credentials, `.git-credentials`, `.npmrc`, `.pypirc`, Maven, Gradle, Cargo, RubyGems and Composer tokens, `.env` files.
5. **Keys and the rest.** SSH, GPG and TLS private keys (including Let's Encrypt), Hugging Face tokens, AI coding tool configs (Codex, Gemini, Cursor, Windsurf, VS Code MCP settings and others), browser-saved passwords and cookies, and anything in the environment of any process on the host. The stealer reads `/proc/*/environ` for every process it can.

If 1.107.0 ran on a host with outbound internet access, assume the exfiltration succeeded.

## The provenance gap

The release passed a source review because it was not built from the reviewed source. The question is which record names the source an artifact was actually built from.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "src", "label": "BerriAI/litellm", "sub": "the repo you review", "icon": "branch", "tone": "green", "status": "ok", "detail": "Public and clean. The v1.106.2 tag is commit 49943cd. There is no v1.107.0 tag." },
      { "id": "fork", "label": "Berri-AI/litellm", "sub": "lookalike fork", "icon": "branch", "tone": "red", "status": "down", "detail": "The release was built from commit 20535d8f, the tip of the attacker's commits, which exists only on the fork. The repo now returns 404." }
    ],
    [
      { "id": "rel", "label": "BerriAI/project-releaser", "sub": "private release workflows", "icon": "gear", "tone": "amber", "detail": "stage.yml built the v1.106.2 images (their provenance says so). publish-litellm.yml is the PyPI publisher on all 15 attested releases. On Oct 21 the pipeline ran with the fork as its source." }
    ],
    [
      { "id": "pypi", "label": "PyPI wheels", "sub": "publish attestation", "icon": "box", "tone": "blue", "detail": "An attestation names the uploading workflow: BerriAI/project-releaser, publish-litellm.yml, environment pypi-publish. None on any release since April 29." },
      { "id": "img", "label": "Container images", "sub": "BuildKit provenance", "icon": "box", "tone": "violet", "detail": "vcs:source records the repo the build checked out: BerriAI/litellm for v1.106.2, Berri-AI/litellm for v1.107.0." }
    ]
  ],
  "edges": [
    ["src", "rel", "normal release"],
    ["fork", "rel", "Oct 21"],
    ["rel", "pypi", "upload"],
    ["rel", "img", "push"]
  ]
}
```

### What PyPI records

A PEP 740 publish attestation is a Sigstore signature made with the identity of the CI workflow that uploads the file: repository, workflow file and environment. Trusted Publishing accepts an upload only from a publisher registered for the project on PyPI. PyPI then [verifies each attestation](https://github.com/pypi/warehouse/blob/main/warehouse/attestations/services.py) against the identity of the publisher that authenticated the upload, and records that publisher in the file's provenance. So the attestation answers "which workflow uploaded this file". It does not say which source that workflow built.

We pulled litellm's whole history from PyPI's Simple API and read the attestations through the [Integrity API](https://docs.pypi.org/api/integrity/):

```terminal
{
  "title": "litellm on PyPI, checked 2026-10-26 23:17 UTC",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python3 -I scripts/litellm_history.py",
      "output": "litellm: 956 releases on PyPI, checked 2026-10-26T23:17:57+00:00\n  no attest.  727 releases  0.1.0 (2023-07-27) .. 1.82.6 (2026-03-22)\n  attested     15 releases  1.83.0 (2026-03-31) .. 1.83.14 (2026-04-26)\n  no attest.  214 releases  1.84.0.dev1 (2026-04-29) .. 1.106.4 (2026-10-25)\n  publisher on 15 of 15 attested releases (1.83.0 .. 1.83.14): GitHub repository=BerriAI/project-releaser workflow=publish-litellm.yml environment=pypi-publish\n  1.107.0: not on PyPI (removed on 21 Oct 2026)\nwrote results/litellm-attestation-history-20261026T231757Z.json"
    },
    { "comment": "verify the last attested wheel against the repo litellm's metadata names, then against its publisher" },
    {
      "cmd": "pypi-attestations verify pypi --repository https://github.com/BerriAI/litellm pypi:litellm-1.83.14-py3-none-any.whl",
      "output": "Verification failed: provenance was signed by repository \"BerriAI/project-releaser\", expected \"BerriAI/litellm\""
    },
    {
      "cmd": "pypi-attestations verify pypi --repository https://github.com/BerriAI/project-releaser pypi:litellm-1.83.14-py3-none-any.whl",
      "output": "OK: litellm-1.83.14-py3-none-any.whl"
    }
  ]
}
```

Three things follow from that output.

1. **There was nothing to check on PyPI.** 1.107.0 is gone from PyPI now (the JSON and Integrity APIs return 404), so we cannot read its record directly. The reporters wrote that litellm "has never published attestations". That is not quite right, because 15 releases had them. But 1.106.2, which the same pipeline built and uploaded an hour before 1.107.0, has none, and neither do the 213 other releases since April 29. The attested run lasted four weeks. It began with 1.83.0 on March 31, after the March compromise, when the maintainers moved releases to the private repo, and ended with 1.83.14 on April 26.
2. **A check against the source repository fails on the good releases too.** The last legitimate attested wheel fails `--repository https://github.com/BerriAI/litellm`, the repository that litellm's metadata names. A policy that compares the attestation with the metadata would have flagged every attested litellm release and taught everyone to ignore it.
3. **A check against the real publisher would most likely have passed 1.107.0.** The maintainers write that the compromised workflow "signed and published the poisoned artifacts", and an upload through Trusted Publishing can only come from a publisher registered for the project. So an attestation on 1.107.0 would have named a registered publisher. The one on all 15 attested releases is `BerriAI/project-releaser`, `publish-litellm.yml`, `pypi-publish`. If 1.107.0 went out through that identity, a check pinned to it would have passed. If it went out through another registered identity, a pin on the full identity would have flagged the change. A check on the repository alone would have flagged it only if that identity used a different repository. The signing certificate also records the release repository's commit, but that repository is private, so nobody outside could have told a good commit from a bad one.

This is an inference: we do not have the 1.107.0 upload record. But the publish attestation has no field for the repository that a workflow checked out. PyPI does support a second attestation type, [SLSA provenance](https://docs.pypi.org/attestations/), which can record a source. We come back to it in the survey.

### What the image recorded

BuildKit, the builder behind `docker buildx`, can attach a SLSA provenance document to an image. In it, `vcs:source` is the git remote of the build context, so it names the repository that the build checked out. We read it for the clean v1.106.2 images from the registry API on October 26 at 23:08 UTC, without pulling a layer (excerpt):

```text
$ python3 -I scripts/image_provenance.py ghcr.io/berriai/litellm:v1.106.2 ... ghcr.io/berriai/litellm:v1.107.0 ...
ghcr.io/berriai/litellm:v1.106.2  index sha256:7294b90f868c...
  linux/arm64  vcs:source   https://github.com/BerriAI/litellm
               vcs:revision 49943cd52ea46aacf8db2e5cb2b890d580fe9bb4
               builder      https://github.com/BerriAI/project-releaser/actions/runs/39574962801/attempts/1
               workflow     BerriAI/project-releaser/.github/workflows/stage.yml@refs/heads/main (d687b69)
               inputs       allow_republish=false, dry_run=false, git_ref=49943cd52ea46aacf8db2e5cb2b890d580fe9bb4, release_type=stable, repo=litellm
  ...
ghcr.io/berriai/litellm:v1.107.0  HTTP 404
ghcr.io/berriai/litellm@sha256:bd1aeee419ea36da9aa2b657288da4101887be468f020ac63d22ba6ed84a3ea5  HTTP 404
```

Commit `49943cd` is the v1.106.2 tag. The same source, revision and workflow appear on every v1.106.2 image we read: three variants on GHCR with two platforms each, and Docker Hub's `litellm/litellm:v1.106.2`, which has the same index digest as GHCR's. The 1.107.0 tag and the bad platform digests return 404 on GHCR. The 1.107.0 images are deleted, so we could not read theirs. Upwind and [Socket](https://socket.dev/blog/litellm-compromise) read them before removal and recorded `vcs:source https://github.com/Berri-AI/litellm` at `20535d8f`, with a dispatch input that set `source_owner` to `Berri-AI`. With Docker, `docker buildx imagetools inspect <image> --format '{{ json .Provenance.SLSA }}'` shows the same document.

This record named the fork, and the reason is a little uncomfortable. BuildKit writes `vcs:source` inside the build, and the attacker controlled the build. Nothing outside the build vouches for the field: the maintainers say the same release workflow signed the images, and it signed the bad ones too. It named the fork because the build left the remote URL as it was. It is good evidence, but it is not a guarantee.

### How many PyPI projects publish an attestation at all

A provenance check needs a record to read. We surveyed the latest release of the 1,000 most downloaded projects (30-day downloads to October 1, 2026, from [hugovk/top-pypi-packages](https://github.com/hugovk/top-pypi-packages), saved in the repo so the set is fixed) plus a list of 44 AI-stack projects. For each project, the survey records how many files of the latest release have provenance, and who published them. The run started on October 26 at 22:36 UTC: 1,022 projects, 2,925 requests, no errors.

```chart
{
  "type": "bar",
  "title": "Latest PyPI releases with an attestation",
  "unit": "%",
  "tickLabel": "repo match",
  "caption": "Bar: latest release has an attestation on at least one file. Tick: attested by the repository the release's metadata names, counting 5 renamed or transferred repositories as matches. Top projects by 30-day downloads to Oct 1, 2026; surveyed Oct 26, 2026, 22:36 UTC. Source: results/summary-20261026T223625Z.md in the demo repo.",
  "rows": [
    { "label": "Top 1-100", "value": 60.0, "tick": 56.0, "series": "Top" },
    { "label": "Top 101-500", "value": 40.5, "tick": 35.0, "series": "Top" },
    { "label": "Top 501-1000", "value": 33.6, "tick": 27.6, "series": "Top" },
    { "label": "All top 1,000", "value": 39.0, "tick": 33.4, "series": "All" },
    { "label": "AI-stack list (44)", "value": 29.5, "tick": 25.0, "series": "AI" }
  ],
  "series": [
    { "name": "Top", "color": "#0080ff" },
    { "name": "All", "color": "#f59e0b" },
    { "name": "AI", "color": "#8b5cf6" }
  ]
}
```

The 390 attested top-1,000 projects break down like this:

| Attested by                                                                                                              | Projects |
| ------------------------------------------------------------------------------------------------------------------------ | -------- |
| The repository the metadata names                                                                                        | 329      |
| The same repository after a rename or transfer (filelock, pendulum, dulwich, cramjam, dbt-extractor)                     | 5        |
| A different public repository (numpy, scipy, scikit-learn and matplotlib publish from `*-release` repos)                 | 5        |
| A repository that is not publicly visible (mlflow, spaCy and seven other Explosion packages, semgrep, modal, dbt-protos) | 14       |
| A GitHub repository, but the metadata names none (numba, selenium, thrift and 4 more)                                    | 7        |
| A Google Cloud service account, with no repository (30 Google client libraries)                                          | 30       |
| No attestation on the latest release                                                                                     | 610      |

Some limits on these numbers. A project counts as attested if any file of its latest release is attested (3 were partial, such as sqlalchemy with 64 of 72 files). Restricting to the 864 projects whose latest release was uploaded on or after November 14, 2024, the day PyPI announced attestations, gives 45.0% attested and 38.5% repository matches. To check the method, a second script asked the Integrity API file by file (up to 80 files per release) about 40 randomly chosen projects and the 23 projects described below. All 63 agreed with the survey.

Three findings stand out.

**The publisher is often not the source repository, on purpose.** numpy, scipy, scikit-learn, matplotlib, mlflow and spaCy publish from a separate release repository, like litellm. That can be a reasonable design: it keeps the publishing rights in a repository that fewer people can change. But it means a "publisher equals metadata repository" rule fails for some of the most installed packages in Python. What you can pin is the publisher that you observe.

**No sampled file carries the attestation that records a source.** We read up to three attested files per project. For all 396 attested projects in the survey (390 from the top 1,000 and 6 more from the AI list), every attestation in those files is a PyPI publish attestation (`https://docs.pypi.org/attestations/publish/v1`). None is the SLSA provenance type, which PyPI describes as recording "a package's original source location".

**23 projects stopped attesting.** They attested an earlier release and not their latest one: litellm, fastapi, typer, sqlmodel, langchain-core, fastmcp, langfuse, watchfiles, databricks-sdk, the Supabase client family and others. We read their publish workflows as they are today. 12 of them upload with `uv publish`. The [uv docs](https://docs.astral.sh/uv/guides/package/) say it "does not currently generate attestations; attestations must be created separately before publishing". 2 (langchain-core and dspy) set `attestations: false` on the PyPA publish action. For 7, we found no upload step in a public workflow, and 2 (databricks-sdk and rich-toolkit) name no GitHub repository in their metadata, so we read nothing. Several packages share one repository (typer and typer-slim, httpx2 and httpcore2, the Supabase family), so this is evidence about repositories more than about each package. This shows how those projects publish now, not why they stopped.

In the AI-stack list, 13 of 44 latest releases are attested. openai, mcp, transformers, huggingface-hub, tokenizers, mistralai, ollama, pinecone, pydantic-ai, openai-agents and haystack-ai are attested by the repository their metadata names. google-genai is attested by a Google service account, and autogen-agentchat by `microsoft/autogen`, which its metadata does not name. Without an attestation: anthropic, langchain, langgraph, llama-index, torch, vllm, tiktoken, chromadb, crewai and 22 more. No attestation does not mean a project publishes carelessly. It means that a provenance check has nothing to read.

The same pattern holds inside one dependency tree. We locked `litellm==1.106.2` with hashes for Linux x86_64 and Python 3.12 and ran the per-file check on the 58 packages, which reads the provenance of every hashed file (about 3 minutes):

```text
$ python3 -I -S provenance_check.py --lock examples/litellm-1.106.2-lock/requirements.txt    (excerpt, 5 of 58 package lines)
aiohttp==3.14.5                      attested-match       GitHub repository=aio-libs/aiohttp workflow=ci-cd.yml environment=pypi
...
filelock==3.32.7                     attested-other-repo  GitHub repository=tox-dev/filelock workflow=release.yaml environment=release  (metadata: github.com/tox-dev/py-filelock)
...
litellm==1.106.2                     no-attestation
openai==2.54.0                       attested-match       GitHub repository=openai/openai-python workflow=create-releases.yml environment=publish
pydantic-core==2.50.1                no-attestation
...

attested-match: 33, attested-other-repo: 1, no-attestation: 24
```

The one `attested-other-repo` is filelock, whose repository was renamed. The per-file checker does not resolve renames; the survey does.

## What you can enforce today

**1. A release cooldown.** 1.107.0 was on PyPI for about 1 hour 43 minutes. Any rule that ignores files younger than two hours would have skipped it. Malware scanners flagged it within that window: Socket reports 7 minutes after upload, Chainguard 16. A cooldown gives detection time to work.

```tabs
{
  "title": "Skip releases younger than 7 days",
  "tabs": [
    { "label": "uv (pyproject.toml)", "lang": "toml", "code": "[tool.uv]\nexclude-newer = \"7 days\"\n\n# let a security fix through on purpose\nexclude-newer-package = { cryptography = false }" },
    { "label": "uv pip", "lang": "bash", "code": "uv pip install --exclude-newer \"7 days\" -r requirements.txt" },
    { "label": "pip 26.1+", "lang": "bash", "code": "pip install --uploaded-prior-to P7D -r requirements.txt" }
  ]
}
```

uv compares each file's upload time and accepts friendly durations (`24 hours`, `1 week`, `30 days`) and ISO 8601 durations (`P7D`). pip added `--uploaded-prior-to` in 26.0 and the `P3D` day form in 26.1. It works only with indexes that publish upload times, and PyPI does. The cost is real: a cooldown delays security fixes by the same amount, so exempt the packages you patch urgently.

**2. Hash-locked installs, relocked on purpose.** A `uv.lock`, a `pylock.toml` or a `pip-compile --generate-hashes` file made before 11:39 UTC on October 21 kept you on 1.106.2 or earlier. Install with `uv sync --locked` or `pip install --require-hashes`, and treat a lock refresh as a change to review.

**3. Image digests plus a source check.** Pin images by digest, and before you promote a new digest, check that its BuildKit provenance names the repository you expect. A digest pin alone would have pinned the bad image if you had updated it during the window. Remember that the source field is written by the build, so it can be forged.

**4. Publisher pins for packages that attest.** Verify against the publisher you observed, not the repository in the metadata:

```bash
# One file, cryptographically, with the PyPA verifier (pypi-attestations 0.0.30)
uvx --from pypi-attestations==0.0.30 pypi-attestations verify pypi \
  --repository https://github.com/psf/requests pypi:requests-2.34.2-py3-none-any.whl

# Every installed or locked file: record publishers once, alert when one changes or disappears
python3 -I -S provenance_check.py --env .venv --write-pins pins.json
python3 -I -S provenance_check.py --lock uv.lock --pins pins.json
```

`provenance_check.py` reads PyPI's record of the attestation and does not repeat the Sigstore verification. PyPI checks the signature at upload, and `pypi-attestations` checks it again on your side. For a lock, every hash must match a file of the release. For an installed wheel, the checker matches the wheel tags and compares the installed `METADATA` with the sha256 that PyPI publishes for that wheel's metadata (pip and uv both install it unchanged). That ties the install to a PyPI wheel's metadata, not to every installed byte. Be honest about what a pin buys you. Pinned in April, litellm's publisher would have "disappeared" on every release from April 29 on. That is 206 alerts before the one that mattered, and that is how checks like this get turned off.

**What pip and uv do not do.** As of October 2026, neither installer verifies PEP 740 attestations. The pip changelog up to 26.2.2 (October 20) and the uv changelog up to 0.13.5 (October 21) list no such option. pip checks hashes (`--require-hashes`) and upload times. uv checks hashes and upload times, and `uv publish` uploads attestation files that another step created.

**5. If you maintain a package.** Keep attestations on. The PyPA publish action creates them by default when you use Trusted Publishing. If you switch to `uv publish`, add a step that creates them: uv's [GitHub Actions guide](https://docs.astral.sh/uv/guides/integration/github/) runs `astral-sh/attest-action` before `uv publish`. If you publish from a separate release repository, say so in your README, so that users can pin the right publisher.

**6. If you run the LiteLLM proxy.** In the issue thread, a LiteLLM maintainer called default-deny egress "a very good way to run LiteLLM". A proxy that can reach only its model providers could not have sent anything to `www.litellm.dev` or fetched a second stage.

## What we could not conclude

- **We could not see 1.107.0 on PyPI.** It was removed before we started, and we found no archived copy of its JSON or provenance. The statement that it had no attestation comes from the reporters and from its neighbors: 1.106.2, from the same pipeline an hour earlier, has none.
- **What a 1.107.0 attestation would have said is an inference** from the Trusted Publishing rules and the 15 attested releases. We do not know which workflow file uploaded 1.107.0.
- **We did not read the 1.107.0 image provenance ourselves.** The images return 404 by tag and by digest. `Berri-AI/litellm` at `20535d8f` comes from Upwind and Socket.
- **We do not know why litellm and the 22 other projects stopped attesting.** PyPI's JSON API does not say which client uploaded a file, and the workflows we read are today's versions.
- **The survey counts projects, not installs.** It looks at the latest release only, and your pins may point to older releases with different records.
- **We did not test forging BuildKit provenance.** We say it can be forged because whoever runs the build writes it, not because we did it.
- **Nothing here catches an attacker who runs your real pipeline on your real source.** That is what happened to [TanStack on npm](/posts/tanstack-npm-worm-dead-mans-switch), where the malicious versions carried valid provenance.

## Summary

- LiteLLM 1.107.0 came from the real release pipeline, fed from a lookalike fork. Reviewing `BerriAI/litellm` could not have caught it.
- Check without starting the suspect Python: `python3 -I -S ioc_check.py` covers venvs, lock files, pip and uv caches, image tarballs and host markers. Then rotate everything the host could reach, starting with cloud roles and the proxy's provider keys.
- The Docker image's BuildKit provenance named the fork. PyPI had no attestation to check, and a PyPI publish attestation names the uploading workflow, not the source it built.
- 39.0% of the top 1,000 PyPI projects attest their latest release. 33.4% are attested by the repository their metadata names. 23 projects in our set stopped attesting, and we found no SLSA provenance attestation on any of the 396 attested projects.
- What works today is a cooldown, hash locks, digest pins with a source check, and publisher pins where they exist. As of October 2026, pip and uv do not verify attestations for you.

To attest a build and check it against a pinned repository and workflow with `gh attestation verify`, read [A08:2025 Software or Data Integrity Failures](/guides/owasp-top-10/08-software-integrity-failures#h3-build-provenance) in our OWASP Top 10 guide.
