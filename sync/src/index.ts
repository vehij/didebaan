import { parseReport, type StoredReport } from './report';

/** The subset of the Workers KV API this worker uses. */
interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { metadata?: unknown }): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{
    keys: { name: string; metadata?: unknown }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

interface Env {
  DATA: KV;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

/**
 * Data is partitioned by a hash of the sync key, so the worker needs no configured secret:
 * whoever holds a key can read and write only that key's space.
 */
async function tenantOf(request: Request): Promise<string | null> {
  const key = /^Bearer\s+([A-Za-z0-9_-]{32,128})$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!key) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const MAX_BODY = 8 * 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (pathname === '/' && request.method === 'GET') return json({ service: 'didebaan-sync', ok: true });
    if (pathname !== '/v1/usage') return json({ error: 'not found' }, 404);

    const tenant = await tenantOf(request);
    if (!tenant) return json({ error: 'missing or malformed sync key' }, 401);
    const prefix = `t:${tenant}:u:`;

    if (request.method === 'POST') {
      const text = await request.text();
      if (text.length > MAX_BODY) return json({ error: 'report too large' }, 413);
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return json({ error: 'invalid JSON' }, 400);
      }
      const report = parseReport(body);
      if (!report) return json({ error: 'invalid report' }, 400);
      const stored: StoredReport = { ...report, receivedAt: new Date().toISOString() };
      const key = `${prefix}${report.email}:${report.orgId ?? 'default'}`;
      const value = JSON.stringify(stored);
      // Small reports ride along as list metadata (1 KB limit), so reading them back is a single list call.
      await env.DATA.put(key, value, value.length <= 1000 ? { metadata: stored } : undefined);
      return json({ ok: true, receivedAt: stored.receivedAt });
    }

    if (request.method === 'GET') {
      const reports: StoredReport[] = [];
      let cursor: string | undefined;
      do {
        const page = await env.DATA.list({ prefix, cursor });
        for (const k of page.keys) {
          if (k.metadata) reports.push(k.metadata as StoredReport);
          else {
            const v = await env.DATA.get(k.name);
            if (v) reports.push(JSON.parse(v) as StoredReport);
          }
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return json({ reports });
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
