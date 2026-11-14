---
title: 'How to Restart, List and Keep Containers Running in a Kubernetes Pod'
excerpt: 'Kubernetes has no command to restart one container. Learn the ways that work, how to restart pods after a ConfigMap or Secret change, how to list containers, run several commands, keep a container running, and use local images.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-01-10'
publishedAt: '2024-01-10T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Pods
  - Containers
  - kubectl
  - minikube
  - ConfigMaps
  - Troubleshooting
---

In Kubernetes, the pod is the unit you manage, not the container. That is why `kubectl` has no "restart container" command, why a container that finishes its work goes into `CrashLoopBackOff`, and why an image you just built with Docker gives `ErrImagePull` in your local cluster. Each of these has a short, reliable answer once you know how pods treat their containers.

This post covers restarting a container in a pod, restarting pods after a ConfigMap or Secret change, listing the containers of a pod, running several commands in one container, keeping a container running, and using local images with minikube, kind and k3d.

## TLDR

| Task                             | Command or setting                                                           |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Restart the pods of a Deployment | `kubectl rollout restart deployment/web`                                     |
| Replace one pod                  | `kubectl delete pod web-7d4b9c-x2kqz` (its controller makes a new one)       |
| Load a changed ConfigMap         | Mounted files update within a minute or two; env vars need `rollout restart` |
| Update a Secret from a file      | `kubectl create secret ... --dry-run=client -o yaml \| kubectl apply -f -`   |
| Run several commands             | `command: ["sh", "-c"]` and the commands in `args`, with `exec` last         |
| List the containers of a pod     | `kubectl get pod web-7d4b9c-x2kqz -o jsonpath='{.spec.containers[*].name}'`  |
| Keep a debug container running   | `command: ["sleep", "infinity"]`                                             |
| See why a container stopped      | `kubectl describe pod <pod>` and `kubectl logs <pod> -c <name> --previous`   |
| Use a local image in minikube    | `minikube image load my-app:1.0`, with `imagePullPolicy: IfNotPresent`       |

## Prerequisites

- A Kubernetes cluster and `kubectl`. A local cluster from minikube, kind, k3d or Docker Desktop is enough.
- Basic knowledge of pods and Deployments. [Introduction to Kubernetes: Pods and Containers](/guides/introduction-to-kubernetes/03-pods-and-containers-in-kubernetes) covers them.

## How Do I Restart a Container Within a Kubernetes Pod?

There is no `kubectl` command that restarts a single container. `kubectl rollout restart` is the only restart command, and it works on whole workloads. Pick the option that matches what you need.

**Restart all pods of a workload, one at a time.** This is the normal way, for example after you change a ConfigMap or Secret that the app reads at startup:

```bash
kubectl rollout restart deployment/web -n shop
kubectl rollout status deployment/web -n shop
```

It works for `deployment`, `statefulset` and `daemonset`. It adds an annotation with the current time to the pod template, so the controller replaces the pods with its update strategy. A Deployment with `RollingUpdate`, several replicas and a readiness probe stays available. `Recreate` stops all pods first, and a StatefulSet or DaemonSet with `OnDelete` waits until you delete the pods yourself.

**Replace one pod.** Delete it, and its controller (ReplicaSet, StatefulSet or DaemonSet) creates a new one:

```bash
kubectl delete pod web-7d4b9c-x2kqz -n shop
```

All containers start again in a replacement pod. A ReplicaSet or DaemonSet gives it a new name, and a StatefulSet keeps the same name and ordinal. A **bare pod**, one that no controller manages, is not recreated. Check `kubectl get pod <name> -o jsonpath='{.metadata.ownerReferences[*].kind}'` first: an empty result means a bare pod, and you have to apply its manifest again.

**Restart only one container in place.** Make that container's main process exit. The kubelet then restarts the container in the same pod, according to the pod's `restartPolicy` (`Always`, the default, or `OnFailure`):

```bash
kubectl exec web-7d4b9c-x2kqz -c app -- kill 1
kubectl get pod web-7d4b9c-x2kqz -w     # the RESTARTS count goes up by one
```

This depends on the app. Inside its own PID namespace, the main process is PID 1, and the kernel does not deliver signals that PID 1 has no handler for. `kill 1` (SIGTERM) works for most servers, because they handle SIGTERM. For a process that ignores it, even `kill -9 1` from inside the container does nothing. The image also needs a `kill` command, which distroless images do not have. Treat this as a debugging trick, not an operations procedure.

Newer clusters can also decide per container what happens when it exits, with `restartPolicy` and `restartPolicyRules` on the container (the `ContainerRestartRules` feature, beta and on by default since Kubernetes 1.35). That is a pod spec setting for exit codes, not a command you run.

## How Do I Restart Pods When a ConfigMap or Secret Changes?

It depends on how the pod uses the ConfigMap or Secret:

| How the pod uses it                      | What happens after you change it                                    |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Environment variables (`env`, `envFrom`) | Nothing. Variables are set once, when the container starts          |
| A mounted volume                         | The files change in the running pod, usually within a minute or two |
| A volume mounted with `subPath`          | Nothing. A `subPath` file never updates                             |

So restart the pods when the app reads its configuration from environment variables, or reads a file only at startup:

```bash
kubectl apply -f configmap.yaml
kubectl rollout restart deployment/web -n shop
```

`kubectl rollout restart` sets the annotation `kubectl.kubernetes.io/restartedAt` in the pod template. Any change to the pod template starts a rollout with the workload's update strategy. Some old guides patch in an annotation of their own with a timestamp, which does the same with more typing. A regular init container cannot detect a config change, because it runs only when a pod starts.

To restart automatically when the config changes, make the config part of the pod template:

- **Kustomize**: a `configMapGenerator` or `secretGenerator` adds a hash of the contents to the name, such as `web-config-7g5f8h2k9m`. A change gives a new name, the Deployment refers to the new name, and the pods roll.
- **Helm**: put a checksum of the ConfigMap template into a pod annotation:

```yaml
spec:
  template:
    metadata:
      annotations:
        checksum/config: '{{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}'
```

- **A controller** such as [Reloader](https://github.com/stakater/Reloader) watches ConfigMaps and Secrets and restarts the workloads that use them, if you add its annotation to the workload.

The Kubernetes guide shows the timing of a mounted file update and the restart for environment variables in [Change the Configuration of Running Pods](/guides/introduction-to-kubernetes/06-configmaps-and-secrets#h2-change-the-configuration-of-running-pods).

### How Do I Update a Secret That Was Created From a File?

Generate the new Secret on the client and apply it over the old one:

```bash
kubectl create secret generic app-config -n shop \
  --from-file=config.json \
  --dry-run=client -o yaml | kubectl apply -f -
```

The key in the Secret is the file name, `config.json`. Use `--from-file=app.json=./config.json` to choose another key. The same pattern works for `kubectl create secret tls` and `kubectl create configmap`. If you created the Secret with `kubectl create`, the first `kubectl apply` warns that it has no `last-applied-configuration` annotation, and adds it. That warning is harmless.

Do not delete the Secret and create it again. Between the two commands the Secret does not exist, and any pod that starts in that moment fails: with `CreateContainerConfigError` if it reads the Secret into environment variables, or it stays in `ContainerCreating` if it mounts it. The data of a Secret with `immutable: true` cannot be changed. Create one with a new name and point the workload at it.

After the update, restart the pods as above if the app reads the Secret at startup, which most servers do with TLS certificates. [Rotate the Certificate](/guides/introduction-to-kubernetes/06-configmaps-and-secrets#h3-rotate-the-certificate) walks through a TLS rotation with real output.

## How Do I List All Containers in a Kubernetes Pod?

`kubectl describe pod` shows them under `Containers:` and `Init Containers:`. For scripts, ask for the names with JSONPath:

```bash
kubectl get pod web-7d4b9c-x2kqz -o jsonpath='{.spec.containers[*].name}{"\n"}'
kubectl get pod web-7d4b9c-x2kqz -o jsonpath='{.spec.initContainers[*].name}{"\n"}'
kubectl get pod web-7d4b9c-x2kqz -o jsonpath='{.spec.ephemeralContainers[*].name}{"\n"}'
```

Native sidecar containers are listed under `initContainers`, with `restartPolicy: Always`. Ephemeral containers are the ones that `kubectl debug` added.

For every pod in a namespace, one line each:

```bash
kubectl get pods -n shop -o custom-columns='POD:.metadata.name,CONTAINERS:.spec.containers[*].name,IMAGES:.spec.containers[*].image'
```

To see the state of each container, with restart counts, read `status.containerStatuses`:

```bash
kubectl get pod web-7d4b9c-x2kqz -o jsonpath='{range .status.containerStatuses[*]}{.name}{"\t"}{.ready}{"\t"}{.restartCount}{"\n"}{end}'
```

Once you have the name, pass it with `-c` to other commands: `kubectl logs web-7d4b9c-x2kqz -c app`, `kubectl exec -it web-7d4b9c-x2kqz -c app -- sh`. `kubectl logs <pod> --all-containers` prints the logs of all of them.

## How Can I Keep a Container Running on Kubernetes?

A container runs as long as its main process runs, exactly as in Docker. Two different problems hide behind this question.

**The container finishes at once.** An image such as `ubuntu` or `busybox` has no long-running process: its default command is a shell, which exits when there is no input. In a Deployment, Kubernetes restarts it again and again, with a growing delay, and the pod shows `CrashLoopBackOff`. To keep such a container alive for debugging, give it a command that does not end:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: toolbox
spec:
  terminationGracePeriodSeconds: 5 # sleep ignores SIGTERM, so do not wait 30 seconds
  containers:
    - name: toolbox
      image: ubuntu:24.04
      command: ['sleep', 'infinity']
```

```bash
kubectl apply -f toolbox.yaml
kubectl exec -it toolbox -- bash
```

For a one-off shell you do not need a manifest: `kubectl run tmp --rm -it --image=ubuntu:24.04 --restart=Never -- bash` starts a pod, attaches to it, and deletes it when you exit. To debug a pod that already runs, `kubectl debug -it <pod> --image=busybox:1.37 --target=app` adds an ephemeral container that shares the app's process namespace.

**A service keeps stopping.** Then the question is why the main process ends. Run it under a Deployment (its pods always use `restartPolicy: Always`), and read the reason:

```bash
kubectl describe pod web-7d4b9c-x2kqz     # "Last State: Terminated", Reason and Exit Code
kubectl logs web-7d4b9c-x2kqz -c app --previous   # the log of the container that died
```

| Reason or exit code             | Cause                                         | What to change                                       |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| `OOMKilled`, 137                | The container used more than its memory limit | Raise `resources.limits.memory`, or fix the leak     |
| `Error`, 1                      | The app failed                                | Read `logs --previous`                               |
| `Completed`, 0                  | The command finished                          | Run a long-running process, or use a Job             |
| Liveness probe failed in Events | The probe killed it                           | Check the probe path, port and `initialDelaySeconds` |

Two settings cause many of these restarts. A memory **limit** below what the app needs gets the container killed, while a **request** decides where the pod is scheduled and how early it is evicted under memory pressure, but is not a cap. A liveness probe that checks a dependency, such as the database, restarts healthy containers whenever that dependency is slow. Keep liveness probes about the process itself, and use readiness probes for "can serve traffic". For work that should finish, use a Job or CronJob instead of keeping a container alive.

## How Do I Run Multiple Commands in a Kubernetes Container?

Run a shell, and give it the commands as one script. `command` replaces the image's `ENTRYPOINT`, and `args` replaces its `CMD`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-command
spec:
  containers:
    - name: web
      image: busybox:1.37
      command: ['sh', '-c']
      args:
        - |
          set -e                      # stop at the first command that fails
          echo "preparing the content"
          mkdir -p /www
          echo "hello" > /www/index.html
          exec httpd -f -p 8080 -h /www   # replace the shell, so the server is PID 1
```

Three details make this work well:

- **`set -e`** stops the script when a step fails, so the container exits with an error instead of starting a server that is not ready. Chaining with `&&` does the same for a short list.
- **`exec` on the last command** replaces the shell with the long-running process. The process then gets `SIGTERM` directly when Kubernetes stops the pod. Without `exec`, the shell is PID 1, and many shells do not pass the signal on, so the pod waits the full grace period.
- **`$(NAME)` is expanded by Kubernetes.** In `command` and `args`, Kubernetes replaces `$(NAME)` with the value of the container's environment variable `NAME`, if it exists. Write `$$(NAME)` to keep the text as it is, but in a shell script the shell then runs it as a command substitution. For variables in a script, use the shell's `${NAME}`, which Kubernetes does not touch.

For a longer script, put it in a ConfigMap and mount it with the execute bit:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: startup-script
data:
  start.sh: |
    #!/bin/sh
    set -e
    echo "running the startup steps"
    exec httpd -f -p 8080
---
apiVersion: v1
kind: Pod
metadata:
  name: script-demo
spec:
  containers:
    - name: web
      image: busybox:1.37
      command: ['/scripts/start.sh']
      volumeMounts:
        - name: scripts
          mountPath: /scripts
  volumes:
    - name: scripts
      configMap:
        name: startup-script
        defaultMode: 0555 # read and execute for everyone
```

The `---` between the two objects is required. Without it, the file is one invalid YAML document. Without `defaultMode`, the file is not executable, and the container fails to start with a permission error.

If a step must finish before the app starts, such as downloading a file, put it in an **init container** instead. It runs to completion before the app container starts, and it can use a different image. Do not run database migrations there if the Deployment has several replicas: each pod runs its own init container, so the migration runs several times at once. Use a Job, or a Helm hook, for migrations.

## How Do I Use Local Docker Images With Minikube?

A local cluster does not see the images in your Docker Engine. It pulls from a registry, fails, and the pod shows `ErrImagePull` or `ImagePullBackOff`. Load the image into the cluster:

```bash
docker build -t my-app:1.0 .
minikube image load my-app:1.0       # copy it from Docker into minikube
minikube image ls | grep my-app
```

Or build it inside minikube directly, which saves the copy:

```bash
minikube image build -t my-app:1.0 .
```

Both commands work with any container runtime in minikube. The older `eval $(minikube docker-env)` method points your `docker` client at a Docker daemon inside minikube. Since minikube 1.39 the default runtime is containerd, so `docker-env` needs a cluster started with `minikube start --container-runtime=docker`. Undo it with `eval $(minikube docker-env -u)`, or the next `docker` command in that shell goes to minikube.

Then make sure Kubernetes does not try to pull the image:

```yaml
containers:
  - name: my-app
    image: my-app:1.0 # a fixed tag, not :latest
    imagePullPolicy: IfNotPresent
```

If you leave out `imagePullPolicy`, Kubernetes uses `Always` for the `:latest` tag or no tag, and `IfNotPresent` for other tags. With `:latest`, it ignores your loaded image and pulls, which fails. Use a version tag, or set `imagePullPolicy: Never` for an image that only exists locally. After you load a new build under the same tag, run `kubectl rollout restart deployment/my-app`: pods that run do not pick up the new image by themselves.

Other local clusters have the same command under another name:

| Cluster  | Load a local image                         |
| -------- | ------------------------------------------ |
| minikube | `minikube image load my-app:1.0`           |
| kind     | `kind load docker-image my-app:1.0`        |
| k3d      | `k3d image import my-app:1.0 -c mycluster` |

For a team or CI, a registry is simpler than loading images by hand: push to it, and let every cluster pull from it.

## Related Resources

- [Introduction to Kubernetes: Pods and Containers](/guides/introduction-to-kubernetes/03-pods-and-containers-in-kubernetes): lifecycle, restart policy and sidecars
- [Introduction to Kubernetes: Deployments and ReplicaSets](/guides/introduction-to-kubernetes/04-deployments-and-replicasets): rollouts and rollbacks
- [Introduction to Kubernetes: ConfigMaps and Secrets](/guides/introduction-to-kubernetes/06-configmaps-and-secrets): mounted files, environment variables and immutable objects
- [Kubernetes terminal simulator](/games/kubernetes-terminal-simulator): practice `rollout restart`, `logs` and `exec` in the browser
- [Do you need Kubernetes, or is Docker Compose enough?](/posts/how-docker-works-under-the-hood#h2-do-you-need-kubernetes-or-is-docker-compose-enough)
- [Kubernetes quiz](/quizzes/kubernetes-quiz) and [Kubernetes security checklist](/checklists/kubernetes-security)
