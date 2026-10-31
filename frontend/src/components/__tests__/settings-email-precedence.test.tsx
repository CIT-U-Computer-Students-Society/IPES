import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminSettings from '@/pages/admin/Settings';
import { ThemeProvider } from '../theme-provider';

const state = vi.hoisted(() => ({
  updateOrganization: vi.fn(),
  organization: {
    id: 1,
    name: 'Fresh organization',
    description: '',
    code: 'REV',
    email: '' as string | null,
  },
  membership: {
    organization_id: 1,
    organization_name: 'Old organization',
    organization_email: 'stale@example.test',
    role: 'Admin',
  },
}));

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganizationState: () => ({ activeOrganizationId: 1 }),
}));
vi.mock('@/hooks/useOrganizations', () => ({
  useOrganization: () => ({ data: state.organization }),
  useUpdateOrganization: () => ({ mutate: state.updateOrganization, isPending: false }),
  useDeleteOrganization: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useUsers', () => ({
  useCurrentMembership: () => ({ data: state.membership }),
}));

afterEach(() => {
  cleanup();
  state.updateOrganization.mockReset();
});

describe('Settings Organization Email Precedence', () => {
  it.each(['', null])(
    'respects an authoritative cleared organization email (%s)',
    (email) => {
      state.organization.email = email;
      render(
        <MemoryRouter>
          <ThemeProvider defaultTheme="light">
            <AdminSettings />
          </ThemeProvider>
        </MemoryRouter>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect(state.updateOrganization).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: '' }) }),
        expect.anything()
      );
    }
  );
});
