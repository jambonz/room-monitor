# jambonz UI Kit — how to build with it

A small, light-weight React design system for jambonz frontends. Components are
plain React functions imported from `@jambonz/ui-kit` (the bundle exposes them on
`window.JambonzUiKit`). Style comes from one shipped stylesheet plus CSS custom
properties — there is **no theme provider and no context**: render any component
directly, no wrapper required. Just make sure `styles.css` is loaded.

## Styling idiom

This is a **CSS-class + CSS-variable** design system, not a styled-props one.

- **Component variants are props.** Don't hand-write the component classes (`.btn`,
  `.ico`, `.h1` …) — the components emit them. Drive appearance with props:
  - `mainStyle`: `"primary"` (filled jambonz magenta) | `"hollow"` (outlined). Default primary.
  - `subStyle`: `"dark"` | `"blue"` | `"teal"` | `"purple"` | `"white"` | `"grey"` — the color variant. Applies to `Button`, `Icon`, `IconGroup`.
  - `small`: boolean (compact `Button`).
  - `Button` is polymorphic: pass `as={Link}` (+ `to`) for a React-Router link, or `as={NextLink}` (+ `href`) for a Next link; otherwise it's a `<button>` and takes all native button attrs.
  - `ButtonGroup` takes `left` / `right` for alignment; `Icon`/`IconGroup` group icons (use a `react-feather` icon as the child).

- **Your own layout glue uses the utility classes** (these are safe to write directly):
  - Text color: `txt--jam` (brand magenta), `txt--blue`, `txt--teal`, `txt--purple`, `txt--dark`, `txt--grey`, `txt--green`, `txt--red`, `txt--white`.
  - Background: `bg--jam`, `bg--pink` (pale magenta), `bg--blue`, `bg--teal`, `bg--purple`, `bg--dark`, `bg--black`, `bg--grey`.
  - Spacing: `pad`, `pad-t`, `pad-b`. Container: `wrap`. Inline medium weight: `med`.

- **Tokens are CSS custom properties** — reference them in any custom CSS rather than
  hard-coding values. Brand + palette: `var(--jambonz)` `#da1c5c`, `var(--blue)` `#006dff`,
  `var(--teal)` `#30beb0`, `var(--purple)` `#9662b2`, `var(--green)` `#008a1a`,
  `var(--red)` `#e10e22`, `var(--dark)` `#231f20`, `var(--grey)`, `var(--white)`.
  Fonts: `var(--font-regular)` / `var(--font-medium)` / `var(--font-bold)` (the
  Objectivity family). Type sizes: `var(--h1-size)`…`var(--h6-size)`, `var(--p-size)`,
  `var(--m-size)`/`--ms-size`/`--mxs-size`.

## Typography components

Use these instead of raw tags so brand type applies: `H1`–`H6` (headings), `P`
(paragraph), `M` / `MS` / `MXS` (meta text: normal / small / xtra-small). They take
children + standard HTML attributes. Inside text, `<strong>` is bold, `<span className="med">`
is medium weight, and the `txt--*` classes color inline spans.

## Where the truth lives

Read the bound stylesheet (`styles.css` and its `@import` of `_ds_bundle.css`) for the
full class and token vocabulary, and each component's `<Name>.d.ts` / `<Name>.prompt.md`
for its exact props. The compiled CSS is authoritative.

## Example

```jsx
import { Button, ButtonGroup, H2, P } from "@jambonz/ui-kit";

function Panel() {
  return (
    <div className="wrap pad">
      <H2>Bring your ideas to life</H2>
      <P>Build voice and messaging apps on <span className="txt--jam med">jambonz</span>.</P>
      <ButtonGroup left>
        <Button mainStyle="primary">Get started</Button>
        <Button mainStyle="hollow" subStyle="teal">Learn more</Button>
      </ButtonGroup>
    </div>
  );
}
```

# JambonzUiKit (@jambonz/ui-kit@0.0.21)

This design system is the published @jambonz/ui-kit React library, bundled as a single
browser global. All 15 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.JambonzUiKit`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.JambonzUiKit.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { Button } = window.JambonzUiKit;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<Button />);
```

## Tokens

57 CSS custom properties from @jambonz/ui-kit. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **spacing** (8): `--letter-space-1`, `--letter-space-2`, `--letter-space-3`, …
- **typography** (9): `--font-regular`, `--font-regular-italic`, `--font-medium`, …
- **other** (40): `--black`, `--white`, `--dark`, …

## Components

### buttons
- `Button`
- `ButtonGroup`

### typography
- `H1`
- `H2`
- `H3`
- `H4`
- `H5`
- `H6`
- `M`
- `MS`
- `MXS`
- `P`

### icons
- `Icon`
- `IconGroup`

### jambonz-ui
- `Tabs`
