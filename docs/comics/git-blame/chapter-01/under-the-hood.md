# Under the Hood

Draft reader copy for Chapter 1. Editorial and technical review pending; this describes ShipIt’s fictional incident.

The new pods were healthy. The request that failed was still waiting for an **old** pod to reply.

During a rolling deployment, Kubernetes starts shutting down old pods while the surrounding traffic system updates its view of them. That coordination takes time. In ShipIt’s case, the checkout app handled SIGTERM—the normal stop signal in its container configuration—by exiting immediately. The load balancer was still waiting for a response from that process. The connection closed instead, and the customer saw a 502. A replacement pod cannot take over a request already running somewhere else.

The team made shutdown a proper handoff. They allowed for traffic withdrawal, kept the application alive during that phase, and made it finish accepted requests before closing dependencies and exiting. They tested the sequence with requests overlapping a rollout, including a deliberately slow request. For the first corrected production release, they kept the original processes alive until traffic had moved and their in-flight work had finished; the new code did not retroactively fix old pods.

A few details matter:

- A readiness check tells a routing system whether a pod should receive traffic. It does not finish work already accepted, and its effects do not reach every load balancer instantly.
- A `preStop` hook normally runs before the container’s stop signal. Its execution uses the same `terminationGracePeriodSeconds` budget as the application’s shutdown work. A sleep can provide a tested allowance for propagation; sleeping alone is not graceful shutdown.
- The load balancer’s draining allowance, the application deadline and the total pod grace period must fit the actual traffic and request bounds. If the grace period runs out, remaining processes can be forcibly killed.
- ShipIt uses ALB IP targets and Node.js HTTP/1.1. Other proxies, frameworks, signals and protocols can require different handling. A 502 has several possible causes; correlate evidence before choosing a fix.

An interrupted checkout response also does not prove that the order failed to commit. Retrying writes safely requires an appropriate idempotency design.

For background reading, see DevOps Daily’s [Deployments and ReplicaSets](/guides/introduction-to-kubernetes/04-deployments-and-replicasets) and [Services and Networking](/guides/introduction-to-kubernetes/05-services-and-networking). For precise lifecycle behavior, consult the [Kubernetes termination documentation](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination-flow) and [ALB troubleshooting documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-502-issues).
