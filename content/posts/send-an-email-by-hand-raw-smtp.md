---
title: 'Send an Email by Hand: The Raw SMTP Conversation (and Why You Should Not Do It in Production)'
excerpt: 'You can open a socket to a mail server and type an email one command at a time. Doing it once teaches you what every email API hides. Here is the full SMTP conversation, byte by byte, and the exact reasons production sending needs more than a telnet session.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-07-23'
publishedAt: '2026-07-23T09:00:00Z'
updatedAt: '2026-07-23T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - Email
  - SMTP
  - DevOps
  - Linux
---

Every email your application sends is, underneath the library and the API, a short text conversation between two servers. You can have that conversation yourself: open a socket to a mail server, type a handful of commands, and a real message lands in a real inbox. Doing it once, by hand, teaches you more about email than any amount of reading, because it shows you exactly what your `send()` call is doing on your behalf.

This post walks the whole SMTP conversation one command at a time, then explains the harder truth: the reason nobody sends production email this way. The gap between "I typed the commands and it worked" and "millions of messages reach the inbox every day" is where retries, encryption, authentication, DKIM, suppression, and sender reputation live. Understanding the raw protocol is exactly what makes those production concerns make sense.

If you would rather watch the flow than type it, our [SMTP Flow Simulator](/games/smtp-flow-simulator) animates the same conversation, from app submission through TLS, auth, DNS checks, the recipient MX relay, retries, and bounces. Keep it open in a tab as you read.

## TL;DR

- SMTP is a line-based text protocol. The client types commands (`EHLO`, `MAIL FROM`, `RCPT TO`, `DATA`); the server answers with 3-digit codes (`220`, `250`, `354`).
- You can send a real email by hand with `telnet` or `openssl s_client`. It works, and it is the single best way to understand the protocol.
- The **envelope** (`MAIL FROM` / `RCPT TO`) is separate from the **headers** (`From:` / `To:` inside `DATA`). That split is why spoofing is easy and why SPF, DKIM, and DMARC exist.
- Production sending needs everything the raw conversation does not give you: TLS everywhere, authentication, DKIM signing, connection reuse, retry-with-backoff, bounce and complaint handling, suppression lists, and IP/domain reputation.
- Once you have seen the protocol, an API like [SMTPfast](https://smtpfa.st) stops being a black box: it is the raw conversation plus every production concern handled for you.

## Prerequisites

- A terminal with `telnet` and `openssl` (both ship on macOS and most Linux distros).
- A rough idea of TCP ports and DNS. You do not need to know SMTP yet, that is the point.
- A domain you control if you want to test authenticated sending. Sending *to* your own address is the safe way to experiment.

## The conversation, one command at a time

SMTP runs on a few well-known ports: `25` (server-to-server relay), `465` (implicit TLS submission), and `587` (submission with `STARTTLS`). As a client submitting mail, you want `587`.

Every exchange follows the same rhythm: you send a line, the server replies with a 3-digit status code and some text. `2xx` means success, `3xx` means "keep going, send more", `4xx` is a temporary failure (try again later), and `5xx` is permanent (do not retry).

Here is the opening. Connect to port 25 of a mail server and say hello with `EHLO` (the extended HELO), which asks the server to list what it supports:

```terminal
{
  "title": "opening the conversation",
  "prompt": "",
  "steps": [
    { "comment": "connect to the mail server on the relay port" },
    { "cmd": "telnet smtp.example.com 25", "output": "Trying 203.0.113.10...\nConnected to smtp.example.com.\n220 smtp.example.com ESMTP ready" },
    { "comment": "220 = the server is ready. Introduce ourselves and ask for its capabilities:" },
    { "cmd": "EHLO laptop.local", "output": "250-smtp.example.com\n250-STARTTLS\n250-AUTH LOGIN PLAIN\n250-SIZE 26214400\n250 8BITMIME" }
  ]
}
```

That `250-` block is the server advertising what it can do: it supports `STARTTLS` (upgrade the connection to encrypted), `AUTH` (log in), a max message `SIZE`, and `8BITMIME`. The last line uses `250 ` (space, not dash) to signal the end of the list.

Notice what the server told us: it offers `STARTTLS`, so right now we are talking in **plaintext**. Anything we send, including a password, is readable on the wire. So before authenticating, we upgrade.

:::warning
Never send `AUTH` credentials over an un-upgraded connection. If a server lets you authenticate in plaintext on port 25, that is a red flag, not a convenience. Always `STARTTLS` (or connect to the implicit-TLS port 465) before `AUTH`.
:::

## Encrypt, authenticate, and send

After `STARTTLS`, the connection becomes TLS-encrypted and the plaintext `telnet` can no longer read it. The practical way to do the encrypted half by hand is `openssl s_client`, which performs `STARTTLS` for you and then drops you into the now-secure session:

```terminal
{
  "title": "the authenticated send",
  "prompt": "",
  "steps": [
    { "comment": "connect and upgrade to TLS in one step (submission port 587)" },
    { "cmd": "openssl s_client -starttls smtp -connect smtp.example.com:587 -quiet", "output": "220 smtp.example.com ESMTP ready" },
    { "cmd": "EHLO laptop.local", "output": "250-smtp.example.com\n250-AUTH LOGIN\n250 8BITMIME" },
    { "comment": "log in. AUTH LOGIN expects the username and password base64-encoded, one per line" },
    { "cmd": "AUTH LOGIN", "output": "334 VXNlcm5hbWU6" },
    { "cmd": "dXNlckBleGFtcGxlLmNvbQ==", "output": "334 UGFzc3dvcmQ6" },
    { "cmd": "c3VwZXItc2VjcmV0", "output": "235 2.7.0 Authentication successful" },
    { "comment": "the envelope: who is sending, and who should receive" },
    { "cmd": "MAIL FROM:<you@example.com>", "output": "250 2.1.0 Ok" },
    { "cmd": "RCPT TO:<friend@example.net>", "output": "250 2.1.5 Ok" },
    { "comment": "announce the message body. 354 = go ahead, end with a lone dot" },
    { "cmd": "DATA", "output": "354 End data with <CR><LF>.<CR><LF>" },
    { "cmd": "From: You <you@example.com>\nTo: A Friend <friend@example.net>\nSubject: Sent by hand\n\nThis email was typed one command at a time.\n.", "output": "250 2.0.0 Ok: queued as 4F1a2b3c" },
    { "cmd": "QUIT", "output": "221 2.0.0 Bye" }
  ]
}
```

That `250 Ok: queued as 4F1a2b3c` is the moment the server accepts responsibility for your message. You just sent an email with your bare hands.

Here is the whole handshake as a flow. Open the [simulator](/games/smtp-flow-simulator) alongside it to watch the same steps animate, including what happens *after* the queue (DNS lookups, the recipient's MX, retries, and inbox placement):

```diagram
{
  "type": "flow",
  "title": "The SMTP submission conversation",
  "trace": true,
  "nodes": [
    { "label": "TCP connect :587", "icon": "net" },
    { "label": "EHLO + capabilities", "icon": "activity" },
    { "label": "STARTTLS (encrypt)", "icon": "lock" },
    { "label": "AUTH (log in)", "icon": "check" },
    { "label": "MAIL FROM / RCPT TO", "icon": "branch" },
    { "label": "DATA (the message)", "icon": "box" },
    { "label": "250 Queued", "icon": "rocket" }
  ]
}
```

## The one detail that explains a decade of email security

Look again at two different places the sender address appeared:

- In the **envelope**: `MAIL FROM:<you@example.com>`
- In the **headers**, inside `DATA`: `From: You <you@example.com>`

These are two independent fields, and nothing in SMTP forces them to match. The envelope `MAIL FROM` is what the receiving server uses for routing and bounce returns; the header `From:` is what the recipient sees in their mail client. You can put anything you like in either.

That single design fact is why email spoofing is trivial and why the entire modern anti-abuse stack exists:

- **SPF** checks whether the sending IP is allowed to use the envelope `MAIL FROM` domain.
- **DKIM** cryptographically signs the message so a receiver can verify the header `From:` domain really authorized it.
- **DMARC** ties the two together and tells receivers what to do when they disagree.

You cannot understand why deliverability is hard until you have seen that the protocol itself will happily let you claim to be anyone. If you want the practical setup for the three records, we walk through them in the [SMTP Flow Simulator](/games/smtp-flow-simulator)'s DNS-check stage.

## Why you should not do this in production

Typing the conversation once is enlightening. Building your production sending on top of raw SMTP calls is a mistake, and here is the specific list of what the happy-path telnet session quietly skips.

**Delivery is not a single request.** Your `250 queued` only means the first hop accepted the message. The receiving server still has to be found (MX lookup), might be down, might greylist you with a `4xx` and expect a retry in a few minutes, or might defer under load. Production senders need a real retry queue with exponential backoff that distinguishes `4xx` (retry) from `5xx` (give up and record a bounce). A shell one-liner does none of this.

**Authentication of the message, not just the connection.** `AUTH LOGIN` proved *you* could log in. It did nothing to prove to the *recipient* that the message is legitimate. That requires **DKIM signing** every outgoing message with a private key whose public half lives in your DNS. Get the canonicalization or header selection wrong and signatures fail silently at the receiver.

**Connections are expensive and rate-limited.** Opening a fresh TCP + TLS handshake per message is slow and will get you throttled. Real senders pool connections, pipeline commands, and respect per-receiver rate limits (Gmail, Outlook, and Yahoo each have their own).

**Bounces and complaints must feed back.** When a `5xx` bounce or a spam complaint (via a feedback loop) comes in, you must stop mailing that address, immediately. Keep hitting dead addresses and mailbox providers read it as spammer behavior and start filtering everything you send. This means maintaining a **suppression list** and honoring it on every send.

**Reputation is earned slowly and lost fast.** Mailbox providers score the IP and domain you send from. New senders must warm up gradually; a sudden spike from a cold IP looks like a compromised account. One bad campaign, or one afternoon of retrying dead addresses, can tank delivery for weeks.

None of these are protocol features. They are operational systems you would have to build and run around SMTP. That is the actual product an email platform sells.

```diagram
{
  "type": "branch",
  "title": "What lives above the raw protocol",
  "nodes": [
    { "label": "250 Queued (SMTP accepted it)", "icon": "check" }
  ],
  "branch": [
    { "label": "Retry queue", "sub": "4xx backoff, 5xx bounce", "icon": "activity", "tone": "blue" },
    { "label": "DKIM signing", "sub": "prove the message is yours", "icon": "lock", "tone": "violet" },
    { "label": "Suppressions", "sub": "stop mailing dead/complained", "icon": "shield", "tone": "green" },
    { "label": "Reputation", "sub": "warmup, IP + domain scoring", "icon": "activity", "tone": "amber" }
  ]
}
```

## The two production paths (and where each fits)

Once you have decided not to hand-roll SMTP, you have two real options, and they are not mutually exclusive.

**1. Keep speaking SMTP, but let something else manage it.** Your app already knows how to talk SMTP (every language has a client), so the smallest change is to point that client at a service that handles TLS, auth, DKIM, retries, and reputation for you. That is exactly what the [SMTPfast](https://smtpfa.st) SMTP bridge is: you keep your existing `nodemailer` / `smtplib` / `Mail::Sender` code and just change the host, port, and credentials. Everything from the "why not in production" list above becomes someone else's job. This is the path of least resistance for legacy apps and anything that already emits SMTP.

**2. Send over a REST API.** If you are writing new code, a JSON `POST` is simpler than managing an SMTP client, connection pool, and MIME construction. You hand over the from, to, subject, and body; the platform builds the message, signs it, sends it, retries it, and streams back delivery events. [SMTPfast](https://smtpfa.st) exposes this as a plain REST API (and there is a hosted MCP server if you want an AI agent to send on your behalf).

The useful way to think about it: the raw conversation you just typed is the *floor*. An API is that floor plus the retry queue, the DKIM signer, the suppression list, and the reputation management, all of which you would otherwise build and babysit yourself.

```tabs
{
  "title": "The same email, three ways",
  "tabs": [
    { "label": "Raw SMTP (by hand)", "lang": "text", "code": "EHLO laptop.local\nAUTH LOGIN\n...\nMAIL FROM:<you@example.com>\nRCPT TO:<friend@example.net>\nDATA\nSubject: Sent by hand\n\nhello\n." },
    { "label": "SMTP client (bridge)", "lang": "javascript", "code": "// point an existing SMTP client at the bridge\nconst t = nodemailer.createTransport({\n  host: 'smtp.smtpfa.st', port: 587,\n  auth: { user: 'apikey', pass: process.env.SMTPFAST_KEY }\n});\nawait t.sendMail({ from: 'you@example.com', to: 'friend@example.net', subject: 'hi', text: 'hello' });" },
    { "label": "REST API", "lang": "bash", "code": "curl https://smtpfa.st/api/v1/emails \\\n  -H \"Authorization: Bearer $SMTPFAST_KEY\" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"from\":\"you@example.com\",\"to\":\"friend@example.net\",\"subject\":\"hi\",\"text\":\"hello\"}'" }
  ]
}
```

## What to take away

The SMTP conversation is small enough to type by hand and old enough to have accumulated every workaround the internet ever invented for trust. Sending one message manually is the fastest way to internalize three things: the protocol is just text, the envelope and headers are separate (so the sender is unverified by default), and the `250 queued` you get back is the *easy* part.

Everything hard about email, deliverability, authentication, retries, reputation, lives above the protocol, in the operational layer. That is precisely the layer you are choosing to build yourself or hand to a service like [SMTPfast](https://smtpfa.st) when you pick how your app sends mail.

Go type the conversation once. Then go watch the whole delivery path, retries and bounces included, in the [SMTP Flow Simulator](/games/smtp-flow-simulator). After that, `send()` will never look like a black box again.
