import type { Metadata } from 'next';
import BinaryByteSimulator from '@/components/games/binary-byte-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('binary-byte-simulator');
}

const seoLearningPoints = [
  'How binary works: each bit is a place value, and the number is the lit places added up',
  'Why a byte holds 0 to 255, and why colour channels and IPv4 octets stop at 255 too',
  'How a carry ripples along the bits when you count upward',
  'How chmod numbers work: why 755 and 644 mean what they mean, and how they map to rwxr-xr-x',
  'Why an SSH private key needs 600, and why 777 is almost never the right answer',
  'How a subnet mask is built from bits, why it must be a solid run of 1s, and where /24 and /26 come from',
  'Why shifting bits left doubles a number and shifting right halves it',
];

function BinaryEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this binary simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>What a bit and a byte actually are, by flipping them yourself</li>
            <li>How to read any binary number without doing arithmetic in your head</li>
            <li>Where chmod numbers come from, and how to build one from scratch</li>
            <li>How a subnet mask is really just a run of 1s, and what the slash number counts</li>
            <li>Why counting in binary makes a carry travel along the bits</li>
            <li>What a bit shift does to a value, and why it is used as fast multiply and divide</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">The three modes</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Byte:</strong> eight bits, with the decimal, hex and
              the sum of place values updating as you flip
            </li>
            <li>
              <strong className="text-foreground">Permissions:</strong> nine bits as owner, group and
              other, showing the octal, the <code>ls -l</code> string, and the chmod command
            </li>
            <li>
              <strong className="text-foreground">Subnet mask:</strong> thirty-two bits in four
              octets, showing the dotted mask, the prefix length and the usable host count
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Start with Count up</h4>
        <p className="text-sm text-muted-foreground">
          The single most useful thing on the page is the <strong>Count up</strong> button. A tile can
          only ever show 0 or 1, so when a tile that is already 1 has to grow, it flips back to 0 and
          pushes a carry to its neighbour. Watch that carry travel from the right hand side, and every
          later idea in binary gets easier: why 8 is written as a single lit bit, why 7 fills every bit
          below it, and why adding 1 to 255 wraps a byte back to 0.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why permissions are three groups of three</h4>
        <p className="text-sm text-muted-foreground">
          A permission set is nine bits: read, write and execute, for the owner, the group, then
          everyone else. Three bits hold a value from 0 to 7, which is exactly one octal digit, and
          that is the whole reason chmod numbers are written in octal rather than decimal. Build 755
          in the simulator and the pattern stops being something to memorise: the owner has all three
          bits lit, and the other two groups have read and execute but not write.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why a subnet mask cannot have gaps</h4>
        <p className="text-sm text-muted-foreground">
          A mask splits an address into a network part and a host part, and the split has to happen at
          one point, so the 1s must run solidly from the left. Try flipping a bit in the middle of the
          run: the simulator will tell you the mask is invalid, which is the same thing your router
          would say. That rule is why a mask can be written as a single number, <code>/24</code>,
          instead of a pattern, and why borrowing one more bit always halves the number of hosts.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Where this comes from</h4>
        <p className="text-sm text-muted-foreground">
          Computing museums keep hand-built wooden versions of this: eight tiles on a rail, each
          flipped by hand, sitting next to the valve machines they explain. They work because binary
          stops feeling abstract the moment it is a physical thing you can move with your thumb. This
          is that device, with the parts an engineer actually meets bolted on.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Keep going</h4>
        <p className="text-sm text-muted-foreground">
          Once the bits make sense, the{' '}
          <a
            href="/games/linux-terminal"
            className="font-medium text-primary underline underline-offset-2"
          >
            Linux terminal simulator
          </a>{' '}
          puts chmod to work on a real file tree, and the{' '}
          <a
            href="/games/aws-vpc-simulator"
            className="font-medium text-primary underline underline-offset-2"
          >
            AWS VPC simulator
          </a>{' '}
          uses subnet masks to carve up a network.
        </p>
      </div>
    </>
  );
}

export default function BinaryByteSimulatorPage() {
  return (
    <SimulatorShell
      slug="binary-byte-simulator"
      fallbackTitle="Binary Byte Simulator"
      fallbackDescription="Flip eight bits by hand and watch the value change. The same tiles become a byte, a set of chmod permissions, and a subnet mask, so binary stops being abstract and starts being the thing you already use."
      educational={<BinaryEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Flip the bits and watch the number change. An interactive binary simulator that also explains chmod permissions and subnet masks."
    >
      <BinaryByteSimulator />
    </SimulatorShell>
  );
}
