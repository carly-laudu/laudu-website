// ============================================================
// ARETĒ — Profiles (Item) page code  ·  /profile/{slug}
//
// Populates the profile from the CMS row directly, rather than relying on the
// page's dynamic dataset. The dataset was returning the same member for every
// URL, so the item is fetched by the slug in the address bar instead.
//
// >>> Fill in IDS below from the editor's Layers panel. <<<
// Any ID left wrong is skipped rather than throwing, so the rest of the page
// still fills in — check the browser console to see which were not found.
// ============================================================

import { getProfileBySlug } from 'backend/profiles.web';
import wixLocationFrontend from 'wix-location-frontend';

const IDS = {
  name:         '#name',          // "Eleanor Vane"
  subtitle:     '#subtitle',      // "Private Client Law · Vane & Partners"
  initials:     '#initials',      // the "EV" circle
  profession:   '#profession',
  region:       '#region',
  firm:         '#firm',
  bio:          '#bio',           // the Overview paragraph
  memberSince:  '#memberSince',   // "July 2026"
  areasOfFocus: '#areasOfFocus',  // the tag row, if it is a single text element
  photo:        '#photo',
  linkedin:     '#linkedinButton',
  document:     '#documentButton'
};

// $w() throws for an ID that is not on the page, so every lookup is guarded.
function el(id) {
  if (!id) return null;
  try {
    const found = $w(id);
    return found && found.id ? found : null;
  } catch (e) {
    console.log('profile page: no element', id);
    return null;
  }
}

function hide(element) {
  if (!element) return;
  if (typeof element.collapse === 'function') element.collapse();
  else if (typeof element.hide === 'function') element.hide();
}

function show(element) {
  if (!element) return;
  if (typeof element.expand === 'function') element.expand();
  if (typeof element.show === 'function') element.show();
}

function setText(id, value) {
  const element = el(id);
  if (!element) return;
  const text = value === null || value === undefined ? '' : String(value);
  if (!text) { hide(element); return; }
  element.text = text;
  show(element);
}

function setImage(id, url) {
  const element = el(id);
  if (!element) return;
  if (!url) { hide(element); return; }
  element.src = url;
  show(element);
}

function setLink(id, url) {
  const element = el(id);
  if (!element) return;
  if (!url) { hide(element); return; }
  element.link = url;
  element.target = '_blank';
  show(element);
}

// Last non-empty segment of the path, e.g. /profile/-laura-ucros -> "-laura-ucros".
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

// "Eleanor Vane" -> "EV", for the avatar circle when a member has no photo.
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

$w.onReady(async () => {
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

  const fullName = profile.fullName || profile.title || '';

  setText(IDS.name, fullName);
  setText(IDS.subtitle, [profile.profession, profile.firm].filter(Boolean).join(' \u00b7 '));
  setText(IDS.profession, profile.profession);
  setText(IDS.region, profile.region);
  setText(IDS.firm, profile.firm);
  setText(IDS.bio, profile.bio);
  setText(IDS.areasOfFocus,
    Array.isArray(profile.areasOfFocus) ? profile.areasOfFocus.join(' · ') : profile.areasOfFocus);
  setText(IDS.memberSince, formatMonthYear(profile.memberSince));

  // The design falls back to an initials circle when there is no photograph.
  if (profile.photo) {
    setImage(IDS.photo, profile.photo);
    hide(el(IDS.initials));
  } else {
    hide(el(IDS.photo));
    setText(IDS.initials, initialsOf(fullName));
  }

  setLink(IDS.linkedin, profile.linkedin);
  setLink(IDS.document, profile.document);
});
