---
title: 'TLS in Practice: Handshakes, Post-Quantum Key Exchange and Server Setup'
description: 'How TLS 1.3 works, post-quantum key exchange with X25519MLKEM768, an nginx config tested with openssl s_client, HSTS, mTLS and certificate monitoring.'
order: 3
---

**TLDR**: Allow TLS 1.2 and 1.3 only, with ECDHE and AEAD cipher suites. With OpenSSL 3.5 or later, TLS 1.3 already uses the post-quantum hybrid group X25519MLKEM768 by default, and most browsers and large sites use it; add it at the front of your server's group list if you set one. Serve the full certificate chain, send HSTS, and check your setup with `openssl s_client`, `curl` and testssl.sh. Certificates now live 200 days at most and soon much less, so automate renewal and monitor expiry. Public TLS CAs are phasing out client certificates, so mTLS needs a private CA.

Transport Layer Security (TLS) protects data between two programs: browser and website, service and database, pod and pod. It is the S in HTTPS, and it also secures SMTP, IMAP, Postgres, MySQL, Redis, gRPC and most APIs. TLS combines everything from Parts 1 and 2: key agreement to create shared keys, AEAD ciphers to encrypt records, hashes inside the key derivation, and signatures with certificates to prove the server's identity.

"SSL" is the name of TLS's predecessor. Every SSL version is broken and gone (OpenSSL 4.0 removed SSLv3 completely), but the name stuck in product names, file paths and directives such as `ssl_certificate`.

In this part you inspect real TLS connections, see post-quantum key exchange on the wire, configure and test an nginx server, and write a certificate expiry check.

## Prerequisites

- The lab tools from the [guide overview](/guides/cryptography-essentials#h2-set-up-the-lab), plus nginx (any recent version built with OpenSSL 3.5 or later; the lab runs it as a normal user on port 8443) and the OpenSSH client.
- Internet access for the steps that connect to public servers.
- [Part 1](/guides/cryptography-essentials/01-encryption) for key agreement and AEAD ciphers.

The outputs are real, from Ubuntu 26.04 LTS (OpenSSL 3.5.5, nginx 1.28.3, curl 8.18.0, OpenSSH 10.2p1, Python 3.14), recorded in October 2026. Public servers change their configuration and certificates over time, so your output for them may differ.

```terminal
{
  "title": "lab setup",
  "prompt": "$",
  "steps": [
    {
      "cmd": "mkdir -p ~/crypto-lab/part3 && cd ~/crypto-lab/part3"
    }
  ]
}
```

## What TLS Provides

| Property            | How TLS 1.3 provides it                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Confidentiality** | AEAD record encryption: AES-GCM or ChaCha20-Poly1305                                                                                                                                      |
| **Integrity**       | The AEAD tag on every record, and a transcript hash over the handshake                                                                                                                    |
| **Authentication**  | The server signs the handshake with the key in its certificate; the client checks the certificate chain and hostname                                                                      |
| **Forward secrecy** | Fresh (ephemeral) key agreement in every full handshake: a stolen server key cannot decrypt recorded traffic (resumption with a pre-shared key alone, and 0-RTT data, are the exceptions) |

### TLS Versions

| Version      | Status                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| **TLS 1.3**  | Recommended (RFC 8446). One round trip, ephemeral key agreement in every full handshake, only AEAD ciphers |
| **TLS 1.2**  | Still acceptable with ECDHE key exchange and AEAD ciphers only                                             |
| TLS 1.1, 1.0 | Deprecated by RFC 8996 (2021); browsers and OpenSSL's default security level refuse them                   |
| SSL 3.0, 2.0 | Broken; removed from OpenSSL                                                                               |

## The TLS 1.3 Handshake

```text
Client                                                 Server
  |                                                       |
  |  ClientHello                                          |
  |    supported versions, cipher suites, SNI (hostname)  |
  |    key_share: X25519MLKEM768 + X25519 public values   |
  |------------------------------------------------------>|
  |                                                       |
  |  ServerHello                                          |
  |    chosen cipher suite, key_share for one group       |
  |  -- from here on, everything is encrypted --          |
  |  EncryptedExtensions (ALPN: h2)                       |
  |  Certificate (leaf + intermediates)                   |
  |  CertificateVerify (signature over the handshake)     |
  |  Finished (MAC over the handshake)                    |
  |<------------------------------------------------------|
  |                                                       |
  |  Finished                                             |
  |------------------------------------------------------>|
  |                                                       |
  |  Application data (HTTP), AEAD-encrypted both ways    |
  |<=====================================================>|
```

1. The client guesses which key agreement group the server supports and sends a public key share in its very first message, which is how TLS 1.3 saves a round trip compared to TLS 1.2. If the guess is wrong, the server asks for another share (a HelloRetryRequest), costing one extra round trip.
2. Both sides combine the shares into a shared secret and derive the traffic keys from it with HKDF, a hash-based key derivation function. Everything after the ServerHello is encrypted, including the certificate.
3. **CertificateVerify** is a signature over the whole handshake so far, made with the private key that belongs to the certificate. It proves the server holds that key, and it covers the key shares, so nobody in the middle can replace them.
4. The **Finished** messages are MACs over the transcript; any tampering with the handshake makes them fail.

Resumed connections can send data in the first flight ("0-RTT" or early data), but that data can be replayed by an attacker. Only allow it for requests that are safe to repeat, or leave it off (the default in nginx).

The hostname the client asks for travels in the ClientHello as **SNI**, in plaintext. Encrypted Client Hello (ECH, RFC 9849) hides it; OpenSSL 4.0 and nginx 1.29.4 added support, but it is not in the long-term-support distributions yet.

## Inspect Real Connections

`openssl s_client -brief` connects, completes the handshake and prints a summary. Compare two public sites:

```terminal
{
  "title": "what did the handshake negotiate?",
  "prompt": "$",
  "steps": [
    {
      "cmd": "openssl s_client -connect www.cloudflare.com:443 -brief </dev/null",
      "output": "Connecting to 104.16.123.96\nCONNECTION ESTABLISHED\nProtocol version: TLSv1.3\nCiphersuite: TLS_AES_256_GCM_SHA384\nPeer certificate: CN=www.cloudflare.com\nHash used: SHA256\nSignature type: ecdsa_secp256r1_sha256\nVerification: OK\nNegotiated TLS1.3 group: X25519MLKEM768\nDONE"
    },
    {
      "cmd": "openssl s_client -connect letsencrypt.org:443 -brief </dev/null",
      "output": "Connecting to 18.208.88.157\nCONNECTION ESTABLISHED\nProtocol version: TLSv1.3\nCiphersuite: TLS_AES_128_GCM_SHA256\nPeer certificate: CN=letsencrypt.org\nHash used: SHA256\nSignature type: ecdsa_secp256r1_sha256\nVerification: OK\nPeer Temp Key: X25519, 253 bits\nDONE"
    }
  ]
}
```

Both connections use TLS 1.3 with an AES-GCM suite and an ECDSA certificate. The difference is the key agreement: Cloudflare negotiated **X25519MLKEM768**, the hybrid post-quantum group, while letsencrypt.org's server negotiated classic X25519. The client (OpenSSL 3.5) offered both; the server picked.

### Post-Quantum Key Exchange on the Wire

X25519MLKEM768 runs X25519 and ML-KEM-768 side by side and feeds both secrets into the key derivation, so the connection stays secure as long as either algorithm holds. It is standardized in [RFC 10024](https://www.rfc-editor.org/rfc/rfc10024) and has been the default first choice in Chrome since version 131, Firefox since 132, Apple's 26 releases and OpenSSL since 3.5. [Cloudflare reported](https://blog.cloudflare.com/post-quantum-visibility/) in September 2026 that about 70% of the browser traffic it sees uses it.

The cost is size. `-trace` prints every handshake message; compare the ClientHello and ServerHello with and without the post-quantum group:

```terminal
{
  "title": "handshake message sizes in bytes",
  "prompt": "$",
  "steps": [
    {
      "comment": "default: X25519MLKEM768 and X25519 key shares",
      "cmd": "openssl s_client -connect www.cloudflare.com:443 -trace </dev/null 2>/dev/null | grep -E '^ *(ClientHello|ServerHello), Length'",
      "output": "    ClientHello, Length=1551\n    ServerHello, Length=1206"
    },
    {
      "comment": "classic X25519 only",
      "cmd": "openssl s_client -connect www.cloudflare.com:443 -groups X25519 -trace </dev/null 2>/dev/null | grep -E '^ *(ClientHello|ServerHello), Length'",
      "output": "    ClientHello, Length=317\n    ServerHello, Length=118"
    }
  ]
}
```

```chart
{
  "type": "bar",
  "title": "Handshake message size with and without the post-quantum key share",
  "unit": " bytes",
  "caption": "openssl s_client (OpenSSL 3.5.5) to www.cloudflare.com, October 2026, from the trace above. The post-quantum ClientHello carries X25519MLKEM768 and X25519 key shares; the classic one only X25519.",
  "rows": [
    { "label": "ClientHello, classic", "value": 317, "series": "classic" },
    { "label": "ClientHello, post-quantum", "value": 1551, "series": "post-quantum" },
    { "label": "ServerHello, classic", "value": 118, "series": "classic" },
    { "label": "ServerHello, post-quantum", "value": 1206, "series": "post-quantum" }
  ]
}
```

The ClientHello no longer fits in a typical 1,460-byte TCP segment. That is harmless for correct software, but it broke some middleboxes and load balancers that expected the whole ClientHello in one packet. If a client fails to connect only through a certain proxy or firewall, check whether the device is up to date.

## Configure a Server: nginx

Most servers need very few TLS settings today. Mozilla's server-side TLS guidelines (now maintained at [configurator.tlsref.org](https://configurator.tlsref.org), version 6.0) recommend this "intermediate" profile for general-purpose servers: TLS 1.2 and 1.3, ECDHE with AEAD ciphers for TLS 1.2, and the groups X25519MLKEM768, X25519, P-256 and P-384.

Create a certificate for the lab. A self-signed certificate is fine for local testing; Part 4 replaces it with one from your own CA.

```terminal
{
  "title": "a self-signed certificate for localhost",
  "prompt": "$",
  "steps": [
    {
      "cmd": "mkdir -p nginx/conf nginx/logs nginx/tmp"
    },
    {
      "cmd": "openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -noenc -days 30 -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' -keyout nginx/conf/localhost.key -out nginx/conf/localhost.crt 2>/dev/null"
    }
  ]
}
```

Save the configuration below as `nginx/conf/nginx.conf`. It is a complete nginx config that runs as your user. On a real server, the `server` block goes into `/etc/nginx/conf.d/` or `sites-available/`, and the certificate paths point to your CA-issued files.

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
        http2 on;
        server_name localhost;

        ssl_certificate localhost.crt;      # leaf + intermediates (fullchain.pem)
        ssl_certificate_key localhost.key;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ecdh_curve X25519MLKEM768:X25519:prime256v1:secp384r1;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
        ssl_prefer_server_ciphers off;      # let clients pick (ChaCha20 on CPUs without AES)

        ssl_session_timeout 1d;
        ssl_session_cache shared:TLS:10m;

        add_header Strict-Transport-Security "max-age=63072000" always;

        location / {
            return 200 "orders-api ok\n";
        }
    }
}
```

What each TLS line does:

- `ssl_protocols TLSv1.2 TLSv1.3` turns off everything older.
- `ssl_ecdh_curve` sets the key agreement groups in order of preference. With OpenSSL 3.5 or later, nginx's default (`auto`) already includes X25519MLKEM768; listing the groups explicitly makes the choice visible and survives library changes. On OpenSSL older than 3.5, remove `X25519MLKEM768`, or nginx refuses to start. This is Debian 12's nginx 1.22.1 with OpenSSL 3.0.22:

```text
2026/10/27 17:13:43 [emerg] 3517215#3517215: SSL_CTX_set1_curves_list("X25519MLKEM768:X25519") failed (SSL: error:0A080106:SSL routines::passed invalid argument:group 'X25519MLKEM768' cannot be set)
```

- `ssl_ciphers` only affects TLS 1.2. TLS 1.3 suites are all AEAD and need no tuning.
- `ssl_session_cache` enables session resumption, so returning clients skip the full handshake. With a shared cache, nginx 1.23.2 and later also rotates the session ticket keys automatically, which removes the old reason to add `ssl_session_tickets off`.
- `Strict-Transport-Security` (HSTS) tells browsers to use only HTTPS for this host for two years. After a browser has seen the header once over a valid HTTPS connection, a network attacker can no longer downgrade its requests to plain HTTP. The very first visit is only protected if the domain is on the browsers' [HSTS preload list](https://hstspreload.org), which requires `includeSubDomains` and `preload` and is hard to undo.

Test the configuration, then start nginx:

```terminal
{
  "title": "check and start nginx",
  "prompt": "$",
  "steps": [
    {
      "cmd": "nginx -t -p \"$PWD/nginx\" -c conf/nginx.conf -e stderr",
      "output": "nginx: the configuration file /home/dev/crypto-lab/part3/nginx/conf/nginx.conf syntax is ok\nnginx: configuration file /home/dev/crypto-lab/part3/nginx/conf/nginx.conf test is successful"
    },
    {
      "cmd": "nginx -p \"$PWD/nginx\" -c conf/nginx.conf -e stderr"
    }
  ]
}
```

### Test the Server

```terminal
{
  "title": "test protocols and groups",
  "prompt": "$",
  "steps": [
    {
      "comment": "TLS 1.3 with the post-quantum group; check the chain and the name, stop on any error",
      "cmd": "openssl s_client -connect 127.0.0.1:8443 -servername localhost -verify_hostname localhost -verify_return_error -CAfile nginx/conf/localhost.crt -brief </dev/null",
      "output": "Connecting to 127.0.0.1\nCONNECTION ESTABLISHED\nProtocol version: TLSv1.3\nCiphersuite: TLS_AES_256_GCM_SHA384\nPeer certificate: CN=localhost\nHash used: SHA256\nSignature type: ecdsa_secp256r1_sha256\nVerification: OK\nVerified peername: localhost\nNegotiated TLS1.3 group: X25519MLKEM768\nDONE"
    },
    {
      "comment": "TLS 1.2 still works, with classic X25519 (hybrid groups are TLS 1.3 only)",
      "cmd": "openssl s_client -connect 127.0.0.1:8443 -servername localhost -CAfile nginx/conf/localhost.crt -tls1_2 -brief </dev/null",
      "output": "Connecting to 127.0.0.1\nCONNECTION ESTABLISHED\nProtocol version: TLSv1.2\nCiphersuite: ECDHE-ECDSA-AES256-GCM-SHA384\nPeer certificate: CN=localhost\nHash used: SHA256\nSignature type: ecdsa_secp256r1_sha256\nVerification: OK\nSupported Elliptic Curve Point Formats: uncompressed:ansiX962_compressed_prime:ansiX962_compressed_char2\nPeer Temp Key: X25519, 253 bits\nDONE"
    },
    {
      "comment": "TLS 1.1 is refused by the server (alert 70, protocol_version)",
      "cmd": "openssl s_client -connect 127.0.0.1:8443 -tls1_1 -cipher 'DEFAULT:@SECLEVEL=0' -brief </dev/null 2>&1 | grep -o 'tlsv1 alert protocol version.*'",
      "output": "tlsv1 alert protocol version:../ssl/record/rec_layer_s3.c:918:SSL alert number 70"
    }
  ]
}
```

`s_client` checks the certificate chain, but it only checks the hostname with `-verify_hostname`, and it continues after a verification error unless you add `-verify_return_error`. Use both when a script decides pass or fail. The TLS 1.1 test needs `@SECLEVEL=0` because OpenSSL 3 clients refuse TLS 1.1 themselves; without it you would only test your own client. Now the HTTP layer, with and without trusting the lab certificate:

```terminal
{
  "title": "curl: HTTP/2, HSTS and certificate errors",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -sSI --cacert nginx/conf/localhost.crt https://localhost:8443/",
      "output": "HTTP/2 200\nserver: nginx/1.28.3\ndate: Tue, 27 Oct 2026 15:46:26 GMT\ncontent-type: text/plain\ncontent-length: 14\nstrict-transport-security: max-age=63072000"
    },
    {
      "comment": "without --cacert, curl does not trust a self-signed certificate",
      "cmd": "curl -sSI https://localhost:8443/ 2>&1 | head -1",
      "output": "curl: (60) SSL certificate OpenSSL verify result: self-signed certificate (18)"
    },
    {
      "comment": "the certificate is valid, but not for this name",
      "cmd": "openssl s_client -connect 127.0.0.1:8443 -servername localhost -CAfile nginx/conf/localhost.crt -verify_hostname orders.example.com -brief </dev/null 2>&1 | grep -i 'verif'",
      "output": "verify error:num=62:hostname mismatch\nVerification error: hostname mismatch"
    }
  ]
}
```

The last two are the errors your users see as browser warnings, and they have different fixes. An untrusted issuer means the client needs the right root CA in its trust store (Part 4 shows how). A hostname mismatch means you connected with the wrong name, or the certificate needs to be reissued with the right SAN. Never "fix" either with `curl -k`, `verify=False` or `InsecureSkipVerify`.

### A Full Scan with testssl.sh

[testssl.sh](https://testssl.sh) checks protocols, ciphers, certificate, headers and known vulnerabilities in one run, and works on internal hosts that online scanners such as SSL Labs cannot reach. It is a Bash script (it needs `hexdump` and `dig` or `host`, from the `bsdextrautils` and `bind9-host` packages on Ubuntu). Download a release and point it at the lab server; `--openssl "$(command -v openssl)"` makes it use your OpenSSL 3.5, which can test the post-quantum group:

```terminal
{
  "title": "testssl.sh against the lab server",
  "prompt": "$",
  "steps": [
    {
      "cmd": "mkdir -p ~/tools && curl -sSfL https://github.com/testssl/testssl.sh/archive/refs/tags/v3.2.4.tar.gz | tar -xz -C ~/tools"
    },
    {
      "comment": "-p: protocols, -f: forward secrecy, ciphers and groups",
      "cmd": "~/tools/testssl.sh-3.2.4/testssl.sh --quiet --color 0 --openssl \"$(command -v openssl)\" -p -f 127.0.0.1:8443 | sed -n '/^ SSLv2/,/TLS 1.3 sig_algs/p' | grep -v '^ Testing'",
      "output": " SSLv2      not offered (OK)\n SSLv3      not offered (OK)\n TLS 1      not offered\n TLS 1.1    not offered\n TLS 1.2    offered (OK)\n TLS 1.3    offered (OK): final\n NPN/SPDY   not offered\n ALPN/HTTP2 h2, http/1.1 (offered)\n\n\n FS is offered (OK)           TLS_AES_256_GCM_SHA384\n                              TLS_CHACHA20_POLY1305_SHA256\n                              ECDHE-ECDSA-AES256-GCM-SHA384\n                              ECDHE-ECDSA-CHACHA20-POLY1305\n                              TLS_AES_128_GCM_SHA256\n                              ECDHE-ECDSA-AES128-GCM-SHA256\n KEMs offered                 X25519MLKEM768\n Elliptic curves offered:     prime256v1 secp384r1 X25519\n TLS 1.2 sig_algs offered:    ECDSA+SHA512 ECDSA+SHA384 ECDSA+SHA256\n                              ECDSA+SHA224\n TLS 1.3 sig_algs offered:    ECDSA+SHA256"
    }
  ]
}
```

In a pipeline, run it with `--jsonfile` and fail the job on findings you care about.

## Certificates in the Handshake

The server sends its certificate and the intermediate CA certificates (the "chain"). The client checks that the chain leads to a root CA in its trust store, that every certificate is within its validity dates, and that the hostname it asked for appears in the **Subject Alternative Name** (SAN) extension. Browsers ignore the Common Name (CN) for hostname checks; some libraries still fall back to it when a certificate has no SAN. Always issue certificates with a SAN.

```terminal
{
  "title": "a public certificate",
  "prompt": "$",
  "steps": [
    {
      "cmd": "openssl s_client -connect letsencrypt.org:443 -servername letsencrypt.org </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName",
      "output": "subject=CN=letsencrypt.org\nissuer=C=US, O=Let's Encrypt, CN=YE2\nnotBefore=Sep  4 14:34:32 2026 GMT\nnotAfter=Dec  3 14:34:31 2026 GMT\nX509v3 Subject Alternative Name:\n    DNS:cp.letsencrypt.org, DNS:cp.root-x1.letsencrypt.org, DNS:cps.letsencrypt.org, DNS:cps.root-x1.letsencrypt.org, DNS:lencr.org, DNS:letsencrypt.com, DNS:letsencrypt.org, DNS:www.lencr.org, DNS:www.letsencrypt.com, DNS:www.letsencrypt.org"
    }
  ]
}
```

### Certificate Types

| Type                           | What the CA checked                                     | Notes                                                                                                 |
| ------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **DV** (domain validated)      | Control of the domain (HTTP, DNS or TLS-ALPN challenge) | Almost all certificates; free and automated with ACME (Let's Encrypt, ZeroSSL, Google Trust Services) |
| **OV / EV**                    | Also the organization's identity                        | Browsers stopped showing EV differently in 2019; the extra checks add little for TLS                  |
| **Wildcard** (`*.example.com`) | Domain control via DNS                                  | Covers one label level; a stolen key works for every subdomain                                        |
| **Multi-domain (SAN)**         | Each name                                               | One certificate for several names                                                                     |

### Lifetimes Are Shrinking: Automate Renewal

Under the CA/Browser Forum's ballot SC-081, public TLS certificates may be valid for at most **200 days since 15 March 2026**, 100 days from 15 March 2027 and 47 days from 15 March 2029. Let's Encrypt goes further: its default certificate drops from 90 to 64 days on 10 February 2027 and to 45 days in 2028, and its `shortlived` profile issues six-day certificates. Manual renewal stops working at these lifetimes. Use an ACME client, for example certbot on a single server (example commands, not run here):

```bash
sudo certbot --nginx -d orders.example.com   # get a certificate and configure nginx
sudo certbot renew --dry-run                 # test that unattended renewal works
systemctl list-timers | grep -i certbot      # the renewal timer
```

Clients that support ACME Renewal Information (ARI) let the CA tell them when to renew. [Part 4](/guides/cryptography-essentials/04-pki#h2-the-certificate-lifecycle) covers the lifecycle, cert-manager and private CAs.

### OCSP Stapling Is Fading

OCSP lets a client ask the CA whether a certificate was revoked, and stapling lets the server attach a recent answer to the handshake. Let's Encrypt removed OCSP URLs from its certificates in May 2025 and shut down its OCSP service in August 2025; browsers now rely on CRLs that they collect centrally. With such certificates `ssl_stapling on` does nothing except log a warning, and Mozilla's configuration generator no longer turns it on by default. Keep it only if your CA still runs OCSP.

## The Same Change in SSH

SSH made the same move to post-quantum key exchange. OpenSSH 10.0 made `mlkem768x25519-sha256` the default, and OpenSSH 10.1 started warning when a connection does not use a post-quantum algorithm. GitHub enabled it in October 2026. Pin GitHub's host keys from its HTTPS API (an authenticated channel) instead of trusting the first connection, then look at the negotiated algorithm:

```terminal
{
  "title": "post-quantum SSH to GitHub",
  "prompt": "$",
  "steps": [
    {
      "cmd": "ssh -V",
      "output": "OpenSSH_10.2p1 Ubuntu-2ubuntu3.8, OpenSSL 3.5.5 27 Jan 2026"
    },
    {
      "cmd": "ssh -Q kex | grep -E 'mlkem|sntrup'",
      "output": "sntrup761x25519-sha512\nsntrup761x25519-sha512@openssh.com\nmlkem768x25519-sha256"
    },
    {
      "comment": "GitHub's host keys, fetched over HTTPS",
      "cmd": "curl -sSf https://api.github.com/meta | python3 -c 'import json,sys; [print(\"github.com\", k) for k in json.load(sys.stdin)[\"ssh_keys\"]]' > known_hosts"
    },
    {
      "comment": "no GitHub account needed: the key exchange happens before authentication",
      "cmd": "ssh -v -T -o UserKnownHostsFile=known_hosts -o BatchMode=yes git@github.com 2>&1 | grep -E 'kex: algorithm|Server host key|matches|Permission denied'",
      "output": "debug1: kex: algorithm: mlkem768x25519-sha256\ndebug1: Server host key: ssh-ed25519 SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU\ndebug1: Host 'github.com' is known and matches the ED25519 host key.\ngit@github.com: Permission denied (publickey)."
    }
  ]
}
```

To see the new warning, run a local SSH server that only offers a classic key exchange, as an old server would. This step is for Linux: it runs the distribution's `/usr/sbin/sshd` (from the `openssh-server` package) as your user on port 2222, and stops it at the end:

```terminal
{
  "title": "an SSH server without post-quantum key exchange",
  "prompt": "$",
  "steps": [
    {
      "cmd": "mkdir -p sshd && ssh-keygen -q -t ed25519 -N '' -f sshd/host_ed25519"
    },
    {
      "cmd": "/usr/sbin/sshd -f /dev/null -h \"$PWD/sshd/host_ed25519\" -o ListenAddress=127.0.0.1:2222 -o KexAlgorithms=curve25519-sha256 -o PidFile=\"$PWD/sshd/sshd.pid\" -o UsePAM=no"
    },
    {
      "cmd": "ssh -p 2222 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=sshd/known_hosts -o BatchMode=yes 127.0.0.1 true",
      "output": "Warning: Permanently added '[127.0.0.1]:2222' (ED25519) to the list of known hosts.\n** WARNING: connection is not using a post-quantum key exchange algorithm.\n** This session may be vulnerable to \"store now, decrypt later\" attacks.\n** The server may need to be upgraded. See https://openssh.com/pq.html\ndev@127.0.0.1: Permission denied (publickey,password,keyboard-interactive)."
    },
    {
      "comment": "stop the lab SSH server",
      "cmd": "kill \"$(cat sshd/sshd.pid)\""
    }
  ]
}
```

The client prints the warning (it is shown only when you have not set `KexAlgorithms` yourself) and continues. Upgrade servers that trigger it; if you cannot yet, `WarnWeakCrypto no` in a `Match host` block of `ssh_config` silences it for that host only. The [SSH Hardening Checklist](/checklists/ssh-hardening) covers the rest of a server's SSH setup.

## Monitor Certificate Expiry

Expired certificates remain one of the most common causes of TLS outages, and shorter lifetimes mean less time to notice a broken renewal. Check what servers actually present, not only the files on disk. Save this as `check_expiry.py` in `~/crypto-lab/part3`:

```python
#!/usr/bin/env python3
"""Report how much of each server certificate's lifetime is left.

Usage: check_expiry.py HOST[:PORT] ...   (extra CA file in $CHECK_CAFILE)
Warns when less than $CHECK_MIN_SHARE (default 0.25) of a certificate's
lifetime is left. ACME clients usually renew with about a third left, so a
certificate this close to expiry most likely means renewal is stuck.
Exits 1 if a check fails or a certificate gets a warning.
"""
import os
import socket
import ssl
import sys
import time

MIN_SHARE = float(os.environ.get("CHECK_MIN_SHARE", "0.25"))
ctx = ssl.create_default_context()  # verifies the chain and the hostname
if os.environ.get("CHECK_CAFILE"):
    ctx.load_verify_locations(os.environ["CHECK_CAFILE"])

status = 0
for target in sys.argv[1:]:
    host, _, port = target.partition(":")
    try:
        with socket.create_connection((host, int(port or 443)), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as tls:
                cert = tls.getpeercert()
    except (OSError, ValueError) as err:  # ssl.SSLError is a subclass of OSError
        print(f"{target:20} ERROR {err}")
        status = 1
        continue
    start = ssl.cert_time_to_seconds(cert["notBefore"])
    end = ssl.cert_time_to_seconds(cert["notAfter"])
    share_left = (end - time.time()) / (end - start)
    flag = "OK" if share_left >= MIN_SHARE else "WARN"
    if flag != "OK":
        status = 1
    days = (end - time.time()) / 86400
    print(f"{target:20} {flag:5} {days:5.1f} days left ({share_left:.0%} of its lifetime)")
sys.exit(status)
```

```terminal
{
  "title": "check public and private endpoints",
  "prompt": "$",
  "steps": [
    {
      "cmd": "CHECK_CAFILE=nginx/conf/localhost.crt python3 check_expiry.py www.cloudflare.com letsencrypt.org localhost:8443 expired.badssl.com",
      "output": "www.cloudflare.com   OK     88.4 days left (98% of its lifetime)\nletsencrypt.org      OK     36.9 days left (41% of its lifetime)\nlocalhost:8443       OK     30.0 days left (100% of its lifetime)\nexpired.badssl.com   ERROR [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: certificate has expired (_ssl.c:1081)"
    }
  ]
}
```

The deliberately expired certificate on `expired.badssl.com` fails verification, and the script exits with status 1 so a scheduler or CI job notices. A threshold relative to the lifetime works for 90-day, 6-day and 24-hour certificates alike; a fixed "14 days" would flag every short-lived certificate as soon as it is issued. Set it below the point where your clients renew, plus time for their timer and deploy hook, so a warning means renewal is stuck rather than about to run. Watch the renewal jobs themselves too: their failures show up long before expiry. Run a check like this from outside your network on a schedule (or use the blackbox exporter's `probe_ssl_earliest_cert_expiry` metric in Prometheus) and alert on it. For files on disk, `openssl x509 -checkend 1209600 -noout -in cert.pem` exits non-zero if the certificate expires within 14 days (1,209,600 seconds).

That is the end of the local lab for this part. Stop nginx:

```terminal
{
  "title": "stop the lab server",
  "prompt": "$",
  "steps": [
    {
      "cmd": "nginx -p \"$PWD/nginx\" -c conf/nginx.conf -e stderr -s stop",
      "output": "2026/10/27 15:47:16 [notice] 3185#3185: signal process started"
    }
  ]
}
```

## Mutual TLS (mTLS)

In normal TLS only the server proves its identity. In **mutual TLS**, the server also requests a certificate from the client and checks it against a CA it trusts. Service meshes (Istio, Linkerd, Cilium) use mTLS between workloads, and many internal APIs, databases and brokers use it instead of passwords.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Client", "sub": "presents a client certificate", "icon": "box", "tone": "blue" },
    { "label": "Server checks", "sub": "signed by the internal CA? EKU clientAuth?", "icon": "shield", "tone": "violet" },
    { "label": "Client checks", "sub": "server certificate and hostname", "icon": "shield", "tone": "violet" },
    { "label": "Both authenticated", "sub": "authorize on the client identity", "icon": "check", "tone": "green" }
  ]
}
```

Use a **private CA** for mTLS. Public TLS CAs are removing the client authentication purpose from their certificates: Let's Encrypt stopped including it in February 2026, and Chrome's root program requires server-only hierarchies for new intermediates since June 2026 and for all new certificates from March 2027. [Part 4](/guides/cryptography-essentials/04-pki#h2-mutual-tls-with-the-lab-ca) issues client certificates from a lab CA and tests mTLS end to end. In a mesh, the mesh's CA does this for you; with Istio, one resource makes mTLS mandatory in a namespace:

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: orders
spec:
  mtls:
    mode: STRICT # reject plaintext connections to workloads in this namespace
```

## TLS in Kubernetes

The ingress-nginx controller was retired in March 2026 and gets no more security fixes, so new clusters should use the Gateway API (or another maintained Ingress controller). cert-manager can issue certificates for Gateway listeners when its Gateway API support is enabled (`config.gatewayAPI.enabled=true` in the Helm chart):

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: public
  namespace: orders
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  gatewayClassName: example # your controller's GatewayClass
  listeners:
    - name: https
      hostname: orders.example.com
      port: 443
      protocol: HTTPS
      tls:
        mode: Terminate
        certificateRefs:
          - name: orders-example-com-tls # cert-manager creates and renews this Secret
```

The TLS versions, groups and ciphers are then set by the Gateway controller (Envoy Gateway, Istio, Cilium, NGINX Gateway Fabric and others). Check what it actually negotiates with the same `openssl s_client` commands as above.

## Common Mistakes

- **Missing intermediate certificates.** Browsers may still connect (they cache or fetch intermediates), while `curl`, Java and Go clients fail. Serve `fullchain.pem`, not `cert.pem`.
- **Disabling verification to "fix" an error.** `curl -k`, `verify=False`, `InsecureSkipVerify: true` and `NODE_TLS_REJECT_UNAUTHORIZED=0` turn TLS into encryption to anyone. Add the right CA to the trust store instead.
- **Old protocols and ciphers left on** for one legacy client. Isolate that client behind a separate endpoint and keep the main one strict.
- **Manual renewal and no expiry monitoring.** With 200-day and shorter lifetimes, automate renewal and alert from outside.
- **TLS ends at the load balancer and the rest is plaintext.** Inside a shared network, encrypt the hop to the backend too, or use a mesh with mTLS.
- **Copying a cipher list from an old blog post.** Use the current Mozilla intermediate profile, and recheck after OpenSSL or nginx upgrades.

## Summary

- TLS 1.3 encrypts after one round trip, uses ephemeral key agreement in every full handshake and only uses AEAD ciphers. Keep TLS 1.2 for older clients; turn off everything older.
- X25519MLKEM768 protects today's traffic against future quantum attacks. It is on by default with OpenSSL 3.5+ and in browsers, at the cost of about 1.1 to 1.2 KB extra in each hello message.
- Test with `openssl s_client`, `curl` and testssl.sh, and never disable certificate verification.
- Serve the full chain, send HSTS, and treat OCSP stapling as optional now.
- Certificate lifetimes are shrinking toward 47 days: automate renewal with ACME and monitor expiry from outside.
- Use a private CA for mTLS; public TLS CAs are phasing out client certificates.

Next, [Part 4](/guides/cryptography-essentials/04-pki) explains the trust behind certificates and builds a private CA.

## Keep Learning

- [SSL/TLS Handshake simulator](/games/ssl-tls-handshake)
- [Let's Encrypt Goes to 64-Day Certificates: When Does Your ACME Client Actually Renew?](/posts/lets-encrypt-64-day-certificates-renewal-check)
- [node-postgres Silently Ignores Your TLS Config When the URL Says sslmode](/posts/node-postgres-sslmode-silently-ignores-ssl-options)
- [Exercise: Deploying a Web Application with Nginx and SSL](/exercises/nginx-web-deployment)
- [Network & Security Fundamentals Quiz](/quizzes/network-security-quiz)
