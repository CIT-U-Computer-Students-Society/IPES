import type { ReactNode } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { useUsers } from '@/hooks/useUsers';
import { useOrganizationUnits } from '../useUnitHooks';
import { usePositionTypes } from '../usePositionHooks';
import { usePendingJoinRequests } from '../useMembershipHooks';

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

describe('Organization & member multi-page traversal (#273)', () => {
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

  it('useUsers fetches and aggregates all records beyond first page of 20', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 25,
          next: 'http://127.0.0.1:8000/api/users/?organization_id=1&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, first_name: `User${i + 1}` })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 25,
          next: null,
          results: Array.from({ length: 5 }, (_, i) => ({ id: i + 21, first_name: `User${i + 21}` })),
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useUsers({ organization_id: 1 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(25);
    });

    expect(result.current.data?.[0].first_name).toBe('User1');
    expect(result.current.data?.[24].first_name).toBe('User25');
  });

  it('useOrganizationUnits aggregates units across pages', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 22,
          next: 'http://127.0.0.1:8000/api/units/?organization_id=1&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Unit${i + 1}` })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 22,
          next: null,
          results: [{ id: 21, name: 'Unit21' }, { id: 22, name: 'Unit22' }],
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useOrganizationUnits(1), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(22);
    });
    expect(result.current.data?.[21].name).toBe('Unit22');
  });

  it('usePositionTypes aggregates positions across pages', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 21,
          next: 'http://127.0.0.1:8000/api/positions/?organization_id=1&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Pos${i + 1}`, rank: i + 1 })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 21,
          next: null,
          results: [{ id: 21, name: 'Pos21', rank: 21 }],
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => usePositionTypes(1), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(21);
    });
    expect(result.current.data?.[20].name).toBe('Pos21');
  });

  it('usePendingJoinRequests aggregates requests across pages', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 23,
          next: 'http://127.0.0.1:8000/api/join-requests/?organization_id=1&status=Pending&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, user_id: i + 1, status: 'Pending' })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 23,
          next: null,
          results: [
            { id: 21, user_id: 21, status: 'Pending' },
            { id: 22, user_id: 22, status: 'Pending' },
            { id: 23, user_id: 23, status: 'Pending' },
          ],
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => usePendingJoinRequests(1), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(23);
    });
    expect(result.current.data?.[22].id).toBe(23);
  });
});
