// One-off script: logs into the local dev server with the demo test account
// and saves real PNG screenshots to disk for the Play Store listing.
// Run with: node scripts/capture-screenshots.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '..', 'store-assets', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://localhost:8081';
const EMAIL = 'screenshot.demo.sevizi@gmail.com';
const PASSWORD = 'Screenshot2026Demo!';

async function shot(page, name) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
  console.log('saved', name);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });

  await page.goto(`${BASE}/onboarding/auth`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, '01-login');

  await page.fill('input[placeholder="Adresse e-mail"]', EMAIL);
  await page.fill('input[placeholder="Mot de passe"]', PASSWORD);
  await page.locator('div:text-is("Se connecter")').first().click();
  await page.waitForTimeout(3000);

  await page.goto(`${BASE}/client/home`, { waitUntil: 'networkidle' });
  await shot(page, '02-home');

  await page.goto(`${BASE}/client/categories`, { waitUntil: 'networkidle' });
  await shot(page, '03-categories');

  await page.goto(`${BASE}/client/map`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await shot(page, '04-map');

  await page.goto(`${BASE}/client/new-request`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, '05-new-request');

  await page.goto(`${BASE}/client/profile`, { waitUntil: 'networkidle' });
  await shot(page, '06-client-profile');

  await page.goto(`${BASE}/shared/provider-profile?id=a1a86ca6-cbe7-4fa4-9a96-97b973e88519`, { waitUntil: 'networkidle' });
  await shot(page, '07-provider-profile');

  await browser.close();
  console.log('Done. Files in', OUT_DIR);
})().catch(e => { console.error(e); process.exit(1); });
