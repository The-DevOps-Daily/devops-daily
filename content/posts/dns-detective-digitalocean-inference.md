---
title: 'DNS Detective: an Agent That Diagnoses Your Domain by Actually Probing It'
excerpt: 'We built an agent on DigitalOcean''s Serverless Inference that debugs DNS, TLS and email problems the way an engineer does: form a hypothesis, run a real lookup, follow the evidence. It solved a null-MX mystery, an expired certificate, and a broken DNSSEC chain on camera, and one model we tried got disqualified for inventing probe results.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-01'
publishedAt: '2026-09-01T14:00:00Z'
updatedAt: '2026-09-01T14:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - AI
  - DNS
  - DigitalOcean
  - Agents
  - Networking
---

Ask an LLM "why does mail to my domain bounce?" and you get a plausible list of everything that has ever caused a bounce. Ask an engineer, and they do something different: they run `dig`, look at the answer, and let the evidence pick the next question. The difference is not knowledge; it is that the engineer is allowed to touch the network.

So we gave the model the network. **DNS Detective** is a small agent, running on [DigitalOcean Serverless Inference](https://www.digitalocean.com/products/gradient), that diagnoses DNS, TLS and email-record problems by calling real probe tools in a loop: resolve records, shake hands with TLS endpoints, pull registration data, fetch URLs. It probes, reads, probes again, and delivers a diagnosis where every claim cites a lookup it actually ran. The whole thing is about 300 lines of Python, and this post walks the build plus three real diagnoses recorded as they happened.

```github
The-DevOps-Daily/dns-detective
```

## TLDR

- One tool-calling loop plus four probes (`dns_lookup`, `tls_check`, `rdap_lookup`, `http_check`) turns a chat model into a diagnostician that follows evidence instead of listing possibilities.
- On camera it solved three real mysteries: example.com's bouncing mail (a **null MX**, `0 .`), a monitoring alert on expired.badssl.com (**certificate expired 2015**, read from the offered cert after verification failed), and dnssec-failed.org's split behavior (**bogus DS record**, and the model noticed the DS digest is literally the ASCII for "broken chain of trust send help!").
- The system prompt's one law: never state a record you did not probe. One model we tried broke that law by roleplaying fake probe results and was disqualified; the section below shows why that test matters more than benchmarks.
- DigitalOcean's inference platform made the plumbing boring in the good way: OpenAI-compatible API, function calling, a model menu you switch with one env var.

## Prerequisites

- Python 3.10+, `pip install dnspython`
- A [DigitalOcean Serverless Inference](https://www.digitalocean.com/products/gradient) API key
- No infrastructure: the agent is one file, the probes run from wherever you run it

## The architecture is one loop

There is no framework here. The agent is the classic function-calling loop: send the conversation plus tool definitions, and if the model responds with tool calls, run them, append the results, repeat; when it responds with text, that is the diagnosis.

```diagram
{
  "type": "loop",
  "nodes": [
    { "label": "Symptom", "variant": "soft" },
    { "label": "Model picks a probe", "variant": "accent" },
    { "label": "Probe runs for real", "variant": "solid" },
    { "label": "Evidence appended", "variant": "soft" }
  ],
  "loopBack": "follow the evidence",
  "goal": "DIAGNOSIS + EVIDENCE + FIX, every claim citing a probe"
}
```

The four probes are deliberately small and deliberately honest about failure modes, because the failure modes are the diagnosis:

- **`dns_lookup`** distinguishes NXDOMAIN (domain missing) from NoAnswer (domain exists, record type missing) from NoNameservers (all servers refused, the classic DNSSEC tell) from a timeout. Collapsing those into "lookup failed" would lobotomize the detective.
- **`tls_check`** does a verifying handshake, and on failure does the thing a human would: re-reads the offered certificate without verification (read-only, `openssl s_client` style) so it can report *what the server actually presented* and why it was rejected.
- **`rdap_lookup`** pulls registration data (registrar, expiry, status) over RDAP, the WHOIS successor, no API key needed.
- **`http_check`** fetches without following redirects, because the redirect itself is often the clue.

And one paragraph of system prompt does the character work: form a hypothesis, run the cheapest decisive probe next, and **never state a record you did not probe**.

## Three mysteries, on camera

Everything below is real recorded output, straight from the agent's own trail (it prints each probe as it runs, so the diagnosis is auditable).

**Case 1: "mail to example.com bounces immediately."**

```terminal
{
  "title": "dns-detective",
  "prompt": "$",
  "steps": [
    { "cmd": "python3 detective.py \"Customers say they cannot email us at example.com. Mail bounces immediately. Why?\"" },
    { "output": "  → dns_lookup(example.com, MX)\n    {\"status\": \"ok\", \"records\": [\"0 .\"], \"ttl\": 100}\n  → dns_lookup(example.com, A)\n    {\"status\": \"ok\", \"records\": [\"104.20.23.154\", \"172.66.147.243\"], \"ttl\": 265}" },
    { "output": "DIAGNOSIS: example.com is configured with a null MX record (0 .), which explicitly tells the internet that it does not accept email, so all inbound mail is rejected immediately." }
  ]
}
```

Two probes, done. The subtle part: a human junior often misreads `0 .` as "some weird MX". The agent correctly identified a **null MX** (RFC 7505), the record whose entire meaning is "this domain refuses mail on purpose", and did not go on a goose chase through SPF and server logs.

**Case 2: "monitoring says the site is down, the server looks up."**

```terminal
{
  "title": "dns-detective",
  "prompt": "$",
  "steps": [
    { "cmd": "python3 detective.py \"Monitoring says https://expired.badssl.com is down for users but the server itself seems up.\"" },
    { "output": "  → tls_check(expired.badssl.com, 443)\n    {\"handshake\": \"certificate_verification_failed\", \"verify_error\": \"certificate has expired\", \"offered_certificate\": \"...notAfter=Apr 12 23:59:59 2015 GMT...\"}" },
    { "output": "DIAGNOSIS: The HTTPS service is reachable, but the TLS certificate expired on 12 April 2015, causing browsers and monitoring to reject the connection." }
  ]
}
```

Note what the probe design bought here: verification failed, so the tool re-read the certificate unverified and handed the model the actual `notAfter` date. "Down" became "up, but presenting a certificate that died in 2015", which is a different incident with a different fix.

**Case 3: "site loads on one old server, nowhere else."** The split-behavior mystery, and the agent's best moment:

```terminal
{
  "title": "dns-detective",
  "prompt": "$",
  "steps": [
    { "cmd": "python3 detective.py \"dnssec-failed.org will not load for anyone on our office network, but a curl from one old server fetches it fine.\"" },
    { "output": "  → dns_lookup(dnssec-failed.org, A)      {\"status\": \"ok\", \"records\": [\"96.99.227.255\"]}\n  → dns_lookup(dnssec-failed.org, DNSKEY)  {\"status\": \"ok\", \"records\": [two keys, tags 256 and 257]}\n  → dns_lookup(dnssec-failed.org, DS)      {\"status\": \"ok\", \"records\": [\"42069 13 2 62726f6b656e...\"]}" },
    { "output": "DIAGNOSIS: The DNSSEC chain is broken: the parent .org zone publishes a bogus DS record that does not match the domain's DNSKEY, so validating resolvers (the office network) reject the zone while the old server, which skips validation, resolves fine." }
  ]
}
```

It resolved A (zone reachable), pulled the DNSKEYs, pulled the DS from the parent, concluded they cannot match, and explained why exactly the validating resolvers fail while the legacy one sails through. It even noticed that the DS digest is not a hash at all: the hex decodes to the ASCII string "broken chain of trust send help!", which is the fixture's inside joke, spotted by the model mid-diagnosis. That is evidence-following, not pattern-matching on the domain name.

## The model that got disqualified

Here is the part we would want to read in anyone else's agent post. Our first model choice narrated its tool calls as text instead of calling them, and then did something worse: it **invented probe results**. "Let's say the MX lookup returned NoAnswer", it wrote, and proceeded to diagnose a hypothetical, complete with a made-up IP address, while the real answer (that null MX) sat unqueried.

For a diagnostic agent this is the cardinal sin. A wrong diagnosis from real evidence is a bug; a confident diagnosis from imagined evidence is a hazard. So the test that actually selected our model was not a benchmark, it was: *give it a symptom and watch whether every record it cites exists in the probe log.* The model that shipped (`openai-gpt-oss-120b` on DigitalOcean's platform) passed on every case; the platform's model menu meant switching candidates was a one-line env var (`DETECTIVE_MODEL`), which turned model selection into an experiment instead of a rewrite.

That is also the general lesson for agent builders: **grounding tools only help if fabrication is treated as disqualifying, and you only catch it by auditing the trail.** It is why the agent prints every probe as it runs.

## Why the platform part was boring, complimentarily

The DigitalOcean side of this build is the part with nothing to debug, which is the compliment: an OpenAI-compatible endpoint (`inference.do-ai.run/v1`), standard function calling, one bearer key, and a menu of models from multiple providers behind the same API. The whole integration is a `urllib` request; no SDK, no framework. For agent experiments where the interesting decisions are the tools and the honesty constraints, a serverless per-token endpoint is exactly the right amount of infrastructure, and swapping models to run the fabrication test across candidates cost nothing but the tokens.

## Where to take it

The repo is MIT and the pattern extends anywhere probes exist: an SMTP probe (connect to port 25, read the banner and the rejection message) would make the mail diagnosis end-to-end; a propagation probe (query several public resolvers and compare) would catch mid-migration states; and CI could run the detective against your own domains nightly, alerting when a diagnosis changes. If you build the SMTP one, our [DNS record checkers](https://smtpfa.st/tools) cover the static half of that story already.

The bigger point stands on its own: the gap between "LLM that talks about infrastructure" and "agent that inspects infrastructure" is four small functions and one rule about evidence. The tools are the easy part. The rule is the product.
