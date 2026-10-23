---
title: 'STRIDE: Threat Categories with Examples and Mitigations'
description: 'The six STRIDE threat categories with examples and mitigations, applied to a data flow diagram with trust boundaries for a ticket shop with payments.'
order: 1
---

**TLDR**: STRIDE is a checklist of six kinds of threat: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service and **E**levation of privilege. Each one breaks a security property (authentication, integrity, non-repudiation, confidentiality, availability, authorization). You draw a data flow diagram of your system, mark the trust boundaries, then walk each element and each flow that crosses a boundary and ask the six questions. The output is a list of concrete threats with mitigations, not a score.

STRIDE was created at Microsoft by Loren Kohnfelder and Praerit Garg in a 1999 internal paper, "The Threats to Our Products", and it is still the most common way to answer the second question of threat modeling: **what can go wrong?** It works because it turns a vague question ("is this secure?") into six specific ones that you can ask about every part of a design.

In this part you apply STRIDE to the example system used throughout this guide, a small ticket shop that takes payments through a third-party provider. You get a threat list you can reuse: the same threats are scored in [Part 2](/guides/threat-modeling/02-dread) and combined into attack paths in [Part 3](/guides/threat-modeling/03-attack-trees).

## Prerequisites

- You know how a web application talks to a database and to other services over HTTP.
- You know the common web vulnerabilities by name (SQL injection, cross-site scripting). The [OWASP Top 10 guide](/guides/owasp-top-10) covers them.
- A whiteboard, a diagram tool or a sheet of paper. Threat modeling needs no special software.

## The Six Threat Categories

| Threat                     | Property it breaks | Question to ask                                            | Typical mitigations                                                 |
| -------------------------- | ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| **S**poofing               | Authentication     | Can someone pretend to be another user or system?          | Strong authentication, MFA, signed requests, mutual TLS             |
| **T**ampering              | Integrity          | Can someone change data, code or messages they should not? | Server-side validation, signatures and MACs, TLS, access control    |
| **R**epudiation            | Non-repudiation    | Can someone deny an action, and can you prove otherwise?   | Audit logs that the actor cannot edit, signed records               |
| **I**nformation disclosure | Confidentiality    | Can data reach someone who should not see it?              | Authorization checks, encryption, minimal responses, secret storage |
| **D**enial of service      | Availability       | Can someone stop legitimate users from using it?           | Rate limits, quotas, timeouts, capacity, queueing                   |
| **E**levation of privilege | Authorization      | Can someone do more than they are allowed to?              | Deny-by-default authorization, least privilege, input handling      |

Two tips before you start:

- **Do not argue about categories.** A forged admin session is spoofing, and it also leads to elevation of privilege. The categories overlap: David LeBlanc, who documented STRIDE with Michael Howard in _Writing Secure Code_, [wrote](https://learn.microsoft.com/en-us/archive/blogs/david_leblanc/dreadful) that it is not a rigorous classification but helps focus the discussion. Pick one category, write the threat down and move on.
- **Write threats as sentences with an actor, an action and an impact.** "A customer changes the price in the order request and pays less" is useful. "Tampering risk on the API" is not.

## The Example System: a Ticket Shop

Every part of this guide models the same system, so the threats, scores and attack trees refer to the same components. The ticket shop sells tickets for live events:

1. A customer signs in, picks tickets and creates an order. The API saves the order as `pending` and holds the seats for 10 minutes.
2. The API creates a checkout session at the payment provider with the order ID and the total, and redirects the customer to the provider's hosted checkout page. Card details go to the provider and never reach the shop.
3. When the payment succeeds, the provider redirects the customer back to `/checkout/success` and, separately, sends a signed `payment.succeeded` webhook to `/webhooks/payments`.
4. The API checks the webhook, marks the order `paid` and pushes an `issue-tickets` job to the job queue.
5. The worker takes the job, creates the tickets with QR codes and marks the order `fulfilled`. The customer sees the tickets under "My tickets".

Staff admins use pages under `/admin` in the same app to create events, issue refunds and give away complimentary ("comp") tickets. The API is a Python web app in containers behind a load balancer. Postgres, the job queue (Redis) and the worker run in a private network with no inbound Internet access. Email and the marketing site are out of scope for this model.

### The Data Flow Diagram

A **data flow diagram (DFD)** is the usual way to answer "what are we working on?". It needs only four kinds of element:

- **External entities**: people and systems you do not control (customer, staff admin, payment provider).
- **Processes**: code you run (API, worker).
- **Data stores**: places data rests (Postgres, the job queue).
- **Data flows**: data moving between the others, numbered so you can refer to them (DF1 to DF8).

Node colors show the trust zone: red is the Internet, amber is the third party, blue is the public app tier and violet is the private network. The payment provider appears twice, once as the sender of webhooks and once as the API you call, so that each arrow can point one way. Hover or tap a node for details.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "customer", "label": "Customer", "sub": "browser or app", "icon": "globe", "tone": "red", "detail": "External entity on the Internet. Signs in, orders, pays on the provider's hosted page and downloads tickets." },
      { "id": "admin", "label": "Staff admin", "sub": "browser", "icon": "globe", "tone": "red", "detail": "External entity on the Internet. Creates events, issues refunds and comp tickets under /admin." },
      { "id": "hook", "label": "Payment provider", "sub": "sends webhooks", "icon": "cloud", "tone": "amber", "detail": "Third party. Sends a signed payment.succeeded webhook when a payment succeeds." }
    ],
    [
      { "id": "api", "label": "API", "sub": "web app + JSON API", "icon": "server", "tone": "blue", "detail": "Process in the public app tier. Holds the provider's secret API key and the webhook signing secret." }
    ],
    [
      { "id": "db", "label": "Postgres", "sub": "users, orders, tickets", "icon": "database", "tone": "violet", "detail": "Data store in the private network. Customer emails, password hashes, orders and ticket QR secrets." },
      { "id": "queue", "label": "Job queue", "sub": "Redis", "icon": "queue", "tone": "violet", "detail": "Data store in the private network. Holds issue-tickets jobs until the worker takes them." },
      { "id": "pay", "label": "Payment provider", "sub": "checkout + refunds API", "icon": "cloud", "tone": "amber", "detail": "Third party. The API creates checkout sessions and refunds here with a secret API key." }
    ],
    [
      { "id": "worker", "label": "Worker", "sub": "issues tickets", "icon": "gear", "tone": "violet", "detail": "Process in the private network. Takes jobs from the queue, creates tickets, marks orders fulfilled." }
    ]
  ],
  "edges": [
    ["customer", "api", "DF1 orders"],
    ["admin", "api", "DF2 admin"],
    ["hook", "api", "DF4 webhook"],
    ["api", "db", "DF5 SQL"],
    ["api", "queue", "DF6 job"],
    ["api", "pay", "DF3 checkout"],
    ["queue", "worker", "DF7 job"],
    ["worker", "db", "DF8 tickets"]
  ]
}
```

| Flow | From → to              | What moves                                             | Crosses a trust boundary |
| ---- | ---------------------- | ------------------------------------------------------ | ------------------------ |
| DF1  | Customer → API         | Sign-in, orders, ticket pages, session cookie (HTTPS)  | TB1, Internet            |
| DF2  | Staff admin → API      | Event changes, refunds, comp tickets (HTTPS)           | TB1, Internet            |
| DF3  | API → payment provider | Checkout sessions and refunds, with the secret API key | TB2, third party         |
| DF4  | Payment provider → API | `payment.succeeded` webhook, signed by the provider    | TB2, third party         |
| DF5  | API → Postgres         | Users, orders, seat holds (SQL)                        | TB3, private network     |
| DF6  | API → job queue        | `issue-tickets` job with an order ID                   | TB3, private network     |
| DF7  | Job queue → worker     | The job                                                | No                       |
| DF8  | Worker → Postgres      | Tickets and order status                               | No                       |

Arrows show the direction the main data moves, and replies are implied. For DF7 that is not the direction of the connection: the worker connects to Redis and pulls the job, but the job moves from the queue to the worker.

### Trust Boundaries

A **trust boundary** is a line where the level of trust changes: data that crosses it comes from someone with different privileges, so it must be checked on arrival. The ticket shop has three:

- **TB1, Internet to the app.** Anything from a browser can be forged, replayed or changed. This includes hidden form fields, prices, IDs and cookies.
- **TB2, the shop and the payment provider.** You trust the provider, but you must prove that a webhook really comes from it, and the provider must be able to trust your API calls.
- **TB3, the public app tier and the private network.** The database and the queue are not reachable from the Internet, but code in the app tier can be compromised. "It is on the private network" is not authentication.

Most serious threats sit on flows that cross a boundary, so that is where you spend most of the session.

## Applying STRIDE in Practice

### STRIDE per Element

Not every category applies to every element. This table, from Microsoft's Security Development Lifecycle and Adam Shostack's book _Threat Modeling: Designing for Security_, tells you which questions to ask where:

| Element         | S   | T   | R                | I   | D   | E   |
| --------------- | --- | --- | ---------------- | --- | --- | --- |
| External entity | Yes |     | Yes              |     |     |     |
| Process         | Yes | Yes | Yes              | Yes | Yes | Yes |
| Data store      |     | Yes | If it holds logs | Yes | Yes |     |
| Data flow       |     | Yes |                  | Yes | Yes |     |

Processes get all six questions. Data stores and flows get tampering, disclosure and denial of service. External entities get spoofing ("is this really the provider?") and repudiation ("can the customer deny this order?"). A data store that holds audit logs gets the repudiation question as well, because tampering with logs destroys evidence.

### STRIDE per Interaction

A variant that finds the same threats with less repetition: for each data flow that crosses a trust boundary, ask the six questions about the sender, the flow and the receiver together. For the ticket shop that means four flows (DF1 to DF4) on the edge, plus DF5 and DF6 into the private network. Use whichever variant your team finds easier to keep going for an hour.

### Running the Session

- Timebox it: 60 to 90 minutes for a system of this size, with the people who build and run it.
- Put the DFD on the screen and walk it element by element. One person writes threats down as sentences.
- Do not fix things in the meeting. Record the threat and the obvious mitigation, then move on.

The sections below show what that walk produces for the ticket shop, one category at a time. The threat IDs (S1, T1 and so on) are used again in the later parts.

## Spoofing

Spoofing is pretending to be someone or something else: another user, a staff member, or a system such as the payment provider. It breaks **authentication**.

### Spoofing threats in the ticket shop

- **S1, forged payment confirmation (DF4).** An attacker sends their own `payment.succeeded` event to `/webhooks/payments`. If the API does not check that the provider sent it, unpaid orders get tickets. The same threat appears in a second form: the API marks the order paid when the customer lands on `/checkout/success`, a URL anyone can open without paying.
- **S2, customer account takeover (DF1).** Credential stuffing with passwords leaked from other sites. The attacker signs in as the customer and downloads their tickets before the event.
- **S3, phished staff admin (DF2).** An attacker phishes a staff admin's password and one-time code, then issues comp tickets and refunds.

### Mitigations for spoofing

For S1, fulfill orders only from a payment the server has verified, never from the browser redirect. Many providers sign each webhook with an HMAC of a timestamp and the raw request body, as Stripe's `Stripe-Signature` header does; others sign selected fields or use certificates, and rotation works differently from one provider to the next. In production, use your provider's SDK to check it. This sketch shows what a Stripe-style check does:

```python
import hashlib
import hmac
import time

TOLERANCE_SECONDS = 300  # reject events signed more than 5 minutes ago


def verify_signature(raw_body: bytes, header: str, secret: bytes) -> bool:
    """Check a header like 't=1761210000,v1=5f2b...' against the raw request body."""
    try:
        pairs = [item.split("=", 1) for item in header.split(",")]
        timestamp = int(next(value for key, value in pairs if key == "t"))
        signatures = [value.encode() for key, value in pairs if key == "v1"]
        too_old = abs(time.time() - timestamp) > TOLERANCE_SECONDS
    except (ValueError, StopIteration, OverflowError):
        return False  # malformed header
    if too_old:
        return False
    signed_payload = f"{timestamp}.".encode() + raw_body
    expected = hmac.new(secret, signed_payload, hashlib.sha256).hexdigest().encode()
    return any(hmac.compare_digest(expected, sig) for sig in signatures)
```

The timestamp check stops an attacker from replaying an old event they captured, and `hmac.compare_digest` compares in constant time; comparing bytes means a malformed header returns `False` instead of raising an error. Several `v1` values are allowed because providers send two signatures while you rotate the secret. The webhook handler then refuses anything that does not match the order:

```python
@app.post("/webhooks/payments")
def payment_webhook():
    raw_body = request.get_data()  # the exact bytes the provider signed
    if not verify_signature(raw_body, request.headers.get("Payment-Signature", ""), WEBHOOK_SECRET):
        abort(400)
    event = json.loads(raw_body)
    if event["type"] != "payment.succeeded" or already_processed(event["id"]):
        return "", 204  # providers retry; handle each event once
    order = db.session.get(Order, event["order_id"])
    if order is None or (event["amount"], event["currency"]) != (order.total_cents, order.currency):
        flag_for_review(event)
        return "", 204
    mark_paid(order, event["id"])  # one Postgres transaction: status, event ID, outbox row
    return "", 204
```

`mark_paid` writes the new status, the event ID and an `issue-tickets` row in an `outbox` table in one Postgres transaction, and a relay in the API pushes outbox rows to the queue and marks them sent. Postgres and Redis cannot share a transaction, and this **transactional outbox** keeps a crash between the two writes from leaving a paid order without tickets.

`/checkout/success` only shows "payment processing" and polls the order status. For S2 and S3:

- Rate-limit sign-in per account and per IP, and reject passwords that appear in breach lists.
- Offer passkeys or MFA to customers, and require **phishing-resistant** MFA (passkeys or security keys) for staff. Codes sent by SMS or typed from an app can be phished in real time.
- Put admin pages behind your company SSO, ask for a fresh sign-in before refunds, and alert on sign-ins from new devices.
- Give session cookies the `Secure`, `HttpOnly` and `SameSite` attributes, rotate the session ID at sign-in and expire idle sessions.

## Tampering

Tampering is changing data, code or messages without permission: in a request, in transit, in a queue or at rest. It breaks **integrity**.

### Tampering threats in the ticket shop

- **T1, price tampering (DF1).** The order request contains the ticket price, and the customer edits it in the browser's developer tools to pay 1 euro for a 120 euro ticket.
- **T2, forged jobs (DF6, DF7).** Anything that can reach Redis on the private network can push an `issue-tickets` job for an unpaid order, and the worker issues tickets because it trusts every job.
- **T3, discount code race (DF1, DF5).** A single-use discount code is checked and then marked as used in two separate steps. Twenty parallel requests all pass the check before any of them marks it.

### Mitigations for tampering

For T1, the server computes every amount from its own data. The client sends only what the customer chose:

```python
@app.post("/api/orders")
@login_required
def create_order():
    data = request.get_json()
    ticket_type = db.session.get(TicketType, data["ticket_type_id"])
    quantity = int(data["quantity"])
    if ticket_type is None or not 1 <= quantity <= 6:
        abort(400)
    total_cents = ticket_type.price_cents * quantity  # never a price from the client
    order = create_pending_order(current_user, ticket_type, quantity, total_cents)
    return {"order_id": order.id, "checkout_url": create_checkout(order)}, 201
```

The webhook handler in the previous section compares the amount and currency paid with the order, so a checkout session created with the wrong amount is caught as well.

For T2, do not let a message decide what is true. Require TLS on Redis and give the API and the worker separate Redis users with access control lists (ACLs), so only the API can push jobs. Then have the worker re-read the order and check `status = 'paid'` before it issues anything, in one transaction that locks the order row (`SELECT ... FOR UPDATE`), inserts the tickets and marks the order `fulfilled`. The outbox can deliver a job twice, for example when the relay crashes after pushing a job but before marking it sent, so this check is also what makes a duplicate job harmless; a unique constraint on the tickets of an order is a second safety net. The job then carries only an ID, and the database stays the source of truth.

For T3, make the check and the update one atomic statement, so the database decides who wins:

```sql
UPDATE discount_codes
SET redeemed_by_order = $1, redeemed_at = now()
WHERE code = $2 AND redeemed_by_order IS NULL
RETURNING id;
```

If no row comes back, the code was already used. Other mitigations for tampering: TLS on every flow, including DF5 to DF8 inside the private network, and signed container images and protected branches so code cannot be changed on its way to production (the [CI/CD pipeline hardening guide](/posts/cicd-pipeline-hardening-guide) covers that path).

## Repudiation

Repudiation is denying that you did something when the system cannot prove otherwise. It breaks **non-repudiation**, and it is the category teams most often skip, because nothing visibly breaks until someone asks "who did this?".

### Repudiation threats in the ticket shop

- **R1, unrecorded admin actions (DF2).** A staff admin refunds 40 orders to friends' cards or gives away comp tickets, then says they did not. The app has no record of who clicked what, or everyone shares one `admin` account.
- **R2, disputed purchases (DF1, DF4).** A customer tells their bank "I never bought these tickets" after attending the event. Without evidence the shop loses the chargeback.

### Mitigations for repudiation

- Give every staff member a named account. Shared logins make any audit log useless.
- Write an audit event for every security-relevant action: who, what, which object, when, from where, and a request ID that ties it to the application logs.
- Store audit events where the actor cannot change them: an append-only table that the app role can only `INSERT` into, or a log service outside the app's account. Alert when logging stops.
- For R2, keep the evidence a dispute needs: the order, the provider's payment and event IDs, sign-in and device history, and the ticket scan record at the venue.

```python
def audit(action: str, target: str, **details):
    audit_log.insert(
        time=datetime.now(timezone.utc),  # not datetime.utcnow(), deprecated since Python 3.12
        actor=current_user.staff_id,
        action=action,
        target=target,
        ip=request.remote_addr,
        request_id=g.request_id,
        details=details,
    )


audit("refund.create", f"order:{order.id}", amount_cents=order.total_cents, reason=form.reason.data)
```

An audit event written this way looks like the following example:

```json
{
  "time": "2026-10-23T14:02:11Z",
  "actor": "staff:4821",
  "action": "refund.create",
  "target": "order:1042",
  "ip": "203.0.113.24",
  "request_id": "7f3c9a1e",
  "details": { "amount_cents": 12000, "reason": "event canceled" }
}
```

Logs need care in the other direction too: never write passwords, session tokens, full card numbers or webhook secrets into them. The [logging and monitoring failures part](/guides/owasp-top-10/09-logging-failures) of the OWASP guide covers what to record.

## Information Disclosure

Information disclosure is data reaching someone who should not see it. It breaks **confidentiality**. In the ticket shop, a ticket's QR code is not only personal data: it gets someone into the venue.

### Information disclosure threats in the ticket shop

- **I1, insecure direct object reference (DF1).** `GET /api/orders/1042` returns any order to any signed-in user, with names, emails and QR codes. Order IDs are sequential, so an attacker walks from 1 to 50,000.
- **I2, leaked secrets.** The provider's secret API key or the webhook signing secret ends up in the Git repository, a log line or an error page. With the API key an attacker can issue refunds; with the signing secret they can forge webhooks (S1 again).
- **I3, exposed backups (Postgres).** Database snapshots are copied to a storage bucket that more people, or the whole Internet, can read.

### Mitigations for information disclosure

For I1, check ownership in the query itself, so a missing check cannot slip through:

```python
@app.get("/api/orders/<int:order_id>")
@login_required
def get_order(order_id):
    order = db.session.scalars(
        select(Order).where(Order.id == order_id, Order.customer_id == current_user.id)
    ).first()
    if order is None:
        abort(404)  # same answer for "not yours" and "does not exist"
    return order.to_dict()
```

Random, non-sequential IDs make enumeration harder, but they are defense in depth, not access control. Add a test that requests another customer's order and expects a 404.

For I2 and I3:

- Keep secrets in a secrets manager and inject them at runtime; scan commits and pull requests for secrets. The [secrets management guide](/posts/secrets-management-guide) compares the options.
- Use a restricted provider key that can only create checkout sessions and refunds, and have a written plan for rotating every secret.
- Encrypt backups, restrict who can read them, and never load production data into development or test environments.
- Return generic errors to clients and keep stack traces in the server logs.

## Denial of Service

Denial of service is stopping legitimate users from using the system. It breaks **availability**. For a ticket shop the most damaging version is not a flood of packets: it is a few bots using the shop's own rules against it during an on-sale.

### Denial of service threats in the ticket shop

- **D1, ticket hoarding (DF1, DF5).** When a popular event goes on sale, bots create thousands of orders and hold every seat for 10 minutes without paying, again and again. Real fans see "sold out".
- **D2, on-sale overload (DF1, DF5).** The traffic spike, or a deliberate flood of expensive requests such as search, uses up the API's workers and Postgres connections, and the shop goes down at the moment it matters most.

### Mitigations for denial of service

- Limit holds: at most 6 tickets per order and 2 open orders per account, holds that expire after 10 minutes, and a check on the payment card as well as the account.
- For high-demand events, put a waiting room or bot check in front of the on-sale.
- Rate-limit per IP and per account, with stricter limits on expensive endpoints. The [rate limiting design post](/posts/designing-rate-limiting-for-apis) explains the algorithms.
- Serve event pages from a CDN cache, use a connection pooler in front of Postgres and set timeouts on every call.
- Load-test before big on-sales, and make sure the worker and queue can absorb a backlog.

Code-level denial of service exists as well: a regular expression with nested quantifiers such as `^([a-z0-9]+)+@` can take exponential time on crafted input, and an unbounded upload can fill a disk. Limit input sizes and test the patterns you use.

## Elevation of Privilege

Elevation of privilege is gaining capabilities you should not have: a customer acting as an admin, or a bug that turns a read into full database control. It breaks **authorization**.

### Elevation of privilege threats in the ticket shop

- **E1, unprotected admin route (DF1).** The admin pages are checked one by one, and a new `/admin/comp-tickets` endpoint ships without the role check. Any signed-in customer can call it.
- **E2, SQL injection (DF5).** The event search builds its SQL with string formatting. An attacker reads the users table or marks their own order as paid, and if the API connects as the database owner, can drop tables too.

### Mitigations for elevation of privilege

For E1, make access denied by default for the whole admin area, so a new route is protected without anyone remembering:

```python
admin = Blueprint("admin", __name__, url_prefix="/admin")


@admin.before_request
def require_staff():
    if not current_user.is_authenticated or not current_user.is_staff:
        abort(404)  # do not reveal that the admin area exists
```

Add a test that calls every route under `/admin` as a customer and expects a 404.

For E2, use parameterized queries everywhere and run SAST in CI (the [SAST guide](/guides/sast-tools) shows how). Then limit the damage of the bug you have not found yet: the API and the worker each connect with a role that can only do what that service needs.

```sql
CREATE ROLE shop_api LOGIN;
GRANT SELECT, INSERT, UPDATE ON users, orders, order_items, events, ticket_types, discount_codes, outbox TO shop_api;
GRANT SELECT, UPDATE (status) ON tickets TO shop_api;  -- show QR codes, void tickets on refund
GRANT INSERT ON audit_log TO shop_api;                 -- append only: no UPDATE or DELETE

CREATE ROLE shop_worker LOGIN;
GRANT SELECT, UPDATE (status) ON orders TO shop_worker;  -- re-check payment, mark fulfilled
GRANT INSERT ON tickets TO shop_worker;                  -- only the worker creates tickets
```

With these grants, a SQL injection in the API cannot insert ticket rows directly, change the audit log, delete orders or change the schema, because the role owns no tables. It can still fake a paid order and its outbox row, so the worker would issue tickets ([Part 3](/guides/threat-modeling/03-attack-trees) counts this as an 8-hour attack); parameterized queries remain the main fix. The tables use identity columns, so no sequence grants are needed; with `serial` columns, also grant `USAGE` on their sequences. The same idea applies to the containers (no root, read-only file system) and the cloud permissions of each service. The [least privilege part](/guides/security-principles/03-least-privilege) of the security principles guide goes further.

## The Threat Register

The output of a STRIDE session is a list like this one, kept next to the code and updated when the design changes. "Open" means a mitigation is agreed but not yet in place.

| ID  | Element or flow  | Threat                                                        | Mitigation                                                      | Status |
| --- | ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------- | ------ |
| S1  | DF4, API         | Forged webhook or success URL marks an unpaid order as paid   | Verify signatures; fulfill only verified payments; check amount | Open   |
| S2  | DF1, customer    | Account takeover by credential stuffing                       | Rate limits, breached-password check, passkeys or MFA           | Open   |
| S3  | DF2, staff admin | Phished admin issues comp tickets and refunds                 | SSO with phishing-resistant MFA, fresh sign-in for refunds      | Open   |
| T1  | DF1, API         | Customer changes the price in the order request               | Server-side totals; compare paid amount with the order          | Open   |
| T2  | DF6, DF7, worker | Forged `issue-tickets` jobs for unpaid orders                 | Queue auth and TLS; worker re-checks the order status           | Open   |
| T3  | DF1, Postgres    | Single-use discount code redeemed many times in parallel      | Atomic conditional update                                       | Open   |
| R1  | DF2, API         | Admin denies refunds or comp tickets they issued              | Named accounts, append-only audit log                           | Open   |
| R2  | DF1, DF4         | Customer disputes a purchase they made                        | Keep order, payment, sign-in and scan evidence                  | Open   |
| I1  | DF1, API         | Any user reads any order and its QR codes                     | Ownership check in every query; tests                           | Open   |
| I2  | API, config      | Provider API key or webhook secret leaks                      | Secrets manager, restricted keys, secret scanning, rotation     | Open   |
| I3  | Postgres         | Database backups readable by too many people                  | Encrypted, access-controlled backups; no production data in dev | Open   |
| D1  | DF1, DF5         | Bots hold every seat during an on-sale                        | Hold limits, short expiry, waiting room or bot check            | Open   |
| D2  | DF1, DF5         | On-sale traffic exhausts API workers and database connections | Rate limits, CDN cache, connection pooling, load tests          | Open   |
| E1  | DF1, API         | Customer calls an admin endpoint without a role check         | Deny-by-default admin area; tests for every route               | Open   |
| E2  | DF5, Postgres    | SQL injection reads or changes any table                      | Parameterized queries, SAST, least-privilege database role      | Open   |

Fifteen threats from one diagram and an hour of questions. [Part 2](/guides/threat-modeling/02-dread) decides which ones to fix first.

## Beyond STRIDE: Privacy with LINDDUN

STRIDE is about security. A system can be secure and still bad for privacy: it collects too much, links data it should keep apart, or gives people no control. **LINDDUN**, from KU Leuven, is the privacy counterpart and is used the same way, per element of a DFD. Its [seven threat types](https://linddun.org/threat-types/) applied to the ticket shop:

| LINDDUN category                  | Question                                                            | Ticket shop example                                                 |
| --------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Linking                           | Can separate data points be tied to one person?                     | Purchase history across events reveals religion, politics or health |
| Identifying                       | Can someone learn who a person is?                                  | The buyer's full name printed in the QR code payload                |
| Non-repudiation                   | Is there evidence a person cannot deny when they should be able to? | Permanent records of who attended a sensitive event                 |
| Detecting                         | Can someone infer involvement from observable traces?               | "This email already has an account" on sign-up                      |
| Data disclosure                   | Is more personal data collected, stored or shared than needed?      | Storing date of birth when no event has an age limit                |
| Unawareness and unintervenability | Are people informed and able to control their data?                 | No way to delete an account or download your data                   |
| Non-compliance                    | Does handling of personal data fall short of laws or standards?     | Keeping orders forever with no retention policy                     |

Note that non-repudiation is a goal in STRIDE and a threat in LINDDUN. Both are right: the shop needs proof of staff actions (R1), while customers may need deniability about which events they attended. Writing both down makes the trade-off visible.

Features built on large language models need their own questions as well, such as prompt injection and an assistant that can do too much. [Part 4](/guides/threat-modeling/04-practical-exercises) models an AI support assistant for the ticket shop using the OWASP Top 10 for LLM Applications.

## Common Mistakes

- **Starting from a list of attacks instead of a diagram.** Without a DFD you only find the threats you already know about, and you miss the flows nobody drew, such as the webhook.
- **Treating the private network as trusted.** T2 needs only a foothold inside the network, and E2 reaches the database through the API's own trusted connection. Authenticate and authorize inside the network too, and limit what each connection can do.
- **Stopping at generic threats.** "SQL injection" applies to every system; "bots hold every seat during an on-sale" is specific to this one, and specific threats are where the value is.
- **Leaving out repudiation.** Ask "how would we prove who did this?" for every admin action and money movement.
- **Writing threats nobody owns.** Each line in the register needs a mitigation, an owner and a status, or it is forgotten after the meeting.

## Summary

- STRIDE is six questions: spoofing (authentication), tampering (integrity), repudiation (non-repudiation), information disclosure (confidentiality), denial of service (availability) and elevation of privilege (authorization).
- Start with a data flow diagram and mark the trust boundaries. Most threats sit on flows that cross them.
- Use STRIDE per element or per interaction to decide which questions to ask where.
- Write each threat as a sentence with an actor, an action and an impact, and record a mitigation for it.
- Add LINDDUN when personal data is involved, and LLM-specific questions for AI features.

In [Part 2](/guides/threat-modeling/02-dread), you score these threats with DREAD, see why Microsoft stopped using it, and compare it with the methods teams use today.

## Keep Learning

- [What It Actually Takes to Deliver a Webhook in Production](/posts/reliable-webhook-delivery-retries-signatures-idempotency), for signatures and retries from the sender's side
- [How Stripe Avoids Double-Charging Anyone](/posts/how-stripe-avoids-double-charging-idempotency-keys), on idempotency keys for payments
- [Insecure design in the OWASP Top 10 guide](/guides/owasp-top-10/04-insecure-design)
- [Broken access control in the OWASP Top 10 guide](/guides/owasp-top-10/01-broken-access-control), for more on I1 and E1
- [The CIA triad](/guides/security-principles/01-cia-triad), the properties behind the STRIDE categories
- [Interview question: security architecture and DevSecOps](/interview-questions/senior/security-architecture)
