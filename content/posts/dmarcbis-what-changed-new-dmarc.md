---
title: 'DMARCbis Is Here: What Changed in the New DMARC and What to Do to Your Records'
seoTitle: 'DMARCbis Is Here: What Changed and What to Do to Your Records'
excerpt: 'DMARC finally became a real internet standard in 2026. The pct tag is gone, there are two new tags, and the Public Suffix List is out. Here is what actually changed and the exact edits to make to your DNS.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-07-25'
publishedAt: '2026-07-25T09:00:00Z'
updatedAt: '2026-07-25T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - DMARC
  - Email
  - DNS
  - Security
  - Deliverability
---

For eleven years, every DMARC record you ever wrote was based on an *informational* document. RFC 7489, published in 2015, was not a standard. It was a description of something the big mailbox providers had already agreed to do, written up and submitted independently, and the entire email authentication world ran on it anyway.

That changed in 2026. DMARC is now a proper IETF Standards Track protocol, published as three RFCs that together replace RFC 7489. The update is known as **DMARCbis**, and while your existing records keep working, a few things you have been copy-pasting into DNS for years are now deprecated. One tag is gone entirely. Two new ones are worth adding today.

This post covers what actually changed, why each change happened, and the specific edits to make to your DMARC records. No history lesson beyond the paragraph above, and every claim maps to a record you can verify with `dig`.

## TL;DR

- DMARC is now a real standard: **RFC 9989** (the core protocol), **RFC 9990** (aggregate reporting), and **RFC 9991** (failure reporting), replacing the informational RFC 7489.
- The **`pct` tag is removed.** It was honored inconsistently and rarely did what operators expected. A new binary **`t` (testing) tag** replaces it: `t=y` for monitoring, `t=n` for enforcement.
- New **`np` tag** sets a policy for *non-existent* subdomains, which is the cheapest fix for a whole class of spoofing.
- The **Public Suffix List is gone.** Receivers now find your organizational domain with a **DNS Tree Walk** instead.
- The `rf` and `ri` tags are also removed; reports are XML and receivers control the schedule.
- **You do not have to change anything today.** Existing records still validate. But you should drop `pct`, add `np`, and keep progressing toward enforcement.

## Prerequisites

- A domain you send mail from, with an existing DMARC record (or the intent to add one).
- Access to that domain's DNS to add or edit TXT records.
- `dig` (or `nslookup`) for verification. Examples below use `dig`.
- A basic grasp of SPF and DKIM. DMARC sits on top of both; if either is shaky, start there first.

## Why "it became a standard" is more than a footnote

The practical reason this matters: an informational document has no formal authority over how receivers behave. Gmail, Yahoo, and Microsoft implemented RFC 7489 the way they each read it, and the gaps between those readings are exactly where DMARC surprised people. The clearest example is the `pct` tag, which we will get to, where three major receivers did three different things.

Standards Track changes the contract. The behavior is now specified, the ambiguous corners have been nailed down, and future receivers have one document to conform to instead of a decade of folklore. That is the whole point of DMARCbis: same protocol, sharper edges filed down.

## The tag changes at a glance

Here is the before and after. If you only read one section, read this one.

| Tag | RFC 7489 (old) | DMARCbis (new) | What to do |
|---|---|---|---|
| `p` | Policy: `none`/`quarantine`/`reject` | Unchanged | Keep |
| `rua` | Aggregate report address | Unchanged | Keep |
| `ruf` | Failure report address | Unchanged | Keep (rarely honored) |
| `pct` | Apply policy to N% of mail | **Removed** | Delete it |
| `t` | did not exist | **New:** testing flag (`y`/`n`) | Use instead of `pct` |
| `np` | did not exist | **New:** policy for non-existent subdomains | Add `np=reject` |
| `psd` | did not exist | **New:** declares a public suffix domain | Registry operators only |
| `rf` | Report format | **Removed** | Delete it |
| `ri` | Report interval | **Removed** | Delete it |
| `sp` | Subdomain policy | Unchanged | Keep if you use it |
| `adkim`/`aspf` | Alignment mode | Unchanged | Keep |

A record that was perfectly valid yesterday, such as `v=DMARC1; p=quarantine; pct=50; rua=mailto:dmarc@example.com`, is not *broken* under DMARCbis. Receivers will parse it, ignore the retired `pct`, and apply your policy in full. But "ignore `pct` and apply the full policy" might be the opposite of what `pct=50` was doing for you yesterday. That is the one change that can bite silently, so it gets its own section.

## The `pct` tag is gone, and why that is a relief

The `pct` tag was meant to let you roll out enforcement gradually. `pct=10` told receivers "apply my `quarantine`/`reject` policy to 10% of failing mail, and treat the other 90% as `p=none`." The idea was a dial you could turn from 0 to 100 as confidence grew.

In practice it was a mess. Receivers implemented the sampling differently, some rounded aggressively, some ignored it, and the population being sampled was never clearly defined. Worst of all, the failure mode was invisible: you would set `pct=10` expecting a gentle rollout and have no reliable way to know what any given receiver actually did with it.

DMARCbis replaces the dial with a switch. The new `t` tag is binary:

```text
t=y   ->  testing mode. Report as normal, but do not enforce.
          Equivalent to the old pct=0.
t=n   ->  enforce the policy in p. This is the default.
          Equivalent to the old pct=100.
```

So the migration is mechanical:

- `pct=0` becomes `t=y`
- `pct=100` (or no `pct`) becomes the default, `t=n`, so just delete the tag
- **Any fractional `pct` (like `pct=50`) has no direct equivalent.** There is no half-enforcement anymore. You pick monitoring or enforcement.

That last point is the one to think about. If you were parked at `pct=50` as a permanent state, DMARCbis is telling you to make a decision. The correct rollout was never "sit at 50% forever" anyway; it was "watch reports at `p=none`, then commit to `quarantine`, then `reject`." The `t` flag makes that the only shape available, which is a good thing.

:::warning
If you currently have a fractional `pct` (anything other than 0 or 100) combined with `p=quarantine` or `p=reject`, a DMARCbis-conformant receiver will apply your **full** policy, not the sampled fraction. Review those records before receivers do it for you. Move the domain to `t=y` if you are not ready to enforce, or commit to enforcement and drop `pct`.
:::

## The `np` tag: the cheapest anti-spoofing win

This is the new tag worth adding today. `np` sets the policy for **non-existent subdomains**, meaning subdomains that have no A, AAAA, or MX records at all.

Attackers love non-existent subdomains. `p=none` on your root plus no protection on `random-invoice.example.com` means someone can spoof a subdomain you never created and never will. `sp` (subdomain policy) covers subdomains generally, but `np` lets you be stricter about the ones that provably do not exist without touching real subdomains that do.

The pattern that gives you the most protection for the least risk:

```text
v=DMARC1; p=none; np=reject; rua=mailto:dmarc@example.com
```

Read that as: "I am still only monitoring my main domain (`p=none`), but any mail claiming to come from a subdomain that does not exist should be rejected outright (`np=reject`)." You get hard protection on the spoofing surface you are certain about, with zero risk to legitimate mail, because by definition nothing legitimate sends from a subdomain that has no DNS records.

The resolution order receivers use is: `np` for non-existent subdomains, then `sp` for existing subdomains, then `p` as the fallback. If you do not set `np`, it inherits from `sp`, and if that is unset, from `p`.

## The Public Suffix List is out, replaced by a DNS Tree Walk

This one is mostly invisible to you as a sender, but it explains a class of past weirdness, so it is worth understanding.

DMARC has to figure out your **organizational domain**, the registered domain that owns a given subdomain, so it can find the right policy and check alignment. For `mail.marketing.example.co.uk`, the organizational domain is `example.co.uk`, and knowing that requires knowing that `.co.uk` is a public suffix and `.uk` alone is not where registration happens.

RFC 7489 solved this with the **Public Suffix List (PSL)**, a big crowd-maintained file of every known suffix (`.com`, `.co.uk`, `.github.io`, and thousands more). It worked, but it was an external dependency baked into email authentication: a file that could be stale, that receivers cached differently, and that no DNS operator controlled.

DMARCbis replaces it with a **DNS Tree Walk**. Instead of consulting a static list, the receiver walks up the DNS tree from the sending domain, querying for DMARC records at each ancestor, and uses what it finds to determine the boundary. Registry and registrar operators can plant a `psd=y` record to explicitly declare "I am a public suffix, do not walk past me."

For a normal sender, the takeaway is simple: **your DMARC record now does more work in determining the boundary**, and the answer comes from DNS you control rather than a list you do not. Publishing DMARC at your organizational domain matters more than before.

## Reports: XML only, and the receiver sets the schedule

Two smaller removals. The `rf` (report format) and `ri` (report interval) tags are gone.

- **`rf` is gone** because aggregate reports are XML. That was already true in practice; the tag pretended there were alternatives.
- **`ri` is gone** because receivers were always going to send reports on their own schedule (typically daily) regardless of what you requested. The tag implied a control you never really had.

Nothing to do here except delete these tags if you have them. Your `rua` address keeps receiving the same daily XML aggregate reports it always did. RFC 9990 is the document that now specifies that reporting format, and RFC 9991 covers the (rarely used) failure reports.

## What to actually do to your records

Here is the concrete checklist. Start by looking at what you have:

```terminal
{
  "title": "audit your current DMARC record",
  "prompt": "$",
  "steps": [
    { "comment": "read the root domain policy" },
    { "cmd": "dig +short TXT _dmarc.example.com", "output": "\"v=DMARC1; p=quarantine; pct=50; rua=mailto:dmarc@example.com; rf=afrf; ri=86400\"" },
    { "comment": "that record has three retired tags: pct, rf, ri" },
    { "comment": "and no np protection on non-existent subdomains" }
  ]
}
```

Then apply these edits:

1. **Remove `pct`.** If it was `pct=100` or absent, just delete it. If it was `0`, replace with `t=y`. If it was fractional, decide: enforce (delete it) or monitor (`t=y`).
2. **Remove `rf` and `ri`.** They do nothing now.
3. **Add `np=reject`.** This is the highest-value single edit for most domains. It costs nothing in deliverability and closes the non-existent-subdomain spoofing hole.
4. **Confirm you have a `rua` address** you actually read. DMARC without report monitoring is a smoke detector with the battery out.
5. **Keep progressing `p`.** The retirement of `pct` does not change the fundamental rollout: `none` to watch, `quarantine` to soft-enforce, `reject` to stop spoofing.

A clean, modern record for a domain still in the monitoring phase looks like this:

```text
v=DMARC1; p=none; np=reject; rua=mailto:dmarc@example.com
```

And once you have read a few weeks of reports and confirmed every legitimate sender is aligned, the enforced version:

```text
v=DMARC1; p=reject; np=reject; rua=mailto:dmarc@example.com
```

Verify the change took effect the same way you audited it:

```terminal
{
  "title": "verify the updated record",
  "prompt": "$",
  "steps": [
    { "cmd": "dig +short TXT _dmarc.example.com", "output": "\"v=DMARC1; p=reject; np=reject; rua=mailto:dmarc@example.com\"" },
    { "comment": "no pct, no rf, no ri, and np closes the subdomain hole" }
  ]
}
```

If you would rather see the record parsed into plain English, with each tag explained and the policy spelled out, a free browser tool like [SMTPfast's DMARC checker](https://smtpfa.st/tools/dmarc-checker) reads the record and tells you what a receiver will actually do with it, which is handy when you are staring at a string of tags and want a second opinion.

:::tip
Do not jump a production domain straight to `p=reject`. If any legitimate system sends mail on your behalf without proper SPF or DKIM alignment (a CRM, a billing tool, an old cron job), `p=reject` silently kills those messages. Sit at `p=none` long enough to read the aggregate reports, fix every unaligned sender, then move to `quarantine`, then `reject`. `np=reject` is the exception: it is safe to add immediately because it only affects subdomains that do not exist.
:::

## The one-line migration summary

If you take nothing else from this:

```text
delete   pct   ->  use t=y for testing, otherwise no tag
delete   rf    ->  reports are XML, always were
delete   ri    ->  receivers set the schedule, always did
add      np=reject   ->  free protection on non-existent subdomains
keep progressing p:  none -> quarantine -> reject
```

DMARCbis is not a rewrite. It is a decade of hard-won operational knowledge finally written into the spec, with the confusing parts removed. The `pct` dial that nobody implemented the same way is gone, the guessing about organizational domains is now a DNS query you control, and there is a new tag that hands you real spoofing protection for the cost of four characters in a TXT record.

Your old records still work. But now is a good time to open your DNS, delete three retired tags, and add one new one.
