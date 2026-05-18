---
title: 'Distributed Tracing with OpenTelemetry: From Instrumentation to Visualization'
excerpt: 'A walkthrough of instrumenting a real service with OpenTelemetry, running the Collector, and finding the slow span in Jaeger when a request hops across five microservices.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-05-11'
publishedAt: '2026-05-11T09:00:00Z'
updatedAt: '2026-05-11T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - opentelemetry
  - distributed-tracing
  - observability
  - devops
  - jaeger
  - monitoring
---

A customer complains the checkout page is slow. You check the frontend logs. Nothing useful. You check the API gateway logs. The request took 4.2 seconds. You check the order service. It says the request took 180 milliseconds. You check the payment service. It says it never received the request. You check the database. Everything looks fine.

Now you have a problem. The 4 seconds happened somewhere between the gateway and the order service, but you have five services, two message queues, and a Redis cache in that path. Logs alone will not save you here.

This is what distributed tracing fixes. Instead of stitching together unrelated log lines, you get one timeline that follows a single request through every service it touches. OpenTelemetry is the vendor-neutral way to produce those traces. This post walks through instrumenting a Python service, running the OpenTelemetry Collector, and getting traces into Jaeger so you can actually see where the time went.

## TLDR

- Install the OpenTelemetry SDK and auto-instrumentation for your framework.
- Set `OTEL_EXPORTER_OTLP_ENDPOINT` to point at a Collector.
- Run the Collector with an OTLP receiver and a Jaeger or Tempo exporter.
- Open Jaeger, find the trace, and read the timeline. The fat span is the problem.

## Prerequisites

- Python 3.10+ or Node.js 18+ (the examples use Python with Flask, the concepts translate)
- Docker and Docker Compose
- A basic microservice you can poke at, or follow along with the demo below
- Port 4317 (OTLP gRPC), 4318 (OTLP HTTP), and 16686 (Jaeger UI) free locally

## What a Trace Actually Is

A **trace** is a tree of **spans**. A span is one unit of work with a start time, duration, attributes, and a parent. Every span in a trace shares a trace ID. The root span is the first thing that received the request. Every child span sits underneath it.

```text
Trace abc123 (4.2s)
├── gateway: POST /checkout         [4.2s]
│   ├── auth: validate-token        [12ms]
│   └── orders: create-order        [4.1s]   <-- where the time went
│       ├── db: INSERT orders       [8ms]
│       └── payments: charge-card   [4.0s]   <-- and here
│           └── http: stripe API    [3.9s]   <-- the real culprit
```

That right column is what you need. Logs cannot tell you that 3.9 seconds of a 4.2-second request was waiting on the Stripe API. A trace can.

## Step 1: Instrument a Python Service

Start with a Flask service that calls a downstream service. Install the SDK plus the auto-instrumentations:

```bash
pip install opentelemetry-distro \
            opentelemetry-exporter-otlp \
            opentelemetry-instrumentation-flask \
            opentelemetry-instrumentation-requests

opentelemetry-bootstrap -a install
```

The `opentelemetry-bootstrap` command scans your installed packages and pulls in matching instrumentations. If you have `psycopg2` or `redis-py` installed, it installs those instrumentations too.

Here is the service. It is deliberately small so you can see what is going on:

```python
# app.py
from flask import Flask, jsonify
import requests
from opentelemetry import trace

app = Flask(__name__)
tracer = trace.get_tracer(__name__)

@app.route("/checkout")
def checkout():
    with tracer.start_as_current_span("validate-cart") as span:
        span.set_attribute("cart.items", 3)
        # pretend work
        total = 42.00

    with tracer.start_as_current_span("charge"):
        r = requests.post(
            "http://payments:8000/charge",
            json={"amount": total},
            timeout=5,
        )
        r.raise_for_status()

    return jsonify(status="ok", total=total)
```

You did not write any tracer setup. Flask and the `requests` library are auto-instrumented, so the HTTP entry point and the outbound HTTP call already create spans. The two manual spans add business context (`validate-cart`, `charge`) so the timeline reads in your language, not the framework's.

Run it with the OpenTelemetry wrapper:

```bash
export OTEL_SERVICE_NAME=checkout-service
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_TRACES_EXPORTER=otlp

opentelemetry-instrument flask run --port 8000
```

`OTEL_SERVICE_NAME` is the one variable people forget. Without it, every service shows up as `unknown_service` in Jaeger and your traces look like spaghetti.

## Step 2: Run the OpenTelemetry Collector

You could send traces directly from the app to Jaeger. Do not do that in any environment you care about. The Collector sits between your apps and your backend and gives you:

- A single place to swap backends without redeploying apps
- Batching and retry, so a backend outage does not crash your app
- Sampling, so you do not pay to store every trace
- Attribute filtering, so PII does not leak into your tracing backend

Here is a Collector config that accepts OTLP and exports to Jaeger:

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024
  memory_limiter:
    check_interval: 1s
    limit_mib: 512

exporters:
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true
  debug:
    verbosity: basic

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/jaeger, debug]
```

The `memory_limiter` processor matters. Without it, a traffic spike on a slow backend will OOM your Collector and you lose every span in flight.

## Step 3: A Compose File That Ties It Together

```yaml
# docker-compose.yml
services:
  jaeger:
    image: jaegertracing/all-in-one:1.62
    ports:
      - "16686:16686"   # UI
      - "4317"          # OTLP gRPC (internal)
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.113.0
    command: ["--config=/etc/otel-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-config.yaml
    ports:
      - "4317:4317"
      - "4318:4318"
    depends_on:
      - jaeger

  checkout:
    build: ./checkout
    environment:
      - OTEL_SERVICE_NAME=checkout-service
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
    ports:
      - "8000:8000"
    depends_on:
      - otel-collector

  payments:
    build: ./payments
    environment:
      - OTEL_SERVICE_NAME=payments-service
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
    depends_on:
      - otel-collector
```

Bring it up and hit the endpoint:

```bash
docker compose up -d
curl -X POST http://localhost:8000/checkout
```

In the Collector logs you should see something like:

```text
2026-05-11T09:14:22.117Z  info  TracesExporter  {"kind": "exporter",
  "data_type": "traces", "name": "otlp/jaeger", "resource spans": 1,
  "spans": 4}
```

Four spans for one request: the Flask entry, the two manual spans (`validate-cart`, `charge`), and the outbound `requests` call. Open `http://localhost:16686`, pick `checkout-service`, and the trace is there.

## Step 4: Reading the Trace

This is the part nobody teaches and it is the only part that matters. A trace view in Jaeger looks like a waterfall. Each row is a span. The bar's width is duration. The bar's position is when it started.

When you open a slow trace, look for:

1. **The fattest bar that has no children.** That is a leaf operation that took real time. Usually a database query, an HTTP call, or a `sleep`.
2. **Gaps.** A 200ms span where nothing visible is happening means you have uninstrumented code. Add a manual span there.
3. **Sequential spans that could be parallel.** Three 100ms calls in a row are 300ms. The same three calls in parallel are 100ms.
4. **Spans with a red icon.** That is `status_code=ERROR`. Click and read the `exception.message` attribute.

If the slow span is an HTTP call, the trace will usually include the downstream service's spans too, because trace context propagates through HTTP headers. If it does not, you have a propagation problem. Check that both services share the same Collector and that the client side library (here, `requests`) is auto-instrumented.

## Sampling: You Cannot Keep Everything

At any non-trivial scale, you cannot store every trace. The default is to sample everything in dev and use **tail-based sampling** in prod. Tail-based sampling decides whether to keep a trace after it finishes, so you can keep the slow ones and the error ones and drop the boring ones.

The Collector ships a tail sampling processor:

```yaml
processors:
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors
        type: status_code
        status_code:
          status_codes: [ERROR]
      - name: slow-requests
        type: latency
        latency:
          threshold_ms: 1000
      - name: baseline
        type: probabilistic
        probabilistic:
          sampling_percentage: 1
```

This keeps every error, every request slower than one second, and a 1% sample of the rest. That gives you enough volume to spot patterns without buying a second house for your observability vendor.

Wire it into the pipeline:

```yaml
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, tail_sampling, batch]
      exporters: [otlp/jaeger]
```

## Things That Will Bite You

A few real-world snags worth knowing before you hit them in production:

- **Context not propagating across queues.** Kafka, RabbitMQ, and SQS need extra work. The instrumentation libraries inject trace context into message headers, but only if both producer and consumer are instrumented and the broker preserves headers. Old SQS clients silently drop them.
- **Async code in Python.** If you use `asyncio` and your spans look detached from their parent, you are probably starting spans outside the active context. Use `tracer.start_as_current_span` inside the coroutine, not before awaiting it.
- **Cardinality on attributes.** Do not put a user ID or a full URL with query string as a span attribute. Use the route template (`/users/{id}`) instead. High-cardinality attributes blow up the backend's index.
- **Clock skew between hosts.** If a child span starts before its parent according to timestamps, that is clock drift, not a bug. Run NTP.

## Next Steps

Now that you have one service traced, here is what to do next, in order:

1. **Instrument the next service in the same request path.** Tracing is most useful when more than one service emits spans for the same request. Two is better than one. Five is better than two.
2. **Add manual spans for business logic.** Auto-instrumentation gives you HTTP and DB spans. Add spans named after what the code actually does (`apply-discount`, `reserve-inventory`). Those are the names you will search for at 3 AM.
3. **Set up alerts on trace data.** Most backends can alert on `p95(duration) > 2s for route=/checkout`. That is far more useful than CPU alerts.
4. **Add resource attributes.** `deployment.environment`, `service.version`, and `k8s.pod.name` make traces useful for incident response. Set them via `OTEL_RESOURCE_ATTRIBUTES`.
5. **Pick a long-term backend.** Jaeger all-in-one is great for local. For production, look at Tempo, Honeycomb, or a managed Jaeger. The Collector config stays the same. You only swap the exporter.

The moment you have two services in one trace and you can see exactly where the latency lives, the value of distributed tracing clicks. Before that, it feels like a chore. After that, you will not go back.
