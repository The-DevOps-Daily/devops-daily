import type { Metadata } from 'next';
import DevOpsScorecard from '../../../components/games/devops-scorecard';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('devops-scorecard');
}

function DevOpsScorecardEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About the DevOps Scorecard</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Rate your skills across 8 core DevOps areas</li>
            <li>Each skill is rated from 1 (Beginner) to 5 (Expert)</li>
            <li>Get instant feedback and personalized insights</li>
            <li>Share your results with your team or on social media</li>
            <li>Track your progress over time</li>
            <li>Identify areas for professional development</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Skill categories</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Foundational:</strong> Linux, networking,
              scripting, Git.
            </li>
            <li>
              <strong className="text-foreground">Infrastructure as Code:</strong> Terraform,
              Ansible, Kubernetes.
            </li>
            <li>
              <strong className="text-foreground">Cloud Platforms:</strong> AWS, Azure, GCP,
              multi-cloud.
            </li>
            <li>
              <strong className="text-foreground">CI/CD:</strong> Jenkins, automated testing,
              deployments.
            </li>
            <li>
              <strong className="text-foreground">Monitoring:</strong> Prometheus, ELK stack,
              observability.
            </li>
            <li>
              <strong className="text-foreground">Security:</strong> Secrets management,
              compliance.
            </li>
            <li>
              <strong className="text-foreground">Soft Skills:</strong> Leadership, communication.
            </li>
            <li>
              <strong className="text-foreground">Advanced:</strong> SRE, chaos engineering,
              service mesh.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Career development tips</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Use your scorecard to identify skill gaps and create a learning plan.</li>
          <li>Focus on foundational skills before advancing to specialized areas.</li>
          <li>Balance technical skills with soft skills for career growth.</li>
          <li>Consider industry certifications to validate your expertise.</li>
          <li>Share your results to start conversations about career development.</li>
        </ul>
      </div>
    </>
  );
}

export default function DevOpsScorecardPage() {
  return (
    <SimulatorShell
      slug="devops-scorecard"
      educational={<DevOpsScorecardEducational />}
      shareText="Just discovered the DevOps Scorecard! Perfect for assessing DevOps skills and planning career development."
    >
      <DevOpsScorecard />
    </SimulatorShell>
  );
}
