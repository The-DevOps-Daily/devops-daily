import { SyllabusRoadmap } from '@/components/roadmap/syllabus/syllabus-roadmap';
import { juniorStages } from '@/lib/roadmap-junior-data';
import { relatedRoadmaps } from '@/lib/roadmap-catalog';

export default function JuniorRoadmapPage() {
  return (
    <SyllabusRoadmap
      roadmap="junior"
      name="Junior DevOps Roadmap"
      intro={`A focused path to your first DevOps role, in ${juniorStages.length} stages: Linux and Git first, then containers, CI/CD and the cloud. Each topic links to our guides to read and to simulators, labs and quizzes to practice with. Mark topics as you go. Your progress stays in this browser.`}
      stages={juniorStages}
      related={relatedRoadmaps('junior')}
    />
  );
}
