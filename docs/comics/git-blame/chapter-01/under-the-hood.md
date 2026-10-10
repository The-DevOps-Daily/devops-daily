# Under the Hood

Phase 5 reader copy, mirrored from `content/comics/git-blame/chapter-01.json`. Describes ShipIt’s fictional incident.

The new pods were healthy. The failed request was still waiting for an old pod to reply.

During the rollout, the old checkout app received SIGTERM and exited immediately. Its connection closed before the response finished, and the load balancer returned a 502. A replacement pod cannot take over a request already running elsewhere.

The team made shutdown a handoff: allow traffic withdrawal, stop accepting new connections, finish accepted requests, close dependencies, then exit within a bounded deadline. They tested requests overlapping retirement, including a deliberately slow request. For the first corrected release, they used healthy parallel replicas and kept old processes alive until routing had moved and their in-flight work finished. New code did not repair old running pods.

A few details matter:

- Readiness affects admission of traffic; it does not finish accepted work or instantly update every load balancer. Replacement readiness and departure draining are separate checks.
- A preStop hook normally runs before the container’s stop signal and consumes the same terminationGracePeriodSeconds budget. A measured delay can allow propagation; sleeping alone does not drain requests.
- In this Node.js 22 HTTP/1.1 example, server.close() stops accepting new connections while active requests finish. Closing active connections forcefully is not the normal first step, and detached work or database transactions need their own handling.
- The load-balancer allowance, application deadline and pod grace budget must fit real request bounds. Kubernetes can forcibly kill remaining processes when grace expires. Other frameworks, signals, proxies and protocols require their own review.

A lost checkout response does not prove the order failed to commit. Safe retries of writes require an appropriate idempotency design. ShipIt and its successful rollouts are fictional; a 502 has several possible causes, so correlate evidence before choosing a fix.

[DevOps Daily: Deployments and ReplicaSets](/guides/introduction-to-kubernetes/04-deployments-and-replicasets) · [DevOps Daily: Services and Networking](/guides/introduction-to-kubernetes/05-services-and-networking) · [Kubernetes: Pod termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination-flow) · [AWS: ALB 502 troubleshooting](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-502-issues)
