export interface AdventContentParts {
  before: string;
  solution: string;
  after: string;
}

const SOLUTION_HEADING = /^## Solution\s*$/;
// The hidden part (Solution, Explanation) ends at the first of these headings.
const VISIBLE_HEADING = /^## (Result|Validation|Links|Share Your Success)\b/;
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/**
 * Splits an Advent day at "## Solution" so the solution can sit behind a
 * reveal. Headings inside fenced code blocks do not count: some days show
 * README templates that contain "## Links" or similar lines.
 * Returns null when the day has no solution section.
 */
export function splitAdventSolution(content: string): AdventContentParts | null {
  const lines = content.split('\n');
  let openFence: string | null = null;
  let solutionStart = -1;
  let afterStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const fence = FENCE.exec(lines[i]);

    if (openFence) {
      const closes =
        fence !== null &&
        fence[1][0] === openFence[0] &&
        fence[1].length >= openFence.length &&
        fence[2].trim() === '';
      if (closes) openFence = null;
      continue;
    }

    if (fence) {
      openFence = fence[1];
      continue;
    }

    if (solutionStart === -1) {
      if (SOLUTION_HEADING.test(lines[i])) solutionStart = i;
    } else if (VISIBLE_HEADING.test(lines[i])) {
      afterStart = i;
      break;
    }
  }

  if (solutionStart === -1) return null;

  const end = afterStart === -1 ? lines.length : afterStart;
  return {
    before: lines.slice(0, solutionStart).join('\n'),
    solution: lines.slice(solutionStart, end).join('\n'),
    after: afterStart === -1 ? '' : lines.slice(afterStart).join('\n'),
  };
}
