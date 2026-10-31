import type { ReactNode } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import {
  useAccomplishments,
  useMyAccomplishments,
  usePendingAccomplishments,
  useAccomplishmentsByType,
} from '../usePortfolio';

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

describe('Accomplishment multi-page pagination traversal (#245)', () => {
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

  it('useAccomplishments aggregates all records across multiple pages', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 22,
          next: 'http://127.0.0.1:8000/api/accomplishments/?page=2',
          results: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            title: `Accomplishment ${i + 1}`,
            status: 'Verified',
          })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 22,
          next: null,
          results: [
            { id: 21, title: 'Accomplishment 21', status: 'Pending' },
            { id: 22, title: 'Accomplishment 22', status: 'Verified' },
          ],
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useAccomplishments(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(22);
    });

    expect(result.current.data?.[0].title).toBe('Accomplishment 1');
    expect(result.current.data?.[20].title).toBe('Accomplishment 21');
    expect(result.current.data?.[20].status).toBe('Pending');
    expect(result.current.data?.[21].title).toBe('Accomplishment 22');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('useMyAccomplishments aggregates all member records beyond first page', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 21,
          next: 'http://127.0.0.1:8000/api/accomplishments/my/?organization_id=1&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            title: `My Record ${i + 1}`,
            status: 'Verified',
          })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 21,
          next: null,
          results: [{ id: 21, title: 'My Record 21', status: 'Pending' }],
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useMyAccomplishments(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(21);
    });

    expect(result.current.data?.[20].title).toBe('My Record 21');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('usePendingAccomplishments traverses pages to retrieve all pending work', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 25,
          next: 'http://127.0.0.1:8000/api/accomplishments/pending/?organization_id=1&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            title: `Pending Item ${i + 1}`,
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
            title: `Pending Item ${i + 21}`,
            status: 'Pending',
          })),
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => usePendingAccomplishments(1), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(25);
    });

    expect(result.current.data?.[24].title).toBe('Pending Item 25');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('useAccomplishmentsByType traverses pages for typed records', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 23,
          next: 'http://127.0.0.1:8000/api/accomplishments/by_type/?type=project&page=2',
          results: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            type: 'project',
            title: `Project ${i + 1}`,
          })),
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          count: 23,
          next: null,
          results: Array.from({ length: 3 }, (_, i) => ({
            id: i + 21,
            type: 'project',
            title: `Project ${i + 21}`,
          })),
        }),
      } as Response);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useAccomplishmentsByType('project'), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(23);
    });

    expect(result.current.data?.[22].title).toBe('Project 23');
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
