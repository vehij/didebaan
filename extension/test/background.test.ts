import { beforeEach, describe, expect, it, vi } from 'vitest';

// A minimal stand-in for the chrome.* APIs the background script uses.
const store: Record<string, unknown> = {};
const chromeMock = {
  storage: {
    local: {
      get: async (keys: string[]) => Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]])),
      set: async (obj: Record<string, unknown>) => Object.assign(store, obj),
      remove: async (keys: string[]) => keys.forEach((k) => delete store[k]),
    },
  },
  alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
  runtime: { onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() } },
};
vi.stubGlobal('chrome', chromeMock);

const posted: { url: string; auth: string; body: Record<string, unknown> }[] = [];
const claude: Record<string, unknown> = {
  '/api/organizations': [{ uuid: 'org-1', name: 'Personal', rate_limit_tier: 'default_claude_max_20x' }],
  '/api/account': { email_address: 'Main.Max@example.com' },
  '/api/organizations/org-1/usage': {
    five_hour: { utilization: 11, resets_at: '2026-10-26T13:20:00Z' },
    seven_day: { utilization: 79, resets_at: '2026-10-29T18:00:00Z' },
    seven_day_fable: { utilization: 75, resets_at: '2026-10-29T18:00:00Z' },
  },
};
vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
  if (url.startsWith('https://claude.ai')) {
    const body = claude[new URL(url).pathname];
    if (body === 'unauthorized') return new Response('', { status: 403 });
    return body === undefined ? new Response('', { status: 404 }) : Response.json(body);
  }
  posted.push({ url, auth: String((init?.headers as Record<string, string>).Authorization), body: JSON.parse(String(init?.body)) });
  return Response.json({ ok: true });
});

// @ts-expect-error plain JS module shipped as-is in the extension
const { poll, decodePairing } = await import('../background.js');

const code = (u: string, k: string) => 'DBN1.' + Buffer.from(JSON.stringify({ u, k })).toString('base64url');

describe('pairing codes', () => {
  it('accepts Didebaan codes for a workers.dev URL only', () => {
    expect(decodePairing(code('https://didebaan-sync.me.workers.dev', 'k'.repeat(43)))).toEqual({ url: 'https://didebaan-sync.me.workers.dev', key: 'k'.repeat(43) });
    expect(decodePairing(code('https://evil.example.com', 'k'))).toBeNull();
    expect(decodePairing('hello')).toBeNull();
  });
});

describe('poll', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    posted.length = 0;
  });

  it('does nothing until paired', async () => {
    await poll();
    expect((store.status as { state: string }).state).toBe('not-paired');
    expect(posted).toHaveLength(0);
  });

  it('sends one report per organization with both weekly limits', async () => {
    store.config = { url: 'https://didebaan-sync.me.workers.dev', key: 'secret-key' };
    store.device = 'MacBook Air';
    await poll();
    expect(posted).toHaveLength(1);
    expect(posted[0].url).toBe('https://didebaan-sync.me.workers.dev/v1/usage');
    expect(posted[0].auth).toBe('Bearer secret-key');
    expect(posted[0].body).toMatchObject({
      email: 'main.max@example.com',
      plan: 'Max 20x',
      device: 'MacBook Air',
      weekly: { pct: 79 },
      fable: { pct: 75 },
    });
    expect((store.status as { state: string }).state).toBe('ok');
  });

  it('reports when the browser is not logged in to claude.ai', async () => {
    store.config = { url: 'https://didebaan-sync.me.workers.dev', key: 'secret-key' };
    const saved = claude['/api/organizations'];
    claude['/api/organizations'] = 'unauthorized';
    await poll();
    claude['/api/organizations'] = saved;
    expect((store.status as { state: string }).state).toBe('not-logged-in');
  });
});
