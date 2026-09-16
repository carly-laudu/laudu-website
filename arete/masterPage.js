// ============================================================
// ARETĒ — site code (masterPage.js)  ·  Wix Velo
// Nav bridge + first-login profile safety net.
// TEMP: overlay diagnostic log — remove once dropdowns behave.
// ============================================================

import { authentication, currentMember } from 'wix-members-frontend';
import wixLocationFrontend from 'wix-location-frontend';
import { ensureProfile, getMyProfile } from 'backend/profiles.web';

const NAV_ID  = '#html4';
const BAR_PX  = 76;
const OPEN_CLASS = 'aretenav--open';

// The one place that knows where a member profile lives.
// Confirmed against the live site: /profile/<slug>, e.g. /profile/carlydunne.
const profilePath = (slug) => `/profile/${encodeURIComponent(slug)}`;
// Where a member goes when no public profile URL can be resolved. /my-profile
// is the edit page, so it is also the right place to send someone whose row
// does not exist yet — they can fill it in.
const ACCOUNT_FALLBACK = '/my-profile';

$w.onReady(() => {
  const nav = $w(NAV_ID);
  const navExists = nav && typeof nav.onMessage === 'function';

  // The /profile/<slug> dynamic page is keyed on the slug held in the CMS, not
  // on Wix's member.profile.slug — those are different values for the same
  // person, and the Wix one lands on the empty default profile template.
  //
  // Wix generates a link-* field on the collection whose value is the finished
  // relative URL of the dynamic item page, so prefer that over rebuilding the
  // path: it stays correct even if the page's URL pattern changes.
  function rowProfileUrl(row) {
    if (!row) return '';
    const keys = Object.keys(row);
    const links = keys.filter((k) => k.indexOf('link-') === 0 &&
      typeof row[k] === 'string' && row[k].charAt(0) === '/');
    const onProfile = links.filter((k) => row[k].indexOf('/profile/') === 0);
    if (onProfile.length) return row[onProfile[0]];
    if (links.length) return row[links[0]];
    const slug = row.slug || ''; // ensureProfile() writes: full-name-<6 of _id>
    return slug ? profilePath(slug) : '';
  }

  let profileUrlMemo = null;
  async function profileUrl() {
    if (profileUrlMemo !== null) return profileUrlMemo;
    try {
      profileUrlMemo = rowProfileUrl(await getMyProfile());
    } catch (e) {
      profileUrlMemo = '';
    }
    return profileUrlMemo;
  }

  async function pushMember() {
    if (!navExists) return;
    let payload = { type: 'aretenav:member', loggedIn: false, name: '', slug: '', profileUrl: '' };
    try {
      if (authentication.loggedIn()) {
        const m = await currentMember.getMember({ fieldsets: ['FULL'] });
        const name =
          (m && m.contactDetails && m.contactDetails.firstName) ||
          (m && m.profile && m.profile.nickname) ||
          'Member';
        const slug = (m && m.profile && m.profile.slug) || '';
        payload = {
          type: 'aretenav:member',
          loggedIn: true,
          name,
          slug,
          // Resolved here so the embed never has to guess the site's routing.
          profileUrl: await profileUrl()
        };
      }
    } catch (e) {
      payload = { type: 'aretenav:member', loggedIn: true, name: 'Member', slug: '', profileUrl: '' };
    }
    try { nav.postMessage(payload); } catch (e) {}
  }

  function setOverlay(on) {
    try {
      console.log('OVERLAY:', on, 'classList exists:', !!(navExists && nav.customClassList)); // TEMP
      if (!navExists || !nav.customClassList) return;
      if (on) nav.customClassList.add(OPEN_CLASS);
      else    nav.customClassList.remove(OPEN_CLASS);
    } catch (e) {
      console.log('OVERLAY failed:', e && e.message); // TEMP
    }
  }

  setOverlay(false);

  if (navExists) {
    nav.onMessage((event) => {
      const d = (event && event.data) || {};
      switch (d.type) {
        case 'aretenav:ready':
          pushMember();
          break;
        case 'aretenav:height':
          setOverlay(Number(d.px) > BAR_PX);
          break;
        case 'aretenav:drawer':
          setOverlay(!!d.open);
          break;
        case 'aretenav:login':
          authentication.promptLogin({ mode: 'login' })
            .then(pushMember).catch(() => {});
          break;
        case 'aretenav:logout':
          authentication.logout()
            .then(pushMember).catch(() => {});
          break;
        case 'aretenav:nav':
          if (d.href) {
            setOverlay(false);
            wixLocationFrontend.to(d.href);
          }
          break;
        // Safety net: the embed asks for the profile when it was handed no slug
        // (e.g. a brand-new member whose profile was still being created).
        case 'aretenav:profile':
          setOverlay(false);
          profileUrl()
            .then((url) => wixLocationFrontend.to(url || ACCOUNT_FALLBACK))
            .catch(() => wixLocationFrontend.to(ACCOUNT_FALLBACK));
          break;
      }
    });
  }

  authentication.onLogout(() => { profileUrlMemo = null; pushMember(); });

  // On login, let the profile finish being created before telling the nav who
  // the member is — otherwise a first-time member gets a nav with no slug.
  authentication.onLogin(() => {
    profileUrlMemo = null; // ensureProfile() may have just created the row
    ensureProfile().catch(() => {}).then(() => pushMember());
  });

  pushMember();

  if (authentication.loggedIn()) { ensureProfile().catch(() => {}); }
});
