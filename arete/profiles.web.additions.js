// ============================================================
// ADD TO backend/profiles.web.js  ·  Aretē
// Alongside the existing ensureProfile().
//
// The /profile/<slug> dynamic page is keyed on a slug held in the CMS, not on
// Wix's own member.profile.slug. Those are different values, so the slug has
// to be read from the collection.
//
// >>> Set these three to match the collection ensureProfile() writes to. <<<
// ============================================================

const PROFILES_COLLECTION = 'Profiles';  // collection ID (not its display name)
const MEMBER_ID_FIELD     = 'memberId';  // field holding the Wix member _id
const SLUG_FIELD          = 'slug';      // field the dynamic page is keyed on

// The imports below are probably already at the top of profiles.web.js —
// merge rather than duplicating them.
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';

export const getMyProfileSlug = webMethod(Permissions.SiteMember, async () => {
  const member = await currentMember.getMember();
  if (!member || !member._id) return '';

  const res = await wixData
    .query(PROFILES_COLLECTION)
    .eq(MEMBER_ID_FIELD, member._id)
    .limit(1)
    .find({ suppressAuth: true }); // the member may not have read access itself

  const item = res.items[0];
  return (item && item[SLUG_FIELD]) || '';
});
