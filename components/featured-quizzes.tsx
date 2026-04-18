import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Clock,
  Target,
  Brain,
  Container,
  Layers,
  Server,
  Workflow,
  Database,
  Shield,
  Cloud,
  GitBranch,
  Terminal,
  LucideIcon,
} from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { getAllQuizzes } from '@/lib/quiz-loader';

const iconComponents: Record<string, LucideIcon> = {
  Container,
  Layers,
  Server,
  Workflow,
  Database,
  Shield,
  Cloud,
  GitBranch,
  Terminal,
  Brain,
};

interface FeaturedQuizzesProps {
  className?: string;
  limit?: number;
}

export default async function FeaturedQuizzes({
  className,
  limit = 6,
}: FeaturedQuizzesProps) {
  const quizzes = await getAllQuizzes();
  if (quizzes.length === 0) return null;

  const featured = quizzes.slice(0, limit);

  return (
    <section className={cn(className)}>
      <SectionHeader
        label="quizzes"
        title="Test Your Knowledge"
        description="Short interactive quizzes across Docker, Kubernetes, Terraform, networking, and more"
        viewAllHref="/quizzes"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((quiz) => {
          const Icon = iconComponents[quiz.icon] || Brain;
          return (
            <Link
              key={quiz.id}
              href={`/quizzes/${quiz.id}`}
              className="group rounded-md border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2">
                    {quiz.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{quiz.category}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                {quiz.description}
              </p>

              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono tabular-nums">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" strokeWidth={1.5} />
                    {quiz.metadata.estimatedTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" strokeWidth={1.5} />
                    {quiz.questions.length} q
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
