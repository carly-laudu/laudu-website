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

## The profile page is driven by code, not its dataset

The `Profiles (Item)` page showed the same member — "Eleanor Vane" — for every
URL. She is not a real member: the section's name, subtitle, Overview
paragraph, firm, member-since and focus tags were hand-typed design content,
connected to nothing. Confirmed in the editor, where the item switcher read
"Alasdair-Davidson 2/183" while the canvas rendered Eleanor Vane.

So no amount of dataset work would have helped — the elements were never bound.
The page is populated in code instead:

- `profiles.web.additions.js` adds `getProfileBySlug()` to
  `backend/profiles.web.js`.
- `profiles-item.page.js` is the page code: it reads the slug from the address
  bar and fills the elements in.

### The slugs do not match their own URLs

The stored slug and the URL Wix builds from it disagree — `Laura-Ucrós` in the
CMS becomes `-laura-ucrós` in the address bar (lowercased, accent kept, leading
hyphen added). `slugKey()` reduces both sides to `lauraucros` by stripping
accents, case and every separator, so the row is found either way.

This is deliberate: it avoids rewriting slug data, which would change every
profile URL and break the ~184 existing links.

## Where the profile URL comes from

Two different pages are involved, and they are easy to confuse:

| Page | What it is |
| --- | --- |
| `/my-profile` | The **edit** form — the member fills in their own details. |
| `/profile/<slug>` | The **public** profile, a dynamic page off the CMS collection. |

"My Profile" in the nav points at the public one.

Its slug lives in the CMS, not in Wix's `member.profile.slug` — two different
values for the same person, and the Wix one lands on the empty default profile
template, which reads as a broken page rather than a broken link.

`masterPage.js` therefore resolves the URL from the member's own CMS row via
the existing `getMyProfile()`, preferring the `link-*` field Wix generates for
a dynamic item page (its value is the finished relative URL, so it stays correct
even if the page's URL pattern changes) and falling back to building
`/profile/<slug>` from a slug field. The result is memoised per page load and
cleared on login and logout.

No new backend method is needed — `getMyProfile()` already returns the row.

`ensureProfile()` builds the slug as `full-name-<first 6 of member._id>`, e.g.
`alberto-brazzalotto-b44f3f`, and nothing rewrites it afterwards — so it is
stable even when a member edits their name.

If no URL can be resolved (no row yet), the member is sent to `/my-profile`,
the edit page, where they can fill their details in.

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
