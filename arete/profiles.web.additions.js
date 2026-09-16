// ============================================================
// ADD TO backend/profiles.web.js  ·  Aretē
// Paste alongside the existing exports. The imports it needs
// (webMethod, Permissions, wixData) are already at the top of that file.
// ============================================================

// Reduce a slug or URL segment to comparable form: accents stripped, case
// folded, every separator removed. This is deliberately lossy, because the
// stored slugs and the URLs Wix generates from them do not agree —
// "Laura-Ucrós" in the CMS becomes "-laura-ucrós" in the address bar. Both
// reduce to "lauraucros", so the row is found either way and no slug data has
// to be rewritten (which would break existing links).
function slugKey(value) {
  return (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// Look a profile up by the slug in the page URL.
// Members-only, matching the collection's own permissions.
export const getProfileBySlug = webMethod(Permissions.SiteMember, async (slug) => {
  const wanted = slugKey(slug);
  if (!wanted) return null;

  // Exact match first — cheap, and correct for rows ensureProfile() created.
  const exact = await wixData.query('Profiles')
    .eq('slug', slug)
    .limit(1)
    .find({ suppressAuth: true });
  if (exact.items.length) return exact.items[0];

  // Otherwise compare normalised. The collection is small enough (~200 rows)
  // that scanning it is cheaper than trying to express this as a query.
  const all = await wixData.query('Profiles')
    .limit(1000)
    .find({ suppressAuth: true });
  return all.items.find((item) => slugKey(item.slug) === wanted) || null;
});
