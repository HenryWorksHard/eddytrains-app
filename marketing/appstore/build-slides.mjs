#!/usr/bin/env node
// Renders the App Store screenshot set from slides.json.
//
// Output: 6 PNGs at 1320x2868, which is the 6.9 inch iPhone size Apple
// requires. One set at that size covers every iPhone, because Apple scales
// down but will not scale up.
//
// HOW THE DEVICE IMAGE WORKS. Each slide looks for
// screenshots/<n>.png, a real 1320x2868 capture from the iPhone 17 Pro Max
// simulator. If the file is missing the slide still renders, with a labelled
// placeholder naming the screen to capture. So this script is runnable now,
// while the app screens are still behind a login, and the finished set comes
// out of the same command later with nothing else changed.
//
// Apple requires screenshots to show the actual app. The placeholders exist
// to compose and review the layout, never to ship: a slide with a placeholder
// still in it must not be uploaded.
//
// Usage:  node marketing/appstore/build-slides.mjs
// Needs:  Google Chrome (headless screenshot), no npm dependencies.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const SHOTS = join(HERE, 'screenshots');
const TMP = join(OUT, '.html');

const WIDTH = 1320;
const HEIGHT = 2868;

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Brand. Matches the app: near-black ground, one signal yellow, Sora.
const YELLOW = '#FACC15';

/**
 * Splits a headline so the accent word can be coloured.
 *
 * The research point this implements: high-converting sets reserve the accent
 * colour for one element per slide. Colouring a whole headline yellow would
 * spend that budget on the least informative pixels, so exactly one word is
 * lifted, chosen from the slide's own accent_moment where it names one.
 */
function markupHeadline(headline, accentWord) {
  if (!accentWord) return escapeHtml(headline);
  const re = new RegExp(`\\b(${accentWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i');
  if (!re.test(headline)) return escapeHtml(headline);
  return escapeHtml(headline).replace(
    new RegExp(`\\b(${accentWord})\\b`, 'i'),
    '<span class="accent">$1</span>',
  );
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function slideHtml(slide, shotPath) {
  const hasShot = shotPath !== null;
  const device = hasShot
    ? `<img class="shot" src="file://${shotPath}" alt="">`
    : `<div class="placeholder">
         <div class="ph-label">SCREENSHOT ${slide.n}</div>
         <div class="ph-screen">${escapeHtml(slide.app_screen)}</div>
         <div class="ph-note">Capture at ${WIDTH}x${HEIGHT} on iPhone 17 Pro Max,<br>save as screenshots/${slide.n}.png, re-run this script.</div>
       </div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${WIDTH}px; height: ${HEIGHT}px;
    background: #000; overflow: hidden;
    font-family: Sora, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  /* A single soft pool of light behind the device, so the black does not read
     as a flat void at thumbnail size and the phone has something to sit in. */
  .glow {
    position: absolute; left: 50%; top: 46%;
    width: 1720px; height: 1720px; transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(250,204,21,0.22) 0%, rgba(250,204,21,0.09) 30%, rgba(250,204,21,0.025) 52%, rgba(0,0,0,0) 72%);
  }
  .floor {
    position: absolute; left: 0; right: 0; bottom: 0; height: 520px;
    background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%);
    pointer-events: none; z-index: 5;
  }
  .caption {
    position: absolute; top: 150px; left: 96px; right: 96px;
    text-align: center;
  }
  h1 {
    font-size: 104px; line-height: 1.04; font-weight: 800;
    letter-spacing: -0.035em; color: #fff; text-transform: uppercase;
  }
  h1 .accent { color: ${YELLOW}; }
  p.sub {
    margin-top: 34px; font-size: 40px; line-height: 1.38;
    font-weight: 400; color: #a1a1aa; letter-spacing: -0.01em;
  }
  /* The device bleeds off the bottom edge. Straight from the research: the
     loggers crop the phone so the set table renders large enough to read in
     the search grid, rather than shrinking a whole phone to fit. */
  .device {
    position: absolute; left: 50%; top: 600px; transform: translateX(-50%);
    width: 900px; height: ${HEIGHT - 600 + 120}px;
    border-radius: 86px 86px 0 0;
    border: 14px solid #1f1f23;
    border-bottom: none;
    background: #09090b;
    overflow: hidden;
    box-shadow: 0 -10px 90px rgba(0,0,0,0.9), 0 0 0 3px #000;
    z-index: 2;
  }
  .shot { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
  .placeholder {
    width: 100%; height: 100%; padding: 120px 70px;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    text-align: center; gap: 34px;
    background: repeating-linear-gradient(45deg, #0d0d10 0 28px, #121216 28px 56px);
  }
  .ph-label { font-size: 30px; font-weight: 800; letter-spacing: 0.22em; color: ${YELLOW}; }
  .ph-screen { font-size: 36px; font-weight: 600; color: #e4e4e7; line-height: 1.4; }
  .ph-note { font-size: 24px; color: #71717a; line-height: 1.6; }
</style></head>
<body>
  <div class="glow"></div>
  <div class="floor"></div>
  <div class="caption">
    <h1>${markupHeadline(slide.headline, slide.accent_word)}</h1>
    ${slide.subhead ? `<p class="sub">${escapeHtml(slide.subhead)}</p>` : ''}
  </div>
  <div class="device">${device}</div>
</body></html>`;
}

// --- main ------------------------------------------------------------------

const data = JSON.parse(readFileSync(join(HERE, 'slides.json'), 'utf8'));

mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(SHOTS, { recursive: true });

let withShots = 0;
const missing = [];

for (const slide of data.slides) {
  const shot = join(SHOTS, `${slide.n}.png`);
  const hasShot = existsSync(shot);
  if (hasShot) withShots++;
  else missing.push(slide.n);

  const htmlPath = join(TMP, `slide-${slide.n}.html`);
  writeFileSync(htmlPath, slideHtml(slide, hasShot ? shot : null));

  execFileSync(
    CHROME,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--allow-file-access-from-files',
      `--window-size=${WIDTH},${HEIGHT}`,
      `--screenshot=${join(OUT, `slide-${slide.n}.png`)}`,
      '--virtual-time-budget=4000',
      `file://${htmlPath}`,
    ],
    { stdio: 'ignore' },
  );

  console.log(`slide ${slide.n}  ${hasShot ? 'real screenshot' : 'PLACEHOLDER'}  ${slide.headline}`);
}

rmSync(TMP, { recursive: true, force: true });

console.log(`\n${data.slides.length} slides written to marketing/appstore/out/`);
if (missing.length) {
  console.log(
    `\nNOT READY TO UPLOAD. Slides ${missing.join(', ')} still use placeholders.\n` +
      `Drop real 1320x2868 captures into marketing/appstore/screenshots/<n>.png and re-run.`,
  );
} else {
  console.log(`\nAll ${withShots} slides use real screenshots. Ready to upload.`);
}
