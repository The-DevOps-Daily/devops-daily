import fs from 'node:fs/promises';

type Attachment = { name?: string; path?: string; contentType?: string };
type TestResult = { status?: string; error?: { message?: string }; attachments?: Attachment[] };
type ReportTest = {
  title?: string;
  status?: string;
  outcome?: string;
  results?: TestResult[];
};
type ReportSuite = {
  suites?: ReportSuite[];
  specs?: Array<{ title?: string; tests?: ReportTest[] }>;
};
type Report = { suites?: ReportSuite[] };

export type FailureSummary = {
  failed: Array<{ url: string; reason: string }>;
  total: number;
  screenshots: string[];
};

function firstLine(value: string | undefined) {
  return (
    (value ?? 'test failed')
      .replace(/\u001b\[[0-9;]*m/g, '')
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? 'test failed'
  );
}

// The page is in the spec title; the per-project test entries carry no title.
function allTests(suites: ReportSuite[] = []): ReportTest[] {
  return suites.flatMap((suite) => [
    ...(suite.specs?.flatMap((spec) =>
      (spec.tests ?? []).map((test) => ({ ...test, title: test.title ?? spec.title }))
    ) ?? []),
    ...allTests(suite.suites),
  ]);
}

function urlFromTitle(title: string | undefined) {
  const match = title?.match(/\/(?:[^\s]*)$/);
  return match ? `https://devops-daily.com${match[0]}` : (title ?? 'unknown page');
}

export function summarizeFailures(report: Report): FailureSummary {
  const byUrl = new Map<string, { url: string; reason: string }>();
  const screenshots: string[] = [];
  const tests = allTests(report.suites);

  for (const test of tests) {
    const failed =
      test.outcome === 'unexpected' ||
      test.status === 'unexpected' ||
      test.status === 'failed' ||
      test.status === 'timedOut';
    if (!failed) continue;
    const result =
      [...(test.results ?? [])].reverse().find((item) => item.error?.message) ??
      test.results?.at(-1);
    const url = urlFromTitle(test.title);
    byUrl.set(url, { url, reason: firstLine(result?.error?.message) });
    for (const attachment of result?.attachments ?? []) {
      if (attachment.contentType === 'image/png' && attachment.path) {
        screenshots.push(attachment.path);
      }
    }
  }

  return {
    failed: [...byUrl.values()],
    total: new Set(tests.map((test) => urlFromTitle(test.title))).size,
    screenshots,
  };
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    throw new Error('Usage: tsx report-failures.ts <live-report.json> [--github-output <path>]');
  }

  const report = JSON.parse(await fs.readFile(reportPath, 'utf8')) as Report;
  const summary = summarizeFailures(report);
  const seed = process.env.LIVE_CHECK_SEED ?? 'unknown';
  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined;
  const lines = [
    `Live site check failed: ${summary.failed.length} of ${summary.total} pages`,
    `Seed: ${seed}`,
    ...summary.failed
      .slice(0, 10)
      .map((failure) => `- ${failure.url}: ${failure.reason.slice(0, 160)}`),
    ...(runUrl ? [`Run: ${runUrl}`] : []),
  ];
  const payloadPath = readArgument('--discord-payload');
  // Discord rejects messages over 2,000 characters.
  if (payloadPath) {
    await fs.writeFile(payloadPath, JSON.stringify({ content: lines.join('\n').slice(0, 1990) }));
  }
  const githubOutput = readArgument('--github-output');
  if (githubOutput) {
    await fs.appendFile(
      githubOutput,
      `failed=${summary.failed.length}\ntotal=${summary.total}\nscreenshots<<LIVE_CHECK_SCREENSHOTS\n${summary.screenshots.slice(0, 2).join('\n')}\nLIVE_CHECK_SCREENSHOTS\n`
    );
  }
  if (process.argv.includes('--print-screenshots')) {
    console.log(summary.screenshots.slice(0, 2).join('\n'));
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
}

if (process.argv[1]?.endsWith('report-failures.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
