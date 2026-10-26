const $ = (id) => document.getElementById(id);

const ago = (iso) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'همین الان';
  if (min < 60) return `${min} دقیقه پیش`;
  return `${Math.round(min / 60)} ساعت پیش`;
};

const DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
const pad = (n) => String(n).padStart(2, '0');

function resetText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `ریست ${DAYS[d.getDay()]} <span class="mono">${pad(d.getHours())}:${pad(d.getMinutes())}</span>`;
}

function bar(label, reading, color) {
  if (!reading) return '';
  return `<div class="line"><span>${label}</span><span class="mono">${reading.pct}%</span></div>
    <div class="bar"><span style="width:${Math.min(100, reading.pct)}%;background:${color}"></span></div>
    <div class="line muted">${resetText(reading.resetsAt)}</div>`;
}

function renewalLine(renewal) {
  if (!renewal) return '<div class="line muted">تاریخ تمدید: صفحه‌ی Billing را یک بار باز کن</div>';
  return `<div class="line"><span>${renewal.autoRenew ? 'تمدید خودکار' : 'پایان اشتراک'}</span><span class="mono">${renewal.date.replaceAll('-', '/')}</span></div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function render() {
  const { config, status, device, debug } = await chrome.storage.local.get(['config', 'status', 'device', 'debug']);
  $('pair').hidden = !!config;
  $('main').hidden = !config;
  $('device').value = device ?? '';
  $('debug').value = debug ? JSON.stringify({ status, ...debug }, null, 2) : 'هنوز چیزی خوانده نشده.';
  const state = !config ? 'وصل نیست' : status?.state === 'ok' ? 'وصل و فعال' : status?.state === 'not-logged-in' ? 'منتظر ورود به claude.ai' : status?.state === 'error' ? 'خطا' : 'در انتظار اولین همگام‌سازی';
  $('state').textContent = state;
  $('login').hidden = status?.state !== 'not-logged-in';
  $('error').hidden = status?.state !== 'error';
  $('error').textContent = status?.error ?? '';
  $('last').textContent = status?.at ? `آخرین تلاش: ${ago(status.at)} · هر ۲ ساعت خودکار` : '';
  $('reports').innerHTML = (status?.state === 'ok' ? status.reports : [])
    .map(
      (r) => `<div class="card">
        <div class="who"><span class="mono">${escapeHtml(r.email)}</span><span class="muted">${escapeHtml(r.plan ?? '')}</span></div>
        ${bar('لیمیت هفتگی کل', r.weekly, 'var(--total)')}
        ${bar('Fable', r.fable, 'var(--fable)')}
        ${renewalLine(r.renewal)}
      </div>`,
    )
    .join('');
}

$('connect').addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'pair', code: $('code').value });
  $('pair-error').hidden = !!res?.ok;
  render();
});
$('sync').addEventListener('click', async () => {
  $('sync').disabled = true;
  $('sync').textContent = 'در حال همگام‌سازی…';
  await chrome.runtime.sendMessage({ type: 'poll' });
  $('sync').disabled = false;
  $('sync').textContent = 'همگام‌سازی الان';
  render();
});
$('device').addEventListener('change', () => chrome.storage.local.set({ device: $('device').value.trim() }));
$('unpair').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'unpair' });
  render();
});
$('version').textContent = `نسخه‌ی ${chrome.runtime.getManifest().version}`;
chrome.storage.onChanged.addListener(render);
render();
