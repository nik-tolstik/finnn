# Web Design System

The Finnn web color system is defined in `packages/web/src/app/globals.css` and has three layers. Keep the layers separate so a theme can change without forcing component-specific overrides.

## Typography and Text Case

Use sentence case for interface text and content. Do not write text in all caps or apply `uppercase`/`text-transform: uppercase` unless the product or design explicitly requires it. This applies to headings, buttons, labels, tabs, table headers, statuses, and menu items. Preserve uppercase only where it is part of a proper name, acronym, or other intentional content.

## Token Layers

### Palette

Palette tokens are raw color values such as `--palette-neutral-100` and `--palette-blue-600`. They have no UI meaning and must not be referenced directly from React components.

The light palette uses achromatic neutral surfaces with near-black text. Hover and passive selected surfaces stay neutral; blue is reserved for primary actions, focus, and explicit active indicators. The dark palette keeps the existing neutral OKLCH surfaces so dialogs preserve their established appearance.

### Semantic Tokens

Semantic tokens describe a product role rather than a component:

- `--surface-canvas`, `--surface-raised`, `--surface-subtle`, `--surface-hover`, and `--surface-selected`
- `--text-primary` and `--text-secondary`
- `--border-default` for the small number of structural separators that still need it
- `--focus-ring` for keyboard focus

The existing Tailwind-facing tokens such as `--background`, `--card`, `--muted`, and `--border` are compatibility aliases over this semantic layer. Do not assign new raw colors to those aliases.

### Component Tokens

Component tokens are the public visual contracts for shared primitives:

- Dialogs: `--dialog-background`
- Popovers and tooltips: `--popover-background`
- Form controls: `--control-background`, `--control-background-hover`, `--control-focus`, `--control-placeholder`
- Segmented controls: `--segmented-background`, `--segmented-indicator`, `--segmented-hover`
- Selectable options: `--option-hover`, `--option-selected`

These variables are exposed through Tailwind utilities such as `bg-control`, `bg-control-hover`, `bg-dialog`, and `bg-segmented-indicator`.

## Form Control Contract

All text, number, textarea, select, combobox, date, and time controls use the same borderless field colors and focus treatment. Select-like triggers use the `field` button variant; `secondary` remains reserved for secondary actions such as Cancel.

Income and expense segmented controls use text-only labels. When the same control also includes transfer, keep every option text-only so label alignment remains consistent.

When adding a new app-facing form control:

1. Build on a primitive from `packages/web/src/shared/ui`.
2. Use the control component tokens instead of `bg-background`, `bg-muted`, `bg-secondary`, or a raw color.
3. Use `control-background-hover` for hover and `control-focus` for keyboard focus.
4. Use `option-hover` and `option-selected` for listbox, combobox, or menu rows.
5. Do not add a light-only or dark-only override when the component token already has theme-specific values.

The light theme distinguishes fields from white dialogs with a near-white neutral fill and soft shadow. Hover surfaces should remain subtle rather than becoming a high-contrast gray block. The dark theme maps the same component roles to the previous stepped neutral surfaces.

## Border Policy

Do not use `border` as a default styling or hierarchy mechanism. Interactive components are borderless; their hierarchy comes from surface color, elevation, selected fills, and focus rings. Do not add borders to fields, buttons, segmented controls, dialogs, sheets, popovers, tooltips, checkboxes, or selector cards unless the design explicitly requires one.

Borders are reserved for rare structural separators where spacing or a surface change cannot communicate the grouping clearly, such as dense table rules or a dialog footer divider. Prefer spacing and surface contrast first.

State outlines are the other exception. When a component such as an analytics calendar cell needs an active outline, keep a transparent border of the same width in its resting state and only color it on focus, today, or selected states. This preserves layout while keeping the default UI borderless.

## Overlay Contract

Dialogs and sheets use the dialog surface and shadow. Popovers and tooltips use the popover surface and shadow. Nested content should normally be transparent so the parent overlay owns the background; use a semantic or component surface only when a nested region needs deliberate elevation.

## Verification

Use the shared UI gallery and transaction modal stories for visual review:

- `packages/web/src/shared/ui/shared-ui.stories.tsx`
- `packages/web/src/modules/transactions/components/create-transaction-dialog/CreateModals.stories.tsx`

Run the standard frontend checks after token or primitive changes:

```bash
pnpm --filter web check
pnpm --filter web typecheck
pnpm --filter web test
```
