---
title: "GitLab.com's 60-Requests-an-Hour Limit Is Live, and the Headers Won't Warn You"
excerpt: 'We sent anonymous requests to GitLab.com until the new per-IP limit blocked us. It depended on which project we asked for, the successful responses never mentioned it, and Retry-After was wrong in both directions. Here is what we measured and how to find the anonymous calls in your CI before GitLab does.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-10-29'
publishedAt: '2026-10-29T09:00:00Z'
updatedAt: '2026-10-29T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - GitLab
  - CI/CD
  - Rate Limiting
  - API
  - Automation
  - DevOps
---

GitLab.com now limits requests without credentials to 60 per hour per IP address, at least for part of its traffic. On the evening of October 28 we sent 140 anonymous API requests to GitLab's own `gitlab-runner` project in under ten minutes, and every one of them came back `200`. Then we pointed the same loop at a public project in a personal namespace. After 58 requests, the 59th came back `429 Too Many Requests`, and our IP stayed blocked for more than 40 minutes.

Three things from that evening matter if you run CI or automation against GitLab.com:

- **What counts depends on what you ask for.** While we were blocked, requests to projects in the `gitlab-org` and `inkscape` groups still worked, and requests to personal projects and to `/api/v4/version` did not. If you test against a big open source project, you may conclude that nothing has changed.
- **Successful responses do not show the new limit.** The last `200` before the block carried `RateLimit-Remaining: 476`. That number belongs to the old 500-per-minute throttle. The new limit only appears in the `429` itself.
- **`Retry-After` follows the clock, the block does not.** Every `Retry-After` pointed to the end of the current clock hour. The block ended about an hour after the first request that counted. Our first explanation for that was wrong, and a test with predictions written down in advance showed it.

Everything below comes from one IP in one overnight session, October 28 to 29 UTC, with the scripts and raw results in a public repository, so you can run the same checks from your own network.

## TL;DR

- GitLab announced the Free and unauthenticated limits for October 19, 2026, and the limits for Premium and Ultimate for January 2027. Anonymous traffic gets 60 requests per hour per IP.
- From our IP, the budget was exactly 60 requests. The count started with the first request and reset about an hour later. Requests to the `gitlab-org` group did not count, `401` responses did, and blocked requests did not extend the block. The `429` carried `RateLimit-Name: unauthenticated_traffic_per_ip`.
- Nothing in a successful response warns you. Track your own request counts, and alert on `429` responses with that `RateLimit-Name`.
- Do not plan around `Retry-After` from this throttle. It points to the end of the clock hour, and the block ends about an hour after the first request of the current count.
- A separate limit, most likely at Cloudflare, stopped bursts of `401` responses after 25 requests, with a `429` that looks nothing like GitLab's.
- Behind one NAT address, every runner shares those 60 requests. Find anonymous `curl`, `wget` and Dockerfile `ADD` calls to gitlab.com and give them a token. `CI_JOB_TOKEN` covers raw files, releases, packages, artifacts and archives.

## Prerequisites

- A GitLab.com account or group, and CI jobs or scripts that talk to gitlab.com
- `bash`, `curl` and Python 3.9 or later to run the scripts in the companion repository
- Access to your runners' egress IP addresses, if you want to reason about shared limits

## What GitLab announced

GitLab's [announcement](https://about.gitlab.com/blog/rate-limit-change-2026/) ties GitLab.com rate limits to the subscription plan. The numbers are on the [rate limits page](https://docs.gitlab.com/user/gitlab_com/rate_limits/), which still called them proposed when we read it on October 28:

| Caller                       | Sustained limit | Burst limit (API) | Starts           |
| ---------------------------- | --------------- | ----------------- | ---------------- |
| No credentials, per IP       | 60 per hour     | none listed       | October 19, 2026 |
| Free, per signed-in user     | 5,000 per hour  | 100 per minute    | October 19, 2026 |
| Premium, per signed-in user  | 15,000 per hour | 1,250 per minute  | January 2027     |
| Ultimate, per signed-in user | 25,000 per hour | 2,000 per minute  | January 2027     |

Free also has a separate 200-per-minute limit for web traffic. Personal access tokens, OAuth tokens and CI/CD job tokens all move a request from the anonymous limit to your plan's limit. Git over HTTPS is not counted against the anonymous limit. GitLab Self-Managed and GitLab Dedicated are not affected. The old per-minute limits stay in place, and GitLab applies the lower of the two.

The hourly limit matters more than the burst limit. At full burst speed, you reach the hourly cap long before the hour is over:

```chart
{
  "type": "bar",
  "title": "Minutes at full burst speed until the hourly limit",
  "unit": " min",
  "caption": "Sustained limit divided by burst limit, from GitLab's rate limits page, retrieved 2026-10-28. Per signed-in user, API traffic.",
  "rows": [
    { "label": "Free (5,000/h, 100/min)", "value": 50 },
    { "label": "Premium (15,000/h, 1,250/min)", "value": 12 },
    { "label": "Ultimate (25,000/h, 2,000/min)", "value": 12.5 }
  ]
}
```

## How we measured

The companion repository holds the scripts and every result file:

```github
https://github.com/The-DevOps-Daily/gitlab-rate-limit-check
```

`probe.sh` sends requests with a one-second pause between them and writes the status code, the cache status and the rate-limit headers of each response to a TSV file stamped with the script's hash. All requests came from one residential IP address over IPv4, with no token, on October 28 between 22:38 and 23:38 UTC and on October 29 between 01:00 and 04:03 UTC.

```terminal
{
  "title": "probe.sh against a project in a personal namespace",
  "prompt": "$",
  "steps": [
    { "cmd": "PROJECT=dwt1%2Fdotfiles ./probe.sh api 70", "output": "results/api-anon-20261028T225259Z.tsv\n     58 200\tBYPASS\tthrottle_unauthenticated_api\t500\n     12 429\tBYPASS\tunauthenticated_traffic_per_ip" },
    { "cmd": "sed -n '58,61p' results/api-anon-20261028T225259Z.tsv", "output": "56\t22:54:21\t200\tBYPASS\tthrottle_unauthenticated_api\t500\t478\t\n57\t22:54:23\t200\tBYPASS\tthrottle_unauthenticated_api\t500\t477\t\n58\t22:54:24\t200\tBYPASS\tthrottle_unauthenticated_api\t500\t476\t\n59\t22:54:26\t429\tBYPASS\tunauthenticated_traffic_per_ip\t\t\t334" }
  ]
}
```

The columns are request number, UTC time, status, Cloudflare cache status, `RateLimit-Name`, `RateLimit-Limit`, `RateLimit-Remaining` and `Retry-After`.

## Finding 1: the limit depends on the project you request

Before that run we had already sent 140 anonymous API requests to `gitlab-org/gitlab-runner` and 70 cache-busted raw-file requests to the same project, in just over ten minutes. All 210 returned `200`, and the only throttle in the headers was the old `throttle_unauthenticated_api` or `throttle_unauthenticated_web`, at 500 requests per minute.

The run against `dwt1/dotfiles`, a popular public project in a personal namespace, was blocked after 58 requests. That hour we had also made two requests to endpoints outside any project, `/api/v4/version` and a `/api/v4/projects` search. If those count, the block came after exactly 60 requests, which also suggests nothing else on that address was sending anonymous requests to GitLab.com. While the IP was blocked, we sent one request to each of six targets:

| Target                                         | Status while blocked |
| ---------------------------------------------- | -------------------- |
| `gitlab-org/gitlab-runner`                     | 200                  |
| `gitlab-org/gitlab`                            | 200                  |
| `inkscape/inkscape`                            | 200                  |
| `dwt1/dotfiles` (personal namespace)           | 429                  |
| `CalcProgrammer1/OpenRGB` (personal namespace) | 429                  |
| `/api/v4/version` (no project)                 | 429                  |

Our reading is that the new anonymous limit depends on the namespace you request, most likely on its plan: `gitlab-org` is GitLab's own group, Inkscape is a large open source group, and requests to both went through. We cannot see a namespace's plan without credentials, so this is an inference from the pattern, not a fact we could check.

To test that reading, we waited until the IP had been quiet for more than an hour and ran `count-test.sh` at 01:00:45 UTC on October 29. It sends 10 requests to `gitlab-org/gitlab-runner`, then 10 to `/api/v4/version`, then requests to `dwt1/dotfiles` until the first `429`. If the `gitlab-org` requests do not count and the others do, the last step gets 50 successes before the block. It got exactly 50:

```terminal
{
  "title": "count-test.sh from a clean start",
  "prompt": "$",
  "steps": [
    { "cmd": "./count-test.sh", "output": "results/count-test-20261029T010045Z.tsv\n10 paid 200\n50 personal 200\n1 personal 429\n10 unscoped 401\npersonal-namespace successes before the first 429: 50 (prediction: 50)" }
  ]
}
```

`paid` is the script's label for the `gitlab-org` step, after our guess about why it is not counted. The same total would come out if the `gitlab-org` requests counted and the `/api/v4/version` requests did not, but the first evening rules that out: more than 200 `gitlab-org` requests in the same hour as the 58 personal ones did not trigger a block. The `/api/v4/version` requests all returned `401 Unauthorized`, so a request that fails still uses up the budget.

So if you want to know whether your automation will be throttled, test it against the projects it really uses. A quick check against a large open source project tells you nothing.

## Finding 2: successful responses do not show the new limit

GitLab's advice is to watch `RateLimit-Remaining` and slow down as it drops. For this limit, that does not work. Every successful response in our runs described only the old per-minute throttle. Request 58 got `RateLimit-Remaining: 476`, and request 59 got a `429`.

The `429` was the first response that mentioned the new limit. It carried `RateLimit-Name: unauthenticated_traffic_per_ip` and a `Retry-After`, but no `RateLimit-Limit` or `RateLimit-Remaining`.

So you have two options. Count your own anonymous requests, or alert on the first `429` with that `RateLimit-Name`. The repository's `glcurl` wrapper logs one JSON line per request without the token, and `budget.py` reads those logs and reports each caller's busiest minute and busiest hour against the plan limits.

## Finding 3: the count resets an hour after it starts, not at the top of the hour

The first `429`, at 22:54:26 UTC, said `Retry-After: 334`. That points to 23:00:00, the top of the hour. We waited until 23:00:45 and tried again. Requests to `gitlab-org` still worked, but the first request that counts was blocked, and this time `Retry-After` was 3,540 seconds, pointing to midnight. Then we sent one request every three minutes to see when the block really ended:

| UTC      | Status      | `Retry-After` |
| -------- | ----------- | ------------- |
| 22:54:26 | 429 (first) | 334           |
| 23:01:01 | 429         | 3,540         |
| 23:02:07 | 429         | 3,473         |
| 23:20:10 | 429         | 2,390         |
| 23:35:12 | 429         | 1,488         |
| 23:38:12 | not limited | none          |

Every `Retry-After` was the time until the end of the current clock hour, but the block ended between 23:35 and 23:38. The first request that counted that evening was a one-off `/api/v4/version` call. It has no result file, but our terminal log puts it between 22:38:02 and 22:38:03, and an hour after that falls inside the three minutes in which the block ended.

Our first explanation was a sliding window: count the requests of the last 3,600 seconds, and let the caller back in as the oldest one drops out. We tested it a few hours later. The count test had blocked the IP at 01:02:29, and its first counted request was at 01:01:01. `predict-window.py` worked out what three counting models expect, and we committed its predictions before `window-test.sh` ran:

| Request                    | Clock hour | Sliding 60 minutes | Weighted estimate | GitLab                           |
| -------------------------- | ---------- | ------------------ | ----------------- | -------------------------------- |
| One at 01:50:00            | 429        | 429                | 429               | 429, `Retry-After: 600`          |
| One at 02:00:30            | allowed    | 429                | allowed           | 429, `Retry-After: 3570`         |
| Back to back from 02:01:45 | 59 allowed | 35 to 46 allowed   | 1 allowed         | 25 allowed, then a different 429 |

The weighted estimate is a common shortcut in rate limiters: the previous hour's count, weighted by the part of it still inside the last 3,600 seconds, plus the current hour's count. Half a minute into the new clock hour we were still blocked, and `Retry-After` now pointed to 03:00:00. A minute later, 25 requests went through, and then the burst was stopped by the limit in the next section. The sliding window matched, and we wrote it up that way.

The second review of this post found the hole. A counter that starts with the first request and resets completely 3,600 seconds later, the way a Redis `INCR` with an `EXPIRE` on the first increment works, fits the same three rows. The two models only disagree while old requests are leaving a sliding window, and our first test of that was cut off at request 26 by the same limit. So we ran another, with requests that return `200` and do not trip that limit. At 03:04:00 the sliding window predicted 25 more requests, and the resetting counter 35. GitLab allowed 35:

```terminal
{
  "title": "series-test.sh against a personal project, predictions committed at 03:03:46",
  "prompt": "$",
  "steps": [
    { "cmd": "URL='https://gitlab.com/api/v4/projects/dwt1%2Fdotfiles' START=$(date -u -d 03:04:00 +%s) ./series-test.sh", "output": "results/series-test-20261029T030400Z.tsv\n     35 200\tthrottle_unauthenticated_api\n      1 429\tunauthenticated_traffic_per_ip" }
  ]
}
```

So the sliding window was wrong. The first test could have told the two apart, but the other limit stopped it after 25 requests. What matched every response from the hourly limit: a count that starts with the first request that counts, allows 60, and resets about an hour after that first request.

We tested that once more, with the predictions committed first. The count that series ran into started with a request sent at 03:02:00.5, so it should reset at about 04:02:00, not at 04:00:00, where `Retry-After` pointed:

```terminal
{
  "title": "reset-test.sh, predictions committed at 03:06:45",
  "prompt": "$",
  "steps": [
    { "cmd": "TIMES=\"04:00:30 04:01:50 04:02:10\" BURST_AT=04:02:15 ./reset-test.sh", "output": "results/reset-test-20261029T030649Z.tsv\n2026-10-29T04:00:30.666Z 429 unauthenticated_traffic_per_ip 3569\n2026-10-29T04:01:50.122Z 429 unauthenticated_traffic_per_ip 3490\n2026-10-29T04:02:10.586Z 200 throttle_unauthenticated_api\n1 x 429 unauthenticated_traffic_per_ip\n59 x 200 throttle_unauthenticated_api" }
  ]
}
```

Both blocked responses now pointed `Retry-After` to 05:00:00, about 59 and 58 minutes away. Less than 21 seconds later the block was gone, and all 60 came back at once: one at 04:02:10 and 59 in the burst that followed. `predict-window.py --compare` checks each response against what each model expects, given the requests GitLab had accepted before it. Only the resetting counter matched all 63 responses in this run. The clock hour matched 61, because it expected the two requests after 04:00:00 to go through, and its forecast before the run had expected 57 in the burst, not 59.

Two more things follow from the data. Blocked requests did not extend the block: we got 38 blocked responses the first evening, and it still ended about an hour after 22:38. And the budget is exactly 60. After the 25-request burst at 02:01:45, `burst-test.sh` sent 25 more back to back, waited 75 seconds, and then sent requests with a 1.5-second pause between them. With 50 used, it should get 10 more, and it got exactly 10:

```terminal
{
  "title": "burst-test.sh: 25 + 25 + 10 = 60",
  "prompt": "$",
  "steps": [
    { "cmd": "./burst-test.sh", "output": "results/burst-test-20261029T020328Z.tsv\n     25 C\t401\tthrottle_unauthenticated_api\n      1 C\t429\t\n     10 D\t401\tthrottle_unauthenticated_api\n      1 D\t429\tunauthenticated_traffic_per_ip" }
  ]
}
```

So `Retry-After` from this throttle is wrong in both directions. At 22:54 it pointed about 35 to 38 minutes too early. At 04:01:50 it said 3,490 seconds, and the block ended less than 21 seconds later. If you keep a log of your anonymous requests, the block ends about an hour after the first request of the current count, and then all 60 come back at once. Since blocked requests did not extend the block, checking again every few minutes is safe. The better fix is to stop sending anonymous requests from that address and switch to a token.

For the other limits, `backoff.py` in the repository waits `Retry-After`, uses capped exponential backoff with full jitter when a `429` has no headers, and slows down when `RateLimit-Remaining` gets low.

## Finding 4: a second limit we could not pin down

Every run of requests to `/api/v4/version` that got that far stopped at request 26 with a different `429`: no `RateLimit-Name`, and `Retry-After: 60`. Two were back-to-back bursts that took about ten seconds, and one was a slower series that took 48. We saved one of these responses in full. Like every gitlab.com response it carried `server: cloudflare`, but none of the headers that GitLab's own `429` had, such as `gitlab-lb`, `gitlab-sv`, `x-runtime` and the `RateLimit-*` headers. So it most likely came from Cloudflare, not from GitLab. The body said:

```text
The service is temporarily unavailable due to elevated error rates. Please retry after a short wait.
```

Every request in those runs had returned `401`, because `/api/v4/version` needs a token. The message suggests a limit on errors, but 60 back-to-back `404` responses for a missing file in `gitlab-org/gitlab-runner`, at the pace of the fast bursts, did not trip it. Neither did 60 `200` responses sent four at a time in about eight seconds. So it does not apply one request rate or one error count to every route. It may count `401` responses, or apply only to that endpoint, or leave `gitlab-org` alone. Our tests cannot tell these apart.

It matters for anything that retries quickly on authentication errors. Our runs got this `429` after 25 failed requests, and it carries none of the headers your GitLab rate-limit handling looks for. When a `429` has no `RateLimit-Name`, log its body before you decide how long to wait.

## A method bug: cached raw files never reach the limiter

Our first raw-file run looked strange. All 70 requests returned `200`, and `RateLimit-Remaining` stayed at 494 for the whole run. The probe did not record cache headers yet, so two minutes later we checked by hand:

```text
cf-cache-status: HIT
age: 48
cache-control: max-age=60, public, must-revalidate, stale-while-revalidate=60, stale-if-error=300, s-maxage=60
ratelimit-remaining: 494
ratelimit-reset: 1792878180
```

That is an excerpt of one response, saved in the repository. Cloudflare answered from its cache, so the rate-limit headers were a frozen copy: that `ratelimit-reset` is 21:43 UTC on October 24, four days before our run. Those requests most likely never reached GitLab's limiter. With a unique query string on each request, all 70 responses were `cf-cache-status: MISS` and the counter moved again. `probe.sh` now adds that query string by default and records the cache status of every response.

The API responses all said `cf-cache-status: BYPASS`, so API calls reach GitLab every time. Do not count on the cache for raw files either: you cannot tell in advance which requests it will absorb.

## Where it hurts: many runners behind one address

60 requests per hour is plenty for a laptop. It is not much for a fleet of self-hosted runners that leave the network through one NAT gateway, because every anonymous request from every runner counts against the same IP.

Here is a worked example, not a measurement. Twelve parallel jobs per pipeline, a pipeline every ten minutes, and each job fetches an install script and makes two API calls without a token. `examples/make_nat_log.py` writes that hour as a log, and `budget.py` compares it with the limits. It groups anonymous requests by the egress address they leave from, and token requests by the GitLab user behind the token:

```text
$ python3 budget.py examples/runner-nat.jsonl
caller                       requests  max/min  limit  max/hour  limit    use
anon@runners-nat                  216       36    500       216     60   360%  <-- over
token:release-bot                  90       90    100        90   5000    90%  <-- near
```

The busiest minute, 36 requests, is far below the old 500-per-minute limit. Each pipeline makes 36 anonymous requests, so if all of them count and the hour starts with an unused budget, the second pipeline takes the total past 60. The release bot with a token is fine on the hourly limit, but 90 requests in 45 seconds is close to the Free burst limit of 100 per minute.

The usual sources of anonymous traffic in CI are:

- install scripts fetched with `curl ... | sh` from a `/-/raw/` URL
- release binaries downloaded from `/-/releases/` links
- source archives from `/-/archive/`
- `ADD https://gitlab.com/...` in a Dockerfile, which runs on every uncached build
- API calls through `$CI_API_V4_URL` without a `JOB-TOKEN` header

## Find the anonymous calls before GitLab does

`find_anon_calls.py` scans CI files, shell and PowerShell scripts, Dockerfiles and Makefiles for these calls and tells you what to use instead. Git over HTTPS is skipped, because it is not counted against the anonymous limit. Run against three of the repository's test fixtures:

```text
$ python3 find_anon_calls.py tests/fixtures/.gitlab-ci.yml tests/fixtures/Dockerfile tests/fixtures/install.sh
tests/fixtures/.gitlab-ci.yml:8: [raw] anonymous call to https://gitlab.com/acme/tools/-/raw/main/install.sh
    fix: use GET /api/v4/projects/:id/repository/files/:path/raw?ref=:ref with JOB-TOKEN or PRIVATE-TOKEN
tests/fixtures/.gitlab-ci.yml:12: [api] anonymous call to $CI_API_V4_URL/projects/42/releases
    fix: add a token header: JOB-TOKEN: $CI_JOB_TOKEN in CI (packages, releases, raw files, artifacts, archives) or a project/group access token for other endpoints
tests/fixtures/.gitlab-ci.yml:20: [archive] anonymous call to https://gitlab.com/acme/lib/-/archive/v2.0/lib-v2.0.tar.gz
    fix: use GET /api/v4/projects/:id/repository/archive with JOB-TOKEN or PRIVATE-TOKEN
tests/fixtures/Dockerfile:3: [raw] anonymous call to https://gitlab.com/acme/tools/-/raw/main/healthcheck.sh
    fix: use GET /api/v4/projects/:id/repository/files/:path/raw?ref=:ref with JOB-TOKEN or PRIVATE-TOKEN
tests/fixtures/Dockerfile:5: [raw] anonymous call to https://gitlab.com/acme/tools/-/raw/main/motd
    fix: use GET /api/v4/projects/:id/repository/files/:path/raw?ref=:ref with JOB-TOKEN or PRIVATE-TOKEN
tests/fixtures/install.sh:3: [download] anonymous call to https://gitlab.com/acme/cli/-/releases/v1.4.0/downloads/cli-linux-amd64
    fix: download through the API (releases, job artifacts, packages) with a token
6 anonymous GitLab call(s) found
```

It exits with status 1 when it finds anything, so you can add it as a CI job. It decides per command, so a token on one command does not cover the next one on the same line. It is still a pattern matcher, not a parser: it misses URLs built at runtime and calls in languages it does not read.

## The fix: send a token

In a GitLab CI job you already have one. According to GitLab's [job token documentation](https://docs.gitlab.com/ci/jobs/ci_job_token/), `CI_JOB_TOKEN` can read raw files, releases and release links, packages, job artifacts and repository archives. For a project outside your own, add your project to the target project's job token allowlist. Public and internal projects allow some of these reads without it.

The most common change is the install script:

```bash
# Before: anonymous, counts against the runner's IP
curl -fsSL https://gitlab.com/acme/tools/-/raw/main/install.sh | sh

# After: authenticated with the job token, counts against your plan's limits.
# 1234 is the numeric ID of the acme/tools project; the file path is URL-encoded.
curl -fsSL --header "JOB-TOKEN: $CI_JOB_TOKEN" \
  "$CI_API_V4_URL/projects/1234/repository/files/install.sh/raw?ref=main" | sh
```

For endpoints the job token cannot reach, such as reading project or group details, use a project or group access token with the `read_api` scope, stored as a masked CI/CD variable. Outside CI, use a personal access token with the narrowest scope that works. And if a third-party tool cannot authenticate at all, GitLab asks you to contact `limits@gitlab.com`.

## What we could not conclude

- **One IP, one night.** GitLab may enforce the limit differently in other regions, at other times, or for other address ranges.
- **Namespace plans.** We inferred that paid groups are not counted yet. We cannot see a namespace's plan without credentials.
- **The exact rule.** A counter that resets about an hour after its first request matched every response from the hourly limit, including two runs predicted in advance. Close variants fit the same data, such as a reset an hour after the start of that request's minute, or a few seconds short of an hour. A clock-hour window, a weighted estimate and a sliding window each failed at least one prediction. Other implementations could fit the same data, and GitLab can change it at any time.
- **The second limit.** We could trigger it only with `401` responses from `/api/v4/version`. We do not know what it counts, and that it runs at Cloudflare is an inference from the headers.
- **Authenticated limits.** We had no GitLab token on the test machine, so we did not test the per-user Free limits of 5,000 per hour and 100 per minute.
- **January.** We could not test the Premium and Ultimate limits, which start in January 2027, or whether requests to paid groups start counting against the anonymous limit then.

## Summary

The new anonymous limit is live on GitLab.com for at least some of the traffic, and it is easy to miss. It did not apply to the projects we tested first. Successful responses carried no sign of it, and the `Retry-After` on the `429` did not say when the block would end.

Before it shows up as a failed pipeline:

1. Run `find_anon_calls.py` over your CI files, scripts and Dockerfiles.
2. Give every gitlab.com call a token, starting with `CI_JOB_TOKEN` where it is allowed.
3. Count requests per runner egress IP, not per job.
4. Alert on `429` responses with `RateLimit-Name: unauthenticated_traffic_per_ip`. Do not wait for their `Retry-After`: in our tests the block ended about an hour after the first request of the current count from that address.
5. Before January, check your busiest hour against the Premium or Ultimate limits with `budget.py`.
