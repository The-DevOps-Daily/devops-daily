---
title: 'Creating Your Own Helm Charts'
description: 'Build a Helm chart from scratch, learning the directory structure, Go templates, named templates, and values management.'
order: 4
---

Using existing charts gets you far, but eventually you will need to package your own applications. In this part, you will create a Helm chart from scratch, learning the templating system, directory conventions, and best practices along the way.

## Scaffolding a New Chart

Helm provides a `create` command that generates a chart skeleton:

```bash
helm create myapp
```

This produces the following structure:

```text
myapp/
  Chart.yaml
  values.yaml
  charts/              # Sub-charts (dependencies)
  templates/
    deployment.yaml
    service.yaml
    serviceaccount.yaml
    hpa.yaml
    ingress.yaml
    NOTES.txt          # Post-install instructions shown to the user
    _helpers.tpl       # Reusable template partials
    tests/
      test-connection.yaml
  .helmignore          # Files to exclude from packaging
```

The scaffolded chart deploys an Nginx container by default. It is a good starting point, but let us understand each piece so you can customize it for your own application.

## Chart.yaml

Start by editing the chart metadata:

```yaml
apiVersion: v2
name: myapp
description: A Helm chart for deploying the MyApp web service
type: application
version: 0.1.0
appVersion: "1.2.0"
maintainers:
  - name: Platform Team
    email: platform@example.com
keywords:
  - web
  - api
  - microservice
```

The `version` field is the chart version -- bump it every time you change the chart. The `appVersion` tracks the version of your application itself. These are independent: you can release a new chart version (e.g., changing default resource limits) without changing the app version.

## values.yaml

The values file is your chart's configuration API. Define sensible defaults here:

```yaml
replicaCount: 2

image:
  repository: myorg/myapp
  tag: ""  # Defaults to appVersion if empty
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: false
  className: ""
  host: ""
  annotations: {}

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

env: {}

probes:
  liveness:
    path: /healthz
    initialDelaySeconds: 10
    periodSeconds: 15
  readiness:
    path: /ready
    initialDelaySeconds: 5
    periodSeconds: 10

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilization: 80
```

Design your values file thoughtfully. It is the primary interface users interact with, so keep it well-organized with clear naming conventions.

## Template Basics

Helm templates use Go's `text/template` package with additional functions from the Sprig library. Templates are rendered with a data context that includes:

- `.Values` -- the merged values from values.yaml and user overrides.
- `.Release` -- release metadata (name, namespace, revision, etc.).
- `.Chart` -- contents of Chart.yaml.
- `.Capabilities` -- information about the Kubernetes cluster (API versions, etc.).

### The Deployment Template

Here is a production-ready deployment template:

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "myapp.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "myapp.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: {{ .Values.probes.liveness.path }}
              port: http
            initialDelaySeconds: {{ .Values.probes.liveness.initialDelaySeconds }}
            periodSeconds: {{ .Values.probes.liveness.periodSeconds }}
          readinessProbe:
            httpGet:
              path: {{ .Values.probes.readiness.path }}
              port: http
            initialDelaySeconds: {{ .Values.probes.readiness.initialDelaySeconds }}
            periodSeconds: {{ .Values.probes.readiness.periodSeconds }}
          {{- if .Values.env }}
          env:
            {{- range $key, $value := .Values.env }}
            - name: {{ $key }}
              value: {{ $value | quote }}
            {{- end }}
          {{- end }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

Let us break down the key template constructs:

- `{{ include "myapp.fullname" . }}` -- calls a named template defined in `_helpers.tpl`.
- `{{- ... }}` -- the dash trims whitespace before the tag. `-}}` trims whitespace after.
- `| nindent 4` -- pipes the output through the `nindent` function to add a newline and indent by 4 spaces.
- `| default .Chart.AppVersion` -- provides a fallback if the value is empty.
- `| quote` -- wraps the value in quotes for safe YAML.
- `{{- toYaml .Values.resources | nindent 12 }}` -- converts a YAML structure to a string and indents it.
- `{{- range $key, $value := .Values.env }}` -- iterates over a map.

### The Service Template

```yaml
# templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "myapp.selectorLabels" . | nindent 4 }}
```

### The Ingress Template (Conditional)

This template only renders when ingress is enabled:

```yaml
# templates/ingress.yaml
{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if .Values.ingress.className }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  rules:
    - host: {{ .Values.ingress.host | quote }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ include "myapp.fullname" . }}
                port:
                  number: {{ .Values.service.port }}
{{- end }}
```

The `{{- if ... -}}` / `{{- end }}` block means the entire file produces no output when `ingress.enabled` is false.

## Named Templates and _helpers.tpl

The `_helpers.tpl` file (the underscore prefix tells Helm not to render it as a manifest) contains reusable template definitions:

```yaml
# templates/_helpers.tpl

{{- define "myapp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "myapp.fullname" -}}
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

{{- define "myapp.labels" -}}
helm.sh/chart: {{ include "myapp.chart" . }}
{{ include "myapp.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "myapp.selectorLabels" -}}
app.kubernetes.io/name: {{ include "myapp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "myapp.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}
```

These helpers follow Kubernetes naming conventions -- truncating to 63 characters (the DNS label limit) and using standardized labels.

## NOTES.txt

The `NOTES.txt` template is displayed after install and upgrade. It typically provides connection instructions:

```text
# templates/NOTES.txt
Thank you for installing {{ include "myapp.fullname" . }}.

Your application is running in namespace: {{ .Release.Namespace }}

To access the application:
{{- if .Values.ingress.enabled }}
  Visit: http://{{ .Values.ingress.host }}
{{- else }}
  Run: kubectl port-forward svc/{{ include "myapp.fullname" . }} 8080:{{ .Values.service.port }} -n {{ .Release.Namespace }}
  Then visit: http://localhost:8080
{{- end }}
```

## Validating Your Chart

Before packaging or installing, validate the chart:

```bash
# Lint the chart for common issues
helm lint myapp/

# Render templates locally to inspect output
helm template myrelease myapp/ -f custom-values.yaml

# Dry-run against the cluster for API validation
helm install myrelease myapp/ --dry-run --debug
```

The `--debug` flag shows the rendered templates alongside any errors, which is extremely helpful during development.

## Packaging the Chart

Once your chart is ready, package it into a `.tgz` archive:

```bash
helm package myapp/
```

```text
Successfully packaged chart and saved it to: /path/to/myapp-0.1.0.tgz
```

This archive can be uploaded to a chart repository or an OCI registry for others to consume.

In the next part, we will explore how to manage releases in production, including upgrade strategies, debugging failed deployments, and working with namespaces.
