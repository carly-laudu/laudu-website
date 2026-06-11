# LAUDU Website

Static homepage for LAUDU — a creative studio building magnetic brands, experiences & communities.

## Structure

```
index.html              # the homepage (open this)
image-slot.js           # drag-and-drop image placeholder web component
assets/
  colors_and_type.css   # brand colors + type tokens
  laudu-logo-blackred.png
  laudu-logo-white.png
  bloom-1.png … bloom-3.png   # value-card imagery
  pumpit.mp3            # "Pump it" studio track
```

## Running locally

It's a static site — no build step. Serve the folder with any static server, e.g.:

```bash
npx serve .
# or
python3 -m http.server
```

Then open the printed URL. (Opening `index.html` directly via `file://` works too, though the audio and image-slot behave best over `http`.)

## Deploying

Drop the whole folder into any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages). `index.html` is the entry point.
