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
  name:         '#name',
  profession:   '#profession',
  region:       '#region',
  firm:         '#firm',
  bio:          '#bio',
  areasOfFocus: '#areasOfFocus',
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

  setText(IDS.name, profile.fullName || profile.title);
  setText(IDS.profession, profile.profession);
  setText(IDS.region, profile.region);
  setText(IDS.firm, profile.firm);
  setText(IDS.bio, profile.bio);
  setText(IDS.areasOfFocus,
    Array.isArray(profile.areasOfFocus) ? profile.areasOfFocus.join(' · ') : profile.areasOfFocus);
  setImage(IDS.photo, profile.photo);
  setLink(IDS.linkedin, profile.linkedin);
  setLink(IDS.document, profile.document);
});
