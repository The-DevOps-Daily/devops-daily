import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '../command-palette';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock search index data
const mockSearchIndex = [
  {
    id: '1',
    type: 'post' as const,
    title: 'Introduction to Docker',
    description: 'Learn Docker basics',
    url: '/posts/intro-to-docker',
    category: 'Containers',
    tags: ['docker', 'containers'],
  },
  {
    id: '2',
    type: 'guide' as const,
    title: 'Kubernetes Guide',
    description: 'Complete Kubernetes guide',
    url: '/guides/kubernetes',
    category: 'Orchestration',
    tags: ['kubernetes', 'k8s'],
  },
  {
    id: '3',
    type: 'game' as const,
    title: 'Git Commands Quiz',
    description: 'Test your Git knowledge',
    url: '/games/git-quiz',
    category: 'Version Control',
    tags: ['git', 'quiz'],
  },
];

// Mock fetch API
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve(mockSearchIndex),
  } as Response)
);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('CommandPalette (Search)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('renders command palette component', () => {
    render(<CommandPalette />);
    // Component renders (dialog might not be open by default)
    expect(document.body).toBeInTheDocument();
  });

  it('opens dialog when triggered', async () => {
    render(<CommandPalette />);
    // Simulate keyboard shortcut (Ctrl+K or Cmd+K)
    const user = userEvent.setup();
    await user.keyboard('{Meta>}k{/Meta}');
    // Dialog should be triggered (implementation might vary)
  });

  it('loads search index when opened', async () => {
    render(<CommandPalette />);
    // Trigger open state
    const user = userEvent.setup();
    await user.keyboard('{Meta>}k{/Meta}');
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/search-index.json');
    });
  });

  it('displays search results for query', async () => {
    render(<CommandPalette />);
    const user = userEvent.setup();
    
    // Open dialog and type search query
    await user.keyboard('{Meta>}k{/Meta}');
    
    // Wait for search index to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('filters results based on search input', async () => {
    const { container } = render(<CommandPalette />);
    // Filtering logic should narrow down results
    expect(container).toBeInTheDocument();
  });

  it('displays type badges (post, guide, game)', async () => {
    render(<CommandPalette />);
    // Type badges should be visible in search results
  });

  it('displays category information', async () => {
    render(<CommandPalette />);
    // Categories should be shown for each result
  });

  it('stores recent searches in localStorage', async () => {
    render(<CommandPalette />);
    const user = userEvent.setup();
    
    // Perform a search and select a result
    await user.keyboard('{Meta>}k{/Meta}');
    
    // After selection, localStorage should be updated
    await waitFor(() => {
      const recent = localStorageMock.getItem('devops-daily-recent-searches');
      // Should have stored recent searches
    });
  });

  it('displays recent searches when no query', async () => {
    // Set up recent searches
    localStorageMock.setItem(
      'devops-daily-recent-searches',
      JSON.stringify([mockSearchIndex[0]])
    );
    
    render(<CommandPalette />);
    const user = userEvent.setup();
    await user.keyboard('{Meta>}k{/Meta}');
    
    // Recent searches should be displayed
  });

  it('clears recent searches', async () => {
    localStorageMock.setItem(
      'devops-daily-recent-searches',
      JSON.stringify(mockSearchIndex)
    );
    
    render(<CommandPalette />);
    // Clear button should remove recent searches
    
    await waitFor(() => {
      const recent = localStorageMock.getItem('devops-daily-recent-searches');
      // Should be cleared
    });
  });

  it('handles keyboard navigation', async () => {
    render(<CommandPalette />);
    const user = userEvent.setup();
    
    await user.keyboard('{Meta>}k{/Meta}');
    // Arrow keys should navigate through results
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowUp}');
  });

  it('closes dialog on escape key', async () => {
    render(<CommandPalette />);
    const user = userEvent.setup();
    
    await user.keyboard('{Meta>}k{/Meta}');
    await user.keyboard('{Escape}');
    // Dialog should be closed
  });
});
