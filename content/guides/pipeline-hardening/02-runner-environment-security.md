---
title: 'Runner and Environment Security'
description: 'Learn to secure CI/CD runners with isolation, hardening, and ephemeral environments to prevent compromise and lateral movement.'
---

Runners execute your pipeline code. If compromised, an attacker can steal secrets, modify builds, and potentially pivot to other systems. This section covers runner isolation and hardening techniques.

## Runner Types and Security Tradeoffs

| Runner Type | Isolation | Security | Use Case |
|-------------|-----------|----------|----------|
| Shared hosted | Low | Medium | Public repos, non-sensitive builds |
| Self-hosted persistent | Medium | Low | Cost savings, specific requirements |
| Self-hosted ephemeral | High | High | Sensitive builds, compliance |
| Container-based | High | High | Reproducible, isolated builds |

## GitHub Actions Runner Security

### Use Ephemeral Runners

Ephemeral runners are destroyed after each job:

```yaml
# Self-hosted runner with ephemeral flag
./config.sh --url https://github.com/org/repo \
  --token TOKEN \
  --ephemeral
```

For larger scale, use autoscaling solutions:

```yaml
# actions-runner-controller (Kubernetes)
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: ephemeral-runners
spec:
  replicas: 5
  template:
    spec:
      ephemeral: true
      repository: org/repo
```

### Restrict Runner Groups

Limit which repositories can use specific runners:

```yaml
# Only allow production repo to use production runners
jobs:
  deploy:
    runs-on: [self-hosted, production]  # Restricted runner group
```

Configure in GitHub Settings -> Actions -> Runner groups.

### Network Isolation

Restrict runner network access:

```bash
# Firewall rules for runner host
# Allow only required outbound connections
iptables -A OUTPUT -d github.com -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -d ghcr.io -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -d registry.npmjs.org -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -j DROP  # Block everything else
```

## GitLab CI Runner Security

### Use Docker Executor with Isolation

```toml
# /etc/gitlab-runner/config.toml
[[runners]]
  name = "secure-runner"
  executor = "docker"
  [runners.docker]
    image = "alpine:latest"
    privileged = false           # Never run privileged!
    disable_entrypoint_overwrite = true
    cap_drop = ["ALL"]           # Drop all capabilities
    security_opt = ["no-new-privileges:true"]
    network_mode = "bridge"      # Isolated network
```

### Kubernetes Executor Security

```toml
[[runners]]
  name = "k8s-runner"
  executor = "kubernetes"
  [runners.kubernetes]
    namespace = "gitlab-runners"
    privileged = false
    service_account = "gitlab-runner"  # Limited SA
    [runners.kubernetes.pod_security_context]
      run_as_non_root = true
      run_as_user = 1000
    [runners.kubernetes.pod_annotations]
      "container.apparmor.security.beta.kubernetes.io/build" = "runtime/default"
```

### Protected Runners

Only allow protected branches to use sensitive runners:

```toml
[[runners]]
  name = "production-runner"
  [runners.custom_build_dir]
  # Mark as protected in GitLab UI
  # Settings -> CI/CD -> Runners -> Edit -> Protected
```

## Jenkins Agent Security

### Use Containerized Agents

```groovy
// Jenkinsfile with container agent
pipeline {
    agent {
        docker {
            image 'maven:3.9-eclipse-temurin-17'
            args '--network=isolated --cap-drop=ALL'
        }
    }
    stages {
        stage('Build') {
            steps {
                sh 'mvn clean package'
            }
        }
    }
}
```

### Kubernetes Plugin Security

```groovy
// Pod template with security context
podTemplate(
    containers: [
        containerTemplate(
            name: 'maven',
            image: 'maven:3.9',
            runAsUser: '1000',
            runAsGroup: '1000'
        )
    ],
    securityContext: [
        runAsNonRoot: true,
        fsGroup: 1000
    ]
) {
    node(POD_LABEL) {
        stage('Build') {
            container('maven') {
                sh 'mvn clean package'
            }
        }
    }
}
```

### Agent-to-Controller Security

```groovy
// jenkins.yaml - restrict agent commands
jenkins:
  remotingSecurity:
    enabled: true
  slaveAgentPort: 50000
  agentProtocols:
    - "JNLP4-connect"  # Most secure protocol
```

## Container Build Security

### Don't Run Docker-in-Docker Privileged

```yaml
# Bad - privileged DinD
services:
  - docker:dind
variables:
  DOCKER_HOST: tcp://docker:2375
  DOCKER_TLS_CERTDIR: ""  # No TLS!

# Better - Kaniko (no daemon required)
build:
  image:
    name: gcr.io/kaniko-project/executor:latest
    entrypoint: [""]
  script:
    - /kaniko/executor
        --context $CI_PROJECT_DIR
        --dockerfile Dockerfile
        --destination $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

### Use Rootless Builds

```yaml
# GitHub Actions with buildx (rootless)
- name: Build image
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: myapp:${{ github.sha }}
```

## Environment Hardening Checklist

```
Runner Host:
[ ] Minimal OS installation
[ ] Regular security updates
[ ] No unnecessary services running
[ ] Disk encryption enabled
[ ] Audit logging configured

Runner Process:
[ ] Runs as non-root user
[ ] Limited filesystem access
[ ] Network egress restricted
[ ] No persistent storage between jobs
[ ] Capabilities dropped

Container Builds:
[ ] No privileged mode
[ ] Read-only root filesystem where possible
[ ] Resource limits configured
[ ] Seccomp/AppArmor profiles applied
[ ] No host mounts for sensitive paths
```

## Detecting Runner Compromise

Monitor for suspicious activity:

```yaml
# Add monitoring step to workflows
- name: Security audit
  run: |
    # Check for unexpected processes
    ps aux | grep -v expected_process
    
    # Check for unexpected network connections
    netstat -tulpn
    
    # Check for unexpected files
    find /tmp -type f -newer /proc/1/exe
```

Set up alerts for:
- Unusual network traffic from runners
- Jobs running longer than expected
- Unexpected resource usage
- Failed authentication attempts
