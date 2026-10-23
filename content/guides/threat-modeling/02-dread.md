---
title: 'DREAD Risk Scoring and What to Use Instead'
description: 'How DREAD scores threats (sum or average), why Microsoft stopped using it, and what teams use now: likelihood x impact, CVSS 4.0 and a bug bar.'
order: 2
---

**TLDR**: DREAD rates a threat on five factors, **D**amage, **R**eproducibility, **E**xploitability, **A**ffected users and **D**iscoverability, each from 1 to 10. The original method adds the five numbers and divides by 5; the sum ranks threats in the same order as the average. Microsoft, where DREAD came from, moved away from it because different people gave the same threat very different scores. Learn it if your course or team uses it, but for real prioritization most teams now use likelihood times impact with a written reason, a bug bar, and CVSS 4.0 for confirmed vulnerabilities.

After [Part 1](/guides/threat-modeling/01-stride) you have fifteen threats for the ticket shop and limited time. The third question of threat modeling, **what are we going to do about it?**, starts with an order: which threats do you fix before launch, which next month, and which do you accept? This part shows DREAD on six of those threats, its known problems, and the alternatives, with a real calculation for each.

## Prerequisites

- The threat register from [Part 1](/guides/threat-modeling/01-stride#h2-the-threat-register). The examples use threats S1, S3, T1, R1, I1 and D1.
- Python 3 if you want to run the scoring script and the CVSS calculator.

## The Five DREAD Factors

DREAD came out of Microsoft's security pushes in the early 2000s and was documented by Michael Howard and David LeBlanc in _Writing Secure Code_. Each factor answers one question:

| Factor              | Question                                | 1 to 3                                         | 4 to 6                            | 7 to 10                                   |
| ------------------- | --------------------------------------- | ---------------------------------------------- | --------------------------------- | ----------------------------------------- |
| **D**amage          | How bad is it if the attack works?      | Minor inconvenience, non-sensitive data        | Some users or some sensitive data | Full compromise, money, data of all users |
| **R**eproducibility | Does the attack work every time?        | Rare timing, special conditions                | Works under common conditions     | Works every time                          |
| **E**xploitability  | How much skill and effort does it take? | Custom exploit, deep knowledge, insider access | Scripting skills or an account    | A browser or a public tool                |
| **A**ffected users  | How many users are hit?                 | One user or a small group                      | A large group or one role         | All users, partners or downstream systems |
| **D**iscoverability | How easy is it to find?                 | Needs source code or insider knowledge         | Found by testing or a scanner     | Obvious, public or already discussed      |

The ranges are anchors, not rules. Write your own examples for each band before you score, using threats from your own system, or two people will mean different things by a 6.

## How to Calculate a DREAD Score

The method in _Writing Secure Code_ is: rate each factor from 1 to 10, **add them up and divide by 5**. The result is a score from 1 to 10.

Summing without dividing (a total from 5 to 50) gives exactly the same ranking, because every total is divided by the same number. Choose one and use it everywhere so that scores stay comparable. Some teams use a 1 to 3 scale per factor (totals from 5 to 15) to avoid arguing about 6 versus 7. The bands that turn a score into a priority, for example 1 to 3 low, 4 to 6 medium and 7 to 10 high, are a team decision; DREAD does not define them.

This script, saved as `dread.py`, scores six threats from the ticket shop's register. The numbers are the team's judgment from the threat modeling session, not measurements:

```python
# DREAD: rate each factor 1-10, add them up, divide by 5.
#                                  D   R   E   A   D
THREATS = {
    "S1 forged payment webhook": (8, 10, 7, 6, 6),
    "T1 price tampering": (6, 10, 9, 5, 8),
    "I1 any user reads any order": (7, 10, 8, 9, 7),
    "D1 bots hold every seat": (7, 8, 5, 9, 9),
    "S3 phished staff admin": (9, 4, 5, 10, 5),
    "R1 unrecorded admin actions": (4, 10, 3, 3, 2),
}

print(f"{'threat':<30}  D  R  E  A  D  sum  avg")
for name, scores in sorted(THREATS.items(), key=lambda t: sum(t[1]), reverse=True):
    total = sum(scores)
    print(f"{name:<30} " + " ".join(f"{s:>2}" for s in scores) + f" {total:>4} {total / 5:>4.1f}")
```

```terminal
{
  "title": "DREAD scores",
  "prompt": "$",
  "steps": [
    {
      "cmd": "python3 dread.py",
      "output": "threat                          D  R  E  A  D  sum  avg\nI1 any user reads any order     7 10  8  9  7   41  8.2\nT1 price tampering              6 10  9  5  8   38  7.6\nD1 bots hold every seat         7  8  5  9  9   38  7.6\nS1 forged payment webhook       8 10  7  6  6   37  7.4\nS3 phished staff admin          9  4  5 10  5   33  6.6\nR1 unrecorded admin actions     4 10  3  3  2   22  4.4"
    }
  ]
}
```

The reasons behind the numbers matter more than the numbers, so record them:

| Threat | Damage                                    | Reproducibility             | Exploitability                             | Affected users             | Discoverability                        |
| ------ | ----------------------------------------- | --------------------------- | ------------------------------------------ | -------------------------- | -------------------------------------- |
| I1     | 7: personal data and valid tickets        | 10: every time              | 8: change a number in the URL              | 9: every customer          | 7: visible in your own order URL       |
| T1     | 6: lost revenue per order                 | 10: every time              | 9: browser developer tools                 | 5: the shop and organizers | 8: the price is in the request         |
| D1     | 7: fans cannot buy, organizers lose trust | 8: needs many accounts      | 5: a bot setup                             | 9: everyone trying to buy  | 9: a known pattern in ticketing        |
| S1     | 8: unlimited free tickets                 | 10: every time              | 7: craft an event in the documented format | 6: the shop and organizers | 6: guessable path, public event format |
| S3     | 9: refunds and comp tickets at scale      | 4: phishing works sometimes | 5: a convincing campaign                   | 10: all orders and events  | 5: staff names are public              |
| R1     | 4: fraud cannot be traced                 | 10: always missing          | 3: needs a staff account                   | 3: the shop                | 2: invisible from outside              |

Look at S1. It allows unlimited free tickets for every event, the worst outcome in the register, and it ranks fourth. Its Affected users score is low because no customer is directly harmed, and the five factors are weighted equally, so damage counts no more than discoverability. That is the first sign of DREAD's main weakness.

## Why Microsoft Stopped Using DREAD

DREAD's own authors pointed out the problems. In 2007 David LeBlanc [wrote](https://learn.microsoft.com/en-us/archive/blogs/david_leblanc/dreadful) that the model's factors were reasonable but the averaging was not: a threat with Damage 1 and every other factor 10 (a well-known nuisance) scores the same as one with Discoverability 1 and everything else 10 (hard to find, but catastrophic).

```terminal
{
  "title": "LeBlanc's counterexample",
  "prompt": "$",
  "steps": [
    {
      "comment": "Damage 1, everything else 10; then Discoverability 1, everything else 10",
      "cmd": "python3 -c 'print(sum([1, 10, 10, 10, 10]) / 5, sum([10, 10, 10, 10, 1]) / 5)'",
      "output": "8.2 8.2"
    }
  ]
}
```

The other problems, collected by Adam Shostack in [a 2018 review](https://shostack.org/blog/tmt-the-dread-pirates/):

- **Scores are inconsistent.** Without calibration, different people give the same threat different numbers, especially in the middle of the scale. Nobody can say what separates a 6 from a 7.
- **Discoverability changes overnight.** A bug rated 2 becomes a 10 the day someone publishes it, and teams tend to underrate how easy their own bugs are to find. Most teams now assume an attacker will find it.
- **It measures severity, not effort.** A threat that takes one line to fix and one that takes a quarter of work get the same score.
- **Averaging ordinal ratings gives false precision.** A 7.4 and a 7.6 look different; with error bars this wide, they are not.

Shostack writes that these disagreements happened at Microsoft repeatedly and "led to the switch to a bug bar approach". The Microsoft Security Response Center rates reported vulnerabilities against a bug bar with severity classes such as Critical, Important, Moderate and Low.

If you must use DREAD, for a course or because your organization requires it, make it less noisy: write anchor examples for every band, have two people score independently and discuss the differences, drop Discoverability or set it to the maximum, and record a reason for every number.

## What Teams Use Instead

### Likelihood times impact

The most common replacement is a risk matrix. Rate **likelihood** (how probable is it that someone tries and succeeds?) and **impact** (how bad is it for the business and the users?) as Low, Medium or High, each with a sentence of reasoning, and read the risk from the matrix used by the [OWASP Risk Rating Methodology](https://community.owasp.org/OWASP_Risk_Rating_Methodology):

| Impact \ Likelihood | Low    | Medium | High     |
| ------------------- | ------ | ------ | -------- |
| **High**            | Medium | High   | Critical |
| **Medium**          | Low    | Medium | High     |
| **Low**             | Note   | Low    | Medium   |

The same six threats:

| Threat | Likelihood | Why                                                        | Impact | Why                                               | Risk     |
| ------ | ---------- | ---------------------------------------------------------- | ------ | ------------------------------------------------- | -------- |
| S1     | High       | Public endpoint, documented event format, common bug       | High   | Unlimited free tickets for every event            | Critical |
| I1     | High       | Sequential IDs, any account can try                        | High   | Personal data and usable tickets of all customers | Critical |
| T1     | High       | Needs only browser developer tools                         | Medium | Loss per order, caught at daily reconciliation    | High     |
| D1     | Medium     | Only popular on-sales, needs a bot setup                   | High   | Fans cannot buy, organizers lose trust            | High     |
| S3     | Medium     | Staff get phished, but there are few of them and SSO helps | High   | Refunds and comp tickets at scale                 | High     |
| R1     | Low        | Needs a dishonest staff member                             | Medium | Fraud cannot be traced, disputes with organizers  | Low      |

S1 now shares the top rating with I1, because impact is judged directly instead of being averaged with discoverability. The full OWASP method scores 16 factors from 0 to 9 and maps the averages to Low, Medium and High; for a design review, the three-level version with written reasons is usually enough.

### High, Medium, Low with a reason

Even simpler: give each threat High, Medium or Low priority and one sentence of reasoning, agreed in the session. The sentence is the valuable part: "High: any customer can read every order, and the IDs are sequential" survives a review; "DREAD 8.2" does not explain itself. This is a good default for small teams.

### A bug bar

A **bug bar** decides severity by rules agreed in advance, the way Microsoft's SDL does, so nobody has to score at all. A bug bar for the ticket shop might say:

- **Critical, fix before release:** anyone can get tickets or money without paying the full price or without authorization (S1, T1, E1), or can read other customers' data (I1).
- **High, fix within 7 days:** attacks that need a phished staff account or a bot farm (S3, D1), or that leak secrets (I2).
- **Medium, fix this quarter:** gaps in evidence or monitoring (R1, R2).
- **Low, backlog:** hardening with no known attack path.

A bug bar is consistent by design, and it also tells you when a threat found later, by a scanner or a bug bounty report, must block a release.

### CVSS 4.0 for confirmed vulnerabilities

Threat modeling happens at design time, before there is a bug to measure. Once a threat turns into a real vulnerability, for example a penetration test confirms that the order API has I1, you can score it with the **Common Vulnerability Scoring System**. [CVSS v4.0](https://www.first.org/cvss/v4.0/specification-document) was published by FIRST on 1 November 2023, and CVE records and scanners increasingly carry 4.0 scores next to 3.1.

A CVSS 4.0 vector lists the base metrics: attack vector (`AV`), attack complexity (`AC`), attack requirements (`AT`, new in 4.0), privileges required (`PR`), user interaction (`UI`), and the impact on the confidentiality, integrity and availability of the vulnerable system (`VC`, `VI`, `VA`) and of subsequent systems (`SC`, `SI`, `SA`). Red Hat's `cvss` Python package computes the score:

```bash
python3 -m venv ~/.venvs/cvss
. ~/.venvs/cvss/bin/activate
pip install cvss==3.6
```

```terminal
{
  "title": "CVSS 4.0 scores",
  "prompt": "$",
  "steps": [
    {
      "comment": "I1: network, low complexity, needs a customer account, reads other customers' data",
      "cmd": "cvss_calculator -4 -n -v 'CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N'",
      "output": "CVSS4\nBase Score:            7.1 (High)\nCleaned vector:        CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N\nRed Hat vector:        7.1/CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N"
    },
    {
      "comment": "S1: no account needed, integrity of orders is lost",
      "cmd": "cvss_calculator -4 -n -v 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:H/VA:N/SC:N/SI:N/SA:N'",
      "output": "CVSS4\nBase Score:            8.7 (High)\nCleaned vector:        CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:H/VA:N/SC:N/SI:N/SA:N\nRed Hat vector:        8.7/CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:H/VA:N/SC:N/SI:N/SA:N"
    },
    {
      "comment": "I1 again with a threat metric: no reported attacks, no public proof of concept (E:U)",
      "cmd": "cvss_calculator -4 -n -v 'CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N/E:U'",
      "output": "CVSS4\nBase Score:            4.9 (Medium)\nCleaned vector:        CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N/E:U\nRed Hat vector:        4.9/CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N/E:U"
    }
  ]
}
```

CVSS 4.0 names the score by the metric groups used: **CVSS-B** for base metrics only, **CVSS-BT** with threat metrics (the third run), **CVSS-BE** with environmental metrics and **CVSS-BTE** with all three. Without threat metrics, CVSS assumes the worst case: that the vulnerability is being attacked. `E:U` (Unreported) means there are no reports of attacks and no public proof-of-concept code or exploit tooling, and with it the score drops from 7.1 to 4.9. Use `E:P` when a proof of concept is public but no attacks or ready-made exploit tools are reported, and `E:A` when they are.

CVSS measures the **severity** of a vulnerability, not the risk to your business. The base score does not know that I1 exposes usable tickets or that S1 costs real money. Use it to compare vulnerabilities and to set fix deadlines, and use your own impact reasoning to decide what matters most.

## From Priority to Action

A priority is only useful if it leads to a decision. For each threat, pick one of four responses and record it in the register with an owner and a date:

- **Mitigate**: add a control that reduces likelihood or impact. Most threats end here: S1 gets signature checks, I1 gets ownership checks, D1 gets hold limits.
- **Eliminate**: remove the feature or the data. If single-use discount codes cause T3 and nobody uses them, drop them. Not storing date of birth removes a privacy threat completely.
- **Transfer**: move the risk to someone better placed to carry it. Hosted checkout transfers card handling to the payment provider, which shrinks the shop's PCI DSS scope; insurance transfers part of the financial impact.
- **Accept**: decide, with a named owner and a review date, to live with it. For example, the team might accept part of D2 for small events and revisit it before the first stadium on-sale.

Cost to fix belongs in the decision as well. R1 is low risk, but an audit event in each admin handler is an afternoon of work, so the team does it now. A high-risk threat whose fix takes a quarter needs a short-term mitigation and a plan.

## Common Mistakes

- **Treating the score as the result.** The output of prioritization is a decision per threat (mitigate, eliminate, transfer or accept), an owner and a date.
- **Scoring alone.** One person's numbers carry one person's blind spots. Score together, or at least review the scores together.
- **Comparing scores across teams.** A 7 in one team's DREAD sheet and a 7 in another's are not the same thing. Bug bars and CVSS are better for comparisons.
- **Using CVSS for design threats.** CVSS needs a concrete vulnerability with known preconditions. At design time, use likelihood and impact.
- **Ignoring threats rated Low forever.** Review accepted risks when the design changes or the review date passes.

## Summary

- DREAD rates Damage, Reproducibility, Exploitability, Affected users and Discoverability from 1 to 10; add the five and divide by 5. The sum gives the same ranking.
- Equal weights, inconsistent raters and a Discoverability factor that changes overnight led Microsoft to switch to a bug bar.
- Likelihood times impact with written reasons, a simple High, Medium and Low, or a bug bar are better tools for prioritizing design threats.
- CVSS 4.0 scores the severity of confirmed vulnerabilities; it is not a business risk score.
- Every threat ends with a decision: mitigate, eliminate, transfer or accept, with an owner and a date.

In [Part 3](/guides/threat-modeling/03-attack-trees), you combine the threats into attack trees to see how an attacker would chain them to reach a goal, and which fix raises the attacker's cost the most.

## Keep Learning

- [Security gates guide](/guides/security-gates), to turn severity decisions into CI/CD policies
- [Vulnerability gates](/guides/security-gates/02-vulnerability-gates), which decide when a CVE blocks a build
- [Dependency Scanning: Finding Vulnerabilities Before Attackers Do](/posts/dependency-scanning-guide)
- [Security Incident Response quiz](/quizzes/security-incident-response-quiz)
