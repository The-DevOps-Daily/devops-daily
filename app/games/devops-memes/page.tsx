import type { Metadata } from 'next';
import DevOpsMemes from '@/components/games/devops-memes';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('devops-memes');
}

function DevOpsMemesEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Why DevOps memes matter</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">Community building</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            Shared experiences create bonds. When we laugh about the same struggles, like DNS
            issues, YAML formatting, or Friday afternoon deployments, we build a sense of community
            and mutual understanding.
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Breaks down barriers between team members</li>
            <li>Creates talking points for networking</li>
            <li>Helps newcomers feel part of the community</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Stress relief</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            DevOps can be stressful. Laughing about our challenges helps us cope with the pressure
            and reminds us that we&apos;re not alone in facing these difficulties.
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Reduces burnout through humor</li>
            <li>Provides perspective on daily challenges</li>
            <li>Creates positive team dynamics</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Educational value</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            Each meme contains a kernel of truth about DevOps practices, tools, or culture. They
            can spark discussions about best practices and shared learning.
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Highlights common antipatterns</li>
            <li>Encourages reflection on practices</li>
            <li>Makes complex concepts more memorable</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Content creation</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            These memes are perfect for social media, presentations, and blog posts. They make
            technical content more engaging and relatable.
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Great for conference presentations</li>
            <li>Increases social media engagement</li>
            <li>Makes technical content accessible</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">How to use these memes</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h5 className="mb-1 font-medium text-sm text-foreground">Team building</h5>
            <p className="text-sm text-muted-foreground">
              Share in team chat, use as meeting icebreakers, or include in retrospectives to
              lighten the mood and encourage open discussion.
            </p>
          </div>
          <div>
            <h5 className="mb-1 font-medium text-sm text-foreground">Social media</h5>
            <p className="text-sm text-muted-foreground">
              Perfect for LinkedIn posts, Twitter threads, or tech blog content. They&apos;re
              highly shareable and relatable to the DevOps community.
            </p>
          </div>
          <div>
            <h5 className="mb-1 font-medium text-sm text-foreground">Presentations</h5>
            <p className="text-sm text-muted-foreground">
              Use as conversation starters in conference talks, training sessions, or team
              presentations to make technical content more engaging.
            </p>
          </div>
          <div>
            <h5 className="mb-1 font-medium text-sm text-foreground">Documentation</h5>
            <p className="text-sm text-muted-foreground">
              Add humor to runbooks, incident response guides, or team wikis to make documentation
              more memorable and enjoyable to read.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DevOpsMemesPage() {
  return (
    <SimulatorShell slug="devops-memes" educational={<DevOpsMemesEducational />}>
      <DevOpsMemes />
    </SimulatorShell>
  );
}
