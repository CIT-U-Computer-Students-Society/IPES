import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Login from '@/pages/Login';
import { api, ApiError } from '@/lib/api';
import { ThemeProvider } from '../theme-provider';

vi.mock('@/lib/api', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return { ...original, api: { get: vi.fn(), post: vi.fn() } };
});
beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.get).mockRejectedValue(new ApiError(403, 'Forbidden', null));
  vi.mocked(api.post).mockResolvedValue(new Response(JSON.stringify({
    user: { id: 1, email: 'user@cit.edu', first_name: 'Alex', memberships: [] },
  })));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

function showLogin(staleSession = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (staleSession) client.setQueryData(['users', 'current'], { id: 99 });
  render(<ThemeProvider><QueryClientProvider client={client}><MemoryRouter>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/select-organization" element={<h1>Choose an organization</h1>} />
    </Routes>
  </MemoryRouter></QueryClientProvider></ThemeProvider>);
  return client;
}

it('ignores a stale local profile and stores successful login only in the query cache', async () => {
  localStorage.setItem('user', JSON.stringify({ id: 99 }));
  localStorage.setItem('authToken', 'legacy-token');
  const client = showLogin();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/me/'));
  expect(screen.getByLabelText('Institutional Email')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Institutional Email'), { target: { value: 'user@cit.edu' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Password').closest('form'));
  expect(await screen.findByRole('heading', { name: 'Choose an organization' })).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/auth/login/', { email: 'user@cit.edu', password: 'password123' });
  expect(localStorage.getItem('authToken')).toBeNull();
  expect(localStorage.getItem('user')).toBeNull();
  expect(client.getQueryData(['users', 'current'])).toMatchObject({ id: 1 });
});

it('lets an expired cached session reach the login form', async () => {
  showLogin(true);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/me/'));
  await waitFor(() => expect(screen.getByLabelText('Institutional Email')).toBeInTheDocument());
  expect(screen.queryByRole('heading', { name: 'Choose an organization' })).toBeNull();
});
