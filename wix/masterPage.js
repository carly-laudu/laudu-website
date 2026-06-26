// ============================================================
// ARETĒ — site code (masterPage.js)  ·  Wix Velo
//
// Pairs with the navigation iframe (arete-nav.html), mounted as an
// HtmlComponent on every page. Responsibilities:
//   • tell the iframe who is logged in (+ their member slug)
//   • open the Wix login / run logout when the iframe asks
//   • navigate the whole site when a nav link is tapped
//   • grow the iframe to a full-screen overlay while a dropdown or the
//     mobile drawer is open, and collapse it back to the bar afterwards
//
// IMPORTANT — Velo cannot set an HtmlComponent's height from code.
//   · Wix Studio: drive height/overlay with a CSS custom class (below).
//   · Classic Wix Editor: there is no resize API, so pin the component to
//     the top of the screen at full-viewport height in the Editor and rely
//     on the iframe's pointer-events pass-through (empty area is click-through).
//     In that setup you can ignore the height/drawer branches — the frame is
//     already full-screen — and only the member/login/logout/nav branches matter.
// ============================================================

import { authentication, currentMember } from 'wix-members-frontend';
import wixLocationFrontend from 'wix-location-frontend';

// ---- config ------------------------------------------------
const NAV_ID  = '#aretenav';   // <-- the HtmlComponent's element ID
const BAR_PX  = 76;            // collapsed bar height (matches BASE_H in the iframe)
const OPEN_CLASS = 'aretenav--open'; // Wix Studio CSS class for the full-screen overlay

// In Wix Studio, add this rule in the site's Custom CSS panel:
//
//   .aretenav--open {
//     position: fixed !important;
//     inset: 0 !important;
//     height: 100dvh !important;
//     z-index: 9999 !important;
//   }
//
// The iframe is click-through except over the nav UI, so a full-height
// overlay does not block the page when only a dropdown is open.

$w.onReady(() => {
  const nav = $w(NAV_ID);

  // --- push the current member's state into the iframe ---------
  async function pushMember() {
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
      // logged in but profile fetch failed — still report logged in
      payload = { type: 'aretenav:member', loggedIn: true, name: 'Member', slug: '' };
    }
    try { nav.postMessage(payload); } catch (e) {}
  }

  // --- grow / collapse the frame (Wix Studio class toggle) ----
  function setOverlay(on) {
    try {
      if (!nav.customClassList) return; // classic Editor: no-op, frame is pinned full-height
      if (on) nav.customClassList.add(OPEN_CLASS);
      else    nav.customClassList.remove(OPEN_CLASS);
    } catch (e) {}
  }

  // --- messages coming from the iframe ------------------------
  nav.onMessage((event) => {
    const d = (event && event.data) || {};
    switch (d.type) {
      case 'aretenav:ready':                 // handshake — iframe just booted
        pushMember();
        break;

      case 'aretenav:height':                // dropdown opened/closed (desktop)
        setOverlay(Number(d.px) > BAR_PX);   // tall request -> overlay; back to 76 -> collapse
        break;

      case 'aretenav:drawer':                // mobile menu opened/closed
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

      case 'aretenav:nav':                   // navigate the whole site
        if (d.href) {
          setOverlay(false);                 // close the menu before leaving
          wixLocationFrontend.to(d.href);
        }
        break;
    }
  });

  // --- keep the iframe in sync if auth changes elsewhere ------
  authentication.onLogin(() => pushMember());
  authentication.onLogout(() => pushMember());

  // initial push, in case the iframe's 'ready' fired before this handler bound
  pushMember();
});
