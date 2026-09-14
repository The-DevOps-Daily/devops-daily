---
title: 'Your Trace Dies the Moment the Pipeline Shells Out'
excerpt: 'OpenTelemetry has a Release Candidate spec for passing trace context through environment variables, which is how you connect a CI run to the build tool it spawns. Two runnable demos: one showing four orphaned traces becoming one, and one showing why BAGGAGE across a trust boundary is the part worth arguing about.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-09-14'
publishedAt: '2026-09-14T09:00:00Z'
updatedAt: '2026-09-14T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - OpenTelemetry
  - CI/CD
  - Observability
  - Tracing
  - DevOps
---

You instrumented the services. A request comes in at the edge, crosses four of them, hits the database, and the whole thing is one trace with one trace ID. It works, and it changed how your team debugs.

Then you point the same tooling at CI, and it falls apart immediately. The runner emits a span. The shell script it launches emits a span. The build tool emits spans for each module, and the test harness emits one per suite. None of them share a trace ID, because nothing crossed a network boundary and there was nowhere to put a header.

On 11 September 2026 OpenTelemetry moved its answer to this into Release Candidate: a specification for carrying trace context in **environment variables**. The feedback window runs until at least 2 November, and stabilisation needs 14 days with no new issues, so there is a real window to argue with it.

This post shows what it fixes, with code you can run, and then the part that deserves more scrutiny than it is getting.

## TLDR

- Trace context normally travels in HTTP headers. A process that starts another process has no headers, so the child starts a brand new trace.
- The RC standardises three environment variables: **`TRACEPARENT`**, **`TRACESTATE`** and **`BAGGAGE`**, using the same W3C values you already send over HTTP.
- For any other propagator, the normalisation rule is: uppercase the header name and replace unsupported characters with underscores. `x-b3-traceid` becomes **`X_B3_TRACEID`**.
- The demo below takes a pipeline from four disconnected traces to one, and the change is about eight lines.
- The hard part is not the plumbing. **An environment variable is inherited by every descendant process**, where an HTTP header stops at the handler that read it. That makes `BAGGAGE` a trust-boundary question, demonstrated in the second half.

## Prerequisites

- Python 3.9 or newer if you want to run the examples.
- Two packages, `opentelemetry-api` and `opentelemetry-sdk`. No collector, no backend, no cloud account.
- Familiarity with the idea of a trace ID and a parent span. You do not need to know the W3C spec by heart.

## Setting up

```bash
python3 -m venv venv && ./venv/bin/pip install opentelemetry-api opentelemetry-sdk
```

The examples were run with `opentelemetry` 1.44.0.

## The problem, measured

Here is a runner that starts three build steps as child processes. Each step is a separate OS process that starts its own span:

```python
# pipeline.py
with tracer.start_as_current_span("ci-run") as run:
    for step in ("checkout", "compile", "test"):
        subprocess.run([PY, "child.py", step], env=env, check=True)
```

And the step, which knows nothing about who started it:

```python
# child.py
with tracer.start_as_current_span(sys.argv[1]) as span:
    ...
```

Run it, and print each span's trace ID and parent:

```terminal
{
  "title": "four steps, four traces",
  "prompt": "$",
  "steps": [
    { "comment": "no context crosses the process boundary" },
    { "cmd": "./venv/bin/python pipeline.py", "output": "  ci-run       trace=eaac768396ad8b9f9710ca8879c89856  parent=none\n  checkout     trace=680b4b55ea4b58913d36705678b4c225  parent=none\n  compile      trace=50cde5559d03da4a5ac05689fef4cd14  parent=none\n  test         trace=d1c1afe1f6dfd0bc3152a372a1ee71c1  parent=none" }
  ]
}
```

Four spans, four trace IDs, no parents. In a tracing backend this is four unrelated single-span traces, and the one question you wanted to ask, why was this run slow, has no answer because there is no run. There is a runner, and three strangers.

Note that this is not a bug in anything. Every one of those processes did exactly what it was told. The context had no way to travel.

## The fix

The whole proposal is that the child builds a carrier out of its environment and hands it to the propagator it already has:

```python
# child.py
carrier = {}
if "TRACEPARENT" in os.environ:
    carrier["traceparent"] = os.environ["TRACEPARENT"]
if "TRACESTATE" in os.environ:
    carrier["tracestate"] = os.environ["TRACESTATE"]

ctx = TraceContextTextMapPropagator().extract(carrier)

with tracer.start_as_current_span(sys.argv[1], context=ctx) as span:
    ...
```

And the parent injects into the environment it passes down, applying the normalisation rule:

```python
# pipeline.py
carrier = {}
TraceContextTextMapPropagator().inject(carrier)
for k, v in carrier.items():
    # inject() writes lowercase header names; the spec uppercases them and
    # replaces unsupported characters with "_".
    env[k.upper().replace("-", "_")] = v
```

That is it. Same propagator, same W3C value, different transport:

```terminal
{
  "title": "one run, one trace",
  "prompt": "$",
  "steps": [
    { "comment": "TRACEPARENT is set in the child's environment" },
    { "cmd": "./venv/bin/python pipeline.py --propagate", "output": "  ci-run       trace=a2e1d8ca4986fbb561fdb1885235d503  parent=none\n  checkout     trace=a2e1d8ca4986fbb561fdb1885235d503  parent=6ab194ae396427b0\n  compile      trace=a2e1d8ca4986fbb561fdb1885235d503  parent=6ab194ae396427b0\n  test         trace=a2e1d8ca4986fbb561fdb1885235d503  parent=6ab194ae396427b0" }
  ]
}
```

One trace ID across all four spans, and the three steps now name the runner as their parent. The value in `TRACEPARENT` is the ordinary W3C one:

```text
TRACEPARENT=00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

Version, trace ID, span ID, flags. Nothing new to learn, which is the point of doing it this way rather than inventing a format.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "runner", "sub": "starts the span", "icon": "rocket", "tone": "blue" },
    { "label": "env", "sub": "TRACEPARENT", "icon": "gear", "tone": "amber" },
    { "label": "shell", "sub": "inherits it", "icon": "box", "tone": "slate" },
    { "label": "build tool", "sub": "extracts, continues", "icon": "cpu", "tone": "green" }
  ]
}
```

## Where this already exists

None of this is theoretical, which is part of why it is being standardised now rather than proposed from scratch. The blog post announcing the RC points at implementations that have been doing it their own way for years: `otel-cli` for creating spans from a shell, Thoth for shell instrumentation, the Jenkins OpenTelemetry plugin, and community work around Argo Workflows.

That is the usual shape of a good specification. Several people solved the same problem, slightly differently, and the spec is an attempt to make those solutions interoperate rather than to invent a new one. It also means the risk of adopting it is lower than the Release Candidate label suggests.

## The part worth arguing about

The project is explicitly asking for feedback on security and trust boundaries, and this is where a pipeline differs from a web request in a way that matters.

**An HTTP header stops.** It arrives, a handler reads it, and if that handler makes another call it decides what to forward. **An environment variable does not stop.** It is inherited by every descendant process, forever, without anyone deciding anything.

In CI, some of those descendants are other people's code. A third-party action, a plugin, a build script pulled from a registry. They inherit your context automatically, and they can change it before the next step runs:

```terminal
{
  "title": "baggage crosses a boundary nobody checked",
  "prompt": "$",
  "steps": [
    { "comment": "a third-party step adds an entry, and it survives" },
    { "cmd": "./venv/bin/python baggage_step.py runner build.id=42 third-party-action user.role=admin billing-step -", "output": "  runner             sees {'build.id': '42'}\n  third-party-action sees {'build.id': '42', 'user.role': 'admin'}\n  billing-step       sees {'build.id': '42', 'user.role': 'admin'}" }
  ]
}
```

The billing step sees `user.role=admin` and has no way to tell that it came from an untrusted action rather than from the runner. `BAGGAGE` is a flat set of key/value pairs with no provenance: there is no field saying who wrote an entry or where it entered the pipeline.

Three consequences worth thinking about before you turn this on:

**Baggage becomes attacker-influenced input.** Most teams forward baggage entries into span attributes, because that is the whole reason to carry them. Those attributes then land in your telemetry backend, get indexed, and show up in dashboards. Anything that can set an environment variable in your pipeline can now write into that.

**Secrets leak downward, not upward.** The mirror image is worse. If you put anything sensitive in baggage, a tenant ID, an internal account reference, every descendant process gets it, including the ones you did not write. The spec's own example, `BAGGAGE=build.id=42,repository.name=example`, is deliberately boring, and that is good advice rather than a placeholder.

**Sampling decisions are inherited too.** The trailing `01` in `TRACEPARENT` is the sampled flag. A parent that samples everything hands that decision to every child, and in a pipeline that fans out to hundreds of test processes, the volume is not the same shape as one web request.

None of this makes the proposal wrong. It makes it a thing to configure deliberately: strip `BAGGAGE` at the boundary where untrusted code starts, decide explicitly whether to forward it, and treat inherited baggage as user input on the way into your backend.

## What to do this week

The feedback period is open now, which is the cheap moment to influence this.

- **Read the spec** and check it against your own pipeline shape. The project is specifically asking about CI/CD systems like GitHub Actions and Argo Workflows, batch tools, and command-line utilities.
- **Report problems against the stabilisation issue**, which is [#5040](https://github.com/open-telemetry/opentelemetry-specification/issues/5040) in the specification repository. Once it stabilises, the normalisation rules and the variable names are fixed for a long time.
- **Try the eight lines.** If you already have spans in CI, connecting them is an afternoon. Start with the propagation and leave baggage alone until you have decided who is allowed to write to it.
- **Check what your runner already sets.** If you use the Jenkins plugin or `otel-cli`, some of this may already be happening with names that will need to change.

## Summary

Trace context in environment variables is an unglamorous fix for a real gap. Distributed tracing was designed around network calls, and a large amount of what DevOps teams actually run is processes starting processes, where there is no call to hang a header on.

The mechanism is small enough to read in one sitting and to adopt in an afternoon. The question that deserves the remaining seven weeks of the feedback window is not whether `TRACEPARENT` should be an environment variable. It is what happens to `BAGGAGE` when it crosses into code you did not write, because unlike a header, nobody has to pass it on for it to keep travelling.
