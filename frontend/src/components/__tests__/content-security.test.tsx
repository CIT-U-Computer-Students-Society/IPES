import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Results from '@/pages/officer/Results';
import { ProofLink } from '../ProofLink';
import { ThemeProvider } from '../theme-provider';

const payload = '<img src=x onerror=alert(document.cookie)>';
vi.mock('@/hooks/useEvaluations', () => ({
  useMyPerformance: () => ({ data: {
    overallScore: 3, overallMaxScore: 5, categoryScores: [],
    feedbackComments: [{ id: 1, text: payload, type: 'positive' }],
    evaluationHistory: [], available_forms: [{ id: 1, title: 'Review' }],
    evaluatorCount: 1, selectedFormId: 1,
  }, isLoading: false }),
}));
afterEach(cleanup);

it('renders stored evaluation feedback as text rather than executable markup', () => {
  const { container } = render(<ThemeProvider><Results /></ThemeProvider>);
  expect(screen.getByText(payload)).toBeInTheDocument();
  expect(container.querySelector('img, script, [onerror]')).toBeNull();
});

it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'ftp://example.com/proof', '//evil.example.com']) (
  'does not render an executable or unsupported proof link: %s', url => {
    render(<ProofLink url={url}>View proof</ProofLink>);
    expect(screen.queryByRole('link')).toBeNull();
  },
);

it('opens valid proof links without giving the destination access to the opener', () => {
  render(<ProofLink url="https://example.com/proof">View proof</ProofLink>);
  const link = screen.getByRole('link', { name: 'View proof' });
  expect(link).toHaveAttribute('href', 'https://example.com/proof');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});
