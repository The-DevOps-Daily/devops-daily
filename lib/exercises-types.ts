export interface ExerciseStep {
  id: string;
  title: string;
  description: string;
  commands?: string[];
  codeExample?: string;
  expectedOutput?: string;
  hints?: string[];
  validationCriteria?: string[];
}

export interface ExerciseResource {
  title: string;
  url: string;
  type: 'documentation' | 'tutorial' | 'tool' | 'reference';
  external?: boolean;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  category: {
    name: string;
    slug: string;
  };
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  technologies: string[];
  prerequisites: string[];
  learningObjectives: string[];
  environment: 'local' | 'cloud' | 'browser' | 'container';
  steps: ExerciseStep[];
  resources?: ExerciseResource[];
  icon: string; // Lucide icon name
  publishedAt: string;
  updatedAt?: string;
  author?: {
    name: string;
    slug: string;
  };
  tags?: string[];
  completionCriteria: string[];
  troubleshooting?: {
    issue: string;
    solution: string;
  }[];
  image?: string;
  featured?: boolean;
  series?: {
    id: string;
    name: string;
    order: number;
    total: number;
  };
  sponsorCta?: {
    text: string;
    url: string;
    buttonText: string;
  };
}

export interface ExerciseProgress {
  exerciseId: string;
  completedSteps: string[];
  completedAt?: string;
  timeSpent?: number;
  notes?: string;
}

export interface ExerciseStats {
  totalExercises: number;
  completedExercises: number;
  averageRating: number;
  totalTimeSpent: number;
  favoriteCategories: string[];
}
