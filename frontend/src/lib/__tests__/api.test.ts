import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiError, formatApiError, getApiUrl } from '../api';

const MOCK_API_URL = 'http://localhost:8000/api';

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

describe('API Utility', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
        globalThis.fetch = vi.fn();
        localStorage.clear();
        document.cookie = '';
    });

    it('getApiUrl formats URLs correctly', () => {
        // Checking formatting - it removes leading slash or keeps as is
        expect(getApiUrl('/users')).toContain('users');
        expect(getApiUrl('users')).toContain('users');
    });

    it('apiRequest attaches CSRF token from cookies', async () => {
        document.cookie = 'csrftoken=test-csrf-token';
        
        const mockResponse = { ok: true, json: () => Promise.resolve({ success: true }) };
        vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as Response);

        await api.get('/test-endpoint');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'X-CSRFToken': 'test-csrf-token'
                })
            })
        );
    });

    it('apiRequest attaches Organization ID from localStorage', async () => {
        localStorage.setItem('activeOrganizationId', '111');
        
        const mockResponse = { ok: true, json: () => Promise.resolve({ success: true }) };
        vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as Response);

        await api.get('/test-endpoint'); // not auth/login so it should attach

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'X-Organization-Id': '111'
                })
            })
        );
    });

    it('sends multipart data unchanged while preserving authentication and CSRF headers', async () => {
        localStorage.setItem('authToken', 'test-token');
        localStorage.setItem('activeOrganizationId', '111');
        document.cookie = 'csrftoken=test-csrf-token';
        vi.mocked(globalThis.fetch).mockResolvedValue({ ok: true } as Response);
        const payload = new FormData();
        payload.append('display_picture', new File(['image'], 'avatar.png', { type: 'image/png' }));
        await api.patch('/auth/me/', payload);
        const options = vi.mocked(globalThis.fetch).mock.calls[0][1];
        expect(options.body).toBe(payload);
        const headers = new Headers(options.headers);
        expect(headers.has('Content-Type')).toBe(false);
        expect(headers.get('Authorization')).toBe('Token test-token');
        expect(headers.get('X-CSRFToken')).toBe('test-csrf-token');
        expect(headers.get('X-Organization-Id')).toBe('111');
    });
});
