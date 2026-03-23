---
title: 'How to Implement Progressive Delivery with Feature Flags'
excerpt: 'Learn how to implement progressive delivery using feature flags, canary releases, and gradual rollouts to ship changes safely in production without risking your entire user base.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-03-23'
publishedAt: '2026-03-23T09:00:00Z'
updatedAt: '2026-03-23T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - feature-flags
  - progressive-delivery
  - cicd
  - canary-releases
  - deployment-strategies
  - devops
---

Deploying code to production does not have to be an all-or-nothing event. Traditional deployment strategies push changes to every user at once, which means a single bug can bring down your entire application. Progressive delivery changes that equation by decoupling **deployment** (putting code on servers) from **release** (exposing features to users). At the heart of this approach are **feature flags**, which give you fine-grained control over who sees what and when.

In this guide, you will learn how to implement progressive delivery using feature flags, canary releases, and percentage-based rollouts. By the end, you will have a working strategy for shipping changes to production safely and confidently.

## TL;DR

- Progressive delivery separates deployment from release, letting you control feature exposure independently
- Feature flags act as runtime switches that determine which users see new functionality
- Canary releases expose changes to a small subset of users before a full rollout
- Percentage-based rollouts let you gradually increase traffic to a new feature
- Combine feature flags with observability to detect issues early and roll back instantly

## Prerequisites

- Familiarity with CI/CD pipelines and deployment processes
- Basic understanding of application configuration and environment variables
- A running application with a deployment pipeline (examples use Node.js and Kubernetes)
- Access to a feature flag service (we will cover both self-hosted and managed options)

## What Is Progressive Delivery?

Progressive delivery is an evolution of continuous delivery that gives teams control over how changes reach users. Instead of flipping a switch and hoping for the best, you roll out features gradually while monitoring key metrics at every step.

The core idea looks like this:

```text
Traditional Deployment:
  Deploy ──► 100% of users get the change immediately

Progressive Delivery:
  Deploy ──► 1% canary ──► 10% rollout ──► 50% rollout ──► 100% GA
                │              │                │
                ▼              ▼                ▼
           Monitor &      Monitor &        Monitor &
           Validate       Validate         Validate
```

Progressive delivery builds on three key concepts:

- **Feature flags**: Runtime toggles that control feature visibility without redeployment
- **Canary releases**: Routing a small percentage of traffic to the new version
- **Gradual rollouts**: Incrementally increasing the percentage of users who see the change

## Setting Up Feature Flags

Feature flags can range from simple environment variables to sophisticated evaluation engines. Let's start with a basic implementation and work up to production-grade solutions.

### A Simple Feature Flag Implementation

At its simplest, a feature flag is a conditional check:

```javascript
// config/flags.js
const flags = {
  newCheckoutFlow: {
    enabled: false,
    rolloutPercentage: 0,
    allowedUsers: [],
  },
  improvedSearch: {
    enabled: true,
    rolloutPercentage: 25,
    allowedUsers: ['beta-testers'],
  },
};

function isFeatureEnabled(flagName, userId) {
  const flag = flags[flagName];
  if (!flag || !flag.enabled) return false;

  // Check if user is in the allowed list
  if (flag.allowedUsers.includes(userId)) return true;

  // Percentage-based rollout using consistent hashing
  const hash = simpleHash(`${flagName}-${userId}`);
  return (hash % 100) < flag.rolloutPercentage;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

module.exports = { isFeatureEnabled };
```

The consistent hashing approach is important here. It ensures that a given user always gets the same result for a specific flag, so they do not bounce between the old and new experiences on every request.

### Using Feature Flags in Application Code

Once you have the evaluation logic, wrap your features:

```javascript
const { isFeatureEnabled } = require('./config/flags');

app.get('/checkout', (req, res) => {
  const userId = req.user.id;

  if (isFeatureEnabled('newCheckoutFlow', userId)) {
    // New checkout experience
    return res.render('checkout-v2', {
      steps: getStreamlinedSteps(),
      paymentMethods: getExpandedPaymentMethods(),
    });
  }

  // Existing checkout experience
  return res.render('checkout', {
    steps: getStandardSteps(),
    paymentMethods: getStandardPaymentMethods(),
  });
});
```

### Production-Grade Feature Flag Services

For production workloads, you will want a dedicated feature flag service rather than hardcoded configuration. Several options exist:

| Service | Type | Best For |
|---------|------|----------|
| LaunchDarkly | Managed SaaS | Enterprise teams needing advanced targeting |
| Unleash | Self-hosted (OSS) | Teams wanting full control over their data |
| Flagsmith | Both | Flexible deployment with open-source core |
| OpenFeature | SDK Standard | Vendor-neutral feature flag abstraction |

Here is an example using **OpenFeature** with the Flagsmith provider, which gives you vendor independence:

```javascript
const { OpenFeature } = require('@openfeature/server-sdk');
const { FlagsmithProvider } = require('@openfeature/flagsmith-provider');

// Initialize with your provider of choice
await OpenFeature.setProviderAndWait(
  new FlagsmithProvider({ environmentKey: process.env.FLAGSMITH_KEY })
);

const client = OpenFeature.getClient();

app.get('/search', async (req, res) => {
  // Evaluate flag with user context
  const useNewSearch = await client.getBooleanValue(
    'improved-search',
    false, // default value
    { targetingKey: req.user.id, region: req.user.region }
  );

  if (useNewSearch) {
    return handleImprovedSearch(req, res);
  }
  return handleStandardSearch(req, res);
});
```

## Implementing Canary Releases

Canary releases route a small percentage of production traffic to the new version of your service. This is different from feature flags in that it operates at the **infrastructure level** rather than the application level.

### Canary Releases with Kubernetes

If you are running on Kubernetes, you can implement canary releases using multiple deployments with weighted traffic splitting. Here is an example using a stable deployment alongside a canary:

```yaml
# stable-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-service-stable
  labels:
    app: checkout-service
    track: stable
spec:
  replicas: 9  # 90% of traffic
  selector:
    matchLabels:
      app: checkout-service
      track: stable
  template:
    metadata:
      labels:
        app: checkout-service
        track: stable
    spec:
      containers:
        - name: checkout
          image: checkout-service:v1.4.0
          ports:
            - containerPort: 8080
---
# canary-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-service-canary
  labels:
    app: checkout-service
    track: canary
spec:
  replicas: 1  # 10% of traffic
  selector:
    matchLabels:
      app: checkout-service
      track: canary
  template:
    metadata:
      labels:
        app: checkout-service
        track: canary
    spec:
      containers:
        - name: checkout
          image: checkout-service:v1.5.0  # New version
          ports:
            - containerPort: 8080
---
# service.yaml - Routes to both stable and canary
apiVersion: v1
kind: Service
metadata:
  name: checkout-service
spec:
  selector:
    app: checkout-service  # Matches both tracks
  ports:
    - port: 80
      targetPort: 8080
```

### Automated Canary Analysis with Argo Rollouts

For more sophisticated canary management, **Argo Rollouts** provides automated progressive delivery with metric-based promotion:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: checkout-service
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        # Step 1: Send 5% of traffic to canary
        - setWeight: 5
        - pause: { duration: 5m }

        # Step 2: Run automated analysis
        - analysis:
            templates:
              - templateName: canary-success-rate
            args:
              - name: service-name
                value: checkout-service

        # Step 3: Increase to 25%
        - setWeight: 25
        - pause: { duration: 10m }

        # Step 4: Analyze again at higher traffic
        - analysis:
            templates:
              - templateName: canary-success-rate

        # Step 5: Increase to 50%
        - setWeight: 50
        - pause: { duration: 15m }

        # Step 6: Final analysis before full rollout
        - analysis:
            templates:
              - templateName: canary-success-rate

        # If all analyses pass, promote to 100%
      canaryService: checkout-canary
      stableService: checkout-stable
  selector:
    matchLabels:
      app: checkout-service
  template:
    metadata:
      labels:
        app: checkout-service
    spec:
      containers:
        - name: checkout
          image: checkout-service:v1.5.0
          ports:
            - containerPort: 8080
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: canary-success-rate
spec:
  args:
    - name: service-name
  metrics:
    - name: success-rate
      # Query Prometheus for the canary's error rate
      interval: 60s
      successCondition: result[0] >= 0.99
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{
              service="{{args.service-name}}",
              status=~"2..",
              track="canary"
            }[2m]))
            /
            sum(rate(http_requests_total{
              service="{{args.service-name}}",
              track="canary"
            }[2m]))
```

This configuration automatically promotes the canary through each stage only if the success rate stays at or above 99%. If the metric drops below that threshold three times, the rollout automatically rolls back.

## Combining Feature Flags with Canary Releases

The most effective progressive delivery strategies combine both approaches. Feature flags handle application-level control, while canary releases manage infrastructure-level traffic splitting:

```text
┌─────────────────────────────────────────────────┐
│              Progressive Delivery                │
│                                                  │
│  Infrastructure Layer (Canary)                   │
│  ┌──────────────┐    ┌──────────────┐           │
│  │  Stable v1.4 │    │ Canary v1.5  │           │
│  │   90% traffic│    │  10% traffic │           │
│  └──────┬───────┘    └──────┬───────┘           │
│         │                   │                    │
│  Application Layer (Feature Flags)               │
│  ┌──────┴───────────────────┴───────┐           │
│  │  Feature: new-checkout-flow      │           │
│  │  ├── 50% of canary users see it  │           │
│  │  └── 0% of stable users see it   │           │
│  └──────────────────────────────────┘           │
│                                                  │
│  Net exposure: 10% × 50% = 5% of all users     │
└─────────────────────────────────────────────────┘
```

This layered approach gives you extremely fine-grained control. You can test infrastructure changes (new container image) on the canary while also controlling which specific features within that image are active.

## Monitoring and Rollback Strategy

Progressive delivery is only as good as your ability to detect problems. You need observability in place **before** you start rolling out.

### Key Metrics to Monitor

Track these metrics at every rollout stage:

```yaml
# Example Prometheus alerting rules for canary monitoring
groups:
  - name: canary-alerts
    rules:
      # Error rate spike
      - alert: CanaryHighErrorRate
        expr: |
          (
            sum(rate(http_requests_total{track="canary",status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total{track="canary"}[5m]))
          ) > 0.02
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Canary error rate above 2%"

      # Latency degradation
      - alert: CanaryHighLatency
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket{track="canary"}[5m]))
            by (le)
          ) > 1.5
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "Canary p99 latency above 1.5s"
```

### Automated Rollback

Configure your feature flag system to automatically disable flags when metrics breach thresholds:

```javascript
const { MetricWatcher } = require('./observability');

const watcher = new MetricWatcher({
  prometheusUrl: process.env.PROMETHEUS_URL,
});

// Watch error rates for flagged features
watcher.watch('newCheckoutFlow', {
  query: 'rate(checkout_errors_total{version="v2"}[5m])',
  threshold: 0.01, // 1% error rate
  action: async (flagName, currentValue) => {
    console.error(
      `Flag ${flagName} breached threshold: ${currentValue}. Disabling.`
    );
    await flagService.disable(flagName);

    // Notify the team
    await slack.send('#deployments', {
      text: `Auto-disabled flag "${flagName}" due to elevated error rate (${(currentValue * 100).toFixed(2)}%)`,
    });
  },
});
```

## A Complete Progressive Delivery Pipeline

Putting it all together, here is what a CI/CD pipeline with progressive delivery looks like:

```yaml
# .github/workflows/progressive-deploy.yml
name: Progressive Delivery

on:
  push:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - run: docker build -t checkout-service:${{ github.sha }} .
      - run: docker push checkout-service:${{ github.sha }}

  deploy-canary:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Update canary deployment
        run: |
          kubectl set image deployment/checkout-canary \
            checkout=checkout-service:${{ github.sha }}
          kubectl rollout status deployment/checkout-canary --timeout=120s

      - name: Enable feature flag for canary
        run: |
          curl -X PATCH "$FLAG_SERVICE_URL/api/flags/new-checkout-flow" \
            -H "Authorization: Bearer ${{ secrets.FLAG_SERVICE_TOKEN }}" \
            -d '{"rolloutPercentage": 5, "targetSegment": "canary"}'

      - name: Wait and validate metrics
        run: |
          sleep 300  # Wait 5 minutes for metrics to accumulate
          ERROR_RATE=$(curl -s "$PROMETHEUS_URL/api/v1/query" \
            --data-urlencode 'query=rate(http_errors_total{track="canary"}[5m])' \
            | jq '.data.result[0].value[1] // "0"' -r)
          if (( $(echo "$ERROR_RATE > 0.02" | bc -l) )); then
            echo "Canary error rate too high: $ERROR_RATE"
            exit 1
          fi

  promote-to-stable:
    needs: deploy-canary
    runs-on: ubuntu-latest
    steps:
      - name: Gradually increase rollout
        run: |
          for pct in 25 50 75 100; do
            curl -X PATCH "$FLAG_SERVICE_URL/api/flags/new-checkout-flow" \
              -H "Authorization: Bearer ${{ secrets.FLAG_SERVICE_TOKEN }}" \
              -d "{\"rolloutPercentage\": $pct}"
            echo "Rollout at ${pct}%, waiting for metrics..."
            sleep 300
          done

      - name: Update stable deployment
        run: |
          kubectl set image deployment/checkout-stable \
            checkout=checkout-service:${{ github.sha }}
          kubectl rollout status deployment/checkout-stable --timeout=300s
```

## Best Practices

As you adopt progressive delivery, keep these principles in mind:

1. **Start with observability**. You cannot progressively deliver what you cannot measure. Set up metrics, alerts, and dashboards before you flip your first flag.

2. **Keep flag lifecycles short**. Feature flags are not meant to live forever. Remove flags once a feature is fully rolled out. Stale flags become technical debt.

3. **Use consistent hashing for user assignment**. Users should have a stable experience. Randomly assigning on each request creates a confusing, inconsistent experience.

4. **Test both paths**. Your CI pipeline should test the application with flags both on and off. Untested flag combinations are a common source of production incidents.

5. **Separate operational flags from release flags**. Kill switches for degraded mode are different from gradual feature rollouts. Treat them differently in your tooling and processes.

6. **Automate rollback decisions**. Human reaction time is too slow for production incidents. Define metric thresholds and let your system roll back automatically when they are breached.

7. **Document flag ownership**. Every flag should have an owner and an expiration date. This prevents the accumulation of zombie flags that nobody is willing to remove.

## Summary

Progressive delivery transforms deployments from high-stakes events into routine, low-risk operations. By combining feature flags for application-level control with canary releases for infrastructure-level traffic management, you get a layered safety net that catches problems before they reach your entire user base.

The key steps to get started:

- Adopt a feature flag system (start with OpenFeature for vendor independence)
- Implement canary deployments in your infrastructure (Argo Rollouts is a great starting point for Kubernetes)
- Set up observability with automated rollback triggers
- Build a CI/CD pipeline that progresses through rollout stages automatically
- Establish processes for flag lifecycle management to prevent technical debt

Start small with a single non-critical feature, prove out the workflow, and then expand to your full deployment pipeline. The investment in progressive delivery pays for itself the first time you catch a bug at 5% rollout instead of discovering it at 100%.
