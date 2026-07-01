#!/usr/bin/env node
/** Single phone-tab probe: join a room, capture console logs + page text + screenshot. */
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = (k, d) => process.env[k] ?? d;
const WEB_URL = env('WEB_URL', 'http://localhost:3000');
const SBC_URL = env('SBC_URL', 'wss://eu.jambonz.io:8443');
const SIP_REALM = env('SIP_REALM', 'sip.eu.jambonz.io');
const APP_SID = env('APP_SID', '');
const USERNAME = env('PHONE_USER', 'agent1');
const PASSWORD = env('CLIENT_PASSWORD', '');
const ROOM = env('ROOM', 'e2e-room-1');

const b = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${join(here, 'audio', 'agent.wav')}`,
  ],
});
const page = await b.newPage();
page.on('console', (m) => console.log(`[browser:${m.type()}] ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));

await page.goto(`${WEB_URL}/#phone`);
await page.getByLabel('SBC WebSocket URL').fill(SBC_URL);
await page.getByLabel('SIP realm').fill(SIP_REALM);
await page.getByLabel('Application SID').fill(APP_SID);
await page.getByLabel('Username').fill(USERNAME);
await page.getByLabel('Password').fill(PASSWORD);
await page.getByLabel('Room').fill(ROOM);
await page.getByRole('button', { name: 'Agent', exact: true }).click();
await page.getByRole('button', { name: 'Join room' }).click();

await page.waitForTimeout(20000);
console.log('\n=== PAGE TEXT ===');
console.log((await page.locator('body').innerText()).slice(0, 600));
await page.screenshot({ path: join(here, 'out', 'probe-phone.png') });
console.log('screenshot: tools/e2e/out/probe-phone.png');
await b.close();
