// ============================================================
// ARETĒ — Profiles (Item) page code  ·  /profile/{slug}
//
// The profile card is an HTML embed (#html5), so it cannot be bound to a
// dataset. This looks the member up by the slug in the URL and posts the data
// into the iframe.
//
// Protocol, matching the embed exactly:
//   iframe -> page : { type:'areteportal:ready' }
//   page -> iframe : { type:'areteportal:data', profile:{...} }
//   iframe -> page : { type:'areteportal:nav', href:'/the-collective' }
//   iframe -> page : { type:'areteportal:height', px:number }
//
// If nothing is posted within 1200ms the embed renders its built-in sample
// member (Eleanor Vane) — so seeing her on a live profile means this bridge
// is not running.
// ============================================================

import { getProfileBySlug, getDocumentUrl, getMemberEvents } from 'backend/profiles.web';
import wixLocationFrontend from 'wix-location-frontend';

const EMBED_ID = '#html5';
const COLLECTIVE_PATH = '/the-collective';

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

// wix:image://v1/ab12_cd~mv2.jpg/file.jpg#... -> a URL the iframe can load.
// The embed is a separate origin and cannot resolve Wix's internal scheme.
function imageUrl(value) {
  if (!value) return '';
  const raw = String(value);
  if (raw.indexOf('http') === 0) return raw;
  const match = raw.match(/^wix:image:\/\/v1\/([^/]+)/);
  return match ? 'https://static.wixstatic.com/media/' + match[1] : '';
}

function formatMonthYear(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// Keys here must match what the embed's renderProfile() reads.
async function buildProfile(profile) {
  const name = profile.fullName || profile.title || '';

  let documentUrl = '';
  if (profile.document) {
    try { documentUrl = await getDocumentUrl(profile.document); } catch (e) { documentUrl = ''; }
  }

  // Email first: imported profiles have no memberId, and keying on that alone
  // is why their events never showed.
  let events = [];
  const eventKey = profile.email || profile.memberId || '';
  if (eventKey) {
    try { events = (await getMemberEvents(eventKey)) || []; } catch (e) { events = []; }
  }

  const areasOfFocus = Array.isArray(profile.areasOfFocus)
    ? profile.areasOfFocus.filter(Boolean)
    : (profile.areasOfFocus ? [profile.areasOfFocus] : []);

  return {
    name,
    titleLine: [profile.profession, profile.firm].filter(Boolean).join(' · '),
    photo: imageUrl(profile.photo),
    bio: profile.bio || '',
    region: profile.region || '',
    firm: profile.firm || '',
    memberSince: formatMonthYear(profile.memberSince),
    linkedin: profile.linkedin || '',
    areasOfFocus,
    documentUrl,
    documentLabel: 'Practice overview',
    events
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

  let payload = null;

  function send() {
    if (payload) embed.postMessage(payload);
  }

  // Listen before the lookup: the embed posts 'ready' as soon as it loads,
  // which is usually before the backend call returns.
  embed.onMessage((event) => {
    const data = (event && event.data) || {};
    if (data.type === 'areteportal:ready') { send(); return; }
    if (data.type === 'areteportal:nav') {
      const href = data.href === 'BACK_TO_COLLECTIVE' ? COLLECTIVE_PATH : data.href;
      if (href) wixLocationFrontend.to(href);
      return;
    }
    if (data.type === 'areteportal:height') {
      try { embed.style.height = `${Math.ceil(Number(data.px) || 0)}px`; } catch (e) {}
    }
  });

  const slug = slugFromUrl();
  let profile = null;
  try {
    profile = await getProfileBySlug(slug);
  } catch (e) {
    console.log('profile page: lookup failed', e && e.message);
  }

  if (!profile) {
    console.log('profile page: no profile for slug', slug);
    return;
  }

  payload = { type: 'areteportal:data', profile: await buildProfile(profile) };
  send();
});
