---
title: 'Kubernetes ConfigMaps and Secrets: Configure Apps Without Rebuilds'
description: 'Configure apps with Kubernetes ConfigMaps, mount TLS keys from Secrets, see why Secrets do not belong in env vars, and roll out config changes safely.'
order: 6
---

**TLDR**: A **ConfigMap** holds settings and a **Secret** holds credentials, keys and certificates. Pods use them as environment variables or as files in a volume. Mounted files update in running pods within about a minute; environment variables only change when the pod restarts. Secrets are only base64-encoded, not encrypted, so keep them out of Git, give them to apps as files rather than environment variables, and limit who can read them.

In this part you configure podinfo and its Valkey cache with ConfigMaps, give podinfo a TLS certificate from a Secret, watch an environment variable leak a token, change the configuration of running pods, rotate the certificate, and let Kustomize roll out config changes for you.

## Prerequisites

- The podinfo Deployment from [Part 4](/guides/introduction-to-kubernetes/04-deployments-and-replicasets) and its Service from [Part 5](/guides/introduction-to-kubernetes/05-services-and-networking). On a new cluster: `kubectl apply -f 04-deployments/deployment.yaml -f 05-networking/service.yaml`.
- `openssl` and `jq` on your computer.

## ConfigMaps

Keeping configuration out of the image means one image runs in every environment, and a settings change does not need a new build. A ConfigMap is a set of keys; each value is either a short string or a whole file:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: podinfo-config
data:
  # Single values, used as environment variables
  PODINFO_UI_MESSAGE: Hello from a ConfigMap
  PODINFO_LEVEL: info
  # A whole file, mounted into the container
  features.yaml: |
    newCheckout: false
    banner: Autumn sale
```

```terminal
{
  "title": "create the ConfigMap",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 06-config/configmap.yaml",
      "output": "configmap/podinfo-config created"
    },
    {
      "cmd": "kubectl describe configmap podinfo-config",
      "output": "Name:         podinfo-config\nNamespace:    demo\nLabels:       <none>\nAnnotations:  <none>\n\nData\n====\nPODINFO_LEVEL:\n----\ninfo\n\nPODINFO_UI_MESSAGE:\n----\nHello from a ConfigMap\n\nfeatures.yaml:\n----\nnewCheckout: false\nbanner: Autumn sale\n\n\n\nBinaryData\n====\n\nEvents:  <none>"
    }
  ]
}
```

A pod can consume a ConfigMap in three ways:

| How                                | Field in the pod spec             | Changes reach a running pod? |
| ---------------------------------- | --------------------------------- | ---------------------------- |
| One key as an environment variable | `env[].valueFrom.configMapKeyRef` | No, only after a restart     |
| All keys as environment variables  | `envFrom[].configMapRef`          | No, only after a restart     |
| Keys as files in a volume          | `volumes[].configMap`             | Yes, after about a minute    |

`envFrom` turns every key into a variable, including keys you did not mean to expose, such as `features.yaml` here. Pick keys explicitly with `env` when a ConfigMap mixes values and files. A ConfigMap can hold up to 1 MiB of data; it is not a place for large files.

Most programs also read their own configuration files, and a ConfigMap is a good way to ship them. The Valkey cache, which podinfo uses from now on, gets its `valkey.conf` from one:

```yaml
# Valkey's own configuration file, from a ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: cache-config
data:
  valkey.conf: |
    maxmemory 64mb
    maxmemory-policy allkeys-lru
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cache
  labels:
    app: cache
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cache
  template:
    metadata:
      labels:
        app: cache
    spec:
      containers:
        - name: valkey
          image: valkey/valkey:9.1.2-alpine
          args: ['/etc/valkey/valkey.conf'] # start valkey-server with this file
          ports:
            - name: valkey
              containerPort: 6379
          volumeMounts:
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
---
apiVersion: v1
kind: Service
metadata:
  name: cache
  labels:
    app: cache
spec:
  selector:
    app: cache
  ports:
    - name: valkey
      port: 6379
      targetPort: valkey
```

## Secrets

A Secret looks like a ConfigMap, but Kubernetes treats it with more care: kubelets keep mounted Secrets in memory (tmpfs) rather than on disk, RBAC rules often allow ConfigMaps but not Secrets, and `kubectl describe` does not print their values. Secrets have types; `Opaque` is the general one, and `kubernetes.io/tls`, `kubernetes.io/dockerconfigjson` (registry credentials) and `kubernetes.io/basic-auth` check that the right keys are present.

podinfo can serve HTTPS when it finds `tls.crt` and `tls.key` in a directory. Create a self-signed certificate for this guide and store it as a TLS Secret (in production, cert-manager issues and renews real certificates into Secrets like this one):

```terminal
{
  "title": "a TLS Secret",
  "prompt": "$",
  "steps": [
    {
      "cmd": "openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 30 -keyout tls.key -out tls.crt -subj \"/CN=podinfo.demo.svc\" -addext \"subjectAltName=DNS:podinfo.demo.svc,DNS:localhost\"",
      "output": "-----"
    },
    {
      "cmd": "kubectl create secret tls podinfo-tls --cert=tls.crt --key=tls.key",
      "output": "secret/podinfo-tls created"
    },
    {
      "cmd": "kubectl get secret podinfo-tls",
      "output": "NAME          TYPE                DATA   AGE\npodinfo-tls   kubernetes.io/tls   2      0s"
    },
    {
      "cmd": "kubectl describe secret podinfo-tls",
      "output": "Name:         podinfo-tls\nNamespace:    demo\nLabels:       <none>\nAnnotations:  <none>\n\nType:  kubernetes.io/tls\n\nData\n====\ntls.crt:  652 bytes\ntls.key:  241 bytes"
    }
  ]
}
```

The companion repository's `.gitignore` excludes `tls.key` and `tls.crt`. Never commit a private key, and never commit a Secret manifest with real values in it: anyone who can read the repository can read the Secret.

### Base64 Is Not Encryption

The values in a Secret are base64-encoded so that binary data fits into JSON and YAML. Anyone who can read the Secret object can decode them. The first 40 characters of the encoded key already give away what it is:

```terminal
{
  "title": "read a Secret",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl get secret podinfo-tls -o jsonpath='{.data.tls\\.key}' | cut -c1-40",
      "output": "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1J"
    },
    {
      "cmd": "kubectl get secret podinfo-tls -o jsonpath='{.data.tls\\.crt}' | base64 -d | openssl x509 -noout -subject -enddate",
      "output": "subject=CN = podinfo.demo.svc\nnotAfter=Nov 23 10:16:08 2026 GMT"
    }
  ]
}
```

`LS0tLS1CRUdJTiBQUklWQVRF` is base64 for `-----BEGIN PRIVATE`. Inside the cluster, Secrets are also stored in etcd unencrypted unless someone turned on encryption at rest; [Part 10](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes) reads one straight out of etcd. Protect Secrets with RBAC, encryption at rest and an external secret store, below. See also [how to decode a Kubernetes Secret](/posts/how-to-decode-a-kubernetes-secret).

### Do Not Put Secrets in Environment Variables

Kubernetes can put a Secret value into an environment variable with `secretKeyRef`, and many tutorials do. It is convenient and it works, but environment variables leak: crash reports and error pages include them, child processes inherit them, `kubectl exec ... env` prints them, and many apps have a debug endpoint that dumps them. podinfo has one, `/env`. Here is the leak with a throwaway token:

```yaml
# The pattern to avoid: a Secret in an environment variable of an app that prints its environment
apiVersion: v1
kind: Pod
metadata:
  name: env-leak
spec:
  containers:
    - name: podinfo
      image: ghcr.io/stefanprodan/podinfo:6.15.0
      env:
        - name: API_TOKEN
          valueFrom:
            secretKeyRef:
              name: api-token
              key: token
```

```terminal
{
  "title": "an env var leaking a Secret",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl create secret generic api-token --from-literal=token=\"$(openssl rand -hex 16)\"",
      "output": "secret/api-token created"
    },
    {
      "cmd": "kubectl apply -f 06-config/env-leak-pod.yaml",
      "output": "pod/env-leak created"
    },
    {
      "cmd": "kubectl wait --for=condition=Ready pod/env-leak",
      "output": "pod/env-leak condition met"
    },
    {
      "cmd": "kubectl exec env-leak -- curl -s localhost:9898/env | jq -r '.[] | select(startswith(\"API_TOKEN\"))'",
      "output": "API_TOKEN=8cdaf938b776e103f2a775aee962e7f1"
    },
    {
      "cmd": "kubectl get secret api-token -o jsonpath='{.data.token}' | base64 -d; echo",
      "output": "8cdaf938b776e103f2a775aee962e7f1"
    },
    {
      "cmd": "kubectl delete pod env-leak && kubectl delete secret api-token",
      "output": "pod \"env-leak\" deleted from demo namespace\nsecret \"api-token\" deleted from demo namespace"
    }
  ]
}
```

Anyone who can send an HTTP request to that pod now has the token. Mount Secrets as files instead, with the volume `readOnly`, and have the app read the file. Files do not show up in the environment, you can restrict them with file permissions ([Part 10](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes) does), and they update in place when the Secret changes.

:::warning
Files are not a cure-all. Some apps, podinfo among them, also have endpoints that print their config files, or log connection strings that contain passwords. Read what your app exposes and logs, keep debug endpoints off the network (Part 5 routes only `/` and `/version`), and prefer credentials that are not part of a URL. That is also why this guide's cache runs without a password and relies on a NetworkPolicy in Part 10: podinfo can only take a cache password inside its connection URL, and it logs that URL whenever the cache is unreachable.
:::

## Use Them in the Deployment

The new podinfo Deployment reads two values from the ConfigMap as environment variables, mounts `features.yaml` from the ConfigMap as a file, mounts the TLS Secret as files, serves HTTPS on port 8443 with them, and uses the cache:

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
          volumeMounts:
            - name: config
              mountPath: /podinfo/config
              readOnly: true
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
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 128Mi
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
```

```terminal
{
  "title": "deploy the cache and the configured app",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 06-config/cache.yaml",
      "output": "configmap/cache-config created\ndeployment.apps/cache created\nservice/cache created"
    },
    {
      "cmd": "kubectl apply -f 06-config/deployment.yaml",
      "output": "deployment.apps/podinfo configured"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo",
      "output": "Waiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\ndeployment \"podinfo\" successfully rolled out"
    }
  ]
}
```

Check what the pods got. Port-forward the Service for HTTP and one pod for HTTPS, keeping their process IDs so you can stop exactly these two later:

```terminal
{
  "title": "check the configuration",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl port-forward service/podinfo 8080:80 > /dev/null 2>&1 & PF=$!"
    },
    {
      "cmd": "kubectl port-forward deployment/podinfo 8443:8443 > /dev/null 2>&1 & PF_TLS=$!"
    },
    {
      "cmd": "curl -s --retry 5 --retry-connrefused --retry-delay 1 localhost:8080 | jq -r .message",
      "output": "Hello from a ConfigMap"
    },
    {
      "cmd": "curl -s localhost:8080/configs",
      "output": "{\n  \"features.yaml\": \"newCheckout: false\\nbanner: Autumn sale\\n\"\n}"
    },
    {
      "cmd": "kubectl exec deploy/podinfo -- printenv PODINFO_UI_MESSAGE PODINFO_LEVEL",
      "output": "Hello from a ConfigMap\ninfo"
    },
    {
      "cmd": "kubectl exec deploy/podinfo -- ls -l /podinfo/config /podinfo/tls",
      "output": "/podinfo/config:\ntotal 0\nlrwxrwxrwx    1 root     root            20 Oct 24 10:16 features.yaml -> ..data/features.yaml\n\n/podinfo/tls:\ntotal 0\nlrwxrwxrwx    1 root     root            14 Oct 24 10:16 tls.crt -> ..data/tls.crt\nlrwxrwxrwx    1 root     root            14 Oct 24 10:16 tls.key -> ..data/tls.key"
    },
    {
      "cmd": "curl -s --retry 5 --retry-connrefused --retry-delay 1 --cacert tls.crt https://localhost:8443/version",
      "output": "{\n  \"commit\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"version\": \"6.15.0\"\n}"
    }
  ]
}
```

The mounted files are symlinks into a hidden `..data` directory. Kubernetes updates a ConfigMap or Secret volume by writing the new files into a new directory and switching the `..data` link in one step, so an app never reads half of an update. `curl --cacert tls.crt` succeeds because the certificate covers `localhost` and curl trusts the self-signed certificate you gave it.

The cache works, and Valkey runs with the settings from its ConfigMap:

```terminal
{
  "title": "the cache",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -s -X POST -d \"hello from the cache\" localhost:8080/cache/greeting"
    },
    {
      "cmd": "curl -s localhost:8080/cache/greeting",
      "output": "hello from the cache"
    },
    {
      "cmd": "kubectl exec deploy/cache -- valkey-cli CONFIG GET maxmemory-policy",
      "output": "maxmemory-policy\nallkeys-lru"
    }
  ]
}
```

## Change the Configuration of Running Pods

Edit `06-config/configmap.yaml`: change the message to `Hello again`, set `newCheckout: true` and change the banner to `Winter sale`. `kubectl diff` shows the change before you apply it:

```terminal
{
  "title": "update the ConfigMap",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl diff -f 06-config/configmap.yaml",
      "output": "diff -u -N /tmp/LIVE-1515369127/v1.ConfigMap.demo.podinfo-config /tmp/MERGED-2752741310/v1.ConfigMap.demo.podinfo-config\n--- /tmp/LIVE-1515369127/v1.ConfigMap.demo.podinfo-config\t2026-10-24 10:16:32.575184705 +0000\n+++ /tmp/MERGED-2752741310/v1.ConfigMap.demo.podinfo-config\t2026-10-24 10:16:32.575184705 +0000\n@@ -1,10 +1,10 @@\n apiVersion: v1\n data:\n   PODINFO_LEVEL: info\n-  PODINFO_UI_MESSAGE: Hello from a ConfigMap\n+  PODINFO_UI_MESSAGE: Hello again\n   features.yaml: |\n-    newCheckout: false\n-    banner: Autumn sale\n+    newCheckout: true\n+    banner: Winter sale\n kind: ConfigMap\n metadata:\n   annotations:"
    },
    {
      "cmd": "kubectl apply -f 06-config/configmap.yaml",
      "output": "configmap/podinfo-config configured"
    }
  ]
}
```

The mounted file changes in the running pods on its own. The kubelet checks for updates periodically, so it takes up to about a minute; this loop measures it:

```terminal
{
  "title": "how long until the file changes?",
  "prompt": "$",
  "steps": [
    {
      "cmd": "time (until curl -s localhost:8080/configs | grep -q 'Winter sale'; do sleep 5; done)",
      "output": "real\t0m55.110s\nuser\t0m0.029s\nsys\t0m0.071s"
    },
    {
      "cmd": "curl -s localhost:8080/configs",
      "output": "{\n  \"features.yaml\": \"newCheckout: true\\nbanner: Winter sale\\n\"\n}"
    },
    {
      "cmd": "curl -s localhost:8080 | jq -r .message",
      "output": "Hello from a ConfigMap"
    }
  ]
}
```

The file changed after about a minute (55 seconds in this run), but the message did not: it comes from an environment variable, which is set once when the container starts. Restart the pods to pick it up. A port-forward stays attached to the pod it started with, so stop both and start the HTTP one again (the `2>/dev/null` hides the error if one has already exited with its pod):

```terminal
{
  "title": "restart to load new environment variables",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl rollout restart deployment/podinfo",
      "output": "deployment.apps/podinfo restarted"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo",
      "output": "Waiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\ndeployment \"podinfo\" successfully rolled out"
    },
    {
      "cmd": "kill $PF $PF_TLS 2>/dev/null; kubectl port-forward service/podinfo 8080:80 > /dev/null 2>&1 & PF=$!"
    },
    {
      "cmd": "curl -s --retry 5 --retry-connrefused --retry-delay 1 localhost:8080 | jq -r .message",
      "output": "Hello again"
    }
  ]
}
```

Two more things to know about updates:

- A file mounted with `subPath` never updates. Mount the whole volume, as here, if the app should see changes.
- A file changing does not mean the app uses it. podinfo re-reads its config directory, but many apps read a file once at startup. Restart them, or let Kustomize do it (below).

### Rotate the Certificate

Create a new key pair and replace the Secret's contents. `kubectl create ... --dry-run=client -o yaml | kubectl apply -f -` is the usual way to update a Secret from files or literals ([more ways to update a Secret](/posts/how-to-update-kubernetes-secret-from-file)):

```terminal
{
  "title": "rotate the TLS Secret",
  "prompt": "$",
  "steps": [
    {
      "cmd": "openssl x509 -in tls.crt -noout -serial",
      "output": "serial=7DAB4A1B9EDF16B08882DC500D98355B5743EA39"
    },
    {
      "cmd": "openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 30 -keyout tls.key -out tls.crt -subj \"/CN=podinfo.demo.svc\" -addext \"subjectAltName=DNS:podinfo.demo.svc,DNS:localhost\"",
      "output": "-----"
    },
    {
      "cmd": "kubectl create secret tls podinfo-tls --cert=tls.crt --key=tls.key --dry-run=client -o yaml | kubectl apply -f -",
      "output": "Warning: resource secrets/podinfo-tls is missing the kubectl.kubernetes.io/last-applied-configuration annotation which is required by kubectl apply. kubectl apply should only be used on resources created declaratively by either kubectl create --save-config or kubectl apply. The missing annotation will be patched automatically.\nsecret/podinfo-tls configured"
    },
    {
      "cmd": "openssl x509 -in tls.crt -noout -serial",
      "output": "serial=4FE99FB602D3DC4C7E4F68E30F09F11C6C331591"
    }
  ]
}
```

The warning appears because the Secret was created with `kubectl create`, not `kubectl apply`; kubectl adds the missing annotation and carries on. podinfo loads its certificate once at startup, like most servers, so restart it and check which certificate it now serves:

```terminal
{
  "title": "load the new certificate",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl rollout restart deployment/podinfo",
      "output": "deployment.apps/podinfo restarted"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo"
    },
    {
      "cmd": "kubectl port-forward deployment/podinfo 8443:8443 > /dev/null 2>&1 & PF_TLS=$!"
    },
    {
      "cmd": "curl -s --retry 5 --retry-connrefused --retry-delay 1 --cacert tls.crt https://localhost:8443/version",
      "output": "{\n  \"commit\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"version\": \"6.15.0\"\n}"
    },
    {
      "cmd": "openssl s_client -connect localhost:8443 < /dev/null 2>/dev/null | openssl x509 -noout -serial",
      "output": "serial=4FE99FB602D3DC4C7E4F68E30F09F11C6C331591"
    }
  ]
}
```

Wait for the rollout before you start the port-forward, so it connects to a new pod. curl now trusts the server only because it presents the new certificate (`--cacert tls.crt` is the new file), and the served serial number matches it.

## Immutable ConfigMaps and Secrets

Set `immutable: true` on a ConfigMap or Secret whose data should never change in place. The API server then rejects updates to its data, and kubelets stop watching it, which takes load off the API server in large clusters:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: release-info
immutable: true # the data can no longer change; delete and recreate instead
data:
  version: '2026.10'
```

```terminal
{
  "title": "immutable",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 06-config/release-info.yaml",
      "output": "configmap/release-info created"
    },
    {
      "cmd": "kubectl patch configmap release-info -p '{\"data\":{\"version\":\"2026.11\"}}'",
      "output": "The ConfigMap \"release-info\" is invalid: data: Forbidden: field is immutable when `immutable` is set"
    }
  ]
}
```

To change it, create a new ConfigMap with a new name and point the Deployment at it. That pattern, a new name for every change, is exactly what Kustomize automates.

## Roll Out Config Changes with Kustomize

Kustomize is built into kubectl (`kubectl apply -k`, `kubectl kustomize`). Its `configMapGenerator` creates a ConfigMap whose name ends with a hash of its contents and rewrites every reference to it. Change the contents and the name changes, so the Deployment's pod template changes too, and Kubernetes rolls out new pods by itself:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
configMapGenerator:
  # Creates podinfo-config-<hash>; the hash changes whenever the data changes
  - name: podinfo-config
    literals:
      - PODINFO_UI_MESSAGE=Hello from Kustomize
      - PODINFO_LEVEL=info
    files:
      - features.yaml
```

```terminal
{
  "title": "generated names",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl kustomize 06-config/kustomize | head -n 12",
      "output": "apiVersion: v1\ndata:\n  PODINFO_LEVEL: info\n  PODINFO_UI_MESSAGE: Hello from Kustomize\n  features.yaml: |\n    newCheckout: false\n    banner: Autumn sale\nkind: ConfigMap\nmetadata:\n  name: podinfo-config-9fhdch956h\n---\napiVersion: apps/v1"
    },
    {
      "cmd": "kubectl kustomize 06-config/kustomize | grep \"name: podinfo-config\"",
      "output": "  name: podinfo-config-9fhdch956h\n              name: podinfo-config-9fhdch956h\n              name: podinfo-config-9fhdch956h\n          name: podinfo-config-9fhdch956h"
    }
  ]
}
```

The ConfigMap and all three references in the Deployment use the same generated name. Now change the message in `kustomization.yaml` to `Hello again from Kustomize` and render it again:

```bash
kubectl kustomize 06-config/kustomize | grep "name: podinfo-config"
```

```text
  name: podinfo-config-mk64bbhbkk
              name: podinfo-config-mk64bbhbkk
              name: podinfo-config-mk64bbhbkk
          name: podinfo-config-mk64bbhbkk
```

A new hash, so `kubectl apply -k 06-config/kustomize` would roll out the change, and the old ConfigMap would remain for a rollback. Helm charts get the same effect with a checksum annotation on the pod template. The [Helm vs Kustomize comparison](/comparisons/helm-vs-kustomize) covers when to use which. Stop the port-forwards before you go on:

```bash
kill $PF $PF_TLS
```

## Secrets in Production

Kubernetes Secrets are a delivery mechanism, not a vault. In production:

- **Turn on encryption at rest** for Secrets in etcd, ideally with a KMS provider. Managed services encrypt etcd for you; check whether they also offer envelope encryption with your own key. [Part 10](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes) shows why.
- **Limit access with RBAC.** `get` or `list` on Secrets in a namespace means reading all of them, and so does permission to create pods there, because a pod can mount any Secret in its namespace.
- **Keep the source of truth outside the cluster.** The [External Secrets Operator](https://external-secrets.io/) (API `external-secrets.io/v1`) copies values from Vault, AWS Secrets Manager, Google Secret Manager, Azure Key Vault and others into Kubernetes Secrets and refreshes them. The Secrets Store CSI Driver mounts them as files without creating Secret objects at all.

```yaml
# External Secrets Operator: copies a value from an external store into a Kubernetes Secret
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: api-token
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: vault # a ClusterSecretStore that points at your secret store
  target:
    name: api-token # the Secret it creates and keeps up to date
  data:
    - secretKey: token
      remoteRef:
        key: demo/api
        property: token
```

- **For GitOps**, commit encrypted Secrets with Sealed Secrets or SOPS, or commit only ExternalSecret objects like the one above.
- **Rotate** credentials on a schedule, and restart or reload the apps that read them at startup.

## Common Mistakes

- **Secrets in Git.** Base64 is not encryption; a committed Secret is a leaked Secret. Rotate it, do not just delete the commit.
- **Secrets in environment variables of apps that print their environment.** Mount them as files.
- **Expecting environment variables to update.** They are fixed at container start; restart, or use files.
- **`subPath` mounts.** They never receive updates.
- **Editing a ConfigMap and forgetting the Deployment.** Use generated names (Kustomize) or a checksum annotation (Helm) so config changes roll out.

## Summary

- ConfigMaps hold settings and files; Secrets hold credentials, keys and certificates, base64-encoded but not encrypted.
- Pods use them as environment variables (fixed at start) or files (updated in place within about a minute).
- Give Secrets to apps as read-only files, keep debug endpoints off the network, and protect Secrets with RBAC and encryption at rest.
- Immutable ConfigMaps and Kustomize's generated names turn config changes into normal rollouts.

## Keep Learning

- [Restart pods when a ConfigMap changes](/posts/restart-pods-when-configmap-updates-in-kubernetes)
- [How to manage multiple environments in Kubernetes](/posts/how-to-manage-multiple-environments-in-kubernetes)
- [GitOps implementation checklist](/checklists/gitops-implementation)

Next, in [Part 7](/guides/introduction-to-kubernetes/07-persistent-storage-in-kubernetes), the cache loses its data, and you fix that with a volume and a StatefulSet.
