import { Award, ExternalLink } from 'lucide-react';
import type { Comparison, ToolInfo } from '@/lib/comparison-types';
import { GO_LINKS_ORIGIN } from '@/lib/sponsors';
import { ToolIcon, toolText, toolVars } from './tool-style';

/** The score as a ring, drawn in the tool's color. */
function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      className="relative h-16 w-16 shrink-0"
      role="img"
      aria-label={`Score ${score.toFixed(1)} out of 5`}
    >
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(score / 5) * circumference} ${circumference}`}
          className="stroke-[var(--tool)] dark:stroke-[var(--tool-dark)]"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold tabular-nums">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function Side({
  tool,
  score,
  wins,
  total,
  align,
}: {
  tool: ToolInfo;
  score: number;
  wins: number;
  total: number;
  align: 'left' | 'right';
}) {
  return (
    <div
      style={toolVars(tool.color)}
      className={`flex flex-col gap-3 ${align === 'right' ? 'md:items-end md:text-right' : ''}`}
    >
      <div className={`flex items-center gap-3 ${align === 'right' ? 'md:flex-row-reverse' : ''}`}>
        <ToolIcon name={tool.icon} color={tool.color} />
        <h2 className={`text-xl font-bold leading-tight ${toolText}`}>{tool.name}</h2>
      </div>
      <div className={`flex items-center gap-3 ${align === 'right' ? 'md:flex-row-reverse' : ''}`}>
        <ScoreRing score={score} />
        <div className="text-sm text-muted-foreground">
          <div className="font-medium text-foreground">{score.toFixed(1)} out of 5</div>
          {total > 0 && (
            <div className="tabular-nums">
              Best pick in {wins} of {total} situations
            </div>
          )}
        </div>
      </div>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
      <a
        href={tool.website}
        target="_blank"
        rel={
          tool.website.startsWith(`${GO_LINKS_ORIGIN}/`)
            ? 'noopener noreferrer sponsored'
            : 'noopener noreferrer'
        }
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        Visit website
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

/**
 * The two tools side by side, each on a wash of its own brand color, with the
 * verdict scores and the recommendation, so a reader gets the answer first.
 */
export function ComparisonMatchup({ comparison }: { comparison: Comparison }) {
  const { toolA, toolB, verdict, decisionMatrix } = comparison;
  const picks = (rec: 'toolA' | 'toolB') =>
    decisionMatrix.filter((d) => d.recommendation === rec).length;
  const a = toolVars(toolA.color) as Record<string, string>;
  const b = toolVars(toolB.color) as Record<string, string>;
  const vars = {
    '--a': a['--tool'],
    '--a-dark': a['--tool-dark'],
    '--b': b['--tool'],
    '--b-dark': b['--tool-dark'],
  } as React.CSSProperties;

  return (
    <section aria-label="At a glance" className="mb-10 overflow-hidden rounded-md border bg-card">
      <div
        style={vars}
        className="grid gap-6 p-5 sm:p-6 md:grid-cols-[1fr_auto_1fr] md:items-start bg-[linear-gradient(100deg,color-mix(in_srgb,var(--a)_9%,transparent),transparent_45%,transparent_55%,color-mix(in_srgb,var(--b)_9%,transparent))] dark:bg-[linear-gradient(100deg,color-mix(in_srgb,var(--a-dark)_10%,transparent),transparent_45%,transparent_55%,color-mix(in_srgb,var(--b-dark)_10%,transparent))]"
      >
        <Side
          tool={toolA}
          score={verdict.toolAScore}
          wins={picks('toolA')}
          total={decisionMatrix.length}
          align="left"
        />
        <div className="flex items-center justify-center md:pt-14" aria-hidden="true">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border bg-background font-mono text-xs font-bold text-muted-foreground">
            vs
          </span>
        </div>
        <Side
          tool={toolB}
          score={verdict.toolBScore}
          wins={picks('toolB')}
          total={decisionMatrix.length}
          align="right"
        />
      </div>
      <p className="flex items-start gap-2 border-t px-5 py-4 text-sm leading-relaxed sm:px-6">
        <Award className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          {verdict.recommendation}{' '}
          <a href="#verdict" className="whitespace-nowrap font-medium text-primary hover:underline">
            Read the verdict
          </a>
        </span>
      </p>
    </section>
  );
}
