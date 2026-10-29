import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityPolicy } from '../../../config/security';

describe('production frontend CSP', () => {
  it('blocks inline JavaScript, eval, embedded objects and base URL injection', () => {
    const policy = contentSecurityPolicy();
    const scripts = policy.split('; ').find(directive => directive.startsWith('script-src '));
    expect(scripts).toBe("script-src 'self' 'wasm-unsafe-eval'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'none'");
    expect(policy).toContain("connect-src 'self'");
  });

  it('allows only the configured API origin for remote connections', () => {
    expect(contentSecurityPolicy('https://api.example.com/api')).toContain("connect-src 'self' https://api.example.com;");
    expect(() => contentSecurityPolicy('javascript:alert(1)')).toThrow();
  });

  it('places the policy before resources in every built HTML entry', () => {
    const plugin = securityPolicy();
    expect(plugin.apply).toBe('build');
    const hook = plugin.transformIndexHtml as { handler: () => object[] };
    expect(hook.handler()).toEqual([expect.objectContaining({
      tag: 'meta', injectTo: 'head-prepend',
      attrs: expect.objectContaining({ 'http-equiv': 'Content-Security-Policy' }),
    })]);
  });
});
