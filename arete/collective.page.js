// ============================================================
// ARETĒ — The Collective page code  ·  the member directory
//
// The directory embed builds its links as '/profile/' + slug, but `slug` is
// not the URL a profile is published at — Wix keeps that in a link-* field,
// and for ~58 members the two disagree, which is what produces the 404s.
// getDirectory() returns the real URL, as both `href` and `slug`, so the
// embed links correctly whether or not its own code is updated.
// ============================================================

import { getDirectory } from 'backend/profiles.web';
import wixLocationFrontend from 'wix-location-frontend';

const EMBED_ID = '#html5';

$w.onReady(async () => {
  let embed = null;
  try {
    embed = $w(EMBED_ID);
  } catch (e) {
    return;
  }

  let payload = null;
  const send = () => { if (payload) embed.postMessage(payload); };

  // Listen before awaiting: the embed posts 'ready' as soon as it loads,
  // usually before the backend call returns.
  embed.onMessage((event) => {
    const data = (event && event.data) || {};
    if (data.type === 'areteportal:ready') { send(); return; }
    if (data.type === 'areteportal:nav') {
      if (data.href) wixLocationFrontend.to(data.href);
      return;
    }
    if (data.type === 'areteportal:height') {
      try { embed.style.height = `${Math.ceil(Number(data.px) || 0)}px`; } catch (e) {}
    }
  });

  let members = [];
  try {
    members = (await getDirectory()) || [];
  } catch (e) {
    console.log('collective: lookup failed', e && e.message);
  }

  payload = { type: 'areteportal:data', members };
  send();
});
