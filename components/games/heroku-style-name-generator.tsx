'use client';

import { useMemo, useState } from 'react';
import { Copy, Check, Dices, RefreshCw } from 'lucide-react';

// Word pools modeled on the real generators: Heroku's haiku names
// (adjective-noun-number), Docker's adjective_scientist pairs, the
// petname adverb-adjective-animal scheme, and the Kubernetes pod
// suffix alphabet (no vowels or ambiguous glyphs, so no accidental
// words and no 0/O 1/l confusion).
const HEROKU_ADJECTIVES = [
  'aged', 'ancient', 'autumn', 'billowing', 'bitter', 'black', 'blue', 'bold',
  'broad', 'broken', 'calm', 'cold', 'cool', 'crimson', 'curly', 'damp',
  'dark', 'dawn', 'delicate', 'divine', 'dry', 'empty', 'falling', 'fancy',
  'flat', 'floral', 'fragrant', 'frosty', 'gentle', 'green', 'hidden', 'holy',
  'icy', 'jolly', 'late', 'lingering', 'little', 'lively', 'long', 'lucky',
  'misty', 'morning', 'muddy', 'mute', 'nameless', 'noisy', 'odd', 'old',
  'orange', 'patient', 'plain', 'polished', 'proud', 'purple', 'quiet', 'rapid',
  'raspy', 'red', 'restless', 'rough', 'round', 'royal', 'shiny', 'shrill',
  'shy', 'silent', 'small', 'snowy', 'soft', 'solitary', 'sparkling', 'spring',
  'square', 'steep', 'still', 'summer', 'super', 'sweet', 'throbbing', 'tight',
  'tiny', 'twilight', 'wandering', 'weathered', 'white', 'wild', 'winter', 'wispy',
  'withered', 'yellow', 'young',
];

const HEROKU_NOUNS = [
  'art', 'band', 'bar', 'base', 'bird', 'block', 'boat', 'bonus',
  'bread', 'breeze', 'brook', 'bush', 'butterfly', 'cake', 'cell', 'cherry',
  'cloud', 'credit', 'darkness', 'dawn', 'dew', 'disk', 'dream', 'dust',
  'feather', 'field', 'fire', 'firefly', 'flower', 'fog', 'forest', 'frog',
  'frost', 'glade', 'glitter', 'grass', 'hall', 'hat', 'haze', 'heart',
  'hill', 'king', 'lab', 'lake', 'leaf', 'limit', 'math', 'meadow',
  'mode', 'moon', 'morning', 'mountain', 'mouse', 'mud', 'night', 'paper',
  'pine', 'poetry', 'pond', 'queen', 'rain', 'recipe', 'resonance', 'rice',
  'river', 'salad', 'scene', 'sea', 'shadow', 'shape', 'silence', 'sky',
  'smoke', 'snow', 'snowflake', 'sound', 'star', 'sun', 'sunset', 'surf',
  'term', 'thunder', 'tooth', 'tree', 'truth', 'union', 'unit', 'violet',
  'voice', 'water', 'waterfall', 'wave', 'wildflower', 'wind', 'wood',
];

const DOCKER_ADJECTIVES = [
  'admiring', 'adoring', 'affectionate', 'agitated', 'amazing', 'angry', 'awesome', 'beautiful',
  'blissful', 'bold', 'boring', 'brave', 'busy', 'charming', 'clever', 'compassionate',
  'competent', 'condescending', 'confident', 'cranky', 'crazy', 'dazzling', 'determined', 'distracted',
  'dreamy', 'eager', 'ecstatic', 'elastic', 'elated', 'elegant', 'eloquent', 'epic',
  'exciting', 'fervent', 'festive', 'flamboyant', 'focused', 'friendly', 'frosty', 'funny',
  'gallant', 'gifted', 'goofy', 'gracious', 'great', 'happy', 'hardcore', 'heuristic',
  'hopeful', 'hungry', 'infallible', 'inspiring', 'intelligent', 'interesting', 'jolly', 'jovial',
  'keen', 'kind', 'laughing', 'loving', 'lucid', 'magical', 'modest', 'musing',
  'mystifying', 'naughty', 'nervous', 'nice', 'nifty', 'nostalgic', 'objective', 'optimistic',
  'peaceful', 'pedantic', 'pensive', 'practical', 'priceless', 'quirky', 'quizzical', 'recursing',
  'relaxed', 'reverent', 'romantic', 'sad', 'serene', 'sharp', 'silly', 'sleepy',
  'stoic', 'strange', 'stupefied', 'suspicious', 'sweet', 'tender', 'thirsty', 'trusting',
  'unruffled', 'upbeat', 'vibrant', 'vigilant', 'vigorous', 'wizardly', 'wonderful', 'xenodochial',
  'youthful', 'zealous', 'zen',
];

const DOCKER_SCIENTISTS = [
  'agnesi', 'albattani', 'allen', 'almeida', 'archimedes', 'ardinghelli', 'aryabhata', 'austin',
  'babbage', 'banach', 'bardeen', 'bartik', 'bassi', 'bell', 'blackwell', 'bohr',
  'booth', 'borg', 'bose', 'boyd', 'brahmagupta', 'brattain', 'brown', 'carson',
  'chandrasekhar', 'chatterjee', 'clarke', 'colden', 'cori', 'cray', 'curie', 'darwin',
  'davinci', 'dijkstra', 'dubinsky', 'easley', 'edison', 'einstein', 'elion', 'engelbart',
  'euclid', 'euler', 'fermat', 'fermi', 'feynman', 'franklin', 'galileo', 'gates',
  'goldberg', 'goldstine', 'goodall', 'grothendieck', 'haibt', 'hamilton', 'hawking', 'heisenberg',
  'hermann', 'herschel', 'hertz', 'heyrovsky', 'hodgkin', 'hoover', 'hopper', 'hugle',
  'hypatia', 'jackson', 'jang', 'jennings', 'jepsen', 'johnson', 'joliot', 'jones',
  'kalam', 'kare', 'keller', 'kepler', 'khorana', 'kilby', 'kirch', 'knuth',
  'kowalevski', 'lalande', 'lamarr', 'lamport', 'leakey', 'leavitt', 'lederberg', 'lehmann',
  'lewin', 'lichterman', 'liskov', 'lovelace', 'lumiere', 'mahavira', 'margulis', 'matsumoto',
  'maxwell', 'mayer', 'mccarthy', 'mcclintock', 'mclaren', 'mclean', 'mcnulty', 'meitner',
  'mendel', 'mendeleev', 'meninsky', 'merkle', 'mestorf', 'minsky', 'mirzakhani', 'moore',
  'morse', 'murdock', 'moser', 'napier', 'nash', 'neumann', 'newton', 'nightingale',
  'nobel', 'noether', 'northcutt', 'noyce', 'panini', 'pare', 'pascal', 'pasteur',
  'payne', 'perlman', 'pike', 'poincare', 'poitras', 'proskuriakova', 'ptolemy', 'raman',
  'ramanujan', 'ride', 'ritchie', 'rhodes', 'robinson', 'roentgen', 'rosalind', 'rubin',
  'saha', 'sammet', 'sanderson', 'shannon', 'shaw', 'shirley', 'shockley', 'shtern',
  'sinoussi', 'snyder', 'solomon', 'spence', 'stonebraker', 'sutherland', 'swanson', 'swartz',
  'swirles', 'taussig', 'tereshkova', 'tesla', 'tharp', 'thompson', 'torvalds', 'tu',
  'turing', 'varahamihira', 'vaughan', 'visvesvaraya', 'volhard', 'villani', 'wescoff', 'wilbur',
  'wiles', 'williams', 'williamson', 'wilson', 'wing', 'wozniak', 'wright', 'wu',
  'yalow', 'yonath', 'zhukovsky',
];

const PETNAME_ADVERBS = [
  'absurdly', 'badly', 'barely', 'blindly', 'boldly', 'bravely', 'briefly', 'broadly',
  'calmly', 'cheaply', 'cruelly', 'daily', 'deeply', 'directly', 'early', 'easily',
  'equally', 'evenly', 'exactly', 'fairly', 'fast', 'fondly', 'freely', 'gently',
  'gladly', 'greatly', 'happily', 'hardly', 'highly', 'hugely', 'kindly', 'lately',
  'lightly', 'loudly', 'madly', 'mainly', 'mildly', 'mostly', 'neatly', 'nicely',
  'oddly', 'openly', 'overly', 'plainly', 'poorly', 'proudly', 'quickly', 'quietly',
  'rarely', 'readily', 'really', 'rightly', 'roughly', 'sadly', 'safely', 'secretly',
  'sharply', 'shortly', 'shyly', 'simply', 'slowly', 'smoothly', 'softly', 'solely',
  'strictly', 'strongly', 'subtly', 'suddenly', 'surely', 'tightly', 'truly', 'utterly',
  'vastly', 'vaguely', 'warmly', 'wholly', 'widely', 'wildly', 'wisely', 'yearly',
];

const PETNAME_ANIMALS = [
  'ant', 'badger', 'bat', 'bear', 'bee', 'beetle', 'bison', 'boar',
  'camel', 'cat', 'cheetah', 'cobra', 'condor', 'cougar', 'coyote', 'crab',
  'crane', 'crow', 'deer', 'dingo', 'dodo', 'dolphin', 'donkey', 'dove',
  'dragon', 'duck', 'eagle', 'eel', 'elk', 'falcon', 'ferret', 'finch',
  'fox', 'frog', 'gecko', 'gibbon', 'goat', 'goose', 'gopher', 'gorilla',
  'grouse', 'gull', 'hamster', 'hare', 'hawk', 'hedgehog', 'heron', 'horse',
  'hound', 'husky', 'ibex', 'iguana', 'impala', 'jackal', 'jaguar', 'kitten',
  'koala', 'lark', 'lemur', 'leopard', 'lion', 'lizard', 'llama', 'lynx',
  'macaw', 'mackerel', 'mallard', 'mammoth', 'manatee', 'mantis', 'marlin', 'marmot',
  'mole', 'moose', 'moth', 'mouse', 'mule', 'newt', 'ocelot', 'octopus',
  'orca', 'osprey', 'otter', 'owl', 'ox', 'panda', 'panther', 'parrot',
  'pelican', 'penguin', 'pheasant', 'phoenix', 'pigeon', 'pony', 'possum', 'puffin',
  'puma', 'quail', 'rabbit', 'raccoon', 'ram', 'raven', 'rhino', 'robin',
  'salmon', 'seal', 'shark', 'sheep', 'shrew', 'skunk', 'sloth', 'snail',
  'snake', 'sparrow', 'spider', 'squid', 'squirrel', 'stork', 'swan', 'tiger',
  'toad', 'trout', 'tuna', 'turkey', 'turtle', 'viper', 'vulture', 'walrus',
  'wasp', 'weasel', 'whale', 'wolf', 'wombat', 'wren', 'yak', 'zebra',
];

// The alphanumeric alphabet Kubernetes uses for generated pod-name
// suffixes: vowels and 0/1/o/i/l removed so it never spells words and
// never confuses similar glyphs.
const K8S_ALPHANUMS = 'bcdfghjklmnpqrstvwxz2456789';
const K8S_DEPLOYMENTS = [
  'api', 'auth', 'billing', 'cache', 'checkout', 'frontend', 'gateway', 'ingest',
  'mailer', 'metrics', 'orders', 'payments', 'scheduler', 'search', 'users', 'worker',
];

type StyleId = 'heroku' | 'docker' | 'petname' | 'k8s';

interface NameStyle {
  id: StyleId;
  label: string;
  origin: string;
  pattern: string;
  example: string;
  poolSize: number;
  poolFormula: string;
  generate: () => { parts: { text: string; role: string }[]; separator: string };
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomK8sString(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += pick(K8S_ALPHANUMS.split(''));
  return out;
}

const STYLES: NameStyle[] = [
  {
    id: 'heroku',
    label: 'Heroku app',
    origin: 'Heroku generates a name for every app you create without --app',
    pattern: 'adjective-noun-number',
    example: 'misty-meadow-1247',
    poolSize: HEROKU_ADJECTIVES.length * HEROKU_NOUNS.length * 9000,
    poolFormula: `${HEROKU_ADJECTIVES.length} adjectives x ${HEROKU_NOUNS.length} nouns x 9,000 numbers`,
    generate: () => ({
      separator: '-',
      parts: [
        { text: pick(HEROKU_ADJECTIVES), role: 'adjective' },
        { text: pick(HEROKU_NOUNS), role: 'noun' },
        { text: String(1000 + Math.floor(Math.random() * 9000)), role: 'number' },
      ],
    }),
  },
  {
    id: 'docker',
    label: 'Docker container',
    origin: 'Docker names unnamed containers from names-generator.go in the Moby repo',
    pattern: 'adjective_scientist',
    example: 'nostalgic_turing',
    poolSize: DOCKER_ADJECTIVES.length * DOCKER_SCIENTISTS.length,
    poolFormula: `${DOCKER_ADJECTIVES.length} adjectives x ${DOCKER_SCIENTISTS.length} scientists and engineers`,
    generate: () => {
      // The real generator retries on boring_wozniak: "Steve Wozniak is not boring"
      let adjective = pick(DOCKER_ADJECTIVES);
      let scientist = pick(DOCKER_SCIENTISTS);
      while (adjective === 'boring' && scientist === 'wozniak') {
        adjective = pick(DOCKER_ADJECTIVES);
        scientist = pick(DOCKER_SCIENTISTS);
      }
      return {
        separator: '_',
        parts: [
          { text: adjective, role: 'adjective' },
          { text: scientist, role: 'scientist' },
        ],
      };
    },
  },
  {
    id: 'petname',
    label: 'Petname release',
    origin: 'The petname scheme behind Ubuntu-style codenames and Vercel-like previews',
    pattern: 'adverb-adjective-animal',
    example: 'wildly-brave-otter',
    poolSize: PETNAME_ADVERBS.length * DOCKER_ADJECTIVES.length * PETNAME_ANIMALS.length,
    poolFormula: `${PETNAME_ADVERBS.length} adverbs x ${DOCKER_ADJECTIVES.length} adjectives x ${PETNAME_ANIMALS.length} animals`,
    generate: () => ({
      separator: '-',
      parts: [
        { text: pick(PETNAME_ADVERBS), role: 'adverb' },
        { text: pick(DOCKER_ADJECTIVES), role: 'adjective' },
        { text: pick(PETNAME_ANIMALS), role: 'animal' },
      ],
    }),
  },
  {
    id: 'k8s',
    label: 'Kubernetes pod',
    origin: 'A Deployment stamps pods with a ReplicaSet hash plus a random suffix',
    pattern: 'deployment-hash-suffix',
    example: 'api-7d9f8b6c4d-x2n9z',
    poolSize: Math.pow(K8S_ALPHANUMS.length, 5),
    poolFormula: `27 safe characters ^ 5 positions (per ReplicaSet)`,
    generate: () => ({
      separator: '-',
      parts: [
        { text: pick(K8S_DEPLOYMENTS), role: 'deployment' },
        { text: randomK8sString(9), role: 'pod-template-hash' },
        { text: randomK8sString(5), role: 'random suffix' },
      ],
    }),
  },
];

const ROLE_COLORS: Record<string, string> = {
  adjective: 'text-emerald-500',
  noun: 'text-sky-500',
  number: 'text-amber-500',
  scientist: 'text-sky-500',
  adverb: 'text-fuchsia-500',
  animal: 'text-amber-500',
  deployment: 'text-emerald-500',
  'pod-template-hash': 'text-sky-500',
  'random suffix': 'text-amber-500',
};

// Birthday-problem approximation: how many names before a 50% chance
// that two of them collide.
function fiftyPercentCollisionCount(poolSize: number): number {
  return Math.ceil(1.1774 * Math.sqrt(poolSize));
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

interface GeneratedName {
  styleId: StyleId;
  parts: { text: string; role: string }[];
  separator: string;
}

export default function HerokuStyleNameGenerator() {
  const [styleId, setStyleId] = useState<StyleId>('heroku');
  const [current, setCurrent] = useState<GeneratedName | null>(null);
  const [history, setHistory] = useState<GeneratedName[]>([]);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const style = useMemo(() => STYLES.find((s) => s.id === styleId)!, [styleId]);

  const generate = () => {
    setSpinning(true);
    setCopied(false);
    // A short reel: flash a few throwaway names before settling.
    const flashes = 6;
    let i = 0;
    const tick = () => {
      const name = { styleId, ...style.generate() };
      setCurrent(name);
      i++;
      if (i < flashes) {
        setTimeout(tick, 60 + i * 25);
      } else {
        setSpinning(false);
        setGeneratedCount((c) => c + 1);
        setHistory((h) => [name, ...h].slice(0, 8));
      }
    };
    tick();
  };

  const nameToString = (n: GeneratedName) => n.parts.map((p) => p.text).join(n.separator);

  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(nameToString(current));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable in some embedded contexts; ignore.
    }
  };

  const collisionAt = fiftyPercentCollisionCount(style.poolSize);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Style picker */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setStyleId(s.id);
              setCurrent(null);
              setCopied(false);
            }}
            className={`rounded-lg border p-3 text-left transition-colors ${
              s.id === styleId
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <div className="font-semibold text-sm">{s.label}</div>
            <div className="mt-1 font-mono text-xs text-muted-foreground truncate">{s.example}</div>
          </button>
        ))}
      </div>

      {/* Display */}
      <div className="rounded-xl border border-border bg-card p-6 md:p-10 text-center space-y-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {style.pattern}
        </div>
        <div
          className={`font-mono text-2xl md:text-4xl font-bold break-all min-h-[3rem] flex items-center justify-center ${
            spinning ? 'opacity-60' : ''
          }`}
          aria-live="polite"
        >
          {current ? (
            <span>
              {current.parts.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-muted-foreground">{current.separator}</span>}
                  <span className={ROLE_COLORS[p.role] ?? ''}>{p.text}</span>
                </span>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground/60">press generate</span>
          )}
        </div>

        {current && !spinning && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {current.parts.map((p, i) => (
              <span key={i}>
                <span className={`font-semibold ${ROLE_COLORS[p.role] ?? ''}`}>{p.text}</span>{' '}
                = {p.role}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={generate}
            disabled={spinning}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {current ? <RefreshCw className="h-4 w-4" /> : <Dices className="h-4 w-4" />}
            {current ? 'Generate another' : 'Generate a name'}
          </button>
          {current && !spinning && (
            <button
              onClick={copy}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      {/* Namespace math */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Namespace size</div>
          <div className="mt-1 text-2xl font-bold font-mono">{formatCount(style.poolSize)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{style.poolFormula}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            50% collision after
          </div>
          <div className="mt-1 text-2xl font-bold font-mono">~{formatCount(collisionAt)} names</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Birthday problem: about 1.18 x sqrt(pool). Random names collide far sooner than the
            pool size suggests.
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Where it's from</div>
          <div className="mt-2 text-sm text-muted-foreground">{style.origin}</div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-semibold">Recent names</div>
            <div className="text-xs text-muted-foreground">{generatedCount} generated</div>
          </div>
          <ul className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-muted-foreground">
            {history.map((n, i) => (
              <li key={`${nameToString(n)}-${i}`} className="truncate">
                {nameToString(n)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
