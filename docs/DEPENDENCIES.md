# Dependency audit

Audit date: October 28, 2026. Related issue: [#193](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/193).

## Cleanup

The source import graph was traced from `src/main.tsx`, test files, and the test
setup, with Vite, Vitest, Tailwind, PostCSS, and ESLint configuration checked
separately. Component names and import paths were also searched across the source
tree before deletion. This extends the earlier July audit; its toast consolidation
and unused-library removals were already present.

| Removed package | Evidence |
| --- | --- |
| `lovable-tagger` | Only used by the Vite development component tagger; the integration was removed. |
| `@radix-ui/react-checkbox` | Only imported by the unused checkbox wrapper. |
| `@radix-ui/react-collapsible` | Only imported by the unused collapsible wrapper. |
| `@radix-ui/react-popover` | Only imported by the unused popover wrapper. |
| `@radix-ui/react-scroll-area` | Only imported by the unused scroll-area wrapper. |
| `react-day-picker` | Only imported by the unused calendar wrapper. |
| `date-fns` | No source or configuration references. |
| `@tailwindcss/typography` | Not configured as a plugin; no typography/prose usage. |
| `@testing-library/user-event` | No imports in the existing tests or test setup. |

Removed unused UI wrappers: breadcrumb, calendar, chart, checkbox, collapsible,
pagination, popover, scroll-area, sheet, and sidebar. The sheet wrapper and mobile
hook were only referenced by the unused sidebar. The unused NavLink compatibility
wrapper was also removed. The active layouts have their own navigation and mobile
menu implementations.

The commented Lovable social metadata was removed. The obsolete `bun.lockb` was
removed so npm's lockfile is the single maintained dependency graph.
`tailwindcss-animate` moved to development dependencies because Tailwind consumes
it during CSS generation.

Direct dependencies decrease from 61 to 52: 31 runtime and 21 development
dependencies after the build plugin move. The npm lockfile decreases from 616 to
498 package entries (excluding the root), with no added packages or version
changes to retained packages. Required peers, including Recharts' `react-is`,
remain locked. Package count reductions primarily
affect installation and maintenance; no production bundle size improvement is
claimed without a successful comparable build.

## Retained packages

- Radix/shadcn primitives, Tailwind, Lucide, and the class utilities support active
  UI components. The application uses Sonner as its single toast system.
- Recharts is imported directly by the analytics page even though its unused
  shadcn wrapper was removed.
- dnd-kit supports the form builder; dotLottie supports the authentication layout.
- `next-themes` supports the theme provider, toggle, and Sonner styling.
- React Hook Form, Zod, `@hookform/resolvers`, and `ui/form.tsx` are retained because
  `AGENTS.md` requires this form stack for validation and form state. The current
  pages do not yet use it; removing it should accompany an explicit convention
  change or a separate form migration.
- React Testing Library's DOM package is a required peer of its React package;
  jsdom, jest-dom, and Vitest support the existing tests.
- Backend requirements have not changed; this cleanup targets frontend UI code.

## Compatibility issues found at the pruning baseline

These issues were observed with the original dependency versions before pruning:

- A normal `npm ci` fails on `next-themes@0.3.0`, whose React peer range excludes
  the project's React 19. npm also reports that TypeScript 7 is outside
  `typescript-eslint@8.70.0`'s supported range. For this audit only, the initial
  install used `--legacy-peer-deps`; the final lockfile and clean install used
  `--force` to retain required peer packages. These flags do not fix those
  incompatibilities. No permanent npm override configuration was added.
- `npm run build` fails because the PostCSS configuration uses `tailwindcss`
  directly as a plugin, while the installed Tailwind 4 requires its separate
  PostCSS integration. Resolving this requires a deliberate Tailwind configuration
  migration or compatible dependency versions.

The next stack layer repairs these incompatibilities: TypeScript is constrained
to `~6.0.3`, `next-themes` moves to `^0.4.6` with React 19 support, and Tailwind 4
uses `@tailwindcss/postcss`, an explicit legacy theme config import, and its new
CSS entry point. Autoprefixer is removed because Tailwind 4 handles prefixing.
Normal npm installation no longer needs peer overrides.

Once the linter can start, its source diagnostics are repaired without disabling
rules: typed API data/errors, stable skeleton component definitions, guarded
form-state synchronization, derived analytics defaults, and stable render-time
clock snapshots. The UI library migration remains a separate stack layer.

## Pruning baseline verification results

| Check | Observed result |
| --- | --- |
| `python manage.py test` from the activated backend virtual environment | Pass: 19 tests. Test-only environment values supplied; SQLite selected by the existing settings. Available Python was 3.12.4, rather than the documented 3.13+. |
| `npm ci --force --ignore-scripts --no-audit --no-fund` | Pass: final clean install, 443 packages on Windows. Existing peer conflicts require the override; lifecycle scripts were skipped. |
| `npm run test -- --run` | Pass: 2 test files, 6 tests after the final clean install. |
| Source import resolution check | Pass: 73 TypeScript source/declaration files checked; no unresolved relative or `@/` imports. |
| Removed-package reference scan | Pass: no references remain in source, configuration, manifest, or npm lockfile. |
| Lockfile comparison against the original checkout | Pass: 118 fewer package entries; zero additions or retained-package version changes. |
| `npm run build` | Fails with the same Tailwind/PostCSS integration error seen before dependency pruning. |
| `npm run lint` | Fails at startup: `typescript-eslint does not support TS 7.0`. Both dependency versions are unchanged. |

No production bundle comparison or visual regression pass is available because
the existing CSS build failure prevents rendering the built application.

## Tooling repair verification

The second stack layer passes a normal `npm ci --no-audit --no-fund` without
peer overrides (451 packages installed). Backend tests pass (19 tests), frontend
tests pass (11 tests in 3 files), and `npx tsc -p tsconfig.app.json --noEmit`
passes. Added regressions cover profile form initialization/edit preservation and
typed API error formatting. One sandboxed Vitest run lost temporary transform
files; the subsequent run outside that sandbox passed all tests.

`npm run lint` exits successfully with zero errors and five existing Fast Refresh
warnings. `npm run build` succeeds; Vite still reports the large initial chunk
(1,919.71 kB JavaScript, 428.48 kB gzip). The production build is now available
for the Mantine layer's interaction and visual checks.

## UI library candidate

Mantine is the strongest candidate for a future consolidated UI stack in this
application. Its [core package](https://mantine.dev/getting-started/) supplies
inputs, buttons, and overlays, with optional packages for dates and notifications.
Its [theme provider](https://mantine.dev/theming/color-schemes/) manages light,
dark, and system color schemes. Those capabilities could replace the current
Radix wrappers and theme integration under one component system.

This is a maintenance recommendation, not a measured performance claim.
[Mantine Charts](https://mantine.dev/charts/getting-started/) still requires
Recharts, and a migration would involve component, styling, and interaction
changes. Keep the current pruned stack until that work is justified. Evaluate a
small representative screen with a dialog, select, table, theme toggle, and form
validation before deciding. Retain React Hook Form/Zod unless the repository's
form convention is explicitly changed.
