// ============================================================
// ARETĒ — site code (masterPage.js)  ·  Wix Velo
// Nav bridge + first-login profile safety net.
// TEMP: overlay diagnostic log — remove once dropdowns behave.
// ============================================================

import { authentication, currentMember } from 'wix-members-frontend';
import wixLocationFrontend from 'wix-location-frontend';
import { ensureProfile } from 'backend/profiles.web';

const NAV_ID  = '#html4';
const BAR_PX  = 76;
const OPEN_CLASS = 'aretenav--open';

$w.onReady(() => {
  const nav = $w(NAV_ID);
  const navExists = nav && typeof nav.onMessage === 'function';

  async function pushMember() {
    if (!navExists) return;
    let payload = { type: 'aretenav:member', loggedIn: false, name: '', slug: '' };
    try {
      if (authentication.loggedIn()) {
        const m = await currentMember.getMember({ fieldsets: ['FULL'] });
        const name =
          (m && m.contactDetails && m.contactDetails.firstName) ||
          (m && m.profile && m.profile.nickname) ||
          'Member';
        const slug = (m && m.profile && m.profile.slug) || (m && m._id) || '';
        payload = { type: 'aretenav:member', loggedIn: true, name, slug };
      }
    } catch (e) {
      payload = { type: 'aretenav:member', loggedIn: true, name: 'Member', slug: '' };
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
      }
    });
  }

  authentication.onLogout(() => pushMember());

  // On login, let the profile finish being created before telling the nav who
  // the member is, so a first-time member never reaches the members area
  // before the row backing it exists.
  authentication.onLogin(() => {
    ensureProfile().catch(() => {}).then(() => pushMember());
  });

  pushMember();

  if (authentication.loggedIn()) { ensureProfile().catch(() => {}); }
});
