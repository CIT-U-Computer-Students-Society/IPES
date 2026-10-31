import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuditLog from '@/pages/admin/AuditLog';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ThemeProvider } from '../theme-provider';
import type { AuditLog as AuditLogType } from '@/hooks/useAudit';

let mockAuditState = {
  data: [] as AuditLogType[] | undefined,
  isLoading: false,
  isError: false,
  error: null as Error | null,
  refetch: vi.fn(),
};

vi.mock('@/hooks/useAudit', () => ({
  useAuditLogs: () => mockAuditState,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <OrganizationProvider>{children}</OrganizationProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </MemoryRouter>
    );
  };
}

describe('AuditLog page state rendering (#265)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('activeOrganizationId', '1');
    mockAuditState = {
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading spinner when query is loading', () => {
    mockAuditState.isLoading = true;
    mockAuditState.data = undefined;
    const wrapper = createWrapper();
    const { container } = render(<AuditLog />, { wrapper });

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders error state with retry button and avoids empty state on failure', () => {
    mockAuditState.isLoading = false;
    mockAuditState.isError = true;
    mockAuditState.error = new Error('HTTP 500: Internal Server Error');
    mockAuditState.data = undefined;

    const wrapper = createWrapper();
    render(<AuditLog />, { wrapper });

    expect(screen.getByText('Failed to load audit history')).toBeInTheDocument();
    expect(screen.getByText('HTTP 500: Internal Server Error')).toBeInTheDocument();
    expect(screen.queryByText('No audit logs found')).not.toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(mockAuditState.refetch).toHaveBeenCalledTimes(1);
  });

  it('renders successful empty state when no audit events exist', () => {
    mockAuditState.isLoading = false;
    mockAuditState.isError = false;
    mockAuditState.data = [];

    const wrapper = createWrapper();
    render(<AuditLog />, { wrapper });

    expect(screen.getByText('No audit logs found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load audit history')).not.toBeInTheDocument();
  });

  it('renders audit events and summary cards when data is present', () => {
    mockAuditState.isLoading = false;
    mockAuditState.isError = false;
    mockAuditState.data = [
      {
        id: 1,
        user_id: 10,
        user_email: 'admin@cit.edu',
        user_name: 'Admin User',
        action: 'user.login',
        datetime: new Date().toISOString(),
        ip_address: '127.0.0.1',
      },
      {
        id: 2,
        user_id: 11,
        user_email: 'editor@cit.edu',
        user_name: 'Editor User',
        action: 'evaluation.form_created',
        datetime: new Date().toISOString(),
        ip_address: '127.0.0.1',
      },
    ];

    const wrapper = createWrapper();
    render(<AuditLog />, { wrapper });

    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Editor User')).toBeInTheDocument();
    expect(screen.getByText('Logins')).toBeInTheDocument();
    expect(screen.getByText('Creations')).toBeInTheDocument();
  });
});
