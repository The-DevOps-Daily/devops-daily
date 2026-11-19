import { Digest } from '../crawler/types.js';
import { DigestWindow, shortDateUtc } from '../utils/date.js';
import { getDigestStats } from './assemble.js';

export interface PrBodyInput {
  digest: Digest;
  window: DigestWindow;
  newsSources: number;
  releaseSources: number;
  failedSources: string[];
}

/**
 * Feed text in a code span: GitHub does not turn "@name" or "#123" inside it
 * into a mention or a link.
 */
function codeSpan(text: string): string {
  return `\`${text.replace(/`/g, "'").replace(/\s+/g, ' ').trim()}\``;
}

/** The pull request description for the weekly digest. */
export function buildPrBody(input: PrBodyInput): string {
  const { digest, window, newsSources, releaseSources, failedSources } = input;
  const stats = getDigestStats(digest);
  const last = new Date(window.end.getTime() - 1);
  const lines = [
    `Weekly digest for week ${window.week}, ${window.year}: news from ${shortDateUtc(window.start)} to ${shortDateUtc(last)}.`,
    '',
    `- Sources: ${newsSources} news feeds and ${releaseSources} release feeds (sources.yaml)`,
    `- Items: ${stats.totalItems} news items, ${digest.releases.length} projects with releases, ${digest.ownPosts.length} DevOps Daily posts`,
  ];
  if (failedSources.length > 0) {
    lines.push(
      `- Feeds that failed this run (${failedSources.length}): ${failedSources.join(', ')}`
    );
  }
  lines.push('', 'Top 3:');
  digest.topPicks.forEach((item, i) => {
    lines.push(`${i + 1}. ${codeSpan(item.title)} (${item.source})`);
  });
  lines.push('', 'Review: Claude adds the intro and merges on Monday.');
  return `${lines.join('\n')}\n`;
}
