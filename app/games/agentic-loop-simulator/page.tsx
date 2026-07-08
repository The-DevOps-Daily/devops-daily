import type { Metadata } from 'next';
import AgenticLoopSimulator from '@/components/games/agentic-loop-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('agentic-loop-simulator');
}

const seoLearningPoints = [
  'What an agentic loop is: plan, build, judge, then repeat until the goal is met',
  'Why a coding agent finishes multi-step work on its own instead of answering once',
  'How the decision at the end of each loop chooses to keep going or stop',
  'Why the judge should be a separate agent, and what happens when it is not',
  'Why token cost compounds as the context window grows each loop',
  'How the phases map to Claude Code: subagents, the Read/Edit/Bash tools, and a stop condition',
];

function AgenticLoopEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this agentic loop simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How a coding agent runs a loop instead of answering a single prompt</li>
            <li>The three roles: a planner picks the next step, a builder does it, a judge checks it</li>
            <li>Why &quot;the tests pass&quot; is not the same as &quot;the goal is met&quot;</li>
            <li>Why the judge being a separate agent is what stops the loop shipping confident bugs</li>
            <li>How the context window grows each loop, and why that makes cost climb</li>
            <li>What each phase maps to in Claude Code</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How the loop works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Plan:</strong> gather the goal and the last result,
              decide the single next step
            </li>
            <li>
              <strong className="text-foreground">Build:</strong> take one action, read a file, edit
              code, run a command
            </li>
            <li>
              <strong className="text-foreground">Judge:</strong> grade the result against the goal and
              the spec, not just the tests
            </li>
            <li>
              <strong className="text-foreground">Decide:</strong> goal met means stop, not met means
              loop back to plan
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Watch the verifier make the difference</h4>
        <p className="text-sm text-muted-foreground">
          The single most important control in the simulator is the &quot;separate judge agent&quot;
          toggle. With it on, a second agent reviews the work against the spec and catches a status
          code the builder got wrong. Turn it off and the builder grades its own work, sees green tests,
          and stops, shipping a confident bug. That is the whole reason serious agent loops split the
          agent that writes the code from the agent that checks it.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">How this maps to Claude Code</h4>
        <p className="text-sm text-muted-foreground">
          Plan and Judge are the kind of work you hand to a subagent, often a different model, so the
          judge is not grading its own homework. Build is the main agent using the Read, Edit, and Bash
          tools. The loop runs until a goal condition or a turn limit, the same way a real harness keeps
          an agent going until the work is actually done.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Go deeper</h4>
        <p className="text-sm text-muted-foreground">
          The companion post,{' '}
          <a
            href="https://devops-daily.com/posts/stop-prompting-start-looping"
            className="font-medium text-primary underline underline-offset-2"
          >
            Stop Prompting, Start Looping
          </a>
          , covers why engineers at Anthropic, NVIDIA, and beyond say the job is shifting from writing
          prompts to designing loops, and what actually makes a loop reliable rather than an expensive
          way to ship bugs.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why learn it this way?</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>The loop is a simple cycle, but it is the thing that turns a chatbot into an agent.</li>
          <li>Seeing the plan, build, and judge steps hand off makes the pattern concrete.</li>
          <li>Watching an unverified loop finish wrong is the fastest way to learn why verification matters.</li>
        </ul>
      </div>
    </>
  );
}

export default function AgenticLoopSimulatorPage() {
  return (
    <SimulatorShell
      slug="agentic-loop-simulator"
      fallbackTitle="Agentic Loop Simulator"
      fallbackDescription="Watch a coding agent's loop work, one step at a time. A planner, a builder, and a judge cycle through plan, build, verify, and repeat until the goal is met, with a toggle that shows why the judge should be a separate agent."
      educational={<AgenticLoopEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Watch how a coding agent's loop actually works: plan, build, judge, repeat. An interactive agentic loop simulator."
    >
      <AgenticLoopSimulator />
    </SimulatorShell>
  );
}
