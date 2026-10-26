/** One account's usage as read from claude.ai by the browser extension. */
export interface UsageReport {
  email: string;
  orgId: string | null;
  orgName: string | null;
  plan: string | null;
  weekly: LimitReading | null;
  fable: LimitReading | null;
  products: { name: string; pct: number }[];
  device: string | null;
  capturedAt: string;
}

export interface LimitReading {
  pct: number;
  resetsAt: string | null;
}

export interface StoredReport extends UsageReport {
  receivedAt: string;
}

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : null;

const pct = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v * 10) / 10)) : null;

const iso = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

function limit(v: unknown): LimitReading | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const p = pct(o.pct);
  return p === null ? null : { pct: p, resetsAt: iso(o.resetsAt) };
}

/** Validates and normalizes an incoming report; returns null if it is unusable. */
export function parseReport(body: unknown): UsageReport | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const email = str(b.email, 200)?.toLowerCase() ?? null;
  const capturedAt = iso(b.capturedAt);
  if (!email || !email.includes('@') || !capturedAt) return null;
  const weekly = limit(b.weekly);
  const fable = limit(b.fable);
  if (!weekly && !fable) return null;
  const products = Array.isArray(b.products)
    ? b.products
        .slice(0, 10)
        .map((p) => ({ name: str((p as Record<string, unknown>)?.name, 40), pct: pct((p as Record<string, unknown>)?.pct) }))
        .filter((p): p is { name: string; pct: number } => p.name !== null && p.pct !== null)
    : [];
  return {
    email,
    orgId: str(b.orgId, 80),
    orgName: str(b.orgName, 80),
    plan: str(b.plan, 40),
    weekly,
    fable,
    products,
    device: str(b.device, 80),
    capturedAt,
  };
}
