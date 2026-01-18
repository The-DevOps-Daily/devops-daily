---
title: 'Zero Trust Architecture'
description: 'Understand the "never trust, always verify" approach to modern security architecture.'
order: 4
---

Zero Trust is a security model based on the principle of "never trust, always verify." Unlike traditional perimeter-based security that assumes everything inside the network is safe, Zero Trust treats every request as potentially malicious—regardless of where it comes from.

## The Problem with Perimeter Security

Traditional security models assume:

- The network perimeter is secure
- Internal traffic is trustworthy
- VPN access grants full trust

This approach fails because:

- Remote work blurs the perimeter
- Cloud resources exist outside traditional networks
- Attackers who breach the perimeter move freely
- Insider threats are real

## Zero Trust Principles

### 1. Verify Explicitly

Always authenticate and authorize based on all available data:

- User identity
- Device health
- Location
- Service or workload
- Data classification
- Anomaly detection

### 2. Use Least Privilege Access

Limit access with just-in-time and just-enough-access (JIT/JEA):

- Time-limited access
- Risk-based adaptive policies
- Data protection controls

### 3. Assume Breach

Minimize blast radius and segment access:

- Micro-segmentation
- End-to-end encryption
- Continuous monitoring
- Automated threat detection

## Implementing Zero Trust

### Identity-Based Access

In Zero Trust, **identity is the new perimeter**. Instead of trusting traffic because it comes from inside the network, every request must prove who (or what) is making it. This applies to both users and services.

**JWT (JSON Web Tokens)** are the standard way to carry identity information. The token contains claims about the user/service and is cryptographically signed so it can't be forged.

```yaml
# Example: OAuth2/OIDC authentication for services
# This Istio configuration requires valid JWTs for all requests
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: jwt-auth
  namespace: production
spec:
  selector:
    matchLabels:
      app: api-gateway       # Apply to pods with this label
  jwtRules:
  - issuer: "https://auth.example.com"              # Who issued the token
    jwksUri: "https://auth.example.com/.well-known/jwks.json"  # Public keys to verify signature
    audiences:
    - "api.example.com"      # Token must be intended for this audience
```

**Important:** Authentication (who are you?) is separate from authorization (what can you do?). This config only verifies identity—you still need authorization policies.

### Service-to-Service Authentication (mTLS)

In a microservices architecture, services constantly communicate with each other. Without authentication, any compromised service can call any other service. **mTLS (mutual TLS)** solves this by requiring both sides of every connection to present certificates.

**How mTLS works:**
1. Service A connects to Service B
2. Service B presents its certificate (just like HTTPS)
3. Service A also presents its certificate (the "mutual" part)
4. Both services verify the other's certificate before communicating

```yaml
# Istio: Enforce mTLS for all services
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default            # Apply as default policy
  namespace: production    # In this namespace
spec:
  mtls:
    mode: STRICT           # Reject any non-mTLS connections
    # PERMISSIVE mode allows both mTLS and plain text (useful during migration)

---
# Authorization policy
# Even with mTLS, we must explicitly allow which services can talk to each other
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: payment-service-policy
  namespace: production
spec:
  selector:
    matchLabels:
      app: payment-service   # Apply to payment service pods
  action: ALLOW
  rules:
  - from:
    - source:
        principals:          # Only these identities can call payment-service
        - "cluster.local/ns/production/sa/order-service"      # Order service
        - "cluster.local/ns/production/sa/checkout-service"   # Checkout service
        # Any other service trying to call payment-service is blocked!
    to:
    - operation:
        methods: ["POST"]
        paths: ["/api/v1/payments"]
```

### Micro-Segmentation

Traditional network segmentation creates large zones (like "production" or "DMZ"). **Micro-segmentation** takes this further by creating individual security perimeters around each workload. Even if an attacker compromises one service, they can't move laterally to others.

**This is defense in depth applied to the network layer.** Each service explicitly declares what it can communicate with—everything else is blocked by default.

```yaml
# Kubernetes Network Policy for micro-segmentation
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: database          # This policy applies to database pods
  policyTypes:
  - Ingress                  # Control incoming traffic
  - Egress                   # Control outgoing traffic
  ingress:
  # Only backend pods can connect to the database
  - from:
    - podSelector:
        matchLabels:
          app: backend       # Only pods with app=backend label
    ports:
    - protocol: TCP
      port: 5432             # PostgreSQL port only
  egress:
  # Database only needs DNS - no external connections!
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53               # DNS only
  # Note: No egress to internet - if DB is compromised, it can't phone home
```

**Impact:** If an attacker exploits a vulnerability in your web frontend, they cannot directly access the database. They would need to first compromise the backend service, which has its own authentication and authorization.

### Device Trust

Zero Trust extends beyond network location to device health. A legitimate user on a compromised device is still a risk. **Device trust** verifies that the device itself meets security requirements before granting access.

**This is especially important for:**
- Remote workers using personal devices
- BYOD (Bring Your Own Device) policies
- Contractors and third-party access
- Privileged access to sensitive systems

```yaml
# Example: Conditional access policy
# User must pass all these checks before accessing resources
device_requirements:
  - os_minimum_version:          # Old OS versions have unpatched vulnerabilities
      windows: "10.0.19041"      # Windows 10 2004 or later
      macos: "11.0"
  - disk_encryption: required    # Protects data if device is lost/stolen
  - screen_lock: required        # Prevents unauthorized physical access
  - antivirus:                   # Basic malware protection
      enabled: true
      definitions_max_age_days: 7  # Must have recent definitions
  - firewall: enabled            # Network-level protection on the device
```

**Tools for implementing device trust:**
- **Microsoft Intune / Azure AD Conditional Access**
- **Google BeyondCorp / Context-Aware Access**
- **Okta Device Trust**
- **Kolide** (for Slack-based remediation)

### Continuous Verification

Traditional security verifies identity once at login, then trusts the session for hours or days. Zero Trust flips this: **verify on every request**. Sessions can be hijacked, devices can be compromised mid-session, and user behavior can indicate account takeover.

**Continuous verification includes:**
- Token validation on every request
- Behavioral analysis (unusual access patterns)
- Real-time device health checks
- Location and time-based anomaly detection

```python
# Example: Session validation middleware
class ZeroTrustMiddleware:
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, request):
        # Step 1: Verify token on every request (not just at login)
        token = request.headers.get('Authorization')
        if not await self.validate_token(token):
            return Response(status=401)
        
        # Step 2: Behavioral analysis - does this look like the real user?
        if await self.detect_anomaly(request):
            await self.alert_security_team(request)  # Don't just block - investigate
            return Response(status=403)
        
        # Step 3: Is the device still compliant? (not just at enrollment)
        device_id = request.headers.get('X-Device-ID')
        if not await self.check_device_compliance(device_id):
            return Response(status=403, body="Device not compliant")
        
        return await self.app(request)
    
    async def detect_anomaly(self, request):
        """Detect suspicious behavior that might indicate compromised credentials"""
        user = request.user
        current_location = request.geo_location
        last_location = await self.get_last_location(user)
        
        # Impossible travel: User in NYC, then Tokyo 10 minutes later?
        if self.is_impossible_travel(last_location, current_location):
            return True
        
        # Unusual access time: Developer accessing prod at 3am?
        if not self.is_normal_access_time(user):
            return True
        
        return False
```

**Performance consideration:** Continuous verification adds overhead. Use caching wisely (cache device compliance for minutes, not hours) and design checks to fail open for non-critical resources during outages.

## Zero Trust for CI/CD Pipelines

CI/CD pipelines are high-value targets—they have production access and can deploy arbitrary code. Apply Zero Trust principles here too: no long-lived credentials, explicit authorization, and audit logging.

**Key principles for CI/CD Zero Trust:**
- Use short-lived, automatically rotated credentials
- Authenticate pipelines with OIDC tokens instead of static secrets
- Limit what each workflow can deploy and where
- Require approval for production deployments

```yaml
# GitHub Actions with OIDC authentication
# No static AWS credentials stored in GitHub!
name: Deploy
on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    # Authenticate using OIDC - no stored credentials
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
        aws-region: us-east-1
    
    # Verify artifacts before deployment
    - name: Verify container signature
      run: |
        cosign verify \
          --key cosign.pub \
          ${{ env.REGISTRY }}/${{ env.IMAGE }}:${{ github.sha }}
    
    - name: Deploy to EKS
      run: kubectl apply -f k8s/
```

## Zero Trust Network Architecture

```
TRADITIONAL MODEL:              ZERO TRUST MODEL:

+-------------------+           +-------------------+
|     INTERNET      |           |     INTERNET      |
+--------+----------+           +--------+----------+
         |                               |
    +----v----+                    +-----v-----+
    | Firewall|                    |  Identity |
    +----+----+                    |   Proxy   |
         |                         +-----+-----+
+--------v----------+                    |
|  Trusted Network  |             +------v------+
|                   |             |   Policy    |
|  +---+ +---+ +---+|             |   Engine    |
|  | A | | B | | C ||             +------+------+
|  +---+ +---+ +---+|                    |
|  (all can talk)   |          +---------+---------+
+-------------------+          |         |         |
                             +-v-+     +-v-+     +-v-+
                             | A |     | B |     | C |
                             +---+     +---+     +---+
                             (isolated, verified)
```

## Zero Trust Implementation Checklist

```bash
# Identity
- [ ] Strong authentication (MFA) for all users
- [ ] Service-to-service authentication (mTLS)
- [ ] Short-lived credentials and tokens
- [ ] Regular access reviews

# Device
- [ ] Device health verification
- [ ] Endpoint detection and response (EDR)
- [ ] Mobile device management (MDM)
- [ ] Certificate-based device identity

# Network
- [ ] Micro-segmentation
- [ ] Encrypted traffic (TLS everywhere)
- [ ] No implicit trust based on network location
- [ ] Software-defined perimeter

# Application
- [ ] Per-request authorization
- [ ] Input validation
- [ ] Secure API design
- [ ] Runtime application self-protection (RASP)

# Data
- [ ] Data classification
- [ ] Encryption at rest and in transit
- [ ] Data loss prevention (DLP)
- [ ] Access logging and monitoring

# Visibility
- [ ] Centralized logging
- [ ] User and entity behavior analytics (UEBA)
- [ ] Security information and event management (SIEM)
- [ ] Continuous monitoring and alerting
```

## Common Zero Trust Mistakes

### Mistake 1: Treating it as a Product

Zero Trust is a strategy, not a product you can buy. It requires:

- Cultural change
- Process updates
- Multiple technologies working together

### Mistake 2: Big Bang Implementation

Don't try to implement everything at once:

```
Phase 1: Identity
  → Implement strong authentication
  → Add MFA everywhere
  
Phase 2: Device
  → Device health checks
  → Endpoint security
  
Phase 3: Network
  → Micro-segmentation
  → mTLS between services
  
Phase 4: Data
  → Classification
  → DLP implementation
```

### Mistake 3: Ignoring User Experience

Security shouldn't make work impossible:

- Implement SSO to reduce friction
- Use risk-based authentication
- Provide clear error messages
- Have a support process for edge cases

## Key Takeaways

- Zero Trust means "never trust, always verify"
- Identity is the new perimeter, not the network
- Every access request must be authenticated, authorized, and encrypted
- Assume breach and minimize blast radius
- Implement incrementally, starting with identity
- Continuous monitoring is essential for Zero Trust

## Practice Exercise

Assess your current Zero Trust readiness:

1. Map your current authentication methods for users and services
2. Identify where network location grants implicit trust
3. Review your network segmentation (or lack thereof)
4. Create a phased plan to implement Zero Trust principles
5. Identify quick wins that can be implemented immediately
