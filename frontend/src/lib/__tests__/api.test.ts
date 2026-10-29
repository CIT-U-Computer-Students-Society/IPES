import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, apiRequest, ApiError, formatApiError, getApiUrl } from '../api';

describe('API error formatting used by mutation handlers', () => {
  it.each([
    [{ rank: ['Already assigned'] }, 'rank: Already assigned'],
    [{ non_field_errors: ['Invalid credentials'] }, 'Invalid credentials'],
    [{ detail: 'Membership unavailable' }, 'Membership unavailable'],
  ])('preserves structured API error messages', (data, expected) => {
    expect(formatApiError(new ApiError(400, 'Bad Request', data))).toBe(expected);
  });
  it('handles network errors and unknown thrown values', () => {
    expect(formatApiError(new Error('Connection lost'))).toBe('Connection lost');
    expect(formatApiError(null)).toBe('An unexpected error occurred.');
  });
});

describe('cookie-authenticated API transport', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
      url.endsWith('/auth/csrf/') ? { csrfToken: 'masked-token' } : { success: true },
    ), { status: 200 })));
    localStorage.clear();
  });
  it('formats endpoint URLs', () => {
    expect(getApiUrl('/users')).toBe(getApiUrl('users'));
    expect(getApiUrl('/users')).toMatch(/\/api\/users$/);
  });
  it('uses cookies for reads and discards legacy bearer credentials', async () => {
    localStorage.setItem('authToken', 'stolen-token');
    await apiRequest('/auth/me/', { headers: { Authorization: 'Token old-token' } });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options.credentials).toBe('include');
    expect(new Headers(options.headers).has('Authorization')).toBe(false);
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('preserves organization scoping', async () => {
    localStorage.setItem('activeOrganizationId', '111');
    await api.get('/users/');
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1].headers).get('X-Organization-Id')).toBe('111');
  });
  it('bootstraps login CSRF without reading cookies or sending an organization', async () => {
    localStorage.setItem('activeOrganizationId', '111');
    await api.post('/auth/login/', { email: 'user@cit.edu', password: 'password' });
    expect(fetch).toHaveBeenNthCalledWith(1, getApiUrl('/auth/csrf/'), {
      credentials: 'include', cache: 'no-store',
    });
    const headers = new Headers(vi.mocked(fetch).mock.calls[1][1].headers);
    expect(headers.get('X-CSRFToken')).toBe('masked-token');
    expect(headers.has('X-Organization-Id')).toBe(false);
    expect(vi.mocked(fetch).mock.calls[1][1].credentials).toBe('include');
  });
  it('sends multipart uploads unchanged with cookies and CSRF', async () => {
    const body = new FormData();
    body.append('display_picture', new File(['image'], 'avatar.png', { type: 'image/png' }));
    await api.patch('/auth/me/', body);
    const [, options] = vi.mocked(fetch).mock.calls[1];
    expect(options.body).toBe(body);
    const headers = new Headers(options.headers);
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.get('X-CSRFToken')).toBe('masked-token');
    expect(options.credentials).toBe('include');
  });
  it('shares concurrent bootstraps but refreshes after cookie rotation', async () => {
    await Promise.all([api.post('/one/', {}), api.post('/two/', {})]);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/auth/csrf/'))).toHaveLength(1);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'rotated-token' })));
    await api.delete('/three/');
    const calls = vi.mocked(fetch).mock.calls;
    expect(new Headers(calls[calls.length - 1][1].headers).get('X-CSRFToken')).toBe('rotated-token');
  });
  it('does not send or replay mutations when CSRF initialization fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(api.post('/auth/login/', {})).rejects.toMatchObject({ status: 503 });
    expect(fetch).toHaveBeenCalledTimes(1);
    await api.post('/auth/login/', {});
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('preserves API validation errors without retrying the mutation', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'masked-token' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Forbidden' }), { status: 403 }));
    await expect(api.post('/test/', {})).rejects.toMatchObject({ status: 403, data: { detail: 'Forbidden' } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
