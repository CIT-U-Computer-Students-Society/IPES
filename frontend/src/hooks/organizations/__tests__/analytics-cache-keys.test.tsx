import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { OrganizationProvider, useOrganizationState } from '@/contexts/OrganizationContext';
import { useUnitCompletionStats, useAnalyticsSummary } from '../useOrgHooks';

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

describe('Dashboard analytics cache key tenant isolation (#274)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('disables queries when no active organization and no argument provided', () => {
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => ({
      unit: useUnitCompletionStats(),
      summary: useAnalyticsSummary(),
    }), { wrapper });

    expect(result.current.unit.fetchStatus).toBe('idle');
    expect(result.current.summary.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('scopes query keys by effectiveOrgId and isolates cached data between organizations', async () => {
    const orgAStats = [{ unit_id: 1, unit_name: 'Unit A', unit_type: null, total_members: 5, total_assignments: 10, completed_assignments: 10, completion_percentage: 100 }];
    const orgBStats = [{ unit_id: 2, unit_name: 'Unit B', unit_type: null, total_members: 3, total_assignments: 6, completed_assignments: 3, completion_percentage: 50 }];

    const orgASummary = { total_organizations: 1, total_units: 1, total_members: 5, total_users: 5, total_assignments: 10, completed_assignments: 10, pending_assignments: 0, overall_completion_rate: 100 };
    const orgBSummary = { total_organizations: 1, total_units: 1, total_members: 3, total_users: 3, total_assignments: 6, completed_assignments: 3, pending_assignments: 3, overall_completion_rate: 50 };

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.includes('/organizations/unit_completion_stats/?organization_id=1')) {
        return { json: async () => orgAStats } as Response;
      }
      if (url.includes('/organizations/unit_completion_stats/?organization_id=2')) {
        return { json: async () => orgBStats } as Response;
      }
      if (url.includes('/organizations/analytics_summary/?organization_id=1')) {
        return { json: async () => orgASummary } as Response;
      }
      if (url.includes('/organizations/analytics_summary/?organization_id=2')) {
        return { json: async () => orgBSummary } as Response;
      }
      throw new Error(`Unhandled URL: ${url}`);
    });

    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => ({
      context: useOrganizationState(),
      unit: useUnitCompletionStats(),
      summary: useAnalyticsSummary(),
    }), { wrapper });

    // Set organization 1 active
    act(() => {
      result.current.context.setActiveOrganizationId(1);
    });

    await waitFor(() => expect(result.current.unit.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.summary.isSuccess).toBe(true));

    expect(result.current.unit.data).toEqual(orgAStats);
    expect(result.current.summary.data).toEqual(orgASummary);

    // Switch active organization to 2
    act(() => {
      result.current.context.setActiveOrganizationId(2);
    });

    await waitFor(() => expect(result.current.unit.data).toEqual(orgBStats));
    await waitFor(() => expect(result.current.summary.data).toEqual(orgBSummary));

    // Both query cache entries must exist distinctly
    expect(queryClient.getQueryData(['organizations', 'unit-completion', 1])).toEqual(orgAStats);
    expect(queryClient.getQueryData(['organizations', 'unit-completion', 2])).toEqual(orgBStats);
    expect(queryClient.getQueryData(['organizations', 'analytics', 1])).toEqual(orgASummary);
    expect(queryClient.getQueryData(['organizations', 'analytics', 2])).toEqual(orgBSummary);
  });

  it('does not leak prior organization data when switching to an organization whose fetch fails', async () => {
    const orgAStats = [{ unit_id: 1, unit_name: 'Unit A', unit_type: null, total_members: 5, total_assignments: 10, completed_assignments: 10, completion_percentage: 100 }];

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.includes('organization_id=1')) {
        return { json: async () => orgAStats } as Response;
      }
      if (url.includes('organization_id=2')) {
        throw new Error('Organization B fetch failed');
      }
      throw new Error(`Unhandled URL: ${url}`);
    });

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => ({
      context: useOrganizationState(),
      unit: useUnitCompletionStats(),
    }), { wrapper });

    act(() => {
      result.current.context.setActiveOrganizationId(1);
    });

    await waitFor(() => expect(result.current.unit.isSuccess).toBe(true));
    expect(result.current.unit.data).toEqual(orgAStats);

    // Switch to Org 2 which fails
    act(() => {
      result.current.context.setActiveOrganizationId(2);
    });

    await waitFor(() => expect(result.current.unit.isError).toBe(true));
    // Must NOT retain or show Org A's stats under Org 2
    expect(result.current.unit.data).toBeUndefined();
  });

  it('uses explicit organizationId argument over active organization context', async () => {
    const explicitStats = [{ unit_id: 99, unit_name: 'Explicit Unit', unit_type: null, total_members: 1, total_assignments: 1, completed_assignments: 1, completion_percentage: 100 }];
    vi.mocked(api.get).mockResolvedValue({ json: async () => explicitStats } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => ({
      context: useOrganizationState(),
      unit: useUnitCompletionStats(99),
    }), { wrapper });

    act(() => {
      result.current.context.setActiveOrganizationId(1);
    });

    await waitFor(() => expect(result.current.unit.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/organizations/unit_completion_stats/?organization_id=99');
    expect(queryClient.getQueryData(['organizations', 'unit-completion', 99])).toEqual(explicitStats);
  });
});
