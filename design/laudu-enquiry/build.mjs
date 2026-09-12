// Inlines the LAUDU brand fonts into each artboard and stages the canvas
// sources under build/. The preview iframe has no network access, so the
// fonts have to ride as data: URIs — but they stay out of git this way.
//
//   node build.mjs
//   cd build && node <skill>/seed-canvas.mjs --template <skill>/payload.template.html \
//       --out ../laudu-enquiry-flow.html --title "LAUDU Enquiry Flow" \
//       --artboard Main.dc.html --artboard Mobile.dc.html --canvas canvas.json

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const out = resolve(here, 'build');

const face = (family, weight, file, display) =>
  `    @font-face {\n` +
  `      font-family: "${family}";\n` +
  `      src: url(data:font/ttf;base64,${readFileSync(resolve(repo, file)).toString('base64')}) format("truetype");\n` +
  `      font-weight: ${weight}; font-style: normal; font-display: ${display};\n` +
  `    }`;

const fonts = [
  face('Dominique', 900, 'assets/fonts/Dominique-Black.ttf', 'block'),
  face('Neue Haas Display', 300, 'assets/fonts/NeueHaasDisplayLight.ttf', 'swap'),
  // Substitution, same as assets/colors_and_type.css: no 400 file ships.
  face('Neue Haas Display', 400, 'assets/fonts/NeueHaasDisplayLight.ttf', 'swap'),
].join('\n').trim();

mkdirSync(out, { recursive: true });

for (const name of ['Main.dc.html', 'Mobile.dc.html']) {
  const src = readFileSync(resolve(here, name), 'utf8');
  if (!src.includes('/*__FONTS__*/')) throw new Error(`no /*__FONTS__*/ marker in ${name}`);
  const dest = resolve(out, name);
  writeFileSync(dest, src.replace('/*__FONTS__*/', fonts));
  console.log(`build/${name}  ${(readFileSync(dest).byteLength / 1024).toFixed(0)} KB`);
}

copyFileSync(resolve(here, 'canvas.json'), resolve(out, 'canvas.json'));
console.log('build/canvas.json');
