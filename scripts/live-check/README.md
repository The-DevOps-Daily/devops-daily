# Live site check

Runs every 6 hours against devops-daily.com (`.github/workflows/live-site-check.yml`):
a quarter of the sponsored pages (all of them once a day) plus 40 random pages from
the sitemap, desktop and phone. Analytics, ads and the sponsor tracker are blocked,
so checks never count as views or clicks. Failures post to Discord when the
`DISCORD_ALERT_WEBHOOK` secret is set.

Replay a run locally with its printed seed:

```bash
LIVE_CHECK_SEED=123 npx tsx scripts/live-check/pick-pages.ts /tmp/pages.json
LIVE_CHECK_PAGES=/tmp/pages.json pnpm test:live
```

`LIVE_CHECK_SAMPLE` changes the random sample size, `LIVE_CHECK_ALL_SPONSORED=1`
checks every sponsored page, and `LIVE_CHECK_CHROMIUM=/usr/bin/chromium` uses a
system Chromium.
