---
title: 'How Can I Trigger a Kubernetes Scheduled Job Manually?'
excerpt: 'Run a Kubernetes CronJob now with kubectl create job --from, wait for it and read its logs, change it for one run, and check the CronJob settings that decide when it runs.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2025-04-25'
publishedAt: '2025-04-25T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - CronJobs
  - Jobs
  - kubectl
  - DevOps
---

A Kubernetes CronJob, the scheduled Job of older Kubernetes versions, creates a Job at the times in its schedule. Sometimes you need a run now: to test a new backup script, to send a report that failed last night, or to check that a change works before the next scheduled time. You do not have to touch the schedule for that. `kubectl` can create a Job from the CronJob's template directly.

## TLDR

| Task                            | Command                                                                   |
| ------------------------------- | ------------------------------------------------------------------------- |
| Run the CronJob now             | `kubectl create job --from=cronjob/backup backup-manual-$(date +%s)`      |
| Wait until it succeeds          | `kubectl wait --for=condition=complete job/<name> --timeout=15m`          |
| Read its logs                   | `kubectl logs job/<name>`                                                 |
| Run it once with a change       | `--dry-run=client -o yaml > job.yaml`, edit, `kubectl create -f job.yaml` |
| Stop the scheduled runs for now | `kubectl patch cronjob backup -p '{"spec":{"suspend":true}}'`             |

## Prerequisites

- `kubectl` with permission to read CronJobs and to create Jobs in the namespace.
- A CronJob to run. The examples use one named `backup` in the `shop` namespace. Add `-n shop` to each command, or set it as your default namespace.

## Understanding CronJobs and Jobs

A CronJob does not run containers itself. At each time in its schedule, it creates a **Job** from its `jobTemplate`, and the Job creates the pods that do the work. This CronJob runs every night at 03:30 Berlin time:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup
  namespace: shop
spec:
  schedule: '30 3 * * *' # not between 02:00 and 03:00, which daylight saving time skips or repeats
  timeZone: Europe/Berlin # without it, the time zone of kube-controller-manager
  concurrencyPolicy: Forbid # skip a run while the previous one still runs
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 2 # mark the Job as failed after two retries
      activeDeadlineSeconds: 3600 # fail the Job after one hour
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: busybox:1.37
              command: ['sh', '-c', 'echo "backup started at $(date -u)"']
```

Check an expression with the [cron expression simulator](/games/cron-expression-simulator) or the [cron parser](/tools/cron-parser) before you rely on it. Kubernetes uses the standard five fields, and `timeZone` (stable since Kubernetes 1.27) takes a name from the time zone database.

## How Can I Trigger a CronJob Manually?

Create a Job from the CronJob with `--from`:

```bash
kubectl create job --from=cronjob/backup backup-manual-$(date +%s)
```

```text
job.batch/backup-manual-1763024400 created
```

The last argument is the name of the new Job. It must be unique in the namespace, so a timestamp suffix lets you run the command again. Keep it under 63 characters, because Kubernetes copies the Job name into a label on its pods, and a label value cannot be longer.

kubectl copies the CronJob's `jobTemplate` into the new Job. It also adds two things:

- The annotation `cronjob.kubernetes.io/instantiate: manual`, so you can tell manual runs from scheduled ones.
- An owner reference to the CronJob. When you delete the CronJob, the manual Job and its pods are deleted with it.

The manual run starts at once and does not change the schedule. It works even when the CronJob is suspended, because `suspend` only stops the scheduled runs.

### How Do I Wait for the Job and Read Its Logs?

```bash
JOB=backup-manual-1763024400
kubectl get job "$JOB"   # COMPLETIONS shows 0/1 while it runs and 1/1 when it is done
kubectl wait --for=condition=complete "job/$JOB" --timeout=15m
kubectl logs "job/$JOB"
```

`kubectl wait --for=condition=complete` does not end when the Job fails. It waits until its timeout. In a script, wait for either result instead:

```bash
until kubectl get job "$JOB" -o jsonpath='{.status.conditions[*].type}' | grep -qwE 'Complete|Failed'; do
  sleep 5
done
kubectl get job "$JOB" -o jsonpath='{.status.conditions[*].type}{"\n"}'   # Complete or Failed
```

`kubectl logs job/<name>` reads the logs of one of the Job's pods. How to find earlier tries depends on the restart policy. With `restartPolicy: OnFailure`, a failed container restarts inside the same pod: read the try before with `kubectl logs <pod> --previous`. With `restartPolicy: Never`, each try is a new pod: list them with `kubectl get pods -l job-name=$JOB` and read each one.

### How Do I Run It Once With a Change?

Print the Job instead of creating it, edit the file, and create it:

```bash
kubectl create job --from=cronjob/backup backup-test --dry-run=client -o yaml > backup-test.yaml
# edit backup-test.yaml, for example an environment variable or the command
kubectl create -f backup-test.yaml
```

The edited Job still has the owner reference to the CronJob, so it is deleted with it. Delete a test Job when you are done: `kubectl delete job backup-test`.

## Should I Change the Schedule to Run It Now?

No. Old guides suggest to change the schedule to `* * * * *`, wait for a run, and change it back. That runs the Job every minute until you remember to revert it. With `concurrencyPolicy: Allow` (the default), the runs can also overlap. And if the CronJob is managed by Git, Helm or a GitOps tool, your edit is either reverted or causes drift. `kubectl create job --from` runs the Job once without changing the schedule. It does not check `concurrencyPolicy`, so make sure that no scheduled run is active if two runs at once would cause problems.

If you need to stop the scheduled runs while you test, suspend the CronJob, and resume it after:

```bash
kubectl patch cronjob backup -p '{"spec":{"suspend":true}}'
kubectl patch cronjob backup -p '{"spec":{"suspend":false}}'
```

## Which CronJob Settings Decide When It Runs?

| Setting                         | Default                                  | What it does                                                                  |
| ------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| `timeZone`                      | The time zone of kube-controller-manager | The time zone of `schedule`. On managed clusters that is usually UTC          |
| `concurrencyPolicy`             | `Allow`                                  | `Forbid` skips a run while one is active. `Replace` stops the active one      |
| `startingDeadlineSeconds`       | None                                     | How late a missed run may still start, for example after a controller restart |
| `suspend`                       | `false`                                  | `true` stops new scheduled runs. Running Jobs continue                        |
| `successfulJobsHistoryLimit`    | 3                                        | Successful Jobs to keep, with their pods                                      |
| `failedJobsHistoryLimit`        | 1                                        | Failed Jobs to keep                                                           |
| `jobTemplate.spec.backoffLimit` | 6 for most Jobs                          | How many retries, container restarts included, before the Job fails           |

Two of these explain most "my CronJob did not run" questions. If `concurrencyPolicy: Forbid` is set and an earlier Job still runs, for example because it hangs, every new run is skipped. And if the controller was down at the scheduled time, `startingDeadlineSeconds` decides whether the missed run still starts when it comes back. `kubectl describe cronjob backup` shows the last schedule time and the events.

## Related Resources

- [Introduction to Kubernetes: Jobs and CronJobs](/guides/introduction-to-kubernetes/04-deployments-and-replicasets#h3-a-cronjob): a CronJob and a manual run with real output
- [How to get logs, events and files from pods](/posts/get-logs-from-all-pods-replication-controller)
- [How to run multiple commands in a container](/posts/how-to-restart-container-within-pod#h2-how-do-i-run-multiple-commands-in-a-kubernetes-container)
- [Cron expression simulator](/games/cron-expression-simulator) and [cron parser](/tools/cron-parser)
- [Kubernetes terminal simulator](/games/kubernetes-terminal-simulator)
- [Kubernetes quiz](/quizzes/kubernetes-quiz)
