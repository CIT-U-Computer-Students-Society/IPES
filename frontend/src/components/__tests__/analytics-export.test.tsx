import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminAnalytics from '@/pages/admin/Analytics';
import { ThemeProvider } from '../theme-provider';
import { toast } from '@/lib/notifications';

const { exportForm, state } = vi.hoisted(() => ({
  exportForm: vi.fn(),
  state: { pending: false, hasForms: true },
}));

const summary = {
  form_details: { title: 'Review', description: '', created_at: null, end_date: null, is_active: true, results_released: false },
  overall_score: 3, total_evaluations: 1, participation_rate: 100,
  category_data: [], top_performers: [], unit_breakdown: [], unit_data: [], raw_data: [],
};

vi.mock('@/hooks/useEvaluations', () => ({
  useForms: () => ({ data: state.hasForms ? [{ id: 7, title: 'Review', is_active: true }] : [], isLoading: false }),
  useFormAnalytics: () => ({ data: summary, isLoading: false }),
  useExportFormAnalytics: () => ({ mutateAsync: exportForm, isPending: state.pending }),
}));
vi.mock('@/lib/notifications', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const downloads: { name: string; content: string }[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  state.pending = false;
  state.hasForms = true;
  downloads.length = 0;
  exportForm.mockResolvedValue({ ...summary, raw_data: [{
    evaluator_name: 'Alex', evaluatee_name: 'Sam', question_text: 'Quality',
    score: 0, text_response: 'A comment', submitted_at: null,
  }] });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    downloads.push({ name: this.download, content: decodeURIComponent(this.href.split(',').slice(1).join(',')) });
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function chooseExport(format: 'CSV' | 'JSON') {
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: `Export as ${format}` }));
}

it.each(['CSV', 'JSON'] as const)('loads raw responses on demand for %s and preserves a zero score', async format => {
  render(<ThemeProvider><AdminAnalytics /></ThemeProvider>);
  expect(exportForm).not.toHaveBeenCalled();
  await chooseExport(format);
  await waitFor(() => expect(downloads).toHaveLength(1));
  expect(exportForm).toHaveBeenCalledExactlyOnceWith(7);
  expect(downloads[0].name).toBe(`analytics_form_7.${format.toLowerCase()}`);
  if (format === 'JSON') {
    expect(JSON.parse(downloads[0].content).raw_responses[0].score).toBe(0);
  } else {
    expect(downloads[0].content).toContain('"Alex","Sam","Quality",0,"A comment",');
  }
});

it('shows export errors without downloading summary data as a complete report', async () => {
  exportForm.mockRejectedValue(new Error('Unavailable'));
  render(<ThemeProvider><AdminAnalytics /></ThemeProvider>);
  await chooseExport('JSON');
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(downloads).toEqual([]);
});

it.each(['pending', 'no form'] as const)('disables export when %s', condition => {
  state.pending = condition === 'pending';
  state.hasForms = condition !== 'no form';
  render(<ThemeProvider><AdminAnalytics /></ThemeProvider>);
  expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
});
