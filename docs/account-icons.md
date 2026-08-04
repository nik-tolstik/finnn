# Account Icons

Account icons are registered in `packages/web/src/shared/utils/account-icons.tsx` and rendered through the shared `AccountIcon` component. The registry is the single integration point for account icon selection and display.

## Icon contract

Each registry entry has two fields:

```ts
{
  Icon: Wallet,
  colorMode: "adaptive",
}
```

Use `colorMode: "adaptive"` when the SVG uses `currentColor`. Lucide icons, initials, and custom monochrome icons should use this mode. Callers pass the persisted account color through `accountColor`; `AccountIcon` then exposes light and dark colors through CSS variables without subscribing to the theme in React.

Use `colorMode: "brand"` when the SVG contains fixed brand colors. `AccountIcon` preserves those fills and renders the SVG at the caller's requested size without adding a theme-colored backdrop. Brand icons must not depend on `accountColor` for their internal fills.

## Brand sources

Prefer `svgl.app` as the source for company and product logos. Copy only the specific SVGs needed into local assets or small React components; do not add an icon-pack dependency or fetch SVGL assets at runtime for a small set of marks. When a brand publishes stricter sign-in or button guidance, use its official approved mark instead.

## Adaptive color behavior

`packages/web/src/shared/utils/account-icon-colors.ts` derives two colors from the persisted account color:

- The light-theme color is corrected toward black when needed.
- The dark-theme color is corrected toward white when needed.
- The correction preserves the original hue as much as possible and targets a minimum 4.5:1 contrast ratio against the reference theme surface.

The component writes `--account-icon-color-light` and `--account-icon-color-dark` to the SVG. CSS selects the appropriate variable through `.account-icon-adaptive` and `html.dark`, so switching themes updates the icon without a component-specific theme hook or a data migration.

## Adding a new icon

1. Add the SVG or Lucide component to `account-icons.tsx`.
2. Add one entry to `ACCOUNT_ICON_DEFINITIONS`.
3. Choose `adaptive` for `currentColor` icons or `brand` for fixed-color marks.
4. For an adaptive custom SVG, use `fill="currentColor"` or `stroke="currentColor"`.
5. Render it through `AccountIcon` and pass `accountColor`; do not set `style.color` at individual call sites.

The create and edit account dialogs enumerate `ACCOUNT_ICON_DEFINITIONS`, so no additional picker change is needed. Keep the component-only `ACCOUNT_ICONS` export available for code that only needs to enumerate raw components.

## Verification

The color and registry contracts are covered by:

- `packages/web/src/shared/utils/account-icon-colors.test.ts`
- `packages/web/src/shared/utils/account-icons.test.ts`

Run the web checks after changing icon behavior:

```bash
pnpm --filter web check
pnpm --filter web typecheck
pnpm --filter web test
```
