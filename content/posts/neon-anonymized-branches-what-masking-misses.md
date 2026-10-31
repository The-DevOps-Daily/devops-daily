---
title: 'Neon Anonymized Branches: We Masked the PII Columns and Every Email Survived'
excerpt: 'We gave a Neon anonymized branch masking rules for every PII column of a 20,000-user table. The masking worked, and all 20,000 original emails were still readable on the branch: in order copies, JSON payloads, support tickets, and an audit table that the masking run itself filled. Here is the scanner we used as a CI gate, and what it took to pass it.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-11-03'
publishedAt: '2026-11-03T09:00:00Z'
updatedAt: '2026-11-03T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Neon
  - Postgres
  - Data Anonymization
  - PII
  - Database Branching
  - Preview Environments
  - CI/CD
  - Security
sponsorCampaign: 'neon'
---

We created an anonymized branch of a 20,000-user SaaS database on Neon. It had masking rules for the six PII columns of the `users` table: email, name, phone, street address, date of birth and signup IP. The masking run took 9 seconds. Afterwards, no row in `users` held its original email, name, phone, address or IP. (Two random dates of birth came out equal by chance.) Then we read every text and JSON column on the branch. **All 20,000 original email addresses were still there**, and so was every original name, phone number, street address and IP address.

Most of them were in places nobody writes a rule for: the email copied onto each order at checkout, the JSON payloads of login and checkout events, the text of support tickets. The other 20,000 copies came from the masking run itself. The masking updates each row of `users`, so the audit trigger on that table fired 20,000 times and saved every original row into `audit_log`.

Anonymized branches mask the columns you list, and in our runs they did. This post measures what is left in the rest of a realistic schema. It also shows the scanner we used to find it, which runs as a CI gate before preview branches are made from the masked branch. Other topics: which masking expressions Neon accepts, unique columns, stable values for tests, and preview branches from the masked template. Everything ran on a real Neon project through the Neon API. The scripts are public.

## TL;DR

- **Masking the listed columns works.** No masked email, name, phone, address or IP kept its original value. The generated search column and the materialized view held only masked values after the run.
- **The copies are not masked.** After masking only `users`, 18,776 of the 20,000 original emails (93.9%) were still readable outside the audit table: 40,191 order rows, 34,689 event payloads, 2,486 support tickets and 2,035 invitations still held a user's original PII.
- **The masking run fires your triggers.** `audit_log` grew from 1,888 to 21,888 rows during masking, and each new row held one user's full original row. In our project the trigger recorded `neondb_owner`, the same role as the app, as the user. The branch refuses connections until the run ends, so you cannot switch the trigger off first.
- **We found no rule that edits JSON in place.** Neon rejected casts, `CASE` and `jsonb_set`, and `regexp_replace` on a `jsonb` column failed during the run. In our tests, a JSON column could be rebuilt or replaced, not edited.
- **`regexp_replace` cleans emails and phone numbers out of free text, not names.** It removed all of them from 6,558 ticket bodies, and our JavaScript copy of the rule predicted the result exactly. 1,231 bodies still named a user, because names have no pattern.
- **Only replacing free text and JSON passed the gate.** Ticket bodies became lorem ipsum and event payloads became `{}`. That costs realism, and you have to decide if it is worth it.
- **Pick generators with care.** On the unique `users.email` column, `anon.dummy_free_email()` and `anon.dummy_safe_email()` both made the masking run fail at 20,000 rows. `dummy_free_email()` writes addresses at gmail.com, yahoo.com and hotmail.com. Random IP addresses and phone numbers can be equal to real ones, so our passing rules take IPs from a documentation range and give phone numbers the area code 000.
- **Preview branches from the masked template were ready in 2.4 to 2.6 seconds** and matched the data fingerprint that the scan recorded. The same scan, run after a migration that copied emails into a new table, failed on that table.

## Prerequisites

- A Neon account and an API key (Account settings > API keys). Everything here ran on a Scale plan project. Anonymized branches are a beta feature.
- Node.js 22 or newer.
- Basic Postgres knowledge: triggers, `jsonb`, materialized views.

## What an anonymized branch does

Neon's [data anonymization](https://neon.com/docs/workflows/data-anonymization) creates a branch of a Lakebase Postgres database from a parent branch, then masks it with [PostgreSQL Anonymizer](https://postgresql-anonymizer.readthedocs.io/) (the `anon` extension, version 2.5.1 on our branches). The masking is static: the run rewrites the rows on the new branch, and the parent does not change. You send the rules with the create call, or set them later and start the run with `POST /branches/{id}/anonymize`:

```bash
curl -X POST "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branch_anonymized" \
  -H "Authorization: Bearer $NEON_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "branch_create": { "branch": { "name": "template", "parent_id": "'"$MAIN_ID"'" } },
    "masking_rules": [
      { "database_name": "neondb", "schema_name": "public", "table_name": "users",
        "column_name": "full_name", "masking_function": "anon.dummy_name()" }
    ],
    "start_anonymization": true
  }'
```

Three details matter later in this post:

1. The branch refuses connections until the run ends (`Access to this endpoint is temporarily disabled`). We saw the same error before a run started and after a run failed, so a failed run does not hand out unmasked data.
2. `GET /branches/{id}/anonymized_status` reports `anonymizing`, then `anonymized` or `error`, with the table it is working on.
3. Each rule names one column. Nothing in the API looks at the columns you did not name.

That is by design, and Neon's [pg_redact post](https://neon.com/blog/pg-redact-content-aware-pii-redaction-with-jev-enforced-in-postgres) makes the same point: column rules cannot reach PII inside free text. What we wanted to know is how much PII that is in an ordinary schema, where it sits, and how to find it before someone gets a connection string.

## The test database

The schema is a small invoicing SaaS. `users` holds the PII on purpose. Everything else holds it by accident, the way real apps do:

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "users", "label": "users", "sub": "email, full_name, phone, address, signup_ip", "icon": "database", "tone": "violet", "detail": "The six columns with masking rules in round 1." }
    ],
    [
      { "id": "orders", "label": "orders", "sub": "contact_email, shipping_*", "icon": "box", "tone": "blue", "detail": "The email and shipping details are copied at checkout. 8% of orders ship to someone else." },
      { "id": "tickets", "label": "support_tickets.body", "sub": "free text", "icon": "box", "tone": "blue", "detail": "Customers quote their own email, phone and address, and other people's." },
      { "id": "events", "label": "events.payload", "sub": "jsonb", "icon": "activity", "tone": "blue", "detail": "Login IPs, checkout customer objects, bounce messages, profile URLs with name slugs." },
      { "id": "invites", "label": "invitations", "sub": "invitee email, name, message", "icon": "box", "tone": "blue", "detail": "71% of invitees are not users." }
    ],
    [
      { "id": "audit", "label": "audit_log", "sub": "trigger: old and new row", "icon": "shield", "tone": "red", "detail": "AFTER UPDATE trigger on users stores to_jsonb(OLD) and to_jsonb(NEW)." },
      { "id": "view", "label": "customer_summary", "sub": "materialized view", "icon": "database", "tone": "slate" },
      { "id": "search", "label": "users.search", "sub": "generated tsvector", "icon": "database", "tone": "slate" }
    ]
  ],
  "edges": [
    ["users", "orders", "copied"],
    ["users", "tickets", "quoted"],
    ["users", "events", "logged"],
    ["users", "invites", "named"],
    ["users", "audit", "every UPDATE"],
    ["users", "view", "refresh"],
    ["users", "search", "generated"]
  ]
}
```

A seeded generator writes 20,000 users, 40,191 orders, 6,558 tickets, 59,738 events and 2,035 invitations (47.7 MB). Then it changes the email or the address of 1,888 users, so the audit trigger has history with former values. All names are made up, emails use the reserved `.example` and `.test` domains, and phone numbers use the fictional 555-01xx range.

The generator also records every PII value it writes into each row. That record is the ground truth: for each column, how many rows hold a user's value, a former value, or the details of someone who is not a user. Decoys that look like PII are mixed in: invoice numbers, order numbers, tracking numbers and the app's own support address.

## The scanner

<!-- TODO(repo-url): add the GitHub repo card fence for The-DevOps-Daily/neon-anonymized-branches here once the repository exists. -->

`scan.mjs` takes two branches: the anonymized branch to check, and its parent. It reads the PII columns you list in `pii-sources.json` on the parent. Here that is five columns of `users`. They give 20,000 emails, 17,396 distinct full names, 16,967 phone numbers, 20,000 addresses and 20,000 IP addresses. Then it reads every text, JSON, `tsvector` and `inet` column of every table and materialized view on the anonymized branch. It does not read numeric columns or numbers inside JSON, so a phone number stored as a number is invisible to it. It reports per column:

- **known**: rows that still hold a value from the parent, also inside free text and JSON. Emails and IP addresses are matched exactly. Phone numbers are matched on their last 10 digits, so `(542) 555-0151` matches `+15425550151`. A full name is matched as two neighbouring words, so `/team/tarek-stratkett` in a URL matches "Tarek Stratkett".
- **pattern**: rows that hold something shaped like an email, phone number, IP address or street address that is not a known value. This finds former emails and people who are not users.
- **unchanged**: rows of a masked column that kept the parent's value.
- **row counts** of every table that changed during masking, and the **databases** on the branch.
- a **fingerprint** of the data it scanned: per table, the row count and an order-independent sum of md5 over every whole row, taken before and after the scan.

Fake values in a replaced column have the shape of PII on purpose, so PII-shaped values there do not fail the gate. Two columns in our schema are computed only from masked columns: the materialized view `customer_summary` and the generated `search` column. They hold fake emails too, so we listed them under `review` in `pii-sources.json`. Their PII-shaped values are reported for a person to check, and do not fail the gate. Known values in them still fail.

It exits with 1 in these cases:

- a column holds a known value;
- a column that no rule replaces, and that is not on the review list, holds a PII-shaped value;
- a rule changed no row;
- the branch has a database that the scan did not read;
- the data changed during the scan.

The output has counts and JSON paths, not values. A pass means that the scan found none of the values and shapes it knows. It does not mean the branch is clean. The scanner does not know IPv6 addresses, phone numbers outside the US format, nicknames or encoded values. It also skips emails at the app's own domain (`allow_domains` in `pii-sources.json`).

Before we trusted it, we ran it against the unmasked parent. For all 33 combinations of column and kind, the rows it found matched the planted ground truth exactly. This is not an independent test of recall. We wrote the data in formats the scanner knows, and the seed uses the scanner's own normalizer. The test shows that the scanner counts what it should on this data. No decoy matched, at the value level. The scanner found 687 email-shaped values in ticket bodies that are not user emails: 661 belonged to colleagues and 26 were former addresses. Its blind spot was there too. It cannot find the 5,985 distinct names of people who are not users, because no pattern finds a name.

A second check runs without Neon. `08-predict.mjs` takes the parent's data and a rule set and predicts each column of the scan: unmasked columns keep their values, replaced columns hold none, and `regexp_replace` rules are applied in JavaScript. Where the real scan differs from that prediction, the masking run did something on its own.

### Four false alarms, and two fixes that were too clever

The first version of the gate raised four false alarms on two templates. Three were real values of other users that the fake data generator had produced by chance: 2 masked IP addresses and 1 rebuilt shipping phone number. The fourth was our bug. The tsvector name check paired every two words it found, so the letters `ada` at the start of a uuid email (`ada8272f-...@example.com`) and the fake first name Garrick made "ada garrick", the name of a real user. The scans are kept in `results/first-gate/`.

The tsvector check now uses whole lexemes only. For the chance matches we first ignored any value that also appeared in a masked column. A review showed that this fails open: a real leak with the same value would be ignored too. Our second try proved each match row by row, and a second review found that it still excused too much.

So the gate now has no exception for chance matches. Every known value fails it, and a person looks at the report. On real data this will happen more often than in ours, because `anon.dummy_name()` returns real first and last names, and in a table of real people many fake names are somebody's real name. A gate that stops for a false alarm costs a person a few minutes. A gate that lets a real leak through costs much more.

## Round 1: the columns everyone lists

The first rule set masks the PII columns of `users`, the way the docs and the GitHub Action examples do. For the unique email column we used the Console's Random Unique Email, `pg_catalog.concat(anon.dummy_uuidv4(), '@example.com')`, which Neon recommends for unique columns.

```terminal
{
  "title": "scan the round 1 template",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node scripts/scan.mjs --target template-v1 --known main --evidence --out results/scan-template-v1.json",
      "output": "scanned 26 columns in 7 tables of template-v1 (58.0 s)\n  audit_log.old_row                  rule=none      known: email 20938, name 21888, phone 18552, address 20950, ip 21888 pattern: email 950, address 938\n  audit_log.new_row                  rule=none      known: email 1888, name 1888, phone 1585, address 1888, ip 1888 pattern: email 20000, phone 17780, address 976, ip 20000\n  customer_summary.email             rule=review    known: -                                            pattern: email 20000, phone 196\n  events.payload                     rule=none      known: email 19931, name 12816, ip 11888            pattern: ip 8017\n  invitations.invitee_email          rule=none      known: email 585                                    pattern: email 1450\n  invitations.invitee_name           rule=none      known: name 585                                     pattern: -\n  invitations.message                rule=none      known: name 2035                                    pattern: -\n  orders.contact_email               rule=none      known: email 40191                                  pattern: -\n  orders.shipping_name               rule=none      known: name 36939                                   pattern: -\n  orders.shipping_address            rule=none      known: phone 31371, address 36939                   pattern: phone 3252, address 3252\n  support_tickets.body               rule=none      known: email 1324, name 1231, phone 1162, address 588 pattern: email 687, phone 622\n  users.search                       rule=review    known: -                                            pattern: email 20000, phone 191\n  warning: public.audit_log has 21888 rows, the parent has 1888 (+20000)\n  review: customer_summary.email: 20000 rows hold PII-shaped values (review: materialized view of users.email)\n  review: users.search: 20000 rows hold PII-shaped values (review: generated from users.full_name and users.email)\nFAIL: 16 problems"
    }
  ]
}
```

These are the rows that still hold a user's original PII:

| Column                                      | Rows   | Rows with a user's original PII | What                                                    |
| ------------------------------------------- | ------ | ------------------------------- | ------------------------------------------------------- |
| `audit_log.old_row`                         | 21,888 | 21,888                          | every kind; 20,000 rows were written by the masking run |
| `orders.contact_email`                      | 40,191 | 40,191                          | the email, copied at checkout                           |
| `orders.shipping_name`                      | 40,191 | 36,939                          | the name                                                |
| `orders.shipping_address`                   | 40,191 | 36,939                          | address and phone, inside `jsonb`                       |
| `events.payload`                            | 59,738 | 34,689                          | emails, names, IPs, inside `jsonb`                      |
| `support_tickets.body`                      | 6,558  | 2,486                           | free text                                               |
| `invitations.message`                       | 2,035  | 2,035                           | the inviter's name                                      |
| `audit_log.new_row`                         | 21,888 | 1,888                           | history from before the branch                          |
| `invitations.invitee_email`, `invitee_name` | 2,035  | 585                             | invitees who are users                                  |

Counted as distinct values from the five source columns, this is how much is still readable on the branch. These are values, not people: 20,000 users have 17,396 distinct full names, and phone numbers are compared by their last 10 digits.

| Kind           | Readable anywhere | Readable outside `audit_log` |
| -------------- | ----------------- | ---------------------------- |
| Email          | 20,000 of 20,000  | 18,776 (93.9%)               |
| Full name      | 17,396 of 17,396  | 16,024 (92.1%)               |
| Phone          | 16,967 of 16,967  | 13,639 (80.4%)               |
| Street address | 20,000 of 20,000  | 15,907 (79.5%)               |
| IP address     | 20,000 of 20,000  | 9,208 (46.0%)                |

The scan also flagged PII of people who are not users: 1,450 invitee emails, 3,252 gift shipping addresses and phone numbers, 687 emails and 622 phone numbers in tickets, and 8,017 login IPs that are not signup IPs. It also counted 20,000 rows of `audit_log.new_row` with PII-shaped values that it does not know (emails in 20,000 rows, phone numbers in 17,780, street addresses in 976 and IP addresses in 20,000). These are the fake values that the trigger copied from each masked row. Outside a replaced column, the scanner does not try to tell fake values from real ones, so it counts them.

The prediction matched 21 of the 26 columns, and the masking run itself caused every difference. Three differences are good news. The generated `search` column held no original value, as expected: Postgres computes a stored generated column again on every `UPDATE`. The two columns of the materialized view `customer_summary` held no original value either. The status messages of the run included `Refreshing materialized view neondb.public.customer_summary`, and the [changelog](https://neon.com/docs/changelog) says Neon refreshes materialized views after anonymization. The other differences come from the audit trigger.

### The masking run fires your triggers

The prediction for `audit_log` was 1,888 rows. The branch had 21,888. Static masking [updates every row](https://postgresql-anonymizer.readthedocs.io/en/latest/static_masking/) of each table that has a rule, so a row-level `AFTER UPDATE` trigger fires once for each masked row. Our trigger is a common audit pattern:

```sql
CREATE FUNCTION audit_users() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log (table_name, row_id, action, old_row, new_row)
  VALUES ('users', OLD.id, TG_OP, to_jsonb(OLD), CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) END);
  RETURN NULL;
END $$;
```

So the masking wrote 20,000 new audit rows, and each `old_row` holds one user's original email, name, phone, address and IP. A rule on `users` alone made the branch hold a second full copy of `users`.

There is no clean way to stop this on the branch:

- The branch refuses connections before the run starts. With `start_anonymization: false` the state was `initialized` and our client was refused, so you cannot run `ALTER TABLE ... DISABLE TRIGGER` first.
- In our project, the trigger could not skip the masking run by role. The audit rows record `current_user`, and all 21,888 rows on the masked branch say `neondb_owner`, the role the app uses too.

What worked was a rule on the audit table itself (`old_row` and `new_row` masked with `NULL`). In both of our runs, Neon masked `users` first and `audit_log` after it, so the masking also cleared the rows that its own trigger had written. In a second run (`v2-audit-first`) we put the audit rules first in the rules file. The status still showed `users` as table 1 of 5, and the audit table was clean again. We did not find this order documented, so do not depend on it. The 20,000 extra rows stay on the branch with `NULL` in both columns. That is why the scanner reports tables whose row count changed.

## Round 2: mask the copies, edit the free text

The second rule set (`v2-careful`) adds a rule for every structured copy the first scan found: the order contact email and shipping name, the shipping address rebuilt with `jsonb_build_object`, the invitee email and name, and the two audit columns. For the ticket bodies it keeps the text and cuts out emails and phone numbers with the same patterns the scanner uses:

```text
pg_catalog.regexp_replace(
  pg_catalog.regexp_replace(body, '<email pattern>', '[email]', 'g'),
  '<phone pattern>', '[phone]', 'g')
```

Three columns still failed:

| Column                 | Rule             | Rows with a user's original PII                  |
| ---------------------- | ---------------- | ------------------------------------------------ |
| `events.payload`       | none             | 34,689 (emails 19,931, names 12,816, IPs 11,888) |
| `invitations.message`  | none             | 2,035 (names)                                    |
| `support_tickets.body` | `regexp_replace` | 1,819 (names 1,231, addresses 588)               |

The `regexp_replace` rule did its job. No email or phone number was left in any ticket body, of users or of anyone else, and the JavaScript prediction matched the scan exactly. But regular expressions find shapes, and a name has no shape. "Contact Maeve Ashquist on [phone] before 5pm" is still personal data.

The events table has no rule because we could not write one that keeps the payload. The rule lab (`03-rule-lab.mjs`) tried 17 expressions, each on its own anonymized branch:

| Expression                                                                                                   | Result                                          |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `anon.dummy_ipv4()` on an `inet` column                                                                      | masked; the text result is accepted             |
| `anon.dummy_ipv4()::inet`, `CAST(... AS inet)`                                                               | rejected with 400: not a valid label            |
| `CASE WHEN id % 2 = 0 THEN 'even' ELSE 'odd' END`                                                            | rejected with 400                               |
| `pg_catalog.jsonb_set(doc, '{email}', ...)`                                                                  | rejected with 400                               |
| `pg_catalog.regexp_replace(doc, ...)` on `jsonb`                                                             | the run failed: no `regexp_replace(jsonb, ...)` |
| `pg_catalog.jsonb_build_object('email', anon.dummy_safe_email(), ...)`                                       | masked: the whole document is rebuilt           |
| `masking_value: '{}'`                                                                                        | masked                                          |
| `pg_catalog.regexp_replace(note, ...)` on `text`                                                             | masked                                          |
| `anon.pseudo_email(id)`, `anon.partial_email(note)`, `pg_catalog.md5(note)`, `anon.lorem_ipsum(words := 12)` | masked                                          |
| `masking_value: 'NULL'` on a `NOT NULL` column                                                               | the run failed on the constraint                |

The rule parser accepts function calls, and only functions from the `anon` schema and 36 `pg_catalog` functions that the extension labels as trusted, such as `concat`, `regexp_replace`, `md5`, `jsonb_build_object` and `to_jsonb`. `jsonb_set` is not one of them. Without casts, a rule cannot turn `jsonb` into text and back. We found no other way to edit a document in place, so in our tests a JSON column had two options. You can rebuild the whole document from fake values, which loses its shape when the shape changes from row to row (our events have four). Or you can replace it with a constant.

## Round 3: replace what you cannot edit

The third rule set (`v3-strict`) replaces what round 2 could only edit: ticket bodies become `anon.lorem_ipsum(words := 20)`, invitation messages become `anon.lorem_ipsum(words := 10)`, and event payloads become `{}`. It also takes IP addresses and phone numbers from ranges that no real value can be in (more on that below). That passed:

```terminal
{
  "title": "scan the round 3 template",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node scripts/scan.mjs --target template-v3 --known main --evidence --out results/scan-template-v3.json",
      "output": "scanned 26 columns in 7 tables of template-v3 (49.4 s)\n  customer_summary.email             rule=review    known: -                                            pattern: email 20000, phone 210\n  users.search                       rule=review    known: -                                            pattern: email 20000, phone 207\n  warning: public.audit_log has 21888 rows, the parent has 1888 (+20000)\n  review: customer_summary.email: 20000 rows hold PII-shaped values (review: materialized view of users.email)\n  review: users.search: 20000 rows hold PII-shaped values (review: generated from users.full_name and users.email)\nPASS: no PII from the source columns and no PII-shaped values found outside replaced and review columns (2 to review)"
    }
  ]
}
```

It took 36 seconds to mask six tables. The only warning left is the 20,000 audit rows the trigger added.

This is how much of the original PII each round left readable, counted as distinct values:

```chart
{
  "type": "line",
  "title": "Original PII still readable on the masked branch",
  "unit": "%",
  "caption": "Distinct original values of the 20,000 users found anywhere on each template, as a share of all distinct values of that kind (20,000 emails, 17,396 full names, 16,967 phones, 20,000 addresses, 20,000 IPs). Round 1: 6 rules on users. Round 2: 14 rules, regexp_replace on ticket bodies. Round 3: 16 rules, free text and JSON replaced.",
  "x": [
    "round 1",
    "round 2",
    "round 3"
  ],
  "series": [
    {
      "name": "Email",
      "data": [
        100.0,
        65.2,
        0.0
      ]
    },
    {
      "name": "Full name",
      "data": [
        100.0,
        59.5,
        0.0
      ]
    },
    {
      "name": "Phone",
      "data": [
        100.0,
        0.0,
        0.0
      ]
    },
    {
      "name": "Street address",
      "data": [
        100.0,
        2.9,
        0.0
      ]
    },
    {
      "name": "IP address",
      "data": [
        100.0,
        46.0,
        0.0
      ]
    }
  ]
}
```

The pass has a price. The support inbox in a preview now shows lorem ipsum, and the events table has no payloads. Your analytics code and anything else that reads payloads has nothing to test against. If those features need realistic data, there are two honest options. You can generate synthetic tickets and events for the template. Or you can accept the risk and keep the free text, for a smaller group of people. Our regex rule did not give a middle ground, because it cannot find names.

## The gate, and preview branches from the template

The workflow we tested is: create the anonymized branch, wait for the run, scan it, and only then make preview branches from it.

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "main", "sub": "production data", "icon": "database", "tone": "violet" },
    { "label": "anonymized branch", "sub": "masking rules from git", "icon": "shield", "tone": "blue" },
    { "label": "wait", "sub": "state: anonymized", "icon": "activity", "tone": "slate" },
    { "label": "scan.mjs", "sub": "known values + patterns", "icon": "check", "tone": "amber" }
  ],
  "branch": [
    { "label": "pass: make preview branches", "variant": "good" },
    { "label": "fail: delete the branch", "variant": "bad" }
  ]
}
```

The wait matters if you use Neon's GitHub Action. [`neondatabase/create-branch-action`](https://github.com/neondatabase/create-branch-action) v6 accepts `masking_rules`, creates the branch with `start_anonymization: true`, and returns the connection string right away. It does not wait for the masking run. A job that connects next gets `Access to this endpoint is temporarily disabled`. After our failed runs, the branch stayed closed. So a job that only retries the connection waits until it times out, and the reason is in `anonymized_status`, not in the job log. `scan.mjs --wait` polls `anonymized_status` first and fails if the run did not finish. The repository has an example workflow that does this every night. We did not run that workflow in CI; the same steps ran through the scripts.

Two more things to know about the template branch:

- **Do not give it an expiry.** We gave an anonymized branch `expires_at`, and the API refused to create a child from it: `Branches with an expiration date cannot have child branches`. Set `expires_at` on the previews instead.
- **Check the data before you make previews.** A scan report is only good for the data it read. `04-previews.mjs` refuses to branch from the template unless three things are true. The report is a pass for this branch. The branch has no database that the scan did not read. The data still has the fingerprint that the scan recorded. Then the script creates each preview as a normal child branch, and checks that the preview has the same fingerprint. The fingerprint is a check for changes, not a proof: it is a row count and a 64-bit sum of md5 values per table.

From the passing template, three previews were ready in 2.4 to 2.6 seconds each, and each one matched the scanned fingerprint. A preview is a normal branch: it has no anonymization status and no restricted actions. After a test run wrote to one preview, resetting it to its parent took 3.1 seconds, and the preview matched the scanned fingerprint again.

To see the check refuse, the script makes a copy of the template, scans it, and writes one support ticket with a real user's email into it, the way someone might paste a production row into a shared branch:

```terminal
{
  "title": "previews behind the gate",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node scripts/04-previews.mjs --template template-v3",
      "output": "gate: template-v3 passed its scan and still has the scanned data (93d1a68c197956d4)\npreview-pr-101: ready in 2.4 s, checked after 5.5 s, same data as scanned: true\npreview-pr-102: ready in 2.6 s, checked after 5.8 s, same data as scanned: true\npreview-pr-103: ready in 2.6 s, checked after 6.1 s, same data as scanned: true\nreset br-damp-leaf-b9jbyrph to the template in 3.1 s; same data as scanned again: true\nstale gate: after the scan open; after one INSERT refused: data changed since the scan: public.support_tickets (rows 6558 -> 6559)"
    }
  ]
}
```

So treat the template as read-only once it passes: hand out preview branches, never the template's own connection string, and scan again after any change to it.

Then we broke it on purpose. `07-break.mjs` runs a migration on a branch of main that adds a `newsletter_signups` table, a copy of 9,956 users' emails and names. The rules that passed in round 3 do not know that table, so we made a new template with them and scanned it:

```terminal
{
  "title": "scan after the migration",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node scripts/scan.mjs --target template-drift --known main-drift --evidence --out results/scan-template-drift.json",
      "output": "scanned 29 columns in 8 tables of template-drift (35.5 s)\n  customer_summary.email             rule=review    known: -                                            pattern: email 20000, phone 219\n  newsletter_signups.email           rule=none      known: email 9956                                   pattern: -\n  newsletter_signups.full_name       rule=none      known: name 9956                                    pattern: -\n  users.search                       rule=review    known: -                                            pattern: email 20000, phone 212\n  warning: public.audit_log has 21888 rows, the parent has 1888 (+20000)\n  review: customer_summary.email: 20000 rows hold PII-shaped values (review: materialized view of users.email)\n  review: users.search: 20000 rows hold PII-shaped values (review: generated from users.full_name and users.email)\nFAIL: 2 problems"
    }
  ]
}
```

This is the reason to scan every text and JSON column, and not only the columns in the rules file. Rules describe the schema as it was when someone wrote them. The scan checks the schema as it is now. The new `first_name` column was not flagged, because a first name alone is not a full name. That is a limit of the scanner, and the next section has more of them.

## What your tests will notice

**Unique columns.** Fake data generators repeat themselves. We generated each email function many times and counted the repeats:

| Function                                                            | Repeats in 1,000 | Repeats in 5,000 | Repeats in 20,000 | Repeats in 100,000 |
| ------------------------------------------------------------------- | ---------------- | ---------------- | ----------------- | ------------------ |
| `anon.dummy_free_email()`                                           | 0                | 11               | 180               | 4,561              |
| `anon.dummy_safe_email()`                                           | 46               | 1,145            | 12,000            | 90,979             |
| Random Unique Email (`concat(anon.dummy_uuidv4(), '@example.com')`) | 0                | 0                | 0                 | 0                  |
| `anon.fake_email()`                                                 | 369              | 4,009            | 19,001            | 99,001             |

On the unique `users.email` column, a masking run with `dummy_free_email()` failed with `duplicate key value violates unique constraint "users_email_key"`, and so did `dummy_safe_email()`. The run ended in `error`, and our client was refused after both failed runs, so the unmasked data was not reachable. But a nightly template job fails. Random Unique Email had no repeats.

**Where fake emails point.** `dummy_free_email()` writes addresses at yahoo.com, hotmail.com and gmail.com (about a third each, in 20,000 values). Those are public mail services, so a fake address there can belong to a real person. If a preview app sends password resets or receipts, use a function that writes `example.com` addresses, or switch email off in previews.

**Stability.** Two templates made from the same parent with the round 1 rules shared no masked email, name, phone, address or IP. (One date of birth matched by chance.) So a test that expects "user 42 is called X" fails on the next template. Values derived from the primary key do not move: with `pg_catalog.concat('user-', id, '@example.com')` and `anon.pseudo_first_name(id)`, both templates matched in 20,000 of 20,000 rows. The email from the id is unique too. Only use such rules where the input is not PII itself, because anyone with the function can compute the output again.

**Foreign keys.** The docs say foreign key columns cannot be masked directly, and that the Console shows an alert instead. Through the API, a rule on `orders.user_id` was accepted and the run completed. Afterwards, 40,190 of the 40,191 orders belonged to a different user than on the parent. Joins between orders and users on that branch no longer match the parent. We did not test the docs' advice to mask the primary key instead.

**Generators that can produce real values.** In the first version's runs, 2 masked IP addresses from `anon.dummy_ipv4()` and 1 phone number from `anon.dummy_phone_number()` were equal to real values of other users. Our gate fails on such a match. To make that rare, the round 3 rules take IP addresses from the 198.51.100.0/24 documentation range (`pg_catalog.concat('198.51.100.', anon.random_int_between(1, 254))`) and give phone numbers the area code 000, which no real number has. In the final runs, no generated value was equal to a real one. Names are harder, because `anon.dummy_name()` returns real names.

**`anon.detect()`.** PostgreSQL Anonymizer has a detector that suggests PII columns from their names. On our schema it suggested `users.city`, `users.email`, `users.phone`, the `users_email_key` index and `customer_summary.email`. It did not suggest `full_name`, `street_address`, `signup_ip`, or any of the copies, because their names are not in its dictionary. It is a start for a rules file, not a check.

## How long masking takes

The masking run rewrites every row of every table that has a rule. To see how that grows, `06-timing.mjs` masked three columns of one table at three sizes, three runs each, with the compute fixed at 1 CU:

| Rows      | Table size | Masking run (median, min to max) | API call to usable branch (median) |
| --------- | ---------- | -------------------------------- | ---------------------------------- |
| 10,000    | 2.3 MB     | 3 s (3 to 4), 3 of 3 runs        | 12.8 s                             |
| 100,000   | 22.1 MB    | 4 s (4 to 5), 3 of 3 runs        | 14.1 s                             |
| 1,000,000 | 226.6 MB   | 17 s (17 to 17), 3 of 3 runs     | 26.9 s                             |

```chart
{
  "type": "bar",
  "title": "Masking run time by table size",
  "unit": "s",
  "caption": "Three masked columns (email, name, phone), compute fixed at 1 CU, aws-eu-central-1, median of three runs. The run time is Neon's started_at to completed_at, which are whole seconds.",
  "rows": [
    {
      "label": "10,000 rows",
      "value": 3,
      "series": "masking run"
    },
    {
      "label": "100,000 rows",
      "value": 4,
      "series": "masking run"
    },
    {
      "label": "1,000,000 rows",
      "value": 17,
      "series": "masking run"
    },
    {
      "label": "10,000 rows",
      "value": 12.8,
      "series": "API call to usable branch"
    },
    {
      "label": "100,000 rows",
      "value": 14.1,
      "series": "API call to usable branch"
    },
    {
      "label": "1,000,000 rows",
      "value": 26.9,
      "series": "API call to usable branch"
    }
  ],
  "series": [
    {
      "name": "masking run",
      "color": "#f59e0b"
    },
    {
      "name": "API call to usable branch",
      "color": "#38bdf8"
    }
  ]
}
```

At 10,000 and 100,000 rows the runs took 3 to 5 seconds, and at 1,000,000 rows 17 seconds. So the time grew much less than the row count. A possible reason is a fixed cost for each run, but three runs per size cannot show that. Neon reports the run's start and end in whole seconds, so the small runs are rough. The time from the API call to a usable branch also includes creating the branch and starting its compute. For our 47.7 MB database it was 18.9 seconds for round 1. It was 47.7 seconds for round 3, which rewrote six tables. A [Neon blog post](https://neon.com/blog/branching-environments-anonymized-pii) from November 2025 notes that static masking adds storage for the rewritten rows. We did not measure storage.

## What we could not conclude

- **One schema and data we wrote.** The scanner found everything we planted, in the formats we chose to plant. Real free text has misspellings, nicknames, names in other scripts and formats we did not think of. On real data, its recall will be lower, and we cannot say by how much.
- **Names of people who are not users are invisible.** The scanner finds a name only when it is the full name of a user. In our data that left 5,985 names it could not see by design: gift recipients, colleagues, accountants. If your free text names third parties, a pass from this scanner does not mean the text is clean.
- **The table order is observed, not documented.** In two runs with different rule orders, Neon masked `users` first and `audit_log` after it. With a different schema the order may be different, and then the trigger's copies would stay unmasked.
- **Small sizes and one region.** One project in `aws-eu-central-1`, PostgreSQL 18, tables up to 1,000,000 rows, three runs per size.
- **The GitHub workflow is an example.** It is written from the same steps the scripts ran, but we did not run it in GitHub Actions.
- **Static masking only.** The same Neon blog post says dynamic masking is planned. We tested what is available now.

## Summary

Anonymized branches did what they promise for every column we named. The leaks were all in our schema: copies made at checkout, free text, JSON payloads, a trigger, a new table from a migration. A rules file cannot list what nobody knows is there, so treat the masked branch the way you treat a build: test it before anyone gets a connection string.

What to do:

1. Write rules for the obvious columns, then scan the masked branch to find the copies.
2. Mask audit and history tables in the same rule set, and check row counts after the run.
3. Replace JSON columns that hold PII. We found no rule that edits JSON in place.
4. Decide what to do with free text. `regexp_replace` removes emails and phone numbers, not names.
5. Use Random Unique Email (or a value derived from the primary key) for unique email columns, and keep fake emails on `example.com`.
6. Gate on the scan, wait for the masking run before you connect, and make previews only from a template that passed. Do not give the template an expiry.

Run it against your own project:

<!-- TODO(repo-url): confirm the clone URL once the repository exists. -->

```bash
git clone https://github.com/The-DevOps-Daily/neon-anonymized-branches
cd neon-anonymized-branches && cp .env.example .env   # add a Neon API key
npm install && npm run setup && npm run seed
node scripts/02-template.mjs --rules rules/v1-obvious.json --name template-v1
npm run scan -- --target template-v1 --known main
```
