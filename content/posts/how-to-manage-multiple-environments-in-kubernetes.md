---
title: 'How to Manage Kubernetes Environments: Namespaces, Contexts, Clusters'
excerpt: 'Separate staging, QA and production with namespaces or clusters, switch kubectl between namespaces and clusters such as GKE and minikube, reach Services in other namespaces, and sign in to a cluster web UI.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-01-22'
publishedAt: '2024-01-22T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - kubectl
  - Namespaces
  - kubeconfig
  - Kustomize
  - Environments
---

Most teams run the same app in several environments: development, QA, staging and production. In Kubernetes that raises two questions. First, where does each environment live: in its own namespace, or in its own cluster? Second, how do you make sure that every `kubectl` command goes to the environment you mean? A `kubectl delete` in the production context instead of staging is one of the most expensive mistakes in Kubernetes. This post answers both questions, shows how to switch namespaces and clusters (including GKE and minikube), how to reach a Service in another namespace, and how to sign in to a web UI for a cluster.

## TLDR

| Question                                   | Short answer                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Namespaces or clusters for environments?   | Production in its own cluster. Development, QA and staging can share a cluster, one namespace each  |
| One set of manifests for all environments? | Kustomize overlays or Helm values files, one for each environment                                   |
| Switch the default namespace               | `kubectl config set-context --current --namespace=staging`                                          |
| Which namespace am I in?                   | `kubectl config view --minify -o jsonpath='{..namespace}'` (empty means `default`)                  |
| Reach a Service in another namespace       | Use `<service>.<namespace>`, for example `http://api.staging:8080`, and allow it in NetworkPolicies |
| Switch cluster                             | `kubectl config use-context <context>`, or `--context <context>` for one command                    |
| Get a GKE context                          | `gcloud container clusters get-credentials <cluster> --region <region>`                             |
| Kubernetes Dashboard sign-in               | The Dashboard is archived. Use Headlamp, which signs in with your kubeconfig or a token             |

## Prerequisites

- `kubectl` and access to at least one cluster. For the GKE and minikube examples, the `gcloud` CLI or minikube.
- Basic knowledge of namespaces. [Contexts and kubeconfig](/guides/introduction-to-kubernetes/02-setting-up-a-kubernetes-cluster#h2-contexts-and-kubeconfig) in the Kubernetes guide explains the kubeconfig file.

## Namespaces or Separate Clusters for Each Environment?

A **namespace** divides one cluster into named groups of objects. It is cheap and fast to create, which makes it a good unit for development, QA and short-lived preview environments. But all namespaces share the same control plane and the same Kubernetes version, and by default the same nodes. They also share all cluster-scoped objects: CRDs, ClusterRoles, StorageClasses, admission webhooks, IngressClasses and GatewayClasses. Usually one Ingress or Gateway controller serves all of them too.

| Concern                                | Namespaces in one cluster                        | Separate clusters                                                           |
| -------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| Cost                                   | One control plane, shared nodes                  | A control plane and nodes for each                                          |
| A bad CRD, webhook or operator upgrade | Affects every environment                        | Affects one cluster                                                         |
| Testing a Kubernetes upgrade           | Not possible before production gets it           | Upgrade staging first                                                       |
| Network isolation                      | Only with NetworkPolicies or CNI rules           | Separate pod networks, but your VPC and firewall rules decide what connects |
| Access control                         | RoleBindings for each namespace                  | Separate credentials for each cluster                                       |
| A noisy workload                       | Can use the shared nodes, unless quotas limit it | Stays in its cluster                                                        |

A common setup has two or more clusters: one for production, and one non-production cluster with a namespace for each other environment. Teams with strict rules add a staging cluster that has the same version and add-ons as production.

A namespace scopes names and RBAC, but it does not isolate network traffic or node resources by itself. Give each environment namespace its own limits and access rules:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: staging
  labels:
    pod-security.kubernetes.io/enforce: restricted # Pod Security Admission
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute
  namespace: staging
spec:
  hard:
    requests.cpu: '8'
    requests.memory: 16Gi
    limits.memory: 32Gi
    pods: '60'
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developers-edit
  namespace: staging
subjects:
  - kind: Group
    name: developers # the group name from your identity provider
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: edit # a built-in role, limited to this namespace by the RoleBinding
  apiGroup: rbac.authorization.k8s.io
```

A quota on requests rejects pods that set no requests, so add a LimitRange with default values as well. Add default-deny NetworkPolicies for ingress and egress too, so that pods in `staging` cannot connect to or receive connections from other namespaces unless you allow it. [Namespaces organize things; they do not isolate anything](/posts/kubernetes-concepts-junior-to-mid-level#h2-7-namespaces-organize-things-they-do-not-isolate-anything) explains why each of these is needed.

## How Do I Keep One Set of Manifests for Several Environments?

Keep the shared manifests once, and the differences per environment. With **Kustomize**, which is built into kubectl, that is a base and one overlay for each environment:

```text
k8s/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/
    ├── staging/kustomization.yaml
    └── production/kustomization.yaml
```

```yaml
# k8s/overlays/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: staging # sets the namespace on every namespaced object
resources:
  - ../../base
images:
  - name: registry.example.com/web
    newTag: '2026.11.13-3f2a9c1' # the build that staging runs
replicas:
  - name: web
    count: 2
configMapGenerator:
  - name: web-config
    literals:
      - DATABASE_HOST=postgres.staging.svc.cluster.local
```

```bash
kubectl kustomize k8s/overlays/staging      # print the result
kubectl apply -k k8s/overlays/staging       # apply it
```

`configMapGenerator` adds a hash of the contents to the ConfigMap name, and Kustomize updates the references to it. If the Deployment in the base uses `web-config`, a config change therefore changes the pod template and rolls out new pods. With **Helm**, you keep one chart and a values file for each environment: `helm upgrade --install web ./chart -n staging -f values-staging.yaml`.

Do not apply one file to several namespaces with `kubectl apply -f app.yaml -n qa` if the file sets `metadata.namespace`. kubectl refuses when the two do not match, with an error like `the namespace from the provided object "staging" does not match the namespace "qa"`. Leave the namespace out of the base, and let the overlay or `-n` set it.

Promote a release by changing the image tag in the next environment's overlay, through a pull request. A GitOps tool such as Argo CD then applies each overlay to its cluster and namespace. The [Argo CD multi-environment checklist](/checklists/argocd-multi-environment-repo-structure) and [quiz](/quizzes/argocd-multi-environment-quiz) cover the repository layouts that work.

## How Do I Switch Namespace in Kubernetes?

Set the namespace of your current context:

```bash
kubectl config set-context --current --namespace=staging
kubectl config view --minify -o jsonpath='{..namespace}{"\n"}'
```

```text
staging
```

An empty result means the context has no namespace set, so kubectl uses `default`. To work in another namespace for one command only, add `-n qa`. To list objects in every namespace, add `-A`.

Two things surprise people:

- **kubectl does not check that the namespace exists.** After a typo, `kubectl get pods` and other list commands answer `No resources found in stagng namespace.` Check the name with `kubectl get namespace staging`.
- **The namespace is saved in the kubeconfig file.** Every terminal that uses the same file and context now uses the new namespace too.

[kubens](https://github.com/ahmetb/kubectx) is a small tool that lists namespaces and switches with one word: `kubens staging`.

## How Do I Reach a Service in Another Namespace?

Add the namespace to the Service name. Cluster DNS gives every Service the name `<service>.<namespace>.svc.cluster.local`, and the search path in each pod lets you use the short form `<service>.<namespace>`:

```bash
# from a pod in the shop namespace, to the api Service in the staging namespace
curl http://api.staging:8080/health
curl http://api.staging.svc.cluster.local:8080/health   # the full name; also works
```

The bare name `api` resolves only inside the pod's own namespace, which is why the same code works in `staging` and fails with an unknown host in `shop`. `cluster.local` is the default cluster domain. Some clusters use another one, so prefer `api.staging` in configuration, or `api.staging.svc` when a client needs a dot-qualified name.

To test name resolution and the connection from inside the cluster, start a short-lived pod:

```bash
kubectl run net-test -n shop --rm -it --restart=Never --image=busybox:1.37 -- \
  sh -c 'nslookup api.staging && wget -qO- -T 3 http://api.staging:8080/health'
```

If the name resolves but the connection times out, a NetworkPolicy probably blocks it. Namespaces do not block traffic by themselves, but a default-deny policy in `staging` does, and then you need a rule that lets the other namespace in. Every namespace has the label `kubernetes.io/metadata.name`, so you can select it by name:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-shop
  namespace: staging # the policy lives where the traffic arrives
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: shop
      ports:
        - port: 8080
```

If `shop` has a default-deny egress policy, it also needs a rule that allows traffic to `staging` and to DNS. Two more cases need a different tool:

- **An alias in your own namespace.** A Service of type `ExternalName` with `externalName: api.staging.svc.cluster.local` lets pods in `shop` use the name `api`. It is only a DNS CNAME: it does not proxy traffic, and it does not change the ports or the NetworkPolicies that apply.
- **Routing from an Ingress or a Gateway.** An Ingress can only send traffic to Services in its own namespace. With the Gateway API, an HTTPRoute can point to a Service in another namespace when that namespace allows it with a `ReferenceGrant`. [Gateway API in the Kubernetes guide](/guides/introduction-to-kubernetes/05-services-and-networking#h2-gateway-api) shows Gateways and HTTPRoutes.

`kubectl` itself is not the problem here: to read a Service in another namespace, add `-n`, for example `kubectl get service api -n staging` or `kubectl get endpointslices -n staging -l kubernetes.io/service-name=api`.

## How Do I Switch kubectl Between Clusters, Such as GKE and minikube?

To use a cluster, you need a **context** in your kubeconfig: a cluster, a user and an optional namespace. List the contexts:

```bash
kubectl config get-contexts
```

```text
CURRENT   NAME                              CLUSTER                           AUTHINFO                          NAMESPACE
*         gke_shop-prod_europe-west1_prod   gke_shop-prod_europe-west1_prod   gke_shop-prod_europe-west1_prod
          minikube                          minikube                          minikube                          default
```

The `*` marks the current context. Switch, and check:

```bash
kubectl config use-context minikube   # Switched to context "minikube".
kubectl config current-context        # minikube
```

The tools that create clusters add the contexts for you:

- **GKE**: `gcloud container clusters get-credentials prod --region europe-west1 --project shop-prod` adds a context named `gke_<project>_<location>_<cluster>` and switches to it. kubectl needs the `gke-gcloud-auth-plugin` for GKE (`gcloud components install gke-gcloud-auth-plugin`), because the built-in Google auth was removed from kubectl in 1.26.
- **minikube**: `minikube start` creates the `minikube` context and switches to it. A second cluster with `minikube start -p dev` gets the context `dev`. If the cluster's address changed, `minikube update-context` fixes it.
- **kind**: `kind create cluster --name dev` adds `kind-dev`.

Long generated names are easy to confuse. Rename them: `kubectl config rename-context gke_shop-prod_europe-west1_prod gke-prod`.

To avoid a command against the wrong cluster:

1. **Show the context in your shell prompt**, for example with [kube-ps1](https://github.com/jonmosco/kube-ps1).
2. **Use `--context` in scripts and runbooks**, so they do not depend on the context that someone switched to last: `kubectl --context gke-prod -n shop get pods`.
3. **Keep production in its own kubeconfig file**, and load it only in the terminal where you need it: `export KUBECONFIG=~/.kube/prod`. `use-context` in another terminal then cannot point at production.
4. **Give your everyday production user read-only access**, and use a separate admin user for changes.

[kubectx](https://github.com/ahmetb/kubectx), from the same project as kubens, switches contexts with `kubectx minikube`, and `kubectx -` goes back to the previous one.

## How Do I Sign In to the Kubernetes Dashboard?

The Kubernetes Dashboard project is archived. Its repository moved to `kubernetes-retired` in January 2026, and it gets no more releases or security fixes. The project itself recommends **Headlamp**, which is now a Kubernetes SIG UI project. Old guides install the Dashboard from a `v2.7.0` manifest and open it through `kubectl proxy`. Since version 7, the Dashboard installs only with Helm, so those steps do not work for current versions either.

If you still run Dashboard 7, it accepts a bearer token. Open it with a port-forward and paste a token from a ServiceAccount:

```bash
kubectl -n kubernetes-dashboard create token <service-account>   # copy the token
kubectl -n kubernetes-dashboard port-forward svc/kubernetes-dashboard-kong-proxy 8443:443
# keep it running, open https://localhost:8443 and paste the token
```

Plan to replace it. Headlamp works in two ways:

- **The desktop app** runs on your computer and reads the contexts from your kubeconfig. There is no extra sign-in: it can do what your kubeconfig user can do, in the cluster you choose.
- **In the cluster**, install it with Helm and open it with a port-forward:

```bash
helm repo add headlamp https://kubernetes-sigs.github.io/headlamp/
helm install headlamp headlamp/headlamp --namespace kube-system
kubectl -n kube-system port-forward service/headlamp 8080:80   # then open http://localhost:8080
```

The in-cluster Headlamp asks for a token, or uses OIDC if you configure it. Create a ServiceAccount for it, and give it only the access it needs. The built-in `view` ClusterRole allows reading most objects but not Secrets:

```bash
kubectl -n kube-system create serviceaccount headlamp-viewer
kubectl create clusterrolebinding headlamp-viewer \
  --clusterrole=view --serviceaccount=kube-system:headlamp-viewer
kubectl -n kube-system create token headlamp-viewer
```

`kubectl create token` gives a short-lived token, usually valid for one hour. Ask for a different lifetime with `--duration=8h`, up to the limit that the API server allows. Many guides bind the UI's ServiceAccount to `cluster-admin`. Then anyone who gets that token controls the whole cluster. Do not do that, and do not expose a cluster UI to the internet without an identity provider in front of it.

## Related Resources

- [Introduction to Kubernetes: Setting Up a Cluster](/guides/introduction-to-kubernetes/02-setting-up-a-kubernetes-cluster#h2-namespaces): contexts, kubeconfig and namespaces on kind
- [Authentication and RBAC](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes#h2-authentication-and-rbac) in the Kubernetes guide
- [Kubernetes RBAC simulator](/games/k8s-rbac-simulator): see which binding allows or blocks a request
- [Kubernetes networking and CNI simulator](/games/kubernetes-networking-cni-simulator): follow a packet between pods, Services and nodes
- [Service DNS](/guides/introduction-to-kubernetes/05-services-and-networking#h2-service-dns) and [NetworkPolicies that also allow DNS](/posts/kubernetes-concepts-junior-to-mid-level#h3-networkpolicies-that-also-allow-dns)
- [Preview environment simulator](/games/preview-environment-simulator): short-lived environments for each pull request
- [kubectl apply vs create, and how to export live YAML](/posts/kubectl-apply-vs-create-differences)
- [Helm vs Kustomize](/comparisons/helm-vs-kustomize) and the [Helm packaging exercise](/exercises/helm-kubernetes-packaging)
- [Kubernetes security checklist](/checklists/kubernetes-security)
