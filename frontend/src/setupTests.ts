import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn((query: string) => ({
  matches: false, media: query, onchange: null,
  addListener: vi.fn(), removeListener: vi.fn(),
  addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
})) });
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock });
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { writable: true, value: vi.fn() });
