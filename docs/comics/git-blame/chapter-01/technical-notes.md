# Chapter 1 — engineering review and source audit

9 October 2026 · Supports the Phase 3 storyboard; not a runtime validation report

## Fixed fictional scenario

ShipIt runs `checkout-api` on EKS, with AWS ALB IP targets managed by AWS Load Balancer Controller. The illustrated path is client → ALB → Pod IP → Node.js 22 HTTP server, using HTTP/1.1. The Kubernetes Service and Ingress configure routing/target membership; they are not an extra proxy hop on this chosen ALB data path. The depicted process has no sidecars or upgraded WebSocket/HTTP2 connections.

Replacement admission is already checked, including ALB target readiness. A small receipt-wording edit starts a rollout, exposing an existing SIGTERM handler that exits immediately. A selected request was already running on an old Pod. When its application exits before a complete response, the backend connection closes while the ALB is awaiting the reply; the client receives a 502. This is the chapter’s specific mechanism. Many other ALB 502 causes exist, so the team correlates request and target evidence rather than concluding “termination” from the status code alone.

No request is transferred to a replacement pod. A database operation may have committed even when its HTTP response is lost. Do not depict retrying checkout as intrinsically safe.

## Timeline to draw

The following is a causal diagram, not a strict ordering guarantee among distributed events:

1. A request starts on an old target. That target is still alive and capable of serving it.
2. A rolling release makes the old Pod eligible for retirement. Kubernetes termination work and routing/endpoint updates proceed asynchronously.
3. In the faulty version, the process receives SIGTERM and exits without completing the response. The ALB has an outstanding backend request, so its failed response is visible to the client.
4. Replacement readiness and target health do not repair that already-interrupted request.

The illustration may show an old target in the process of retirement and a healthy replacement. It must not show routine new traffic deliberately routed to an effectively deregistered target. Before withdrawal is effective, propagation can leave residual traffic; after effective ALB deregistration, the relevant work is draining requests/connections already in flight.

Do not make the story hinge on whether the old target’s displayed state is already `draining`. Actual process-exit and controller/API timing vary. Use the request’s start, incomplete response and exit evidence; draining is the coordination problem, not an invented clock sequence.

## The durable fix

Make the application’s stop handling idempotent and bounded. Confirm that the real Node process receives the intended stop signal, with an exec-style entrypoint or a supported signal-forwarding init. SIGTERM is the selected container stop signal in this scenario; other configured signals would require corresponding handling.

Separate a traffic-withdrawal phase from finishing accepted work. Keep the process capable of responding while the configured withdrawal/propagation allowance runs. Then stop accepting new connections, await active responses and relevant application work, and close dependencies after that work completes. Preserve a deadline for stuck work and record forced shutdowns rather than waiting forever.

For Node.js 22 HTTP/1.1, `server.close()` stops accepting new connections and closes idle connections; active requests can finish. `server.closeAllConnections()` forcibly closes active connections as well and is not the normal first step for graceful request completion. Framework-specific behavior still needs inspection. Server shutdown alone does not automatically await every database transaction or detached job. This story does not make claims about upgraded sockets or every possible protocol.

A supported `preStop` phase can provide a **measured allowance** for withdrawal while the server remains alive. In the normal nonzero-grace path, the hook runs before the runtime sends the stop signal. The grace countdown already includes hook execution. Readiness changes and controller reconciliation are not synchronous acknowledgements that every traffic source has stopped.

The story may use a bounded delay in that hook as one part of its tested configuration. It does not prescribe a universal sleep duration, wait out an entire target-group status display, or imply that a sleep completes active application work. The application handler still has to drain requests. The small Kubernetes extension for an over-running hook is not a reliability budget.

Choose an application deadline that can cover the remaining bounded accepted work, and an ALB deregistration allowance that covers relevant outstanding requests. The Pod budget must cover withdrawal/hook time, application completion/cleanup and a margin. These are related deadlines, not identical settings. At grace expiry, remaining processes may receive SIGKILL. A graceful design is not a promise to complete arbitrarily long or stuck work.

For this scenario, Service `publishNotReadyAddresses` is false. Terminating EndpointSlices normally expose `ready: false`, plus termination/serving conditions. Consumers have their own behavior; those endpoint signals do not finish an HTTP response or turn ALB control-plane propagation into a synchronous barrier. ALB IP-target readiness gates address replacement admission, which is a separate part of the rollout.

## Mitigation and first corrected production release

Maya pauses further rollout progression and verifies that healthy capacity continues serving. Pause does not revive already-terminated Pods or cancel all work already started. A rollback or alternate traffic action is available if needed; blindly launching another rollout would recreate the faulty departure path.

**The fixed handler only exists in newly started corrected Pods.** The first corrective release therefore uses a controlled cutover: create a temporary parallel corrected Deployment and controller-managed ALB target group, verify healthy capacity, shift new traffic to it, keep old processes and their targets alive until observed withdrawal and in-flight work complete, then retire them. Both app versions use compatible unchanged runtime configuration and database schema. Platform/controller-owned routing changes avoid an untracked manual target-group edit that the controller might undo.

Do not declare the old targets safe to kill merely because a timer elapsed or the new target is green. Use app/request evidence and target state; respect a bounded failure/mitigation plan if drain evidence cannot be obtained. The technical story establishes this release operation, not a new permanent traffic layer or a magical ability to patch old Pods in place.

After the corrected version is in service, ordinary rolling shutdown is exercised in representative tests. The temporary cutover resources have an owner and a removal step; the platform remains ALB → checkout Pods. This is story continuity, not an actual environment operation performed here.

## What the team tests in the story

In a representative test environment, overlap repeated corrected-version rollouts with normal HTTP requests, a deliberately slow but bounded request and connection reuse. Verify complete responses from clients, correlate request IDs with app finish/exit logs and ALB target events, and observe whether failures cluster during retirement. Check a deliberately overlong/stuck request separately to confirm bounded forced-timeout behavior. Verify replacement admission and ALB target health as their own check.

Then observe the controlled corrected production cutover with stable capacity and a prepared mitigation. A flat graph supports recovery; it is not proof that every protocol or future workload is safe. The displayed claim is “no shutdown-related failures observed in these tests,” never a universal zero-downtime guarantee.

These are **fictional narrative test results**. No ShipIt service, Kubernetes cluster, AWS rollout or production load test was run during Phase 3. Verification here consists of source review, scenario consistency and checks on storyboard/reference data.

## Sources inspected

| Source | Checked detail | Evidence and limitation |
| --- | --- | --- |
| [Kubernetes Pod lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination-flow) | Hook/signal order, shared grace budget, endpoint termination, forced shutdown | Official website source inspected through [GitHub](https://github.com/kubernetes/website/blob/main/content/en/docs/concepts/workloads/pods/pod-lifecycle.md) on 9 October 2026; repository main observed at `e96866675691ab050bc2f5dffc19f21f9fc8c646` |
| [Kubernetes EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/#conditions) | Ready, serving and terminating conditions; consumer behavior and publishNotReadyAddresses exception | Official website source inspected via the same Kubernetes website repository |
| [AWS Load Balancer Controller readiness gates](https://kubernetes-sigs.github.io/aws-load-balancer-controller/latest/deploy/pod_readiness_gate/) | IP-target admission and the difference between Pod startup and ALB target health | Official controller [source document](https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/main/docs/deploy/pod_readiness_gate.md) inspected; main observed at `c27ac737a5f7c6ce5f7e62e724bf8b361b45f7a0` |
| [Node.js 22 HTTP](https://nodejs.org/docs/latest-v22.x/api/http.html#serverclosecallback) | server.close, idle connections, forceful closeAllConnections | Live official v22 docs retrieved; page identified itself as v22.23.3 |
| [ALB troubleshooting](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-502-issues) | An outstanding request whose backend connection closes can produce a 502 | Official AWS GitHub [archived source](https://github.com/awsdocs/elb-application-load-balancers-user-guide/blob/master/doc_source/load-balancer-troubleshooting.md) inspected |
| [ALB target-group attributes](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-target-group-attributes.html) | Deregistration/draining behavior; a displayed draining state need not mean outstanding work remains | Official AWS GitHub [archived source](https://github.com/awsdocs/elb-application-load-balancers-user-guide/blob/master/doc_source/load-balancer-target-groups.md) inspected |

**AWS source limitation:** live `docs.aws.amazon.com` requests returned a proxy CONNECT 403 in this environment. The AWS repository explicitly says it was archived in 2023 and its content is out of date. The live AWS pages are canonical reading links, not pages claimed to have been successfully inspected. Avoid basing new feature/default-value claims on that archive. Recheck the described ALB behavior and any final timing settings against live AWS documentation before artwork-proof approval or publication; `docs.aws.amazon.com` is the required network destination. No TLS verification was disabled.

This storyboard does not depend on an archived numeric default or a prescribed current timeout value. Controller version, cluster settings and actual shutdown implementation remain prerequisites for a real deployment reproduction.
