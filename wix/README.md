# Aretē navigation — Wix setup

Two pieces work together:

- **`../arete-nav.html`** — the self-contained nav UI. Paste it into a Wix
  **HtmlComponent** (Embed → Custom Element / HTML iframe) that appears on every
  page (put it in the header so it's site-wide). Give the component the ID
  `aretenav` (or change `NAV_ID` in `masterPage.js`).
- **`masterPage.js`** — site code that talks to the iframe (member state, login,
  logout, navigation, and growing the frame to a full-screen overlay for the
  mobile menu).

## Why the mobile menu was clipped

The drawer is `position:fixed` to the **iframe's** own viewport, and Velo has
**no API to resize an HtmlComponent from code**
(<https://forum.wixstudio.com/t/resizing-elements-with-velo/47288>). So the menu
rendered fine but was trapped inside the 76px-tall frame. The fix makes the
iframe a **full-height, click-through overlay** so the drawer always has room,
and only the nav UI captures clicks — empty area falls through to the page.

## Editor setup

### Wix Studio (recommended)
1. Place the HtmlComponent in the site header, ID `aretenav`, full width.
2. Default height = `76px` (the bar).
3. In **Site → Custom CSS**, add:
   ```css
   .aretenav--open{
     position:fixed !important;
     inset:0 !important;
     height:100dvh !important;
     z-index:9999 !important;
   }
   ```
   `masterPage.js` adds/removes `aretenav--open` as dropdowns / the drawer open.

### Classic Wix Editor
There's no resize API and no custom CSS classes. Instead:
1. **Pin** the HtmlComponent to the **top of the screen**, full width.
2. Set its height to the **full viewport** (as tall as the tallest phone you
   support). The iframe is transparent and click-through, so the oversized frame
   doesn't block the page.
3. The `aretenav:height` / `aretenav:drawer` branches in `masterPage.js` become
   no-ops (`customClassList` is absent) — the frame is already full-screen.

## Message contract (iframe ⇄ site)

| Direction | Message | Meaning |
|---|---|---|
| site → iframe | `aretenav:member` `{loggedIn,name,slug}` | who's logged in |
| iframe → site | `aretenav:ready` | handshake on boot |
| iframe → site | `aretenav:login` / `aretenav:logout` | run Wix auth |
| iframe → site | `aretenav:nav` `{href}` | navigate the whole site |
| iframe → site | `aretenav:height` `{px}` | dropdown grew/collapsed |
| iframe → site | `aretenav:drawer` `{open}` | mobile menu opened/closed |
