import { findEmail, parseUsage, planOf, skeleton } from './parse.js';

const CLAUDE = 'https://claude.ai';
const EVERY_MINUTES = 120;

/** Pairing code from Didebaan: "DBN1." + base64url(JSON { u: url, k: key }). */
export function decodePairing(code) {
  const m = /^DBN1\.([A-Za-z0-9_-]+)$/.exec(String(code).trim());
  if (!m) return null;
  try {
    const json = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof json.u === 'string' && /^https:\/\/[^/]+\.workers\.dev\/?$/.test(json.u) && typeof json.k === 'string') {
      return { url: json.u.replace(/\/$/, ''), key: json.k };
    }
  } catch {
    // fall through
  }
  return null;
}

async function getJSON(path) {
  const res = await fetch(`${CLAUDE}${path}`, { credentials: 'include', headers: { Accept: 'application/json' } });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('not-logged-in'), { code: 'not-logged-in' });
  if (!res.ok) throw new Error(`claude.ai ${path}: HTTP ${res.status}`);
  return res.json();
}

async function send(config, report) {
  const res = await fetch(`${config.url}/v1/usage`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
  if (!res.ok) throw new Error(`sync server: HTTP ${res.status} ${await res.text()}`);
}

async function setStatus(status) {
  await chrome.storage.local.set({ status: { ...status, at: new Date().toISOString() } });
}

function defaultDevice() {
  const p = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  return p.includes('mac') ? 'Mac' : p.includes('win') ? 'Windows' : p.includes('linux') ? 'Linux' : 'Browser';
}

/** Reads every organization's usage from claude.ai and posts one report per organization. */
export async function poll() {
  const { config, device, page, billing } = await chrome.storage.local.get(['config', 'device', 'page', 'billing']);
  if (!config) return setStatus({ state: 'not-paired' });
  try {
    const orgs = await getJSON('/api/organizations');
    const account = await getJSON('/api/account').catch(() => null);
    const email = findEmail(account) ?? findEmail(orgs);
    if (!email) throw new Error('could not find the account email on claude.ai');
    const debug = { account: skeleton(account), organizations: skeleton(orgs), usage: {} };
    const sent = [];
    for (const org of Array.isArray(orgs) ? orgs : []) {
      if (!org?.uuid) continue;
      let usage;
      try {
        usage = await getJSON(`/api/organizations/${org.uuid}/usage`);
      } catch (e) {
        debug.usage[org.uuid] = String(e);
        continue;
      }
      debug.usage[org.uuid] = skeleton(usage);
      const reading = parseUsage(usage);
      // The usage page itself has the per-product breakdown; use it if it was opened recently.
      const fromPage = page && Date.now() - Date.parse(page.at) < 3 * 60 * 60 * 1000 ? page.reading : null;
      const report = {
        email,
        orgId: org.uuid,
        orgName: typeof org.name === 'string' ? org.name : null,
        plan: planOf(org),
        weekly: reading.weekly ?? fromPage?.weekly ?? null,
        fable: reading.fable ?? fromPage?.fable ?? null,
        products: reading.products.length ? reading.products : (fromPage?.products ?? []),
        renewal: billing?.renewal ?? null,
        device: device || defaultDevice(),
        capturedAt: new Date().toISOString(),
      };
      if (!report.weekly && !report.fable) continue;
      await send(config, report);
      sent.push(report);
    }
    await chrome.storage.local.set({ debug, email });
    if (sent.length === 0) throw new Error('claude.ai answered, but no usage numbers were found (see Troubleshooting)');
    await setStatus({ state: 'ok', reports: sent });
  } catch (e) {
    await setStatus({ state: e.code === 'not-logged-in' ? 'not-logged-in' : 'error', error: String(e.message || e) });
  }
}

/** The usage page was opened: its text is the most complete source, so send it right away. */
async function fromPage(reading) {
  await chrome.storage.local.set({ page: { at: new Date().toISOString(), reading } });
  const { config, device, email, billing } = await chrome.storage.local.get(['config', 'device', 'email', 'billing']);
  if (!config || !email || (!reading.weekly && !reading.fable)) return poll();
  try {
    const report = {
      email,
      orgId: null,
      orgName: null,
      plan: null,
      ...reading,
      renewal: billing?.renewal ?? null,
      device: device || defaultDevice(),
      capturedAt: new Date().toISOString(),
    };
    await send(config, report);
    await setStatus({ state: 'ok', reports: [report] });
  } catch (e) {
    await setStatus({ state: 'error', error: String(e.message || e) });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('poll', { periodInMinutes: EVERY_MINUTES, delayInMinutes: 1 });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('poll', { periodInMinutes: EVERY_MINUTES, delayInMinutes: 1 });
});
chrome.alarms.onAlarm.addListener((a) => a.name === 'poll' && poll());

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'pair') {
    const config = decodePairing(msg.code);
    if (!config) {
      reply({ ok: false });
      return false;
    }
    chrome.storage.local.set({ config }).then(() => poll()).then(() => reply({ ok: true }));
    return true;
  }
  if (msg?.type === 'unpair') {
    chrome.storage.local.remove(['config', 'status']).then(() => reply({ ok: true }));
    return true;
  }
  if (msg?.type === 'poll') {
    poll().then(() => reply({ ok: true }));
    return true;
  }
  if (msg?.type === 'page-usage') {
    fromPage(msg.reading);
  }
  if (msg?.type === 'page-billing') {
    // The Billing page has no usage numbers, so keep the date and send it with a fresh reading.
    chrome.storage.local.set({ billing: { at: new Date().toISOString(), renewal: msg.renewal } }).then(() => poll());
  }
  return false;
});
