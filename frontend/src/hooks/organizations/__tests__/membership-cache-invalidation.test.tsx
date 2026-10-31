import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import {
  useApproveJoinRequest,
  useCreateMembership,
  useUpdateMembership,
} from '../useMembershipHooks';
import { useRemoveMember } from '../useOrgHooks';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    patch: vi.fn(),
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

describe('Member mutations cache invalidation (#276)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('activeOrganizationId', '1');
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(api.post).mockResolvedValue({
      json: async () => ({ message: 'Success' }),
    } as Response);
    vi.mocked(api.patch).mockResolvedValue({
      json: async () => ({ message: 'Success' }),
    } as Response);
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  const seedCaches = () => {
    queryClient.setQueryData(['join-requests', 'pending', 1], [{ id: 10 }]);
    queryClient.setQueryData(['users', { organization_id: 1 }], [{ id: 5, first_name: 'John' }]);
    queryClient.setQueryData(['units', 1], [{ id: 2, name: 'Tech', members_count: 3 }]);
    queryClient.setQueryData(['organizations', 'analytics', 1], { total_members: 3 });
  };

  it('useApproveJoinRequest invalidates join-requests, users, units, and analytics caches', async () => {
    seedCaches();
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useApproveJoinRequest(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 10, unit_id: 2, position_id: 3 });
    });

    expect(queryClient.getQueryState(['join-requests', 'pending', 1])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['users', { organization_id: 1 }])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['units', 1])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['organizations', 'analytics', 1])?.isInvalidated).toBe(true);
  });

  it('useCreateMembership invalidates users, units, and analytics caches', async () => {
    seedCaches();
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useCreateMembership(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ user_id: 5, unit_id: 2, position_id: 3 });
    });

    expect(queryClient.getQueryState(['users', { organization_id: 1 }])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['units', 1])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['organizations', 'analytics', 1])?.isInvalidated).toBe(true);
  });

  it('useUpdateMembership invalidates users, units, and analytics caches', async () => {
    seedCaches();
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useUpdateMembership(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 20, data: { is_active: false } });
    });

    expect(queryClient.getQueryState(['users', { organization_id: 1 }])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['units', 1])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['organizations', 'analytics', 1])?.isInvalidated).toBe(true);
  });

  it('useRemoveMember invalidates users, units, and analytics caches', async () => {
    seedCaches();
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useRemoveMember(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ user_id: 5 });
    });

    expect(queryClient.getQueryState(['users', { organization_id: 1 }])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['units', 1])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['organizations', 'analytics', 1])?.isInvalidated).toBe(true);
  });
});
