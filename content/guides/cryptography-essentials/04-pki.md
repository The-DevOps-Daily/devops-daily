---
title: 'PKI: Certificate Authorities, Trust Chains and a Private CA'
description: 'How PKI decides what to trust: chains and cross-signing, trust stores, revocation, a private CA with name constraints, mTLS, the step CLI and signing.'
order: 4
---

**TLDR**: A certificate is trusted because it chains to a root CA in the client's trust store, through one or more intermediates. Keep root keys offline, issue from intermediates, and limit what an intermediate can sign with name constraints. Revocation is moving from OCSP to CRLs and short lifetimes. For internal services and mTLS, run a private CA (step-ca, Vault, cert-manager or a cloud private CA) and automate issuance with short-lived certificates. Distribute your root to every trust store that needs it: the OS, language runtimes and container images.

Public Key Infrastructure (PKI) answers one question: **why should I believe that this public key belongs to `orders.example.com`?** Anyone can generate a key pair and write any name into a certificate. PKI makes the name believable by having a certificate authority (CA) that the client already trusts vouch for it, with a signature.

In this part you read a real public chain, then build a private PKI for a lab domain: a root CA, an intermediate restricted to that domain, server and client certificates, a revocation list, an nginx server that requires client certificates, and a similar hierarchy in three commands with the step CLI. You finish with code signing, where the same ideas apply to commits and container images.

## Prerequisites

- The lab tools from the [guide overview](/guides/cryptography-essentials#h2-set-up-the-lab): OpenSSL 3.5 or later, nginx, curl, Git, the [step CLI](https://smallstep.com/docs/step-cli/installation/) and cosign.
- [Part 3](/guides/cryptography-essentials/03-tls-ssl), for how certificates are used in the TLS handshake.
- `sudo` on a test machine for the trust store step (optional).

The outputs are real, from Ubuntu 26.04 LTS (OpenSSL 3.5.5, nginx 1.28.3, step 0.31.0, Git 2.53.0, cosign 3.1.4), recorded in October 2026. Keys, serial numbers and dates will differ on your machine.

```terminal
{
  "title": "lab setup",
  "prompt": "$",
  "steps": [
    {
      "cmd": "mkdir -p ~/crypto-lab/part4 && cd ~/crypto-lab/part4"
    }
  ]
}
```

## How a Chain of Trust Works

| Component                              | Role                                                            | Example                                             |
| -------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| **Root CA**                            | Trust anchor, shipped in trust stores; signs intermediates only | ISRG Root X1, ISRG Root X2                          |
| **Intermediate CA**                    | Signs end-entity certificates day to day; can be replaced       | Let's Encrypt YE2, YR2                              |
| **End-entity (leaf)**                  | The server's or client's certificate                            | `CN=letsencrypt.org`                                |
| **CRL**                                | A signed list of revoked serial numbers, published by each CA   | `http://ye2.c.lencr.org/96.crl`                     |
| **Certificate Transparency (CT) logs** | Public, append-only logs of every issued public certificate     | Checked by browsers through SCTs in the certificate |

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Root CA", "sub": "in the trust store, key offline", "icon": "shield", "tone": "violet" },
    { "label": "Intermediate CA", "sub": "sent by the server", "icon": "lock", "tone": "blue" },
    { "label": "Leaf certificate", "sub": "SAN: orders.example.com", "icon": "server", "tone": "green" },
    { "label": "Client checks", "sub": "signatures, dates, name, purpose, revocation", "icon": "check", "tone": "amber" }
  ]
}
```

The client verifies each signature with the public key of the certificate above it, until it reaches a root it already trusts. It also checks that every certificate is inside its validity period, that each CA certificate is allowed to sign (`basicConstraints CA:TRUE`, `keyUsage keyCertSign`), that the leaf is allowed for TLS servers (`extendedKeyUsage serverAuth`), and that the hostname is in the leaf's SAN.

Intermediates exist so the root key can stay offline. If an intermediate is compromised or must be retired, the CA revokes it and issues a new one, and the root in billions of devices does not change.

### A Real Chain, With Cross-Signing

Look at what letsencrypt.org sends:

```terminal
{
  "title": "the chain a public server sends",
  "prompt": "$",
  "steps": [
    {
      "cmd": "openssl s_client -connect letsencrypt.org:443 -servername letsencrypt.org -showcerts </dev/null 2>/dev/null | grep -E '^ *[0-9] s:|^ *i:|v:NotBefore'",
      "output": " 0 s:CN=letsencrypt.org\n   i:C=US, O=Let's Encrypt, CN=YE2\n   v:NotBefore: Sep  4 14:34:32 2026 GMT; NotAfter: Dec  3 14:34:31 2026 GMT\n 1 s:C=US, O=Let's Encrypt, CN=YE2\n   i:C=US, O=ISRG, CN=Root YE\n   v:NotBefore: Sep  3 00:00:00 2025 GMT; NotAfter: Sep  2 23:59:59 2028 GMT\n 2 s:C=US, O=ISRG, CN=Root YE\n   i:C=US, O=Internet Security Research Group, CN=ISRG Root X2\n   v:NotBefore: May 13 00:00:00 2026 GMT; NotAfter: Sep  2 23:59:59 2032 GMT\n 3 s:C=US, O=Internet Security Research Group, CN=ISRG Root X2\n   i:C=US, O=Internet Security Research Group, CN=ISRG Root X1\n   v:NotBefore: May 13 00:00:00 2026 GMT; NotAfter: Sep  2 23:59:59 2032 GMT"
    }
  ]
}
```

The server sends four certificates. The leaf is signed by the intermediate **YE2**, which is signed by **Root YE**, one of the new roots Let's Encrypt created in 2025. Root YE is not yet in most trust stores, so the server also sends a **cross-signed** copy of Root YE (issued by ISRG Root X2) and a cross-signed X2 (issued by ISRG Root X1). A client that trusts any of these roots can build a path. This is how CAs introduce new roots without breaking older devices: the same key gets a second certificate signed by an established root.

Two more details in the leaf show how the Web PKI works in 2026:

```terminal
{
  "title": "revocation pointer and transparency proofs",
  "prompt": "$",
  "steps": [
    {
      "cmd": "openssl s_client -connect letsencrypt.org:443 -servername letsencrypt.org </dev/null 2>/dev/null > leaf.pem"
    },
    {
      "cmd": "openssl x509 -in leaf.pem -noout -ext crlDistributionPoints,authorityInfoAccess",
      "output": "Authority Information Access:\n    CA Issuers - URI:http://ye2.i.lencr.org/\nX509v3 CRL Distribution Points:\n    Full Name:\n      URI:http://ye2.c.lencr.org/96.crl"
    },
    {
      "comment": "Signed Certificate Timestamps: signed promises from CT logs to publish it",
      "cmd": "openssl x509 -in leaf.pem -noout -text | grep -E 'CT Precertificate SCTs|Log ID|Timestamp' | head -5",
      "output": "            CT Precertificate SCTs:\n                Signed Certificate Timestamp:\n                    Log ID    : D8:09:55:3B:94:4F:7A:FF:C8:16:19:6F:94:4F:85:AB:\n                    Timestamp : Sep  4 15:33:02.377 2026 GMT\n                Signed Certificate Timestamp:"
    }
  ]
}
```

The certificate has a CRL distribution point but no OCSP URL, and it carries Signed Certificate Timestamps (SCTs): signed promises from CT logs to publish it within a fixed delay. Browsers reject public certificates without enough SCTs, and the logs are audited, so every publicly trusted certificate for your domain ends up in public logs. That lets you watch for certificates you did not request, with services such as [crt.sh](https://crt.sh) or Cert Spotter.

## Trust Stores

A trust store is the set of root certificates a client trusts. Different software uses different stores, which explains many "works in the browser, fails in my app" problems.

| Client                     | Where its roots come from                                                                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Debian, Ubuntu             | `/usr/local/share/ca-certificates/*.crt`, then `update-ca-certificates` (bundle in `/etc/ssl/certs/ca-certificates.crt`)                                                                                                          |
| RHEL, Fedora, Amazon Linux | `/etc/pki/ca-trust/source/anchors/`, then `update-ca-trust`                                                                                                                                                                       |
| macOS                      | Keychain (`security add-trusted-cert`)                                                                                                                                                                                            |
| Windows                    | Certificate stores (`certlm.msc`, `Import-Certificate`)                                                                                                                                                                           |
| curl, OpenSSL, Go on Linux | The OS bundle                                                                                                                                                                                                                     |
| Python `requests`          | pip installs use the `certifi` bundle, not the OS store (set `REQUESTS_CA_BUNDLE`, or use the `truststore` package); distribution packages of certifi often point to the OS bundle. `python3 -m certifi` shows which file is used |
| Node.js                    | Its own copy of Mozilla's roots; add yours with `NODE_EXTRA_CA_CERTS`, or use the OS store with `--use-system-ca`                                                                                                                 |
| Java                       | `$JAVA_HOME/lib/security/cacerts` (`keytool -importcert -cacerts`)                                                                                                                                                                |
| Containers                 | The image's OS bundle: add your root in the Dockerfile and run `update-ca-certificates`                                                                                                                                           |

Never fix a trust problem by turning verification off. Add the right root to the store the client actually uses. You will do that for the lab root below.

## Build a Private CA

Public CAs issue certificates only for names and IP addresses they can validate on the public internet, never for private names such as `orders.lab.internal`, and public TLS CAs are phasing out client certificates. For internal services, service-to-service mTLS, VPNs and devices, you run your own CA. The lab uses `orders.lab.internal`; `.internal` is reserved for private use and never resolves on the public internet.

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "root", "label": "Orders Lab Root CA", "sub": "P-384, 10 years, offline", "icon": "shield", "tone": "violet" }],
    [{ "id": "int", "label": "Orders Lab Intermediate", "sub": "P-256, 5 years, only *.lab.internal", "icon": "lock", "tone": "blue" }],
    [
      { "id": "srv", "label": "orders.lab.internal", "sub": "serverAuth, 30 days", "icon": "server", "tone": "green" },
      { "id": "cli", "label": "billing-worker", "sub": "clientAuth, 30 days", "icon": "box", "tone": "amber" },
      { "id": "old", "label": "legacy.lab.internal", "sub": "revoked", "icon": "server", "tone": "red", "status": "down" }
    ]
  ],
  "edges": [["root", "int", "signs"], ["int", "srv"], ["int", "cli"], ["int", "old"]]
}
```

### The Root CA

The root signs only intermediates and CRLs. `pathlen:1` allows one level of intermediates below it.

```terminal
{
  "title": "create the root CA",
  "prompt": "$",
  "steps": [
    {
      "cmd": "mkdir -p pki && cd pki"
    },
    {
      "cmd": "openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-384 -out root-ca.key"
    },
    {
      "cmd": "openssl req -x509 -new -key root-ca.key -sha384 -days 3650 -subj '/O=Orders Lab/CN=Orders Lab Root CA' -addext 'basicConstraints=critical,CA:TRUE,pathlen:1' -addext 'keyUsage=critical,keyCertSign,cRLSign' -out root-ca.crt"
    },
    {
      "cmd": "openssl x509 -in root-ca.crt -noout -subject -issuer -dates -ext basicConstraints,keyUsage",
      "output": "subject=O=Orders Lab, CN=Orders Lab Root CA\nissuer=O=Orders Lab, CN=Orders Lab Root CA\nnotBefore=Oct 27 15:37:59 2026 GMT\nnotAfter=Oct 24 15:37:59 2036 GMT\nX509v3 Basic Constraints: critical\n    CA:TRUE, pathlen:1\nX509v3 Key Usage: critical\n    Certificate Sign, CRL Sign"
    }
  ]
}
```

Subject and issuer are the same: a root is self-signed. In production the root key never sits unencrypted on a networked machine. Generate it on an offline machine or an HSM, back it up encrypted in two places, and bring it out only to sign a new intermediate or a CRL. Cloud private CAs (AWS Private CA, Google CA Service) and HSM-backed Vault keep it in hardware for you.

### The Intermediate CA, Limited by Name Constraints

The intermediate gets `pathlen:0` (it cannot create further CAs) and **name constraints**: DNS names only under `lab.internal`, URIs (such as the SPIFFE IDs used below) only with the host `lab.internal`, and no IP addresses at all. If its key leaks, the attacker still cannot mint a trusted certificate for your bank or your public domains. Constraints only cover the name types they list, which is why the IP exclusion is there, for IPv4 (`0.0.0.0/0.0.0.0`) and IPv6 (`::/::`); if you do issue for IP addresses, list your ranges with `permitted;IP:` instead.

```terminal
{
  "title": "create the intermediate CA",
  "prompt": "$",
  "steps": [
    {
      "cmd": "openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out intermediate-ca.key"
    },
    {
      "comment": "OpenSSL 3 can sign a new certificate with a CA directly from req",
      "cmd": "openssl req -x509 -new -key intermediate-ca.key -CA root-ca.crt -CAkey root-ca.key -sha384 -days 1825 -subj '/O=Orders Lab/CN=Orders Lab Intermediate CA' -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' -addext 'keyUsage=critical,keyCertSign,cRLSign' -addext 'nameConstraints=critical,permitted;DNS:lab.internal,permitted;URI:lab.internal,excluded;IP:0.0.0.0/0.0.0.0,excluded;IP:::/::' -out intermediate-ca.crt",
      "output": "Warning: Not using -key or -newkey for signing since -CA option is given"
    },
    {
      "cmd": "openssl verify -CAfile root-ca.crt intermediate-ca.crt",
      "output": "intermediate-ca.crt: OK"
    }
  ]
}
```

### Issue Certificates with `openssl ca`

`openssl ca` keeps a small database of everything it issued, which you need for revocation. Its configuration defines the profiles: what a server certificate and a client certificate may contain. Save it as `intermediate.cnf` in `~/crypto-lab/part4/pki`: Note `copy_extensions = none`: the CA decides the extensions, never the requester's CSR. The subject alternative name comes from the `SAN` environment variable at signing time.

```ini
# Default for $ENV::SAN, so commands that issue nothing (revoke, gencrl) can
# read this file. Issuing without SAN set in the environment fails.
SAN =

[ ca ]
default_ca = lab_intermediate

[ lab_intermediate ]
dir              = .
database         = $dir/db/index.txt
serial           = $dir/db/serial
crlnumber        = $dir/db/crlnumber
new_certs_dir    = $dir/issued
certificate      = $dir/intermediate-ca.crt
private_key      = $dir/intermediate-ca.key
default_md       = sha256
default_days     = 30
default_crl_days = 7
policy           = policy_cn_only
copy_extensions  = none
unique_subject   = no

[ policy_cn_only ]
commonName = supplied

[ server_cert ]
basicConstraints       = critical,CA:FALSE
keyUsage               = critical,digitalSignature
extendedKeyUsage       = serverAuth
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid
subjectAltName         = $ENV::SAN
crlDistributionPoints  = URI:http://pki.lab.internal/intermediate.crl

[ client_cert ]
basicConstraints       = critical,CA:FALSE
keyUsage               = critical,digitalSignature
extendedKeyUsage       = clientAuth
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid
subjectAltName         = $ENV::SAN
crlDistributionPoints  = URI:http://pki.lab.internal/intermediate.crl
```

Each service generates its own key and sends only a certificate signing request (CSR); the private key never leaves the service. Then the CA signs:

```terminal
{
  "title": "issue a server certificate",
  "prompt": "$",
  "steps": [
    {
      "cmd": "mkdir -p db issued && touch db/index.txt && openssl rand -hex 16 > db/serial && echo 1000 > db/crlnumber"
    },
    {
      "comment": "on the service: key and CSR",
      "cmd": "openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -noenc -keyout orders.key -subj '/CN=orders.lab.internal' -out orders.csr 2>/dev/null"
    },
    {
      "comment": "on the CA: sign with the server profile",
      "cmd": "SAN=DNS:orders.lab.internal openssl ca -config intermediate.cnf -extensions server_cert -batch -notext -in orders.csr -out orders.crt 2>&1 | tail -3",
      "output": "Write out database with 1 new entries\nDatabase updated"
    },
    {
      "cmd": "openssl x509 -in orders.crt -noout -subject -issuer -dates -ext subjectAltName,extendedKeyUsage",
      "output": "subject=CN=orders.lab.internal\nissuer=O=Orders Lab, CN=Orders Lab Intermediate CA\nnotBefore=Oct 27 15:37:59 2026 GMT\nnotAfter=Nov 26 15:37:59 2026 GMT\nX509v3 Extended Key Usage:\n    TLS Web Server Authentication\nX509v3 Subject Alternative Name:\n    DNS:orders.lab.internal"
    },
    {
      "comment": "the server sends the leaf and the intermediate",
      "cmd": "cat orders.crt intermediate-ca.crt > orders-fullchain.crt"
    }
  ]
}
```

### Verify, and See Each Check Fail

`openssl verify` checks the chain the way a TLS client does; add `-purpose sslserver` and `-verify_hostname` for the purpose and name checks, which it skips by default. Each command after the first breaks one rule:

```terminal
{
  "title": "chain verification and its failure modes",
  "prompt": "$",
  "steps": [
    {
      "cmd": "openssl verify -CAfile root-ca.crt -untrusted intermediate-ca.crt -purpose sslserver -verify_hostname orders.lab.internal orders.crt",
      "output": "orders.crt: OK"
    },
    {
      "comment": "the intermediate is missing (a server that sends only cert.pem)",
      "cmd": "openssl verify -CAfile root-ca.crt orders.crt",
      "output": "CN=orders.lab.internal\nerror 20 at 0 depth lookup: unable to get local issuer certificate\nerror orders.crt: verification failed"
    },
    {
      "comment": "check the certificate as it will be in 60 days",
      "cmd": "openssl verify -CAfile root-ca.crt -untrusted intermediate-ca.crt -attime \"$(date -d '+60 days' +%s)\" orders.crt",
      "output": "CN=orders.lab.internal\nerror 10 at 0 depth lookup: certificate has expired\nerror orders.crt: verification failed"
    },
    {
      "comment": "a server certificate used as a client certificate",
      "cmd": "openssl verify -CAfile root-ca.crt -untrusted intermediate-ca.crt -purpose sslclient orders.crt",
      "output": "CN=orders.lab.internal\nerror 26 at 0 depth lookup: unsuitable certificate purpose\nerror orders.crt: verification failed"
    },
    {
      "comment": "the intermediate signs a name outside lab.internal",
      "cmd": "openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -noenc -keyout evil.key -subj '/CN=www.example.com' -out evil.csr 2>/dev/null && SAN=DNS:www.example.com openssl ca -config intermediate.cnf -extensions server_cert -batch -notext -in evil.csr -out evil.crt 2>/dev/null && openssl verify -CAfile root-ca.crt -untrusted intermediate-ca.crt evil.crt",
      "output": "CN=www.example.com\nerror 47 at 0 depth lookup: permitted subtree violation\nerror evil.crt: verification failed"
    }
  ]
}
```

The name constraint did its job: the intermediate signed `www.example.com` (a CA signs whatever its software lets through), but no client that enforces constraints will accept it. Keep these error messages in mind; they are the same ones you get from curl, nginx and application logs.

## Mutual TLS with the Lab CA

Issue a client certificate for a worker service. The SAN carries a SPIFFE-style URI, the identity format service meshes use, which the server can authorize on:

```terminal
{
  "title": "issue a client certificate",
  "prompt": "$",
  "steps": [
    {
      "cmd": "openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -noenc -keyout billing-worker.key -subj '/CN=billing-worker' -out billing-worker.csr 2>/dev/null"
    },
    {
      "cmd": "SAN=URI:spiffe://lab.internal/billing-worker openssl ca -config intermediate.cnf -extensions client_cert -batch -notext -in billing-worker.csr -out billing-worker.crt 2>/dev/null"
    },
    {
      "cmd": "cat billing-worker.crt intermediate-ca.crt > billing-worker-fullchain.crt"
    }
  ]
}
```

The nginx server from Part 3 now uses the lab certificate and requires a client certificate signed by the lab root. If the Part 3 server still runs, stop it first; both use port 8443. Create the directories:

```terminal
{
  "title": "nginx directories",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd ~/crypto-lab/part4 && mkdir -p nginx/conf nginx/logs nginx/tmp"
    }
  ]
}
```

Then save this as `nginx/conf/nginx.conf`:

```nginx
# Lab only: the paths below make nginx run as a normal user
worker_processes 1;
pid logs/nginx.pid;
error_log logs/error.log;
events {}

http {
    access_log off;
    client_body_temp_path tmp/body;
    proxy_temp_path tmp/proxy;
    fastcgi_temp_path tmp/fastcgi;
    uwsgi_temp_path tmp/uwsgi;
    scgi_temp_path tmp/scgi;

    server {
        listen 127.0.0.1:8443 ssl;
        server_name orders.lab.internal;

        ssl_certificate ../../pki/orders-fullchain.crt;
        ssl_certificate_key ../../pki/orders.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ecdh_curve X25519MLKEM768:X25519:prime256v1:secp384r1;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
        ssl_prefer_server_ciphers off;

        ssl_client_certificate ../../pki/root-ca.crt; # trust anchor for client certificates
        ssl_verify_client on;
        ssl_verify_depth 2;                           # client cert + intermediate

        location / {
            return 200 "hello $ssl_client_s_dn\n";
        }
    }
}
```

```terminal
{
  "title": "mTLS with nginx",
  "prompt": "$",
  "steps": [
    {
      "cmd": "nginx -p \"$PWD/nginx\" -c conf/nginx.conf -e stderr"
    },
    {
      "comment": "with the client certificate (and its intermediate)",
      "cmd": "curl -sS --resolve orders.lab.internal:8443:127.0.0.1 --cacert pki/root-ca.crt --cert pki/billing-worker-fullchain.crt --key pki/billing-worker.key https://orders.lab.internal:8443/",
      "output": "hello CN=billing-worker"
    },
    {
      "comment": "without a client certificate: the TLS session works, the request is refused",
      "cmd": "curl -sS --resolve orders.lab.internal:8443:127.0.0.1 --cacert pki/root-ca.crt https://orders.lab.internal:8443/ | grep -o '<title>.*</title>'",
      "output": "<title>400 No required SSL certificate was sent</title>"
    },
    {
      "comment": "the server certificate passes full verification against the lab root",
      "cmd": "openssl s_client -connect 127.0.0.1:8443 -servername orders.lab.internal -verify_hostname orders.lab.internal -CAfile pki/root-ca.crt -cert pki/billing-worker.crt -key pki/billing-worker.key -cert_chain pki/intermediate-ca.crt -brief </dev/null 2>&1 | grep -E 'Protocol|Verification|group'",
      "output": "Protocol version: TLSv1.3\nVerification: OK\nNegotiated TLS1.3 group: X25519MLKEM768"
    },
    {
      "comment": "stop the lab server",
      "cmd": "nginx -p \"$PWD/nginx\" -c conf/nginx.conf -e stderr -s stop",
      "output": "2026/10/27 15:37:59 [notice] 52#52: signal process started"
    }
  ]
}
```

The server checks the client's chain against the lab root, and the application gets the verified identity in `$ssl_client_s_dn` (or the SAN). Authorize on that identity, for example "only `spiffe://lab.internal/billing-worker` may call `/charges`", instead of accepting any certificate from the CA.

## Revocation

When a private key leaks, the CA revokes the certificate: it adds the serial number to its next CRL, and clients that check revocation refuse it.

```terminal
{
  "title": "revoke a certificate and publish a CRL",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd pki"
    },
    {
      "cmd": "openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -noenc -keyout legacy.key -subj '/CN=legacy.lab.internal' -out legacy.csr 2>/dev/null && SAN=DNS:legacy.lab.internal openssl ca -config intermediate.cnf -extensions server_cert -batch -notext -in legacy.csr -out legacy.crt 2>/dev/null"
    },
    {
      "cmd": "openssl ca -config intermediate.cnf -revoke legacy.crt -crl_reason keyCompromise 2>&1 | tail -1",
      "output": "Database updated"
    },
    {
      "cmd": "openssl ca -config intermediate.cnf -gencrl -out intermediate.crl 2>/dev/null"
    },
    {
      "comment": "the HTTP distribution point serves the DER form",
      "cmd": "openssl crl -in intermediate.crl -outform DER -out intermediate-der.crl"
    },
    {
      "cmd": "openssl crl -in intermediate.crl -noout -lastupdate -nextupdate -crlnumber",
      "output": "lastUpdate=Oct 27 15:38:00 2026 GMT\nnextUpdate=Nov  3 15:38:00 2026 GMT\ncrlNumber=0x1000"
    },
    {
      "cmd": "openssl verify -crl_check -CAfile root-ca.crt -untrusted intermediate-ca.crt -CRLfile intermediate.crl legacy.crt",
      "output": "CN=legacy.lab.internal\nerror 23 at 0 depth lookup: certificate revoked\nerror legacy.crt: verification failed"
    },
    {
      "cmd": "openssl verify -crl_check -CAfile root-ca.crt -untrusted intermediate-ca.crt -CRLfile intermediate.crl orders.crt",
      "output": "orders.crt: OK"
    }
  ]
}
```

A CRL is valid only until its `nextUpdate` time (7 days here), so the CA must publish a fresh one before then, even if nothing changed, at the URL in the certificates' CRL distribution point. Serve the DER file there (clients fetching it over HTTP expect DER); OpenSSL and nginx read the PEM file locally. In nginx, `ssl_crl` enables CRL checks for client certificates; nginx then checks every CA in the chain, so the file must contain a CRL from the root as well as from the intermediate.

Revocation on the public web changed in the last two years:

- **OCSP is ending.** Let's Encrypt removed OCSP URLs in May 2025 and shut down its responders in August 2025, citing the privacy cost (every lookup told the CA which site you visited) and reliability. Browsers use CRLs that they collect and compress centrally (Firefox's CRLite, Chrome's CRLSets).
- **Short lifetimes replace revocation.** A certificate that expires in six days (Let's Encrypt's `shortlived` profile) or 24 hours (common for internal mTLS) needs revocation far less, because a stolen key stops working soon anyway.

## Distribute Your Root

Clients only trust the lab certificates if the lab root is in their trust store. On Debian and Ubuntu:

```terminal
{
  "title": "add the lab root to the system trust store",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd ~/crypto-lab/part4"
    },
    {
      "cmd": "sudo cp pki/root-ca.crt /usr/local/share/ca-certificates/orders-lab-root-ca.crt"
    },
    {
      "cmd": "sudo update-ca-certificates",
      "output": "Updating certificates in /etc/ssl/certs...\nrehash: warning: skipping ca-certificates.crt, it does not contain exactly one certificate or CRL\n1 added, 0 removed; done.\nRunning hooks in /etc/ca-certificates/update.d...\ndone."
    },
    {
      "comment": "no -CAfile: OpenSSL now uses the system store",
      "cmd": "openssl verify -untrusted pki/intermediate-ca.crt pki/orders.crt",
      "output": "pki/orders.crt: OK"
    }
  ]
}
```

To remove it again, delete the file and run `sudo update-ca-certificates --fresh`. For other clients, use the table in the [trust stores section](#h2-trust-stores). In Kubernetes, [trust-manager](https://cert-manager.io/docs/trust/trust-manager/) (from the cert-manager project) distributes CA bundles to every namespace as ConfigMaps, so pods can mount them.

## The Same CA with the step CLI

Hand-written OpenSSL configuration is good for learning and for unusual profiles. For daily work, [step](https://smallstep.com/docs/step-cli/) creates a similar hierarchy with sensible defaults in three commands. Its default profiles add no name constraints; use a [certificate template](https://smallstep.com/docs/step-ca/templates/) for those.

```terminal
{
  "title": "a root, an intermediate and a 24-hour leaf with step",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd ~/crypto-lab/part4 && mkdir -p step && cd step"
    },
    {
      "cmd": "step certificate create \"Orders Lab Root CA\" root.crt root.key --profile root-ca --no-password --insecure",
      "output": "Your certificate has been saved in root.crt.\nYour private key has been saved in root.key."
    },
    {
      "cmd": "step certificate create \"Orders Lab Intermediate CA\" int.crt int.key --profile intermediate-ca --ca root.crt --ca-key root.key --no-password --insecure",
      "output": "Your certificate has been saved in int.crt.\nYour private key has been saved in int.key."
    },
    {
      "cmd": "step certificate create orders.lab.internal orders.crt orders.key --profile leaf --ca int.crt --ca-key int.key --not-after 24h --bundle --no-password --insecure",
      "output": "Your certificate has been saved in orders.crt.\nYour private key has been saved in orders.key."
    },
    {
      "cmd": "step certificate inspect orders.crt --short",
      "output": "X.509v3 TLS Certificate (ECDSA P-256) [Serial: 8941...9558]\n  Subject:     orders.lab.internal\n  Issuer:      Orders Lab Intermediate CA\n  Valid from:  2026-10-27T15:38:00Z\n          to:  2026-10-28T15:38:00Z"
    },
    {
      "cmd": "step certificate verify orders.crt --roots root.crt && echo 'chain OK'",
      "output": "chain OK"
    }
  ]
}
```

`--no-password --insecure` leaves the keys unencrypted, which is fine for a lab only. `step certificate inspect` is also a readable alternative to `openssl x509 -text` for any certificate.

To issue certificates automatically, run a CA service: [step-ca](https://smallstep.com/docs/step-ca/) (with an ACME endpoint, so certbot and cert-manager work against it), HashiCorp Vault's PKI secrets engine, cert-manager's CA issuer inside Kubernetes, or a cloud private CA. With Vault, for example, once a PKI mount `pki_int` holds a signed intermediate (example commands, not run here):

```bash
vault write pki_int/roles/orders allowed_domains=lab.internal allow_subdomains=true max_ttl=72h
vault write pki_int/issue/orders common_name=orders.lab.internal ttl=24h
```

## The Certificate Lifecycle

Every certificate goes through the same steps: generate a key, request, validate, issue, deploy, monitor, renew (or revoke). The only sustainable way to run that loop is to automate all of it, and the industry is forcing the issue: the maximum lifetime of public TLS certificates is shrinking in steps under CA/Browser Forum ballot SC-081.

```chart
{
  "type": "bar",
  "title": "Maximum lifetime of a public TLS certificate",
  "unit": " days",
  "caption": "CA/Browser Forum Baseline Requirements, ballot SC-081 (adopted April 2025). Certificates issued from each date. Domain validation reuse shrinks on the same dates, to 10 days in 2029.",
  "rows": [
    { "label": "Until 14 Mar 2026", "value": 398 },
    { "label": "From 15 Mar 2026", "value": 200 },
    { "label": "From 15 Mar 2027", "value": 100 },
    { "label": "From 15 Mar 2029", "value": 47 }
  ]
}
```

Let's Encrypt moves faster than the rules: 64-day certificates by default from 10 February 2027 and 45 days from 2028. In Kubernetes, cert-manager runs the loop for you. Here `orders-lab-intermediate` is a `ClusterIssuer` of type `ca` whose Secret holds the intermediate's certificate and key:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: orders
  namespace: orders
spec:
  secretName: orders-tls
  dnsNames:
    - orders.lab.internal
  duration: 720h # 30 days
  renewBefore: 240h # renew 10 days before expiry
  privateKey:
    algorithm: ECDSA
    size: 256
    rotationPolicy: Always # new key on every renewal
  issuerRef:
    name: orders-lab-intermediate
    kind: ClusterIssuer
```

What to monitor, whatever tool issues the certificates:

- Days until expiry of what each endpoint actually serves (the [Part 3 script](/guides/cryptography-essentials/03-tls-ssl#h2-monitor-certificate-expiry) or the Prometheus blackbox exporter).
- Renewal failures in your ACME client or cert-manager. A certificate stays `Ready` while its replacement keeps failing, so alert on cert-manager's `certmanager_certificate_expiration_timestamp_seconds` and `certmanager_certificate_renewal_timestamp_seconds` metrics (expiry close and renewal time passed), and check failed CertificateRequests with `kubectl describe certificate`.
- CT logs for your public domains, to catch certificates you did not request.
- For private CAs: CRL freshness, intermediate expiry, and who can call the issue endpoint.

## Signing: The Same Ideas for Code

Signatures with certificates and trust anchors are not only for TLS. Two cases every DevOps team meets:

### Signed Git Commits with an SSH Key

Git can sign commits with an SSH key, so you do not need GPG. An "allowed signers" file plays the role of the trust store:

```terminal
{
  "title": "sign and verify a commit with SSH",
  "prompt": "$",
  "steps": [
    {
      "comment": "a lab key without a passphrase; protect a real signing key with one",
      "cmd": "ssh-keygen -q -t ed25519 -N '' -C 'dev@orders-lab' -f ~/crypto-lab/part4/signing_key"
    },
    {
      "cmd": "git init -q ~/crypto-lab/part4/signed-repo && cd ~/crypto-lab/part4/signed-repo"
    },
    {
      "comment": "repository-level settings; add --global to sign in every repository",
      "cmd": "git config user.name 'Dev' && git config user.email 'dev@orders-lab'"
    },
    {
      "cmd": "git config gpg.format ssh && git config user.signingkey ~/crypto-lab/part4/signing_key.pub && git config commit.gpgsign true"
    },
    {
      "comment": "the trust store for signatures: which key may sign as which email",
      "cmd": "echo \"dev@orders-lab $(cat ~/crypto-lab/part4/signing_key.pub)\" > .git/allowed_signers && git config gpg.ssh.allowedSignersFile .git/allowed_signers"
    },
    {
      "cmd": "git commit -q --allow-empty -m 'Rotate orders-api certificates'"
    },
    {
      "cmd": "git log --show-signature -1 --format='%h %s'",
      "output": "Good \"git\" signature for dev@orders-lab with ED25519 key SHA256:Vk4WcnkIr5LmNpzuUA91SS/Ta4tD2tl/AvyjT4as+w0\n4703f06 Rotate orders-api certificates"
    }
  ]
}
```

To use this for real, sign with the email address of your account instead of the lab address, and upload the same public key to GitHub or GitLab as a **signing key**; they show a commit as verified only when its email matches a verified address on the account. Branch protection rules can then require signed commits.

### Signed Container Images with Sigstore

Sigstore's cosign signs images with short-lived certificates from its Fulcio CA, issued to an OIDC identity (a person's account or a CI workflow), and logs every signature in a transparency log, just as CT does for TLS certificates. In CI it is one command, `cosign sign <image>@<digest>`, with the workflow's OIDC token. Verifying pins the expected identity, as in [Part 2](/guides/cryptography-essentials/02-hashing#h3-a-sigstore-signed-release). Kubernetes signs its own release images this way:

```terminal
{
  "title": "verify a signed Kubernetes image",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cosign verify registry.k8s.io/pause:3.10 --certificate-identity krel-trust@k8s-releng-prod.iam.gserviceaccount.com --certificate-oidc-issuer https://accounts.google.com 2>&1 >/dev/null",
      "output": "Verification for registry.k8s.io/pause:3.10 --\nThe following checks were performed on each of these signatures:\n  - The cosign claims were validated\n  - Existence of the claims in the transparency log was verified offline\n  - The code-signing certificate was verified using trusted certificate authority certificates"
    }
  ]
}
```

In a cluster, an admission policy (Sigstore's policy-controller, Kyverno or Connaisseur) runs the same check before any pod starts.

## Common PKI Problems

| Error                                                                      | Usual cause                                                                 | Fix                                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `unable to get local issuer certificate`                                   | Server sends no intermediate, or the client lacks the root                  | Serve the full chain; add the root to the client's trust store   |
| `self-signed certificate` / `self-signed certificate in certificate chain` | A private root that the client does not trust                               | Add the root to the store that client uses (see the table above) |
| `certificate has expired`                                                  | Renewal failed, or the clock is wrong                                       | Fix renewal; check `timedatectl` and NTP                         |
| `hostname mismatch`                                                        | The name is not in the SAN                                                  | Reissue with the right SAN; connect with the right name and SNI  |
| `unsupported certificate purpose`                                          | Wrong extended key usage, such as a server certificate used for client auth | Issue the certificate with the right profile                     |
| `permitted subtree violation`                                              | A name outside the CA's name constraints                                    | Use a CA that may issue for that name                            |
| `certificate revoked`                                                      | The serial is on the CA's CRL                                               | Issue a new key and certificate                                  |

## Summary

- Trust comes from a chain: leaf, intermediates, and a root in the client's trust store. Servers must send the intermediates.
- CAs introduce new roots with cross-signed certificates, as Let's Encrypt does with Root YE and YR.
- Keep root keys offline, constrain intermediates (`pathlen`, name constraints, EKU), and let the CA, not the CSR, decide extensions.
- Revocation is moving to CRLs and to short lifetimes; public OCSP is ending.
- For internal TLS and mTLS, run a private CA with automated, short-lived issuance, and distribute its root to every trust store that needs it.
- The same tools sign code: SSH-signed commits and Sigstore-signed images, verified against pinned identities.

This is the end of the guide. To keep practicing, step through the [SSL/TLS Handshake simulator](/games/ssl-tls-handshake), or go back to the [guide overview](/guides/cryptography-essentials).

## Keep Learning

- [Zero Trust Architecture](/guides/security-principles/04-zero-trust)
- [Let's Encrypt Goes to 64-Day Certificates: When Does Your ACME Client Actually Renew?](/posts/lets-encrypt-64-day-certificates-renewal-check)
- [Kubernetes Security Checklist](/checklists/kubernetes-security)
- [Interview questions: Security Architecture and DevSecOps](/interview-questions/senior/security-architecture)
- [HashiCorp Vault Secrets Management Quiz](/quizzes/vault-secrets-management-quiz)
