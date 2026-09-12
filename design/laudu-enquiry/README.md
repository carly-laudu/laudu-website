# LAUDU enquiry flow

Design canvas for replacing the `mailto:` link in the `#contact` section
(`index.html`, `.l-cta`) with a three-step enquiry form.

- `Main.dc.html` — desktop artboard (1440×1240), clickable
- `Mobile.dc.html` — mobile artboard (390×844), clickable
- `canvas.json` — canvas layout, plus the design notes shown as sticky notes

- `build.mjs` — inlines the brand fonts and stages the canvas under `build/`

Type, colour, spacing and radii are lifted from `assets/colors_and_type.css`
and the existing `.l-cta` rules.

The canvas preview iframe has no network access, so the brand fonts have to be
inlined as base64. That happens at build time rather than in the sources, which
keeps ~730KB of duplicated font data out of git:

```sh
node build.mjs     # writes build/{Main,Mobile}.dc.html + build/canvas.json
```

Then seed the canvas from `build/` (see the header of `build.mjs` for the
exact command) and publish the resulting `laudu-enquiry-flow.html`.

Published at https://claude.ai/code/artifact/0684ca99-c9ab-492c-b4f8-30eb494879f5
