import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { OrganizationProvider, useOrganizationState } from '@/contexts/OrganizationContext';
import SelectOrganization from '@/pages/SelectOrganization';
import { ThemeProvider } from '../theme-provider';

vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: () => ({ data: { first_name: 'Alex', memberships: [{
    id: 1, organization_id: 1, organization_name: 'Research Society',
    unit_name: 'Research Committee', position_name: 'Chair', role: 'Admin',
  }] }, isLoading: false }),
  useLogout: () => ({ logout: vi.fn() }),
}));
vi.mock('@/hooks/useOrganizations', () => ({
  useCreateOrganization: () => ({ mutate: vi.fn(), isPending: false }),
  useJoinOrganization: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../ProfileEditorDialog', () => ({
  ProfileEditorDialog: ({ children }: { children: React.ReactNode }) => children,
}));

function DashboardGuard() {
  const { activeOrganizationId } = useOrganizationState();
  return activeOrganizationId === 1 ? <h1>Organization dashboard</h1> : <Navigate to="/select-organization" replace />;
}

beforeEach(() => { localStorage.clear(); localStorage.setItem('authToken', 'local-test-token'); });
afterEach(() => { cleanup(); localStorage.clear(); });

it('keeps the selected organization through the dashboard route guard', async () => {
  render(<ThemeProvider><MemoryRouter initialEntries={['/select-organization']}>
    <OrganizationProvider><Routes>
      <Route path="/select-organization" element={<SelectOrganization />} />
      <Route path="/admin/dashboard" element={<DashboardGuard />} />
    </Routes></OrganizationProvider>
  </MemoryRouter></ThemeProvider>);
  fireEvent.click(screen.getByRole('heading', { name: 'Research Society' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Organization dashboard' })).toBeInTheDocument());
  expect(localStorage.getItem('activeOrganizationId')).toBe('1');
});
