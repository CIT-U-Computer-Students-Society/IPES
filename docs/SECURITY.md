# Browser and database security

## Session authentication

The API accepts Django sessions only. Login and registration return a user profile,
never a bearer token. `ipes_sessionid` is a host-only HttpOnly cookie; it is Secure
when `DEBUG=False`. The new cookie names deliberately require users of previous
releases to sign in again. Old `Authorization: Token ...` headers are ignored and
the frontend discards legacy `authToken` values. Existing authtoken database tables
can remain unused; no destructive database migration is required.

Every mutation, including anonymous login, registration and logout, requires CSRF
validation. Before a mutation the API client requests `/api/auth/csrf/` with
credentials and no caching, then supplies the returned masked token in
`X-CSRFToken`. The CSRF cookie is also HttpOnly and host-only. A fresh bootstrap
avoids stale tokens after login or a different browser tab rotates the cookie;
concurrent bootstraps share one request. Failed mutations are never automatically
replayed. Logout must succeed on the server before the UI clears its session state.

For local development, use `VITE_API_BASE_URL=/api` and Vite's backend proxy.
Both cookies default to `SameSite=Lax` in development. In production:

- Use HTTPS, `DEBUG=False`, and explicit `ALLOWED_HOSTS`.
- Prefer a same-origin reverse proxy or frontend/API subdomains on the same site.
  Set `COOKIE_SAMESITE=Lax` when both are on the same site.
- For a separately hosted frontend, set `VITE_API_BASE_URL` to its HTTPS API URL
  **at build time**, and put the exact frontend origin in both
  `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` on the backend.
- Production retains the prior `SameSite=None` default for cross-site deployments.
  Browsers that block third-party cookies may still block these sessions. Use a
  same-site deployment instead of restoring JavaScript-readable credentials.
- Cookie domain overrides are intentionally unsupported. No shared-domain cookie
  is needed: browsers attach API-host cookies to credentialed API requests.

Deploy frontend and backend together. Old clients depend on the retired token API.
Unauthenticated API access now returns DRF's session-authentication status, 403.
Changing cookie flags requires HTTPS browser verification on the actual deployment.

## Content Security Policy

Every built frontend HTML file contains an early CSP meta tag. Django also sends
an enforced CSP header for its HTML and API responses. This covers static frontend
hosting as well as Django hosting. `connect-src` in the build includes only the
frontend origin and the configured API origin. If Django serves the frontend but
it connects to another API origin, add that origin to `CSP_CONNECT_SRC` (a
space-separated list); both policies must allow the connection.

The policy blocks inline JavaScript, JavaScript eval, inline event attributes,
plugins and base-URL injection. The animation's WebAssembly is bundled locally;
`wasm-unsafe-eval` permits WebAssembly compilation without permitting JavaScript
eval. Inline **styles** remain allowed for Mantine, chart and layout behavior.
Google Fonts styles/fonts and HTTPS images are allowed, including signed avatar
URLs. HTTP image hosts outside the frontend origin are not allowed.

Meta policies cannot enforce `frame-ancestors`. Django's header sets it to `'none'`;
separate static hosting should also set `Content-Security-Policy: frame-ancestors
'none'` and `X-Content-Type-Options: nosniff` as response headers. If the host
already sends a CSP, combine its requirements carefully: policies are cumulative.
Vite development/HMR does not use the production meta policy.

## User content and database queries

Render untrusted content through React text expressions. Do not introduce HTML
insertion APIs; if rich text becomes necessary, use an audited sanitizer and review
the rendering context. Proof links accept only HTTP(S) in both API write serializers
and the shared frontend component, which adds `noopener noreferrer`.

Keep database access in Django's parameterized ORM. Do not interpolate input into
SQL, including raw queries or dynamic query expressions. Regression tests exercise
an SQL-shaped API filter, executable proof-link schemes and stored feedback markup.
Passing these checks is not a complete penetration test or a dependency audit.

## Verification

Run `python manage.py test` from `backend/` with its virtual environment activated,
and `npm run test -- --run` plus `npm run build` from `frontend/`. PR validation
runs both test suites. Session tests use real cookie authentication and enforce
CSRF checks; business tests that use forced authentication do not replace them.
