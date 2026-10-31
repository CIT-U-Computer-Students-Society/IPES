import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficerAccomplishments from '@/pages/officer/Accomplishments';
import AdminAccomplishments from '@/pages/admin/AdminAccomplishments';
import { ThemeProvider } from '../theme-provider';
import type { Accomplishment } from '@/hooks/usePortfolio';

const mockOfficerState = {
  data: [] as Accomplishment[],
  isLoading: false,
  isError: false,
  error: null as Error | null,
  refetch: vi.fn(),
};

const mockAdminState = {
  data: [] as Accomplishment[],
  isLoading: false,
  isError: false,
  error: null as Error | null,
  refetch: vi.fn(),
};

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganizationState: () => ({ activeOrganizationId: 1 }),
  useOrganization: () => ({ currentOrganization: { id: 1, name: 'Test Org' } }),
}));

vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: () => ({
    data: { id: 1, email: 'officer@example.com', first_name: 'Officer' },
  }),
}));

vi.mock('@/hooks/usePortfolio', () => ({
  useMyAccomplishments: () => ({
    data: mockOfficerState.data,
    isLoading: mockOfficerState.isLoading,
    isError: mockOfficerState.isError,
    error: mockOfficerState.error,
    refetch: mockOfficerState.refetch,
  }),
  useAccomplishments: () => ({
    data: mockAdminState.data,
    isLoading: mockAdminState.isLoading,
    isError: mockAdminState.isError,
    error: mockAdminState.error,
    refetch: mockAdminState.refetch,
  }),
  useCreateAccomplishment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateAccomplishment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useVerifyAccomplishment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const sampleAccomplishment: Accomplishment = {
  id: 1,
  user_id: 10,
  user_name: 'Jane Doe',
  organization_id: 1,
  title: 'Community Project',
  description: 'Community cleanup drive',
  type: 'project',
  date_completed: '2026-05-01',
  status: 'Pending',
};

describe('Portfolio Request Failures and Actionable Error State (#246)', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Officer Accomplishments page', () => {
    beforeEach(() => {
      mockOfficerState.data = [];
      mockOfficerState.isLoading = false;
      mockOfficerState.isError = false;
      mockOfficerState.error = null;
      mockOfficerState.refetch.mockReset();
    });

    it('renders distinct error state with retry button on query failure', () => {
      mockOfficerState.isError = true;
      mockOfficerState.error = new Error('Network error: unable to load portfolio');

      render(
        <MemoryRouter>
          <ThemeProvider defaultTheme="light">
            <OfficerAccomplishments />
          </ThemeProvider>
        </MemoryRouter>
      );

      // Verify error message is present
      expect(screen.getByText('Failed to load accomplishments')).toBeInTheDocument();
      expect(screen.getByText('Network error: unable to load portfolio')).toBeInTheDocument();

      // Verify empty state is NOT shown
      expect(screen.queryByText('No accomplishments found.')).not.toBeInTheDocument();

      // Verify Retry button is present and triggers refetch
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      fireEvent.click(retryButton);
      expect(mockOfficerState.refetch).toHaveBeenCalledTimes(1);
    });

    it('shows successful empty state when query returns empty array without error', () => {
      mockOfficerState.data = [];
      mockOfficerState.isError = false;

      render(
        <MemoryRouter>
          <ThemeProvider defaultTheme="light">
            <OfficerAccomplishments />
          </ThemeProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('No accomplishments found.')).toBeInTheDocument();
      expect(screen.queryByText('Failed to load accomplishments')).not.toBeInTheDocument();
    });

    it('displays cached data with error banner on background refetch failure', () => {
      mockOfficerState.data = [sampleAccomplishment];
      mockOfficerState.isError = true;
      mockOfficerState.error = new Error('Service unavailable');

      render(
        <MemoryRouter>
          <ThemeProvider defaultTheme="light">
            <OfficerAccomplishments />
          </ThemeProvider>
        </MemoryRouter>
      );

      // Verify cached item is displayed
      expect(screen.getByText('Community Project')).toBeInTheDocument();

      // Verify banner notifying cached data
      expect(
        screen.getByText('Failed to update accomplishments. Showing previously loaded records.')
      ).toBeInTheDocument();

      // Verify retry button works
      const retryButtons = screen.getAllByRole('button', { name: /retry/i });
      fireEvent.click(retryButtons[0]);
      expect(mockOfficerState.refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Admin Accomplishments page', () => {
    beforeEach(() => {
      mockAdminState.data = [];
      mockAdminState.isLoading = false;
      mockAdminState.isError = false;
      mockAdminState.error = null;
      mockAdminState.refetch.mockReset();
    });

    it('renders distinct error state with retry button on initial query failure', () => {
      mockAdminState.isError = true;
      mockAdminState.error = new Error('500 Internal Server Error');

      render(
        <MemoryRouter>
          <ThemeProvider defaultTheme="light">
            <AdminAccomplishments />
          </ThemeProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Failed to load accomplishments')).toBeInTheDocument();
      expect(screen.getByText('500 Internal Server Error')).toBeInTheDocument();
      expect(screen.queryByText('No accomplishments found.')).not.toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      fireEvent.click(retryButton);
      expect(mockAdminState.refetch).toHaveBeenCalledTimes(1);
    });

    it('shows successful empty state when query succeeds with no records', () => {
      mockAdminState.data = [];
      mockAdminState.isError = false;

      render(
        <MemoryRouter>
          <ThemeProvider defaultTheme="light">
            <AdminAccomplishments />
          </ThemeProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('No accomplishments found.')).toBeInTheDocument();
      expect(screen.queryByText('Failed to load accomplishments')).not.toBeInTheDocument();
    });

    it('displays cached data with error banner on background refetch failure', () => {
      mockAdminState.data = [sampleAccomplishment];
      mockAdminState.isError = true;
      mockAdminState.error = new Error('Connection refused');

      render(
        <MemoryRouter>
          <ThemeProvider defaultTheme="light">
            <AdminAccomplishments />
          </ThemeProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Community Project')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to update accomplishments. Showing previously loaded records.')
      ).toBeInTheDocument();

      const retryButtons = screen.getAllByRole('button', { name: /retry/i });
      fireEvent.click(retryButtons[0]);
      expect(mockAdminState.refetch).toHaveBeenCalledTimes(1);
    });
  });
});
