import type { ReactNode } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import {
  useAssignments,
  useMyPendingEvaluations,
  useMyCompletedEvaluations,
} from '../useAssignmentHooks';
import { useForms } from '../useFormHooks';
import { useFormRules } from '../useRuleHooks';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OrganizationProvider>{children}</OrganizationProvider>
      </QueryClientProvider>
    );
  };
}

describe('Evaluation Assignments & Forms Pagination Traversal (#234)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('activeOrganizationId', '1');
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('useAssignments aggregates all evaluation assignments beyond first page of 20', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 25,
          next: 'http://127.0.0.1:8000/api/assignments/?organization_id=1&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            form_id: 1,
            evaluator_id: 10,
            evaluatee_id: 20 + i,
            status: 'Pending',
          })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 25,
          next: null,
          results: Array.from({ length: 5 }, (_, i) => ({
            id: i + 21,
            form_id: 1,
            evaluator_id: 10,
            evaluatee_id: 40 + i,
            status: 'Completed',
          })),
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useAssignments({ form_id: 1 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(25);
    });

    expect(result.current.data?.[0].id).toBe(1);
    expect(result.current.data?.[24].id).toBe(25);
    expect(result.current.data?.[24].status).toBe('Completed');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('useMyPendingEvaluations traverses pages to collect all pending assignments', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 22,
          next: 'http://127.0.0.1:8000/api/assignments/my_pending/?organization_id=1&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            status: 'Pending',
          })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 22,
          next: null,
          results: [
            { id: 21, status: 'Pending' },
            { id: 22, status: 'Pending' },
          ],
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useMyPendingEvaluations({ organization_id: 1 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(22);
    });

    expect(result.current.data?.[21].id).toBe(22);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('useMyCompletedEvaluations traverses pages to collect all completed assignments', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 21,
          next: 'http://127.0.0.1:8000/api/assignments/my_completed/?organization_id=1&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            status: 'Completed',
          })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 21,
          next: null,
          results: [{ id: 21, status: 'Completed' }],
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useMyCompletedEvaluations({ organization_id: 1 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(21);
    });

    expect(result.current.data?.[20].id).toBe(21);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('useForms traverses pages to collect all evaluation forms', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 21,
          next: 'http://127.0.0.1:8000/api/forms/?organization_id=1&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            title: `Form ${i + 1}`,
            is_active: true,
          })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 21,
          next: null,
          results: [{ id: 21, title: 'Form 21', is_active: false }],
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useForms({ organization_id: 1 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(21);
    });

    expect(result.current.data?.[20].title).toBe('Form 21');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('useFormRules traverses pages to collect all assignment rules for a form', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 22,
          next: 'http://127.0.0.1:8000/api/assignment-rules/?form_id=5&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            form_id: 5,
            evaluator_unit: 1,
          })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 22,
          next: null,
          results: [
            { id: 21, form_id: 5, evaluator_unit: 2 },
            { id: 22, form_id: 5, evaluator_unit: 3 },
          ],
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useFormRules(5), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(22);
    });

    expect(result.current.data?.[21].id).toBe(22);
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
