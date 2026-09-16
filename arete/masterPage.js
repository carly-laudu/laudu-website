// ============================================================
// ARETĒ — site code (masterPage.js)  ·  Wix Velo
// Nav bridge + first-login profile safety net.
// TEMP: overlay diagnostic log — remove once dropdowns behave.
// ============================================================

import { authentication, currentMember } from 'wix-members-frontend';
import wixLocationFrontend from 'wix-location-frontend';
import { ensureProfile, getMyProfileSlug } from 'backend/profiles.web';

const NAV_ID  = '#html4';
const BAR_PX  = 76;
const OPEN_CLASS = 'aretenav--open';

// The one place that knows where a member profile lives.
// Confirmed against the live site: /profile/<slug>, e.g. /profile/carlydunne.
const profilePath = (slug) => `/profile/${encodeURIComponent(slug)}`;
// Exists for every member — used when a member has no slug yet.
const ACCOUNT_FALLBACK = '/account/my-account';

$w.onReady(() => {
  const nav = $w(NAV_ID);
  const navExists = nav && typeof nav.onMessage === 'function';

  // The /profile/<slug> dynamic page is keyed on the slug held in the CMS.
  // member.profile.slug is Wix's own, separate value — using it lands on the
  // empty default profile template.
  async function profileSlug() {
    try {
      return (await getMyProfileSlug()) || '';
    } catch (e) {
      return '';
    }
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
        const slug = await profileSlug();
        payload = {
          type: 'aretenav:member',
          loggedIn: true,
          name,
          slug,
          // Resolved here so the embed never has to guess the site's routing.
          profileUrl: slug ? profilePath(slug) : ''
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
          profileSlug()
            .then((slug) => wixLocationFrontend.to(slug ? profilePath(slug) : ACCOUNT_FALLBACK))
            .catch(() => wixLocationFrontend.to(ACCOUNT_FALLBACK));
          break;
      }
    });
  }

  authentication.onLogout(() => pushMember());

  // On login, let the profile finish being created before telling the nav who
  // the member is — otherwise a first-time member gets a nav with no slug.
  authentication.onLogin(() => {
    ensureProfile().catch(() => {}).then(() => pushMember());
  });

  pushMember();

  if (authentication.loggedIn()) { ensureProfile().catch(() => {}); }
});
