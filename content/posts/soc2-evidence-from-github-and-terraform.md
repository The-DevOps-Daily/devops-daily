---
title: 'SOC 2 Evidence From GitHub and Terraform, and the Part That Still Needs a Person'
excerpt: 'We pointed a small evidence collector at a repository whose main branch had a strict ruleset. The ruleset passed and three change-management controls failed. Here is which SOC 2 evidence you can pull from GitHub, Terraform and the API, which still needs a person, and the four ways an evidence script can lie to you.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-10-22'
publishedAt: '2026-10-22T09:00:00Z'
updatedAt: '2026-10-22T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Security
  - SOC 2
  - Compliance
  - GitHub
  - Terraform
  - DevSecOps
  - Audit
---

We pointed a small evidence collector at a GitHub repository whose main branch had a strict ruleset: every change through a pull request, one approval, and a required `test` check. The ruleset control passed. Three of the change-management controls under it failed: none of the four merged pull requests had an independent approval, one was merged five seconds before its check finished, and one commit reached main without a pull request at all. All three were real, and all three would have looked fine in a screenshot of the settings page.

That gap is the whole job when a customer asks for SOC 2. An auditor does not only want to know what you configured. For a Type II report they want to see what happened under that configuration across the whole review period, usually by sampling. This post shows which of that evidence you can pull straight from GitHub, the GitHub API and your Terraform code, which still needs a person and a signature, and what we got wrong in the first version of our collector.

## TL;DR

- Settings are not evidence of operation. Our main branch required approvals and a passing check, and the evidence still showed 0 of 4 pull requests independently approved and 1 merged before its check finished, because admins could bypass the rule.
- "The checks are green" is the wrong question. Pull request #3's check passed 5 seconds after the merge. Its status today is green; it did not gate the merge. Compare the check's completion time with the merge time.
- An evidence script must fail closed. Our first version could pass a control on missing data in four ways: approvals of an older commit, alerts it was not allowed to read, commits linked to the wrong pull request, and a list cut off at a page limit. Each now reports `fail` or `incomplete`.
- Terraform scanning is evidence of a configuration standard, but a pass is only as good as the rule list. Trivy flagged the public database flag, and its security-group rule passed a Postgres port open to the whole internet, because that rule only covers SSH and RDP.
- Access reviews, policy sign-offs, training, risk assessment, vendor reviews and incident-response tests still need a person. Automation can gather the list; it cannot make the judgement.
- The collector ran in 16 seconds with 24 API calls and produced 11 timestamped evidence files with a SHA-256 manifest, for one repository and 90 days.

## Prerequisites

- A GitHub repository you are admin on, and a token in `GITHUB_TOKEN` or a logged-in `gh` CLI
- Python 3.10 or later (the collector uses only the standard library)
- [Trivy](https://trivy.dev) for the Terraform scan
- A rough idea of what SOC 2 is: an AICPA attestation report on your controls, mapped to the Trust Services Criteria

```github
The-DevOps-Daily/soc2-evidence-collector
```

## What an auditor actually asks for

SOC 2 reports on the [Trust Services Criteria](https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022) (free download with an AICPA account), a set of criteria with "points of focus" that describe what a control usually covers. You choose the controls; the auditor tests them. A Type I report says the controls were designed and in place on one day. A Type II report says they operated over a period, often 3 to 12 months, and that is where the evidence work goes: the auditor picks a sample of changes, alerts and access changes from the period and asks you to show each one.

Three criteria cover most of what a code repository can prove. In the AICPA's words:

> **CC8.1** The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives.

> **CC7.1** To meet its objectives, the entity uses detection and monitoring procedures to identify (1) changes to configurations that result in the introduction of new vulnerabilities, and (2) susceptibilities to newly discovered vulnerabilities.

> **CC6.1** The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity's objectives.

For a change, "approves" and "tests" are the parts people get caught on. For each sampled change, the auditor wants to see that someone other than the author approved it and that it was tested before it reached production. For vulnerabilities, they want to see that you detect them and fix the serious ones within the time your own policy promises.

The usual way to produce this is screenshots: the branch protection page, the pull request page for each sampled change, the Dependabot tab, the security settings. A screenshot shows the state at one moment, without a reliable timestamp or a way to tell whether it was edited. An API response saved with its collection time and a hash is better evidence, and a script can collect it for every change in the period instead of a sample.

## The collector

`collect.py` reads one repository through the GitHub API and evaluates eight controls:

| Criterion | Control | Where the evidence comes from |
| --- | --- | --- |
| CC8.1 | Changes to the default branch go through a pull request | branch rules and classic branch protection |
| CC8.1 | Every merged change was tested before the merge | check runs on the merged commit, finished before the merge time |
| CC8.1 | Every merged change was approved by someone other than its author | reviews that approved the merged commit, before the merge |
| CC8.1 | Nothing reached the default branch without a pull request | the merged pull request behind each commit |
| CC7.1 | Dependency vulnerability alerts are on | the Dependabot setting |
| CC7.1 | No critical or high alert is open past the SLA | open Dependabot alerts and their age |
| CC6.1 | Secret scanning and push protection are on | the repository's security settings |
| CC6.3 | Repository access follows least privilege | collaborator roles, judged by a person |

Every raw API response goes into a timestamped folder with a SHA-256 manifest, and the summary marks each control `pass`, `fail`, `needs a person` or `incomplete`:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "GitHub API", "sub": "rules, PRs, checks, alerts", "icon": "globe", "tone": "slate" },
    { "label": "collect.py", "sub": "8 controls", "icon": "gear", "tone": "blue" },
    { "label": "raw/*.json", "sub": "timestamped, hashed", "icon": "database", "tone": "violet" },
    { "label": "summary.json", "sub": "pass, fail, incomplete", "icon": "check", "tone": "green" },
    { "label": "A person", "sub": "judgement, sign-off", "icon": "shield", "tone": "amber" }
  ]
}
```

### The test subject

We made the collector's own repository its test subject, with a history built on purpose. Its main branch has a ruleset that requires a pull request, one approval and the `test` check, with a bypass for organization admins. Then:

- The first commit went straight to main, before the ruleset existed.
- Every pull request was merged by an admin through the bypass. Nobody else could approve: it is a one-person setup, which is exactly the situation many small teams are in when the first enterprise customer asks for SOC 2.
- Pull request #3 was merged while its `test` check was still running.
- `examples/app/requirements.txt` pins PyYAML 5.3 and Jinja2 2.10, which have published advisories, so Dependabot has alerts to report.

### The run

```terminal
{
  "title": "collect.py",
  "steps": [
    { "cmd": "python3 collect.py The-DevOps-Daily/soc2-evidence-collector --days 90", "output": "The-DevOps-Daily/soc2-evidence-collector, last 90 days: 11 evidence files, 24 API calls, 15.9 s\n  CC8.1  pass            Changes to the default branch go through a pull request\n         rule on main: pull_request, 1 approval(s) required\n  CC8.1  fail            Every merged change was tested before the merge\n         required checks: 1; 3 of 4 merged PRs had passing checks at merge time\n  CC8.1  fail            Every merged change was approved by someone other than its author\n         0 of 4 merged PRs had an independent approval of the merged commit\n  CC8.1  fail            Nothing reached the default branch without a pull request\n         1 of 5 commits on main in the window are not linked to a merged PR\n  CC7.1  pass            Dependency vulnerability alerts are on\n         Dependabot alerts on\n  CC7.1  pass            No critical or high alert is open past 30 days\n         8 open alerts, 0 critical or high past 30 days\n  CC6.1  pass            Secret scanning and push protection are on\n         secret scanning enabled, push protection enabled\n  CC6.3  needs a person  Repository access follows least privilege\n         roles: {'admin': 4}, outside collaborators: 0; the list is evidence, the judgement is not\nevidence: evidence/The-DevOps-Daily__soc2-evidence-collector/20261019T125319Z" }
  ]
}
```

It found every gap we put in, and it exits non-zero, so it can gate a pipeline or a weekly job.

## What the failures mean

### The rule was on, and the evidence still failed

The first control passed: a pull request with one approval is required on main. The approval control under it failed for all four merged pull requests. An admin bypass is not a bug in the ruleset. It is a feature that most organizations keep for emergencies, and it is exactly what an auditor's sample finds. If your report says "all changes are approved by a second person" and your evidence shows admin merges without approval, that is an exception in the report.

For a one-person or two-person team, the honest fix is not to pretend. Common approaches are a reviewer from outside the team for production repositories, or a documented control that someone reviews merged changes after the fact within a fixed time. Which of these your auditor accepts is a conversation to have before the review period starts, not after.

### Green now is not the same as tested before the merge

Here is the evidence file for pull request #3 as the collector saved it (indentation widened for reading):

```json
{
  "collected_at": "2026-10-19T12:53:19.848831+00:00",
  "source": "GitHub API, The-DevOps-Daily/soc2-evidence-collector",
  "data": {
    "pull": {
      "number": 3,
      "title": "Examples to scan, and the IaC scan script",
      "merged_at": "2026-10-19T12:50:03Z",
      "html_url": "https://github.com/The-DevOps-Daily/soc2-evidence-collector/pull/3"
    },
    "head_sha": "d4b17526cfcaf516833023b9ec402f45a70a10ec",
    "reviews": [],
    "check_runs": [
      {
        "name": "test",
        "status": "completed",
        "conclusion": "success",
        "completed_at": "2026-10-19T12:50:08Z"
      }
    ]
  }
}
```

The check succeeded at 12:50:08. The pull request was merged at 12:50:03. Look at the pull request page today and you see a green check, which is what most screenshots and many scripts record. The collector compares the two timestamps, and so should anything you hand to an auditor. A required check stops a normal merge until it passes, so a merge before completion means someone used a bypass.

### The commit with no pull request

The one commit without a pull request is the repository's first commit, pushed before the ruleset existed. That is a normal, explainable exception, and the evidence lets you explain it with a date. The same control also catches the cases that are not normal: an admin pushing a hotfix straight to main, or a force push that rewrote history.

### The alerts that passed

Dependabot raised 8 open alerts for the two pinned packages: 2 critical, 1 high and 5 medium. The SLA control passed, correctly, because the alerts were minutes old. Our default SLA is 30 days for critical and high; use the number your own vulnerability policy states, since that is what the auditor will hold you to. The same run in five weeks would fail.

## Four ways our first version could lie

A review of the first version of the collector found four ways it could pass a control without evidence. For a tool whose output goes to an auditor, every one of these is a real defect: a control must never pass because data was missing.

1. **Approvals of an older commit counted.** The first version accepted any approval from someone other than the author, made before the merge. If the author pushed new commits after the approval, the merged code was not the code that was approved. The collector now counts only approvals whose `commit_id` is the merged head commit, and reports the rest as stale.
2. **Unreadable alerts looked like zero alerts.** With a token that could not read Dependabot alerts, the API returned 403 and the first version evaluated an empty list: no late alerts, pass. It now reports the SLA control as `incomplete` with the HTTP status.
3. **Any pull request link counted.** A commit counted as reviewed if any pull request was associated with it, even one merged into another branch or outside the window. It now has to be a pull request merged into the default branch and inside the evaluated set.
4. **Lists were cut off silently.** The commit list stopped at 300 and the alert list at one page. The first version then judged what it had. Alerts are now paged completely, and a commit list that reaches the limit makes the control `incomplete`.

None of these would have changed the result for our demo repository, which has no approvals at all, a readable alert list of 8 and five commits. They would have changed it for a real repository, where a stale approval or a missing permission is common. Each fix has a test in the repository.

Running the fixed version found one more problem: the Dependabot alerts API rejects page numbers (`Pagination using the page parameter is not supported`) and pages with cursors in the `Link` header instead. A collector that ignored the error would have reported no alerts.

## Evidence from Terraform

CC7.1's points of focus start with "Uses Defined Configuration Standards" and "Monitors Infrastructure and Software" for noncompliance with them. For infrastructure as code, a misconfiguration scan in CI is evidence of both: the rule set is your standard, and the scan result on each change is the monitoring.

The repository's `examples/terraform` holds a small AWS stack: a customer-data bucket with a KMS key, versioning and a public access block; an exports bucket added later without any of those; and a Postgres instance, encrypted and backed up, with a security group open to `0.0.0.0/0` on port 5432 and `publicly_accessible = true`. `scan-iac.sh` runs Trivy and keeps the report, a summary and a manifest:

```terminal
{
  "title": "scan-iac.sh",
  "steps": [
    { "cmd": "./scan-iac.sh examples/terraform", "output": "92 checks, 12 failed, 5.0 s\n  HIGH     AWS-0086  aws_s3_bucket.exports        S3 Access block should block public ACL\n  HIGH     AWS-0087  aws_s3_bucket.exports        S3 Access block should block public policy\n  HIGH     AWS-0091  aws_s3_bucket.exports        S3 Access Block should Ignore Public ACL\n  HIGH     AWS-0093  aws_s3_bucket.exports        S3 Access block should restrict public bucket to limit access\n  HIGH     AWS-0132  aws_s3_bucket.exports        S3 encryption should use Customer Managed Keys\n  HIGH     AWS-0180  aws_db_instance.app          RDS Publicly Accessible\n  MEDIUM   AWS-0090  aws_s3_bucket.exports        S3 Data should be versioned\n  MEDIUM   AWS-0176  aws_db_instance.app          RDS IAM Database Authentication Disabled\n  LOW      AWS-0089  aws_s3_bucket.customer_data  S3 Bucket Logging\n  LOW      AWS-0089  aws_s3_bucket.exports        S3 Bucket Logging\n  LOW      AWS-0094  aws_s3_bucket.exports        S3 buckets should each define an aws_s3_bucket_public_access_block\n  LOW      AWS-0133  aws_db_instance.app          Enable Performance Insights to detect potential problems\nevidence: evidence/iac/20261019T125335Z" }
  ]
}
```

The exports bucket and the public database were both caught. The open security group was not. Trivy's ingress rule, AWS-0107, is titled "Security groups should not allow unrestricted ingress to SSH or RDP" and it passed: port 5432 is neither. The database was flagged only because `publicly_accessible` was also set. We removed that flag, kept the security group and scanned again: the only database findings left were Performance Insights and IAM authentication, and nothing pointed at a database port open to the world.

That is the general limit of configuration scanning as evidence. A pass means "none of these rules failed", not "this is safe". Your configuration standard is the rule set you run plus the rules you add for what it misses. Trivy and similar tools accept custom policies, and a rule for "no database port open to `0.0.0.0/0`" is a few lines.

The scan reads code, not the running account. For the period itself, the auditor may ask for evidence that production matches the code: drift detection, or reading the live configuration through the cloud provider's API. That is the same pattern as the GitHub collector, with a different API.

## What still needs a person

Some controls produce evidence a script can gather but not judge, and some produce no machine evidence at all. These are the ones that usually remain:

| Criterion | What the auditor wants | Why a script cannot finish it |
| --- | --- | --- |
| CC6.2, CC6.3 | Periodic access reviews: someone confirms each account and role is still needed | The collector lists the 4 admins; whether each should be an admin is a decision, with a name and a date on it |
| CC6.2 | Access removed when someone leaves | Needs the HR leaving date to compare with when access ended |
| CC1.4, CC2.2 | Security awareness training completed | The record lives in a training tool or a signed list |
| CC5.3 | Policies written, approved and acknowledged | A policy document and each employee's acknowledgment |
| CC3.2 | A risk assessment, reviewed at least yearly | A document and its review |
| CC9.2 | Vendor and subprocessor reviews | Each vendor's own report, read and assessed |
| CC7.4, CC7.5 | Incident response that works | A tabletop exercise or a real incident, with its write-up |
| A1.3 | Recovery tested (if Availability is in scope) | A restore test with its result |

Automation helps with all of these by collecting the inputs and reminding people, but the evidence is a person's decision. In our collector, CC6.3 deliberately ends at `needs a person`: it gives the reviewer the list, and the reviewer's sign-off is the evidence.

## Build it or buy it

The compliance automation platforms, such as Vanta, Drata, Secureframe, Sprinto and Thoropass, do the same thing at a much wider scale. They connect to source control, cloud accounts, identity providers and HR systems, map what they collect to controls, track the people-side tasks such as training and policy acknowledgments, and give the auditor a place to review the evidence. For a team going through its first audit, that coverage and the auditor relationships that come with it are the reason to pay for one.

What a small script like ours is good for is understanding what those tools check, and the gaps that are specific to you: a custom deployment pipeline, a check the platform does not have, or a control you want to test on every change instead of once a quarter. Whichever you use, test it the way we tested ours: give it a repository with known problems and confirm it fails on each of them. An evidence tool that has only ever reported `pass` has not been tested.

## Time

For one repository and 90 days, the collector made 24 API calls and wrote 11 evidence files in 16 seconds. By hand, the same evidence is a screenshot of the ruleset, one per merged pull request with its checks and reviews, the Dependabot tab, the security settings and the collaborator list: about nine screenshots, none of which shows the check's completion time next to the merge time. We did not time the manual version, so we will not give a number for it. The difference grows with the sample: an auditor sampling 25 changes across 10 repositories is 25 pull request pages by hand, and one run per repository for the script.

## Summary

- Collect evidence of what happened, not only of what is configured. Our ruleset passed while three change-management controls failed under it.
- Compare timestamps. A check that is green today may have finished after the merge.
- Make evidence scripts fail closed: stale approvals, unreadable data, wrong links and truncated lists must never pass.
- Treat a configuration scan as one rule set, not as proof of safety, and add rules for what it misses. Ours passed a database port open to the internet.
- Leave the judgement to people, and make their sign-off the evidence. A script can gather the access list; it cannot decide who should be on it.
- Agree with your auditor on how exceptions, such as admin bypasses, are handled before the review period starts.

The collector, the Terraform example and the tests are in [The-DevOps-Daily/soc2-evidence-collector](https://github.com/The-DevOps-Daily/soc2-evidence-collector). Point it at a repository you own and see which controls fail.
