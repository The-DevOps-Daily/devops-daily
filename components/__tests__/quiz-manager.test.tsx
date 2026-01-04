import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuizManager } from '../games/quiz-manager';

// Mock quiz data
const mockQuizzes = [
  {
    id: 'git-commands',
    title: 'Git Commands Quiz',
    description: 'Test your Git knowledge',
    category: 'Version Control',
    icon: 'GitBranch',
    totalQuestions: 10,
    totalPoints: 100,
    estimatedTime: '10 min',
    theme: {
      primaryColor: 'blue',
      gradientFrom: 'from-blue-500',
      gradientTo: 'to-purple-500',
    },
    difficultyLevels: {
      beginner: 4,
      intermediate: 4,
      advanced: 2,
    },
    createdDate: '2024-01-15',
  },
  {
    id: 'docker-basics',
    title: 'Docker Fundamentals',
    description: 'Learn Docker basics',
    category: 'Containers',
    icon: 'Package',
    totalQuestions: 15,
    totalPoints: 150,
    estimatedTime: '15 min',
    theme: {
      primaryColor: 'green',
      gradientFrom: 'from-green-500',
      gradientTo: 'to-teal-500',
    },
    difficultyLevels: {
      beginner: 10,
      intermediate: 5,
      advanced: 0,
    },
    createdDate: '2024-02-01',
  },
  {
    id: 'kubernetes-advanced',
    title: 'Advanced Kubernetes',
    description: 'Master Kubernetes concepts',
    category: 'Orchestration',
    icon: 'Cloud',
    totalQuestions: 20,
    totalPoints: 300,
    estimatedTime: '25 min',
    theme: {
      primaryColor: 'purple',
      gradientFrom: 'from-purple-500',
      gradientTo: 'to-pink-500',
    },
    difficultyLevels: {
      beginner: 0,
      intermediate: 5,
      advanced: 15,
    },
    createdDate: '2024-03-10',
  },
];

describe('QuizManager', () => {
  it('renders all quizzes correctly', () => {
    render(<QuizManager quizzes={mockQuizzes} />);
    expect(screen.getByText('Git Commands Quiz')).toBeInTheDocument();
    expect(screen.getByText('Docker Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Advanced Kubernetes')).toBeInTheDocument();
  });

  it('renders quiz descriptions', () => {
    render(<QuizManager quizzes={mockQuizzes} />);
    expect(screen.getByText('Test your Git knowledge')).toBeInTheDocument();
    expect(screen.getByText('Learn Docker basics')).toBeInTheDocument();
    expect(screen.getByText('Master Kubernetes concepts')).toBeInTheDocument();
  });

  it('renders quiz metadata (questions, points, time)', () => {
    render(<QuizManager quizzes={mockQuizzes} />);
    expect(screen.getByText(/10 questions/i)).toBeInTheDocument();
    expect(screen.getByText(/15 questions/i)).toBeInTheDocument();
    expect(screen.getByText(/20 questions/i)).toBeInTheDocument();
  });

  it('renders difficulty distribution badges', () => {
    render(<QuizManager quizzes={mockQuizzes} />);
    // Each quiz should have difficulty indicators
    const beginnerBadges = screen.getAllByText(/beginner/i);
    expect(beginnerBadges.length).toBeGreaterThan(0);
  });

  it('renders category badges', () => {
    render(<QuizManager quizzes={mockQuizzes} />);
    expect(screen.getByText('Version Control')).toBeInTheDocument();
    expect(screen.getByText('Containers')).toBeInTheDocument();
    expect(screen.getByText('Orchestration')).toBeInTheDocument();
  });

  it('renders estimated time', () => {
    render(<QuizManager quizzes={mockQuizzes} />);
    expect(screen.getByText(/10 min/i)).toBeInTheDocument();
    expect(screen.getByText(/15 min/i)).toBeInTheDocument();
    expect(screen.getByText(/25 min/i)).toBeInTheDocument();
  });

  it('renders "Start Quiz" button for each quiz', () => {
    render(<QuizManager quizzes={mockQuizzes} />);
    const startButtons = screen.getAllByText(/start quiz/i);
    expect(startButtons).toHaveLength(mockQuizzes.length);
  });

  it('displays total points for each quiz', () => {
    render(<QuizManager quizzes={mockQuizzes} />);
    expect(screen.getByText(/100/)).toBeInTheDocument();
    expect(screen.getByText(/150/)).toBeInTheDocument();
    expect(screen.getByText(/300/)).toBeInTheDocument();
  });

  it('renders empty state when no quizzes provided', () => {
    render(<QuizManager quizzes={[]} />);
    // Should show some empty state or no quizzes message
    const quizElements = screen.queryAllByText(/quiz/i);
    // Might have header/title with "quiz" but no actual quiz cards
    expect(quizElements.length).toBeLessThan(3);
  });
});
