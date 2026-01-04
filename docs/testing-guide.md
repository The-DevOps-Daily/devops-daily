# Component Testing Guide

This guide covers testing practices for React components in the DevOps Daily project using Vitest and React Testing Library.

## Table of Contents

- [Setup](#setup)
- [Writing Tests](#writing-tests)
- [Testing Patterns](#testing-patterns)
- [Best Practices](#best-practices)
- [Coverage Goals](#coverage-goals)
- [Running Tests](#running-tests)

## Setup

### Test Environment

Our project uses:
- **Vitest**: Fast unit test framework
- **React Testing Library**: Component testing utilities
- **jsdom**: DOM environment for testing
- **@testing-library/jest-dom**: Custom matchers

### Configuration

Test configuration is defined in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.ts', 'components/**/*.test.tsx'],
  },
});
```

### Setup File

`vitest.setup.ts` configures global test utilities:

```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);
afterEach(() => cleanup());
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../my-component';

describe('MyComponent', () => {
  it('renders component correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Testing Props

```typescript
it('renders with custom props', () => {
  render(<Button variant="primary" size="lg">Click Me</Button>);
  
  const button = screen.getByRole('button', { name: /click me/i });
  expect(button).toHaveClass('btn-primary');
  expect(button).toHaveClass('btn-lg');
});
```

### Testing User Interactions

```typescript
import userEvent from '@testing-library/user-event';

it('handles button click', async () => {
  const user = userEvent.setup();
  const handleClick = vi.fn();
  
  render(<Button onClick={handleClick}>Click</Button>);
  
  await user.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### Testing Async Behavior

```typescript
import { waitFor } from '@testing-library/react';

it('loads data asynchronously', async () => {
  render(<DataLoader />);
  
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
```

## Testing Patterns

### 1. Accessibility Testing

Always use semantic queries:

```typescript
// ✅ Good - semantic queries
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText('Email address');
screen.getByPlaceholderText('Enter your name');

// ❌ Avoid - fragile queries
screen.getByTestId('submit-button');
container.querySelector('.btn-submit');
```

### 2. Mocking External Dependencies

#### Mocking Next.js Router

```typescript
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));
```

#### Mocking Fetch API

```typescript
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ data: 'mock data' }),
  } as Response)
);
```

#### Mocking localStorage

```typescript
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
```

### 3. Testing Forms

```typescript
it('submits form with valid data', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  
  render(<ContactForm onSubmit={onSubmit} />);
  
  await user.type(screen.getByLabelText('Name'), 'John Doe');
  await user.type(screen.getByLabelText('Email'), 'john@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));
  
  expect(onSubmit).toHaveBeenCalledWith({
    name: 'John Doe',
    email: 'john@example.com',
  });
});
```

### 4. Testing Conditional Rendering

```typescript
it('shows loading state', () => {
  render(<Component isLoading={true} />);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});

it('shows content when loaded', () => {
  render(<Component isLoading={false} data="Content" />);
  expect(screen.getByText('Content')).toBeInTheDocument();
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});
```

### 5. Testing Lists and Collections

```typescript
it('renders list of items', () => {
  const items = ['Item 1', 'Item 2', 'Item 3'];
  render(<ItemList items={items} />);
  
  items.forEach(item => {
    expect(screen.getByText(item)).toBeInTheDocument();
  });
});

it('renders empty state', () => {
  render(<ItemList items={[]} />);
  expect(screen.getByText('No items found')).toBeInTheDocument();
});
```

## Best Practices

### 1. Test Behavior, Not Implementation

```typescript
// ✅ Good - tests user-facing behavior
it('displays error message on invalid email', async () => {
  const user = userEvent.setup();
  render(<EmailInput />);
  
  await user.type(screen.getByLabelText('Email'), 'invalid-email');
  await user.tab(); // Blur input
  
  expect(screen.getByText('Invalid email format')).toBeInTheDocument();
});

// ❌ Avoid - tests implementation details
it('calls validateEmail function', () => {
  const { result } = renderHook(() => useEmailValidation());
  result.current.validateEmail('test@example.com');
  expect(result.current.isValid).toBe(true);
});
```

### 2. Keep Tests Isolated

```typescript
describe('UserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });
  
  it('test case 1', () => { /* ... */ });
  it('test case 2', () => { /* ... */ });
});
```

### 3. Use Descriptive Test Names

```typescript
// ✅ Good - descriptive names
it('displays success message after form submission');
it('disables submit button when form is invalid');
it('redirects to dashboard after successful login');

// ❌ Avoid - vague names
it('works correctly');
it('test submit');
it('handles error');
```

### 4. Test Edge Cases

```typescript
describe('Pagination', () => {
  it('shows first page by default');
  it('navigates to next page');
  it('disables previous button on first page');
  it('disables next button on last page');
  it('handles empty data set');
  it('handles single page of data');
});
```

### 5. Avoid Test Duplication

```typescript
// Use test.each for similar tests
it.each([
  ['primary', 'btn-primary'],
  ['secondary', 'btn-secondary'],
  ['danger', 'btn-danger'],
])('applies %s variant class', (variant, expectedClass) => {
  render(<Button variant={variant}>Click</Button>);
  expect(screen.getByRole('button')).toHaveClass(expectedClass);
});
```

## Coverage Goals

### Target Coverage Levels

- **Overall Components**: 70%+
- **Critical Components**: 90%+
- **UI Components**: 60%+
- **Utility Functions**: 95%+

### High-Priority Components

These components should have comprehensive test coverage:

1. **Forms**: Login, signup, contact forms
2. **Navigation**: Header, sidebar, breadcrumbs
3. **Content Display**: Posts, guides, quizzes
4. **Interactive Features**: Search, filters, sorting
5. **State Management**: Cart, user preferences, theme

### What to Test

✅ **Do Test:**
- User interactions (clicks, typing, navigation)
- Conditional rendering (loading, error, success states)
- Form validation and submission
- Data fetching and display
- Accessibility (ARIA labels, keyboard navigation)
- Edge cases (empty states, error handling)

❌ **Don't Test:**
- Third-party library internals
- CSS styles (unless critical to functionality)
- Implementation details
- Trivial getters/setters

## Running Tests

### Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests with coverage and UI
npm run test:coverage:ui

# Run specific test file
npx vitest run components/__tests__/my-component.test.tsx

# Run tests matching pattern
npx vitest run --grep="Button"
```

### Coverage Reports

Coverage reports are generated in:
- **HTML**: `coverage/index.html` (open in browser)
- **JSON**: `coverage/coverage-final.json`
- **Text**: Console output

View HTML coverage:
```bash
npm run test:coverage
open coverage/index.html
```

### CI/CD Integration

Tests run automatically in CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: npm test

- name: Generate Coverage
  run: npm run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Common Issues

#### 1. "Cannot find module" errors
```typescript
// Add to vitest.config.ts
resolve: {
  alias: {
    '@': resolve(__dirname, './'),
  },
}
```

#### 2. "window is not defined" errors
```typescript
// Use jsdom environment
test: {
  environment: 'jsdom',
}
```

#### 3. Async test timeouts
```typescript
// Increase timeout for specific test
it('slow test', async () => {
  // test code
}, { timeout: 10000 });
```

#### 4. Flaky tests
```typescript
// Use waitFor for async updates
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument();
}, { timeout: 3000 });
```

## Resources

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Documentation](https://vitest.dev/)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Best Practices](https://testingjavascript.com/)

## Examples

See `components/__tests__/` for real-world examples:

- `game-card.test.tsx`: Testing cards with badges and states
- `quiz-manager.test.tsx`: Testing filtering and sorting
- `code-block.test.tsx`: Testing clipboard interactions
- `markdown-content.test.tsx`: Testing content rendering
- `search.test.tsx`: Testing search and navigation

---

**Last Updated**: 2024-01-15
**Maintained By**: DevOps Daily Team
