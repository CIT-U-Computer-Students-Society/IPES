import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api } from '../api';
import { extractEndpoint, fetchAllPages } from '../pagination';

vi.mock('../api', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('pagination traversal (#273)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractEndpoint', () => {
    it('extracts endpoint and search from full DRF absolute next URL', () => {
      expect(
        extractEndpoint('http://127.0.0.1:8000/api/users/?organization_id=1&page=2')
      ).toBe('/users/?organization_id=1&page=2');
    });

    it('extracts endpoint from relative URL with /api prefix', () => {
      expect(extractEndpoint('/api/units/?page=3')).toBe('/units/?page=3');
    });

    it('preserves relative endpoint without /api prefix', () => {
      expect(extractEndpoint('/positions/?page=2')).toBe('/positions/?page=2');
    });
  });

  describe('fetchAllPages', () => {
    it('returns array directly if backend returns non-paginated list', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        json: async () => [{ id: 1 }, { id: 2 }],
      } as Response);

      const results = await fetchAllPages('/test/');
      expect(results).toEqual([{ id: 1 }, { id: 2 }]);
      expect(api.get).toHaveBeenCalledTimes(1);
    });

    it('returns single page results when next is null', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        json: async () => ({
          count: 2,
          next: null,
          previous: null,
          results: [{ id: 1 }, { id: 2 }],
        }),
      } as Response);

      const results = await fetchAllPages('/test/');
      expect(results).toEqual([{ id: 1 }, { id: 2 }]);
      expect(api.get).toHaveBeenCalledTimes(1);
    });

    it('traverses all pages across next links and combines all results', async () => {
      vi.mocked(api.get)
        .mockResolvedValueOnce({
          json: async () => ({
            count: 25,
            next: 'http://127.0.0.1:8000/api/users/?page=2',
            results: Array.from({ length: 20 }, (_, i) => ({ id: i + 1 })),
          }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({
            count: 25,
            next: null,
            results: Array.from({ length: 5 }, (_, i) => ({ id: i + 21 })),
          }),
        } as Response);

      const results = await fetchAllPages('/users/');
      expect(results).toHaveLength(25);
      expect(results[0]).toEqual({ id: 1 });
      expect(results[24]).toEqual({ id: 25 });
      expect(api.get).toHaveBeenCalledTimes(2);
      expect(api.get).toHaveBeenNthCalledWith(1, '/users/');
      expect(api.get).toHaveBeenNthCalledWith(2, '/users/?page=2');
    });
  });
});
