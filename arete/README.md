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

## Where the slug comes from

The `/profile/<slug>` dynamic page is keyed on a slug held in the **CMS**, not
on Wix's `member.profile.slug`. Those are two different values for the same
person, and using the wrong one lands on the empty default profile template —
which looks like a broken page rather than a broken link.

So the slug is read from the collection:

1. `profiles.web.additions.js` adds `getMyProfileSlug()` to
   `backend/profiles.web.js`, next to the existing `ensureProfile()`. Three
   constants at the top must be set to the real collection and field names.
2. `masterPage.js` calls it, builds `/profile/<slug>`, and sends the finished
   URL to the embed as `profileUrl`.

**Order matters.** Add the backend function *before* pasting `masterPage.js` —
it imports `getMyProfileSlug`, and a Velo import of an export that does not
exist yet breaks the whole master page, nav and login included.

## Wix page code

`masterPage.js` here is the site's Velo master page code with the profile
routing merged in. The overlay diagnostics, login/logout wiring and the bridge
are untouched. What changed:

- the slug now comes from `getMyProfileSlug()` rather than
  `member.profile.slug`;
- the `|| member._id` fallback is gone — a member ID is a UUID, never a valid
  `/profile/` segment, so it rendered the default template;
- `onLogin` runs `ensureProfile()` before `pushMember()` instead of racing it,
  so a first-time member is not handed a nav built from a profile row that does
  not exist yet.

## The profile route

Confirmed against the live site: member profiles are at **`/profile/<slug>`**,
e.g. `https://www.areteprivateclient.com/profile/carlydunne`. Note there is no
trailing `/profile` segment — this is not the stock Wix Members Area shape.

It is written down in two places, which must stay in step:

- `masterPage.js` → `profilePath(slug)` — the one that normally runs, since
  Velo resolves the URL and sends it to the embed as `profileUrl`.
- `nav.html` → `PROFILE_ROUTE` — the fallback used only if the parent sends a
  bare `slug` and no `profileUrl`.

If the route ever changes, change both.

## Still to point somewhere real

`The Members` links to `/the-collective` and `Events` to `/event-list`. If
either route does not exist yet it will bounce the same way `/my-profile` did.
