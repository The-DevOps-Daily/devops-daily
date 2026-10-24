---
title: 'Kubernetes Security Best Practices for Production'
description: 'Harden Kubernetes: RBAC, Pod Security Admission, non-root read-only pods, NetworkPolicies, admission policies, encrypted Secrets and signed images.'
order: 10
---

**TLDR**: Secure Kubernetes in layers. Give people and pipelines only the RBAC permissions they need, with short-lived tokens. Enforce the **restricted** Pod Security Standard on app namespaces, so pods run as non-root, with no extra Linux capabilities and a seccomp profile. Deny network traffic by default with **NetworkPolicies** and allow only what the app needs. Add your own rules with **ValidatingAdmissionPolicies**. Encrypt Secrets at rest, run images you can trace to a signed build, and check the cluster against the CIS benchmark.

In this part you apply each layer to the guide's app and see it work: a pod that Kubernetes refuses to start, a `kubectl run` that the namespace rejects, a connection a NetworkPolicy drops, an image tag an admission policy blocks, a Secret read straight out of etcd, and a kube-bench report. It ends with a checklist for production.

## Prerequisites

- The app after [Part 8](/guides/introduction-to-kubernetes/08-resource-management-and-scaling) (podinfo, the cache StatefulSet and the `podinfo-tls` Secret), the Gateway and HTTPRoute from [Part 5](/guides/introduction-to-kubernetes/05-services-and-networking) with cloud-provider-kind running, and the monitoring stack from [Part 9](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes). This part does not need the HorizontalPodAutoscaler; the run shown here deleted it.
- `cosign` 3.x for the image signature check (optional).

## Security in Layers

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Who", "sub": "authentication, RBAC", "icon": "lock", "tone": "violet" },
    { "label": "Admission", "sub": "Pod Security, policies", "icon": "shield", "tone": "accent" },
    { "label": "Pods", "sub": "non-root, read-only", "icon": "pod", "tone": "blue" },
    { "label": "Network", "sub": "NetworkPolicies", "icon": "net", "tone": "green" },
    { "label": "Data", "sub": "Secrets, etcd", "icon": "database", "tone": "amber" },
    { "label": "Supply chain", "sub": "images, signatures", "icon": "box", "tone": "slate" }
  ]
}
```

No layer is enough on its own. RBAC does not stop a compromised pod from attacking its neighbors, a NetworkPolicy does not stop someone with `create pods` rights from mounting every Secret, and Pod Security does not check where an image came from. Together they make each mistake smaller.

## Authentication and RBAC

Kubernetes has no user database. People authenticate with client certificates or, better, OIDC tokens from your identity provider (managed services connect this to their IAM), and workloads authenticate as **ServiceAccounts**. Check who you are:

```bash
kubectl auth whoami
```

```text
ATTRIBUTE                                           VALUE
Username                                            kubernetes-admin
Groups                                              [kubeadm:cluster-admins system:authenticated]
Extra: authentication.kubernetes.io/credential-id   [X509SHA256=a7a9a6330b9c9c12628585e1bd05e7480667b6ee2fa16dc6f69042e850e5a5be]
```

kind's admin kubeconfig holds a client certificate for the `kubeadm:cluster-admins` group, which can do everything. Never share a certificate like this: it is valid for a year and Kubernetes cannot revoke a single client certificate.

**RBAC** grants permissions with four objects. A **Role** (namespaced) or **ClusterRole** (cluster-wide) lists allowed verbs on resources, and a **RoleBinding** or **ClusterRoleBinding** gives a role to users, groups or ServiceAccounts. Everything not granted is denied. This file creates two ServiceAccounts: one for podinfo with no permissions at all, and one for a deployment pipeline that may update Deployments and read pods in `demo`, and nothing else:

```yaml
# The identity podinfo runs as. It never calls the Kubernetes API, so it gets no token.
apiVersion: v1
kind: ServiceAccount
metadata:
  name: podinfo
automountServiceAccountToken: false
---
# An identity for a deployment pipeline
apiVersion: v1
kind: ServiceAccount
metadata:
  name: deployer
---
# What the pipeline may do in this namespace: update Deployments and read pods
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: deployer
rules:
  - apiGroups: ['apps']
    resources: ['deployments']
    verbs: ['get', 'list', 'watch', 'patch', 'update']
  - apiGroups: ['']
    resources: ['pods']
    verbs: ['get', 'list', 'watch']
---
# Who gets those permissions: the deployer ServiceAccount
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: deployer
subjects:
  - kind: ServiceAccount
    name: deployer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: deployer
```

```terminal
{
  "title": "RBAC",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 10-security/rbac.yaml",
      "output": "serviceaccount/podinfo created\nserviceaccount/deployer created\nrole.rbac.authorization.k8s.io/deployer created\nrolebinding.rbac.authorization.k8s.io/deployer created"
    },
    {
      "cmd": "kubectl auth can-i patch deployments --as=system:serviceaccount:demo:deployer",
      "output": "yes"
    },
    {
      "cmd": "kubectl auth can-i get secrets --as=system:serviceaccount:demo:deployer",
      "output": "no"
    },
    {
      "cmd": "kubectl auth can-i list pods --as=system:serviceaccount:demo:podinfo",
      "output": "no"
    },
    {
      "cmd": "kubectl auth can-i --list --as=system:serviceaccount:demo:deployer",
      "output": "Resources                                       Non-Resource URLs                      Resource Names   Verbs\nselfsubjectreviews.authentication.k8s.io        []                                     []               [create]\nselfsubjectaccessreviews.authorization.k8s.io   []                                     []               [create]\nselfsubjectrulesreviews.authorization.k8s.io    []                                     []               [create]\ndeployments.apps                                []                                     []               [get list watch patch update]\npods                                            []                                     []               [get list watch]"
    }
  ]
}
```

`kubectl auth can-i --as` is how you test a role before you hand it out. Only the `deployments` and `pods` rows come from the Role; the others, and the rest of the list, are permissions every authenticated account has, such as reading the API discovery endpoints. A CI job gets a short-lived token for the deployer account with `kubectl create token`, and a token that expires in 10 minutes is worth much less to an attacker than a key that never does:

```bash
kubectl create token deployer --duration=10m | cut -c1-40
```

```text
eyJhbGciOiJSUzI1NiIsImtpZCI6IkRINzVOQks3
```

Better still, use your CI system's OIDC tokens with the cluster's or cloud's identity integration, so there is no Kubernetes credential stored in CI at all. Rules of thumb: no `cluster-admin` for people or pipelines in daily work, no wildcards (`*`) in production roles, and no `get`/`list` on Secrets unless needed. Also remember what workload permissions imply: anyone who can create pods, or create or patch Deployments, in a namespace can run code as any ServiceAccount there and mount any Secret there. The deployer above answers `no` to `get secrets`, but it could still patch a Deployment's pod template to mount one, so trust it, and protect its token, as if it could read the namespace's Secrets. The [RBAC simulator](/games/k8s-rbac-simulator) lets you practice finding missing permissions.

## Pod Security Admission

**Pod Security Admission** is built into the API server since Kubernetes 1.25, when it replaced PodSecurityPolicy. It checks pods against three **Pod Security Standards**:

| Level        | What it allows                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `privileged` | Everything. For system components that need host access, such as network plugins.                           |
| `baseline`   | Blocks known privilege escalations: privileged containers, host namespaces, `hostPath` volumes, host ports. |
| `restricted` | Also requires non-root, `allowPrivilegeEscalation: false`, all capabilities dropped and a seccomp profile.  |

You choose a level per namespace with labels, for three modes: `enforce` rejects violating pods, `warn` prints a warning to the user, and `audit` writes it to the audit log. Before enforcing, ask the API server what would break with a server-side dry run:

```bash
kubectl label --dry-run=server --overwrite namespace demo pod-security.kubernetes.io/enforce=restricted
```

```text
Warning: existing pods in namespace "demo" violate the new PodSecurity enforce level "restricted:latest"
Warning: cache-0 (and 3 other pods): allowPrivilegeEscalation != false, unrestricted capabilities, runAsNonRoot != true, seccompProfile
namespace/demo labeled (server dry run)
```

None of the guide's pods meet `restricted` yet. Turn on `warn` and `audit` first, which changes nothing for running pods but shows every violation to whoever creates a pod:

```terminal
{
  "title": "warn before you enforce",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl label --overwrite namespace demo pod-security.kubernetes.io/warn=restricted pod-security.kubernetes.io/audit=restricted",
      "output": "namespace/demo labeled"
    },
    {
      "cmd": "kubectl run test --image=busybox:1.38.0 --dry-run=server -- sleep 60",
      "output": "Warning: would violate PodSecurity \"restricted:latest\": allowPrivilegeEscalation != false (container \"test\" must set securityContext.allowPrivilegeEscalation=false), unrestricted capabilities (container \"test\" must set securityContext.capabilities.drop=[\"ALL\"]), runAsNonRoot != true (pod or container \"test\" must set securityContext.runAsNonRoot=true), seccompProfile (pod or container \"test\" must set securityContext.seccompProfile.type to \"RuntimeDefault\" or \"Localhost\")\npod/test created (server dry run)"
    }
  ]
}
```

### Run as Non-Root, Read-Only, Without Capabilities

To meet `restricted`, set a security context on each pod and container. One detail trips up almost everyone. This pod sets `runAsNonRoot: true` and everything else the standard asks for, but not a user ID:

```yaml
# Meets the restricted Pod Security Standard, but kubelet cannot check the user
apiVersion: v1
kind: Pod
metadata:
  name: nonroot-test
spec:
  securityContext:
    runAsNonRoot: true # no runAsUser, and the image names its user instead of a number
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: podinfo
      image: ghcr.io/stefanprodan/podinfo:6.15.0
      securityContext:
        allowPrivilegeEscalation: false
        capabilities:
          drop: ['ALL']
```

```terminal
{
  "title": "runAsNonRoot needs a numeric user",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 10-security/nonroot-test.yaml",
      "output": "pod/nonroot-test created"
    },
    {
      "cmd": "kubectl get pod nonroot-test",
      "output": "NAME           READY   STATUS                       RESTARTS   AGE\nnonroot-test   0/1     CreateContainerConfigError   0          15s"
    },
    {
      "cmd": "kubectl events --for pod/nonroot-test --types=Warning",
      "output": "LAST SEEN          TYPE      REASON   OBJECT             MESSAGE\n2s (x3 over 14s)   Warning   Failed   Pod/nonroot-test   Error: container has runAsNonRoot and image has non-numeric user (app), cannot verify user is non-root (pod: \"nonroot-test_demo(df16900a-abdf-4e63-91b2-9e48102c33f2)\", container: podinfo)"
    },
    {
      "cmd": "kubectl delete pod nonroot-test",
      "output": "pod \"nonroot-test\" deleted from demo namespace"
    }
  ]
}
```

The podinfo image declares its user by name (`USER app`). The kubelet cannot tell whether a name maps to UID 0, so it refuses to start the container. The fix is to set the numeric IDs, which you can read from a running container:

```bash
kubectl exec deploy/podinfo -- id
```

```text
uid=100(app) gid=101(app) groups=101(app)
```

The hardened Deployment runs as UID 100 and GID 101, drops all capabilities, forbids privilege escalation, uses the runtime's default seccomp profile, makes the root filesystem read-only with a small writable `/tmp`, runs as the `podinfo` ServiceAccount without a mounted token, and makes the TLS files readable only by their owner and group:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: podinfo
  labels:
    app: podinfo
spec:
  replicas: 3
  revisionHistoryLimit: 5
  progressDeadlineSeconds: 120
  minReadySeconds: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: podinfo
  template:
    metadata:
      labels:
        app: podinfo
    spec:
      serviceAccountName: podinfo
      automountServiceAccountToken: false # podinfo never calls the Kubernetes API
      securityContext:
        runAsNonRoot: true
        runAsUser: 100 # the image's "app" user
        runAsGroup: 101
        fsGroup: 101 # volume files belong to this group
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: podinfo
          image: ghcr.io/stefanprodan/podinfo:6.15.0
          command: ['./podinfo']
          args:
            - --config-path=/podinfo/config # the ConfigMap file
            - --secure-port=8443 # HTTPS, with the key pair from the Secret
            - --cert-path=/podinfo/tls
            - --cache-server=tcp://cache:6379
          env:
            # Non-secret settings, one key from the ConfigMap each
            - name: PODINFO_UI_MESSAGE
              valueFrom:
                configMapKeyRef:
                  name: podinfo-config
                  key: PODINFO_UI_MESSAGE
            - name: PODINFO_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: podinfo-config
                  key: PODINFO_LEVEL
          ports:
            - name: http
              containerPort: 9898
            - name: https
              containerPort: 8443
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ['ALL']
          volumeMounts:
            - name: config
              mountPath: /podinfo/config
              readOnly: true
            - name: tmp # a writable /tmp on top of the read-only root filesystem
              mountPath: /tmp
            - name: tls # the Secret, as files: tls.crt and tls.key
              mountPath: /podinfo/tls
              readOnly: true
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            periodSeconds: 10
          resources:
            requests:
              cpu: 100m # used for scheduling and as the HPA's 100 percent
              memory: 64Mi
            limits:
              memory: 128Mi # no CPU limit: the container may use idle CPU on the node
      # Prefer to put the replicas on different nodes
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: podinfo
      volumes:
        - name: config
          configMap:
            name: podinfo-config
            items: # only this key becomes a file
              - key: features.yaml
                path: features.yaml
        - name: tls
          secret:
            secretName: podinfo-tls
            defaultMode: 0440 # owner and group may read; other users may not
        - name: tmp
          emptyDir:
            sizeLimit: 64Mi
```

The cache gets the same treatment, as the image's `valkey` user (UID 999), with `fsGroup` so it can still write its volume:

```yaml
# A headless Service gives each StatefulSet pod a stable DNS name: cache-0.cache-headless
apiVersion: v1
kind: Service
metadata:
  name: cache-headless
  labels:
    app: cache
spec:
  clusterIP: None
  selector:
    app: cache
  ports:
    - name: valkey
      port: 6379
      targetPort: valkey
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: cache
  labels:
    app: cache
spec:
  serviceName: cache-headless
  replicas: 1
  selector:
    matchLabels:
      app: cache
  # Keep the volumes when the StatefulSet is deleted or scaled down (the default)
  persistentVolumeClaimRetentionPolicy:
    whenDeleted: Retain
    whenScaled: Retain
  template:
    metadata:
      labels:
        app: cache
    spec:
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 999 # the image's "valkey" user
        runAsGroup: 1000
        fsGroup: 1000 # volumes are made writable for this group
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: valkey
          image: valkey/valkey:9.1.2-alpine
          # --appendonly yes writes every change to a log file in /data
          args: ['/etc/valkey/valkey.conf', '--appendonly', 'yes']
          ports:
            - name: valkey
              containerPort: 6379
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ['ALL']
          volumeMounts:
            - name: data
              mountPath: /data
            - name: config
              mountPath: /etc/valkey
              readOnly: true
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 256Mi
      volumes:
        - name: config
          configMap:
            name: cache-config
  # One PersistentVolumeClaim per pod: data-cache-0, data-cache-1, ...
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 1Gi
```

```terminal
{
  "title": "apply the hardened workloads",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 10-security/deployment.yaml",
      "output": "deployment.apps/podinfo configured"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo",
      "output": "Waiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\ndeployment \"podinfo\" successfully rolled out"
    },
    {
      "cmd": "kubectl apply -f 10-security/statefulset.yaml",
      "output": "service/cache-headless unchanged\nstatefulset.apps/cache configured"
    },
    {
      "cmd": "kubectl rollout status statefulset/cache",
      "output": "Waiting for partitioned roll out to finish: 0 out of 1 new pods have been updated...\nWaiting for 1 pods to be ready...\nWaiting for 1 pods to be ready...\nWaiting for 1 pods to be ready...\npartitioned roll out complete: 1 new pods have been updated..."
    }
  ]
}
```

No warnings this time. Check the result from inside:

```terminal
{
  "title": "what the hardening does",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl exec deploy/podinfo -- id",
      "output": "uid=100(app) gid=101(app) groups=101(app)"
    },
    {
      "cmd": "kubectl exec deploy/podinfo -- touch /home/app/test",
      "output": "touch: /home/app/test: Read-only file system\ncommand terminated with exit code 1"
    },
    {
      "cmd": "kubectl exec deploy/podinfo -- ls /var/run/secrets/kubernetes.io/serviceaccount",
      "output": "ls: /var/run/secrets/kubernetes.io/serviceaccount: No such file or directory\ncommand terminated with exit code 1"
    },
    {
      "cmd": "kubectl exec deploy/podinfo -- ls -lL /podinfo/tls",
      "output": "total 8\n-r--r-----    1 root     app            652 Oct 24 10:18 tls.crt\n-r--r-----    1 root     app            241 Oct 24 10:18 tls.key"
    }
  ]
}
```

An attacker who gets code execution in podinfo now cannot write to the image's files, cannot talk to the Kubernetes API with the pod's identity, and cannot gain root through a setuid binary. The key file is readable by the `app` group only. Now enforce the standard:

```terminal
{
  "title": "enforce restricted",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl label --overwrite namespace demo pod-security.kubernetes.io/enforce=restricted",
      "output": "namespace/demo labeled"
    },
    {
      "cmd": "kubectl run curl --image=curlimages/curl:8.23.0 --rm -i --restart=Never -- curl -s http://podinfo/version",
      "output": "Error from server (Forbidden): pods \"curl\" is forbidden: violates PodSecurity \"restricted:latest\": allowPrivilegeEscalation != false (container \"curl\" must set securityContext.allowPrivilegeEscalation=false), unrestricted capabilities (container \"curl\" must set securityContext.capabilities.drop=[\"ALL\"]), runAsNonRoot != true (pod or container \"curl\" must set securityContext.runAsNonRoot=true), seccompProfile (pod or container \"curl\" must set securityContext.seccompProfile.type to \"RuntimeDefault\" or \"Localhost\")"
    }
  ]
}
```

The label applied without warnings because every pod in `demo` now complies, and the quick `kubectl run` from earlier parts is rejected with a list of exactly what it lacks. Test pods in a restricted namespace need the same security context, like this one:

```yaml
# A test client that meets the restricted Pod Security Standard
apiVersion: v1
kind: Pod
metadata:
  name: client
  labels:
    role: client
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 100
    runAsGroup: 101
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: client
      image: ghcr.io/stefanprodan/podinfo:6.15.0 # has curl and nc
      command: ['sleep', 'infinity']
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: ['ALL']
      resources:
        requests:
          cpu: 10m
          memory: 16Mi
        limits:
          memory: 64Mi
```

Enforce `restricted` on every namespace that runs your apps, `baseline` where you must, and `privileged` only for system namespaces. Pin the version with `pod-security.kubernetes.io/enforce-version` if you want to upgrade Kubernetes before you adopt changes to the standard.

## NetworkPolicies

By default every pod can connect to every other pod in the cluster. A **NetworkPolicy** selects pods and lists which connections they accept (ingress) or may make (egress). Once any policy selects a pod for a direction, everything not allowed in that direction is dropped. The network plugin enforces policies; kind's kindnet does, as do Cilium and Calico, while some basic plugins ignore them silently.

These policies deny all incoming traffic in `demo`, then let podinfo accept HTTP from pods labeled `role=client`, from the `gateway-infra` namespace and from the Prometheus pods of [Part 9](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes), and let the cache accept connections only from podinfo. A `namespaceSelector` and a `podSelector` in the same list entry must both match; in separate entries, either one is enough:

```yaml
# 1. Deny all incoming traffic to every pod in the namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes: ['Ingress']
---
# 2. podinfo accepts HTTP from pods labeled role=client in this namespace,
#    from the gateway-infra namespace and from Prometheus (Part 9)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: podinfo-ingress
spec:
  podSelector:
    matchLabels:
      app: podinfo
  policyTypes: ['Ingress']
  ingress:
    - from:
        - podSelector:
            matchLabels:
              role: client
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: gateway-infra
        # namespace AND pod label in one entry: only the Prometheus pods in monitoring
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
          podSelector:
            matchLabels:
              app.kubernetes.io/name: prometheus
      ports:
        - protocol: TCP
          port: 9898
---
# 3. The cache accepts connections only from podinfo
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: cache-ingress
spec:
  podSelector:
    matchLabels:
      app: cache
  policyTypes: ['Ingress']
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: podinfo
      ports:
        - protocol: TCP
          port: 6379
```

Start the client from above and test before and after:

```terminal
{
  "title": "default deny",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 10-security/client.yaml",
      "output": "pod/client created"
    },
    {
      "cmd": "kubectl wait --for=condition=Ready pod/client",
      "output": "pod/client condition met"
    },
    {
      "cmd": "kubectl exec client -- curl -s -m 3 http://podinfo/version",
      "output": "{\n  \"commit\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"version\": \"6.15.0\"\n}"
    },
    {
      "cmd": "kubectl exec client -- nc -z -v -w 3 cache 6379",
      "output": "Connection to cache (10.96.191.165) 6379 port [tcp/redis] succeeded!"
    },
    {
      "cmd": "kubectl apply -f 10-security/networkpolicy.yaml",
      "output": "networkpolicy.networking.k8s.io/default-deny-ingress created\nnetworkpolicy.networking.k8s.io/podinfo-ingress created\nnetworkpolicy.networking.k8s.io/cache-ingress created"
    },
    {
      "cmd": "kubectl exec client -- curl -s -m 3 http://podinfo/version",
      "output": "{\n  \"commit\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"version\": \"6.15.0\"\n}"
    },
    {
      "cmd": "kubectl exec client -- nc -z -v -w 3 cache 6379",
      "output": "nc: connect to cache (10.96.191.165) port 6379 (tcp) timed out: Operation in progress\ncommand terminated with exit code 1"
    },
    {
      "cmd": "kubectl exec deploy/podinfo -- nc -z -v -w 3 cache 6379",
      "output": "Connection to cache (10.96.191.165) 6379 port [tcp/redis] succeeded!"
    }
  ]
}
```

The client still reaches podinfo, but no longer the cache; podinfo still reaches the cache. Dropped packets look like a timeout, not a refusal, which is the clue when you debug a policy. Since the cache has no password ([Part 6](/guides/introduction-to-kubernetes/06-configmaps-and-secrets) explains why), this policy is what keeps other pods away from it.

Then check the Gateway from Part 5. If `GW_IP` is no longer set in your shell, set it again first:

```bash
GW_IP=$(kubectl get gateway public -n gateway-infra -o jsonpath='{.status.addresses[0].value}')
```

```bash
curl -s -m 5 --resolve podinfo.k8s-guide.example:80:$GW_IP http://podinfo.k8s-guide.example/version; echo "curl exit code: $?"
```

```text
curl exit code: 28
```

Exit code 28 is curl's timeout: the Gateway is blocked too. In-cluster Gateway implementations such as Envoy Gateway or Cilium run their proxies as pods, so the `gateway-infra` namespace rule would admit them. cloud-provider-kind's proxy runs as a Docker container outside the cluster, so its requests come from the kind Docker network. A policy for that network fixes it, on kind only. Check your kind network's IPv4 subnet first and change the `cidr` in the file if it is not `172.18.0.0/16`:

```yaml
# Only for kind with cloud-provider-kind: its Gateway proxy runs as a Docker container
# outside the cluster, so its requests come from the kind Docker network, not from a pod.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: podinfo-from-kind-gateway
spec:
  podSelector:
    matchLabels:
      app: podinfo
  policyTypes: ['Ingress']
  ingress:
    - from:
        - ipBlock:
            cidr: 172.18.0.0/16 # the IPv4 subnet of the "kind" Docker network
      ports:
        - protocol: TCP
          port: 9898
```

```terminal
{
  "title": "let the kind gateway in",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker network inspect kind --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}'",
      "output": "fc00:f853:ccd:e793::/64 172.18.0.0/16"
    },
    {
      "cmd": "kubectl apply -f 10-security/networkpolicy-kind-gateway.yaml",
      "output": "networkpolicy.networking.k8s.io/podinfo-from-kind-gateway created"
    },
    {
      "cmd": "curl -s -m 5 --resolve podinfo.k8s-guide.example:80:$GW_IP http://podinfo.k8s-guide.example/version; echo \"curl exit code: $?\"",
      "output": "{\n  \"commit\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"version\": \"6.15.0\"\n}curl exit code: 0"
    },
    {
      "cmd": "kubectl get networkpolicy",
      "output": "NAME                        POD-SELECTOR   AGE\ncache-ingress               app=cache      19s\ndefault-deny-ingress        <none>         19s\npodinfo-from-kind-gateway   app=podinfo    5s\npodinfo-ingress             app=podinfo    19s"
    }
  ]
}
```

Prometheus still reaches podinfo through the `monitoring` rule. Start the port-forward from Part 9 again, wait for a few scrapes after the policies (the ServiceMonitor scrapes every 15 seconds), and check the targets:

```terminal
{
  "title": "Prometheus still scrapes podinfo",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl port-forward -n monitoring service/monitoring-kube-prometheus-prometheus 9090:9090 > /dev/null 2>&1 & PF=$!"
    },
    {
      "cmd": "sleep 45"
    },
    {
      "cmd": "curl -s --retry 5 --retry-connrefused --retry-delay 1 localhost:9090/api/v1/query --data-urlencode 'query=up{job=\"podinfo\"}' | jq -r '.data.result[] | \"\\(.metric.pod) up=\\(.value[1])\"'",
      "output": "podinfo-7f94dd99-mh9xj up=1\npodinfo-7f94dd99-8zdn2 up=1\npodinfo-7f94dd99-2kxfz up=1"
    },
    {
      "cmd": "kill $PF"
    }
  ]
}
```

Policies add up: a connection is allowed if any policy allows it. Egress works the same way. A default-deny egress policy is a strong control against data exfiltration, but remember to allow DNS (UDP and TCP port 53 to the `kube-system` CoreDNS pods), or every name lookup fails. For rules by DNS name, layer 7 or cluster-wide defaults, Cilium and Calico add their own policy types.

## Admission Policies

Pod Security covers a fixed list of settings. For your own rules, Kubernetes has **ValidatingAdmissionPolicy** (stable since 1.30), written in CEL and run inside the API server, so there is no webhook to operate. This one rejects images without an explicit tag or digest, and the `:latest` tag, in the `demo` namespace. It checks app, init and ephemeral containers, and it also matches the `pods/ephemeralcontainers` subresource that `kubectl debug` uses, so a debug container cannot bring in an unpinned image either:

```yaml
# Reject containers without an explicit image tag or digest, and the :latest tag
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: pinned-images
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ['']
        apiVersions: ['v1']
        operations: ['CREATE', 'UPDATE']
        # kubectl debug adds containers through the ephemeralcontainers subresource
        resources: ['pods', 'pods/ephemeralcontainers']
  variables:
    - name: images
      expression: >-
        object.spec.containers.map(c, c.image) +
        (has(object.spec.initContainers) ? object.spec.initContainers.map(c, c.image) : []) +
        (has(object.spec.ephemeralContainers) ? object.spec.ephemeralContainers.map(c, c.image) : [])
  validations:
    - expression: >-
        variables.images.all(image,
          image.contains('@sha256:') ||
          (image.split('/')[image.split('/').size() - 1].contains(':') &&
           !image.endsWith(':latest')))
      messageExpression: >-
        'every container image needs a version tag or digest, and not :latest: ' +
        variables.images.join(', ')
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: pinned-images
spec:
  policyName: pinned-images
  validationActions: ['Deny']
  matchResources:
    namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: demo
```

The test pod meets the restricted standard, so only the new policy can reject it:

```yaml
# Meets the restricted Pod Security Standard, but uses the :latest tag
apiVersion: v1
kind: Pod
metadata:
  name: latest-test
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 100
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: podinfo
      image: ghcr.io/stefanprodan/podinfo:latest
      securityContext:
        allowPrivilegeEscalation: false
        capabilities:
          drop: ['ALL']
```

```terminal
{
  "title": "a policy in CEL",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 10-security/admission-policy.yaml",
      "output": "validatingadmissionpolicy.admissionregistration.k8s.io/pinned-images created\nvalidatingadmissionpolicybinding.admissionregistration.k8s.io/pinned-images created"
    },
    {
      "cmd": "kubectl apply -f 10-security/latest-tag-pod.yaml",
      "output": "The pods \"latest-test\" is invalid: : ValidatingAdmissionPolicy 'pinned-images' with binding 'pinned-images' denied request: every container image needs a version tag or digest, and not :latest: ghcr.io/stefanprodan/podinfo:latest"
    },
    {
      "cmd": "kubectl apply -f 10-security/client.yaml --dry-run=server",
      "output": "pod/client unchanged (server dry run)"
    },
    {
      "cmd": "kubectl debug client --image=busybox:latest --profile=restricted -- true",
      "output": "Defaulting debug container name to debugger-qr59z.\nThe pods \"client\" is invalid: : ValidatingAdmissionPolicy 'pinned-images' with binding 'pinned-images' denied request: every container image needs a version tag or digest, and not :latest: ghcr.io/stefanprodan/podinfo:6.15.0, busybox:latest"
    }
  ]
}
```

Start new policies with `validationActions: [Warn, Audit]` to see what they would block, then switch to `Deny`. **MutatingAdmissionPolicy** (stable since 1.36) changes objects the same way, for example to add default labels. Policies in a Kubernetes API can be deleted by anyone with the right permissions; since 1.37 the API server can also load them from files on disk (manifest-based admission control, beta), which suits rules that must always apply. Kyverno and OPA Gatekeeper offer larger policy libraries, reports and image signature checks.

## Secrets at Rest

[Part 6](/guides/introduction-to-kubernetes/06-configmaps-and-secrets) showed that Secrets are base64, not encrypted. Here is the TLS key from Part 6 read directly out of etcd on the kind cluster:

```bash
kubectl -n kube-system exec etcd-k8s-guide-control-plane -- etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key get /registry/secrets/demo/podinfo-tls --print-value-only | strings | grep "PRIVATE KEY"
```

```text
-----BEGIN PRIVATE KEY-----
-----END PRIVATE KEY-----
```

The private key is in etcd in plain text, and so is it in every etcd backup. **Encryption at rest** fixes that: the API server encrypts Secrets before it writes them. It reads an `EncryptionConfiguration` file:

```yaml
# Encrypt Secrets before the API server writes them to etcd.
# The first provider encrypts new writes; the others can still decrypt older data.
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - secretbox:
          keys:
            - name: key1
              secret: ENCRYPTION_KEY # 32 random bytes, base64-encoded
      - identity: {} # read Secrets that were stored before encryption was turned on
```

To try it, the companion repository has a second kind config that mounts this file into a one-node cluster's API server. Create a key, create that cluster, store a Secret and look at etcd again:

```terminal
{
  "title": "encryption at rest on a separate cluster",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sed \"s|ENCRYPTION_KEY|$(head -c 32 /dev/urandom | base64)|\" 10-security/encryption/encryption-config.template.yaml > 10-security/encryption/encryption-config.yaml"
    },
    {
      "cmd": "kind create cluster --config 10-security/encryption/kind-config.yaml"
    },
    {
      "cmd": "kubectl create secret generic demo-secret --from-literal=password=not-in-plain-text",
      "output": "secret/demo-secret created"
    },
    {
      "cmd": "kubectl -n kube-system exec etcd-k8s-guide-enc-control-plane -- etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key get /registry/secrets/default/demo-secret --print-value-only | head -c 26; echo",
      "output": "k8s:enc:secretbox:v1:key1:"
    },
    {
      "cmd": "kubectl -n kube-system exec etcd-k8s-guide-enc-control-plane -- etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key get /registry/secrets/default/demo-secret --print-value-only | grep -c not-in-plain-text",
      "output": "0"
    },
    {
      "cmd": "kubectl get secret demo-secret -o jsonpath='{.data.password}' | base64 -d; echo",
      "output": "not-in-plain-text"
    },
    {
      "cmd": "kind delete cluster --name k8s-guide-enc",
      "output": "Deleting cluster \"k8s-guide-enc\" ...\nDeleted nodes: [\"k8s-guide-enc-control-plane\"]"
    },
    {
      "cmd": "kubectl config use-context kind-k8s-guide",
      "output": "Switched to context \"kind-k8s-guide\"."
    }
  ]
}
```

Creating the second cluster switched kubectl to it, and deleting it left no current context, so the last command switches back to the guide's cluster. etcd held `k8s:enc:secretbox:v1:key1:` followed by ciphertext, the password does not appear in it (`grep -c` counts 0 matches), and the API server still returns it to clients that may read it. Existing Secrets are encrypted only when they are written again (`kubectl get secrets -A -o json | kubectl replace -f -`). The key itself sits in a file on the control plane here; in production use a **KMS v2** provider, so the key lives in a key management service. Managed services encrypt etcd for you, and most offer envelope encryption with your own KMS key.

## Supply Chain: Know What You Run

- **Pin images.** A tag can be moved to a different image; a digest cannot. The kubelet records the digest it actually pulled:

```bash
kubectl get pods -l app=podinfo -o jsonpath='{.items[0].status.containerStatuses[0].imageID}{"\n"}'
```

```text
ghcr.io/stefanprodan/podinfo@sha256:ec73780a8425f59ea49f5bc8cdff0d598805a224fbaa1f86c67a244f250fa9da
```

Deploy by digest (`image: ghcr.io/stefanprodan/podinfo:6.15.0@sha256:...`) in production, and let a tool such as Renovate or Dependabot propose updates.

- **Verify signatures.** podinfo's release workflow signs each image with Sigstore cosign, using the workflow's GitHub OIDC identity instead of a key. You can check that an image was built by that exact workflow:

```bash
cosign verify ghcr.io/stefanprodan/podinfo:6.15.0 --certificate-identity=https://github.com/stefanprodan/podinfo/.github/workflows/release.yml@refs/tags/6.15.0 --certificate-oidc-issuer=https://token.actions.githubusercontent.com > /dev/null
```

```text
Verification for ghcr.io/stefanprodan/podinfo:6.15.0 --
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - Existence of the claims in the transparency log was verified offline
  - The code-signing certificate was verified using trusted certificate authority certificates
```

To enforce this in the cluster, use Kyverno's image verification, Sigstore's policy-controller or your cloud's binary authorization feature.

- **Scan images and manifests** in CI with Trivy, Grype or Kubescape, and fail builds on fixable critical vulnerabilities. The [Security Gates guide](/guides/security-gates) shows how to wire scanners into a pipeline without drowning in findings.
- **Use small images** from sources you trust, run your own registry mirror for production, and keep the `imagePullPolicy` default (`IfNotPresent`) together with digests.

## Check the Cluster: kube-bench

[kube-bench](https://github.com/aquasecurity/kube-bench) checks a node against the CIS Kubernetes Benchmark. It needs host access, so it cannot run in the restricted `demo` namespace; run it in `default`:

```terminal
{
  "title": "CIS benchmark",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -n default -f https://raw.githubusercontent.com/aquasecurity/kube-bench/v0.16.0/job.yaml",
      "output": "job.batch/kube-bench created"
    },
    {
      "cmd": "kubectl wait -n default --for=condition=Complete job/kube-bench --timeout=300s",
      "output": "job.batch/kube-bench condition met"
    },
    {
      "cmd": "kubectl logs -n default job/kube-bench | grep -A 4 '== Summary total =='",
      "output": "== Summary total ==\n17 checks PASS\n2 checks FAIL\n40 checks WARN\n0 checks INFO"
    },
    {
      "cmd": "kubectl logs -n default job/kube-bench | grep -E '^\\[FAIL\\]' | head -n 8",
      "output": "[FAIL] 4.1.1 Ensure that the kubelet service file permissions are set to 600 or more restrictive (Automated)\n[FAIL] 4.1.9 If the kubelet config.yaml configuration file is being used validate permissions set to 600 or more restrictive (Automated)"
    }
  ]
}
```

The Job ran on a worker node, so these are the worker checks. kind is a development tool and is not hardened, so findings are expected; the point is to run the same check against your real clusters, read each `FAIL` and `WARN`, and fix or consciously accept it. Managed services publish their own adapted benchmarks (EKS, GKE, AKS), because you cannot check their control planes yourself.

## Audit Logging

The API server can log every request: who did what, to which object, and when. Managed services offer audit logs as a setting; on kubeadm clusters you pass `--audit-policy-file` and `--audit-log-path` to the API server. A policy that logs Secret access without the Secret's contents, and everything else at metadata level, is a reasonable start (an example, not run on kind here):

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: ['RequestReceived']
rules:
  - level: Metadata # never log Secret or ConfigMap contents
    resources:
      - group: ''
        resources: ['secrets', 'configmaps']
  - level: None # skip noisy read-only health checks
    nonResourceURLs: ['/healthz*', '/readyz*', '/livez*']
  - level: Metadata # everything else: who, what, when
```

Ship the audit log off the control plane and alert on things such as new ClusterRoleBindings, `exec` into production pods and reads of many Secrets at once.

## Keep the Cluster Current

- **Upgrade on schedule.** Each minor version gets about 14 months of patches. Plan an upgrade at least once or twice a year, one minor version at a time, and read the "Deprecations and removals" section of each release announcement first. Managed services upgrade clusters that fall out of support, or charge extra for extended support.
- **Patch the nodes.** On managed services, turn on automatic node upgrades or replace node pools regularly; containers share the node's kernel.
- **Keep the API server off the internet** where you can: restrict it to your networks or a VPN, and use private clusters for production.
- **Back up** etcd (self-managed) and your workloads with Velero, keep manifests in Git, and test a restore into a fresh cluster.

## Production Checklist

| Area          | Check                                                                                                          | Part |
| ------------- | -------------------------------------------------------------------------------------------------------------- | ---- |
| Workloads     | Deployments or StatefulSets, never bare pods; at least two replicas with a PodDisruptionBudget                 | 4, 8 |
| Health        | Readiness and liveness probes on every container; startup probes for slow starts                               | 3    |
| Resources     | Requests on every container, memory limits, quotas and LimitRanges per namespace                               | 8    |
| Scaling       | HPA on real load metrics; cluster autoscaling on the node pools                                                | 8    |
| Traffic       | One Gateway with routes for the public paths only; no ingress-nginx; TLS everywhere                            | 5    |
| Configuration | Config in ConfigMaps, generated names or checksums for rollouts; Secrets as files, never in Git                | 6    |
| Data          | Network storage with snapshots, `Retain` for important volumes, tested backups                                 | 7    |
| Observability | Central logs, Prometheus metrics, alerts on user-facing symptoms                                               | 9    |
| Access        | Least-privilege RBAC, short-lived tokens or OIDC, no shared admin certificates                                 | 10   |
| Pods          | `restricted` Pod Security enforced; non-root, read-only root filesystem, no ServiceAccount token unless needed | 10   |
| Network       | Default-deny NetworkPolicies, explicit allows, DNS allowed for egress                                          | 10   |
| Supply chain  | Images pinned by digest, scanned and signed; admission rules for registries and tags                           | 10   |
| Cluster       | Secrets encrypted at rest, audit logs on, CIS benchmark reviewed, supported Kubernetes version                 | 10   |
| Delivery      | Everything in Git, applied by CI or a GitOps tool such as Argo CD or Flux                                      | 4, 6 |

The [Kubernetes security checklist](/checklists/kubernetes-security) goes into more detail on the security rows.

## Common Mistakes

- **`cluster-admin` for CI.** A leaked pipeline token then owns the cluster. Give pipelines a namespaced role and short-lived tokens.
- **Enforcing Pod Security without a dry run.** Running pods keep running, but their replacements fail to start at the next rollout or node drain. Use `--dry-run=server` and `warn` first.
- **`runAsNonRoot` without `runAsUser` on images with named users.** The kubelet refuses to start them (`CreateContainerConfigError`).
- **A default-deny egress policy without a DNS rule.** Every lookup times out, and the app looks broken for unrelated reasons.
- **Policies the network plugin does not enforce.** Test a deny like this part does; do not assume.
- **Treating Secrets as encrypted.** Without encryption at rest, they sit in plain text in etcd and in every backup.

## Summary

- RBAC with least privilege and short-lived tokens controls who can do what.
- Pod Security Admission enforces the restricted standard per namespace; run as a numeric non-root user with a read-only root filesystem and no capabilities.
- NetworkPolicies turn the flat pod network into explicit allows; check what your Gateway's traffic looks like to them.
- ValidatingAdmissionPolicies add your own rules in CEL without webhooks.
- Encrypt Secrets at rest, deploy images by digest, verify signatures, and check clusters with kube-bench.

## Where to Go Next

You have run an app on Kubernetes from a single pod to a hardened, monitored, autoscaled service. Good next steps:

- Put the manifests under Git and let [Argo CD or Flux](/comparisons/argocd-vs-flux) apply them, and package them with [Helm or Kustomize](/comparisons/helm-vs-kustomize). The [GitOps deployment exercise](/exercises/gitops-argocd-deployment) and [Helm packaging exercise](/exercises/helm-kubernetes-packaging) are hands-on starting points.
- Create a managed cluster ([Part 2](/guides/introduction-to-kubernetes/02-setting-up-a-kubernetes-cluster#h2-managed-kubernetes)) and run this guide's manifests on it, with a cloud load balancer and cloud disks.
- Practice with the [Kubernetes RBAC simulator](/games/k8s-rbac-simulator), the [Pod Security Standards flashcards](/flashcards/pod-security-standards-kubernetes) and the [Kubernetes quiz](/quizzes/kubernetes-quiz).
- Read [when Kubernetes is the wrong default](/posts/when-kubernetes-is-wrong-default) before you move your next small app onto it.

Back to the [guide overview](/guides/introduction-to-kubernetes).
