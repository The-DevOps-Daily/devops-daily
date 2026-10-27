---
title: 'Base64 Explained: 3 Bytes In, 4 Characters Out, Zero Secrecy'
excerpt: 'Base64 turns 3 bytes into 4 characters and hides nothing. See it in Kubernetes Secrets and JWTs, measure the 33% overhead, and fix the bugs it causes.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-30'
publishedAt: '2026-10-30T09:00:00Z'
updatedAt: '2026-10-30T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Base64
  - Kubernetes
  - Security
  - JWT
  - Linux
  - Bash
---

Base64 is in more of your config than you think. Kubernetes Secrets store their values in it, a signed JWT in an `Authorization` header is three base64url strings joined by dots, kubeconfig files carry certificates in it, and CI systems ask you to paste base64 when a file has to fit in a variable. Most of the time it works. When it does not, the bug is usually small, like an extra newline or a value encoded twice, and it takes an afternoon to find because the broken value looks almost the same as the right one.

This post shows how base64 works, why its output is a third bigger, and what it does not protect. Then it walks through the bugs that keep coming back. Every command and output below comes from a real run.

## TLDR

- Base64 maps every **3 bytes to 4 characters** from a 64-character alphabet. Anyone can reverse it with one command. It is an **encoding, not encryption**.
- A Kubernetes Secret's `data` field is plain base64. `kubectl get secret -o yaml` plus `base64 -d` shows the value to anyone with read access.
- The output is **33.3% bigger** than the input. GNU `base64` also adds a newline every 76 characters, which makes it 35.1%. Gzip wins most of it back on the wire.
- The common bugs: a **trailing newline** from `echo`, **wrapped output** pasted into YAML or an env var, **double encoding** with `--from-literal` or `stringData`, and the **URL-safe alphabet without padding** in JWTs.

## Prerequisites

- A Linux shell with GNU coreutils for `base64` and `basenc`. We used coreutils 9.1 on Debian 12.
- `openssl` and `python3` for the JWT and comparison examples.
- `kubectl` for the Secret examples. Every `kubectl` command here uses `--dry-run=client`, so you do not need a cluster. We used kubectl v1.37.1.

## How base64 turns 3 bytes into 4 characters

Base64 uses 64 symbols, and 64 is 2 to the power of 6, so each output character carries exactly 6 bits. Three bytes are 24 bits, and 24 bits split cleanly into four 6-bit groups. That is the whole algorithm: take 3 bytes, cut them into four 6-bit numbers, and look each number up in the alphabet.

This script prints each step for the string `k8s`:

```python
import base64

data = b"k8s"
bits = "".join(f"{b:08b}" for b in data)
groups = [bits[i:i + 6] for i in range(0, len(bits), 6)]

print("bytes   ", " ".join(f"{b:08b}" for b in data))
print("6 bits  ", " ".join(groups))
print("values  ", " ".join(str(int(g, 2)) for g in groups))
print("base64  ", base64.b64encode(data).decode())
```

```text
bytes    01101011 00111000 01110011
6 bits   011010 110011 100001 110011
values   26 51 33 51
base64   azhz
```

The standard alphabet from [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648) is:

```text
 0-25   A B C ... Z
26-51   a b c ... z
52-61   0 1 2 ... 9
62      +
63      /
```

So 26 is `a`, 51 is `z` and 33 is `h`, and `k8s` becomes `azhz`. Decoding runs the same steps backwards. There is no key and nothing to guess, which is why base64 is not a way to hide anything.

## Padding: what the = signs mean

When the input length is not a multiple of 3, the last group is short. Base64 fills the missing bits with zeros and adds `=` so the output length stays a multiple of 4:

```bash
printf 'k' | base64
printf 'k8' | base64
printf 'k8s' | base64
```

```text
aw==
azg=
azhz
```

One leftover byte gives 2 characters plus `==`. Two leftover bytes give 3 characters plus `=`. Padding carries no data, which is why some formats, JWT among them, drop it. That saves a few bytes and causes a bug we will get to below.

Because the mapping is fixed, common inputs have recognizable prefixes. JSON that starts with `{"` followed by a letter encodes to a string starting with `eyJ`, so `eyJ...` is almost always JSON, often a JWT. Base64-encoded PEM text (`-----BEGIN ...`) starts with `LS0tLS1CRUdJTi`.

## The 33% overhead, measured

Every 3 input bytes become 4 output characters, so the encoded size is `4 × ceil(n / 3)`. For large inputs that is 4/3 of the original, an overhead of 33.3%. GNU `base64` also wraps its output at 76 characters by default, which adds one newline for every 76 characters.

We encoded 1 MiB of random data to check the math:

```bash
head -c 1048576 /dev/urandom > blob.bin
wc -c < blob.bin
base64 blob.bin | wc -c        # default: wrapped at 76 characters
base64 -w0 blob.bin | wc -c    # -w0: no wrapping
base64 blob.bin | wc -l
```

```text
1048576
1416501
1398104
18397
```

The formula gives the same numbers: `4 × ceil(1048576 / 3)` is 1,398,104 characters, and `ceil(1398104 / 76)` is 18,397 lines, each ending in a newline, for 1,416,501 bytes in total. That is 1.3333 times the input without wrapping and 1.3509 times with it.

```chart
{
  "type": "bar",
  "title": "1 MiB of random data, before and after base64",
  "unit": " bytes",
  "caption": "Measured with wc -c on Debian 12, GNU coreutils 9.1 and gzip -9. The base64 overhead is 33.3% (35.1% with line wrapping); after gzip it is 0.9% on the wire.",
  "rows": [
    { "label": "raw", "value": 1048576, "series": "raw" },
    { "label": "base64 -w0", "value": 1398104, "series": "base64" },
    { "label": "base64 (wrapped)", "value": 1416501, "series": "base64" },
    { "label": "base64 -w0 | gzip -9", "value": 1058004, "series": "compressed" }
  ],
  "series": [
    { "name": "raw", "color": "#64748b" },
    { "name": "base64", "color": "#f59e0b" },
    { "name": "compressed", "color": "#10b981" }
  ]
}
```

On the wire, compression gets most of it back. Base64 only uses 6 of every 8 bits, and gzip notices:

```bash
gzip -9 -c blob.bin | wc -c
base64 -w0 blob.bin | gzip -9 | wc -c
```

```text
1048763
1058004
```

For this sample, gzip cut the overhead from 33.3% to 0.9%. The overhead still counts wherever the encoded size is what matters: memory, environment variables, cookies and request headers. A JWT is sent in a header on every call, and header size limits apply to its encoded form: each claim costs 4/3 of its size, and nginx's default `large_client_header_buffers` allows 8 KB per header line.

## Kubernetes Secrets are base64, not encryption

A Secret's `data` field holds base64 strings. Create one locally to see what the API server would store:

```bash
kubectl create secret generic db-creds \
  --from-literal=username=app \
  --from-literal=password='hunter2-prod' \
  --dry-run=client -o yaml
```

```yaml
apiVersion: v1
data:
  password: aHVudGVyMi1wcm9k
  username: YXBw
kind: Secret
metadata:
  name: db-creds
```

Getting the value back takes one pipe. On a cluster you would use `kubectl get secret db-creds -o jsonpath='{.data.password}'`; here we read the same field from the dry run:

```bash
kubectl create secret generic db-creds --from-literal=password='hunter2-prod' \
  --dry-run=client -o jsonpath='{.data.password}' | base64 -d; echo
```

```text
hunter2-prod
```

Base64 is there so binary data such as keystores and TLS keys fits inside JSON and YAML. It does nothing for secrecy.

:::warning
Anyone who can `get` or `list` Secrets in a namespace can read every value in it, and so can anyone who can create a pod there that mounts them. A Secret manifest committed to Git is the password in plain sight. What protects Secrets is RBAC, [encryption at rest](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/) for etcd, and keeping the values out of Git with a tool such as Sealed Secrets, SOPS or an external secret store.
:::

For a longer walkthrough, see [How to Decode a Kubernetes Secret](/posts/how-to-decode-a-kubernetes-secret) and the [ConfigMaps and Secrets part](/guides/introduction-to-kubernetes/06-configmaps-and-secrets) of our Kubernetes guide.

## Bug 1: the newline from echo

`echo` adds a newline, and base64 encodes it like any other byte:

```bash
echo 'hunter2-prod' | base64
printf '%s' 'hunter2-prod' | base64
```

```text
aHVudGVyMi1wcm9kCg==
aHVudGVyMi1wcm9k
```

The first value ends in `Cg==`, which is the encoded `\n`. Decode it and look at the bytes:

```bash
echo 'aHVudGVyMi1wcm9kCg==' | base64 -d | od -c
```

```text
0000000   h   u   n   t   e   r   2   -   p   r   o   d  \n
0000015
```

Put that value in a Secret and the password is now `hunter2-prod` plus a newline. The app sends 13 bytes, the database expects 12, and you get an authentication error for a password that looks right in every log line.

The same thing happens with files. A file written with `echo` ends in a newline, and `--from-file` keeps it:

```bash
echo 'hunter2-prod' > password.txt
kubectl create secret generic db-creds --from-file=password=password.txt \
  --dry-run=client -o jsonpath='{.data.password}'; echo

printf '%s' 'hunter2-prod' > password.txt
kubectl create secret generic db-creds --from-file=password=password.txt \
  --dry-run=client -o jsonpath='{.data.password}'; echo
```

```text
aHVudGVyMi1wcm9kCg==
aHVudGVyMi1wcm9k
```

Use `printf '%s'` whenever the exact bytes matter, and pipe a suspect value through `base64 -d | od -c` to see the last byte.

## Bug 2: wrapped output in YAML and env vars

GNU `base64` breaks its output into 76-character lines. A database URL is long enough to hit that:

```bash
DB_URL='postgresql://app:hunter2-prod@db.internal:5432/orders?sslmode=require'
printf '%s' "$DB_URL" | wc -c
printf '%s' "$DB_URL" | base64
```

```text
69
cG9zdGdyZXNxbDovL2FwcDpodW50ZXIyLXByb2RAZGIuaW50ZXJuYWw6NTQzMi9vcmRlcnM/c3Ns
bW9kZT1yZXF1aXJl
```

Now put it into a manifest the way many scripts do, with a [heredoc](/posts/how-cat-eof-works-in-bash):

```bash
cat <<EOF > secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-url
data:
  url: $(printf '%s' "$DB_URL" | base64)
EOF
kubectl create --dry-run=client -f secret.yaml -o yaml
```

```text
error: error parsing secret.yaml: error converting YAML to JSON: yaml: line 8: could not find expected ':'
```

The second line of the value landed at column 0, and YAML read it as a new key. In an env var or a CI variable the newline does not fail this loudly: it ends up inside the value. Turn wrapping off with `-w0`:

```bash
cat <<EOF > secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-url
data:
  url: $(printf '%s' "$DB_URL" | base64 -w0)
EOF
sed -n 's/^  url: //p' secret.yaml | base64 -d
```

```text
postgresql://app:hunter2-prod@db.internal:5432/orders?sslmode=require
```

Even simpler: let `kubectl create secret generic db-url --from-literal=url="$DB_URL" --dry-run=client -o yaml` write the manifest, and the encoding is never your problem.

### macOS and openssl

macOS ships a different `base64`. According to its [man page](https://keith.github.io/xcode-man-pages/bintrans.1), it does not wrap by default (`-b` sets a line length, and `-w` is accepted for GNU compatibility). Older macOS releases decode only with `-D`, and on them `-d` is a debug flag. A script that has to run on both should encode with a pipe that works everywhere:

```bash
printf '%s' "$DB_URL" | base64 | tr -d '\n'
```

```text
cG9zdGdyZXNxbDovL2FwcDpodW50ZXIyLXByb2RAZGIuaW50ZXJuYWw6NTQzMi9vcmRlcnM/c3NsbW9kZT1yZXF1aXJl
```

`openssl base64` is another option, but it wraps at 64 characters and has a sharper edge when decoding:

```bash
printf '%s' "$DB_URL" | openssl base64
printf '%s' "$DB_URL" | base64 -w0 | openssl base64 -d | wc -c; echo "rc=${PIPESTATUS[2]}"
printf '%s' "$DB_URL" | base64 -w0 | openssl base64 -d -A; echo
```

```text
cG9zdGdyZXNxbDovL2FwcDpodW50ZXIyLXByb2RAZGIuaW50ZXJuYWw6NTQzMi9v
cmRlcnM/c3NsbW9kZT1yZXF1aXJl
0
rc=0
postgresql://app:hunter2-prod@db.internal:5432/orders?sslmode=require
```

Without `-A`, OpenSSL 3.0 decoded our 92-character single line to **zero bytes and exit code 0**. No error, just an empty value. If you use `openssl base64` for single-line data, pass `-A` both ways.

## Bug 3: double encoding

`--from-literal`, `--from-file` and `stringData` all take plain text and encode it for you. Give them a value that is already encoded and it gets encoded again:

```bash
kubectl create secret generic db-creds \
  --from-literal=password="$(printf '%s' 'hunter2-prod' | base64)" \
  --dry-run=client -o jsonpath='{.data.password}'; echo

kubectl create secret generic db-creds \
  --from-literal=password="$(printf '%s' 'hunter2-prod' | base64)" \
  --dry-run=client -o jsonpath='{.data.password}' | base64 -d; echo
```

```text
YUhWdWRHVnlNaTF3Y205aw==
aHVudGVyMi1wcm9k
```

The pod now gets `aHVudGVyMi1wcm9k` as its password. The giveaway is a first decode that looks like base64 instead of the value you stored. Decode it again to confirm:

```bash
echo 'YUhWdWRHVnlNaTF3Y205aw==' | base64 -d | base64 -d; echo
```

```text
hunter2-prod
```

The rule: `data` takes base64, and `stringData`, `--from-literal` and `--from-file` take the raw value. In a Helm chart, `b64enc` belongs in `data:`, never in `stringData:`.

Not every double encoding is a bug. PEM is itself base64 with header lines, so a TLS Secret's `tls.crt` field is encoded twice on purpose:

```bash
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout tls.key -out tls.crt -days 30 -subj '/CN=orders.internal' 2>/dev/null
kubectl create secret tls orders-tls --cert=tls.crt --key=tls.key \
  --dry-run=client -o jsonpath='{.data.tls\.crt}' | cut -c1-40
kubectl create secret tls orders-tls --cert=tls.crt --key=tls.key \
  --dry-run=client -o jsonpath='{.data.tls\.crt}' | base64 -d | head -2
```

```text
LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1J
-----BEGIN CERTIFICATE-----
MIIBijCCAS+gAwIBAgIUazfeROKqRj7HLheO41+kH88CZagwCgYIKoZIzj0EAwIw
```

That `LS0tLS1CRUdJTi` prefix is the `-----BEGIN` from earlier. The `certificate-authority-data` field in a kubeconfig works the same way.

## base64url and JWTs

Two characters of the standard alphabet cause trouble outside of files. `+` means a space in a form-encoded query string, and `/` is a path separator. RFC 4648 defines a second alphabet, **base64url**, that uses `-` and `_` instead:

```bash
printf '\xfb\xff\xbf' | base64
printf '\xfb\xff\xbf' | basenc --base64url
```

```text
+/+/
-_-_
```

This is not only about odd bytes. The database URL from earlier encodes to `...cnM/c3Ns...` in standard base64 and `...cnM_c3Ns...` in base64url. In a URL path, that `/` splits the value in two.

JWTs use base64url and also drop the `=` padding ([RFC 7515](https://www.rfc-editor.org/rfc/rfc7515#section-2)). This script, saved as `make-jwt.sh`, builds a real HS256 token with shell tools:

```bash
#!/usr/bin/env bash
set -euo pipefail

b64url() { basenc --base64url -w0 | tr -d '='; }

header=$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)
payload=$(printf '%s' '{"sub":"deploy-bot","role":"admin","exp":1793318400}' | b64url)
signature=$(printf '%s' "$header.$payload" \
  | openssl dgst -sha256 -hmac 'not-a-real-key' -binary | b64url)

echo "$header.$payload.$signature"
```

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXBsb3ktYm90Iiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzkzMzE4NDAwfQ.mirpAmeTzGcS59Fo6JImIz4IBPSFSqpDJy1qltzzzuA
```

Both JSON parts start with `eyJ`. Now try to read the payload the obvious way:

```bash
chmod +x make-jwt.sh
TOKEN=$(./make-jwt.sh)
echo "$TOKEN" | cut -d. -f2 | base64 -d; echo " rc=$?"
```

```text
{"sub":"deploy-bot","role":"admin","exp":1793318400}base64: invalid input
 rc=1
```

The payload part is 70 characters, not a multiple of 4, so GNU `base64` prints what it could decode and then exits with 1. The JSON looks complete, which makes this easy to miss: under `set -e` the script stops here, and without it the script carries on with output that may be cut short. `basenc --base64url -d` fails the same way, because it also expects padding. Translate the alphabet and put the padding back first:

```bash
b64url_decode() {
  local s
  s=$(tr '_-' '/+')               # back to the standard alphabet
  case $(( ${#s} % 4 )) in        # put the stripped padding back
    2) s="$s==" ;;
    3) s="$s=" ;;
  esac
  printf '%s' "$s" | base64 -d
}

echo "$TOKEN" | cut -d. -f2 | b64url_decode; echo
echo "$TOKEN" | cut -d. -f1 | b64url_decode; echo
```

```text
{"sub":"deploy-bot","role":"admin","exp":1793318400}
{"alg":"HS256","typ":"JWT"}
```

In Python, `base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))` does the same in one line.

Anyone holding a signed JWT like this one can read its claims, because they are only base64url. The signature stops people from changing them, not from reading them, so never put a secret in a JWT payload. (Encrypted JWTs, JWE, are a different format with five parts.) For a quick look at a token, our [JWT decoder](/tools/jwt-decoder) runs in the browser, and the [base64 tool](/tools/base64) does the same for plain values.

## Data URIs

A data URI puts a whole file inside a URL: `data:<media type>;base64,<data>`. Browsers then skip the extra request. We built one from this site's 180x180 Apple touch icon, saved as `icon.png`:

```bash
wc -c < icon.png
printf 'data:image/png;base64,%s' "$(base64 -w0 icon.png)" | wc -c
printf 'data:image/png;base64,%s' "$(base64 -w0 icon.png)" | cut -c1-60
```

```text
1167
1578
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAA
```

1,167 bytes became 1,578 characters: the 33% plus the 22-character prefix. Use `-w0` again so the URI stays on one line in HTML or CSS. The image also loses its own cache entry and is downloaded again with every page or stylesheet that inlines it. That is fine for a few small icons and bad for anything large or shared across pages.

For SVG, which is already text, base64 is not always the best choice. Our 110-byte SVG made a 174-character base64 data URI and a 143-character URL-encoded one (`data:image/svg+xml,%3Csvg ...`, with single quotes inside the SVG).

## Summary

Base64 is a fixed mapping from bytes to 64 safe characters. It makes binary data fit in text formats, costs a third more space, and hides nothing. The bugs come from a short list of mistakes:

- **Base64 does not protect Secrets.** RBAC, encryption at rest and keeping values out of Git do.
- **`echo` adds a newline.** Use `printf '%s'` and check suspect values with `base64 -d | od -c`.
- **GNU `base64` wraps at 76 characters.** Use `-w0`, or `| tr -d '\n'` where macOS is involved. With `openssl base64`, pass `-A` both ways.
- **`data` takes base64; `stringData`, `--from-literal` and `--from-file` take raw values.** If the first decode still looks like base64, check for double encoding.
- **JWTs use base64url without padding.** Swap `-_` back to `+/` and restore the `=` before decoding.
- **Check the exit code of `base64 -d`.** GNU prints partial output before it fails, and the Rust coreutils in Ubuntu 26.10 [behave differently on bad input](/posts/ubuntu-26-10-rust-coreutils-what-changes).
