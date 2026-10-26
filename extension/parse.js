// Pure helpers that turn claude.ai responses and page text into a usage reading.
// claude.ai has no documented usage API, so everything here is defensive: unknown shapes yield nulls.

const PRODUCT_NAMES = { claude_code: 'Claude Code', code: 'Claude Code', chat: 'Chats', chats: 'Chats', cowork: 'Cowork', other: 'Other' };

export function prettyProduct(name) {
  const key = String(name).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return PRODUCT_NAMES[key] ?? String(name).trim();
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function readingOf(v) {
  if (!isObj(v)) return null;
  const raw = v.utilization ?? v.used_percentage ?? v.usedPercentage ?? v.percent ?? v.percentage;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const resets = v.resets_at ?? v.resetsAt ?? v.reset_at ?? null;
  return { pct: Math.max(0, Math.min(100, Math.round(raw * 10) / 10)), resetsAt: typeof resets === 'string' ? resets : null };
}

/** First string that looks like an email, preferring keys with "email" in their name. */
export function findEmail(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return null;
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value);
  for (const [k, v] of entries) {
    if (/email/i.test(k) && typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return v.toLowerCase();
  }
  for (const [, v] of entries) {
    const found = findEmail(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function productsOf(value, depth = 0) {
  if (depth > 3 || value === null || typeof value !== 'object') return [];
  for (const [k, raw] of Object.entries(value)) {
    if (!/product|breakdown/i.test(k)) continue;
    // e.g. seven_day_breakdown: { rows: [{ display_name, key, percent }], as_of, … }
    const v = isObj(raw) && Array.isArray(raw.rows) ? raw.rows : raw;
    if (Array.isArray(v)) {
      const list = v
        .map((p) =>
          isObj(p)
            ? { name: p.display_name ?? p.name ?? p.product ?? p.label ?? p.key, pct: p.percent ?? p.pct ?? p.percentage ?? p.share ?? p.utilization }
            : null,
        )
        .filter((p) => p && p.name != null && typeof p.pct === 'number');
      if (list.length) return list.map((p) => ({ name: prettyProduct(p.name), pct: Math.round(p.pct) }));
    } else if (isObj(v)) {
      const list = Object.entries(v)
        .map(([name, p]) => ({ name, pct: typeof p === 'number' ? p : readingOf(p)?.pct }))
        .filter((p) => typeof p.pct === 'number');
      if (list.length) return list.map((p) => ({ name: prettyProduct(p.name), pct: Math.round(p.pct) }));
    }
  }
  for (const v of Object.values(value)) {
    const found = productsOf(v, depth + 1);
    if (found.length) return found;
  }
  return [];
}

/**
 * `limits` lists every limit shown on the Usage page; a model's own weekly limit (Fable) is the
 * entry scoped to a model: { percent, resets_at, scope: { model: { display_name } } }.
 */
function modelLimitOf(limits) {
  if (!Array.isArray(limits)) return null;
  const scoped = limits.filter((l) => isObj(l) && isObj(l.scope) && isObj(l.scope.model) && typeof l.percent === 'number');
  const pick = scoped.find((l) => /fable/i.test(String(l.scope.model.display_name ?? ''))) ?? scoped[0];
  return pick ? readingOf(pick) : null;
}

/** Reads the weekly, Fable and per-product numbers out of an organization usage response. */
export function parseUsage(usage) {
  if (!isObj(usage)) return { weekly: null, fable: null, products: [] };
  const weekly = readingOf(usage.seven_day ?? usage.weekly ?? usage.week);
  let fable = modelLimitOf(usage.limits);
  for (const [k, v] of Object.entries(usage)) {
    if (!fable && /fable/i.test(k)) fable = readingOf(v);
  }
  if (!fable) {
    // A model-specific weekly window named after another model, e.g. seven_day_opus.
    for (const [k, v] of Object.entries(usage)) {
      if (/^seven_day_(?!oauth|cowork|claude_code|chat)/.test(k) && readingOf(v)) {
        fable = readingOf(v);
        break;
      }
    }
  }
  return { weekly, fable, products: productsOf(usage) };
}

export function planOf(org) {
  if (!isObj(org)) return null;
  const tier = String(org.rate_limit_tier ?? '').toLowerCase();
  const m = /max_(\d+)x/.exec(tier);
  if (m) return `Max ${m[1]}x`;
  const caps = (Array.isArray(org.capabilities) ? org.capabilities : []).join(' ').toLowerCase();
  if (/enterprise/.test(caps + tier)) return 'Enterprise';
  if (/team|raven/.test(caps + tier)) return 'Team';
  if (/max/.test(caps)) return 'Max';
  if (/pro/.test(caps + tier)) return 'Pro';
  return null;
}

/** Replaces values with their type so a response can be shared for debugging without personal data. */
export function skeleton(value, depth = 0) {
  if (depth > 5) return '…';
  if (Array.isArray(value)) return value.slice(0, 3).map((v) => skeleton(v, depth + 1));
  if (isObj(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, skeleton(v, depth + 1)]));
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  return typeof value;
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** "Thursday 9:30 PM" or "at 1:20 PM" → the next such moment after `now`, as ISO. */
export function resetTextToIso(text, now = new Date()) {
  const m = /(?:(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+)?(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(text);
  if (!m) return null;
  let h = Number(m[2]) % 12;
  if ((m[4] ?? '').toLowerCase() === 'pm') h += 12;
  if (!m[4]) h = Number(m[2]);
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setHours(h, Number(m[3]));
  if (m[1]) {
    const diff = (DAYS.indexOf(m[1].toLowerCase()) - now.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    if (d <= now) d.setDate(d.getDate() + 7);
  } else if (d <= now) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString();
}

/** Reads the Settings › Usage page's visible text (one entry per line). */
export function parseUsagePage(lines, now = new Date()) {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  // Titles may share a line with their subtitle ("Fable Up to 50% of your weekly limit"),
  // and "This week" must not match "This week's usage by product".
  const block = (title) => {
    const i = clean.findIndex((l) => title.test(l));
    if (i < 0) return null;
    let pct = null;
    let resetsAt = null;
    for (const l of clean.slice(i, i + 6)) {
      const p = /(\d+(?:\.\d+)?)%\s*used/i.exec(l);
      if (p && pct === null) pct = Number(p[1]);
      if (/^resets\s/i.test(l) && !resetsAt) resetsAt = resetTextToIso(l, now);
    }
    return pct === null ? null : { pct, resetsAt };
  };
  const products = [];
  const start = clean.findIndex((l) => /usage by product/i.test(l));
  if (start >= 0) {
    for (let i = start + 1; i + 1 < clean.length && products.length < 8; i += 2) {
      const p = /^(\d+(?:\.\d+)?)%$/.exec(clean[i + 1]);
      if (!p) break;
      products.push({ name: prettyProduct(clean[i]), pct: Math.round(Number(p[1])) });
    }
  }
  return { weekly: block(/^this week(?![’']s)\b/i), fable: block(/^fable\b/i), products };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "Nov 14, 2026" or "November 14 2026" → "2026-11-14". */
export function parseEnglishDate(text) {
  const m = /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(text);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  const day = Number(m[2]);
  if (month < 0 || day < 1 || day > 31) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Reads the Settings › Billing page text. Only the subscription's next date is taken —
 * never card details, amounts or invoices.
 */
export function parseBillingPage(text) {
  const renew = /(?:auto[-\s]?renew|renews?)\s+on\s+([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})/i.exec(text);
  if (renew) {
    const date = parseEnglishDate(renew[1]);
    if (date) return { date, autoRenew: true };
  }
  const ends = /(?:will\s+(?:end|expire|be\s+cancell?ed)|ends|expires|access\s+until)\s+on\s+([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})/i.exec(text);
  if (ends) {
    const date = parseEnglishDate(ends[1]);
    if (date) return { date, autoRenew: false };
  }
  return null;
}
