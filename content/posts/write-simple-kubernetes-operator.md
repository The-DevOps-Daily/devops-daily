---
title: 'Understanding Kubernetes Operators: A Deep Dive with a Practical Example'
excerpt: 'Learn the concepts behind Kubernetes operators, why they exist, and how the control loop pattern works—then build one yourself to solidify your understanding.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-01-27'
publishedAt: '2026-01-27T09:00:00Z'
updatedAt: '2026-01-27T10:00:00Z'
readingTime: '25 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Operators
  - Go
  - DevOps
---

If you've worked with Kubernetes for any length of time, you've probably heard the term "operator" thrown around. Maybe you've installed one—like the Prometheus Operator or cert-manager—without fully understanding what makes it different from a regular Deployment. This post aims to change that.

We'll start by understanding *why* operators exist and the fundamental patterns they implement. Then we'll build one from scratch, explaining each concept as we go. By the end, you'll not only have a working operator but a mental model for how all Kubernetes controllers work under the hood.

## What Is a Kubernetes Operator?

Before diving into operators, let's step back and understand how Kubernetes itself works.

### The Declarative Model: Kubernetes' Core Philosophy

Kubernetes is built on a **declarative model**. You don't tell Kubernetes "start 3 pods"—you tell it "I want 3 pods running." The difference is subtle but profound:

- **Imperative**: "Do this action" (create, delete, scale)
- **Declarative**: "Make it look like this" (desired state)

When you apply a Deployment manifest, you're declaring your desired state. Kubernetes then figures out what actions are needed to make reality match that declaration. If a pod crashes, Kubernetes doesn't need you to tell it to restart—it sees the discrepancy and acts.

This is powerful because it makes your infrastructure **self-healing**. You describe what you want, and Kubernetes continuously works to maintain that state.

### The Control Loop Pattern: How Kubernetes Makes Decisions

This "observe and act" behavior is implemented through **control loops** (also called reconciliation loops). Every controller in Kubernetes follows the same pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                      Control Loop                           │
│                                                             │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐                │
│   │ OBSERVE │───▶│  DIFF   │───▶│   ACT   │                │
│   │         │    │         │    │         │                │
│   │ Current │    │ Current │    │ Create/ │                │
│   │  State  │    │   vs    │    │ Update/ │                │
│   │         │    │ Desired │    │ Delete  │                │
│   └─────────┘    └─────────┘    └─────────┘                │
│        ▲                              │                     │
│        └──────────────────────────────┘                     │
│                   (repeat forever)                          │
└─────────────────────────────────────────────────────────────┘
```

1. **Observe**: Watch for changes to resources (via the Kubernetes API)
2. **Diff**: Compare current state with desired state
3. **Act**: Make changes to close the gap
4. **Repeat**: Keep watching for more changes

The Deployment controller, for example, watches Deployment resources. When you create one asking for 3 replicas, it observes there are 0 pods, calculates a diff of -3, and creates 3 ReplicaSets (which in turn create pods).

**Why is this pattern so important?** Because it's **convergent**. No matter how the system gets into a bad state—whether from a crash, network partition, or manual tampering—the controller will keep trying to fix it. This is fundamentally different from scripts that run once and hope nothing changes.

### So What Makes an Operator Special?

An **operator** is simply a custom controller that manages **custom resources**. That's it.

The built-in controllers (Deployment, Service, etc.) manage built-in resources. When you need to manage something Kubernetes doesn't understand natively—like a PostgreSQL cluster, a machine learning pipeline, or a complex application—you create:

1. A **Custom Resource Definition (CRD)**: Teaches Kubernetes about your new resource type
2. A **Controller**: Watches for those resources and takes action

Together, these form an operator. The term "operator" comes from the idea that you're encoding the knowledge of a human operator (the person who knows how to run your application) into software.

### Why Not Just Use Helm or Scripts?

You might wonder: "Can't I just use Helm charts or shell scripts?"

The key difference is **continuous reconciliation**:

| Approach | When It Runs | What Happens If State Drifts |
|----------|--------------|------------------------------|
| Shell script | Once, when you run it | Nothing—drift accumulates |
| Helm install | Once, at install time | Nothing—you must re-run |
| Operator | Continuously | Automatically corrects drift |

An operator is always watching and always correcting. If someone manually deletes a resource your application needs, the operator recreates it. If a config drifts, the operator fixes it. This is called **level-triggered** behavior (reacting to state) vs **edge-triggered** (reacting to events).

**Think of it this way**: A Helm chart is like a recipe. An operator is like a chef who keeps checking on the dish and adjusting as needed.

### Real-World Operator Examples

To make this concrete, here's what some popular operators do:

- **Prometheus Operator**: You create a `Prometheus` CR specifying retention, replicas, and alerting rules. The operator creates the StatefulSet, ConfigMaps, Services, and wires up service discovery—tasks that would otherwise require deep Prometheus expertise.

- **cert-manager**: You create a `Certificate` CR specifying the domain. The operator handles ACME challenges, creates secrets with the cert, and renews before expiration—no cron jobs needed.

- **PostgreSQL Operator (Zalando)**: You create a `postgresql` CR. The operator provisions the primary, replicas, handles failover, backups, and connection pooling—encoding years of DBA knowledge.

In each case, you declare *what* you want, and the operator handles *how* to achieve and maintain it.

## Prerequisites

Before we build our operator, ensure you have these tools installed:

- **Go 1.22+**: The operator will be written in Go
- **Docker**: For building container images
- **kubectl**: For interacting with your cluster
- **kind or minikube**: For local Kubernetes testing
- **Kubebuilder 3.15+**: The scaffolding tool we'll use

### Why Go?

While operators can be written in any language (Python, Java, Rust, etc.), Go is the dominant choice because:

- Kubernetes itself is written in Go
- The official client libraries (`client-go`, `controller-runtime`) are Go-native and battle-tested
- The tooling (Kubebuilder, Operator SDK) generates Go code with best practices baked in
- Go's concurrency model fits well with the watch/reconcile pattern

### Why Kubebuilder?

Writing a controller from scratch requires significant boilerplate: setting up informers (to watch resources efficiently), work queues (to deduplicate reconciliation requests), leader election (so only one replica reconciles at a time), metrics, health checks, etc.

Kubebuilder generates all of this, letting you focus on your business logic. It's maintained by the Kubernetes SIG (Special Interest Group) and represents community best practices.

Install Kubebuilder:

```bash
curl -L -o kubebuilder "https://go.kubebuilder.io/dl/latest/$(go env GOOS)/$(go env GOARCH)"
chmod +x kubebuilder
sudo mv kubebuilder /usr/local/bin/
kubebuilder version
```

## Project Overview: Building a Website Operator

We'll build a "Website" operator—simple enough to understand fully, but complex enough to demonstrate real patterns.

### The User Experience We're Creating

A developer creates a `Website` resource:

```yaml
apiVersion: webapp.example.com/v1
kind: Website
metadata:
  name: my-blog
spec:
  replicas: 2
  html: "<h1>Welcome to my blog</h1>"
```

### What the Operator Does Behind the Scenes

1. Creates a **ConfigMap** with the HTML content
2. Creates a **Deployment** with nginx containers that mount the ConfigMap
3. Creates a **Service** to expose the website
4. Keeps everything in sync if anything changes or gets deleted

The developer doesn't need to understand Deployments, Services, or ConfigMaps. They just declare "I want a website" and the operator handles the rest.

## Step 1: Initialize the Project

Let's scaffold our project:

```bash
mkdir website-operator && cd website-operator
kubebuilder init --domain example.com --repo github.com/yourorg/website-operator
```

### Understanding the Flags

- **`--domain`**: Your organization's domain. This becomes part of your API group (e.g., `webapp.example.com`). Choose something unique to avoid conflicts with other operators.

- **`--repo`**: The Go module path. This must match your actual repo if you plan to push it. Go uses this for imports.

### What Gets Generated

Kubebuilder creates a significant project structure. Let's understand what matters:

```
website-operator/
├── cmd/main.go              # Entry point—sets up the manager
├── config/                   # Kubernetes manifests for deployment
│   ├── default/             # Kustomize base for deploying
│   ├── manager/             # Deployment for the operator itself
│   └── rbac/                # Generated RBAC rules
├── internal/controller/      # Where your reconciliation logic lives
├── Dockerfile                # Multi-stage build for the operator
└── Makefile                  # Common tasks (build, test, deploy)
```

### The Manager: Your Operator's Brain

The `cmd/main.go` file sets up what Kubebuilder calls a "Manager." This is crucial to understand:

```go
// Simplified version of what's in cmd/main.go
mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
    Scheme:                 scheme,
    MetricsBindAddress:     metricsAddr,
    LeaderElection:         enableLeaderElection,
    LeaderElectionID:       "website-operator.example.com",
})
```

The Manager:
- **Connects to the Kubernetes API** using in-cluster config or your kubeconfig
- **Runs all your controllers** in a coordinated way
- **Handles leader election** so only one replica reconciles at a time (critical for consistency)
- **Exposes Prometheus metrics** at `/metrics`
- **Manages graceful shutdown** when receiving SIGTERM

You rarely need to modify this file—Kubebuilder sets it up correctly.

## Step 2: Create the API and Controller

Now we create our custom resource type and its controller:

```bash
kubebuilder create api --group webapp --version v1 --kind Website
```

Answer `y` to both prompts (create resource and controller).

### Understanding the Naming Convention

Kubernetes API resources follow a strict naming convention:

- **Group**: Like a package name, groups related resources (e.g., `apps`, `networking.k8s.io`). Ours is `webapp`.
- **Version**: API version (`v1`, `v1beta1`, `v1alpha1`)—allows your API to evolve over time
- **Kind**: The resource type name (capitalized, singular)

The full API group becomes `webapp.example.com` (group + domain from init).

When users interact with our resource, they'll write:

```yaml
apiVersion: webapp.example.com/v1  # group/version
kind: Website                       # kind
```

### What Gets Generated

This command generates two critical files:

| File | Purpose |
|------|------|
| `api/v1/website_types.go` | Go structs defining your CRD schema |
| `internal/controller/website_controller.go` | Reconciliation logic |

Let's examine each.

## Step 3: Define the Custom Resource

The generated `api/v1/website_types.go` has placeholder fields. Before writing code, let's think about API design.

### Thinking About Your API

A CRD has two main sections:

- **Spec**: What the user wants (input)
- **Status**: What currently exists (output, read-only for users)

For our Website:
- **Spec**: replicas, image, HTML content
- **Status**: ready replicas, available URL, conditions

**Good API design principle**: The spec should be simple and declarative. Users shouldn't need to understand implementation details.

Edit `api/v1/website_types.go`:

```go
package v1

import (
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// WebsiteSpec defines the desired state of Website
// This is what users configure
type WebsiteSpec struct {
    // Replicas is the number of nginx pods to run
    // +kubebuilder:validation:Minimum=1
    // +kubebuilder:validation:Maximum=10
    // +kubebuilder:default=1
    Replicas int32 `json:"replicas,omitempty"`

    // Image is the container image to use
    // +kubebuilder:default="nginx:1.27-alpine"
    Image string `json:"image,omitempty"`

    // HTML is the content to serve
    // +kubebuilder:validation:MinLength=1
    HTML string `json:"html"`
}

// WebsiteStatus defines the observed state of Website
// This is what the operator reports back
type WebsiteStatus struct {
    // ReadyReplicas is how many pods are actually ready
    ReadyReplicas int32 `json:"readyReplicas,omitempty"`

    // URL is where the website can be accessed
    URL string `json:"url,omitempty"`

    // Conditions represent the latest observations
    Conditions []metav1.Condition `json:"conditions,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="Replicas",type=integer,JSONPath=`.spec.replicas`
// +kubebuilder:printcolumn:name="Ready",type=integer,JSONPath=`.status.readyReplicas`
// +kubebuilder:printcolumn:name="URL",type=string,JSONPath=`.status.url`
// +kubebuilder:printcolumn:name="Age",type=date,JSONPath=`.metadata.creationTimestamp`

// Website is the Schema for the websites API
type Website struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`

    Spec   WebsiteSpec   `json:"spec,omitempty"`
    Status WebsiteStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// WebsiteList contains a list of Website
type WebsiteList struct {
    metav1.TypeMeta `json:",inline"`
    metav1.ListMeta `json:"metadata,omitempty"`
    Items           []Website `json:"items"`
}

func init() {
    SchemeBuilder.Register(&Website{}, &WebsiteList{})
}
```

### Understanding the Marker Comments

Those `// +kubebuilder:` comments aren't just documentation—they're **markers** that Kubebuilder's code generator reads:

| Marker | What It Does |
|--------|-------------|
| `+kubebuilder:validation:Minimum=1` | Adds OpenAPI validation to the CRD |
| `+kubebuilder:default=1` | Sets default value if user doesn't specify |
| `+kubebuilder:subresource:status` | Enables the `/status` subresource (important for RBAC separation) |
| `+kubebuilder:printcolumn:...` | Adds columns to `kubectl get websites` output |

**Why use markers instead of Go code?** Because CRDs are defined in YAML and served by the Kubernetes API server. The markers generate that YAML from your Go types, keeping everything in sync.

After editing, regenerate the manifests:

```bash
make manifests
```

This updates `config/crd/bases/webapp.example.com_websites.yaml` with your schema.

## Step 4: Implement the Reconciliation Logic

Now for the heart of the operator: the reconciliation function. This is where you implement the control loop.

### Understanding the Reconcile Function

Open `internal/controller/website_controller.go`. The generated code looks like:

```go
func (r *WebsiteReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    _ = log.FromContext(ctx)
    // TODO: your logic here
    return ctrl.Result{}, nil
}
```

This function gets called whenever:
- A Website resource is created, updated, or deleted
- A resource the Website "owns" changes (we'll set this up)
- A periodic resync happens (configurable, default 10 hours)
- You explicitly request a requeue

**Important**: The function receives a `Request` containing just the namespace/name of the resource. You must fetch the actual resource yourself. This is intentional—it prevents stale data issues.

### The Reconciliation Pattern

Here's the mental model for writing reconciliation logic:

```
1. Fetch the primary resource (Website)
   - If not found → it was deleted, nothing to do
   
2. For each dependent resource (ConfigMap, Deployment, Service):
   a. Define what it SHOULD look like
   b. Check if it EXISTS
   c. If not exists → CREATE it
   d. If exists but different → UPDATE it
   
3. Update the status of the primary resource

4. Return success (or requeue if needed)
```

Let's implement this:

```go
package controller

import (
    "context"
    "fmt"

    appsv1 "k8s.io/api/apps/v1"
    corev1 "k8s.io/api/core/v1"
    "k8s.io/apimachinery/pkg/api/errors"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/runtime"
    "k8s.io/apimachinery/pkg/types"
    "k8s.io/apimachinery/pkg/util/intstr"
    ctrl "sigs.k8s.io/controller-runtime"
    "sigs.k8s.io/controller-runtime/pkg/client"
    "sigs.k8s.io/controller-runtime/pkg/log"

    webappv1 "github.com/yourorg/website-operator/api/v1"
)

// WebsiteReconciler reconciles a Website object
type WebsiteReconciler struct {
    client.Client
    Scheme *runtime.Scheme
}

// +kubebuilder:rbac:groups=webapp.example.com,resources=websites,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=webapp.example.com,resources=websites/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=webapp.example.com,resources=websites/finalizers,verbs=update
// +kubebuilder:rbac:groups=apps,resources=deployments,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=core,resources=services,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=core,resources=configmaps,verbs=get;list;watch;create;update;patch;delete

func (r *WebsiteReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    logger := log.FromContext(ctx)

    // ============================================================
    // STEP 1: Fetch the Website resource
    // ============================================================
    // We always start by fetching the primary resource. If it's gone,
    // Kubernetes garbage collection handles cleanup (via OwnerReferences).
    
    website := &webappv1.Website{}
    if err := r.Get(ctx, req.NamespacedName, website); err != nil {
        if errors.IsNotFound(err) {
            // Resource was deleted - nothing to do
            // Owned resources get cleaned up automatically
            logger.Info("Website resource not found, likely deleted")
            return ctrl.Result{}, nil
        }
        // Error fetching - requeue
        return ctrl.Result{}, err
    }

    logger.Info("Reconciling Website", "name", website.Name)

    // ============================================================
    // STEP 2: Reconcile the ConfigMap (holds HTML content)
    // ============================================================
    // ConfigMap stores our HTML. We create it first because the
    // Deployment needs to mount it.
    
    configMap := r.configMapForWebsite(website)
    if err := r.reconcileConfigMap(ctx, website, configMap); err != nil {
        return ctrl.Result{}, err
    }

    // ============================================================
    // STEP 3: Reconcile the Deployment (runs nginx pods)
    // ============================================================
    deployment := r.deploymentForWebsite(website)
    if err := r.reconcileDeployment(ctx, website, deployment); err != nil {
        return ctrl.Result{}, err
    }

    // ============================================================
    // STEP 4: Reconcile the Service (exposes the pods)
    // ============================================================
    service := r.serviceForWebsite(website)
    if err := r.reconcileService(ctx, website, service); err != nil {
        return ctrl.Result{}, err
    }

    // ============================================================
    // STEP 5: Update the Website status
    // ============================================================
    // Fetch the current deployment to get ready replica count
    currentDeployment := &appsv1.Deployment{}
    if err := r.Get(ctx, types.NamespacedName{
        Name:      website.Name,
        Namespace: website.Namespace,
    }, currentDeployment); err == nil {
        website.Status.ReadyReplicas = currentDeployment.Status.ReadyReplicas
    }
    
    website.Status.URL = fmt.Sprintf("http://%s.%s.svc.cluster.local", 
        website.Name, website.Namespace)
    
    if err := r.Status().Update(ctx, website); err != nil {
        logger.Error(err, "Failed to update Website status")
        return ctrl.Result{}, err
    }

    logger.Info("Successfully reconciled Website")
    return ctrl.Result{}, nil
}
```

### The Helper Functions: Building Desired State

Now let's implement the helper functions. Each one defines what a resource SHOULD look like:

```go
// configMapForWebsite creates the desired ConfigMap spec
func (r *WebsiteReconciler) configMapForWebsite(website *webappv1.Website) *corev1.ConfigMap {
    return &corev1.ConfigMap{
        ObjectMeta: metav1.ObjectMeta{
            Name:      website.Name,
            Namespace: website.Namespace,
        },
        Data: map[string]string{
            "index.html": website.Spec.HTML,
        },
    }
}

// deploymentForWebsite creates the desired Deployment spec
func (r *WebsiteReconciler) deploymentForWebsite(website *webappv1.Website) *appsv1.Deployment {
    labels := map[string]string{
        "app":        "website",
        "website":    website.Name,
    }
    replicas := website.Spec.Replicas
    
    // Determine the image to use
    image := website.Spec.Image
    if image == "" {
        image = "nginx:1.27-alpine"
    }

    return &appsv1.Deployment{
        ObjectMeta: metav1.ObjectMeta{
            Name:      website.Name,
            Namespace: website.Namespace,
        },
        Spec: appsv1.DeploymentSpec{
            Replicas: &replicas,
            Selector: &metav1.LabelSelector{
                MatchLabels: labels,
            },
            Template: corev1.PodTemplateSpec{
                ObjectMeta: metav1.ObjectMeta{
                    Labels: labels,
                },
                Spec: corev1.PodSpec{
                    Containers: []corev1.Container{{
                        Name:  "nginx",
                        Image: image,
                        Ports: []corev1.ContainerPort{{
                            ContainerPort: 80,
                        }},
                        VolumeMounts: []corev1.VolumeMount{{
                            Name:      "html",
                            MountPath: "/usr/share/nginx/html",
                        }},
                    }},
                    Volumes: []corev1.Volume{{
                        Name: "html",
                        VolumeSource: corev1.VolumeSource{
                            ConfigMap: &corev1.ConfigMapVolumeSource{
                                LocalObjectReference: corev1.LocalObjectReference{
                                    Name: website.Name,
                                },
                            },
                        },
                    }},
                },
            },
        },
    }
}

// serviceForWebsite creates the desired Service spec
func (r *WebsiteReconciler) serviceForWebsite(website *webappv1.Website) *corev1.Service {
    return &corev1.Service{
        ObjectMeta: metav1.ObjectMeta{
            Name:      website.Name,
            Namespace: website.Namespace,
        },
        Spec: corev1.ServiceSpec{
            Selector: map[string]string{
                "app":     "website",
                "website": website.Name,
            },
            Ports: []corev1.ServicePort{{
                Port:       80,
                TargetPort: intstr.FromInt(80),
            }},
            Type: corev1.ServiceTypeClusterIP,
        },
    }
}
```

### The Reconcile Helpers: Create or Update Pattern

Now the functions that actually create or update resources:

```go
func (r *WebsiteReconciler) reconcileConfigMap(ctx context.Context, website *webappv1.Website, desired *corev1.ConfigMap) error {
    logger := log.FromContext(ctx)
    
    // Set owner reference - this is crucial for garbage collection!
    // When the Website is deleted, this ConfigMap will be automatically deleted too
    if err := ctrl.SetControllerReference(website, desired, r.Scheme); err != nil {
        return err
    }

    // Check if ConfigMap already exists
    existing := &corev1.ConfigMap{}
    err := r.Get(ctx, types.NamespacedName{Name: desired.Name, Namespace: desired.Namespace}, existing)
    
    if errors.IsNotFound(err) {
        // Doesn't exist - create it
        logger.Info("Creating ConfigMap", "name", desired.Name)
        return r.Create(ctx, desired)
    } else if err != nil {
        return err
    }

    // Exists - check if it needs updating
    if existing.Data["index.html"] != desired.Data["index.html"] {
        logger.Info("Updating ConfigMap", "name", desired.Name)
        existing.Data = desired.Data
        return r.Update(ctx, existing)
    }

    return nil
}

func (r *WebsiteReconciler) reconcileDeployment(ctx context.Context, website *webappv1.Website, desired *appsv1.Deployment) error {
    logger := log.FromContext(ctx)
    
    if err := ctrl.SetControllerReference(website, desired, r.Scheme); err != nil {
        return err
    }

    existing := &appsv1.Deployment{}
    err := r.Get(ctx, types.NamespacedName{Name: desired.Name, Namespace: desired.Namespace}, existing)
    
    if errors.IsNotFound(err) {
        logger.Info("Creating Deployment", "name", desired.Name)
        return r.Create(ctx, desired)
    } else if err != nil {
        return err
    }

    // Check if spec changed (replicas or image)
    needsUpdate := false
    if *existing.Spec.Replicas != *desired.Spec.Replicas {
        needsUpdate = true
    }
    if existing.Spec.Template.Spec.Containers[0].Image != desired.Spec.Template.Spec.Containers[0].Image {
        needsUpdate = true
    }

    if needsUpdate {
        logger.Info("Updating Deployment", "name", desired.Name)
        existing.Spec.Replicas = desired.Spec.Replicas
        existing.Spec.Template.Spec.Containers[0].Image = desired.Spec.Template.Spec.Containers[0].Image
        return r.Update(ctx, existing)
    }

    return nil
}

func (r *WebsiteReconciler) reconcileService(ctx context.Context, website *webappv1.Website, desired *corev1.Service) error {
    logger := log.FromContext(ctx)
    
    if err := ctrl.SetControllerReference(website, desired, r.Scheme); err != nil {
        return err
    }

    existing := &corev1.Service{}
    err := r.Get(ctx, types.NamespacedName{Name: desired.Name, Namespace: desired.Namespace}, existing)
    
    if errors.IsNotFound(err) {
        logger.Info("Creating Service", "name", desired.Name)
        return r.Create(ctx, desired)
    } else if err != nil {
        return err
    }

    // Services are mostly immutable after creation, skip update
    return nil
}
```

### Understanding Owner References

Notice the `ctrl.SetControllerReference()` calls. This is critical:

```go
if err := ctrl.SetControllerReference(website, desired, r.Scheme); err != nil {
    return err
}
```

This sets an **OwnerReference** on the child resource pointing to the Website. When Kubernetes sees this:

1. If the Website is deleted, all owned resources are automatically deleted (garbage collection)
2. Changes to owned resources trigger reconciliation of the owner
3. `kubectl get configmap my-site -o yaml` shows the owner

**This is why we don't need cleanup code**—Kubernetes handles it automatically.

### Setting Up the Controller Watches

Finally, we need to tell the controller what to watch. Add this at the bottom of the file:

```go
func (r *WebsiteReconciler) SetupWithManager(mgr ctrl.Manager) error {
    return ctrl.NewControllerManagedBy(mgr).
        For(&webappv1.Website{}).
        Owns(&appsv1.Deployment{}).
        Owns(&corev1.Service{}).
        Owns(&corev1.ConfigMap{}).
        Complete(r)
}
```

**What does this mean?**

- `For(&webappv1.Website{})`: Primary resource to watch. Any CRUD triggers reconcile.
- `Owns(&appsv1.Deployment{})`: Also watch Deployments that have our Website as owner. If someone deletes the Deployment, we'll recreate it.

This is what makes operators self-healing!

## Step 5: Build and Deploy the Operator

### Install the CRD

First, install your Custom Resource Definition:

```bash
make install
```

This runs `kubectl apply` on the generated CRD in `config/crd/bases/`.

### Run Locally for Development

During development, run the operator outside the cluster:

```bash
make run
```

This is faster than building images for every change. The operator uses your kubeconfig to connect.

### Build and Deploy to Cluster

For production, build and push the image:

```bash
# Build the image
make docker-build IMG=yourregistry/website-operator:v1

# Push to registry
make docker-push IMG=yourregistry/website-operator:v1

# Deploy to cluster
make deploy IMG=yourregistry/website-operator:v1
```

## Step 6: Test the Operator

### Create a Website Resource

Create `sample-website.yaml`:

```yaml
apiVersion: webapp.example.com/v1
kind: Website
metadata:
  name: hello-world
  namespace: default
spec:
  replicas: 2
  html: |
    <!DOCTYPE html>
    <html>
    <head><title>Hello from Operator</title></head>
    <body>
      <h1>Hello, Kubernetes Operator!</h1>
      <p>This website is managed by a custom operator.</p>
    </body>
    </html>
```

Apply it:

```bash
kubectl apply -f sample-website.yaml
```

### Verify the Resources

```bash
# Check the Website resource
kubectl get websites
NAME          REPLICAS   READY   URL                                            AGE
hello-world   2          2       http://hello-world.default.svc.cluster.local   30s

# Check created resources
kubectl get deployment,service,configmap -l website=hello-world
```

### Test Self-Healing

Delete the deployment and watch it get recreated:

```bash
kubectl delete deployment hello-world
kubectl get deployment hello-world -w  # Watch it come back
```

### Access the Website

```bash
kubectl port-forward svc/hello-world 8080:80
# Open http://localhost:8080
```

### Test Updates

Change the HTML and apply again:

```bash
kubectl patch website hello-world --type=merge -p '{"spec":{"html":"<h1>Updated!</h1>"}}'
```

Watch the ConfigMap update and pods restart.

## Step 7: Add Unit Tests

Kubebuilder generates a test suite using Ginkgo and envtest (an in-memory Kubernetes API server).

Edit `internal/controller/website_controller_test.go`:

```go
package controller

import (
    "context"
    "time"

    . "github.com/onsi/ginkgo/v2"
    . "github.com/onsi/gomega"
    appsv1 "k8s.io/api/apps/v1"
    corev1 "k8s.io/api/core/v1"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/types"

    webappv1 "github.com/yourorg/website-operator/api/v1"
)

var _ = Describe("Website Controller", func() {
    const (
        timeout  = time.Second * 10
        interval = time.Millisecond * 250
    )

    Context("When creating a Website", func() {
        It("Should create a Deployment with correct replicas", func() {
            ctx := context.Background()
            
            // Create a Website
            website := &webappv1.Website{
                ObjectMeta: metav1.ObjectMeta{
                    Name:      "test-website",
                    Namespace: "default",
                },
                Spec: webappv1.WebsiteSpec{
                    Replicas: 3,
                    HTML:     "<h1>Test</h1>",
                },
            }
            Expect(k8sClient.Create(ctx, website)).Should(Succeed())

            // Verify Deployment is created
            deploymentKey := types.NamespacedName{Name: "test-website", Namespace: "default"}
            deployment := &appsv1.Deployment{}
            Eventually(func() error {
                return k8sClient.Get(ctx, deploymentKey, deployment)
            }, timeout, interval).Should(Succeed())
            Expect(*deployment.Spec.Replicas).Should(Equal(int32(3)))
        })

        It("Should create a ConfigMap with the HTML content", func() {
            ctx := context.Background()
            
            configMapKey := types.NamespacedName{Name: "test-website", Namespace: "default"}
            configMap := &corev1.ConfigMap{}
            Eventually(func() error {
                return k8sClient.Get(ctx, configMapKey, configMap)
            }, timeout, interval).Should(Succeed())
            Expect(configMap.Data["index.html"]).Should(Equal("<h1>Test</h1>"))
        })
        
        It("Should create a Service", func() {
            ctx := context.Background()
            
            serviceKey := types.NamespacedName{Name: "test-website", Namespace: "default"}
            service := &corev1.Service{}
            Eventually(func() error {
                return k8sClient.Get(ctx, serviceKey, service)
            }, timeout, interval).Should(Succeed())
            Expect(service.Spec.Ports[0].Port).Should(Equal(int32(80)))
        })
    })
})
```

Run the tests:

```bash
make test
```

## Best Practices for Production Operators

### Handle Finalizers for External Resource Cleanup

Owner references handle Kubernetes resources, but what about external resources (cloud infrastructure, DNS records, external databases)?

Use **finalizers**—they block deletion until you've cleaned up:

```go
import "sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"

const websiteFinalizer = "webapp.example.com/finalizer"

func (r *WebsiteReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    website := &webappv1.Website{}
    if err := r.Get(ctx, req.NamespacedName, website); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // Check if being deleted
    if !website.DeletionTimestamp.IsZero() {
        if controllerutil.ContainsFinalizer(website, websiteFinalizer) {
            // Perform cleanup of external resources
            if err := r.cleanupExternalResources(website); err != nil {
                return ctrl.Result{}, err
            }
            // Remove finalizer to allow deletion to proceed
            controllerutil.RemoveFinalizer(website, websiteFinalizer)
            return ctrl.Result{}, r.Update(ctx, website)
        }
        return ctrl.Result{}, nil
    }

    // Add finalizer if not present
    if !controllerutil.ContainsFinalizer(website, websiteFinalizer) {
        controllerutil.AddFinalizer(website, websiteFinalizer)
        return ctrl.Result{}, r.Update(ctx, website)
    }

    // Normal reconciliation...
    return ctrl.Result{}, nil
}
```

**How it works**: When you `kubectl delete` a resource with a finalizer, Kubernetes sets `deletionTimestamp` but doesn't actually delete until all finalizers are removed.

### Implement Proper Error Handling and Requeuing

Not all errors are equal:

```go
func (r *WebsiteReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // ...

    // Transient error (API rate limit, network blip) - retry soon
    if isTransientError(err) {
        return ctrl.Result{RequeueAfter: time.Second * 30}, nil
    }
    
    // Permanent error (invalid config) - don't retry, update status
    if isPermanentError(err) {
        website.Status.Conditions = append(website.Status.Conditions, metav1.Condition{
            Type:    "Ready",
            Status:  metav1.ConditionFalse,
            Reason:  "ConfigurationError",
            Message: err.Error(),
        })
        r.Status().Update(ctx, website)
        return ctrl.Result{}, nil  // Don't return error, don't requeue
    }

    return ctrl.Result{}, nil
}
```

### Use Conditions for Status Reporting

Conditions are the standard way to communicate resource state:

```go
import "k8s.io/apimachinery/pkg/api/meta"

// Set a condition
meta.SetStatusCondition(&website.Status.Conditions, metav1.Condition{
    Type:               "Ready",
    Status:             metav1.ConditionTrue,
    Reason:             "ReconcileSuccess",
    Message:            "All resources created successfully",
    LastTransitionTime: metav1.Now(),
})

// Check a condition
if meta.IsStatusConditionTrue(website.Status.Conditions, "Ready") {
    // Website is ready
}
```

### Add Metrics for Observability

Kubebuilder includes Prometheus metrics. Add custom metrics:

```go
import (
    "github.com/prometheus/client_golang/prometheus"
    "sigs.k8s.io/controller-runtime/pkg/metrics"
)

var (
    websiteReconcileTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "website_reconcile_total",
            Help: "Total number of reconciliations per website",
        },
        []string{"website", "namespace"},
    )
    
    websiteReconcileErrors = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "website_reconcile_errors_total",
            Help: "Total number of reconciliation errors",
        },
        []string{"website", "namespace"},
    )
)

func init() {
    metrics.Registry.MustRegister(websiteReconcileTotal, websiteReconcileErrors)
}
```

## Conclusion

Building a Kubernetes operator is about encoding operational knowledge into software. The Website operator we built demonstrates patterns that apply to any operator:

1. **CRDs define your API**: Users interact with simple, declarative resources
2. **Reconciliation loops converge to desired state**: Always comparing and fixing
3. **Owner references enable garbage collection**: No manual cleanup needed
4. **Watches enable self-healing**: Changes to owned resources trigger reconciliation
5. **Status provides observability**: Users can see what's happening

The operator pattern is powerful because it lets you build **autonomous systems**. Instead of scripts that run once and hope, operators continuously ensure your infrastructure matches what you declared.

From here, you can extend your operator with:

- **Webhooks** for validation (reject invalid configs) and mutation (set defaults)
- **Multiple CRDs** with relationships between them
- **Integration with external services** (DNS, cloud providers, databases)
- **Leader election** for high availability (already built into the Manager)

The Kubebuilder book and Operator SDK documentation provide deeper dives into these topics. Start simple, solve a real problem, and iterate based on actual needs.
