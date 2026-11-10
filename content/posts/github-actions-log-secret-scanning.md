---
title: 'GitHub now scans Actions logs for secrets: build a response plan before enabling it'
excerpt: 'GitHub launched secret scanning for Actions logs on November 9. Here is how the preview works, why a quiet inbox proves nothing, and how to audit and fix workflows that leak credentials.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-11-10'
publishedAt: '2026-11-10T09:00:00Z'
updatedAt: '2026-11-10T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - CI/CD
  - GitHub Actions
  - Security
  - Secrets Management
  - DevOps
---

A deployment fails, somebody turns on verbose logging, and a credential ends up beside the error you actually wanted to see. Your application repository can be clean while its build logs contain the keys to production.

On **November 9, 2026**, GitHub [launched a public preview of secret scanning for Actions workflow logs](https://github.blog/changelog/2026-11-09-secret-scanning-detects-secrets-in-github-actions-workflow-logs/). The operational question is what happens after a finding: who sees it, who can revoke the credential, and how you stop the next run from leaking its replacement. This guide walks through those decisions and a small workflow audit you can run today.

## Prerequisites

- Familiarity with GitHub Actions jobs, steps, and repository secrets.
- Read access to the workflows you want to audit, plus Git for the local search below.
- For the preview: GitHub Enterprise Cloud with GitHub Secret Protection or GitHub Advanced Security, including GHE.com. An enterprise owner must enable it; repositories also need secret scanning enabled under those licenses.

## What the preview actually does

GitHub scans completed workflow logs for provider patterns. Findings join the repository's secret scanning alerts and link to the source log. Supported secret types receive validity checks; the alert survives deletion of the log.

Enable it in enterprise **Settings → Policies → Advanced Security**, under **Secret scanning for Actions workflow logs**, by choosing **Enabled** in the **All repositories** dropdown. It is off by default.

The launch has three important boundaries:

- Only runs completing after enablement are scanned; historical logs are not backfilled.
- Generic patterns, custom patterns, AI-detected secrets, and already masked secrets are excluded.
- These alerts do not generate notifications during the preview.

Those are the [documented launch conditions](https://github.blog/changelog/2026-11-09-secret-scanning-detects-secrets-in-github-actions-workflow-logs/), as of November 10. Check them again before adopting this in a later rollout.

:::important
Assign someone to review the repository alert list. A security control without a person responsible for its findings is an unfinished rollout.
:::

## Separate prevention, detection, and recovery

Think about a failed release job that calls an external API. It receives a temporary credential at runtime, then a debug statement prints the response body. The credential was never committed, so a clean source scan does not answer whether that job handled it safely.

GitHub warns that redaction is not guaranteed when values are transformed. Its [secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use) recommends registering generated and encoded sensitive values for masking, avoiding structured blobs as secrets, and limiting token permissions. Review what your steps actually print, including error paths.

For your team, the work divides into three distinct controls:

```diagram
{
  "type": "flow",
  "title": "Three controls for a CI credential",
  "nodes": [
    {
      "label": "Before output",
      "sub": "Remove debug dumps; mask runtime values",
      "icon": "lock",
      "tone": "blue"
    },
    {
      "label": "Review findings",
      "sub": "An owner checks the alert list",
      "icon": "activity",
      "tone": "amber"
    },
    {
      "label": "Recover",
      "sub": "Revoke, investigate, fix, then rerun",
      "icon": "shield",
      "tone": "green"
    }
  ]
}
```

A useful tabletop exercise is to ask the release engineer and security contact to trace that scenario together. Can they identify the credential owner without reading the secret aloud? Can they disable the credential without access to the application author's account? Would the next scheduled job immediately leak a replacement? Those answers are more useful than a screenshot of an enabled setting.

## Audit the output paths before the next release

Start with a shortlist of workflows that deserve a human read. From the root of a checked-out repository:

```bash
# Print filenames only, so the audit does not copy sensitive lines into a terminal log.
git grep -l -E \
  'set[[:space:]]+-[^[:space:]]*x|bash[[:space:]]+-[^[:space:]]*x|printenv|toJSON\(|--verbose|--trace' \
  -- .github/workflows
```

This is a search heuristic, not a scanner. It can match harmless logging and miss scripts, composite actions, other tracing syntax, and environment dumps written as plain `env`. No matches means Git exits with status `1`; it does not certify the repository as safe. Follow each workflow into the scripts and actions it invokes.

For each match, review four things:

| Output path                  | Question to answer                                       | Useful change                                          |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| Shell tracing                | Can an expanded argument contain a token?                | Disable tracing before credential handling.            |
| Environment or context dumps | Does troubleshooting need every field?                   | Print a small allowlist of non-sensitive fields.       |
| HTTP debugging               | Are headers or response bodies written on failure?       | Log status, request ID, and a sanitized error instead. |
| Generated configuration      | Is a complete config printed after secrets are injected? | Validate required keys without printing their values.  |

Take a deployment script that prints an entire authentication response. Replace that diagnostic with the provider's request ID and status code. Keep the detailed response out of routine CI output. The person debugging the incident still gets a correlation handle without everyone who can view the run getting the credential.

### Check masking with a harmless marker

You can exercise the runner's masking behavior without a real token. This manually triggered workflow uses a deliberately fake value and grants no repository permissions:

```yaml
name: Check runtime masking
on:
  workflow_dispatch:

permissions: {}

jobs:
  check-masking:
    runs-on: ubuntu-latest
    steps:
      - name: Register a fake runtime value before logging
        shell: bash
        run: |
          set +x
          marker="masking-check-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
          printf '::add-mask::%s\n' "$marker"
          printf 'Registered marker: %s\n' "$marker"
```

The expected message is `Registered marker: ***`. This example follows GitHub's [masking command documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#masking-a-value-in-a-log): register a value before a later command could print it. In a real workflow, capture a generated credential without logging it and register it immediately; avoid tracing the command that obtains it.

:::note
This checks masking, not the new detector or your incident routing. A fake marker is not a provider credential. Never deliberately leak a production token to create a test alert.
:::

## Turn a finding into a closed incident

Suppose an alert points at yesterday's deployment job. Record the repository, run URL, job, credential provider, and the credential owner's team. Keep the raw value out of chat, tickets, screenshots, and your incident template.

Use the validity result to prioritize work. GitHub's [alert evaluation documentation](https://docs.github.com/en/code-security/tutorials/remediate-leaked-secrets/evaluating-alerts) distinguishes an active credential from an unknown result; unknown can mean validation is unsupported or could not finish. Even an inactive result still warrants checking for earlier unauthorized access.

A practical response sequence is:

1. **Stop repeated exposure.** Pause the affected release path or remove the logging statement before it can print another credential.
2. **Contain the credential.** Revoke it promptly. If replacement is needed to restore service, coordinate the switchover with its owner and explicitly verify the old credential no longer works.
3. **Investigate the exposure window.** Use the run timestamp and provider audit logs to look for unexpected activity. Record what you checked and what remains unknown.
4. **Remove accessible copies.** Delete exposed workflow logs through your approved process, retaining only the restricted evidence your incident policy needs. Check any systems to which your pipeline exports logs.
5. **Repair and verify.** Fix the output path, rerun with the replacement credential, and have a reviewer inspect the relevant success and failure output before closing the incident.

GitHub's [remediation guidance](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-secret-scanning-alerts/resolving-alerts) covers updating dependent services, inspecting provider logs, and recording why an alert is closed. Closing an alert is an administrative step; revocation and a corrected workflow are the substantive fixes.

For cloud deployments, consider removing the long-lived credential entirely. [GitHub Actions OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect) lets a trusted workflow obtain short-lived cloud credentials. Restrict the trust policy to the intended workload. Temporary credentials still need careful handling, but you avoid maintaining a reusable cloud key in repository secrets.

## Make the first week measurable

Before enabling the policy, write down which repositories are in scope, who will review their alerts, and how often. Start by mapping the deployment and publishing workflows whose credentials would cause the most damage if exposed. This inventory also makes gaps in license or repository configuration visible.

Track three things during adoption: unreviewed findings, time to revoke an exposed credential, and repeat findings from the same output path. These are suggested operating measures, not built-in preview metrics. They help answer whether the control is reducing exposure or simply adding another queue.

The useful outcome is a release process in which the right person notices a leak, can invalidate the credential, and can explain why the next run will not repeat it. Put that response path in place alongside the setting.
