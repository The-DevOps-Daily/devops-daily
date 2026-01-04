import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostContent } from '../post-content';

describe('PostContent (Markdown Rendering)', () => {
  it('renders plain text correctly', () => {
    render(<PostContent content="Hello World" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders markdown headings', () => {
    render(<PostContent content="# Main Title\n## Subtitle" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Main Title' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Subtitle' })).toBeInTheDocument();
  });

  it('renders markdown links', () => {
    render(<PostContent content="[Click here](https://example.com)" />);
    const link = screen.getByRole('link', { name: /click here/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders markdown bold text', () => {
    render(<PostContent content="**Bold Text**" />);
    const boldElement = screen.getByText('Bold Text');
    expect(boldElement).toBeInTheDocument();
    expect(boldElement.tagName).toBe('STRONG');
  });

  it('renders markdown italic text', () => {
    render(<PostContent content="*Italic Text*" />);
    const italicElement = screen.getByText('Italic Text');
    expect(italicElement).toBeInTheDocument();
    expect(italicElement.tagName).toBe('EM');
  });

  it('renders markdown code inline', () => {
    render(<PostContent content="This is `inline code` here" />);
    expect(screen.getByText(/inline code/i)).toBeInTheDocument();
  });

  it('renders markdown unordered lists', () => {
    const markdown = `
- Item 1
- Item 2
- Item 3
    `;
    render(<PostContent content={markdown} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('renders markdown ordered lists', () => {
    const markdown = `
1. First
2. Second
3. Third
    `;
    render(<PostContent content={markdown} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('renders markdown blockquotes', () => {
    render(<PostContent content="> This is a quote" />);
    expect(screen.getByText('This is a quote')).toBeInTheDocument();
  });

  it('applies prose styling classes', () => {
    const { container } = render(<PostContent content="# Test" />);
    const proseDiv = container.querySelector('.prose');
    expect(proseDiv).toBeInTheDocument();
    expect(proseDiv).toHaveClass('prose-lg');
  });

  it('handles empty content', () => {
    const { container } = render(<PostContent content="" />);
    expect(container.querySelector('.prose')).toBeInTheDocument();
  });

  it('renders complex markdown with multiple elements', () => {
    const markdown = `
# Main Title

This is **bold** and *italic* text.

- List item 1
- List item 2

[Link](https://example.com)
    `;
    render(<PostContent content={markdown} />);
    expect(screen.getByRole('heading', { name: 'Main Title' })).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('italic')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Link' })).toBeInTheDocument();
  });
});
