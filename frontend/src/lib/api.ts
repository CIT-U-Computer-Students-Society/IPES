/**
 * API Configuration for Django Backend
 * 
 * This file contains the base API URL and utility functions for making API calls
 * to the Django REST Framework backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Get the full API URL for an endpoint
 */
export const getApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

/**
 * Custom API Error class to carry response data
 */
export class ApiError extends Error {
  status: number;
  statusText: string;
  data: unknown;

  constructor(status: number, statusText: string, data: unknown) {
    super(`API request failed: ${status} ${statusText}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

/**
 * Convert an ApiError (or any Error) into a human-readable string.
 * Handles DRF's various error response shapes:
 *   { field: ["msg"] }              → field: msg
 *   { non_field_errors: ["msg"] }   → msg
 *   { detail: "msg" }               → msg
 *   plain string                    → as-is
 */
export function formatApiError(e: unknown): string {
  if (e instanceof ApiError && e.data && typeof e.data === 'object') {
    const data = e.data as Record<string, unknown>;

    // { detail: "..." }
    if (typeof data.detail === 'string') return data.detail;

    // { non_field_errors: ["..."] }
    if (Array.isArray(data.non_field_errors)) {
      return (data.non_field_errors as string[]).join(' ');
    }

    // { field: ["msg", ...], field2: ["msg"] }
    const fieldErrors = Object.entries(data)
      .filter(([, v]) => Array.isArray(v) || typeof v === 'string')
      .map(([field, msgs]) => {
        const messages = Array.isArray(msgs) ? (msgs as string[]).join(', ') : String(msgs);
        const label = field === 'non_field_errors' ? '' : `${field}: `;
        return `${label}${messages}`;
      });

    if (fieldErrors.length > 0) return fieldErrors.join('\n');
  }

  if (e instanceof Error) return e.message;
  return 'An unexpected error occurred.';
}

/**
 * Make an authenticated API request
 */
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = getApiUrl(endpoint);

  // The browser must supply the multipart boundary for file uploads.
  const defaultHeaders: Record<string, string> = options.body instanceof FormData
    ? {}
    : { 'Content-Type': 'application/json' };

  // Include active Organization ID for tenant scoping & audit trails
  // (skip during login/register to avoid CORS preflight on first request)
  const activeOrgId = localStorage.getItem('activeOrganizationId');
  const skipOrgHeader = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register');
  if (activeOrgId && !skipOrgHeader) {
    defaultHeaders['X-Organization-Id'] = activeOrgId;
  }

  // Discard credentials left by older releases; only HttpOnly cookies authenticate.
  localStorage.removeItem('authToken');
  const headers = new Headers({ ...defaultHeaders });
  new Headers(options.headers).forEach((value, name) => headers.set(name, value));
  headers.delete('Authorization');
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    headers.set('X-CSRFToken', await getCsrfToken());
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    throw new ApiError(response.status, response.statusText, data);
  }

  return response;
};

// Share only in-flight bootstraps. Fetch again for each mutation so login,
// logout, or another tab rotating the CSRF cookie cannot leave a cached token.
let csrfRequest: Promise<string> | null = null;
const getCsrfToken = (): Promise<string> => {
  if (!csrfRequest) {
    csrfRequest = (async () => {
      const response = await fetch(getApiUrl('/auth/csrf/'), {
        credentials: 'include', cache: 'no-store',
      });
      if (!response.ok) throw new ApiError(response.status, response.statusText, null);
      const data = await response.json();
      if (typeof data.csrfToken !== 'string' || !data.csrfToken) {
        throw new Error('Unable to initialize request protection. Please retry.');
      }
      return data.csrfToken;
    })().finally(() => { csrfRequest = null; });
  }
  return csrfRequest;
};

/**
 * API helper functions for common HTTP methods
 */
export const api = {
  get: (endpoint: string) => apiRequest(endpoint, { method: 'GET' }),

  post: (endpoint: string, data?: unknown) =>
    apiRequest(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
    }),

  put: (endpoint: string, data?: unknown) =>
    apiRequest(endpoint, {
      method: 'PUT',
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
    }),

  patch: (endpoint: string, data?: unknown) =>
    apiRequest(endpoint, {
      method: 'PATCH',
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
    }),

  delete: (endpoint: string) => apiRequest(endpoint, { method: 'DELETE' }),
};

export default api;
