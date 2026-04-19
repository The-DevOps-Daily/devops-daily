---
title: 'Day 15 - Bash Scripting Day'
day: 15
excerpt: 'Write a practical bash script to automate common DevOps tasks like deployments, backups, and health checks.'
description: 'Master bash scripting fundamentals by creating robust automation scripts with error handling, logging, and best practices.'
publishedAt: '2026-12-15T00:00:00Z'
updatedAt: '2026-12-15T00:00:00Z'
difficulty: 'Beginner'
category: 'Automation'
tags:
  - Bash
  - Scripting
  - Automation
  - Linux
---

## Description

You're tired of running the same deployment commands manually. It's time to automate repetitive tasks with bash scripts. Today, you'll create a production-ready deployment script with proper error handling, logging, and validation.

## Task

Write a bash script to automate application deployment.

**Requirements:**
- Check prerequisites (Docker, kubectl, etc.)
- Validate inputs and configuration
- Build and tag Docker image
- Push to registry
- Deploy to Kubernetes
- Verify deployment success
- Include error handling and logging

## Target

- ✅ Script runs without errors
- ✅ Proper error handling
- ✅ Colored output for readability
- ✅ Logging to file
- ✅ Rollback on failure
- ✅ Help documentation

## Sample App

### Deployment Script

#### deploy.sh

```bash
#!/bin/bash

#######################################
# Application Deployment Script
# Description: Build, push, and deploy application
# Usage: ./deploy.sh [environment] [version]
#######################################

set -euo pipefail  # Exit on error, undefined vars, pipe failures

#######################################
# Configuration
#######################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"

# Docker configuration
DOCKER_REGISTRY="${DOCKER_REGISTRY:-docker.io}"
IMAGE_NAME="${IMAGE_NAME:-myapp}"

# Kubernetes configuration
KUBECTL_TIMEOUT=300

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

#######################################
# Functions
#######################################

# Print colored message
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        INFO)
            echo -e "${BLUE}[INFO]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        SUCCESS)
            echo -e "${GREEN}[SUCCESS]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
            ;;
    esac
}

# Error handler
error_exit() {
    log ERROR "$1"
    exit 1
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] ENVIRONMENT VERSION

Deploy application to Kubernetes cluster.

Arguments:
    ENVIRONMENT    Target environment (dev|staging|prod)
    VERSION        Version tag to deploy

Options:
    -h, --help     Show this help message
    -d, --dry-run  Perform dry run without actual deployment
    -s, --skip-build  Skip Docker build step
    -v, --verbose  Enable verbose output

Examples:
    $0 dev 1.0.0
    $0 --dry-run prod 2.1.0
    $0 --skip-build staging 1.5.2

EOF
    exit 0
}

# Validate prerequisites
check_prerequisites() {
    log INFO "Checking prerequisites..."

    local missing_tools=()

    # Required tools
    local required_tools=("docker" "kubectl" "git")

    for tool in "${required_tools[@]}"; do
        if ! command_exists "$tool"; then
            missing_tools+=("$tool")
        fi
    done

    if [ ${#missing_tools[@]} -ne 0 ]; then
        error_exit "Missing required tools: ${missing_tools[*]}"
    fi

    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        error_exit "Docker daemon is not running"
    fi

    # Check kubectl connection
    if ! kubectl cluster-info >/dev/null 2>&1; then
        error_exit "Cannot connect to Kubernetes cluster"
    fi

    log SUCCESS "All prerequisites met"
}

# Validate environment
validate_environment() {
    local env=$1

    case $env in
        dev|staging|prod)
            log INFO "Environment: $env"
            ;;
        *)
            error_exit "Invalid environment: $env. Must be dev, staging, or prod"
            ;;
    esac
}

# Validate version format
validate_version() {
    local version=$1

    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        error_exit "Invalid version format: $version. Expected format: X.Y.Z"
    fi

    log INFO "Version: $version"
}

# Build Docker image
build_image() {
    local version=$1
    local image_tag="${DOCKER_REGISTRY}/${IMAGE_NAME}:${version}"

    log INFO "Building Docker image: $image_tag"

    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Would build: $image_tag"
        return 0
    fi

    if ! docker build -t "$image_tag" .; then
        error_exit "Docker build failed"
    fi

    # Also tag as latest for environment
    docker tag "$image_tag" "${DOCKER_REGISTRY}/${IMAGE_NAME}:${ENVIRONMENT}-latest"

    log SUCCESS "Image built successfully"
}

# Push Docker image
push_image() {
    local version=$1
    local image_tag="${DOCKER_REGISTRY}/${IMAGE_NAME}:${version}"

    log INFO "Pushing Docker image: $image_tag"

    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Would push: $image_tag"
        return 0
    fi

    if ! docker push "$image_tag"; then
        error_exit "Docker push failed"
    fi

    # Push environment-specific latest tag
    docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:${ENVIRONMENT}-latest"

    log SUCCESS "Image pushed successfully"
}

# Deploy to Kubernetes
deploy_to_k8s() {
    local environment=$1
    local version=$2
    local namespace="$environment"

    log INFO "Deploying to Kubernetes namespace: $namespace"

    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Would deploy version $version to $namespace"
        return 0
    fi

    # Create namespace if it doesn't exist
    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -

    # Update deployment with new image
    kubectl set image deployment/myapp \
        myapp="${DOCKER_REGISTRY}/${IMAGE_NAME}:${version}" \
        -n "$namespace" \
        --record

    # Wait for rollout
    log INFO "Waiting for rollout to complete..."
    if ! kubectl rollout status deployment/myapp -n "$namespace" --timeout="${KUBECTL_TIMEOUT}s"; then
        error_exit "Deployment rollout failed"
    fi

    log SUCCESS "Deployment successful"
}

# Verify deployment
verify_deployment() {
    local namespace=$1

    log INFO "Verifying deployment..."

    # Check pod status
    local ready_pods=$(kubectl get pods -n "$namespace" -l app=myapp -o json | \
        jq '.items | map(select(.status.phase == "Running")) | length')

    local total_pods=$(kubectl get pods -n "$namespace" -l app=myapp --no-headers | wc -l)

    log INFO "Ready pods: $ready_pods/$total_pods"

    if [ "$ready_pods" -eq 0 ]; then
        error_exit "No pods are running"
    fi

    # Test health endpoint
    local pod_name=$(kubectl get pod -n "$namespace" -l app=myapp -o jsonpath='{.items[0].metadata.name}')

    if kubectl exec -n "$namespace" "$pod_name" -- wget -q -O- http://localhost:3000/health >/dev/null 2>&1; then
        log SUCCESS "Health check passed"
    else
        log WARN "Health check failed"
    fi

    log SUCCESS "Deployment verified"
}

# Rollback deployment
rollback() {
    local namespace=$1

    log WARN "Rolling back deployment..."

    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Would rollback in namespace $namespace"
        return 0
    fi

    kubectl rollout undo deployment/myapp -n "$namespace"
    kubectl rollout status deployment/myapp -n "$namespace"

    log SUCCESS "Rollback completed"
}

# Cleanup function
cleanup() {
    log INFO "Cleaning up..."
    # Add cleanup tasks here
}

# Signal handler
trap cleanup EXIT
trap 'error_exit "Script interrupted"' INT TERM

#######################################
# Main Script
#######################################

main() {
    # Create log directory
    mkdir -p "$LOG_DIR"

    # Parse options
    DRY_RUN=false
    SKIP_BUILD=false
    VERBOSE=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -s|--skip-build)
                SKIP_BUILD=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                set -x
                shift
                ;;
            -*)
                error_exit "Unknown option: $1"
                ;;
            *)
                break
                ;;
        esac
    done

    # Validate arguments
    if [ $# -ne 2 ]; then
        error_exit "Missing required arguments. Use -h for help."
    fi

    ENVIRONMENT=$1
    VERSION=$2

    log INFO "=== Starting Deployment ==="
    log INFO "Environment: $ENVIRONMENT"
    log INFO "Version: $VERSION"
    log INFO "Dry Run: $DRY_RUN"
    log INFO "Log file: $LOG_FILE"
    echo ""

    # Run deployment steps
    check_prerequisites
    validate_environment "$ENVIRONMENT"
    validate_version "$VERSION"

    if [ "$SKIP_BUILD" = false ]; then
        build_image "$VERSION"
        push_image "$VERSION"
    else
        log INFO "Skipping build step"
    fi

    deploy_to_k8s "$ENVIRONMENT" "$VERSION"
    verify_deployment "$ENVIRONMENT"

    log SUCCESS "=== Deployment Complete ==="
    log INFO "Application version $VERSION deployed to $ENVIRONMENT"
}

# Run main function
main "$@"
```

### Helper Scripts

#### check-health.sh

```bash
#!/bin/bash

# Health check script
set -euo pipefail

NAMESPACE="${1:-default}"
APP_LABEL="${2:-app=myapp}"

echo "Checking health of $APP_LABEL in namespace $NAMESPACE..."

# Get all pods
PODS=$(kubectl get pods -n "$NAMESPACE" -l "$APP_LABEL" -o json)

# Check each pod
echo "$PODS" | jq -r '.items[] |
    "\(.metadata.name): \(.status.phase) - Ready: \(
        .status.containerStatuses[0].ready
    )"'

# Count healthy pods
READY=$(echo "$PODS" | jq '[.items[].status.containerStatuses[0].ready] | map(select(. == true)) | length')
TOTAL=$(echo "$PODS" | jq '.items | length')

echo "Ready: $READY/$TOTAL"

if [ "$READY" -eq "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
    echo "✓ All pods healthy"
    exit 0
else
    echo "✗ Some pods unhealthy"
    exit 1
fi
```

#### backup.sh

```bash
#!/bin/bash

# Backup script
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup-${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "Creating backup: $BACKUP_FILE"

# Backup Kubernetes resources
kubectl get all --all-namespaces -o yaml > "${BACKUP_DIR}/k8s-resources-${TIMESTAMP}.yaml"

# Backup configs
kubectl get configmap --all-namespaces -o yaml > "${BACKUP_DIR}/configmaps-${TIMESTAMP}.yaml"
kubectl get secret --all-namespaces -o yaml > "${BACKUP_DIR}/secrets-${TIMESTAMP}.yaml"

# Create archive
tar -czf "$BACKUP_FILE" -C "$BACKUP_DIR" \
    "k8s-resources-${TIMESTAMP}.yaml" \
    "configmaps-${TIMESTAMP}.yaml" \
    "secrets-${TIMESTAMP}.yaml"

# Cleanup individual files
rm -f "${BACKUP_DIR}"/*.yaml

echo "Backup complete: $BACKUP_FILE"

# Cleanup old backups (keep last 7 days)
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +7 -delete

echo "Old backups cleaned up"
```

## Explanation

### Bash Best Practices

#### 1. Strict Mode

```bash
set -euo pipefail
```

- `-e`: Exit on error
- `-u`: Exit on undefined variable
- `-o pipefail`: Pipeline fails if any command fails

#### 2. Error Handling

```bash
error_exit() {
    echo "ERROR: $1" >&2
    exit 1
}

command || error_exit "Command failed"
```

#### 3. Functions

```bash
function_name() {
    local param=$1  # Local variable

    # Function body
    echo "Result"

    return 0  # Success
}
```

#### 4. Logging

```bash
log() {
    local level=$1
    local message=$2
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $message" | tee -a "$LOG_FILE"
}
```

#### 5. Input Validation

```bash
if [ $# -lt 2 ]; then
    echo "Usage: $0 <arg1> <arg2>"
    exit 1
fi

# Validate format
if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    error_exit "Invalid version format"
fi
```

### Common Patterns

#### Checking Command Existence

```bash
if ! command -v docker &> /dev/null; then
    echo "Docker not found"
    exit 1
fi
```

#### Reading Configuration

```bash
# From file
CONFIG_FILE="config.env"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# From environment with default
DATABASE_URL="${DATABASE_URL:-postgresql://localhost:5432/mydb}"
```

#### Loops

```bash
# Array iteration
ENVIRONMENTS=("dev" "staging" "prod")
for env in "${ENVIRONMENTS[@]}"; do
    echo "Deploying to $env"
done

# File iteration
while IFS= read -r line; do
    echo "Processing: $line"
done < input.txt
```

## Result

### Run the Script

```bash
# Make executable
chmod +x deploy.sh check-health.sh backup.sh

# Show help
./deploy.sh --help

# Dry run
./deploy.sh --dry-run dev 1.0.0

# Actual deployment
./deploy.sh dev 1.0.0

# Output:
# [INFO] === Starting Deployment ===
# [INFO] Environment: dev
# [INFO] Version: 1.0.0
# [INFO] Dry Run: false
# [INFO] Log file: ./logs/deploy-20251215-120000.log
#
# [INFO] Checking prerequisites...
# [SUCCESS] All prerequisites met
# [INFO] Environment: dev
# [INFO] Version: 1.0.0
# [INFO] Building Docker image: docker.io/myapp:1.0.0
# [SUCCESS] Image built successfully
# [INFO] Pushing Docker image: docker.io/myapp:1.0.0
# [SUCCESS] Image pushed successfully
# [INFO] Deploying to Kubernetes namespace: dev
# [INFO] Waiting for rollout to complete...
# [SUCCESS] Deployment successful
# [INFO] Verifying deployment...
# [SUCCESS] Health check passed
# [SUCCESS] Deployment verified
# [SUCCESS] === Deployment Complete ===
```

### Check Deployment Health

```bash
./check-health.sh dev app=myapp

# Output:
# myapp-5d7f8c9b4d-abc12: Running - Ready: true
# myapp-5d7f8c9b4d-def34: Running - Ready: true
# Ready: 2/2
# ✓ All pods healthy
```

### Create Backup

```bash
./backup.sh

# Output:
# Creating backup: ./backups/backup-20251215-120000.tar.gz
# Backup complete: ./backups/backup-20251215-120000.tar.gz
# Old backups cleaned up
```

## Validation

### Testing Checklist

```bash
# 1. Script is executable
[ -x deploy.sh ]
echo "Executable: $?"

# 2. Help works
./deploy.sh --help

# 3. Validates inputs
./deploy.sh invalid 1.0.0
# Should exit with error

# 4. Dry run works
./deploy.sh --dry-run dev 1.0.0
# Should not make changes

# 5. Logging works
[ -f logs/deploy-*.log ]
echo "Log file exists: $?"

# 6. Error handling works
# Introduce error and verify script exits
```

## Advanced Techniques

### Parallel Execution

```bash
# Run commands in parallel
deploy_service() {
    local service=$1
    echo "Deploying $service..."
    kubectl apply -f "$service.yaml"
}

for service in api web worker; do
    deploy_service "$service" &
done

wait  # Wait for all background jobs
```

### Progress Indicators

```bash
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while ps -p $pid > /dev/null; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Usage
long_running_command &
spinner $!
```

### Interactive Prompts

```bash
confirm() {
    read -p "$1 [y/N]: " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

if confirm "Deploy to production?"; then
    deploy_to_prod
fi
```

## Best Practices

### ✅ Do's

1. **Use strict mode**: `set -euo pipefail`
2. **Quote variables**: `"$VAR"` not `$VAR`
3. **Check exit codes**: `if command; then`
4. **Use functions**: Organize code
5. **Log everything**: Debug later
6. **Handle signals**: Cleanup with `trap`

### ❌ Don'ts

1. **Don't ignore errors**: Check return codes
2. **Don't use `eval`**: Security risk
3. **Don't parse `ls`**: Use glob patterns
4. **Don't forget quotes**: Word splitting issues
5. **Don't use `cat` unnecessarily**: Use redirection

## Links

- [Bash Manual](https://www.gnu.org/software/bash/manual/)
- [ShellCheck](https://www.shellcheck.net/) - Script linter
- [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html)
- [Advanced Bash-Scripting Guide](https://tldp.org/LDP/abs/html/)
- [Bash Pitfalls](https://mywiki.wooledge.org/BashPitfalls)

## Share Your Success

Created your automation script? Share it!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- What task you automated
- Time saved per run
- Lines of code
- Coolest feature

Use hashtags: **#AdventOfDevOps #Bash #Automation #Day15**
