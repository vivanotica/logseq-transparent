# Logseq Transparent

A calm, translucent glass theme for **Logseq DB 2.0+**, inspired by the visual
direction of
[Oczko24/Obsidian-transparent](https://github.com/Oczko24/Obsidian-transparent)
and rebuilt around Logseq's native layout and DB interface.

The current release is **0.4.0**.

## Features

- Dark and light surfaces that follow Logseq's current appearance
- Accent states derived from Logseq's active selection color
- Translucent navigation, sidebars, dialogs, notifications, and DB views
- Styling for blocks, properties, tables, gallery cards, and query builders
- Responsive layouts, reduced-motion handling, and increased-contrast tokens
- Local assets only at runtime; no remote fonts, scripts, trackers, or images

## Install

1. Open Logseq and go to **Plugins**.
2. Open the plugin menu and choose **Load unpacked plugin**.
3. Select this repository folder.
4. Open **Settings → Themes**.
5. Choose **Logseq Transparent Light** or **Logseq Transparent Dark**.

The package registers its light and dark variants through `logseq.themes`.
Logseq loads `custom.css` only after the corresponding theme is selected; no
plugin runtime or automatic CSS injection is used.

## Customize

The `--lt-*` variables at the top of `custom.css` are the supported
customization surface. Override only the values you need in Logseq's
**Settings → Edit custom.css**:

```css
html:root {
  --lt-content-width: 920px;
  --lt-wallpaper:
    linear-gradient(rgba(9, 20, 17, 0.2), rgba(9, 20, 17, 0.2)),
    url("file:///Users/you/Pictures/wallpaper.jpg");
  --lt-wallpaper-blur: 8px;
}
```

By default, `--lt-accent` follows `--ls-active-primary-color`. Override it only
if you intentionally want the theme accent to differ from Logseq's selection
color.

See `custom-background.example.css` for a local-image example.

## Project structure

- `custom.css` — theme tokens and Logseq component styles
- `index.html` — inert package entry required by Logseq's package loader
- `scripts/validate.mjs` — dependency-free structural and regression checks
- `custom-background.example.css` — optional local customization example

## Validation

Run:

```sh
npm run check
```

The check validates the theme manifest and its light/dark registrations,
ensures that no CSS-injection runtime is present, and checks balanced CSS
blocks, the CSS/package version, notification wrapper isolation, and selectors
previously associated with UI regressions.

The selectors were compared with the installed Logseq DB application source.
Because visual behavior can change between Logseq builds and operating
systems, a final visual pass is still recommended after upgrading Logseq.

## Compatibility

The theme targets Logseq DB 2.0+ and retains compatibility selectors only when
the corresponding class exists in the installed Logseq application. Third-party
plugins can require their own additions because plugin markup is not
standardized.

## Credits

The translucent panes, quiet motion, and wallpaper treatment were benchmarked
against
[Obsidian Transparent](https://github.com/Oczko24/Obsidian-transparent).
No CSS from that project is bundled here.

Released under the MIT License.
