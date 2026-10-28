# Mantine migration

## 1. Goal / Executive Summary

Replace the remaining Radix/shadcn UI implementation, next-themes, and Sonner
with Mantine 9.7.4 core, hooks, and notifications. This is the third PR in the
requested stack, following dependency pruning and frontend validation repairs.
Keep application routes, API hooks, organization scoping, and the evaluation
workflow intact. Retain Tailwind for page layout and React Hook Form/Zod for the
repository's form convention. Recharts and dnd-kit keep their existing domain
responsibilities.

## 2. User Review Required (Or Critical Items)

> [!IMPORTANT]
> The user's migration request authorizes the component and theme changes.
> Shared UI modules retain their application-facing APIs while Mantine owns
> focus trapping, keyboard navigation, selection, and overlay behavior.

> [!WARNING]
> Component visuals and interactive DOM structure change. Verify dialog naming,
> focus return, nested selects, destructive-action cancellation, disabled states,
> theme persistence, and notifications before publishing this layer.

## 3. Open Questions

None blocking. Keep existing navy/amber branding, page layout utilities, routing,
and API contracts. Full authenticated scenarios need a local backend fixture;
use component regressions and mocked API browser checks for deterministic UI QA.

## 4. Proposed Changes

#### [MODIFY] [Application providers](../../../../frontend/src/App.tsx)

Mount the Mantine theme and notifications once, replacing the old tooltip/toast
provider tree. Preserve query, organization, and router providers.

#### [MODIFY] [Theme provider](../../../../frontend/src/components/theme-provider.tsx)

Define branded Mantine colors, typography, and color-scheme persistence. Bridge
the computed scheme to the page layout's existing `.dark` CSS selector.

#### [MODIFY] [Theme toggle](../../../../frontend/src/components/theme-toggle.tsx)

Use Mantine's computed color scheme and an accessible icon button.

#### [MODIFY] [Shared UI modules](../../../../frontend/src/components/ui)

Replace buttons, inputs, textareas, cards, badges, avatars, tabs, tables,
progress, radios, switches, dividers, skeletons, alerts, menus, selects, and
dialogs with Mantine implementations. Remove unused legacy exports and packages.
Keep destructive confirmations explicit and cancel-first. Keep the form helper
compatible with React Hook Form without Radix's Slot or Label.

#### [NEW] [Notification adapter](../../../../frontend/src/lib/notifications.ts)

Route the application's existing notification calls to Mantine Notifications,
preserving titles, descriptions, and success/error semantics.

#### [MODIFY] [Global styles](../../../../frontend/src/index.css)

Layer Mantine styles between page resets and Tailwind overrides. Preserve
application color variables and responsive layouts. Import library styles from
`main.tsx`, with `styles/layers.css` declaring their cascade order before the
Tailwind entry. Raise dark-mode primary contrast for page text and icons.

#### [MODIFY] [Organization context](../../../../frontend/src/contexts/OrganizationContext.tsx)

Keep the cleanup callback stable so selecting an organization does not rerun
the selector effect and erase the selection before dashboard navigation.
Browser QA reproduced this loop; add a route-guard regression.

#### [MODIFY] [Package manifest](../../../../frontend/package.json)

Add exact Mantine 9.7.4 packages, remove replaced UI packages, regenerate npm's
lockfile, and verify a clean install without peer overrides.

#### [MODIFY] [Agent conventions](../../../../AGENTS.md)

Update the shared-component convention to Mantine, reflecting the authorized
migration while retaining API, organization, and form requirements.

#### [NEW] [UI interaction tests](../../../../frontend/src/components/__tests__/mantine-ui.test.tsx)

Cover meaningful interactions through the shared API and Mantine provider,
including selection, dialogs, menus, themes, and disabled controls. Update the
profile regression to run inside the application theme provider. Use Mantine
radio cards for evaluation scores so checked state and keyboard behavior remain
visible and accessible after removing Radix-specific peer styling.

## 5. Verification Plan

### Automated Tests

- Activated backend virtual environment: `python manage.py test` (SQLite).
- Frontend: `npm run test -- --run`, `npm run lint`,
  `npx tsc -p tsconfig.app.json --noEmit`, and `npm run build`.
- Clean install: `npm ci --no-audit --no-fund`, without dependency overrides.
- Scan source/configuration and lockfile for removed UI packages.

### Manual Verification

- Launch Vite locally; inspect login and member/admin pages with representative
  mocked API data in a browser.
- Check light/dark theme, narrow/wide layouts, modal focus and cancellation,
  select/menu keyboard interaction, and notification presentation.
- Record actual CI status for all three PR revisions and link the stack in
  dependency order. Do not merge.

### Recorded outcome

Both suites, clean installation, lint, app type checking, and build passed.
See [the dependency audit](../../../../docs/DEPENDENCIES.md)
for exact counts, measured bundle sizes, remaining warnings, and browser scenarios.
Wide-screen fixture checks passed; narrow-screen browser testing and a live
backend end-to-end run were not performed.
