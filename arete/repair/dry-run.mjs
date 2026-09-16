// Dry run for the Profiles slug repair. Reads a snapshot of the live collection
// and prints what it would change. Writes nothing, anywhere.
import { readFileSync } from 'node:fs';

const slugKey = (v) => (v || '').toString().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const baseSlug = (name) => (name || '').toString().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'member';

const rows = readFileSync(new URL('./profiles-snapshot.tsv', import.meta.url), 'utf8')
  .split('\n').filter(Boolean)
  .map((line) => {
    const [id, fullName, slug, linkTail] = line.split('\t');
    return { id, fullName, slug: slug || '', linkTail: (linkTail || '') };
  });

// Classify
const bySlug = new Map();
for (const r of rows) {
  if (!r.slug) continue;
  if (!bySlug.has(r.slug)) bySlug.set(r.slug, []);
  bySlug.get(r.slug).push(r);
}
const duplicated = new Set([...bySlug].filter(([, v]) => v.length > 1).map(([k]) => k));

let decoded = (t) => { try { return decodeURIComponent(t); } catch (e) { return t; } };

const noUrl = [], stale = [], dupes = [], healthy = [];
for (const r of rows) {
  if (!r.slug && !r.linkTail) { noUrl.push(r); continue; }
  if (duplicated.has(r.slug)) { dupes.push(r); continue; }
  if (slugKey(decoded(r.linkTail)) !== slugKey(r.slug)) { stale.push(r); continue; }
  healthy.push(r);
}

// Proposed new slugs — only for rows that are currently broken.
// Healthy rows are never touched, so their URLs (and any links to them) hold.
const taken = new Set(rows.map((r) => (r.slug || '').toLowerCase()).filter(Boolean));
function propose(name) {
  const base = baseSlug(name);
  if (!taken.has(base)) { taken.add(base); return base; }
  for (let n = 2; n < 100; n++) {
    const c = `${base}-${n}`;
    if (!taken.has(c)) { taken.add(c); return c; }
  }
  return null;
}

console.log('='.repeat(78));
console.log('DRY RUN — Profiles slug repair.  NOTHING IS WRITTEN.');
console.log('='.repeat(78));
console.log(`\nRows in collection: ${rows.length}`);
console.log(`  healthy, untouched : ${healthy.length}`);
console.log(`  stale URL          : ${stale.length}   <- would be changed`);
console.log(`  duplicate slug     : ${dupes.length}   <- reported only, not changed`);
console.log(`  no URL at all      : ${noUrl.length}   <- reported only, not changed`);

console.log(`\n\n--- WOULD CHANGE (${stale.length}) ------------------------------------------`);
console.log('These publish at a URL their slug no longer matches, so they 404.\n');
console.log('  ' + 'member'.padEnd(30) + 'now (broken)'.padEnd(34) + 'would become');
console.log('  ' + '-'.repeat(30) + '-'.repeat(34) + '-'.repeat(28));
for (const r of stale) {
  const next = propose(r.fullName);
  console.log('  ' + r.fullName.trim().padEnd(30) + ('/profile/' + r.linkTail).padEnd(34) + '/profile/' + next);
}

console.log(`\n\n--- REPORTED ONLY: duplicate slugs (${dupes.length} rows) ------------------`);
console.log('Several rows share one slug, so the page cannot resolve it. These look');
console.log('like the same member signed up twice. Merging or deleting is your call.\n');
for (const slug of duplicated) {
  const group = bySlug.get(slug);
  console.log(`  ${slug}  (${group.length} rows)`);
  for (const r of group) console.log(`      ${r.id}  ${r.fullName}`);
}

console.log(`\n\n--- REPORTED ONLY: no URL (${noUrl.length}) ----------------------------------`);
console.log('No slug and no link, so these have no profile page at all.\n');
for (const r of noUrl) console.log(`  ${r.id}  ${r.fullName}`);

console.log('\n' + '='.repeat(78));
console.log(`Summary: ${stale.length} rows would have their slug rewritten.`);
console.log(`         ${healthy.length} rows untouched — existing links unaffected.`);
console.log('         Nothing was written. Run again with the apply script to commit.');
console.log('='.repeat(78));
