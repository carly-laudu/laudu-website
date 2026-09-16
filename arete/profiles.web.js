// backend/profiles.web.js
import { webMethod, Permissions } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import { guests } from 'wix-events.v2';
import { mediaManager } from 'wix-media-backend';
import { elevate } from 'wix-auth';
import wixData from 'wix-data';

const EDITABLE_FIELDS = ['fullName', 'profession', 'region', 'firm', 'bio', 'photo', 'linkedin', 'areasOfFocus', 'document'];

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
// slugs and the URLs Wix generates from them do not agree — "Laura-Ucrós" in
// the CMS is "-laura-ucrós" in the address bar. Both reduce to "lauraucros".
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
// member was named keep /profile/new-member-ed4922 while their slug has since
// become hannah-van-ross-ed4922. The directory links to the link field, so
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

// Safety net and primary path: creates a pre-filled profile at first login
export const ensureProfile = webMethod(Permissions.SiteMember, async () => {
  const member = await currentMember.getMember({ fieldsets: ['FULL'] });
  if (!member) return;

  const existing = await wixData.query('Profiles')
    .eq('memberId', member._id)
    .find({ suppressAuth: true });
  if (existing.items.length > 0) return;

  const application = await findApplication(member.loginEmail);

  // Only a real name earns a readable slug. Without one the member ID keeps
  // the slug unique, since every unnamed member would otherwise collide.
  const knownName = application?.fullName
    || [member.contactDetails?.firstName, member.contactDetails?.lastName].filter(Boolean).join(' ')
    || '';

  const fullName = knownName || 'New Member';
  const slug = knownName
    ? await uniqueSlug(knownName)
    : `member-${member._id.slice(0, 6)}`;

  await wixData.insert('Profiles', {
    memberId: member._id,
    fullName,
    profession: application?.profession || '',
    region: application?.region || '',
    firm: application?.firm || '',
    linkedin: application?.linkedin || '',
    memberSince: new Date(),
    visibleInDirectory: false,
    slug
  }, { suppressAuth: true });
});

// Get my own profile (for the edit page)
export const getMyProfile = webMethod(Permissions.SiteMember, async () => {
  const member = await currentMember.getMember();
  const res = await wixData.query('Profiles')
    .eq('memberId', member._id)
    .find({ suppressAuth: true });
  return res.items[0] || null;
});

// Look a profile up by the slug in the page URL, for the public profile page.
export const getProfileBySlug = webMethod(Permissions.SiteMember, async (slug) => {
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

// Update my own profile
export const updateMyProfile = webMethod(Permissions.SiteMember, async (updates) => {
  const member = await currentMember.getMember();
  const res = await wixData.query('Profiles')
    .eq('memberId', member._id)
    .find({ suppressAuth: true });
  const profile = res.items[0];
  if (!profile) throw new Error('No profile found');

  for (const key of EDITABLE_FIELDS) {
    if (key in updates) profile[key] = updates[key];
  }

  profile.visibleInDirectory = Boolean(
    profile.photo && profile.profession && profile.region && profile.bio
  );

  return wixData.update('Profiles', profile, { suppressAuth: true });
});

// Upcoming events a member is attending, via Wix Events guest lists.
// Email can't be used as a query filter (PII), so we fetch upcoming
// events' guest lists by eventId and match the email in code.
export const getMemberEvents = webMethod(Permissions.SiteMember, async (memberId) => {
  try {
    if (!memberId) return [];

    const memRes = await wixData.query('Members/PrivateMembersData')
      .eq('_id', memberId)
      .find({ suppressAuth: true });
    const email = (memRes.items[0]?.loginEmail || '').toLowerCase();
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
      .sort((a, b) => new Date(a.start) - new Date(b.start));
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
