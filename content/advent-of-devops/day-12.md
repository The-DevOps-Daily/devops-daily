---
title: 'Day 12 - Log Parsing'
day: 12
excerpt: 'Parse and analyze application logs to extract meaningful insights and debug production issues.'
description: 'Learn log parsing techniques using tools like jq, grep, awk, and LogQL to troubleshoot applications and extract valuable metrics from logs.'
publishedAt: '2025-12-12T00:00:00Z'
updatedAt: '2026-04-19T00:00:00Z'
difficulty: 'Intermediate'
category: 'Observability'
tags:
  - Logging
  - Troubleshooting
  - Log Analysis
  - CLI Tools
---

## Description

Your application logs are overwhelming. Thousands of log lines per minute, mixed formats, and buried errors make it impossible to find what you need. You need to master log parsing to extract signal from noise.

## Task

Parse and analyze application logs to find issues and extract metrics.

**Requirements:**
- Parse structured (JSON) and unstructured logs
- Extract specific fields and patterns
- Calculate log-based metrics
- Find errors and anomalies
- Create useful log queries

## Target

- ✅ Successfully parse JSON logs
- ✅ Extract error patterns
- ✅ Calculate request statistics
- ✅ Identify slow queries
- ✅ Create reusable parsing scripts

## Sample App

### Sample Log Files

#### application.log (Mixed format)

```
2025-12-12T10:00:01Z INFO  Server started on port 3000
2025-12-12T10:00:15Z INFO  GET /api/users - 200 - 45ms
2025-12-12T10:00:16Z INFO  GET /api/products - 200 - 123ms
2025-12-12T10:00:17Z ERROR Database connection failed: timeout after 5000ms
2025-12-12T10:00:18Z WARN  Slow query detected: SELECT * FROM users - 2340ms
2025-12-12T10:00:20Z INFO  POST /api/orders - 201 - 89ms
2025-12-12T10:00:21Z ERROR Failed to process payment: Invalid card number
2025-12-12T10:00:22Z INFO  GET /health - 200 - 3ms
2025-12-12T10:00:25Z ERROR Uncaught exception: TypeError: Cannot read property 'id' of undefined
    at processOrder (/app/orders.js:45:20)
    at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)
2025-12-12T10:00:30Z INFO  GET /api/users/123 - 200 - 67ms
```

#### application-json.log (Structured JSON)

```json
{"timestamp":"2025-12-12T10:00:01Z","level":"info","message":"Server started","port":3000}
{"timestamp":"2025-12-12T10:00:15Z","level":"info","message":"Request completed","method":"GET","path":"/api/users","status":200,"duration":45}
{"timestamp":"2025-12-12T10:00:16Z","level":"info","message":"Request completed","method":"GET","path":"/api/products","status":200,"duration":123}
{"timestamp":"2025-12-12T10:00:17Z","level":"error","message":"Database connection failed","error":"timeout after 5000ms","database":"postgres"}
{"timestamp":"2025-12-12T10:00:18Z","level":"warn","message":"Slow query detected","query":"SELECT * FROM users","duration":2340}
{"timestamp":"2025-12-12T10:00:20Z","level":"info","message":"Request completed","method":"POST","path":"/api/orders","status":201,"duration":89}
{"timestamp":"2025-12-12T10:00:21Z","level":"error","message":"Payment processing failed","error":"Invalid card number","userId":123}
{"timestamp":"2025-12-12T10:00:22Z","level":"info","message":"Request completed","method":"GET","path":"/health","status":200,"duration":3}
{"timestamp":"2025-12-12T10:00:25Z","level":"error","message":"Uncaught exception","error":"TypeError: Cannot read property 'id' of undefined","stack":"at processOrder (/app/orders.js:45:20)"}
{"timestamp":"2025-12-12T10:00:30Z","level":"info","message":"Request completed","method":"GET","path":"/api/users/123","status":200,"duration":67}
```

## Solution

### 1. Basic Log Parsing with grep

```bash
# Find all ERROR logs
grep "ERROR" application.log

# Find errors with context (3 lines before, 3 after)
grep -A 3 -B 3 "ERROR" application.log

# Case-insensitive search
grep -i "error" application.log

# Count errors
grep -c "ERROR" application.log

# Find multiple patterns
grep -E "ERROR|WARN" application.log

# Exclude certain patterns
grep "ERROR" application.log | grep -v "connection timeout"

# Show only matching part
grep -o "duration": [0-9]*" application-json.log
```

### 2. JSON Log Parsing with jq

```bash
# Pretty print JSON logs
cat application-json.log | jq '.'

# Extract specific field
cat application-json.log | jq '.message'

# Filter by level
cat application-json.log | jq 'select(.level == "error")'

# Multiple conditions
cat application-json.log | jq 'select(.level == "error" or .level == "warn")'

# Extract multiple fields
cat application-json.log | jq '{time: .timestamp, level: .level, msg: .message}'

# Calculate average duration
cat application-json.log | jq -s 'map(select(.duration != null)) | map(.duration) | add / length'

# Group by path and count
cat application-json.log | jq -s 'group_by(.path) | map({path: .[0].path, count: length})'

# Find slow requests (duration > 100ms)
cat application-json.log | jq 'select(.duration > 100)'

# Top 5 slowest requests
cat application-json.log | jq -s 'sort_by(.duration) | reverse | .[0:5]'
```

### 3. Advanced Parsing with awk

```bash
# Extract specific columns (timestamp and message)
awk '{print $1, $2, $4}' application.log

# Calculate average response time
grep "GET\|POST" application.log | awk -F'- ' '{print $NF}' | awk -F'ms' '{sum+=$1; count++} END {print sum/count "ms"}'

# Count by log level
awk '{print $3}' application.log | sort | uniq -c

# Find requests slower than 100ms
awk -F'- |ms' '$NF > 100 {print}' application.log

# Extract and sum durations
awk -F'[- ]' '/duration/ {sum += $(NF-1); count++} END {print "Total:", sum "ms", "Avg:", sum/count "ms"}'
```

### 4. Log Analysis Scripts

#### parse_logs.sh

```bash
#!/bin/bash

LOG_FILE="${1:-application.log}"

echo "=== Log Analysis Report ==="
echo

# Total lines
echo "Total log lines: $(wc -l < "$LOG_FILE")"
echo

# Breakdown by level
echo "Log Levels:"
grep -oE "(INFO|WARN|ERROR)" "$LOG_FILE" | sort | uniq -c | sort -rn
echo

# Error summary
echo "Errors:"
grep "ERROR" "$LOG_FILE" | wc -l
echo

# Most common errors
echo "Top 5 Error Messages:"
grep "ERROR" "$LOG_FILE" | awk -F'ERROR ' '{print $2}' | sort | uniq -c | sort -rn | head -5
echo

# Response time statistics
echo "Response Time Statistics:"
grep -oE "[0-9]+ms" "$LOG_FILE" | sed 's/ms//' | awk '
{
    sum += $1
    count++
    if (min == "" || $1 < min) min = $1
    if ($1 > max) max = $1
}
END {
    print "  Count:", count
    print "  Min:", min "ms"
    print "  Max:", max "ms"
    print "  Avg:", sum/count "ms"
}'
echo

# Slow queries (> 1000ms)
echo "Slow Operations (>1000ms):"
grep -E "[0-9]{4,}ms" "$LOG_FILE"
echo

# Requests by endpoint
echo "Requests by Endpoint:"
grep -oE "(GET|POST|PUT|DELETE) /[^ ]+" "$LOG_FILE" | sort | uniq -c | sort -rn
```

#### parse_json_logs.sh

```bash
#!/bin/bash

LOG_FILE="${1:-application-json.log}"

echo "=== JSON Log Analysis Report ==="
echo

# Total logs
echo "Total logs: $(wc -l < "$LOG_FILE")"
echo

# Logs by level
echo "Logs by Level:"
jq -r '.level' "$LOG_FILE" | sort | uniq -c | sort -rn
echo

# Error rate
TOTAL=$(wc -l < "$LOG_FILE")
ERRORS=$(jq 'select(.level == "error")' "$LOG_FILE" | wc -l)
ERROR_RATE=$(echo "scale=2; $ERRORS * 100 / $TOTAL" | bc)
echo "Error Rate: $ERROR_RATE%"
echo

# Average response time
echo "Response Time Stats:"
jq -s '
  map(select(.duration != null)) |
  {
    count: length,
    min: (map(.duration) | min),
    max: (map(.duration) | max),
    avg: (map(.duration) | add / length)
  }
' "$LOG_FILE"
echo

# Top errors
echo "Top Error Messages:"
jq -r 'select(.level == "error") | .message' "$LOG_FILE" | sort | uniq -c | sort -rn | head -5
echo

# Slowest requests
echo "Top 10 Slowest Requests:"
jq 'select(.duration != null)' "$LOG_FILE" | jq -s 'sort_by(.duration) | reverse | .[0:10]'
```

### 5. LogQL Queries (for Loki)

```logql
# All logs from namespace
{namespace="demo-app"}

# Filter by level
{namespace="demo-app"} |= "ERROR"

# JSON field extraction
{namespace="demo-app"} | json | level="error"

# Multiple conditions
{namespace="demo-app"} | json | level=~"error|warn"

# Pattern matching
{namespace="demo-app"} |~ "Database.*timeout"

# Calculate error rate
sum(rate({namespace="demo-app"} |= "ERROR" [5m]))

# Count by level
sum by (level) (count_over_time({namespace="demo-app"} [5m]))

# Average response time
avg_over_time({namespace="demo-app"} | json | __error__="" | unwrap duration [5m])

# Top error messages
topk(5,
  sum by (message) (
    count_over_time({namespace="demo-app"} | json | level="error" [1h])
  )
)
```

## Explanation

### Log Parsing Tools

#### 1. grep - Pattern Matching

**Best for:** Finding specific text patterns

```bash
# Basic syntax
grep "pattern" file.log

# Useful flags:
# -i : case insensitive
# -v : invert match (exclude)
# -A N : show N lines after
# -B N : show N lines before
# -C N : show N lines context
# -c : count matches
# -E : extended regex
```

#### 2. jq - JSON Processor

**Best for:** Structured JSON logs

```bash
# Filter
jq 'select(.level == "error")'

# Map/transform
jq '{time: .timestamp, msg: .message}'

# Aggregate
jq -s 'group_by(.path) | map({path: .[0].path, count: length})'

# Math operations
jq -s 'map(.duration) | add / length'
```

#### 3. awk - Text Processing

**Best for:** Column-based data, calculations

```bash
# Print columns
awk '{print $1, $3}'

# Conditional
awk '$3 == "ERROR" {print}'

# Calculations
awk '{sum += $4} END {print sum}'

# Field separator
awk -F',' '{print $2}'
```

### Common Log Analysis Tasks

#### Find Error Patterns

```bash
# Recent errors
tail -1000 app.log | grep ERROR

# Errors in time range
sed -n '/2025-12-12T10:00/,/2025-12-12T11:00/p' app.log | grep ERROR

# Unique error messages
grep ERROR app.log | awk -F'ERROR' '{print $2}' | sort -u
```

#### Response Time Analysis

```bash
# P95 response time
grep "duration" app.log | \
  grep -oE "[0-9]+" | \
  sort -n | \
  awk '{a[NR]=$1} END {print a[int(NR*0.95)]}'

# Requests by status code
grep -oE "- [0-9]{3} -" app.log | \
  awk '{print $2}' | \
  sort | uniq -c
```

#### Traffic Analysis

```bash
# Requests per minute
awk '{print $1}' app.log | \
  cut -d: -f1,2 | \
  sort | uniq -c

# Top endpoints
grep -oE "(GET|POST) /[^ ]+" app.log | \
  sort | uniq -c | sort -rn | head -10
```

## Result

### Run Log Analysis

```bash
# Make script executable
chmod +x parse_logs.sh parse_json_logs.sh

# Analyze plain text logs
./parse_logs.sh application.log

# Output:
# === Log Analysis Report ===
#
# Total log lines: 10
#
# Log Levels:
#       5 INFO
#       3 ERROR
#       2 WARN
#
# Errors: 3
#
# Top 5 Error Messages:
#       1 Database connection failed: timeout after 5000ms
#       1 Failed to process payment: Invalid card number
#       1 Uncaught exception: TypeError...
#
# Response Time Statistics:
#   Count: 6
#   Min: 3ms
#   Max: 2340ms
#   Avg: 394ms

# Analyze JSON logs
./parse_json_logs.sh application-json.log
```

### Real-time Log Monitoring

```bash
# Follow logs and highlight errors
tail -f application.log | grep --color=always -E "ERROR|WARN|$"

# Follow and parse JSON
tail -f application-json.log | jq 'select(.level == "error" or .level == "warn")'

# Monitor error rate
watch -n 5 'grep -c "ERROR" application.log'

# Alert on errors
tail -f application.log | while read line; do
  if echo "$line" | grep -q "ERROR"; then
    echo "ALERT: $line"
    # Send notification
  fi
done
```

## Validation

### Testing Checklist

```bash
# 1. Can extract all errors
ERROR_COUNT=$(grep -c "ERROR" application.log)
echo "Found $ERROR_COUNT errors"
# Should match expected count

# 2. JSON parsing works
jq '.' application-json.log > /dev/null
echo "JSON valid: $?"
# Should return 0

# 3. Can calculate metrics
AVG_DURATION=$(cat application-json.log | jq -s 'map(select(.duration != null)) | map(.duration) | add / length')
echo "Average duration: $AVG_DURATION ms"
# Should return number

# 4. Can filter time range
LOG_COUNT=$(sed -n '/10:00:15/,/10:00:25/p' application.log | wc -l)
echo "Logs in range: $LOG_COUNT"
# Should return expected count

# 5. Scripts execute successfully
./parse_logs.sh application.log > /dev/null
echo "Script exit code: $?"
# Should return 0
```

## Advanced Techniques

### Multi-line Log Parsing

```bash
# Parse stack traces
awk '/ERROR/,/^[^[:space:]]/' application.log

# Combine related log lines
sed -n '/Uncaught exception/,/at Layer/p' application.log
```

### Performance Optimization

```bash
# Use ripgrep (faster than grep)
rg "ERROR" application.log

# Parallel processing with GNU parallel
cat huge.log | parallel --pipe grep "ERROR"

# Index logs with awk
awk '{a[NR]=$0} /ERROR/ {print NR, $0}' application.log
```

### Log Correlation

```bash
# Find request ID across logs
REQUEST_ID="abc123"
grep "$REQUEST_ID" *.log | sort

# Track user session
jq "select(.userId == 123)" application-json.log
```

## Best Practices

### ✅ Do's

1. **Use structured logging**: JSON makes parsing easier
2. **Include context**: Timestamps, request IDs, user IDs
3. **Log levels**: Use appropriate levels (DEBUG, INFO, WARN, ERROR)
4. **Aggregate centrally**: Send logs to central system
5. **Create dashboards**: Visualize common queries
6. **Set up alerts**: Don't just collect, act on logs

### ❌ Don'ts

1. **Don't log sensitive data**: PII, passwords, tokens
2. **Don't log too much**: Signal-to-noise ratio
3. **Don't parse in production**: Use log aggregation
4. **Don't ignore timezone**: Use UTC
5. **Don't skip sampling**: Sample high-volume logs

## Links

- [jq Manual](https://stedolan.github.io/jq/manual/)
- [awk Tutorial](https://www.gnu.org/software/gawk/manual/)
- [grep Documentation](https://www.gnu.org/software/grep/manual/)
- [LogQL Documentation](https://grafana.com/docs/loki/latest/logql/)
- [Structured Logging Best Practices](https://www.loggly.com/ultimate-guide/structuring-logs/)

## Share Your Success

Mastered log parsing? Share your findings!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Interesting pattern you discovered
- Parsing command that saved the day
- What issue you debugged
- Your favorite log query

Use hashtags: **#AdventOfDevOps #LogParsing #Debugging #Day12**
