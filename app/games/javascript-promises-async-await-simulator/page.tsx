import type { Metadata } from 'next';
import JavascriptPromisesAsyncSimulator from '@/components/games/javascript-promises-async-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('javascript-promises-async-await-simulator');
}

function JavascriptPromisesEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this JavaScript async simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Why synchronous code runs before promise callbacks and timers</li>
            <li>How fulfilled, rejected, and pending promise states affect handler execution</li>
            <li>Why promise callbacks are microtasks, while timers are tasks</li>
            <li>How async functions run until await and then resume later</li>
            <li>How catch and finally behave after a promise rejection</li>
            <li>How Promise.all waits for several async operations at once</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Visual model covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Call stack:</strong> currently executing
              synchronous JavaScript
            </li>
            <li>
              <strong className="text-foreground">Runtime APIs:</strong> timers, network work, and
              other browser or runtime-owned async work
            </li>
            <li>
              <strong className="text-foreground">Microtask queue:</strong> promise handlers,
              queueMicrotask callbacks, and async function continuations
            </li>
            <li>
              <strong className="text-foreground">Task queue:</strong> timer and event callbacks
              that run after microtasks drain
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Inspired by a classic visual guide</h4>
        <p className="text-sm text-muted-foreground">
          This simulator is an original interactive companion inspired by Lydia Hallie&apos;s popular
          JavaScript visualized article on promises and async/await. It uses its own diagrams and
          step logic while covering the same core mental models.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Browser-safe by design</h4>
        <p className="text-sm text-muted-foreground">
          The simulator does not execute arbitrary JavaScript. Each scenario is modeled as a
          deterministic event-loop trace so learners can step backward, make predictions, and see
          exactly why the output order changes.
        </p>
      </div>
    </>
  );
}

export default function JavascriptPromisesAsyncAwaitSimulatorPage() {
  return (
    <SimulatorShell
      slug="javascript-promises-async-await-simulator"
      fallbackTitle="JavaScript Promises & Async/Await Simulator"
      fallbackDescription="Visualize JavaScript promises, async/await, microtasks, task queues, setTimeout ordering, rejection handling, and Promise.all with an interactive browser simulator."
      educational={<JavascriptPromisesEducational />}
      shareText="Learn JavaScript promises, microtasks, and async/await with this interactive event-loop simulator."
    >
      <JavascriptPromisesAsyncSimulator />
    </SimulatorShell>
  );
}
