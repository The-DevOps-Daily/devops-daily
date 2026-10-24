---
title: 'Kubernetes Deployments: Rolling Updates, Rollbacks and Scaling'
description: 'Run a Kubernetes Deployment: scale it, roll out a new version, watch a broken rollout stop safely, roll back, and run Jobs, CronJobs and DaemonSets.'
order: 4
---

**TLDR**: A **Deployment** keeps a number of identical pods running and replaces them gradually when you change the pod template. It does this through **ReplicaSets**: one per version of the template. `kubectl rollout status`, `history` and `undo` follow and reverse a rollout, and `maxSurge`, `maxUnavailable` and readiness probes decide how safe it is. For work that finishes, use a **Job** or **CronJob**; for one pod per node, a **DaemonSet**.

In this part you run three copies of podinfo, delete one to watch it come back, scale it, update it to a new version, push a broken version and watch Kubernetes refuse to take the app down, and roll back. Then you run a Job with a native sidecar and a CronJob.

## Prerequisites

- The kind cluster from [Part 2](/guides/introduction-to-kubernetes/02-setting-up-a-kubernetes-cluster) with the `demo` namespace selected.
- The pods from [Part 3](/guides/introduction-to-kubernetes/03-pods-and-containers-in-kubernetes) deleted (the last command of that part).

## Deployments, ReplicaSets and Pods

You create the Deployment. The Deployment creates a ReplicaSet for the current pod template, and the ReplicaSet creates the pods. When you change the template, for example the image tag, the Deployment creates a second ReplicaSet and moves pods from the old one to the new one step by step.

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "d", "label": "Deployment", "sub": "podinfo", "icon": "rocket", "tone": "accent", "detail": "Holds the pod template, the replica count and the update strategy." }],
    [
      { "id": "rs1", "label": "ReplicaSet", "sub": "6.14.1, scaled to 0", "icon": "gear", "tone": "slate", "detail": "The old version. Kept with 0 replicas so you can roll back." },
      { "id": "rs2", "label": "ReplicaSet", "sub": "6.15.0, 3 replicas", "icon": "gear", "tone": "blue", "detail": "The current version. Keeps exactly 3 pods running." }
    ],
    [
      { "id": "p1", "label": "pod", "sub": "6.15.0", "icon": "pod", "tone": "green" },
      { "id": "p2", "label": "pod", "sub": "6.15.0", "icon": "pod", "tone": "green" },
      { "id": "p3", "label": "pod", "sub": "6.15.0", "icon": "pod", "tone": "green" }
    ]
  ],
  "edges": [["d", "rs1", "old"], ["d", "rs2", "current"], ["rs2", "p1"], ["rs2", "p2"], ["rs2", "p3"]]
}
```

You almost never touch ReplicaSets yourself. They matter because they are what `kubectl rollout undo` goes back to, and because they appear in pod names: `podinfo-77cfdf847c-9t6dz` is a pod of ReplicaSet `podinfo-77cfdf847c`, where `77cfdf847c` is a hash of the pod template.

## Create the Deployment

The Deployment runs three replicas of podinfo 6.14.1, the previous release, so that you can update it in a moment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: podinfo
  labels:
    app: podinfo
spec:
  replicas: 3
  # Keep five old ReplicaSets for rollbacks
  revisionHistoryLimit: 5
  # Mark the rollout as failed if it makes no progress for 2 minutes
  progressDeadlineSeconds: 120
  # A new pod must stay ready for 5 seconds before it counts as available
  minReadySeconds: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1 # at most one pod above the desired count
      maxUnavailable: 0 # never go below the desired count of available pods
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
          image: ghcr.io/stefanprodan/podinfo:6.14.1
          ports:
            - name: http
              containerPort: 9898
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
```

The important fields:

- `selector.matchLabels` must match the labels in `template.metadata.labels`. This is how the Deployment finds its pods, and you cannot change it later.
- `strategy.rollingUpdate` with `maxSurge: 1` and `maxUnavailable: 0` means: during an update, the controller creates at most one pod above the desired count and removes an old pod only when a new one is available. A new version that never becomes ready therefore cannot reduce the number of available pods. Old pods that are shutting down still count against node resources for their grace period, and a version that passes its readiness probe and fails later is not caught; that is what monitoring and rollbacks are for.
- `minReadySeconds: 5` makes a new pod count as available only after it has been ready for 5 seconds, which catches pods that crash right after starting.
- `progressDeadlineSeconds: 120` marks a rollout as failed if it makes no progress for two minutes.
- `resources` reserves CPU and memory for each pod and caps its memory ([Part 8](/guides/introduction-to-kubernetes/08-resource-management-and-scaling) explains these numbers).

```terminal
{
  "title": "create the Deployment",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 04-deployments/deployment.yaml",
      "output": "deployment.apps/podinfo created"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo",
      "output": "Waiting for deployment \"podinfo\" rollout to finish: 0 of 3 updated replicas are available...\nWaiting for deployment \"podinfo\" rollout to finish: 0 of 3 updated replicas are available...\nWaiting for deployment \"podinfo\" rollout to finish: 0 of 3 updated replicas are available...\ndeployment \"podinfo\" successfully rolled out"
    },
    {
      "cmd": "kubectl get deployment podinfo",
      "output": "NAME      READY   UP-TO-DATE   AVAILABLE   AGE\npodinfo   3/3     3            3           9s"
    },
    {
      "cmd": "kubectl get replicasets",
      "output": "NAME                 DESIRED   CURRENT   READY   AGE\npodinfo-77cfdf847c   3         3         3       9s"
    },
    {
      "cmd": "kubectl get pods -l app=podinfo -o wide",
      "output": "NAME                       READY   STATUS    RESTARTS   AGE   IP           NODE                NOMINATED NODE   READINESS GATES\npodinfo-77cfdf847c-5cfh7   1/1     Running   0          9s    10.244.1.3   k8s-guide-worker2   <none>           <none>\npodinfo-77cfdf847c-rvkrd   1/1     Running   0          9s    10.244.2.2   k8s-guide-worker    <none>           <none>\npodinfo-77cfdf847c-vvgv2   1/1     Running   0          9s    10.244.1.2   k8s-guide-worker2   <none>           <none>"
    }
  ]
}
```

In `kubectl get deployment`, `READY` is ready pods out of desired, `UP-TO-DATE` counts pods that run the current template, and `AVAILABLE` counts pods that have been ready for `minReadySeconds`. The `NODE` column shows where the scheduler put each pod. It tends to spread copies of an app over nodes but does not promise to; [Part 8](/guides/introduction-to-kubernetes/08-resource-management-and-scaling) shows how to ask for it.

## Self-Healing and Scaling

Delete one pod and the ReplicaSet notices that it has two of three, and creates a replacement:

```terminal
{
  "title": "self-healing",
  "prompt": "$",
  "steps": [
    {
      "cmd": "POD=$(kubectl get pods -l app=podinfo -o jsonpath='{.items[0].metadata.name}')"
    },
    {
      "cmd": "kubectl delete pod $POD",
      "output": "pod \"podinfo-77cfdf847c-5cfh7\" deleted from demo namespace"
    },
    {
      "cmd": "kubectl get pods -l app=podinfo",
      "output": "NAME                       READY   STATUS    RESTARTS   AGE\npodinfo-77cfdf847c-rvkrd   1/1     Running   0          15s\npodinfo-77cfdf847c-v8f4l   1/1     Running   0          6s\npodinfo-77cfdf847c-vvgv2   1/1     Running   0          15s"
    }
  ]
}
```

The new pod has a new name and a younger `AGE`. This is also why a Deployment's pods are not the place for anything you want to keep.

Scaling changes the replica count of the current ReplicaSet:

```terminal
{
  "title": "scale",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl scale deployment podinfo --replicas=5",
      "output": "deployment.apps/podinfo scaled"
    },
    {
      "cmd": "kubectl get deployment podinfo",
      "output": "NAME      READY   UP-TO-DATE   AVAILABLE   AGE\npodinfo   5/5     5            5           21s"
    }
  ]
}
```

`kubectl scale` is handy, but the YAML file still says `replicas: 3`, and the next `kubectl apply` of the file sets it back. For a lasting change, edit the file. When an autoscaler manages the count ([Part 8](/guides/introduction-to-kubernetes/08-resource-management-and-scaling)), remove `replicas` from the file so the two do not fight.

## Roll Out a New Version

Update the image to 6.15.0, then record why in the `kubernetes.io/change-cause` annotation, which `kubectl rollout history` shows. (The old `--record` flag that set it automatically is deprecated.) Then follow the rollout:

```terminal
{
  "title": "rolling update",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl set image deployment/podinfo podinfo=ghcr.io/stefanprodan/podinfo:6.15.0",
      "output": "deployment.apps/podinfo image updated"
    },
    {
      "cmd": "kubectl annotate deployment/podinfo kubernetes.io/change-cause='Update podinfo to 6.15.0'",
      "output": "deployment.apps/podinfo annotated"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo",
      "output": "Waiting for deployment \"podinfo\" rollout to finish: 1 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 3 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 3 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 3 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 3 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 3 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 4 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 4 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 4 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 4 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 4 out of 5 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\ndeployment \"podinfo\" successfully rolled out"
    },
    {
      "cmd": "kubectl get replicasets -o wide",
      "output": "NAME                 DESIRED   CURRENT   READY   AGE   CONTAINERS   IMAGES                                SELECTOR\npodinfo-69c9f58845   5         5         5       37s   podinfo      ghcr.io/stefanprodan/podinfo:6.15.0   app=podinfo,pod-template-hash=69c9f58845\npodinfo-77cfdf847c   0         0         0       58s   podinfo      ghcr.io/stefanprodan/podinfo:6.14.1   app=podinfo,pod-template-hash=77cfdf847c"
    },
    {
      "cmd": "kubectl rollout history deployment/podinfo",
      "output": "deployment.apps/podinfo\nREVISION  CHANGE-CAUSE\n1         <none>\n2         Update podinfo to 6.15.0"
    }
  ]
}
```

The new ReplicaSet grew one pod at a time (`maxSurge: 1`), and the old one shrank only after each new pod had stayed ready for 5 seconds and become available. The old ReplicaSet is still there with 0 replicas; `revisionHistoryLimit: 5` keeps five of them for rollbacks.

## A Broken Rollout

Now push a version that does not exist, as a typo in a tag would:

```terminal
{
  "title": "a bad image",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl set image deployment/podinfo podinfo=ghcr.io/stefanprodan/podinfo:6.99.0",
      "output": "deployment.apps/podinfo image updated"
    },
    {
      "cmd": "kubectl annotate deployment/podinfo --overwrite kubernetes.io/change-cause='Update podinfo to 6.99.0'",
      "output": "deployment.apps/podinfo annotated"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo --timeout=60s",
      "output": "Waiting for deployment \"podinfo\" rollout to finish: 1 out of 5 new replicas have been updated...\nerror: timed out waiting for the condition"
    },
    {
      "cmd": "kubectl get pods -l app=podinfo",
      "output": "NAME                       READY   STATUS         RESTARTS   AGE\npodinfo-5db5fbf8bf-knlvq   0/1     ErrImagePull   0          60s\npodinfo-69c9f58845-7xs65   1/1     Running        0          97s\npodinfo-69c9f58845-c959p   1/1     Running        0          76s\npodinfo-69c9f58845-g4trq   1/1     Running        0          70s\npodinfo-69c9f58845-m79kt   1/1     Running        0          89s\npodinfo-69c9f58845-rd57h   1/1     Running        0          82s"
    },
    {
      "cmd": "kubectl get deployment podinfo",
      "output": "NAME      READY   UP-TO-DATE   AVAILABLE   AGE\npodinfo   5/5     1            5           118s"
    }
  ]
}
```

This is the rolling update doing its job. The one new pod cannot pull its image, so it never becomes ready, and because `maxUnavailable` is 0 the Deployment does not remove a single old pod: all five replicas of 6.15.0 still serve traffic. Without a readiness probe, or with a larger `maxUnavailable`, a broken version can replace working pods.

After `progressDeadlineSeconds` without progress, the Deployment marks the rollout as failed. It does not roll back by itself, but the failure is visible to `kubectl rollout status`, to your CI pipeline and to monitoring:

```terminal
{
  "title": "the progress deadline",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl rollout status deployment/podinfo",
      "output": "error: deployment \"podinfo\" exceeded its progress deadline"
    },
    {
      "cmd": "kubectl get deployment podinfo -o jsonpath='{.status.conditions[?(@.type==\"Progressing\")].message}{\"\\n\"}'",
      "output": "ReplicaSet \"podinfo-5db5fbf8bf\" has timed out progressing."
    }
  ]
}
```

## Roll Back

`kubectl rollout undo` switches the Deployment back to the previous ReplicaSet's template:

```terminal
{
  "title": "roll back",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl rollout undo deployment/podinfo",
      "output": "Warning: resource deployments/podinfo was previously managed with 'kubectl apply'. Rolling back will not update the kubectl.kubernetes.io/last-applied-configuration annotation, which may cause unexpected behavior on future 'kubectl apply' operations. Consider using 'kubectl apply' with your previous configuration file instead.\ndeployment.apps/podinfo rolled back"
    },
    {
      "cmd": "kubectl annotate deployment/podinfo --overwrite kubernetes.io/change-cause='Roll back to 6.15.0'",
      "output": "deployment.apps/podinfo annotated"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo",
      "output": "deployment \"podinfo\" successfully rolled out"
    },
    {
      "cmd": "kubectl rollout history deployment/podinfo",
      "output": "deployment.apps/podinfo\nREVISION  CHANGE-CAUSE\n1         <none>\n3         Update podinfo to 6.99.0\n4         Roll back to 6.15.0"
    },
    {
      "cmd": "kubectl get deployment podinfo -o jsonpath='{.spec.template.spec.containers[0].image}{\"\\n\"}'",
      "output": "ghcr.io/stefanprodan/podinfo:6.15.0"
    }
  ]
}
```

Revision 2 became revision 4: a rollback reuses the old ReplicaSet and gives it a new revision number. To go back further, use `--to-revision=<n>`, and `kubectl rollout history deployment/podinfo --revision=4` shows the full template of one revision. Set the replica count back to the file's value:

```bash
kubectl scale deployment podinfo --replicas=3
```

```text
deployment.apps/podinfo scaled
```

Read the warning that `rollout undo` printed. The cluster now runs 6.15.0, but `04-deployments/deployment.yaml` still says 6.14.1, so the next `kubectl apply` of that file would quietly downgrade the app. `kubectl diff` shows the drift before you apply:

```bash
kubectl diff -f 04-deployments/deployment.yaml | grep '^[-+] '
```

```text
-  generation: 9
+  generation: 10
-      - image: ghcr.io/stefanprodan/podinfo:6.15.0
+      - image: ghcr.io/stefanprodan/podinfo:6.14.1
```

That is why teams treat `set image`, `scale` and `rollout undo` as emergency tools and make the lasting change in Git. The later parts of this guide use their own manifests with 6.15.0.

## Restart Pods Without a Change

`kubectl rollout restart` replaces all pods with the same rolling strategy, for example to pick up a changed ConfigMap ([Part 6](/guides/introduction-to-kubernetes/06-configmaps-and-secrets)) or a rotated credential:

```terminal
{
  "title": "rolling restart",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl rollout restart deployment/podinfo",
      "output": "deployment.apps/podinfo restarted"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo",
      "output": "Waiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\ndeployment \"podinfo\" successfully rolled out"
    }
  ]
}
```

It works by adding a timestamp annotation to the pod template, which counts as a change.

## Update Strategies

- **RollingUpdate** (the default) replaces pods gradually, within the limits of `maxSurge` and `maxUnavailable`. Both accept a number or a percentage of `replicas`.
- **Recreate** deletes all old pods before it creates new ones. There is downtime, but two versions never run at the same time, which some apps with schema changes or exclusive locks need.

Blue-green and canary releases are built from the same pieces: two Deployments with different labels, and a Service or route that decides which one gets traffic. [Part 5](/guides/introduction-to-kubernetes/05-services-and-networking) sends 10 percent of requests to a canary with Gateway API. Tools such as Argo Rollouts and Flagger automate those steps and roll back on bad metrics. The [deployment strategies guide](/posts/deployment-strategies-guide) and the [deployment strategies simulator](/games/deployment-strategies) compare the options.

## Other Workload Controllers

Deployments are for stateless, long-running apps. The other controllers follow the same pattern for other kinds of work:

| Controller      | Use it for                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **StatefulSet** | Apps that need a stable name and their own volume per pod, such as databases ([Part 7](/guides/introduction-to-kubernetes/07-persistent-storage-in-kubernetes)) |
| **DaemonSet**   | One pod per node: log collectors, monitoring agents, network plugins                                                                                            |
| **Job**         | Work that runs to completion, with retries                                                                                                                      |
| **CronJob**     | A Job on a schedule                                                                                                                                             |

The cluster already runs two DaemonSets, the network plugin and kube-proxy:

```bash
kubectl get daemonsets -n kube-system
```

```text
NAME         DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR            AGE
kindnet      3         3         3       3            3           kubernetes.io/os=linux   4m47s
kube-proxy   3         3         3       3            3           kubernetes.io/os=linux   4m48s
```

### A Job with a Native Sidecar

This Job processes three batches and writes a line for each to a log file. A native sidecar ships that file, here by printing it to its own output. Before sidecars were a Kubernetes feature, a sidecar like this kept running after the main container finished and the Job never completed.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: report
spec:
  backoffLimit: 2 # retry a failed pod at most twice
  ttlSecondsAfterFinished: 600 # delete the Job and its pod 10 minutes after it ends
  template:
    spec:
      restartPolicy: Never
      volumes:
        - name: logs
          emptyDir: {}
      initContainers:
        # A native sidecar: it does not keep the Job from completing
        - name: log-shipper
          image: busybox:1.38.0
          restartPolicy: Always
          command: ['sh', '-c', 'touch /logs/report.log && tail -f /logs/report.log']
          volumeMounts:
            - name: logs
              mountPath: /logs
      containers:
        - name: report
          image: busybox:1.38.0
          command:
            - sh
            - -c
            - for i in 1 2 3; do echo "processed batch $i" >> /logs/report.log; sleep 2; done
          volumeMounts:
            - name: logs
              mountPath: /logs
```

```terminal
{
  "title": "a Job",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 04-deployments/job.yaml",
      "output": "job.batch/report created"
    },
    {
      "cmd": "kubectl wait --for=condition=Complete job/report --timeout=120s",
      "output": "job.batch/report condition met"
    },
    {
      "cmd": "kubectl get jobs,pods -l job-name=report",
      "output": "NAME               STATUS     COMPLETIONS   DURATION   AGE\njob.batch/report   Complete   1/1           40s        41s\n\nNAME               READY   STATUS      RESTARTS   AGE\npod/report-f4g2f   0/2     Completed   0          41s"
    },
    {
      "cmd": "kubectl logs job/report -c log-shipper",
      "output": "processed batch 1\nprocessed batch 2\nprocessed batch 3"
    }
  ]
}
```

The Job completed, and Kubernetes stopped the sidecar after the main container exited. `backoffLimit` caps the retries of a failing Job, and `ttlSecondsAfterFinished` deletes the finished Job and its pod after 10 minutes so they do not pile up.

### A CronJob

A CronJob creates a Job on a schedule. `timeZone` makes the schedule independent of the control plane's clock, and `concurrencyPolicy: Forbid` skips a run while the previous one is still running:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup
spec:
  schedule: '0 3 * * *' # 03:00 every day
  timeZone: Etc/UTC
  concurrencyPolicy: Forbid # skip a run while the previous one is still running
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 1
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: cleanup
              image: busybox:1.38.0
              command: ['sh', '-c', 'echo "cleanup ran at $(date -u)"']
```

To test it without waiting until 03:00, create a Job from its template:

```terminal
{
  "title": "a CronJob",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 04-deployments/cronjob.yaml",
      "output": "cronjob.batch/cleanup created"
    },
    {
      "cmd": "kubectl create job cleanup-manual --from=cronjob/cleanup",
      "output": "job.batch/cleanup-manual created"
    },
    {
      "cmd": "kubectl get cronjobs,jobs",
      "output": "NAME                    SCHEDULE    TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE\ncronjob.batch/cleanup   0 3 * * *   Etc/UTC    False     0        <none>          4s\n\nNAME                       STATUS     COMPLETIONS   DURATION   AGE\njob.batch/cleanup-manual   Complete   1/1           4s         4s\njob.batch/report           Complete   1/1           40s        45s"
    },
    {
      "cmd": "kubectl logs job/cleanup-manual",
      "output": "cleanup ran at Sat Oct 24 10:19:57 UTC 2026"
    }
  ]
}
```

Clean up. The manual Job belongs to the CronJob through an owner reference, so it goes with it:

```terminal
{
  "title": "clean up",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl delete -f 04-deployments/job.yaml -f 04-deployments/cronjob.yaml",
      "output": "job.batch \"report\" deleted from demo namespace\ncronjob.batch \"cleanup\" deleted from demo namespace"
    },
    {
      "cmd": "kubectl get jobs",
      "output": "No resources found in demo namespace."
    }
  ]
}
```

Keep the podinfo Deployment: the next part puts a Service in front of it.

## Common Mistakes

- **No readiness probe.** Kubernetes then considers a pod ready as soon as its container starts, and a rolling update can replace working pods with broken ones.
- **Changing the selector.** `spec.selector` is immutable. Plan your labels before the first apply.
- **Editing live objects and forgetting the file.** `set image`, `scale` and `edit` drift from Git; `kubectl diff` shows the difference.
- **Expecting an automatic rollback.** A failed rollout stops and reports `ProgressDeadlineExceeded`; your pipeline or a tool such as Argo Rollouts decides what to do next.
- **Jobs that never get cleaned up.** Set `ttlSecondsAfterFinished` and the CronJob history limits.

## Summary

- A Deployment manages ReplicaSets, one per version of the pod template, and the ReplicaSets manage the pods.
- `maxSurge`, `maxUnavailable`, readiness probes and `minReadySeconds` decide how safe a rolling update is.
- `kubectl rollout status`, `history`, `undo` and `restart` follow, list, reverse and restart rollouts.
- Jobs run to completion, CronJobs run Jobs on a schedule, DaemonSets run one pod per node, and native sidecars do not block Jobs.

## Keep Learning

- [Kubernetes Deployments vs StatefulSets](/posts/kubernetes-deployments-vs-statefulsets)
- [How to make a Deployment update its image](/posts/kubernetes-how-to-make-deployment-to-update-image)
- [How to trigger a CronJob manually](/posts/trigger-kubernetes-scheduled-job-manually)
- [Why a pod comes back after you delete it](/posts/why-does-kubernetes-pod-get-recreated-when-deleted)

Next, in [Part 5](/guides/introduction-to-kubernetes/05-services-and-networking), you give these pods one stable address and expose them outside the cluster.
