---
title: Monitoring and Logging in Kubernetes
description: Implement comprehensive observability with effective monitoring, logging, and troubleshooting strategies
order: 9
---

Maintaining visibility into your Kubernetes cluster and applications is essential for ensuring reliability, performance, and security. In this section, we'll explore how to implement effective monitoring and logging solutions, as well as strategies for troubleshooting issues in your Kubernetes environment.

## Understanding Observability in Kubernetes

Observability encompasses three main pillars:

1. **Monitoring**: Collecting and analyzing metrics about the performance and health of your systems
2. **Logging**: Capturing and storing event logs from your applications and infrastructure
3. **Tracing**: Following requests as they flow through your distributed system

Together, these provide a comprehensive view of your cluster's state and behavior.

## Kubernetes Monitoring Architecture

Kubernetes exposes metrics through several components:

### Metrics Server

Metrics Server is a cluster-wide aggregator of resource usage data that collects CPU and memory metrics from kubelet. It's a lightweight, short-term, in-memory metrics solution.

```bash
# Install Metrics Server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Verify installation
kubectl get deployment metrics-server -n kube-system

# Use Metrics Server
kubectl top nodes
kubectl top pods --all-namespaces
```

Metrics Server powers features like:

- Horizontal Pod Autoscaler (HPA)
- Vertical Pod Autoscaler (VPA)
- kubectl top command

### kube-state-metrics

kube-state-metrics listens to the Kubernetes API server and generates metrics about the state of Kubernetes objects.

```bash
# Install kube-state-metrics
kubectl apply -f https://github.com/kubernetes/kube-state-metrics/tree/main/examples/standard

# Example metrics
# - kube_pod_status_phase
# - kube_deployment_status_replicas
# - kube_node_status_condition
```

### cAdvisor

Container Advisor (cAdvisor) is built into kubelet and provides resource usage and performance metrics about running containers.

### Prometheus Operator and Kubernetes Monitoring Stack

For comprehensive monitoring, many organizations use the Prometheus Operator and related components, often as part of the Kubernetes Monitoring Stack (formerly known as Prometheus Operator or kube-prometheus):

```bash
# Clone the repository
git clone https://github.com/prometheus-operator/kube-prometheus.git
cd kube-prometheus

# Create the namespace and CRDs
kubectl create -f manifests/setup

# Wait for the CRDs to be created
until kubectl get servicemonitors --all-namespaces ; do sleep 1; done

# Create the monitoring stack components
kubectl create -f manifests/
```

This installs:

- Prometheus Operator
- Prometheus instances
- Alertmanager
- Grafana
- Node Exporter
- kube-state-metrics
- Pre-configured dashboards and alerts

## Setting Up Prometheus and Grafana

Let's explore a more detailed setup of Prometheus and Grafana for monitoring:

### Basic Prometheus Setup

```yaml
apiVersion: monitoring.coreos.com/v1
kind: Prometheus
metadata:
  name: prometheus
  namespace: monitoring
spec:
  serviceAccountName: prometheus
  serviceMonitorSelector:
    matchLabels:
      team: frontend
  resources:
    requests:
      memory: 400Mi
  enableAdminAPI: false
```

### Creating ServiceMonitors

ServiceMonitors define how Prometheus should discover and scrape services:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: example-app
  namespace: monitoring
  labels:
    team: frontend
spec:
  selector:
    matchLabels:
      app: example-app
  endpoints:
    - port: web
      interval: 30s
      path: /metrics
```

### Setting Up Grafana

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:9.3.6
          ports:
            - containerPort: 3000
              name: http
          volumeMounts:
            - mountPath: /var/lib/grafana
              name: grafana-storage
            - mountPath: /etc/grafana/provisioning/datasources
              name: grafana-datasources
              readOnly: true
      volumes:
        - name: grafana-storage
          persistentVolumeClaim:
            claimName: grafana-pvc
        - name: grafana-datasources
          configMap:
            name: grafana-datasources
```

Create a ConfigMap for Grafana datasources:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: monitoring
data:
  prometheus.yaml: |-
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      url: http://prometheus-operated:9090
      access: proxy
      isDefault: true
```

## Essential Prometheus Metrics

When monitoring Kubernetes, focus on these key metrics:

### Node Metrics

- `node_cpu_seconds_total`: CPU usage
- `node_memory_MemAvailable_bytes`: Available memory
- `node_filesystem_avail_bytes`: Available disk space
- `node_network_transmit_bytes_total` and `node_network_receive_bytes_total`: Network I/O

### Kubernetes Resource Metrics

- `kube_pod_container_resource_requests` and `kube_pod_container_resource_limits`: Resource allocation
- `kube_pod_container_status_restarts_total`: Container restarts
- `kube_pod_container_status_waiting_reason`: Pods in waiting state
- `kube_deployment_spec_replicas` and `kube_deployment_status_replicas_available`: Deployment status

### Application Metrics

- `http_requests_total`: Total HTTP requests (with labels for status code, method, etc.)
- `http_request_duration_seconds`: Request latency
- `application_memory_usage_bytes`: Application memory usage
- `application_database_connections`: Database connection count

## Creating Effective Dashboards

Designing useful Grafana dashboards involves:

1. **Hierarchical Organization**:

   - Cluster overview
   - Namespace/application views
   - Pod/container details

2. **Key Dashboard Components**:

   - Resource utilization (CPU, memory, disk, network)
   - Application metrics (requests, latency, error rates)
   - Kubernetes state (pods running, deployment status)
   - Alerts and incidents

3. **Effective Visualization**:
   - Use appropriate graph types
   - Add thresholds and reference lines
   - Include legends and documentation
   - Create template variables for filtering

Example dashboard JSON snippet:

```json
{
  "panels": [
    {
      "title": "CPU Usage",
      "type": "graph",
      "datasource": "Prometheus",
      "targets": [
        {
          "expr": "sum(rate(container_cpu_usage_seconds_total{namespace=\"$namespace\",pod=~\"$pod\"}[5m])) by (pod)",
          "legendFormat": "{{pod}}",
          "refId": "A"
        }
      ],
      "yaxes": [
        {
          "format": "percentunit",
          "label": "CPU Usage"
        }
      ],
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 0
      }
    }
  ],
  "templating": {
    "list": [
      {
        "name": "namespace",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(kube_namespace_labels, namespace)"
      },
      {
        "name": "pod",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(kube_pod_info{namespace=\"$namespace\"}, pod)"
      }
    ]
  }
}
```

## Setting Up Alerts

Configure alerts to notify you of potential issues:

### Prometheus AlertManager Rules

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kubernetes-apps
  namespace: monitoring
  labels:
    prometheus: k8s
    role: alert-rules
spec:
  groups:
    - name: kubernetes-apps
      rules:
        - alert: KubePodCrashLooping
          expr: rate(kube_pod_container_status_restarts_total{job="kube-state-metrics"}[15m]) * 60 * 5 > 0
          for: 15m
          labels:
            severity: critical
          annotations:
            summary: 'Pod {{ $labels.namespace }}/{{ $labels.pod }} is crash looping'
            description: 'Pod {{ $labels.namespace }}/{{ $labels.pod }} is restarting {{ printf "%.2f" $value }} times every 5 minutes.'
```

### AlertManager Configuration

```yaml
apiVersion: monitoring.coreos.com/v1
kind: Alertmanager
metadata:
  name: main
  namespace: monitoring
spec:
  replicas: 3
  configSecret: alertmanager-config
```

Configure AlertManager with a ConfigMap:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-config
  namespace: monitoring
stringData:
  alertmanager.yaml: |-
    global:
      resolve_timeout: 5m
      slack_api_url: 'http[s]://hooks[.]slack[.]com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'

    route:
      group_by: ['namespace', 'alertname']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 12h
      receiver: 'slack-notifications'
      routes:
      - match:
          severity: critical
        receiver: 'slack-critical'

    receivers:
    - name: 'slack-notifications'
      slack_configs:
      - channel: '#alerts'
        title: '[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}'
        text: "{{ range .Alerts }}{{ .Annotations.description }}\n{{ end }}"

    - name: 'slack-critical'
      slack_configs:
      - channel: '#critical-alerts'
        title: '[CRITICAL] {{ .CommonLabels.alertname }}'
        text: "{{ range .Alerts }}{{ .Annotations.description }}\n{{ end }}"
```

## Logging in Kubernetes

Kubernetes doesn't provide a built-in cluster-wide logging solution. Instead, there are several common patterns:

### Node-level Logging

The simplest approach where applications write logs to stdout/stderr, which are captured by the container runtime:

```bash
# View logs for a pod
kubectl logs nginx-pod

# View logs for a specific container in a pod
kubectl logs nginx-pod -c nginx

# Follow logs (stream in real-time)
kubectl logs -f nginx-pod

# Show logs from the previous container instance
kubectl logs nginx-pod --previous
```

### Logging with a DaemonSet

Deploy a logging agent on each node to collect and forward logs:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
  namespace: logging
spec:
  selector:
    matchLabels:
      app: fluentd
  template:
    metadata:
      labels:
        app: fluentd
    spec:
      tolerations:
        - key: node-role.kubernetes.io/master
          effect: NoSchedule
      containers:
        - name: fluentd
          image: fluent/fluentd:v1.14-1
          volumeMounts:
            - name: varlog
              mountPath: /var/log
            - name: varlibdockercontainers
              mountPath: /var/lib/docker/containers
              readOnly: true
            - name: config
              mountPath: /fluentd/etc
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
        - name: varlibdockercontainers
          hostPath:
            path: /var/lib/docker/containers
        - name: config
          configMap:
            name: fluentd-config
```

### EFK/ELK Stack

A popular logging stack consists of:

- **Elasticsearch**: For storing and searching logs
- **Fluentd/Logstash**: For collecting and processing logs
- **Kibana**: For visualizing and analyzing logs

```yaml
# Elasticsearch StatefulSet (simplified)
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: elasticsearch
  namespace: logging
spec:
  serviceName: elasticsearch
  replicas: 3
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      containers:
        - name: elasticsearch
          image: docker.elastic.co/elasticsearch/elasticsearch:7.17.3
          env:
            - name: discovery.type
              value: single-node
          ports:
            - containerPort: 9200
              name: rest
            - containerPort: 9300
              name: inter-node
          volumeMounts:
            - name: data
              mountPath: /usr/share/elasticsearch/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 20Gi
```

### Loki

Grafana Loki is a lightweight alternative to Elasticsearch, designed specifically for logs:

```yaml
# Loki configuration (simplified)
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: loki
  namespace: logging
spec:
  serviceName: loki
  replicas: 1
  selector:
    matchLabels:
      app: loki
  template:
    metadata:
      labels:
        app: loki
    spec:
      containers:
        - name: loki
          image: grafana/loki:2.7.0
          ports:
            - containerPort: 3100
              name: http
          volumeMounts:
            - name: config
              mountPath: /etc/loki
            - name: data
              mountPath: /data
      volumes:
        - name: config
          configMap:
            name: loki-config
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 10Gi
```

## Structured Logging

Implement structured logging in your applications for better searchability:

### JSON Logging Example

```python
# Python example with json logging
import logging
import json
import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "path": record.pathname,
            "function": record.funcName,
            "line": record.lineno
        }

        if hasattr(record, 'request_id'):
            log_record["request_id"] = record.request_id

        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_record)

# Set up the logger
logger = logging.getLogger("my-app")
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Usage
logger.info("Processing order", extra={"request_id": "abc-123"})
```

Output:

```json
{
  "timestamp": "2023-05-17T12:34:56.789012",
  "level": "INFO",
  "message": "Processing order",
  "logger": "my-app",
  "path": "/app/main.py",
  "function": "process_order",
  "line": 42,
  "request_id": "abc-123"
}
```

## Distributed Tracing

For complex microservice architectures, distributed tracing helps you understand request flows:

### Jaeger Setup

```yaml
# Jaeger all-in-one deployment (for development)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger
  namespace: tracing
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jaeger
  template:
    metadata:
      labels:
        app: jaeger
    spec:
      containers:
        - name: jaeger
          image: jaegertracing/all-in-one:1.35
          ports:
            - containerPort: 6831
              name: jaeger-thrift
            - containerPort: 16686
              name: web
```

### Application Instrumentation

Use OpenTelemetry to instrument your applications:

```javascript
// Node.js example with OpenTelemetry
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');

// Configure the tracer
const provider = new NodeTracerProvider();

const exporter = new JaegerExporter({
  serviceName: 'my-service',
  endpoint: 'http://jaeger-collector:14268/api/traces',
});

provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();

// Register auto-instrumentations
registerInstrumentations({
  instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
});

// Your application code follows
const express = require('express');
const app = express();

app.get('/api/orders', (req, res) => {
  // This request is automatically traced
  res.json({ orders: [] });
});

app.listen(3000);
```

## Metrics, Logging, and Tracing Integration

For comprehensive observability, integrate all three pillars:

1. **Correlation IDs**: Include request IDs in logs, metrics, and traces
2. **Service Mesh**: Use Istio or Linkerd for built-in observability
3. **Dashboards**: Create unified dashboards that link metrics to logs and traces

Example correlation in a Node.js application:

```javascript
app.use((req, res, next) => {
  // Generate or extract request ID
  const requestId = req.headers['x-request-id'] || uuid.v4();
  req.requestId = requestId;

  // Add to response headers
  res.setHeader('x-request-id', requestId);

  // Set up correlation for logging
  req.log = logger.child({ requestId });

  // Add to tracing span
  const span = tracer.getCurrentSpan();
  if (span) {
    span.setAttribute('request_id', requestId);
  }

  next();
});
```

## Troubleshooting Kubernetes Issues

### Common Troubleshooting Tools

```bash
# Check pod status
kubectl get pods

# Describe pod for events and details
kubectl describe pod <pod-name>

# Check pod logs
kubectl logs <pod-name>

# Check node status
kubectl describe node <node-name>

# Check resource usage
kubectl top pods
kubectl top nodes

# Execute commands in containers
kubectl exec -it <pod-name> -- /bin/sh

# View network policies
kubectl get networkpolicies
```

### Troubleshooting Pod Issues

For pods stuck in Pending state:

1. Check for insufficient resources:
   ```bash
   kubectl describe pod <pod-name> | grep -A 10 Events
   ```
2. Verify PVC binding (if using volumes):
   ```bash
   kubectl get pvc
   ```
3. Check for node selectors or taints:
   ```bash
   kubectl get pod <pod-name> -o yaml | grep -A 10 nodeSelector
   ```

For CrashLoopBackOff:

1. Check container logs:
   ```bash
   kubectl logs <pod-name>
   ```
2. Check for resource limits being exceeded:
   ```bash
   kubectl describe pod <pod-name> | grep -A 3 Limits
   ```
3. Check liveness probes:
   ```bash
   kubectl get pod <pod-name> -o yaml | grep -A 10 livenessProbe
   ```

### Using Debug Containers

In Kubernetes 1.18+, you can attach debug containers to running pods:

```bash
kubectl debug -it <pod-name> --image=busybox --target=<container-name>
```

### Creating Debug Pods

Create temporary pods for debugging:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: debug-pod
spec:
  containers:
    - name: debug
      image: nicolaka/netshoot
      command:
        - sleep
        - '3600'
  restartPolicy: Never
```

### Network Debugging

For network issues:

```bash
# Check services
kubectl get services

# Check endpoints
kubectl get endpoints <service-name>

# Test DNS resolution
kubectl run -it --rm debug --image=busybox -- nslookup kubernetes.default

# Test connectivity
kubectl run -it --rm debug --image=nicolaka/netshoot -- curl -v <service-name>

# Check network policies
kubectl get networkpolicies
```

## Cluster-Level Monitoring

Beyond application monitoring, implement cluster-level monitoring:

### Control Plane Monitoring

Monitor control plane components:

- kube-apiserver
- etcd
- kube-scheduler
- kube-controller-manager

Key metrics:

- API server request latency
- etcd leader changes
- Scheduler pending pods
- Controller manager queue length

### Resource Capacity Planning

Monitor trends to plan for future capacity:

- Node CPU/memory utilization trends
- Storage utilization growth
- Network bandwidth utilization
- Resource request vs. actual usage

### Audit Logging

Enable Kubernetes audit logging for security monitoring:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: kube-apiserver
spec:
  containers:
    - name: kube-apiserver
      command:
        - kube-apiserver
        - --audit-log-path=/var/log/audit.log
        - --audit-log-maxage=30
        - --audit-log-maxbackup=10
        - --audit-policy-file=/etc/kubernetes/audit-policy.yaml
      volumeMounts:
        - mountPath: /etc/kubernetes/audit-policy.yaml
          name: audit
          readOnly: true
        - mountPath: /var/log/audit.log
          name: audit-log
          readOnly: false
  volumes:
    - name: audit
      hostPath:
        path: /etc/kubernetes/audit-policy.yaml
        type: File
    - name: audit-log
      hostPath:
        path: /var/log/audit.log
        type: FileOrCreate
```

With an audit policy file:

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    resources:
      - group: ''
        resources: ['pods', 'services']
  - level: RequestResponse
    resources:
      - group: ''
        resources: ['secrets', 'configmaps']
```

## Cost Monitoring

Monitor your Kubernetes costs with tools like:

- Kubecost
- CloudHealth
- Prometheus + custom dashboards

Key metrics to track:

- Per-namespace cost allocation
- Idle resources
- Resource efficiency (requests vs. usage)
- Persistent volume costs

## Using DigitalOcean for Kubernetes Monitoring

DigitalOcean Kubernetes makes monitoring easy with:

- Built-in metrics server
- Native integration with common monitoring tools
- Managed Prometheus and Grafana offered as add-ons
- Simple log aggregation with existing tools

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits and implement effective monitoring for your Kubernetes applications.

## Best Practices for Kubernetes Monitoring and Logging

1. **Start with the essentials**: Focus on key metrics and logs first
2. **Use labels consistently**: Proper labeling makes filtering and alerting effective
3. **Implement both white-box and black-box monitoring**: Monitor from both inside and outside
4. **Create meaningful alerts**: Focus on actionable, high-signal alerts
5. **Retain logs appropriately**: Balance storage costs with compliance needs
6. **Use structured logging**: Makes logs more searchable and analyzable
7. **Implement rate limiting for logs**: Prevent log flooding
8. **Configure proper log rotation**: Manage disk space on nodes
9. **Document your monitoring strategy**: Ensure team members understand the setup
10. **Regularly review and refine**: Monitoring needs evolve with your application

In the next section, we'll explore Kubernetes security best practices to ensure your clusters and workloads remain protected against threats.
