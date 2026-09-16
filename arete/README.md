# Aretē — site navigation embed

`nav.html` is the navigation bar that runs inside an HTML embed (iframe) on the
Aretē Wix site. It renders the bar, the sub-bar drop-downs and the mobile
drawer, and talks to the Wix page around it over `postMessage`.

## Why "My Profile" was landing on /apply

The account menu linked to a hard-coded `/my-profile`. No such route exists in
a Wix Members Area — a member's profile lives at a **per-member, slug-based**
URL — so the link 404'd and the site's fallback dropped people on `/apply`.
The `slug` was already being bridged in from the parent page, but
`accountModel(slug)` took it as an argument and never used it.

"My Profile" is now resolved at click time:

1. `profileUrl`, if the parent sent an explicit one; otherwise
2. `/profile/<slug>/profile`, built from the bridged member slug; otherwise
3. `aretenav:profile` is posted to the parent so the Wix page can look the
   current member up and route there itself. Standalone (not in an iframe), it
   falls back to `/account/my-account`, which exists for every member.

## The bridge

Messages the embed **sends** to the parent page:

| Message | Meaning |
| --- | --- |
| `{type:"aretenav:ready"}` | Embed has rendered — send it the member state. |
| `{type:"aretenav:height", px}` | Desired iframe height. |
| `{type:"aretenav:nav", href}` | Navigate the top window to `href`. |
| `{type:"aretenav:profile"}` | Open the current member's profile (slug unknown to the embed). |
| `{type:"aretenav:login"}` / `{type:"aretenav:logout"}` | Open the login prompt / log out. |

The one message the parent **sends back**:

```js
{ type: "aretenav:member",
  loggedIn: true,
  name: "Carly",          // greeting only
  slug: "carly-dunne",    // member.profile.slug — this is what builds the profile link
  profileUrl: ""          // optional; overrides the slug-built URL when set
}
```

## Wix page code

`masterPage.js` in this folder is the site's Velo master page code, merged and
ready to paste over the existing one (Dev Mode → Page Code → masterPage.js).
It keeps the overlay diagnostics, the login/logout wiring and the
`ensureProfile()` safety net as they were. Three things changed:

- **`profilePath(slug)`** — one constant at the top that owns where a member
  profile lives. Velo knows the site's routing; the embed should not have to
  guess it.
- **`profileUrl` in the member payload** — the embed already received `slug`,
  it just never used it. Now it is handed a finished URL as well.
- **An `aretenav:profile` branch** — the safety net for a member the embed was
  handed no slug for; it re-reads the member and routes, falling back to
  `/account/my-account`.

Also: `onLogin` now runs `ensureProfile()` **before** `pushMember()`. Those two
fired in parallel before, so a brand-new member could get a nav built from a
profile that did not exist yet — exactly the case that lands on `/apply`.

## Check the profile route — do this first

`profilePath()` defaults to the Wix Members Area shape,
`/profile/<slug>/profile`. But this site also has a `backend/profiles.web`
`ensureProfile()`, which suggests member profiles may be rows in a CMS
collection behind a **dynamic page** instead — in which case the real route is
something else entirely (`/the-collective/<slug>`, `/profile/<slug>`, …).

Open one member's profile on the live site and read the URL bar. Then set
`profilePath()` in `masterPage.js` to match. That single line is the only place
the route is written down; `nav.html` takes the finished URL from the bridge.

(`PROFILE_ROUTE` in `nav.html` is only a fallback for when the parent sends a
bare `slug` and no `profileUrl` — keep the two in step if you change one.)

## Still to point somewhere real

`The Members` links to `/the-collective` and `Events` to `/event-list`. If
either route does not exist yet it will bounce the same way `/my-profile` did.
