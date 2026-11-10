import { SyllabusRoadmap } from '@/components/roadmap/syllabus/syllabus-roadmap';
import { devsecopsStages } from '@/lib/roadmap-devsecops-data';
import { relatedRoadmaps } from '@/lib/roadmap-catalog';

export default function DevSecOpsRoadmapPage() {
  return (
    <SyllabusRoadmap
      roadmap="devsecops"
      name="DevSecOps Roadmap"
      intro={`Build security into every step of how you ship, in ${devsecopsStages.length} stages: security basics, secure code, CI/CD, containers, cloud and security operations. Each topic links to our guides and posts to read and to simulators, labs and checklists to practice with. Your progress stays in this browser.`}
      stages={devsecopsStages}
      related={relatedRoadmaps('devsecops')}
    />
  );
}
