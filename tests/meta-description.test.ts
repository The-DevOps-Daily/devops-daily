import { describe, it, expect } from 'vitest';
import { truncateMetaDescription } from '@/lib/meta-description';

describe('truncateMetaDescription', () => {
  it('returns empty string for null/undefined input', () => {
    expect(truncateMetaDescription(null)).toBe('');
    expect(truncateMetaDescription(undefined)).toBe('');
    expect(truncateMetaDescription('')).toBe('');
  });

  it('passes short input through unchanged', () => {
    const text = 'A practical guide to dependency scanning.';
    expect(truncateMetaDescription(text)).toBe(text);
  });

  it('keeps input at exactly maxLength', () => {
    const text = 'a'.repeat(155);
    expect(truncateMetaDescription(text)).toBe(text);
    expect(truncateMetaDescription(text).length).toBe(155);
  });

  it('cuts at sentence boundary when boundary is near the limit', () => {
    // Two sentences, second-to-last sentence end lands well into the upper
    // range. Should cut at the close-to-limit boundary, not at the first
    // tiny sentence end.
    const text =
      'How Packer builds machine images for cloud and bare-metal environments. Covers builders, provisioners, post-processors, the workflow Packer automates, and why templates produce repeatable images across providers.';
    const out = truncateMetaDescription(text);
    // Sentence end after "...environments." is at ~71 chars. Floor for
    // maxLength=155 is 108, so we should fall through to a word boundary
    // closer to 155.
    expect(out.length).toBeGreaterThan(120);
    expect(out.length).toBeLessThanOrEqual(160);
  });

  it('does not cut short at an early sentence boundary (regression)', () => {
    // The bug we are fixing: source description that has a short first
    // sentence and a longer second sentence. Old logic cut at the first
    // sentence end (82 chars). New logic should produce >= 120.
    const text =
      'A detailed comparison of GitHub and GitLab as source control and DevOps platforms. Covers CI/CD, code review, project management, security features, and pricing to help you choose the right platform for your team.';
    const out = truncateMetaDescription(text);
    expect(out.length).toBeGreaterThanOrEqual(120);
    expect(out.length).toBeLessThanOrEqual(160);
    // The output should include the second sentence's keywords, not just
    // the platform-name first sentence.
    expect(out).toMatch(/CI\/CD|review|security/);
  });

  it('falls back to a word boundary with ellipsis when no late sentence end exists', () => {
    const text =
      'DevOps Daily Week 17, 2026 newsletter: caching strategies simulator, Kubernetes scheduler challenge, fresh quizzes, and evergreen DevOps reads worth revisiting.';
    const out = truncateMetaDescription(text);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('...') || /\.$/.test(out)).toBe(true);
  });

  it('respects a custom maxLength', () => {
    const text =
      'A practical guide to getting started with Linux for beginners and experienced users alike, covering everything from the basics to system administration.';
    const out = truncateMetaDescription(text, 80);
    expect(out.length).toBeLessThanOrEqual(85);
  });

  it('handles a single sentence longer than maxLength', () => {
    const text =
      'Test how your applications handle slow lossy or high-latency networks using simulation tools that throttle bandwidth and add delay for realistic testing scenarios.';
    const out = truncateMetaDescription(text);
    expect(out.length).toBeGreaterThan(120);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('...')).toBe(true);
  });

  it('strips trailing punctuation before adding the ellipsis', () => {
    const text =
      'Kubernetes architecture explained, control plane parts, the API server, etcd, the scheduler, the controller manager, and worker node pieces, kubelet, kube-proxy, runtime.';
    const out = truncateMetaDescription(text);
    // Should not produce ',....' or ';...' style endings.
    expect(out).not.toMatch(/[,;:.]\.\.\.$/);
  });
});
