---
title: 'Day 19 - Load Testing'
day: 19
excerpt: 'Perform load testing on your application to identify performance bottlenecks and capacity limits.'
description: 'Learn load testing fundamentals with k6, Apache Bench, and wrk to measure application performance under stress.'
publishedAt: '2025-12-19T00:00:00Z'
updatedAt: '2026-04-19T00:00:00Z'
difficulty: 'Intermediate'
category: 'Performance'
tags:
  - Load Testing
  - Performance
  - k6
  - Benchmarking
---

## Description

Your application works fine in development, but will it handle production traffic? Before you find out the hard way, run load tests to measure performance, identify bottlenecks, and determine capacity limits.

## Task

Perform load testing on a web application.

**Requirements:**
- Set up load testing tools
- Create realistic test scenarios
- Measure response times and throughput
- Identify performance bottlenecks
- Generate performance reports

## Target

- ✅ Load test successfully executed
- ✅ Performance metrics collected
- ✅ Bottlenecks identified
- ✅ Response time P95 < 500ms
- ✅ Error rate < 1%

## Sample App

### Application to Test

#### app.js

```javascript
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Simulate database queries with varying latency
const simulateDbQuery = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Fast endpoint
app.get('/fast', (req, res) => {
  res.json({ message: 'Fast response', timestamp: Date.now() });
});

// Slow endpoint (simulates database query)
app.get('/slow', async (req, res) => {
  await simulateDbQuery(500);
  res.json({ message: 'Slow response', timestamp: Date.now() });
});

// CPU intensive endpoint
app.get('/cpu', (req, res) => {
  let result = 0;
  for (let i = 0; i < 1000000; i++) {
    result += Math.sqrt(i);
  }
  res.json({ result, timestamp: Date.now() });
});

// Endpoint with random delays
app.get('/variable', async (req, res) => {
  const delay = Math.random() * 1000;
  await simulateDbQuery(delay);
  res.json({ delay, timestamp: Date.now() });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

## Solution

### 1. k6 Load Testing

#### basic-load-test.js

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestCount = new Counter('requests');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Ramp up to 100 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be below 1%
    errors: ['rate<0.1'],              // Custom error rate below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test fast endpoint
  let response = http.get(`${BASE_URL}/fast`);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  responseTime.add(response.timings.duration);
  requestCount.add(1);

  sleep(1);

  // Test slow endpoint
  response = http.get(`${BASE_URL}/slow`);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);

  sleep(1);

  // Test variable endpoint
  response = http.get(`${BASE_URL}/variable`);

  check(response, {
    'status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);
}
```

#### spike-test.js

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },    // Normal load
    { duration: '10s', target: 500 },   // Spike!
    { duration: '30s', target: 500 },   // Stay at spike
    { duration: '10s', target: 10 },    // Return to normal
    { duration: '10s', target: 0 },     // Ramp down
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const response = http.get(`${BASE_URL}/fast`);

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(0.1);
}
```

#### stress-test.js

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '3m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 400 },
    { duration: '1m', target: 0 },
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const response = http.get(`${BASE_URL}/cpu`);

  check(response, {
    'status is 200': (r) => r.status === 200,
  });
}
```

### 2. Apache Bench Tests

#### run-ab-tests.sh

```bash
#!/bin/bash

set -euo pipefail

URL="${1:-http://localhost:3000}"
REQUESTS=10000
CONCURRENCY=100

echo "=== Apache Bench Load Testing ==="
echo "URL: $URL"
echo "Requests: $REQUESTS"
echo "Concurrency: $CONCURRENCY"
echo ""

# Test fast endpoint
echo "Testing /fast endpoint..."
ab -n $REQUESTS -c $CONCURRENCY "$URL/fast" > ab-fast-results.txt

# Test slow endpoint
echo "Testing /slow endpoint..."
ab -n 1000 -c 10 "$URL/slow" > ab-slow-results.txt

# Display summary
echo ""
echo "=== Results Summary ==="
grep "Requests per second" ab-fast-results.txt
grep "Time per request" ab-fast-results.txt
grep "Failed requests" ab-fast-results.txt

echo ""
echo "Full results saved to:"
echo "- ab-fast-results.txt"
echo "- ab-slow-results.txt"
```

### 3. wrk Benchmark

#### wrk-test.lua

```lua
-- Load testing script for wrk

wrk.method = "GET"
wrk.headers["Content-Type"] = "application/json"

-- Track response times
response_times = {}
request_count = 0
error_count = 0

-- Called once per request
request = function()
  request_count = request_count + 1
  return wrk.format(nil, "/fast")
end

-- Called for each response
response = function(status, headers, body)
  if status ~= 200 then
    error_count = error_count + 1
  end
end

-- Called at end of test
done = function(summary, latency, requests)
  io.write("=====================================\n")
  io.write("Load Test Results\n")
  io.write("=====================================\n")
  io.write(string.format("Requests: %d\n", summary.requests))
  io.write(string.format("Duration: %.2fs\n", summary.duration / 1000000))
  io.write(string.format("Errors: %d (%.2f%%)\n", error_count, (error_count / request_count) * 100))
  io.write(string.format("Requests/sec: %.2f\n", summary.requests / (summary.duration / 1000000)))
  io.write("=====================================\n")
  io.write(string.format("Latency (ms)\n"))
  io.write(string.format("  Min:     %.2f\n", latency.min / 1000))
  io.write(string.format("  Max:     %.2f\n", latency.max / 1000))
  io.write(string.format("  Mean:    %.2f\n", latency.mean / 1000))
  io.write(string.format("  Stdev:   %.2f\n", latency.stdev / 1000))
  io.write(string.format("  P50:     %.2f\n", latency:percentile(50) / 1000))
  io.write(string.format("  P90:     %.2f\n", latency:percentile(90) / 1000))
  io.write(string.format("  P95:     %.2f\n", latency:percentile(95) / 1000))
  io.write(string.format("  P99:     %.2f\n", latency:percentile(99) / 1000))
  io.write("=====================================\n")
end
```

```bash
# Run wrk test
wrk -t4 -c100 -d30s -s wrk-test.lua http://localhost:3000
```

### 4. Comprehensive Test Script

#### load-test.sh

```bash
#!/bin/bash

set -euo pipefail

# Configuration
TARGET_URL="${TARGET_URL:-http://localhost:3000}"
OUTPUT_DIR="load-test-results"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$OUTPUT_DIR"

echo "=== Load Testing Suite ==="
echo "Target: $TARGET_URL"
echo "Output: $OUTPUT_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Check if target is reachable
if ! curl -s -f "$TARGET_URL/health" > /dev/null; then
    echo "❌ Target URL is not reachable: $TARGET_URL"
    exit 1
fi

echo "✅ Target is reachable"
echo ""

# Run k6 tests
if command -v k6 &> /dev/null; then
    echo "Running k6 load test..."
    k6 run \
        --out json="$OUTPUT_DIR/k6-results-$TIMESTAMP.json" \
        --summary-export="$OUTPUT_DIR/k6-summary-$TIMESTAMP.json" \
        basic-load-test.js

    echo "k6 test complete"
    echo ""
else
    echo "⚠️  k6 not installed, skipping k6 tests"
fi

# Run Apache Bench
if command -v ab &> /dev/null; then
    echo "Running Apache Bench test..."
    ab -n 10000 -c 100 -g "$OUTPUT_DIR/ab-gnuplot-$TIMESTAMP.tsv" \
        "$TARGET_URL/fast" > "$OUTPUT_DIR/ab-results-$TIMESTAMP.txt"

    echo "Apache Bench test complete"
    echo ""
else
    echo "⚠️  Apache Bench not installed, skipping ab tests"
fi

# Run wrk
if command -v wrk &> /dev/null; then
    echo "Running wrk benchmark..."
    wrk -t4 -c100 -d30s -s wrk-test.lua "$TARGET_URL" \
        > "$OUTPUT_DIR/wrk-results-$TIMESTAMP.txt"

    echo "wrk test complete"
    echo ""
else
    echo "⚠️  wrk not installed, skipping wrk tests"
fi

echo "=== All tests complete ==="
echo "Results saved to: $OUTPUT_DIR/"
```

## Explanation

### Load Testing Concepts

#### 1. Types of Load Tests

**Load Test:**
- Gradually increase load
- Find normal operating capacity
- Measure performance under expected load

**Stress Test:**
- Push beyond normal capacity
- Find breaking point
- Identify failure modes

**Spike Test:**
- Sudden traffic increase
- Test autoscaling
- Identify quick recovery

**Soak Test:**
- Extended duration
- Find memory leaks
- Test long-term stability

#### 2. Key Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **RPS** | Requests per second | Depends on app |
| **P50** | Median response time | < 100ms |
| **P95** | 95th percentile | < 500ms |
| **P99** | 99th percentile | < 1000ms |
| **Error Rate** | Failed requests % | < 1% |
| **Throughput** | Data transferred | Maximize |

#### 3. Virtual Users (VUs)

```
VU = Concurrent simulated users
Iterations = Total requests per VU
Duration = Test length
```

**Calculate needed VUs:**
```
VUs = (Target RPS × Response Time) / 1000
```

Example:
- Target: 1000 RPS
- Avg response: 100ms
- VUs needed: (1000 × 100) / 1000 = 100

## Result

### Run k6 Load Test

```bash
# Install k6
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Run test
k6 run basic-load-test.js

# Output:
#          /\      |‾‾| /‾‾/   /‾‾/
#     /\  /  \     |  |/  /   /  /
#    /  \/    \    |     (   /   ‾‾\
#   /          \   |  |\  \ |  (‾)  |
#  / __________ \  |__| \__\ \_____/ .io
#
#   execution: local
#      script: basic-load-test.js
#      output: -
#
#   scenarios: (100.00%) 1 scenario, 100 max VUs
#              default: Up to 100 VUs
#
#     ✓ status is 200
#     ✓ response time < 200ms
#
#     checks.........................: 100.00% ✓ 25000 ✗ 0
#     data_received..................: 5.0 MB  85 kB/s
#     data_sent......................: 2.5 MB  42 kB/s
#     http_req_duration..............: avg=45ms   min=10ms med=40ms max=150ms p(90)=80ms p(95)=95ms
#     http_reqs......................: 25000   417.5/s
#     iteration_duration.............: avg=3.04s  min=3.01s med=3.04s max=3.15s
#     iterations.....................: 8333    139.17/s
#     vus............................: 100     min=10  max=100
#     vus_max........................: 100     min=100 max=100
```

### Analyze Results

```bash
# Generate HTML report
k6 run --out html=report.html basic-load-test.js

# Send results to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 basic-load-test.js

# JSON output for processing
k6 run --out json=results.json basic-load-test.js

# View summary
jq '.metrics' results.json
```

## Validation

### Performance Checklist

```bash
# 1. Test completes successfully
k6 run basic-load-test.js
# Should exit 0

# 2. Error rate below threshold
k6 run basic-load-test.js | grep "http_req_failed"
# Should show rate < 0.01 (1%)

# 3. P95 latency acceptable
k6 run basic-load-test.js | grep "p(95)"
# Should be < 500ms

# 4. No timeouts
k6 run basic-load-test.js | grep "timeout"
# Should be 0

# 5. Consistent performance
# Run test multiple times
for i in {1..3}; do
  k6 run basic-load-test.js --quiet
done
# Results should be similar
```

## Best Practices

### ✅ Do's

1. **Test in staging**: Don't load test production
2. **Gradually increase load**: Avoid overwhelming system
3. **Monitor during tests**: Watch CPU, memory, etc.
4. **Use realistic scenarios**: Match actual usage patterns
5. **Run multiple times**: Ensure consistency
6. **Test after changes**: Catch performance regressions

### ❌ Don'ts

1. **Don't test production**: Use staging environment
2. **Don't skip monitoring**: Watch system metrics
3. **Don't test once**: Run multiple times
4. **Don't ignore baselines**: Compare to previous results
5. **Don't forget cleanup**: Reset state between tests

## Links

- [k6 Documentation](https://k6.io/docs/)
- [Apache Bench Manual](https://httpd.apache.org/docs/2.4/programs/ab.html)
- [wrk GitHub](https://github.com/wg/wrk)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Performance Testing Guide](https://martinfowler.com/articles/practical-test-pyramid.html)

## Share Your Success

Ran load tests? Share your findings!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Requests per second achieved
- P95 response time
- Bottlenecks discovered
- Performance improvements made

Use hashtags: **#AdventOfDevOps #LoadTesting #Performance #Day19**
