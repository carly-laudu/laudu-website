// ============================================================
// ARETĒ — Profiles (Item) page code  ·  /profile/{slug}
//
// The profile card is an HTML embed (#html5), not Wix elements, so it cannot
// be connected to a dataset. This fetches the member by the slug in the URL
// and posts the data into the iframe, the same way masterPage.js feeds the nav.
//
// The embed must listen for 'areteprofile:member' and render it, and should
// post 'areteprofile:ready' once it is listening.
// ============================================================

import { getProfileBySlug, getDocumentUrl } from 'backend/profiles.web';
import wixLocationFrontend from 'wix-location-frontend';

const EMBED_ID = '#html5';

// Last non-empty path segment, e.g. /profile/-laura-ucros -> "-laura-ucros".
// The backend normalises it, so the mangled form Wix generates still matches.
function slugFromUrl() {
  const path = wixLocationFrontend.path || [];
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i]) {
      try { return decodeURIComponent(path[i]); } catch (e) { return path[i]; }
    }
  }
  return '';
}

// wix:image://v1/ab12_cd~mv2.jpg/file.jpg#... -> a URL an iframe can load.
// The embed is a separate origin and cannot resolve Wix's internal scheme.
function imageUrl(value) {
  if (!value) return '';
  const raw = String(value);
  if (raw.indexOf('http') === 0) return raw;
  const match = raw.match(/^wix:image:\/\/v1\/([^/]+)/);
  return match ? 'https://static.wixstatic.com/media/' + match[1] : '';
}

function initialsOf(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function formatMonthYear(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// Everything the embed needs, already resolved — no Wix-internal values.
async function buildPayload(profile) {
  const fullName = profile.fullName || profile.title || '';

  let documentUrl = '';
  if (profile.document) {
    try {
      documentUrl = await getDocumentUrl(profile.document);
    } catch (e) {
      documentUrl = '';
    }
  }

  const focus = Array.isArray(profile.areasOfFocus)
    ? profile.areasOfFocus.filter(Boolean)
    : (profile.areasOfFocus ? [profile.areasOfFocus] : []);

  return {
    type: 'areteprofile:member',
    profile: {
      fullName,
      initials: initialsOf(fullName),
      profession: profile.profession || '',
      region: profile.region || '',
      firm: profile.firm || '',
      bio: profile.bio || '',
      subtitle: [profile.profession, profile.firm].filter(Boolean).join(' · '),
      memberSince: formatMonthYear(profile.memberSince),
      areasOfFocus: focus,
      photo: imageUrl(profile.photo),
      linkedin: profile.linkedin || '',
      document: documentUrl
    }
  };
}

$w.onReady(async () => {
  let embed = null;
  try {
    embed = $w(EMBED_ID);
  } catch (e) {
    console.log('profile page: no embed at', EMBED_ID);
    return;
  }

  const slug = slugFromUrl();
  let profile = null;
  try {
    profile = await getProfileBySlug(slug);
  } catch (e) {
    console.log('profile page: lookup failed', e && e.message);
  }

  if (!profile) {
    console.log('profile page: no profile for slug', slug);
    embed.postMessage({ type: 'areteprofile:member', profile: null });
    return;
  }

  const payload = await buildPayload(profile);

  // The iframe may come up after this code runs, so answer its ready message
  // as well as posting once now.
  embed.onMessage((event) => {
    const data = (event && event.data) || {};
    if (data.type === 'areteprofile:ready') embed.postMessage(payload);
  });
  embed.postMessage(payload);
});
