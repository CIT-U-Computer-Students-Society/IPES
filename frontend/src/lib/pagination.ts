/**
 * Utility for transparent pagination traversal.
 */

import { api } from './api';

export function extractEndpoint(nextUrl: string): string {
  try {
    const url = new URL(nextUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    let path = url.pathname;
    if (path.startsWith('/api/')) {
      path = path.slice(4);
    } else if (path === '/api') {
      path = '/';
    }
    return `${path}${url.search}`;
  } catch {
    if (nextUrl.startsWith('/api/')) {
      return nextUrl.slice(4);
    }
    return nextUrl;
  }
}

export async function fetchAllPages<T>(initialEndpoint: string): Promise<T[]> {
  let endpoint: string | null = initialEndpoint;
  const results: T[] = [];
  const seenEndpoints = new Set<string>();

  while (endpoint) {
    if (seenEndpoints.has(endpoint)) {
      break;
    }
    seenEndpoints.add(endpoint);

    const response = await api.get(endpoint);
    const data = await response.json() as { results?: T[]; next?: string | null } | T[];

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.results)) {
      results.push(...data.results);
    }

    if (data.next) {
      endpoint = extractEndpoint(data.next);
    } else {
      endpoint = null;
    }
  }

  return results;
}
