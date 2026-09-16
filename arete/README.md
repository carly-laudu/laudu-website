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

`slug` must be sent or the profile link cannot be built. In the site's
**masterPage.js** (so it runs on every page):

```js
import { currentMember, authentication } from 'wix-members-frontend';
import wixLocationFrontend from 'wix-location-frontend';

const nav = $w('#navEmbed'); // the HTML embed holding nav.html

async function sendMember() {
  try {
    const member = await currentMember.getMember();
    nav.postMessage({
      type: 'aretenav:member',
      loggedIn: true,
      name: member.contactDetails?.firstName || member.profile?.nickname || 'Member',
      slug: member.profile?.slug || ''
    });
  } catch (e) {
    nav.postMessage({ type: 'aretenav:member', loggedIn: false });
  }
}

$w.onReady(() => {
  nav.onMessage(async (event) => {
    const msg = event.data || {};
    if (msg.type === 'aretenav:ready')  return sendMember();
    if (msg.type === 'aretenav:height') return nav.style.height = `${msg.px}px`;
    if (msg.type === 'aretenav:nav')    return wixLocationFrontend.to(msg.href);
    if (msg.type === 'aretenav:login')  return authentication.promptLogin({ mode: 'login' }).then(sendMember);
    if (msg.type === 'aretenav:logout') return authentication.logout();
    if (msg.type === 'aretenav:profile') {
      const member = await currentMember.getMember();
      const slug = member?.profile?.slug;
      return wixLocationFrontend.to(slug ? `/profile/${slug}/profile` : '/account/my-account');
    }
  });
});
```

`authentication.onLogin(sendMember)` is worth adding too, so the bar swaps to
the account menu without a page reload.

## Check the profile route

Open any member's profile on the live site and look at the URL. If the members
area is on a custom route (for example `/members/<slug>/profile`), change
`PROFILE_ROUTE` at the top of the script in `nav.html` to match — it is a
single constant, `"/profile/{slug}/profile"`, with `{slug}` substituted in.

## Still to point somewhere real

`The Members` links to `/the-collective` and `Events` to `/event-list`. If
either route does not exist yet it will bounce the same way `/my-profile` did.
