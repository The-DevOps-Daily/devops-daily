---
title: 'Designing Rate Limiting for APIs: Algorithms, Patterns, and Implementation'
excerpt: 'A practical comparison of token bucket, leaky bucket, fixed window, and sliding window rate limiting, with copy-paste Redis and FastAPI code, nginx config, and guidance on which one to actually use.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-08'
publishedAt: '2026-06-08T09:00:00Z'
updatedAt: '2026-06-08T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - api-design
  - rate-limiting
  - backend
  - redis
  - nginx
  - devops
---

At 2am a single customer's cron job got stuck in a retry loop with no backoff. One API key started sending around 8,000 requests per second. Within ninety seconds the database connection pool was saturated, every other customer was getting timeouts, and the on-call engineer was staring at a dashboard that was all red. There was no rate limiting on that endpoint. One misbehaving client took down the API for everyone.

If you run any public or shared API, this is not a hypothetical. The fix is rate limiting, and the hard part is not the idea, it is picking the right algorithm and implementing it so it actually holds up behind a load balancer.

This post compares the four rate limiting algorithms you will actually see in production (fixed window, sliding window, token bucket, leaky bucket), shows you working code you can copy, and gives you a straight answer on which one to use.

## TLDR

- **Token bucket** is the right default for most public APIs. It allows controlled bursts and is cheap to run in Redis.
- **Sliding window counter** is the best choice when you want accurate limits without the boundary-burst problem of fixed windows.
- **Fixed window** is the simplest and cheapest, but it lets a client send up to 2x your limit across a window boundary. Fine for rough internal limits, bad for billing or abuse control.
- **Leaky bucket** smooths bursty input into a constant output rate. Use it when a downstream system can only handle a fixed throughput, not when you want to allow bursts.
- Do the counting in a shared store (Redis) with an atomic operation. In-memory counters break the moment you run more than one instance.
- Return `429 Too Many Requests` with a `Retry-After` header. Decide up front whether you fail open or fail closed when Redis is down.

## Prerequisites

- A running API service (the examples use Python and FastAPI, but the logic ports to any language)
- Redis 6 or newer reachable from your service, for distributed counting
- Basic familiarity with HTTP status codes and headers
- `redis-py` installed (`pip install redis`) if you want to run the Python examples

## Why in-memory counters fail first

Before the algorithms, the trap everyone hits. The naive version looks like this:

```python
# DO NOT use this in production
from collections import defaultdict
import time

counters = defaultdict(list)

def allow(client_id, limit=100, window=60):
    now = time.time()
    counters[client_id] = [t for t in counters[client_id] if t > now - window]
    if len(counters[client_id]) >= limit:
        return False
    counters[client_id].append(now)
    return True
```

This works on your laptop and fails in production for one reason: the counter lives in the memory of a single process. Run three replicas behind a load balancer and each one tracks its own count, so your "100 requests per minute" limit becomes 300. Restart a pod and the counter resets. Autoscale to ten pods and the limit is meaningless.

Rate limiting state has to live somewhere shared and the check has to be atomic. That is why every serious example below uses Redis.

## The four algorithms

### Fixed window counter

Count requests in a fixed time block (say, per calendar minute). When the clock ticks over to the next minute, the count resets to zero.

```python
def fixed_window(redis, key, limit, window):
    count = redis.incr(key)
    if count == 1:
        # first request in this window, set the expiry
        redis.expire(key, window)
    return count <= limit
```

It is fast, uses almost no memory (one integer per client), and is trivial to reason about. The problem is the boundary. A client can send `limit` requests in the last second of one window and another `limit` in the first second of the next:

```text
window 1 (00:00-00:59)                window 2 (01:00-01:59)
                          |<- 1 second ->|
            100 reqs at 00:59.5    100 reqs at 01:00.2
            = 200 requests in ~0.7 seconds
```

For a limit that maps to real cost (database load, a paid quota), that 2x burst is a real bug. Use fixed window only for rough limits where the occasional double burst does not hurt you.

### Sliding window log

Keep a timestamp for every request and count how many fall inside the trailing window. This is exact, no boundary problem, but you store one entry per request. A client at 1,000 requests per minute means 1,000 timestamps in memory per client. That cost adds up fast across many clients, so reserve the sliding log for low-volume endpoints where precision matters (think a "5 password resets per hour" rule).

### Sliding window counter

The practical middle ground. Keep a counter per fixed window, then estimate the rolling count by weighting the previous window by how much of it still overlaps the trailing period.

```python
import time

def sliding_window(redis, key, limit, window):
    now = time.time()
    current = int(now // window)
    previous = current - 1
    # how far we are into the current window, as a fraction
    elapsed = (now % window) / window

    cur_count = int(redis.get(f"{key}:{current}") or 0)
    prev_count = int(redis.get(f"{key}:{previous}") or 0)

    # weighted estimate of requests in the trailing window
    estimated = prev_count * (1 - elapsed) + cur_count
    if estimated >= limit:
        return False

    pipe = redis.pipeline()
    pipe.incr(f"{key}:{current}")
    pipe.expire(f"{key}:{current}", window * 2)
    pipe.execute()
    return True
```

This gives you accuracy very close to a true sliding window at the cost of two integers per client. It smooths out the boundary burst because the previous window's count still pulls weight right after the rollover. This is a solid default if token bucket does not fit your mental model.

### Token bucket

Picture a bucket that holds tokens. Every request takes one token. Tokens refill at a steady rate up to a maximum capacity. If the bucket is empty, the request is rejected.

```text
        refill at 10 tokens/sec
                 |
                 v
        +------------------+
        |  tokens: 73/100  |   capacity = 100 (max burst)
        +------------------+
                 |
          1 token per request
                 v
            request allowed
```

The capacity controls how big a burst you allow; the refill rate controls the sustained throughput. A client that has been quiet can spend its full bucket at once (a burst), then is held to the refill rate. This matches how people actually use APIs, which is why most public APIs (Stripe, GitHub, AWS) use token bucket or a close variant.

The catch is that refill and spend have to be atomic, or two concurrent requests can both read the same token count and both spend it. Do it in a single Redis Lua script so the whole read-refill-spend cycle runs without interruption:

```lua
-- token_bucket.lua
-- KEYS[1] = bucket key
-- ARGV[1] = capacity
-- ARGV[2] = refill rate (tokens per second)
-- ARGV[3] = current time (seconds, with fraction)
-- ARGV[4] = tokens requested (cost)
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local bucket = redis.call('HMGET', KEYS[1], 'tokens', 'last')
local tokens = tonumber(bucket[1])
local last = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  last = now
end

-- refill based on time elapsed since the last request
local elapsed = math.max(0, now - last)
tokens = math.min(capacity, tokens + elapsed * refill_rate)

local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end

redis.call('HMSET', KEYS[1], 'tokens', tokens, 'last', now)
-- expire idle buckets so Redis does not fill up with stale keys
redis.call('EXPIRE', KEYS[1], math.ceil(capacity / refill_rate) * 2)

return { allowed, tokens }
```

Load it once and call it per request:

```python
import time
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

with open("token_bucket.lua") as f:
    take_token = r.register_script(f.read())

def allow(key, capacity=100, refill_rate=10, cost=1):
    allowed, remaining = take_token(
        keys=[key],
        args=[capacity, refill_rate, time.time(), cost],
    )
    return bool(allowed), int(remaining)
```

### Leaky bucket

A leaky bucket is a queue that drains at a constant rate. Requests pour in (possibly in bursts), sit in the queue, and leave at a fixed pace. If the queue is full, new requests are dropped.

```text
   bursty requests in
        | | |  |
        v v v  v
     +-----------+
     |  queue    |   drops when full
     +-----------+
           |
      constant drain (e.g. 10 req/sec)
           v
      to downstream
```

The difference from token bucket matters. Token bucket allows a burst to pass through immediately as long as it has tokens. Leaky bucket never lets the output exceed the drain rate, no matter what. Use leaky bucket when the thing behind your API can only handle a steady throughput, for example a legacy system or a third-party API with a hard ceiling. If you want to allow bursts, use token bucket instead.

## Which one should you use?

| Algorithm | Allows bursts | Memory per client | Accuracy | Use when |
| --- | --- | --- | --- | --- |
| Fixed window | At the boundary (bad) | 1 integer | Low | Rough internal limits |
| Sliding window log | No | 1 entry per request | Exact | Low-volume, precise rules |
| Sliding window counter | Smoothed | 2 integers | High | General-purpose default |
| Token bucket | Yes, up to capacity | small hash | High | Public APIs, most cases |
| Leaky bucket | No | queue | High | Protecting a fixed-rate downstream |

If you are not sure, use **token bucket**. It handles real traffic well, the burst behavior is intuitive, and the Redis implementation above is production-ready. Reach for the sliding window counter if "X requests per minute" is easier to explain to your customers than a bucket.

## Wiring it into your API

Here is the token bucket as FastAPI middleware. It keys off the client IP, but in production you should key off the API key or authenticated user ID so a shared NAT does not punish everyone behind it.

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.middleware("http")
async def rate_limit(request: Request, call_next):
    client_key = request.headers.get("x-api-key") or request.client.host
    key = f"rl:{client_key}"

    try:
        allowed, remaining = allow(key, capacity=100, refill_rate=10)
    except redis.RedisError:
        # fail open: if Redis is down, let traffic through rather than
        # taking the whole API offline. See the note below.
        return await call_next(request)

    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"error": "rate limit exceeded", "retry_after": 1},
            headers={
                "Retry-After": "1",
                "X-RateLimit-Limit": "100",
                "X-RateLimit-Remaining": "0",
            },
        )

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = "100"
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    return response
```

Send back the standard headers. Clients use `X-RateLimit-Remaining` to slow themselves down before they hit the wall, and `Retry-After` tells a well-behaved client exactly how long to wait. Skipping these turns every client into a blind retry machine, which is the opposite of what you want.

### Fail open or fail closed?

When Redis is unreachable, you have two choices and you must pick deliberately:

- **Fail open** (allow the request): the right default for general traffic. A Redis blip should not take your whole API down. The example above does this.
- **Fail closed** (reject the request): the right call for login, password reset, and payment endpoints, where letting traffic through unmetered is worse than a brief outage.

Do not leave this to chance. An unhandled Redis exception that bubbles up as a 500 is the worst of both worlds.

## Do it at the edge when you can

If all you need is a flat limit per IP, do not write code at all. Put it in nginx in front of your service:

```nginx
# define a shared memory zone keyed by client IP, 10 req/sec
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    location /api/ {
        # allow short bursts of 20, no artificial delay on them
        limit_req zone=api burst=20 nodelay;
        limit_req_status 429;
        proxy_pass http://backend;
    }
}
```

nginx's `limit_req` is a leaky bucket under the hood. This stops abusive traffic before it ever reaches your application, which is exactly where you want to drop it. Use the application-level Redis approach when you need per-user limits, different tiers, or limits that depend on the request body. Use both together for defense in depth.

## Seeing it work

Fire a quick loop at the endpoint and watch the limit kick in:

```text
$ for i in $(seq 1 12); do \
    curl -s -o /dev/null -w "%{http_code} " http://localhost:8000/api/data; \
  done
200 200 200 200 200 200 200 200 200 200 429 429
```

The full response on a rejected request:

```text
$ curl -i http://localhost:8000/api/data
HTTP/1.1 429 Too Many Requests
content-type: application/json
retry-after: 1
x-ratelimit-limit: 100
x-ratelimit-remaining: 0

{"error":"rate limit exceeded","retry_after":1}
```

And the bucket state itself, straight from Redis:

```text
$ redis-cli HGETALL rl:203.0.113.45
1) "tokens"
2) "0"
3) "last"
4) "1717840800.123"
```

Tokens at zero, last access timestamped. Wait a second and the Lua script refills 10 tokens on the next request.

## Next steps

- Add the token bucket Lua script and FastAPI middleware to one endpoint, key it off the API key, and load test it with `hey -z 30s -c 50 http://localhost:8000/api/data` to confirm the 429s show up where you expect.
- Set your `capacity` and `refill_rate` from real traffic, not guesses. Pull your p99 requests-per-second per client from logs and set the sustained rate a bit above that, with capacity for a 5 to 10 second burst.
- Pick fail-open or fail-closed per endpoint group and write it into the code, not a wiki page.
- Add `X-RateLimit-*` headers to every response and document them so client teams can back off gracefully.
- Put a flat per-IP `limit_req` in nginx as a cheap outer wall, even if you already limit per user in the app.
- Alert on your 429 rate. A sudden spike means either an abusive client or a limit set too low for legitimate traffic, and you want to know which before the support tickets arrive.
