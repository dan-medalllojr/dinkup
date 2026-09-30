import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
// Run from anywhere: paths are relative to this file.
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const svg = readFileSync(`${root}/icon-src/icon.svg`, 'utf8');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['maskable-512.png', 512], ['apple-touch-icon-180.png', 180]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `${root}/public/icons/${name}`, omitBackground: false });
  await page.close();
}
await browser.close();
console.log('rendered');
