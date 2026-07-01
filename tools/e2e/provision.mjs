#!/usr/bin/env node
/**
 * Idempotent provisioning for the room-monitor closed-loop test system.
 * Ensures on the target account:
 *   - application "room-monitor" → ws://127.0.0.1:4002/supervisor
 *   - webrtc clients: supervisor / agent1 / caller1
 *
 * Env: BASE_URL (e.g. https://eu.jambonz.io/api), ACCOUNT_SID, API_KEY,
 *      CLIENT_PASSWORD (used for all three test clients),
 *      APP_WS_URL (default ws://127.0.0.1:4002/supervisor)
 */
const BASE_URL = (process.env.BASE_URL ?? '').replace(/\/+$/, '');
const ACCOUNT_SID = process.env.ACCOUNT_SID ?? '';
const API_KEY = process.env.API_KEY ?? '';
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD ?? '';
const APP_WS_URL = process.env.APP_WS_URL ?? 'ws://127.0.0.1:4002/supervisor';
const APP_NAME = process.env.MONITOR_APP_NAME ?? 'room-monitor';

if (!BASE_URL || !ACCOUNT_SID || !API_KEY || !CLIENT_PASSWORD) {
  console.error('need BASE_URL, ACCOUNT_SID, API_KEY, CLIENT_PASSWORD');
  process.exit(1);
}

const api = async (method, path, body) => {
  const res = await fetch(`${BASE_URL}/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* raw */ }
  return { status: res.status, json, text };
};

// --- application ------------------------------------------------------------
const apps = await api('GET', `/Accounts/${ACCOUNT_SID}/Applications`);
if (apps.status !== 200) { console.error('list applications failed', apps.status, apps.text); process.exit(1); }
let app = apps.json.find((a) => a.name === APP_NAME);
if (app) {
  console.log(`application "${APP_NAME}" exists: ${app.application_sid}`);
} else {
  const created = await api('POST', `/Accounts/${ACCOUNT_SID}/Applications`, {
    name: APP_NAME,
    account_sid: ACCOUNT_SID,
    call_hook: { url: APP_WS_URL, method: 'POST' },
    call_status_hook: { url: APP_WS_URL, method: 'POST' },
  });
  if (created.status !== 201) { console.error('create application failed', created.status, created.text); process.exit(1); }
  app = { application_sid: created.json.sid };
  console.log(`application "${APP_NAME}" created: ${app.application_sid}`);
}

// --- clients ----------------------------------------------------------------
const clients = await api('GET', `/Accounts/${ACCOUNT_SID}/Clients`);
if (clients.status !== 200) { console.error('list clients failed', clients.status, clients.text); process.exit(1); }
for (const username of ['supervisor', 'agent1', 'caller1']) {
  const existing = (clients.json ?? []).find((c) => c.username === username);
  if (existing) {
    console.log(`client "${username}" exists`);
    continue;
  }
  const created = await api('POST', `/Accounts/${ACCOUNT_SID}/Clients`, {
    account_sid: ACCOUNT_SID,
    username,
    password: CLIENT_PASSWORD,
    is_active: 1,
    allow_direct_app_calling: 1,
  });
  if (created.status !== 201) { console.error(`create client ${username} failed`, created.status, created.text); process.exit(1); }
  console.log(`client "${username}" created`);
}

console.log('\nprovisioning complete');
console.log(`APP_SID=${app.application_sid}`);
