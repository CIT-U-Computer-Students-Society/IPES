import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { useExportFormAnalytics, useFormAnalytics } from '../useFormHooks';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('@/contexts/OrganizationContext', () => ({ useOrganizationState: () => ({ activeOrganizationId: 1 }) }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it('loads summaries without requesting raw exports', async () => {
  vi.mocked(api.get).mockResolvedValue({ json: async () => ({ raw_data: [], overall_score: 3 }) } as Response);
  const { result } = renderHook(() => useFormAnalytics(7), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/forms/7/analytics/');
});

it('does not request analytics until a form is selected', () => {
  renderHook(() => useFormAnalytics(undefined), { wrapper });
  expect(api.get).not.toHaveBeenCalled();
});

it('fetches the full selected form only when export is requested', async () => {
  const payload = { raw_data: [{ score: 0, question_text: 'Quality' }] };
  vi.mocked(api.get).mockResolvedValue({ json: async () => payload } as Response);
  const { result } = renderHook(() => useExportFormAnalytics(), { wrapper });
  expect(api.get).not.toHaveBeenCalled();
  let exported;
  await act(async () => { exported = await result.current.mutateAsync(12); });
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/forms/12/analytics_export/');
  expect(exported).toEqual(payload);
});

it('propagates export errors so the page can avoid an incomplete download', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('Unavailable'));
  const { result } = renderHook(() => useExportFormAnalytics(), { wrapper });
  await act(async () => { await expect(result.current.mutateAsync(12)).rejects.toThrow('Unavailable'); });
  await waitFor(() => expect(result.current.isError).toBe(true));
});
