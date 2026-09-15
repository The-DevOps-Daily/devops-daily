import type { Metadata } from 'next';
import YamlParsingSimulator from '@/components/games/yaml-parsing-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('yaml-parsing-simulator');
}

const seoLearningPoints = [
  'Why `country: NO` becomes the boolean false, and which parsers do it',
  'Why `version: 1.10` is a lower number than `version: 1.9`',
  'How YAML 1.1 and YAML 1.2 disagree about the same file, and why that matters',
  'The difference between an empty value, `~`, `null` and an empty string',
  'When a leading zero means octal and when it means decimal',
  'What `|` and `>` do to the newlines in a CI script',
  'Why a tab in indentation is rejected and so hard to spot',
  'Why quoting is the fix for nearly all of it',
];

function YamlEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this YAML parsing simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>That YAML resolves your untagged values into types, and which ones surprise people</li>
            <li>That YAML 1.1 and YAML 1.2 disagree, so the same file means different things in different tools</li>
            <li>Why the failures are quiet: nothing errors, a value just stops being what you meant</li>
            <li>The two-character fix, and when you actually need it</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>The parser is real and runs in your browser. Nothing here is a canned answer.</li>
            <li>Every document is read twice, once under each spec, and the differences are listed.</li>
            <li>Edit any example. Your own YAML is resolved by the same rules.</li>
          </ul>
        </div>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        The behaviour shown here follows the{' '}
        <a href="https://yaml.org/spec/1.2.2/" target="_blank" rel="noopener noreferrer" className="underline">
          YAML 1.2.2 specification
        </a>{' '}
        and the older{' '}
        <a href="https://yaml.org/type/bool.html" target="_blank" rel="noopener noreferrer" className="underline">
          YAML 1.1 boolean type
        </a>
        , which is the one that turns Norway into false. Most tools still ship a 1.1-era resolver:
        that is not a bug in your file, it is a disagreement between versions of the format.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Related: the{' '}
        <a href="/games/kubernetes-terminal-simulator" className="underline">
          Kubernetes terminal simulator
        </a>{' '}
        for the manifests this bites hardest, and the{' '}
        <a href="/games/git-concepts-simulator" className="underline">
          Git concepts simulator
        </a>{' '}
        for the other thing everyone learns by breaking it.
      </p>
    </>
  );
}

export default function Page() {
  return (
    <SimulatorShell
      slug="yaml-parsing-simulator"
      educational={<YamlEducational />}
      seoLearningPoints={seoLearningPoints}
    >
      <YamlParsingSimulator />
    </SimulatorShell>
  );
}
