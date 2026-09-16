# Aretē — site navigation embed

`nav.html` is the navigation bar that runs inside an HTML embed (iframe) on the
Aretē Wix site. It renders the bar, the sub-bar drop-downs and the mobile
drawer, and talks to the Wix page around it over `postMessage`.

## Why "My Profile" was landing on /apply

The account menu linked to a hard-coded `/my-profile`, which is not a route on
this site at all. The link 404'd and the site's fallback dropped members on
`/apply`.

It now points at **`/members-area`**, which Wix resolves against whoever is
logged in. That is a fixed path, so no per-member slug is involved.

(Public, per-member profiles live at `/profile/<slug>` — e.g.
`/profile/carlydunne` — but nothing in the nav links to them. If "My Profile"
should one day open the member's own *public* profile instead of their members
area, that is one line: `MEMBERS_AREA` in `nav.html` becomes a slug-built URL,
and the slug is already being bridged across.)

## The bridge

Messages the embed **sends** to the parent page:

| Message | Meaning |
| --- | --- |
| `{type:"aretenav:ready"}` | Embed has rendered — send it the member state. |
| `{type:"aretenav:height", px}` | Desired iframe height. |
| `{type:"aretenav:nav", href}` | Navigate the top window to `href`. |
| `{type:"aretenav:login"}` / `{type:"aretenav:logout"}` | Open the login prompt / log out. |

The one message the parent **sends back**:

```js
{ type: "aretenav:member",
  loggedIn: true,
  name: "Carly",          // greeting only
  slug: "carlydunne"      // sent, but the nav no longer needs it for routing
}
```

## Wix page code

`masterPage.js` here is the site's Velo master page code with **one** change
from what was live — `onLogin` now runs `ensureProfile()` before `pushMember()`
instead of firing both in parallel:

```js
authentication.onLogin(() => {
  ensureProfile().catch(() => {}).then(() => pushMember());
});
```

Previously a brand-new member could have the nav built from a profile that did
not exist yet. Everything else — the overlay diagnostics, login/logout wiring,
the bridge — is untouched.

## Routes this nav depends on

| Menu item | Route |
| --- | --- |
| My Profile | `/members-area` |
| The Members | `/the-collective` |
| Events | `/event-list` |

All three are plain constants in `nav.html`. Any that does not exist will bounce
to `/apply`, which is exactly how the original bug showed up.
