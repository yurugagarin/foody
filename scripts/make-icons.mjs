// Renders public/logo.svg into the PNG app icons with the preinstalled Playwright Chromium.
// Run once after changing the logo: npm run icons
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const svg = readFileSync(new URL('../public/logo.svg', import.meta.url), 'utf8');
const out = (f) => new URL('../public/' + f, import.meta.url).pathname;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function shot(size, file, { maskable = false } = {}) {
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#0F0E0D;display:flex;align-items:center;justify-content:center"><div style="width:${size * 0.82}px;height:${size * 0.82}px">${svg}</div></div>`
    : `<div style="width:${size}px;height:${size}px">${svg}</div>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}<style>svg{width:100%;height:100%;display:block}</style></body></html>`);
  await page.screenshot({ path: out(file), omitBackground: !maskable });
}
await shot(192, 'icon-192.png');
await shot(512, 'icon-512.png');
await shot(512, 'icon-maskable-512.png', { maskable: true });
await shot(180, 'apple-touch-icon.png', { maskable: true });
await browser.close();
console.log('icons written');
