import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeBlock } from '../code-block-wrapper';

describe('CodeBlock', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });
    vi.clearAllMocks();
  });

  it('renders code content correctly', () => {
    render(
      <CodeBlock language="javascript">
        const message = 'Hello World';
      </CodeBlock>
    );
    expect(screen.getByText(/const message/i)).toBeInTheDocument();
  });

  it('renders language badge when language is provided', () => {
    render(
      <CodeBlock language="javascript">
        console.log('test');
      </CodeBlock>
    );
    expect(screen.getByText('javascript')).toBeInTheDocument();
  });

  it('does not render language badge when language is not provided', () => {
    render(
      <CodeBlock>
        console.log('test');
      </CodeBlock>
    );
    expect(screen.queryByText(/javascript|python|bash/i)).not.toBeInTheDocument();
  });

  it('renders copy button', () => {
    render(
      <CodeBlock language="python">
        print('test')
      </CodeBlock>
    );
    const copyButton = screen.getByRole('button', { name: /copy code to clipboard/i });
    expect(copyButton).toBeInTheDocument();
  });

  it('copies code to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CodeBlock language="bash">
        echo "Hello World"
      </CodeBlock>
    );

    const copyButton = screen.getByRole('button', { name: /copy code to clipboard/i });
    await user.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('echo "Hello World"')
      );
    });
  });

  it('shows checkmark after successful copy', async () => {
    const user = userEvent.setup();
    render(
      <CodeBlock language="typescript">
        type User = { name: string };
      </CodeBlock>
    );

    const copyButton = screen.getByRole('button', { name: /copy code to clipboard/i });
    await user.click(copyButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copied to clipboard/i })).toBeInTheDocument();
    });
  });

  it('renders multiple code blocks independently', () => {
    const { container } = render(
      <>
        <CodeBlock language="javascript">const x = 1;</CodeBlock>
        <CodeBlock language="python">x = 1</CodeBlock>
      </>
    );

    expect(screen.getByText('javascript')).toBeInTheDocument();
    expect(screen.getByText('python')).toBeInTheDocument();
    expect(container.querySelectorAll('code')).toHaveLength(2);
  });

  it('applies correct CSS classes for styling', () => {
    render(
      <CodeBlock language="go">
        func main() {}
      </CodeBlock>
    );

    const codeElement = screen.getByText(/func main/i);
    expect(codeElement).toHaveClass('block');
    expect(codeElement).toHaveClass('font-mono');
  });

  it('handles long code with overflow', () => {
    const longCode = 'const veryLongVariable = '.repeat(50) + ';';
    render(<CodeBlock language="javascript">{longCode}</CodeBlock>);

    const codeElement = screen.getByText(new RegExp(longCode.substring(0, 30)));
    expect(codeElement).toHaveClass('overflow-x-auto');
  });
});
