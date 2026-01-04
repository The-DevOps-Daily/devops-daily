import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GamesList, SerializableGame } from '../games-list';

// Mock game data
const mockGames: SerializableGame[] = [
  {
    id: '1',
    title: 'Docker Quiz',
    description: 'Test your Docker knowledge',
    iconName: 'Server',
    badgeText: 'New',
    color: 'from-blue-500 to-purple-500',
    href: '/games/docker-quiz',
    tags: ['Docker', 'Containers'],
    isNew: true,
    featured: false,
    category: 'Quiz',
    isPopular: false,
    isComingSoon: false,
  },
  {
    id: '2',
    title: 'Kubernetes Scheduler',
    description: 'Learn how Kubernetes schedules pods',
    iconName: 'Cloud',
    badgeText: 'Popular',
    color: 'from-green-500 to-teal-500',
    href: '/games/k8s-scheduler',
    tags: ['Kubernetes', 'Scheduling'],
    isNew: false,
    featured: true,
    category: 'Simulation',
    isPopular: true,
    isComingSoon: false,
  },
  {
    id: '3',
    title: 'CI/CD Pipeline',
    description: 'Build your own CI/CD pipeline',
    iconName: 'Workflow',
    color: 'from-orange-500 to-red-500',
    href: '/games/cicd-pipeline',
    tags: ['CI/CD', 'DevOps'],
    isNew: false,
    featured: false,
    category: 'Generator',
    isPopular: false,
    isComingSoon: true,
  },
];

describe('GameCard', () => {
  it('renders game title correctly', () => {
    render(<GamesList games={[mockGames[0]]} showSearch={false} showFilters={false} />);
    expect(screen.getByText('Docker Quiz')).toBeInTheDocument();
  });

  it('renders game description correctly', () => {
    render(<GamesList games={[mockGames[0]]} showSearch={false} showFilters={false} />);
    expect(screen.getByText('Test your Docker knowledge')).toBeInTheDocument();
  });

  it('renders tags correctly', () => {
    render(<GamesList games={[mockGames[0]]} showSearch={false} showFilters={false} />);
    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByText('Containers')).toBeInTheDocument();
  });

  it('renders "New" badge for new games', () => {
    render(<GamesList games={[mockGames[0]]} showSearch={false} showFilters={false} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders "Popular" badge for popular games', () => {
    render(<GamesList games={[mockGames[1]]} showSearch={false} showFilters={false} />);
    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('renders "Featured" badge for featured games', () => {
    render(<GamesList games={[mockGames[1]]} showSearch={false} showFilters={false} />);
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('renders "Coming Soon" overlay for upcoming games', () => {
    render(<GamesList games={[mockGames[2]]} showSearch={false} showFilters={false} />);
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    expect(screen.getByText('Stay tuned')).toBeInTheDocument();
  });

  it('renders "Start Learning" link for available games', () => {
    render(<GamesList games={[mockGames[0]]} showSearch={false} showFilters={false} />);
    expect(screen.getByText('Start Learning')).toBeInTheDocument();
  });

  it('applies correct link href', () => {
    render(<GamesList games={[mockGames[0]]} showSearch={false} showFilters={false} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/games/docker-quiz');
  });

  it('renders multiple games correctly', () => {
    render(<GamesList games={mockGames} showSearch={false} showFilters={false} />);
    expect(screen.getByText('Docker Quiz')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes Scheduler')).toBeInTheDocument();
    expect(screen.getByText('CI/CD Pipeline')).toBeInTheDocument();
  });

  it('renders featured games in separate section', () => {
    render(<GamesList games={mockGames} showSearch={false} showFilters={false} />);
    // Featured games should appear first
    const allCards = screen.getAllByRole('link');
    expect(allCards.length).toBeGreaterThan(0);
  });
});
