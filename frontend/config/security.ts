import type { Plugin } from 'vite';

export function contentSecurityPolicy(apiBaseUrl = '/api'): string {
  // Parse an origin rather than copying build-time text into a CSP directive.
  const apiUrl = new URL(apiBaseUrl, 'https://frontend.invalid');
  if (!['http:', 'https:'].includes(apiUrl.protocol)) throw new Error('API URL must use HTTP(S)');
  const connect = apiBaseUrl.startsWith('/') ? "'self'" : `'self' ${apiUrl.origin}`;
  return [
    "default-src 'self'",
    // The locally bundled Lottie player needs WebAssembly, never JavaScript eval.
    "script-src 'self' 'wasm-unsafe-eval'",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' https: data: blob:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
}

export function securityPolicy(apiBaseUrl?: string): Plugin {
  return {
    name: 'ipes-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [{
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(apiBaseUrl) },
        injectTo: 'head-prepend',
      }],
    },
  };
}
