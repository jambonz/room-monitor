#!/usr/bin/env node
/** Targeted probe: two phones join, console turns transcript ON while IDLE
 *  (no listen/coach — isolates the mix→fork→Deepgram path from coach/relate).
 *  Dumps the transcript text after 45s. */
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = (k, d) => process.env[k] ?? d;
const WEB_URL = env('WEB_URL', 'http://localhost:3000');
const BASE_URL = env('BASE_URL', '').replace(/\/+$/, '');
const ACCOUNT_SID = env('ACCOUNT_SID', '');
const API_KEY = env('API_KEY', '');
const SBC_URL = env('SBC_URL', 'wss://sip.eu.jambonz.io:8443');
const SIP_REALM = env('SIP_REALM', 'sip.eu.jambonz.io');
const CLIENT_PASSWORD = env('CLIENT_PASSWORD', '');
const ROOM = env('ROOM', 'probe-room-1');
const APP_SID = env('APP_SID', '');

const browsers = [];
async function launch(wav) {
  const b = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${join(here, 'audio', wav)}`,
    ],
  });
  browsers.push(b);
  const p = await b.newPage();
  p.setDefaultTimeout(25000);
  return p;
}

async function joinPhone(page, username, role, wavLabel) {
  await page.goto(`${WEB_URL}/#phone-raw`);
  await page.getByLabel('SBC WebSocket URL').fill(SBC_URL);
  await page.getByLabel('SIP realm').fill(SIP_REALM);
  await page.getByLabel('Application SID').fill(APP_SID);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(CLIENT_PASSWORD);
  await page.getByLabel('Room').fill(ROOM);
  await page.getByRole('button', { name: role, exact: true }).click();
  await page.getByRole('button', { name: 'Join room' }).click();
  await page.getByText('In the room as').waitFor({ state: 'visible' });
  console.log(`${username} (${wavLabel}) in room`);
}

const agent = await launch('agent.wav');
await joinPhone(agent, 'agent1', 'Agent', 'agent.wav');
const caller = await launch('caller.wav');
await joinPhone(caller, 'caller1', 'Caller', 'caller.wav');

const con = await launch('supervisor.wav');
await con.goto(`${WEB_URL}/#raw`);
await con.getByLabel('Base URL').fill(BASE_URL);
await con.getByLabel('Account SID').fill(ACCOUNT_SID);
await con.getByLabel('API key').fill(API_KEY);
await con.getByLabel('Username').fill('supervisor');
await con.getByLabel('Password').fill(CLIENT_PASSWORD);
await con.getByRole('button', { name: 'Connect' }).click();
await con.getByText('live calls').first().waitFor({ state: 'visible' });
await con.getByText(ROOM).first().waitFor({ state: 'visible' });
await con.getByText(ROOM).first().click();
console.log('console connected, room selected — turning transcript ON while IDLE');

await con.getByRole('button', { name: /^(Off|Turn on transcript)/ }).first().click();
await con.getByText('Transcribing').waitFor({ state: 'visible' });

for (let i = 1; i <= 9; i++) {
  await con.waitForTimeout(5000);
  const text = await con.locator('.rm-scroll').innerText().catch(() => '');
  console.log(`[${i * 5}s] transcript: ${text.replace(/\n+/g, ' | ').slice(0, 220) || '(empty)'}`);
}

for (const b of browsers) await b.close().catch(() => {});
