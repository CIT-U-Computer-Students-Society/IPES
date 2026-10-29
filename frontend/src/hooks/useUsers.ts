/**
 * User API Hooks
 * 
 * Hooks for user management operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOrganizationState } from '@/contexts/OrganizationContext';

// User type definition
export interface Membership {
  id: number;
  organization_id: number;
  organization_name: string;
  organization_email?: string;
  unit_id: number;
  unit_name: string;
  position_id: number;
  position_name: string;
  position_rank: number;
  role: 'Admin' | 'Member';
  is_active: boolean;
}

export interface User {
  id: number;
  display_picture?: string | null;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
  last_login?: string;
  memberships: Membership[];
}

export interface UserCreate {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
}

export interface UserUpdate {
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
}

export interface ProfileUpdate {
  first_name: string;
  last_name: string;
  display_picture?: File | null;
}

// Renew private image URLs before their one-hour expiry while a view is open.
const AVATAR_REFRESH_INTERVAL = 45 * 60 * 1000;

// Fetch all users
export const useUsers = (params?: { is_active?: boolean; role?: string; organization_id?: number }) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveParams = { ...params, organization_id: params?.organization_id || activeOrganizationId || undefined };

  const queryString = Object.keys(effectiveParams).length > 0
    ? '?' + new URLSearchParams(
      Object.entries(effectiveParams).filter(([, v]) => v !== undefined).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {})
    ).toString()
    : '';

  return useQuery({
    queryKey: ['users', effectiveParams],
    refetchInterval: AVATAR_REFRESH_INTERVAL,
    queryFn: async () => {
      const response = await api.get(`/users/${queryString}`);
      const data = await response.json() as { results: User[]; count: number } | User[];
      // Handle both paginated and non-paginated responses
      return Array.isArray(data) ? data : data.results || [];
    },
  });
};

// Fetch single user
export const useUser = (id: number) => {
  return useQuery({
    queryKey: ['users', id],
    refetchInterval: AVATAR_REFRESH_INTERVAL,
    queryFn: async () => {
      const response = await api.get(`/users/${id}/`);
      return response.json() as Promise<User>;
    },
    enabled: !!id,
  });
};

// Create user
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation<User, Error, UserCreate>({
    mutationFn: async (data: UserCreate) => {
      const response = await api.post('/users/', data);
      return response.json() as Promise<User>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// Update user
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation<User, Error, { id: number; data: UserUpdate }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.patch(`/users/${id}/`, data);
      return response.json() as Promise<User>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', variables.id] });
    },
  });
};

// Delete/Deactivate user
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (id: number) => {
      await api.delete(`/users/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// Get current user profile
export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['users', 'current'],
    refetchInterval: AVATAR_REFRESH_INTERVAL,
    queryFn: async () => {
      const response = await api.get('/auth/me/');
      return response.json() as Promise<User>;
    },
  });
};

// Update current user profile
export const useUpdateCurrentUser = () => {
  const queryClient = useQueryClient();

  return useMutation<User, Error, ProfileUpdate>({
    mutationFn: async (data: ProfileUpdate) => {
      let payload: ProfileUpdate | FormData = data;
      if (data.display_picture instanceof File) {
        payload = new FormData();
        payload.append('first_name', data.first_name);
        payload.append('last_name', data.last_name);
        payload.append('display_picture', data.display_picture);
      }
      const response = await api.patch('/auth/me/', payload);
      return response.json() as Promise<User>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users', 'current'], data);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// Get current user's membership for active organization
export const useCurrentMembership = () => {
  const { data: currentUser } = useCurrentUser();
  const { activeOrganizationId } = useOrganizationState();

  return useQuery({
    queryKey: ['users', 'current', 'membership', activeOrganizationId],
    queryFn: () => {
      if (!currentUser?.memberships || !activeOrganizationId) return null;
      return currentUser.memberships.find(m => m.organization_id === activeOrganizationId) || null;
    },
    enabled: !!currentUser && !!activeOrganizationId,
  });
};

// Get user statistics
export const useUserStats = () => {
  return useQuery({
    queryKey: ['users', 'stats'],
    queryFn: async () => {
      const response = await api.get('/users/');
      const usersList = (await response.json()) as User[];
      const total = usersList.length;
      const active = usersList.filter(u => u.is_active).length;

      // Since roles are now tenant-based, global role stats are no longer viable here
      const by_role = { 'Admin': 0, 'Member': 0 };

      return { total, active, by_role };
    },
  });
};

// Logout hook - properly clears session and prevents back navigation
export const useLogout = () => {
  const queryClient = useQueryClient();

  const logout = async () => {
    try {
      // Call the backend logout endpoint to clear session
      await api.post('/auth/logout/', {});
    } catch {
      // Continue with client-side cleanup even if API fails
    }

    // Clear all user data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('activeOrganizationId');
    localStorage.removeItem('authToken');

    // Clear all cached queries
    queryClient.clear();

    // Navigate to login with replace to prevent back navigation
    window.location.replace('/login');
  };

  return { logout };
};
