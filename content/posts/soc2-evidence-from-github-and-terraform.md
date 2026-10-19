---
title: 'SOC 2 Evidence From GitHub and Terraform, and the Part That Still Needs a Person'
excerpt: 'We pointed a small evidence collector at a repository whose main branch had a strict ruleset. The ruleset passed and three change-management controls failed. Here is which SOC 2 evidence you can pull from GitHub and Terraform, which still needs a person, and ten ways an evidence script can pass a control without evidence.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-10-19'
publishedAt: '2026-10-19T09:00:00Z'
updatedAt: '2026-10-19T09:00:00Z'
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

We pointed a small evidence collector at a GitHub repository whose main branch had a strict ruleset: every change through a pull request, one approval, and a required `test` check. The ruleset control passed. Three of the change-management controls under it failed: none of the seven merged pull requests had an independent approval, one was merged five seconds before its check finished, and one commit reached main without a pull request at all. All three were real, and all three would have looked fine in a screenshot of the settings page.

That gap is the whole job when a customer asks for SOC 2. An auditor does not only want to know what you configured. For a Type II report they want to see what happened under that configuration across the review period, usually by sampling. This post shows which of that evidence you can pull from the GitHub API and your Terraform code, which still needs a person and a signature, and the ten ways the first version of our collector could pass a control without evidence.

## TL;DR

- Settings are not evidence of operation. Our main branch required approvals and a passing check, and the evidence still showed 0 of 7 pull requests independently approved and 1 merged before its check finished, because admins could bypass the rule.
- "The checks are green" is the wrong question. Pull request #3's check passed 5 seconds after the merge. It is green today; it did not gate the merge. Compare the check's completion time with the merge time.
- An evidence script must fail closed. Two reviews of our first version found ten ways it could pass a control on missing or partial data, from approvals of an older commit to a branch name that could change the API query. Each now reports `fail` or `incomplete`, with a test.
- Terraform scanning is evidence of a configuration standard, but a pass is only as good as the rule list. Trivy flagged the public database flag, and its security-group rule passed a Postgres port open to the whole internet, because that rule only covers SSH and RDP.
- Access reviews, policy sign-offs, training, risk assessment, vendor reviews and incident-response tests still need a person. Automation can gather the list; it cannot make the judgement.
- One run took 23 seconds and 35 API calls for one repository and 90 days, and produced 15 timestamped evidence files with a SHA-256 manifest.

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

For a change, "approves" and "tests" are the parts people get caught on. If your change-management control says that someone other than the author approves each change and that it is tested before it reaches production, the auditor will ask you to show both for each sampled change. For vulnerabilities, they want to see that you detect them and fix the serious ones within the time your own policy promises.

The usual way to produce this is screenshots: the branch protection page, the pull request page for each sampled change, the Dependabot tab, the security settings. A screenshot shows one moment, and nothing in it says where the values came from. An API response saved with the time it was collected is easier to check: the auditor can see the source of each value, and you can run the same query again. A hash manifest lets you show that a file did not change after collection, as long as the manifest is stored where nobody can edit it. And a script can collect the evidence for every change in the period instead of a sample.

## The collector

`collect.py` reads one repository through the GitHub API and evaluates eight controls:

| Criterion | Control | Where the evidence comes from |
| --- | --- | --- |
| CC8.1 | Changes to the default branch go through a pull request | branch rules and classic branch protection |
| CC8.1 | Every merged change passed the required checks before the merge | the last run of each required check on the pull request's head commit that started before the merge |
| CC8.1 | Every merged change was approved by someone other than its author | each reviewer's last decision before the merge, for the merged commit |
| CC8.1 | Nothing reached the default branch without a pull request | the merged pull request behind each commit, and the branch's activity log |
| CC7.1 | Dependency vulnerability alerts are on | the Dependabot setting |
| CC7.1 | No critical or high alert is open past the SLA | open Dependabot alerts and their age |
| CC6.1 | Secret scanning and push protection are on | the repository's security settings |
| CC6.3 | Repository access follows least privilege | collaborator roles, judged by a person |

It saves the fields each control uses from each API response, with the collection time, in a timestamped folder with a SHA-256 manifest, and marks each control `pass`, `fail`, `needs a person` or `incomplete`:

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

Three of the controls look back over the window: the merged pull requests with their reviews and checks, the commits on main, and the branch's activity log. The other five read the settings and the open alerts as they are on the day you run it. One run shows the history of changes. For the history of settings across a Type II period, run it on a schedule and keep every folder.

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
    {"cmd": "python3 collect.py The-DevOps-Daily/soc2-evidence-collector --days 90", "output": "The-DevOps-Daily/soc2-evidence-collector, last 90 days: 15 evidence files, 35 API calls, 22.7 s\n  CC8.1  pass            Changes to the default branch go through a pull request\n         rule on main: pull_request, 1 approval(s) required\n  CC8.1  fail            Every merged change passed the required checks before the merge\n         required: test; 6 of 7 merged PRs passed every required check before the merge (#3 not finished)\n  CC8.1  fail            Every merged change was approved by someone other than its author\n         0 of 7 merged PRs had an independent approval of the merged commit\n  CC8.1  fail            Nothing reached the default branch without a pull request\n         commits not linked to a merged PR: 1 of 8; branch updates that were not PR merges: 1 (branch_creation)\n  CC7.1  pass            Dependency vulnerability alerts are on\n         Dependabot alerts on\n  CC7.1  pass            No critical or high alert is open past 30 days\n         8 open alerts, 0 critical or high open longer than 30 days\n  CC6.1  pass            Secret scanning and push protection are on\n         secret scanning enabled, push protection enabled\n  CC6.3  needs a person  Repository access follows least privilege\n         roles: {'admin': 4}, outside collaborators: 0; the list is evidence, the judgement is not\nevidence: evidence/The-DevOps-Daily__soc2-evidence-collector/20261019T131928Z"}
  ]
}
```

It found every gap we put in, and it exits non-zero, so it can gate a pipeline or a weekly job.

## What the failures mean

### The rule was on, and the evidence still failed

The first control passed: a pull request with one approval is required on main. The approval control under it failed for all seven merged pull requests. An admin bypass is not a bug in the ruleset. Many teams keep one for emergencies, and an auditor's sample may well include a change that used it. If your system description says all changes are approved by a second person and your evidence shows admin merges without approval, expect the auditor to report them as exceptions.

For a one-person or two-person team, the honest fix is not to pretend. Common approaches are a reviewer from outside the team for production repositories, or a documented control that someone reviews merged changes after the fact within a fixed time. Which of these your auditor accepts is a conversation to have before the review period starts, not after.

### Green now is not the same as tested before the merge

Here is the evidence file for pull request #3 as the collector saved it, without the author's login and with the indentation widened for reading:

```json
{
  "collected_at": "2026-10-19T13:19:28.577807+00:00",
  "source": "GitHub API, The-DevOps-Daily/soc2-evidence-collector",
  "data": {
    "pull": {
      "number": 3,
      "title": "Examples to scan, and the IaC scan script",
      "base": "main",
      "merged_at": "2026-10-19T12:50:03Z",
      "html_url": "https://github.com/The-DevOps-Daily/soc2-evidence-collector/pull/3"
    },
    "head_sha": "d4b17526cfcaf516833023b9ec402f45a70a10ec",
    "reviews": [],
    "check_runs": [
      {
        "name": "test",
        "app_id": 15368,
        "head_sha": "d4b17526cfcaf516833023b9ec402f45a70a10ec",
        "status": "completed",
        "conclusion": "success",
        "started_at": "2026-10-19T12:50:01Z",
        "completed_at": "2026-10-19T12:50:08Z"
      }
    ]
  }
}
```

The check started at 12:50:01. The pull request was merged at 12:50:03. The check succeeded at 12:50:08. Look at the pull request page today and you see a green check, which is what most screenshots record. The collector compares the timestamps, and so should anything you hand to an auditor.

It asks GitHub for every run of the check, not only the latest, and judges each required check by its last run that started before the merge: that run is the check's state at the merge. If it had not finished by then, the check did not gate the merge, even if an earlier run had passed. A re-run started after the merge does not count. Only `success` passes: GitHub lets a [skipped or neutral required check](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging) through, but a skipped check ran no tests. A required check stops a normal merge until it passes, so a merge before completion usually means someone used a bypass. It can also mean the required checks changed after the merge, because the collector compares with today's rules. Either way, it is an exception to explain.

### The commit with no pull request

The one commit without a pull request is the repository's first commit, pushed before the ruleset existed. The branch's activity log shows the same event from the other side: one update to main that was not a pull request merge, the creation of the branch. That is a normal, explainable exception, and the evidence lets you explain it with a date.

The two sources catch different things. The commit list only holds commits that are still on main, so a force push that rewrote history leaves nothing in it. The activity log records updates to the branch, including direct pushes and force pushes, so an admin pushing a hotfix straight to main shows up there even when the commit list looks clean. If the log does not reach back to the start of the window, the control reports `incomplete` instead of `pass`.

### The alerts that passed

Dependabot raised 8 open alerts for the two pinned packages: 2 critical, 1 high and 5 medium. The SLA control passed, correctly, because the alerts were less than an hour old. Our default SLA is 30 days for critical and high; use the number your own vulnerability policy states, since that is what the auditor will hold you to. If those alerts are still open, the same run in five weeks would fail.

This control reads the alerts that are open today. A critical alert that stayed open for two months last spring and was fixed in the summer does not appear in it. To cover a period, keep each run's folder, or extend the collector to fixed alerts and compare their `fixed_at` with `created_at`.

## Ten ways our first version could pass without evidence

Two reviews of the first version of the collector, one of the code and one of the post against the recorded output, found ten ways it could pass a control, or count something as evidence, when the data did not support it. For a tool whose output goes to an auditor, each one is a real defect: a control must never pass because data was missing.

| What went wrong | What the collector does now |
| --- | --- |
| An approval of an older commit counted | Only an approval whose `commit_id` is the merged head commit counts; the rest are reported as stale |
| A withdrawn approval counted | Only each reviewer's last decision before the merge counts, so a later change request or a dismissal replaces an approval |
| Any passing or skipped check counted as the required one | Each required check is matched by name, and by app when the rule names one, and only `success` passes |
| An earlier pass could hide a later failure, or a re-run still going at the merge | Each required check is judged by its last run that started before the merge, which must have succeeded before the merge |
| Unreadable alerts looked like zero alerts | A 403 or 404 makes the SLA control `incomplete`, with the HTTP status |
| Lists were cut off silently | A list cut at its limit makes its control `incomplete`, and an error on a later page stops the run |
| Any pull request link counted | The pull request must be merged into the default branch and be one of the merged pull requests evaluated |
| A force push left no trace | The branch's activity log is read alongside the commit list |
| The SLA was rounded down to whole days, and alerts without a severity were skipped | The age is compared as a time, and an unknown severity makes the control `incomplete` |
| Branch names went into URLs unencoded, and answers were not checked | Every value is encoded, and a pull request, activity entry or check run for another branch or commit makes its list `incomplete` |

The last one is easy to miss. Git allows `&` and `#` in branch names, so a default branch with a crafted name could change the query string, and the collector would judge GitHub's answer to a different question.

None of these changed a result for our demo repository: it has no approvals at all, a readable list of 8 alerts and eight commits. They would change results for a real repository, where a stale approval, a re-run check or a missing permission is common. Each fix has a test in the repository.

Running the collector also found one more problem: the Dependabot alerts API rejects page numbers (`Pagination using the page parameter is not supported`) and pages with cursors in the `Link` header instead. The collector now follows the `Link` header for every list.

## Evidence from Terraform

CC7.1's points of focus start with "Uses Defined Configuration Standards" and "Monitors Infrastructure and Software" for noncompliance with them. For infrastructure as code, a misconfiguration scan in CI is evidence of both: the rule set is your standard, and the scan result on each change is the monitoring.

The repository's `examples/terraform` holds a small AWS stack: a customer-data bucket with a KMS key, versioning and a public access block; an exports bucket added later without any of those; and a Postgres instance, encrypted and backed up, with a security group open to `0.0.0.0/0` on port 5432 and `publicly_accessible = true`. `scan-iac.sh` runs Trivy and keeps the report, a summary and a manifest:

```terminal
{
  "title": "scan-iac.sh",
  "steps": [
    {"cmd": "./scan-iac.sh examples/terraform", "output": "92 checks, 12 failed, 4.6 s\n  HIGH     AWS-0086  aws_s3_bucket.exports        S3 Access block should block public ACL\n  HIGH     AWS-0087  aws_s3_bucket.exports        S3 Access block should block public policy\n  HIGH     AWS-0091  aws_s3_bucket.exports        S3 Access Block should Ignore Public ACL\n  HIGH     AWS-0093  aws_s3_bucket.exports        S3 Access block should restrict public bucket to limit access\n  HIGH     AWS-0132  aws_s3_bucket.exports        S3 encryption should use Customer Managed Keys\n  HIGH     AWS-0180  aws_db_instance.app          RDS Publicly Accessible\n  MEDIUM   AWS-0090  aws_s3_bucket.exports        S3 Data should be versioned\n  MEDIUM   AWS-0176  aws_db_instance.app          RDS IAM Database Authentication Disabled\n  LOW      AWS-0089  aws_s3_bucket.customer_data  S3 Bucket Logging\n  LOW      AWS-0089  aws_s3_bucket.exports        S3 Bucket Logging\n  LOW      AWS-0094  aws_s3_bucket.exports        S3 buckets should each define an aws_s3_bucket_public_access_block\n  LOW      AWS-0133  aws_db_instance.app          Enable Performance Insights to detect potential problems\nevidence: evidence/iac/20261019T130914Z"}
  ]
}
```

The exports bucket and the public database were both caught. The open security group was not. Trivy's ingress rule AWS-0107, titled "Security groups should not allow unrestricted ingress to SSH or RDP from any IP address", passed: port 5432 is neither SSH nor RDP. The database was flagged only because `publicly_accessible` was also set. We removed that line, kept the security group and scanned again:

```terminal
{
  "title": "scan-iac.sh, without publicly_accessible",
  "steps": [
    {"cmd": "cp -r examples/terraform /tmp/sg-only && sed -i '/publicly_accessible/d' /tmp/sg-only/main.tf", "output": ""},
    {"cmd": "./scan-iac.sh /tmp/sg-only", "output": "92 checks, 11 failed, 4.2 s\n  HIGH     AWS-0086  aws_s3_bucket.exports        S3 Access block should block public ACL\n  HIGH     AWS-0087  aws_s3_bucket.exports        S3 Access block should block public policy\n  HIGH     AWS-0091  aws_s3_bucket.exports        S3 Access Block should Ignore Public ACL\n  HIGH     AWS-0093  aws_s3_bucket.exports        S3 Access block should restrict public bucket to limit access\n  HIGH     AWS-0132  aws_s3_bucket.exports        S3 encryption should use Customer Managed Keys\n  MEDIUM   AWS-0090  aws_s3_bucket.exports        S3 Data should be versioned\n  MEDIUM   AWS-0176  aws_db_instance.app          RDS IAM Database Authentication Disabled\n  LOW      AWS-0089  aws_s3_bucket.customer_data  S3 Bucket Logging\n  LOW      AWS-0089  aws_s3_bucket.exports        S3 Bucket Logging\n  LOW      AWS-0094  aws_s3_bucket.exports        S3 buckets should each define an aws_s3_bucket_public_access_block\n  LOW      AWS-0133  aws_db_instance.app          Enable Performance Insights to detect potential problems\nevidence: evidence/iac/20261019T130925Z"}
  ]
}
```

The only database findings left are IAM authentication and Performance Insights. Nothing points at a database port open to the world.

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
| CC3.2 | A documented risk assessment and its periodic review | A document and a dated review |
| CC9.2 | Vendor and subprocessor reviews | An assessment of each vendor's security, often based on the vendor's own SOC 2 report |
| CC7.4, CC7.5 | Incident response that works | A tabletop exercise or a real incident, with its write-up |
| A1.3 | Recovery tested (if Availability is in scope) | A restore test with its result |

Automation helps with all of these by collecting the inputs and reminding people, but the evidence is a person's decision. In our collector, CC6.3 deliberately ends at `needs a person`: it gives the reviewer the list, and the reviewer's sign-off is the evidence.

## Build it or buy it

The compliance automation platforms, such as Vanta, Drata, Secureframe, Sprinto and Thoropass, do the same thing at a much wider scale. They connect to source control, cloud accounts, identity providers and HR systems, map what they collect to controls, track the people-side tasks such as training and policy acknowledgments, and give the auditor a place to review the evidence. For a team going through its first audit, that coverage and the auditor relationships that come with it are the reason to pay for one.

What a small script like ours is good for is understanding what those tools check, and covering what is specific to you: a custom deployment pipeline, a check a platform does not have, or a control you want tested on every change. It can run alongside a platform as well as instead of one. Whichever you use, test it the way we tested ours: give it a repository with known problems and confirm it fails on each of them. A tool you have only seen report `pass` has not shown you that it can fail.

## Time

For one repository and 90 days, the collector made 35 API calls and wrote 15 evidence files in 23 seconds. By hand, the closest you get is a screenshot of the ruleset, one of each merged pull request with its checks and reviews, the Dependabot tab, the security settings and the collaborator list: eleven screenshots here. They still miss the branch's history and the links from each commit to its pull request, which the direct-push control reads, and the pull request page does not put the check's start and completion times next to the merge time. We did not time the manual version, so we will not give a number for it. The difference grows with the sample: an auditor sampling 25 changes across 10 repositories is 25 pull request pages by hand, and one run per repository for the script.

## Summary

- Collect evidence of what happened, not only of what is configured. Our ruleset passed while three change-management controls failed under it.
- Compare timestamps. A check that is green today may have finished after the merge.
- Make evidence scripts fail closed: stale or withdrawn approvals, the wrong check run, unreadable data, wrong links and truncated lists must never pass.
- Treat a configuration scan as one rule set, not as proof of safety, and add rules for what it misses. Ours passed a database port open to the internet.
- Leave the judgement to people, and make their sign-off the evidence. A script can gather the access list; it cannot decide who should be on it.
- Agree with your auditor on how exceptions, such as admin bypasses, are handled before the review period starts.

The collector, the Terraform example and the tests are in [The-DevOps-Daily/soc2-evidence-collector](https://github.com/The-DevOps-Daily/soc2-evidence-collector). Point it at a repository you own and see which controls fail.
