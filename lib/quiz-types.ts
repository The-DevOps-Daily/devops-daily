export interface QuizBranch {
  name: string;
  commits: string[];
  current?: boolean;
}

export interface QuizQuestion {
  id: string;
  title: string;
  description: string;
  situation?: string;
  branches?: QuizBranch[];
  conflict?: string;
  codeExample?: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  points: number;
  hint?: string;
}

export interface QuizConfig {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string; // Icon name from lucide-react
  totalPoints: number;
  questions: QuizQuestion[];
  theme: {
    primaryColor: string;
    gradientFrom: string;
    gradientTo: string;
  };
  metadata: {
    estimatedTime: string;
    difficultyLevels: {
      beginner: number;
      intermediate: number;
      advanced: number;
    };
    createdDate?: string;
    tags?: string[];
  };
}
