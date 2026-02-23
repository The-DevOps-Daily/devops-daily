---
title: 'SBOM Fundamentals'
description: 'Learn to generate and manage Software Bills of Materials (SBOM) using Syft, CycloneDX, and SPDX formats. Track dependencies and respond to vulnerabilities.'
---

# SBOM Fundamentals

A Software Bill of Materials (SBOM) is a machine-readable inventory of all components in your software. Think of it as an ingredients list for your application—essential for vulnerability tracking, license compliance, and incident response.

## Why SBOMs Matter

### The Log4Shell Response

When Log4Shell (CVE-2021-44228) was announced in December 2021, organizations faced a critical question:

**\"Do we use Log4j? Where? What version?\"**

Organizations with SBOMs answered in minutes. Those without spent days:

```bash
# With SBOM
grype sbom:app-v1.0.0.json | grep log4j
# Instant answer

# Without SBOM
find . -name '*log4j*.jar'  # Incomplete
grep -r 'log4j' pom.xml     # Misses transitive deps
# Hours of manual searching
```

### Regulatory Requirements

- **Executive Order 14028 (US)**: Federal software requires SBOMs
- **FDA Medical Devices**: SBOM required for approval
- **NTIA Minimum Elements**: Industry standard for SBOM content

## SBOM Formats

### 1. SPDX (Software Package Data Exchange)

Linux Foundation standard, ISO/IEC 5962:2021

```json
{
  \"SPDXID\": \"SPDXRef-DOCUMENT\",
  \"spdxVersion\": \"SPDX-2.3\",
  \"name\": \"my-app-v1.0.0\",
  \"packages\": [
    {
      \"SPDXID\": \"SPDXRef-Package-express\",
      \"name\": \"express\",
      \"versionInfo\": \"4.18.2\",
      \"licenseConcluded\": \"MIT\",
      \"externalRefs\": [
        {
          \"referenceCategory\": \"PACKAGE-MANAGER\",
          \"referenceType\": \"purl\",
          \"referenceLocator\": \"pkg:npm/express@4.18.2\"
        }
      ]
    }
  ]
}
```

### 2. CycloneDX

OWASP project, optimized for security use cases

```json
{
  \"bomFormat\": \"CycloneDX\",
  \"specVersion\": \"1.5\",
  \"version\": 1,
  \"components\": [
    {
      \"type\": \"library\",
      \"name\": \"express\",
      \"version\": \"4.18.2\",
      \"purl\": \"pkg:npm/express@4.18.2\",
      \"licenses\": [{ \"license\": { \"id\": \"MIT\" }}],
      \"hashes\": [
        {
          \"alg\": \"SHA-256\",
          \"content\": \"39ef...\"
        }
      ]
    }
  ]
}
```

**Comparison:**

| Aspect | SPDX | CycloneDX |
|--------|------|----------|
| **Focus** | Licensing & compliance | Security & vulnerabilities |
| **Standard** | ISO/IEC 5962 | OWASP |
| **Adoption** | Widely used in open source | Growing in security tools |
| **Vulnerabilities** | Basic support | Rich VEX integration |

**Recommendation**: Use CycloneDX for security-focused workflows, SPDX for compliance.

## Generating SBOMs

### Syft (Recommended)

Anchore's Syft generates SBOMs for containers, filesystems, and archives:

```bash
# Install
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh

# Generate SBOM for Docker image
syft ghcr.io/myorg/myapp:v1.0.0 -o cyclonedx-json > sbom.json

# For local directory
syft dir:. -o spdx-json > sbom-spdx.json

# For Git repository
syft git:https://github.com/myorg/myapp -o cyclonedx-json
```

**Supported ecosystems:**
- Alpine (apk)
- C/C++ (conan)
- Dart (pub)
- Debian (dpkg)
- Golang (go.mod)
- Java (Maven, Gradle)
- JavaScript (npm, yarn, pnpm)
- PHP (composer)
- Python (pip, poetry)
- Ruby (gem)
- Rust (Cargo)

### CycloneDX CLI

```bash
# Node.js
npx @cyclonedx/cyclonedx-npm --output-file sbom.json

# Python
pip install cyclonedx-bom
cyclonedx-py -o sbom.json

# Maven
mvn org.cyclonedx:cyclonedx-maven-plugin:makeAggregateBom
```

### GitHub Dependency Graph

GitHub auto-generates SBOMs for repositories:

```bash
# Export via API
curl -H \"Authorization: token $GITHUB_TOKEN\" \\
  https://api.github.com/repos/myorg/myapp/dependency-graph/sbom \\
  > sbom.json
```

## SBOM in CI/CD

### GitHub Actions

```yaml
name: Generate SBOM

on:
  push:
    branches: [main]
  release:
    types: [created]

jobs:
  sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .
      
      - name: Install Syft
        run: |
          curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
      
      - name: Generate SBOM
        run: |
          syft myapp:${{ github.sha }} \\
            -o cyclonedx-json \\
            -o spdx-json \\
            --file sbom-cyclonedx.json \\
            --file sbom-spdx.json
      
      - name: Upload SBOM as artifact
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom-*.json
      
      - name: Attach to release
        if: github.event_name == 'release'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release upload ${{ github.event.release.tag_name }} \\
            sbom-cyclonedx.json \\
            sbom-spdx.json
```

### GitLab CI

```yaml
sbom:
  stage: build
  image: anchore/syft:latest
  script:
    - syft $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -o cyclonedx-json > sbom.json
  artifacts:
    reports:
      cyclonedx: sbom.json
```

## Using SBOMs

### 1. Vulnerability Scanning

```bash
# Grype scans SBOM for vulnerabilities
grype sbom:sbom.json

# Output
NAME      INSTALLED  VULNERABILITY   SEVERITY
express   4.17.1     CVE-2022-24999  High
log4j     2.14.1     CVE-2021-44228  Critical
```

### 2. License Compliance

```bash
# Extract licenses
jq '.components[] | {name, version, license: .licenses[0].license.id}' sbom.json

# Check for GPL licenses
jq '.components[] | select(.licenses[0].license.id | contains(\"GPL\"))' sbom.json
```

### 3. Dependency Search

```bash
# Find all uses of a specific package
jq '.components[] | select(.name == \"log4j-core\")' sbom.json

# List all direct vs transitive dependencies
jq '.dependencies[]' sbom.json
```

### 4. SBOM Diff

```bash
# Compare two SBOMs
syft sbom.v1.json -o json | jq '.artifacts[].name' > v1-deps.txt
syft sbom.v2.json -o json | jq '.artifacts[].name' > v2-deps.txt
diff v1-deps.txt v2-deps.txt
```

## SBOM Quality

### NTIA Minimum Elements

US National Telecommunications and Information Administration standard:

**Required fields:**
- Author/Supplier name
- Component name
- Version
- Dependency relationships
- Timestamp
- Unique identifiers (PURL, CPE)

**Validation:**

```bash
# NTIA Conformance Checker
ntia-conformance-checker sbom.json
```

### SBOM Depth

```plaintext
Depth 0: Application only
Depth 1: Direct dependencies
Depth 2: Transitive dependencies
Depth 3+: Full dependency tree
```

**Best practice**: Generate depth 3+ SBOMs (full tree)

## Storage and Distribution

### Option 1: Artifact Registry

```bash
# Push SBOM alongside image
docker tag myapp:v1.0.0 ghcr.io/myorg/myapp:v1.0.0
docker push ghcr.io/myorg/myapp:v1.0.0

# Store SBOM as OCI artifact
oci-push sbom.json ghcr.io/myorg/myapp:v1.0.0-sbom
```

### Option 2: Separate Repository

```bash
# Dedicated SBOM repo
gh repo create myorg/sboms --private
git clone https://github.com/myorg/sboms.git
cp sbom.json sboms/myapp-v1.0.0.json
cd sboms && git add . && git commit -m \"Add myapp v1.0.0 SBOM\" && git push
```

### Option 3: Release Assets

Attach to GitHub/GitLab releases (shown in CI/CD example above)

## SBOM Tools Ecosystem

### Generation
- **Syft** (multi-language)
- **CycloneDX plugins** (Maven, npm, etc.)
- **SPDX tools** (sbom-tool, spdx-sbom-generator)

### Analysis
- **Grype** (vulnerability scanning)
- **Dependency-Track** (SBOM repository & analysis)
- **GUAC** (Graph for Understanding Artifact Composition)

### Validation
- **ntia-conformance-checker** (NTIA compliance)
- **sbom-scorecard** (SBOM quality scoring)

## Best Practices

1. **Generate on every build**
   - Automate SBOM generation in CI/CD
   - Store SBOMs with artifacts

2. **Include all depths**
   - Don't stop at direct dependencies
   - Transitive dependencies matter

3. **Use standard formats**
   - CycloneDX or SPDX
   - Avoid custom formats

4. **Sign your SBOMs**
   ```bash
   cosign sign-blob sbom.json --bundle sbom.json.bundle
   ```

5. **Make SBOMs discoverable**
   - Public location (releases, website)
   - Standard naming (sbom.json, SBOM.spdx)

6. **Update regularly**
   - Regenerate on dependency changes
   - Track SBOM versions

7. **Integrate with vulnerability scanning**
   - Scan SBOMs, not just code
   - Automate alerts

## Next Steps

- **[Artifact Signing with Sigstore](./02-sigstore)** — Cryptographically sign SBOMs and artifacts
- **[SLSA Framework](./03-slsa)** — Add build provenance
- **[CI/CD Integration](./04-cicd)** — Automate the entire supply chain

---

**Key takeaway**: Start generating SBOMs today. When the next Log4Shell happens, you'll be ready.
