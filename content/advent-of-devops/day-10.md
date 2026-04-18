---
title: 'Day 10 - Wrap the App in a Helm Chart'
day: 10
excerpt: 'Package your Kubernetes application as a Helm chart for easy deployment and management across environments.'
description: 'Learn Helm fundamentals by creating a reusable chart with templates, values, and helpers for deploying applications to Kubernetes.'
publishedAt: '2026-12-10T00:00:00Z'
updatedAt: '2026-12-10T00:00:00Z'
difficulty: 'Advanced'
category: 'Kubernetes'
tags:
  - Helm
  - Kubernetes
  - Package Management
  - Templates
---

## Description

You've been manually applying Kubernetes YAML files for each environment (dev, staging, prod), copying and modifying values each time. There's a better way: Helm charts package everything together with templating for easy customization.

## Task

Create a Helm chart for your application.

**Requirements:**
- Package deployment, service, and configmap as chart
- Use templating for environment-specific values
- Support multiple environments via values files
- Include proper chart metadata
- Test chart deployment

## Target

- ✅ Working Helm chart structure
- ✅ Templated resources
- ✅ Values files for dev/staging/prod
- ✅ Chart validates successfully
- ✅ Deploys to Kubernetes cluster

## Sample App

### Chart Directory Structure

```
demo-app/
├── Chart.yaml           # Chart metadata
├── values.yaml          # Default values
├── values-dev.yaml      # Dev overrides
├── values-staging.yaml  # Staging overrides
├── values-prod.yaml     # Production overrides
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   ├── _helpers.tpl     # Template helpers
│   └── NOTES.txt        # Post-install notes
├── charts/              # Dependency charts
└── .helmignore          # Files to ignore
```

## Solution

### Chart Files

#### Chart.yaml

```yaml
apiVersion: v2
name: demo-app
description: A Helm chart for deploying the demo application
type: application
version: 1.0.0
appVersion: "1.0.0"

keywords:
  - demo
  - nodejs
  - example

maintainers:
  - name: DevOps Team
    email: devops@example.com

home: https://github.com/yourorg/demo-app
sources:
  - https://github.com/yourorg/demo-app

dependencies: []

annotations:
  category: Application
  licenses: MIT
```

#### values.yaml

```yaml
# Default values for demo-app
replicaCount: 2

image:
  repository: your-registry/demo-app
  pullPolicy: IfNotPresent
  tag: "" # Defaults to chart appVersion

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations: {}

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: true

service:
  type: ClusterIP
  port: 80
  targetPort: 3000
  annotations: {}

ingress:
  enabled: false
  className: nginx
  annotations: {}
  hosts:
    - host: demo-app.local
      paths:
        - path: /
          pathType: Prefix
  tls: []

resources:
  limits:
    cpu: 200m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

nodeSelector: {}

tolerations: []

affinity: {}

config:
  appName: "Demo App"
  logLevel: "info"
  nodeEnv: "production"

env:
  - name: PORT
    value: "3000"

healthCheck:
  liveness:
    enabled: true
    path: /health
    initialDelaySeconds: 10
    periodSeconds: 10
  readiness:
    enabled: true
    path: /ready
    initialDelaySeconds: 5
    periodSeconds: 5
```

#### templates/_helpers.tpl

```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "demo-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "demo-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "demo-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "demo-app.labels" -}}
helm.sh/chart: {{ include "demo-app.chart" . }}
{{ include "demo-app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "demo-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "demo-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "demo-app.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "demo-app.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Image name
*/}}
{{- define "demo-app.image" -}}
{{- $tag := .Values.image.tag | default .Chart.AppVersion }}
{{- printf "%s:%s" .Values.image.repository $tag }}
{{- end }}
```

#### templates/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "demo-app.fullname" . }}
  labels:
    {{- include "demo-app.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "demo-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "demo-app.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "demo-app.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
      - name: {{ .Chart.Name }}
        securityContext:
          {{- toYaml .Values.securityContext | nindent 12 }}
        image: {{ include "demo-app.image" . }}
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - name: http
          containerPort: {{ .Values.service.targetPort }}
          protocol: TCP
        env:
        {{- range .Values.env }}
        - name: {{ .name }}
          value: {{ .value | quote }}
        {{- end }}
        envFrom:
        - configMapRef:
            name: {{ include "demo-app.fullname" . }}
        {{- if .Values.healthCheck.liveness.enabled }}
        livenessProbe:
          httpGet:
            path: {{ .Values.healthCheck.liveness.path }}
            port: http
          initialDelaySeconds: {{ .Values.healthCheck.liveness.initialDelaySeconds }}
          periodSeconds: {{ .Values.healthCheck.liveness.periodSeconds }}
        {{- end }}
        {{- if .Values.healthCheck.readiness.enabled }}
        readinessProbe:
          httpGet:
            path: {{ .Values.healthCheck.readiness.path }}
            port: http
          initialDelaySeconds: {{ .Values.healthCheck.readiness.initialDelaySeconds }}
          periodSeconds: {{ .Values.healthCheck.readiness.periodSeconds }}
        {{- end }}
        resources:
          {{- toYaml .Values.resources | nindent 12 }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

#### templates/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "demo-app.fullname" . }}
  labels:
    {{- include "demo-app.labels" . | nindent 4 }}
  {{- with .Values.service.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "demo-app.selectorLabels" . | nindent 4 }}
```

#### templates/configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "demo-app.fullname" . }}
  labels:
    {{- include "demo-app.labels" . | nindent 4 }}
data:
  APP_NAME: {{ .Values.config.appName | quote }}
  LOG_LEVEL: {{ .Values.config.logLevel | quote }}
  NODE_ENV: {{ .Values.config.nodeEnv | quote }}
```

#### templates/ingress.yaml

```yaml
{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "demo-app.fullname" . }}
  labels:
    {{- include "demo-app.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if .Values.ingress.className }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "demo-app.fullname" $ }}
                port:
                  number: {{ $.Values.service.port }}
          {{- end }}
    {{- end }}
{{- end }}
```

#### templates/hpa.yaml

```yaml
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "demo-app.fullname" . }}
  labels:
    {{- include "demo-app.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "demo-app.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    {{- if .Values.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
    {{- end }}
    {{- if .Values.autoscaling.targetMemoryUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetMemoryUtilizationPercentage }}
    {{- end }}
{{- end }}
```

#### templates/NOTES.txt

```
1. Get the application URL by running these commands:
{{- if .Values.ingress.enabled }}
{{- range $host := .Values.ingress.hosts }}
  {{- range .paths }}
  http{{ if $.Values.ingress.tls }}s{{ end }}://{{ $host.host }}{{ .path }}
  {{- end }}
{{- end }}
{{- else if contains "NodePort" .Values.service.type }}
  export NODE_PORT=$(kubectl get --namespace {{ .Release.Namespace }} -o jsonpath="{.spec.ports[0].nodePort}" services {{ include "demo-app.fullname" . }})
  export NODE_IP=$(kubectl get nodes --namespace {{ .Release.Namespace }} -o jsonpath="{.items[0].status.addresses[0].address}")
  echo http://$NODE_IP:$NODE_PORT
{{- else if contains "LoadBalancer" .Values.service.type }}
     NOTE: It may take a few minutes for the LoadBalancer IP to be available.
           You can watch the status of by running 'kubectl get --namespace {{ .Release.Namespace }} svc -w {{ include "demo-app.fullname" . }}'
  export SERVICE_IP=$(kubectl get svc --namespace {{ .Release.Namespace }} {{ include "demo-app.fullname" . }} --template "{{"{{ range (index .status.loadBalancer.ingress 0) }}{{.}}{{ end }}"}}")
  echo http://$SERVICE_IP:{{ .Values.service.port }}
{{- else if contains "ClusterIP" .Values.service.type }}
  export POD_NAME=$(kubectl get pods --namespace {{ .Release.Namespace }} -l "app.kubernetes.io/name={{ include "demo-app.name" . }},app.kubernetes.io/instance={{ .Release.Name }}" -o jsonpath="{.items[0].metadata.name}")
  export CONTAINER_PORT=$(kubectl get pod --namespace {{ .Release.Namespace }} $POD_NAME -o jsonpath="{.spec.containers[0].ports[0].containerPort}")
  echo "Visit http://127.0.0.1:8080 to use your application"
  kubectl --namespace {{ .Release.Namespace }} port-forward $POD_NAME 8080:$CONTAINER_PORT
{{- end }}
```

### Environment-Specific Values

#### values-dev.yaml

```yaml
replicaCount: 1

image:
  tag: "dev-latest"
  pullPolicy: Always

resources:
  limits:
    cpu: 100m
    memory: 128Mi
  requests:
    cpu: 50m
    memory: 64Mi

config:
  appName: "Demo App - DEV"
  logLevel: "debug"
  nodeEnv: "development"

ingress:
  enabled: true
  hosts:
    - host: demo-dev.example.com
      paths:
        - path: /
          pathType: Prefix

autoscaling:
  enabled: false
```

#### values-prod.yaml

```yaml
replicaCount: 5

image:
  tag: "1.0.0"
  pullPolicy: IfNotPresent

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

config:
  appName: "Demo App"
  logLevel: "warn"
  nodeEnv: "production"

service:
  type: LoadBalancer
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: nlb

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: demo.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: demo-app-tls
      hosts:
        - demo.example.com

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app.kubernetes.io/name
                operator: In
                values:
                  - demo-app
          topologyKey: kubernetes.io/hostname
```

## Explanation

### Helm Concepts

#### 1. Templates

**Go templating with Helm functions:**

```yaml
name: {{ include "demo-app.fullname" . }}
```

- `{{ }}`: Template action
- `.Values`: Access values.yaml
- `.Chart`: Chart metadata
- `.Release`: Release information
- `include`: Include helper template

#### 2. Values Hierarchy

**Merged in order:**
1. Default `values.yaml`
2. Environment-specific `values-<env>.yaml`
3. `--set` flags

```bash
helm install my-app ./demo-app -f values-prod.yaml --set replicaCount=10
```

#### 3. Helpers (_helpers.tpl)

**Reusable template snippets:**

```yaml
{{- define "demo-app.labels" -}}
app: {{ .Chart.Name }}
version: {{ .Chart.Version }}
{{- end }}
```

Use with: `{{- include "demo-app.labels" . | nindent 4 }}`

## Result

### Install the Chart

```bash
# Lint the chart
helm lint demo-app/

# Dry run to see generated manifests
helm install my-app demo-app/ --dry-run --debug

# Install to dev
helm install my-app-dev demo-app/ \
  -f demo-app/values-dev.yaml \
  --namespace demo-dev \
  --create-namespace

# Output:
# NAME: my-app-dev
# LAST DEPLOYED: Fri Dec  8 12:00:00 2023
# NAMESPACE: demo-dev
# STATUS: deployed
# REVISION: 1
# NOTES:
# 1. Get the application URL by running these commands:
#   export POD_NAME=$(kubectl get pods --namespace demo-dev -l "app.kubernetes.io/name=demo-app" -o jsonpath="{.items[0].metadata.name}")
#   kubectl --namespace demo-dev port-forward $POD_NAME 8080:3000

# List releases
helm list -n demo-dev

# Check deployment
kubectl get all -n demo-dev
```

### Upgrade Release

```bash
# Modify values
echo "replicaCount: 3" >> values-dev.yaml

# Upgrade
helm upgrade my-app-dev demo-app/ \
  -f demo-app/values-dev.yaml \
  -n demo-dev

# Check history
helm history my-app-dev -n demo-dev
```

### Rollback

```bash
# Rollback to previous version
helm rollback my-app-dev -n demo-dev

# Rollback to specific revision
helm rollback my-app-dev 1 -n demo-dev
```

## Validation

### Testing Checklist

```bash
# 1. Lint the chart
helm lint demo-app/
# Should return: 1 chart(s) linted, 0 chart(s) failed

# 2. Template validation
helm template my-app demo-app/ -f demo-app/values-dev.yaml > /tmp/rendered.yaml
kubectl apply --dry-run=client -f /tmp/rendered.yaml
# Should validate successfully

# 3. Install and verify
helm install test-release demo-app/ -f demo-app/values-dev.yaml --namespace test --create-namespace
kubectl get pods -n test
# Pods should be Running

# 4. Test upgrade
helm upgrade test-release demo-app/ --set replicaCount=2 -n test
# Should succeed

# 5. Verify values applied
kubectl get deployment -n test -o jsonpath='{.items[0].spec.replicas}'
# Should return: 2

# 6. Cleanup
helm uninstall test-release -n test
kubectl delete namespace test
```

## Best Practices

### ✅ Do's

1. **Use helpers**: Keep templates DRY
2. **Version charts**: Semantic versioning
3. **Default values**: Sensible defaults in values.yaml
4. **Document values**: Comment all options
5. **Test thoroughly**: Lint, template, and test deploys
6. **Use checksum annotations**: Force pod restart on config changes

### ❌ Don'ts

1. **Don't hardcode**: Use values for everything
2. **Don't skip linting**: Catch errors early
3. **Don't ignore NOTES.txt**: Help users
4. **Don't forget .helmignore**: Exclude unnecessary files
5. **Don't make charts too complex**: Keep them focused

## Links

- [Helm Documentation](https://helm.sh/docs/)
- [Chart Template Guide](https://helm.sh/docs/chart_template_guide/)
- [Helm Best Practices](https://helm.sh/docs/chart_best_practices/)
- [Artifact Hub](https://artifacthub.io/)
- [Chart Testing](https://github.com/helm/chart-testing)

## Share Your Success

Created your first Helm chart? Share it!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Chart name and purpose
- Number of templates
- Environments supported
- Link to chart repo

Use hashtags: **#AdventOfDevOps #Helm #Kubernetes #Day10**
