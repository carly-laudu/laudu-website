// backend/profiles.web.js
import { webMethod, Permissions } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import { guests } from 'wix-events.v2';
import { mediaManager } from 'wix-media-backend';
import { elevate } from 'wix-auth';
import wixData from 'wix-data';

const EDITABLE_FIELDS = ['fullName', 'profession', 'region', 'firm', 'bio', 'photo', 'linkedin', 'areasOfFocus', 'document'];

// ---------- approval ----------
//
// Permissions.SiteMember only means "has an account". On an approval-only site
// that is not the same as "is a member", so every method that returns member
// data checks this instead.
//
// A caller is approved when a Profiles row already carries their memberId, or
// when a row's `email` matches their login email. Creating that row IS the
// approval: no row, no access.
//
// LEAVE THIS FALSE until Profiles.email is populated — turning it on with the
// field empty locks out every member whose row has not been claimed yet.
// Until it is true, the Wix signup policy is the only thing preventing a
// stranger from reading member data.
const REQUIRE_APPROVED = false;

// An application in one of these states may create a profile on first login.
// Check the real values in the application collection before relying on it.
const APPROVED_APPLICATION_STATUSES = ['APPROVED', 'ACCEPTED', 'MEMBER'];

const normEmail = (value) => (value || '').toString().trim().toLowerCase();

async function loginEmailOf(member) {
  if (member && member.loginEmail) return normEmail(member.loginEmail);
  // getMember() does not always carry loginEmail; fall back to the member table.
  try {
    const res = await wixData.query('Members/PrivateMembersData')
      .eq('_id', member._id)
      .limit(1)
      .find({ suppressAuth: true });
    return normEmail(res.items[0] && res.items[0].loginEmail);
  } catch (e) {
    return '';
  }
}

// The caller's profile row, by memberId or by email. Null means not approved.
async function approvedProfile() {
  const member = await currentMember.getMember({ fieldsets: ['FULL'] });
  if (!member || !member._id) return null;

  const claimed = await wixData.query('Profiles')
    .eq('memberId', member._id)
    .limit(1)
    .find({ suppressAuth: true });
  if (claimed.items.length) return claimed.items[0];

  const email = await loginEmailOf(member);
  if (!email) return null;

  const byEmail = await wixData.query('Profiles')
    .eq('email', email)
    .limit(1)
    .find({ suppressAuth: true });
  return byEmail.items[0] || null;
}

async function requireApproved() {
  if (!REQUIRE_APPROVED) return;
  const profile = await approvedProfile();
  if (!profile) throw new Error('Not an approved member');
}

async function findApplication(email) {
  if (!email) return null;
  const res = await wixData.query('application')
    .eq('email', email.toLowerCase())
    .descending('_createdDate')
    .find({ suppressAuth: true });
  return res.items[0] || null;
}

// ---------- slugs ----------

// Reduce a slug or URL segment to comparable form: accents stripped, case
// folded, every separator removed. Deliberately lossy, because the stored
// slugs and the URLs Wix generates from them do not agree — "Accented-Name" in
// the CMS is "-accented-name" in the address bar. Both reduce to "lauraucros".
function slugKey(value) {
  return (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function baseSlug(name) {
  return (name || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'member';
}

// A clean slug, with -2, -3 appended only on a genuine name collision.
async function uniqueSlug(fullName) {
  const base = baseSlug(fullName);

  const nearby = await wixData.query('Profiles')
    .startsWith('slug', base)
    .limit(100)
    .find({ suppressAuth: true });

  const taken = new Set(nearby.items.map((item) => (item.slug || '').toLowerCase()));
  if (!taken.has(base)) return base;

  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36).slice(-6)}`;
}

// Every URL segment a row can be reached at. Wix keeps the live URL in a
// link-* field, and it can disagree with the slug: profiles created before a
// member was named keep /profile/new-member-xxxxxx while their slug has since
// become member-name-ed4922. The directory links to the link field, so
// both have to be matchable.
function linkKeys(item) {
  const keys = [];
  if (item.slug) keys.push(slugKey(item.slug));
  Object.keys(item).forEach((field) => {
    if (field.indexOf('link-') !== 0) return;
    const value = item[field];
    if (typeof value !== 'string' || !value) return;
    const tail = value.split('/').filter(Boolean).pop();
    if (!tail) return;
    let decoded = tail;
    try { decoded = decodeURIComponent(tail); } catch (e) { /* keep raw */ }
    keys.push(slugKey(decoded));
  });
  return keys;
}

// ---------- profiles ----------

// First login: claim the profile row that was created for this member when
// they were approved. It does NOT create a row for an unrecognised email —
// creating the row is how someone becomes a member, and that happens in the
// CMS, not by signing up.
//
// The one exception is an approved application, which keeps the
// apply -> approve -> join pipeline working without a manual row.
export const ensureProfile = webMethod(Permissions.SiteMember, async () => {
  const member = await currentMember.getMember({ fieldsets: ['FULL'] });
  if (!member || !member._id) return { claimed: false };

  // Already claimed.
  const claimed = await wixData.query('Profiles')
    .eq('memberId', member._id)
    .limit(1)
    .find({ suppressAuth: true });
  if (claimed.items.length) return { claimed: true };

  const email = await loginEmailOf(member);
  if (!email) return { claimed: false };

  // A row was prepared for this email: attach this member to it.
  const byEmail = await wixData.query('Profiles')
    .eq('email', email)
    .limit(1)
    .find({ suppressAuth: true });

  if (byEmail.items.length) {
    const profile = byEmail.items[0];
    profile.memberId = member._id;
    if (!profile.fullName) {
      profile.fullName = [member.contactDetails?.firstName, member.contactDetails?.lastName]
        .filter(Boolean).join(' ') || profile.title || 'Member';
    }
    await wixData.update('Profiles', profile, { suppressAuth: true });
    return { claimed: true };
  }

  // No row, but an approved application — create one.
  const application = await findApplication(email);
  const status = (application && application.status ? application.status : '').toUpperCase();
  if (!application || APPROVED_APPLICATION_STATUSES.indexOf(status) === -1) {
    console.log('ensureProfile: no profile and no approved application for this member');
    return { claimed: false };
  }

  const fullName = application.fullName
    || [member.contactDetails?.firstName, member.contactDetails?.lastName].filter(Boolean).join(' ')
    || 'New Member';

  await wixData.insert('Profiles', {
    memberId: member._id,
    email,
    fullName,
    profession: application.profession || '',
    region: application.region || '',
    firm: application.firm || '',
    linkedin: application.linkedin || '',
    memberSince: new Date(),
    visibleInDirectory: false,
    slug: await uniqueSlug(fullName)
  }, { suppressAuth: true });

  return { claimed: true };
});

// Get my own profile (for the edit page)
export const getMyProfile = webMethod(Permissions.SiteMember, async () => {
  return approvedProfile();
});

// Look a profile up by the slug in the page URL, for the public profile page.
export const getProfileBySlug = webMethod(Permissions.SiteMember, async (slug) => {
  await requireApproved();

  const wanted = slugKey(slug);
  if (!wanted) return null;

  // Exact match first — cheap, and correct for rows whose slug is current.
  const exact = await wixData.query('Profiles')
    .eq('slug', slug)
    .limit(1)
    .find({ suppressAuth: true });
  if (exact.items.length) return exact.items[0];

  // Otherwise compare normalised, against the slug and the link field alike.
  // The collection is small enough (~200 rows) that scanning it is cheaper
  // than trying to express this as a query.
  const all = await wixData.query('Profiles')
    .limit(1000)
    .find({ suppressAuth: true });

  return all.items.find((item) => linkKeys(item).indexOf(wanted) !== -1) || null;
});

// Every member for the directory. Each carries the URL it is actually
// reachable at, taken from the link-* field Wix maintains — never rebuilt from
// `slug`, which frequently disagrees with it.
export const getDirectory = webMethod(Permissions.SiteMember, async () => {
  await requireApproved();

  const res = await wixData.query('Profiles')
    .eq('visibleInDirectory', true)
    .limit(1000)
    .find({ suppressAuth: true });

  return res.items
    .map((item) => {
      const href = rowHref(item);
      if (!href) return null; // no URL, so nothing to link to
      return {
        name: (item.fullName || item.title || '').trim(),
        titleLine: [item.profession, item.firm].filter(Boolean).join(' \u00b7 '),
        photo: imageUrl(item.photo),
        profession: item.profession || '',
        region: item.region || '',
        href,
        slug: href.replace(/^\/profile\//, '') // for embeds that still build /profile/<slug>
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
});

// The URL a row is published at.
function rowHref(item) {
  const link = Object.keys(item)
    .filter((f) => f.indexOf('link-') === 0)
    .map((f) => item[f])
    .find((v) => typeof v === 'string' && v.charAt(0) === '/');
  if (link) return link;
  return item.slug ? `/profile/${item.slug}` : '';
}

// wix:image://v1/ab12~mv2.jpg/file.jpg#... -> a URL an iframe can load.
function imageUrl(value) {
  if (!value) return '';
  const raw = String(value);
  if (raw.indexOf('http') === 0) return raw;
  const match = raw.match(/^wix:image:\/\/v1\/([^/]+)/);
  return match ? 'https://static.wixstatic.com/media/' + match[1] : '';
}

// Update my own profile
export const updateMyProfile = webMethod(Permissions.SiteMember, async (updates) => {
  const profile = await approvedProfile();
  if (!profile) throw new Error('No profile found');

  for (const key of EDITABLE_FIELDS) {
    if (key in updates) profile[key] = updates[key];
  }

  profile.visibleInDirectory = Boolean(
    profile.photo && profile.profession && profile.region && profile.bio
  );

  return wixData.update('Profiles', profile, { suppressAuth: true });
});

// How many upcoming events to scan. Each one costs a guest-list query, so
// this bounds how long a profile page waits.
const EVENT_SCAN_LIMIT = 25;

// Upcoming events a member is attending, via Wix Events guest lists.
// Email can't be used as a query filter (PII), so we fetch upcoming
// events' guest lists by eventId and match the email in code.
//
// Takes a member ID or an email. Imported profiles have no memberId — only an
// email — and keying on the ID alone is why their events never appeared.
export const getMemberEvents = webMethod(Permissions.SiteMember, async (memberIdOrEmail) => {
  try {
    const given = (memberIdOrEmail || '').toString().trim();
    if (!given) return [];

    let email = '';
    if (given.indexOf('@') !== -1) {
      email = normEmail(given);
    } else {
      const memRes = await wixData.query('Members/PrivateMembersData')
        .eq('_id', given)
        .limit(1)
        .find({ suppressAuth: true });
      email = normEmail(memRes.items[0] && memRes.items[0].loginEmail);
    }
    if (!email) return [];

    // Upcoming events
    const evRes = await wixData.query('Events/Events')
      .limit(100)
      .find({ suppressAuth: true });
    const now = new Date();
    const upcoming = evRes.items
      .map((e) => ({
        id: e._id,
        title: e.title || '',
        start: e.start || e.scheduledStartDate || e.startDate || null
      }))
      .filter((e) => e.start && new Date(e.start) >= now)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, EVENT_SCAN_LIMIT);
    if (!upcoming.length) return [];

    // Guest lists per upcoming event, matched by email in code
    const queryGuestsElevated = elevate(guests.queryGuests);
    const attending = [];
    for (const ev of upcoming) {
      try {
        const gRes = await queryGuestsElevated()
          .eq('eventId', ev.id)
          .limit(1000)
          .find();
        const match = gRes.items.some((g) => {
          const gEmail = (g.guestDetails?.email || g.email || g.contactDetails?.email || '').toLowerCase();
          const status = g.rsvpStatus || g.attendanceStatus || '';
          const positive = !status || status === 'YES' || status === 'ATTENDING';
          return positive && gEmail === email;
        });
        if (match) attending.push(ev);
      } catch (inner) {
        console.log('guest list failed for event', ev.id, inner && inner.message);
      }
      if (attending.length >= 5) break;
    }

    return attending.slice(0, 5).map((e) => ({
      title: e.title,
      date: new Date(e.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    }));
  } catch (err) {
    console.log('getMemberEvents failed:', err && err.message);
    return [];
  }
});

// Resolves a Wix document field into a working download URL
export const getDocumentUrl = webMethod(Permissions.SiteMember, async (wixDocUrl) => {
  try {
    if (!wixDocUrl || typeof wixDocUrl !== 'string') return '';
    if (wixDocUrl.startsWith('http')) return wixDocUrl;
    return await mediaManager.getDownloadUrl(wixDocUrl);
  } catch (e) {
    console.log('getDocumentUrl failed:', e && e.message);
    return '';
  }
});
