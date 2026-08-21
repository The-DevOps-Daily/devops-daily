---
title: 'Adding SAML and SCIM Before It Costs You a Deal'
excerpt: 'What actually changes in your application when an enterprise buyer asks for SSO and directory sync, in the order you should build it, including the validation steps that turn SAML into an authentication bypass if you skip them.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-08-08'
publishedAt: '2026-08-08T09:00:00Z'
updatedAt: '2026-08-08T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Security
  - SAML
  - SCIM
  - SSO
  - Identity
  - OAuth
  - Authentication
  - DevOps
---

The request never arrives early. It arrives in a security questionnaire, two weeks before a contract is meant to be signed, phrased as a single line: *does your product support SAML SSO and SCIM provisioning?*

If the answer is no, one of two things happens. You say "it's on the roadmap" and watch the deal slip a quarter, or somebody promises a date and the work lands on you with a deadline attached and no design time. Both are avoidable, because the expensive part of this work is not the protocol. It is a data model change, and you can make that change long before anyone asks.

This covers what enterprise buyers actually mean, what has to change in your application, the validation steps that turn a SAML integration into an authentication bypass if you skip them, and the order to build it in.

## TL;DR

- SSO and provisioning are different problems. **SAML** answers "is this person who they say they are". **SCIM** answers "who should exist in the first place, and who should stop existing".
- The hard part is neither protocol. It is that your app probably assumes a user owns their own account. Enterprise means **the organisation owns the account**, and that is a schema change.
- Build the organisation and connection model first. It is useful on its own and it is the thing you cannot retrofit under deadline pressure.
- SAML is XML with a signature. Validating that signature is necessary and **not sufficient**. You must also check Audience, Destination, InResponseTo, the time window, and that the assertion you read is the assertion that was signed.
- A whole class of 2018 CVEs existed because libraries read the text of a signed XML node differently to the way the signature covered it. An XML comment inside `NameID` was enough to log in as somebody else.
- SCIM is a boring REST API you host. The part everyone gets wrong is deprovisioning: `PATCH` with `active: false` must actually kill sessions, not just flip a column.
- Roles are the trap. Sync group membership, but keep your own authorisation model. Do not let the IdP be the source of truth for permissions you enforce.

## Prerequisites

- An application with its own user accounts and sessions
- Familiarity with HTTP redirects, form POSTs, and JSON APIs
- Access to an identity provider test tenant. Okta and Microsoft Entra ID both offer free developer tenants, and you will want one before writing any code

## What they are actually asking for

"SSO" in a procurement document usually bundles three separate things. Being precise about which one is being asked for saves a lot of argument later.

**Authentication.** The user lands on your login page, types a work email, and gets bounced to their company's identity provider. They come back authenticated. No password of yours involved. This is SAML, or increasingly OIDC.

**Provisioning and deprovisioning.** When IT adds someone to the "Acme Engineering" group, an account appears in your product without anyone inviting them. When that person leaves, the account is disabled within minutes. This is SCIM, and it is the one people underestimate.

**Central policy.** MFA, session lifetime, device posture, conditional access. You get this largely for free by delegating authentication, which is a genuinely good reason to support SSO beyond the contract.

The second is where the value is for the buyer. An IT admin who has to remember to log into fourteen SaaS dashboards to remove a departing employee will eventually forget one, and that forgotten account is an audit finding.

```diagram
{
  "type": "flow",
  "title": "The two halves, and why they are separate",
  "nodes": [
    { "label": "IT adds user to a group", "sub": "in Okta or Entra ID, not in your app", "icon": "gear" },
    { "label": "SCIM POST /Users", "sub": "your API creates the account ahead of first login", "icon": "database" },
    { "label": "User visits your app", "sub": "types work email, never sets a password", "icon": "globe" },
    { "label": "SAML round trip", "sub": "IdP asserts who they are, you match to the existing account", "icon": "lock" },
    { "label": "Employee leaves", "sub": "SCIM PATCH active:false, sessions revoked", "icon": "shield" }
  ]
}
```

Note what happens if you build only SAML. The account gets created on first login instead, which sounds fine until someone leaves: the IdP stops letting them log in, but your app still holds an active session and an enabled account. The buyer asked for deprovisioning and you gave them a login page.

## The change that has to come first

Here is the part worth internalising, because it is the only part that is genuinely hard to retrofit.

Most products start with a user model that looks roughly like this:

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY,
  email         text UNIQUE NOT NULL,
  password_hash text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

The account belongs to the person. They chose the email, they chose the password, they can change both, and they can delete the account. Every enterprise requirement contradicts that. The account belongs to the company. The company decides the email, forbids the password, and revokes the account without asking.

So the model has to grow an organisation, and a way to route someone to the right identity provider:

```sql
CREATE TABLE organizations (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One configured identity provider for an organisation. A large customer may
-- have more than one, so this is deliberately not a column on organizations.
CREATE TABLE sso_connections (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  protocol        text NOT NULL CHECK (protocol IN ('saml', 'oidc')),
  -- SAML: the IdP's entity ID, SSO URL and signing certificate
  idp_entity_id   text,
  idp_sso_url     text,
  idp_certificate text,
  enabled         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Which email domains route to which organisation. This is what turns
-- "alice@acme.com" on your login form into "send her to Acme's Okta".
CREATE TABLE organization_domains (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  domain          text NOT NULL UNIQUE,
  verified_at     timestamptz,
  PRIMARY KEY (organization_id, domain)
);

ALTER TABLE users
  ADD COLUMN organization_id uuid REFERENCES organizations(id),
  -- The IdP's stable identifier for this person. Not the email.
  ADD COLUMN external_id     text,
  ADD COLUMN sso_connection_id uuid REFERENCES sso_connections(id);

-- Two people at different companies can share an email in theory; in practice
-- the important constraint is that an IdP's ID is unique within its connection.
CREATE UNIQUE INDEX users_connection_external_id
  ON users (sso_connection_id, external_id)
  WHERE external_id IS NOT NULL;
```

Three details in there matter more than they look.

**`external_id` is not the email.** People change surnames, and IT changes their email address. If you key the account on email, that rename creates a second account and orphans the first. Every IdP sends a stable identifier that survives a rename. Store it and match on it.

**Domain verification is not optional.** `organization_domains` is a routing table that decides which company controls a login. If anyone can claim `gmail.com`, or worse, claim a competitor's domain, you have handed them every future user at that domain. Verify by DNS TXT record before setting `verified_at`, and never route on an unverified row.

**Password login has to become conditional.** Once an organisation has SSO enforced, a user in it must not be able to fall back to a password, or you have added a bypass around all that conditional access the customer bought. That is a change to your login path, your password reset path, and your account recovery path. Finding all three under deadline is how mistakes happen.

:::tip
Everything above is worth building even if no customer has asked for SSO yet. An organisation model gives you team billing, shared workspaces, and audit scoping. It is the sort of change that costs a fortnight when planned and a quarter when urgent.
:::

## SAML, concretely

SAML 2.0 is a 2005 OASIS standard built on XML. It is verbose and unfashionable and it is what enterprise IdPs speak, so here we are.

The flow you want is **SP-initiated**: the user starts at your app, you send them to the IdP, they come back. Your app is the Service Provider (SP), the customer's Okta or Entra ID is the Identity Provider (IdP).

```text
1. Alice hits your login page, types alice@acme.com
2. You look up acme.com in organization_domains -> Acme's connection
3. You build an AuthnRequest, redirect her to the IdP's SSO URL
4. She authenticates there (password, MFA, whatever Acme mandates)
5. IdP POSTs a SAMLResponse to your Assertion Consumer Service URL
6. You validate it, find the user by external_id, create a session
```

Two URLs you will hand the customer's IT admin, so name them properly and never change them:

- **ACS URL** (Assertion Consumer Service), where step 5 POSTs. Something like `https://app.example.com/auth/saml/{connection_id}/acs`
- **SP Entity ID**, a stable identifier for your application. A URL is conventional but it is an identifier, not an endpoint

Put the connection ID in the ACS URL path. The alternative is figuring out which connection a response belongs to by inspecting the response itself, which means parsing untrusted XML before you know which certificate should have signed it.

The response arrives as a base64-encoded XML document in a form POST. Stripped to the parts that matter:

```xml
<samlp:Response Destination="https://app.example.com/auth/saml/abc123/acs"
                InResponseTo="_a1b2c3">
  <saml:Issuer>http://www.okta.com/exk1fake</saml:Issuer>
  <saml:Assertion>
    <ds:Signature>...</ds:Signature>
    <saml:Subject>
      <saml:NameID Format="...emailAddress">alice@acme.com</saml:NameID>
      <saml:SubjectConfirmationData NotOnOrAfter="2026-08-08T09:05:00Z"
                                    Recipient="https://app.example.com/auth/saml/abc123/acs"
                                    InResponseTo="_a1b2c3"/>
    </saml:Subject>
    <saml:Conditions NotBefore="2026-08-08T08:55:00Z"
                     NotOnOrAfter="2026-08-08T09:05:00Z">
      <saml:AudienceRestriction>
        <saml:Audience>https://app.example.com/saml/metadata</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue>alice@acme.com</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="groups">
        <saml:AttributeValue>Engineering</saml:AttributeValue>
        <saml:AttributeValue>Admins</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>
```

## The validation that people skip

This is the section to read twice. A SAML integration that validates the signature and nothing else is not secure, and the failure mode is complete authentication bypass rather than something subtle.

Every one of these must pass:

**The signature is valid, against the certificate you configured for this connection.** Not against a certificate embedded in the response. That sounds obvious written down, and it has been shipped more than once.

**Something is actually signed.** Either the Response or the Assertion must be signed, and you must check *which*. If only the Response is signed and you read attributes from an unsigned Assertion inside it, an attacker rewrites the assertion freely.

**The thing you read is the thing that was signed.** This is the failure mode behind the 2018 CVE cluster, and it deserves its own section below.

**`Audience` matches your SP Entity ID.** Without this, an assertion the customer's IdP issued for a *different* vendor can be replayed at you. Both are legitimate assertions from a trusted IdP; only the audience distinguishes them.

**`Destination` and `Recipient` match your ACS URL.**

**`NotBefore` and `NotOnOrAfter` bracket the current time**, with a small clock skew allowance. Sixty seconds is plenty.

**`InResponseTo` matches a request you issued** and have not already consumed. Store the request ID when you generate the AuthnRequest, delete it on use. This is your replay defence, and it is why unsolicited IdP-initiated login is harder to secure: there is no request to correlate.

**The assertion ID has not been seen before.** Belt and braces on replay, and cheap: a table of consumed IDs with a TTL matching your skew window.

:::warning
Do not write your own SAML implementation. Use a maintained library, and read its documentation for which of the checks above it performs and which it expects you to perform. Several libraries validate the signature and leave audience and time-window checks to the caller. A library that returns you a parsed assertion is not the same as a library that returned you a *trusted* assertion.
:::

## The comment that logged in as someone else

In February 2018, Duo Labs published a vulnerability class affecting many SAML implementations at once, and it is the clearest illustration of why "the signature was valid" is not the end of the story.

XML canonicalization and DOM text extraction disagree about comments. The signature is computed over the canonical form of the node, which includes everything. But some XML APIs, when asked for the text content of a node, return only the first text child and stop at a comment.

So an attacker who legitimately controls the account `john_doe` registers, then inserts a comment into the `NameID` of their own valid, correctly signed assertion:

```xml
<saml:NameID>john<!---->_doe</saml:NameID>
```

The signature still verifies, because the bytes covered by the signature are unchanged in canonical form. But the service provider asks for the text of `NameID`, gets back `john`, and logs the attacker in as a different user entirely.

This affected [multiple independent libraries simultaneously](https://www.kb.cert.org/vuls/id/475445): OneLogin's python-saml (CVE-2017-11427) and ruby-saml (CVE-2017-11428), Clever's saml2-js (CVE-2017-11429), OmniAuth-SAML (CVE-2017-11430), Shibboleth (CVE-2018-0489), and Duo's own Network Gateway (CVE-2018-7340).

The lesson is not "patch those CVEs", they are long fixed. It is that the gap between *what was signed* and *what you read* is a real and non-obvious attack surface, and it is the reason to stay on a maintained library rather than assembling XML handling yourself.

:::note
If you want to see the general shape of a redirect-based auth handshake before wiring up SAML, our [OAuth and OIDC flow simulator](/games/oauth-oidc-flow-simulator) steps through the equivalent exchange interactively. The protocols differ in encoding, but the state, redirect and replay concerns map closely.
:::

## SCIM: the boring half that matters more

SCIM 2.0 is defined by [RFC 7642](https://datatracker.ietf.org/doc/rfc7642/) (use cases), [RFC 7643](https://datatracker.ietf.org/doc/rfc7643/) (core schema) and [RFC 7644](https://datatracker.ietf.org/doc/rfc7644/) (protocol). Unlike SAML, you are the server: the IdP calls your API on a schedule or on change.

You host a handful of endpoints under a base URL, authenticated with a bearer token you generate per connection:

```text
GET    /scim/v2/Users?filter=userName eq "alice@acme.com"
POST   /scim/v2/Users
GET    /scim/v2/Users/{id}
PUT    /scim/v2/Users/{id}
PATCH  /scim/v2/Users/{id}
DELETE /scim/v2/Users/{id}

GET    /scim/v2/Groups
POST   /scim/v2/Groups
PATCH  /scim/v2/Groups/{id}
```

A user resource is JSON with a schema URN:

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "id": "8f4a1c22-...",
  "externalId": "00u1fake",
  "userName": "alice@acme.com",
  "name": { "givenName": "Alice", "familyName": "Ng" },
  "emails": [{ "value": "alice@acme.com", "primary": true }],
  "active": true
}
```

`externalId` is the IdP's identifier. `id` is yours. Return yours in the response body and in a `Location` header; the IdP stores it and uses it for every subsequent call.

Filtering is the part people get caught by. The IdP checks whether a user exists before creating them, using SCIM's own filter grammar:

```text
GET /scim/v2/Users?filter=userName eq "alice@acme.com"
```

You have to parse that. Not all of it, thankfully. In practice Okta and Entra ID send `eq` on `userName` and `externalId` and little else, so a narrow parser that handles the operators you have observed and returns a clear error for anything else beats a general implementation you got subtly wrong. Return a `ListResponse`, with `totalResults: 0` and an empty `Resources` array when there is no match, not a 404.

Updates arrive as `PATCH` with SCIM's own operation format, which resembles JSON Patch but is not it:

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
  "Operations": [
    { "op": "replace", "path": "active", "value": false }
  ]
}
```

Providers vary in exactly how they send these: `path` is sometimes omitted with the value carrying the field, `op` casing differs, and some send `"value": "False"` as a string. Handle the variations you see in testing and log loudly on anything unrecognised, because silently ignoring a `PATCH` you did not understand is how deprovisioning quietly stops working.

## Deprovisioning is a promise, not a column

This is the single most common gap, and it is worth being blunt about because it is the requirement the customer actually cares about.

When someone leaves the company, the IdP sends you `active: false`. Most implementations set a column and return 200. The customer's security team believes access is revoked. It is not, because:

- The user's existing session cookie is still valid until it expires
- Their API tokens still work
- Their OAuth grants to your integrations still work
- If you have a mobile app with a long-lived refresh token, it still refreshes

A correct handler does all of this:

```python
def deactivate_user(user_id: str) -> None:
    with db.transaction():
        db.execute("UPDATE users SET active = false WHERE id = %s", (user_id,))
        # Everything below is the part that is usually missing.
        db.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))
        db.execute("UPDATE api_tokens SET revoked_at = now() "
                   "WHERE user_id = %s AND revoked_at IS NULL", (user_id,))
        db.execute("DELETE FROM oauth_grants WHERE user_id = %s", (user_id,))
    # Session state that lives outside the database has to go too.
    cache.delete_pattern(f"session:{user_id}:*")
    audit.log("user.deactivated", user_id=user_id, source="scim")
```

Two further notes. Prefer deactivation to deletion: `DELETE /Users/{id}` should almost always be a soft delete, because hard-deleting a user destroys the audit trail the same customer will ask for. And if your sessions are stateless JWTs with a long expiry, you have a design problem that SCIM has just exposed. Either shorten the expiry to something you can tolerate as a revocation delay, or check a revocation list on each request.

:::warning
Test deprovisioning end to end, with a real session open. Log in as a test user in one browser, deactivate them from the IdP admin console, then refresh the page. If you are still logged in, your integration does not do what the contract says it does.
:::

## Groups, roles, and the trap

The IdP will send group membership, either as a SAML attribute or through SCIM's `/Groups` endpoint. The obvious move is to map groups straight onto your permissions. Resist slightly.

Map IdP groups to *your* roles through an explicit, per-connection mapping table that the customer's admin configures in your UI:

```sql
CREATE TABLE group_role_mappings (
  connection_id uuid NOT NULL REFERENCES sso_connections(id),
  idp_group     text NOT NULL,     -- "Acme-Engineering-Admins"
  role          text NOT NULL,     -- "admin", your vocabulary
  PRIMARY KEY (connection_id, idp_group)
);
```

Three reasons this indirection earns its keep. Customers name groups for their own org chart, not your permission model, and those names change. A rename in Okta should not silently strip everyone's access. And when a customer disputes what someone could see, you want a record of the mapping *you* applied rather than an inference from directory state that has since changed.

Keep one guardrail: never let a group sync remove the last administrator of an organisation. Every product that skips this eventually locks a customer out of their own account on a Friday afternoon.

## Build it in this order

Sequenced so each step is useful on its own, and nothing later requires unpicking anything earlier:

1. **Organisation and membership model.** Users belong to an org. Useful immediately for billing and shared workspaces.
2. **Domain claiming with DNS verification.** Unverified domains route nowhere.
3. **Conditional password login.** A flag on the org that disables password auth for its members, exercised before any IdP exists.
4. **SAML with one provider.** Okta or Entra ID, whichever your first customer uses. Full validation from day one.
5. **Session revocation.** Build the "kill everything for this user" function and call it from your admin panel. SCIM will need it.
6. **SCIM Users.** Create, update, and `active: false` wired to step 5.
7. **SCIM Groups and role mapping.**
8. **Audit log**, exposed to the customer. They will ask, and it is much easier if you emitted events all along.

Steps 1 to 3 are the ones to do now, before anyone asks. They are pure prerequisite, they carry no protocol risk, and they are the reason a SAML project takes three weeks instead of three months.

## Build or buy

Worth being straight about the tradeoff rather than pretending it is obvious in either direction.

The protocols are public and the libraries are free. What you are really buying from a vendor is the long tail: the IdP-specific quirks, the admin UI where a customer's IT team configures their own connection without emailing you certificates, the metadata parsing, certificate rotation, and the SCIM variations across providers. That tail is where the time goes, not in the first successful login.

If you buy, [WorkOS](https://workos.com), [Clerk](https://clerk.com) and [Stytch](https://stytch.com) all cover SSO and directory sync as a hosted service. If you would rather self-host, [Ory](https://www.ory.sh) and [Keycloak](https://www.keycloak.org) are the established open source options, and [SAML Jackson](https://github.com/boxyhq/jackson) does specifically the SAML-to-OAuth translation piece.

The honest decision rule is about where your engineering time is scarce. If you have one enterprise customer and a solid auth codebase, doing SAML yourself with a maintained library is a reasonable few weeks and you keep the flexibility. If you expect ten more customers on five different IdPs, the per-connection support burden is the cost that grows, and that is precisely what a vendor absorbs.

What is not a reason to buy: thinking SAML is too hard to understand. It is verbose, not deep. What *is* a reason to buy: not wanting to own signature validation correctness. Reread the comment truncation section and decide honestly which side of that you want to be on.

## Testing it

You cannot test this properly against a mock. Get real tenants:

- **Okta** offers a free developer tenant that supports both SAML apps and SCIM provisioning
- **Microsoft Entra ID** free tier covers SAML; automated provisioning needs a paid tier, so budget for one month of it
- **[SAMLtool](https://www.samltool.com)** is useful for decoding and inspecting responses while debugging, but never paste a production assertion into a third-party site

Things worth an explicit test case, because they are the ones that break in production:

- An expired assertion is rejected
- An assertion with the wrong `Audience` is rejected
- A replayed assertion is rejected the second time
- A user renamed in the IdP keeps the same account
- A deactivated user's open session stops working immediately
- Removing the last admin via group sync is refused

## What this does not cover

- **OIDC as the enterprise protocol.** Increasingly viable, and simpler than SAML, but SAML is still what most large IT departments will hand you. Support both eventually; start with what your buyer uses.
- **IdP-initiated login.** Some customers insist on it, from their Okta dashboard tile. It is harder to secure because there is no `InResponseTo` to correlate. If you must support it, keep the assertion replay cache and be strict about the time window.
- **Just-in-time provisioning details.** Creating a user on first SSO login is fine as a fallback, but it is not deprovisioning, and it should not be your answer to a SCIM requirement.
- **SCIM Enterprise User extension**, manager relationships and custom attributes, which some customers will want mapped.

The pattern to take away is that the protocol work is bounded and well documented, while the model change underneath it is neither. Build the organisation, connection and revocation pieces while nobody is waiting on them. Then when the questionnaire arrives, the honest answer is a date rather than a quarter.

For more on the identity side, we wrote about [the Ory ecosystem for identity and SSO on Kubernetes](/posts/ory-ecosystem-identity-auth-kubernetes), and there is a [pipeline hardening guide](/posts/cicd-pipeline-hardening-guide) covering the secrets and supply chain half of the same security questionnaire.
