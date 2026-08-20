import type { Metadata } from 'next';
import HerokuStyleNameGenerator from '@/components/games/heroku-style-name-generator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('heroku-style-name-generator');
}

function NameGeneratorEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Why tools generate silly names</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Heroku apps, Docker containers, and Kubernetes pods all need unique identifiers, and
        humans are terrible at remembering hex strings. So platforms combine small word lists
        into names like <code>misty-meadow-1247</code>: easy to say in an incident call, easy to
        spot in logs, and unique enough for the job.
      </p>
      <ul className="mb-4 space-y-2 text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">Heroku</strong> pairs an adjective with a nature
          noun and a number for every app created without an explicit name.
        </li>
        <li>
          <strong className="text-foreground">Docker</strong> pairs an adjective with a notable
          scientist or engineer (from <code>names-generator.go</code> in the Moby repo). The code
          famously refuses to generate <code>boring_wozniak</code>.
        </li>
        <li>
          <strong className="text-foreground">Kubernetes</strong> goes the other way: pod
          suffixes use a 27-character alphabet with vowels and confusable characters removed, so
          a random suffix can never spell a rude word or mix up 0 and O.
        </li>
      </ul>
      <p className="mb-4 text-sm text-muted-foreground">
        The namespace-size panel shows the trade-off: word lists keep names memorable but make
        the pool small, and the birthday problem means collisions show up around the square root
        of the pool size. That is why Heroku appends a number and Kubernetes retries on conflict.
      </p>
      <p className="text-sm text-muted-foreground">
        Building your own? Libraries like haikunator and petname implement these schemes in most
        languages, and the same rules apply: filter your word lists, plan for collisions, and
        keep the names DNS-safe (lowercase, digits, hyphens).
      </p>
    </>
  );
}

export default function HerokuStyleNameGeneratorPage() {
  return (
    <SimulatorShell
      slug="heroku-style-name-generator"
      educational={<NameGeneratorEducational />}
      shareText="Try the Heroku-Style Name Generator! See how Heroku, Docker, and Kubernetes invent names, and when they collide."
      seoLearningPoints={[
        'How Heroku builds app names from adjective-noun-number word lists',
        "Why Docker's names-generator.go pairs adjectives with famous scientists",
        'Why Kubernetes pod suffixes use a 27-character alphabet with no vowels',
        'The birthday problem: why name collisions appear near the square root of the pool size',
        'How to design DNS-safe, human-friendly identifiers for your own tools',
      ]}
    >
      <HerokuStyleNameGenerator />
    </SimulatorShell>
  );
}
