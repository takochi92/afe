// 暗号仕様は tools/vault/index.html と同一: PBKDF2-SHA256（既定60万回）→ AES-256-GCM
export const DEFAULTS = { url: 'https://desktop-8ern2im.tail0cdc77.ts.net', token: '', autoLockMin: 10 };
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64e = u8 => btoa(String.fromCharCode(...u8));

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...settings };
}

// ---- サーバー（読み取り専用。PUTはしない）----
export async function fetchVault(s) {
  const r = await fetch(s.url.replace(/\/+$/, '') + '/vault', { headers: { Authorization: 'Bearer ' + s.token }, cache: 'no-store' });
  if (r.status === 401) throw new Error('同期トークンが違います（401）');
  if (r.status === 404) throw new Error('サーバーに金庫がありません。先にWeb版で作成してください');
  if (!r.ok) throw new Error('サーバーエラー（' + r.status + '）');
  return r.json(); // { version, blob:{v,iter,salt,iv,data} }
}
// 取得に失敗したら端末内のキャッシュ（暗号文のまま）を使う
export async function getVault(s) {
  try {
    const v = await fetchVault(s);
    await chrome.storage.local.set({ cache: v });
    return { ...v, offline: false };
  } catch (e) {
    const { cache } = await chrome.storage.local.get('cache');
    if (cache && !/401|金庫がありません/.test(e.message)) return { ...cache, offline: true };
    throw e;
  }
}

// ---- 暗号 ----
export async function deriveRaw(password, blob) {
  const iter = Number(blob.iter) || 600000;
  if (iter < 100000 || iter > 5000000) throw new Error('金庫データの形式が不正です');
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64d(blob.salt), iterations: iter, hash: 'SHA-256' }, base, 256);
  return b64e(new Uint8Array(bits));
}
export async function decryptItems(rawB64, blob) {
  const key = await crypto.subtle.importKey('raw', b64d(rawB64), 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, key, b64d(blob.data));
  return JSON.parse(new TextDecoder().decode(pt)).filter(i => !i.del);
}

// ---- 解錠状態：chrome.storage.session（ディスクに書かれない・ブラウザ終了で消える）----
export async function getSession() {
  const { unlock } = await chrome.storage.session.get('unlock');
  if (!unlock) return null;
  if (Date.now() > unlock.exp) { await lock(); return null; }
  return unlock;
}
export async function startSession(raw, autoLockMin) {
  const exp = Date.now() + Math.max(1, autoLockMin) * 60000;
  await chrome.storage.session.set({ unlock: { raw, exp } });
  await chrome.alarms.create('autolock', { when: exp });
}
export async function lock() {
  await chrome.storage.session.remove('unlock');
  await chrome.alarms.clear('autolock');
}

// ---- URL照合 ----
const SLD = new Set(['co', 'ne', 'or', 'ac', 'go', 'ad', 'ed', 'gr', 'lg', 'com', 'net', 'org', 'gov', 'edu']);
const SHARED = new Set(['github.io', 'vercel.app', 'netlify.app', 'pages.dev', 'web.app', 'herokuapp.com', 'blogspot.com', 'workers.dev']);
export function hostOf(u) {
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : 'https://' + u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}
export function baseDomain(h) {
  if (!h || /^[\d.]+$/.test(h) || h.includes(':')) return h;
  const p = h.split('.'); if (p.length <= 2) return h;
  const l2 = p.slice(-2);
  if ((l2[1].length === 2 && SLD.has(l2[0])) || SHARED.has(l2.join('.'))) return p.slice(-3).join('.');
  return l2.join('.');
}
// 完全一致 → 同じ登録ドメイン の順
export function matchItems(items, tabUrl) {
  let u; try { u = new URL(tabUrl); } catch { return []; }
  if (!/^https?:$/.test(u.protocol)) return [];
  const th = u.hostname.toLowerCase().replace(/^www\./, ''), tb = baseDomain(th);
  const rank = i => { const h = hostOf(i.url || ''); if (!h) return 0; if (h === th) return 2; return baseDomain(h) === tb ? 1 : 0; };
  return items.map(i => [rank(i), i]).filter(x => x[0]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
}
// 入力してよいページか（https、または開発用のlocalhost）
export function fillAllowed(tabUrl) {
  try { const u = new URL(tabUrl); return u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)); } catch { return false; }
}
