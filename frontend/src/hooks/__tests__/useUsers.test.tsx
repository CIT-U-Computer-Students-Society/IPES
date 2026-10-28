import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';
import { useUpdateCurrentUser } from '../useUsers';

vi.mock('@/lib/api', () => ({ api: { patch: vi.fn() } }));
vi.mock('@/contexts/OrganizationContext', () => ({ useOrganizationState: () => ({ activeOrganizationId: 1 }) }));

describe('profile update transport and cache', () => {
  const updated = { id: 1, first_name: 'Ava', last_name: 'Cruz', display_picture: 'https://example.com/signed' };
  beforeEach(() => {
    vi.mocked(api.patch).mockReset();
    vi.mocked(api.patch).mockResolvedValue({ json: async () => updated } as Response);
  });

  const setup = () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(['users', { organization_id: 1 }], []);
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    return { ...renderHook(() => useUpdateCurrentUser(), { wrapper }), client };
  };

  it('uploads a file as multipart and refreshes profile and directory caches', async () => {
    const { result, client } = setup();
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    await act(async () => {
      await result.current.mutateAsync({ first_name: 'Ava', last_name: 'Cruz', display_picture: file });
    });
    const [endpoint, payload] = vi.mocked(api.patch).mock.calls[0];
    expect(endpoint).toBe('/auth/me/');
    expect(payload).toBeInstanceOf(FormData);
    expect((payload as FormData).get('display_picture')).toBe(file);
    expect((payload as FormData).get('first_name')).toBe('Ava');
    expect(client.getQueryData(['users', 'current'])).toEqual(updated);
    expect(client.getQueryState(['users', { organization_id: 1 }])?.isInvalidated).toBe(true);
  });

  it.each([undefined, null])('keeps name updates and picture removal as JSON', async picture => {
    const { result } = setup();
    const values = { first_name: 'Ava', last_name: 'Cruz', ...(picture === null ? { display_picture: null } : {}) };
    await act(async () => { await result.current.mutateAsync(values); });
    expect(api.patch).toHaveBeenCalledWith('/auth/me/', values);
  });
});
