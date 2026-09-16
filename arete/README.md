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

## Open question: why the profile page renders empty

The public profile dynamic page is at **`profile/{slug}`** and stays there —
there are ~184 existing links to it.

Requesting a member's exact CMS slug returns Wix's default-looking profile
template rather than the member's details. Two candidate causes, and this has
not been narrowed down yet:

1. **The dataset filter.** `ensureProfile()` creates every row with
   `visibleInDirectory: false`, and `updateMyProfile()` only flips it true once
   photo, profession, region *and* bio are all filled in. If the dynamic page's
   dataset filters on that field, every incomplete profile renders with no item
   bound — which looks exactly like an unstyled template.
   **Test:** set one member's `visibleInDirectory` to `true` in the CMS and
   reload their URL. If it renders, this is the cause.
2. **Router precedence.** The Wix Members Area also serves URLs under
   `/profile/`. This was assumed to be the cause earlier; it is not confirmed,
   and moving the page was rejected because of the existing links.

Neither is a nav problem — the link itself resolves and navigates correctly.

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
