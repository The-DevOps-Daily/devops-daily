---
title: 'Day 11 - Basic Observability'
day: 11
excerpt: 'Set up monitoring and logging for your Kubernetes application with Prometheus and Grafana.'
description: 'Implement observability fundamentals: metrics collection with Prometheus, visualization with Grafana, and centralized logging.'
publishedAt: '2025-12-11T00:00:00Z'
updatedAt: '2026-04-19T00:00:00Z'
difficulty: 'Intermediate'
category: 'Observability'
tags:
  - Prometheus
  - Grafana
  - Monitoring
  - Logging
---

## Description

Your application is running in Kubernetes, but you have no visibility into its health, performance, or behavior. When something goes wrong, you're flying blind. Time to add observability with metrics, dashboards, and logs.

## Task

Set up basic observability for your Kubernetes application.

**Requirements:**
- Deploy Prometheus for metrics collection
- Deploy Grafana for visualization
- Configure application metrics
- Create basic dashboards
- Set up centralized logging

## Target

- ✅ Prometheus collecting metrics
- ✅ Grafana dashboards showing application health
- ✅ Application exposing custom metrics
- ✅ Logs aggregated and searchable
- ✅ Basic alerts configured

## Sample App

### Application with Metrics

#### app-with-metrics.js

```javascript
const express = require('express');
const promClient = require('prom-client');

const app = express();
const port = process.env.PORT || 3000;

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeConnections);

// Middleware to track requests
app.use((req, res, next) => {
  const start = Date.now();
  activeConnections.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.route?.path || req.path, res.statusCode).observe(duration);
    httpRequestTotal.labels(req.method, req.route?.path || req.path, res.statusCode).inc();
    activeConnections.dec();
  });

  next();
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Sample endpoints
app.get('/', (req, res) => {
  console.log('INFO: Home page accessed');
  res.json({ message: 'Hello World', timestamp: new Date().toISOString() });
});

app.get('/api/data', (req, res) => {
  console.log('INFO: Data endpoint accessed');
  res.json({ data: [1, 2, 3, 4, 5] });
});

app.get('/api/slow', async (req, res) => {
  console.log('WARN: Slow endpoint accessed');
  await new Promise(resolve => setTimeout(resolve, 2000));
  res.json({ message: 'This was slow' });
});

app.listen(port, () => {
  console.log(`INFO: Server started on port ${port}`);
});
```

#### package.json

```json
{
  "name": "observable-app",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0",
    "prom-client": "^15.0.0"
  }
}
```

## Solution

### 1. Deploy Prometheus Stack

#### Install with Helm

```bash
# Add Prometheus Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack (Prometheus + Grafana + Alertmanager)
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set grafana.adminPassword=admin123
```

### 2. Configure ServiceMonitor

```yaml
# servicemonitor.yaml
apiVersion: v1
kind: Service
metadata:
  name: demo-app-metrics
  namespace: demo-app
  labels:
    app: demo-app
spec:
  selector:
    app: demo-app
  ports:
  - name: metrics
    port: 3000
    targetPort: 3000
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: demo-app
  namespace: monitoring
  labels:
    app: demo-app
    release: monitoring
spec:
  selector:
    matchLabels:
      app: demo-app
  namespaceSelector:
    matchNames:
    - demo-app
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s
```

### 3. Grafana Dashboard

#### dashboard-configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: demo-app-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  demo-app.json: |
    {
      "dashboard": {
        "title": "Demo App Metrics",
        "panels": [
          {
            "title": "HTTP Request Rate",
            "targets": [
              {
                "expr": "rate(http_requests_total{namespace=\"demo-app\"}[5m])",
                "legendFormat": "{{method}} {{route}}"
              }
            ],
            "type": "graph"
          },
          {
            "title": "Request Duration (p95)",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{namespace=\"demo-app\"}[5m]))",
                "legendFormat": "{{route}}"
              }
            ],
            "type": "graph"
          },
          {
            "title": "Active Connections",
            "targets": [
              {
                "expr": "active_connections{namespace=\"demo-app\"}",
                "legendFormat": "{{pod}}"
              }
            ],
            "type": "graph"
          },
          {
            "title": "Error Rate",
            "targets": [
              {
                "expr": "rate(http_requests_total{namespace=\"demo-app\",status_code=~\"5..\"}[5m])",
                "legendFormat": "5xx errors"
              }
            ],
            "type": "graph"
          }
        ]
      }
    }
```

### 4. Logging with Loki

#### Install Loki Stack

```bash
# Add Grafana Helm repository
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Loki stack (Loki + Promtail)
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set grafana.enabled=false \
  --set promtail.enabled=true
```

### 5. PrometheusRule for Alerts

```yaml
# prometheusrule.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: demo-app-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
  - name: demo-app
    interval: 30s
    rules:
    - alert: HighErrorRate
      expr: |
        rate(http_requests_total{namespace="demo-app",status_code=~"5.."}[5m]) > 0.05
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ $value }} errors/sec"

    - alert: HighResponseTime
      expr: |
        histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{namespace="demo-app"}[5m])) > 2
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High response time"
        description: "P95 response time is {{ $value }}s"

    - alert: PodDown
      expr: |
        up{namespace="demo-app"} == 0
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "Pod is down"
        description: "Pod {{ $labels.pod }} is down"
```

## Explanation

### The Three Pillars of Observability

#### 1. Metrics (Prometheus)

**What:** Numerical measurements over time

**Types:**
- **Counter:** Only increases (e.g., total requests)
- **Gauge:** Can go up or down (e.g., active connections)
- **Histogram:** Distributions (e.g., response times)
- **Summary:** Similar to histogram, client-side quantiles

**Example:**
```javascript
const counter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'status_code']
});

counter.labels('GET', '200').inc();
```

#### 2. Logs (Loki)

**What:** Event records with timestamps

**Best practices:**
```javascript
// Structured logging
console.log(JSON.stringify({
  level: 'INFO',
  message: 'User logged in',
  userId: 123,
  timestamp: new Date().toISOString()
}));
```

#### 3. Traces (Optional - Jaeger/Tempo)

**What:** Request flow through distributed system

Not covered today, but next step for advanced observability.

### Prometheus Query Examples

```promql
# Request rate by status code
rate(http_requests_total[5m])

# Error rate percentage
rate(http_requests_total{status_code=~"5.."}[5m]) /
rate(http_requests_total[5m]) * 100

# P95 latency
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket[5m])
)

# CPU usage
rate(container_cpu_usage_seconds_total{pod=~"demo-app.*"}[5m])

# Memory usage
container_memory_working_set_bytes{pod=~"demo-app.*"}
```

## Result

### Deploy Everything

```bash
# Deploy the monitoring stack
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false

# Deploy your application
kubectl apply -f deployment.yaml -n demo-app

# Deploy ServiceMonitor
kubectl apply -f servicemonitor.yaml

# Deploy alerts
kubectl apply -f prometheusrule.yaml

# Wait for everything to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus -n monitoring --timeout=300s
```

### Access Dashboards

```bash
# Port forward Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80

# Default credentials:
# Username: admin
# Password: prom-operator (or what you set)

# Port forward Prometheus
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090

# Access:
# Grafana: http://localhost:3000
# Prometheus: http://localhost:9090
```

### View Metrics

```bash
# Check if metrics are being collected
curl http://localhost:3000/api/data

# View raw metrics
kubectl port-forward -n demo-app svc/demo-app 3000:3000
curl http://localhost:3000/metrics

# Output:
# # HELP http_requests_total Total number of HTTP requests
# # TYPE http_requests_total counter
# http_requests_total{method="GET",route="/",status_code="200"} 42
# http_requests_total{method="GET",route="/api/data",status_code="200"} 15
```

## Validation

### Monitoring Checklist

```bash
# 1. Prometheus is scraping targets
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
# Visit http://localhost:9090/targets
# demo-app should show as "UP"

# 2. Metrics are available
# In Prometheus, query: http_requests_total
# Should show data

# 3. Grafana can query Prometheus
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
# Visit http://localhost:3000
# Go to Explore, select Prometheus datasource
# Query: http_requests_total

# 4. Dashboards are working
# In Grafana: Dashboards > Browse
# Should see imported dashboards

# 5. Logs are collected (if Loki installed)
# In Grafana: Explore > Loki
# Query: {namespace="demo-app"}

# 6. Alerts are configured
# In Prometheus: Alerts
# Should see configured rules
```

### Generate Test Traffic

```bash
# Generate load to see metrics
for i in {1..100}; do
  curl http://localhost:3000/
  curl http://localhost:3000/api/data
  curl http://localhost:3000/api/slow
  sleep 0.1
done

# Watch metrics update in Grafana
```

## Advanced Configuration

### Custom Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "Application Performance",
    "rows": [
      {
        "panels": [
          {
            "title": "Request Rate",
            "targets": [
              {
                "expr": "sum(rate(http_requests_total[5m])) by (route)"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### AlertManager Configuration

```yaml
alertmanager:
  config:
    global:
      resolve_timeout: 5m
    route:
      group_by: ['alertname', 'cluster']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h
      receiver: 'slack'
    receivers:
    - name: 'slack'
      slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK'
        channel: '#alerts'
        title: 'Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

## Best Practices

### ✅ Do's

1. **Monitor what matters**: Focus on user-facing metrics
2. **Use labels wisely**: Don't create high cardinality
3. **Set SLOs**: Define service level objectives
4. **Create runbooks**: Document alert responses
5. **Use dashboards**: Visualize key metrics
6. **Structure logs**: Use JSON for parsing

### ❌ Don'ts

1. **Don't ignore scrape errors**: Check Prometheus targets
2. **Don't over-alert**: Too many alerts = alert fatigue
3. **Don't use unbounded labels**: Causes memory issues
4. **Don't log sensitive data**: PII, passwords, tokens
5. **Don't skip health checks**: Basic but essential

## Links

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Operator](https://prometheus-operator.dev/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)

## Share Your Success

Set up observability? Share your dashboards!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Screenshot of Grafana dashboard
- Metrics you're tracking
- Most useful query
- What insights you gained

Use hashtags: **#AdventOfDevOps #Prometheus #Grafana #Observability #Day11**
