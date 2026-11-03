// 暗号仕様は tools/vault/index.html と同一: PBKDF2-SHA256（既定60万回）→ AES-256-GCM
export const DEFAULTS = { url: 'https://desktop-8ern2im.tail0cdc77.ts.net', token: '', autoLockMin: 10 };
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64e = u8 => btoa(String.fromCharCode(...u8));

// 設定済みの金庫サーバー自身のオリジンか（金庫ページのマスターパスワード等を、保存提案や照合の対象にしない）
export function isVaultOrigin(origin, s) {
  try { return new URL(origin).origin === new URL(s.url).origin; } catch { return false; }
}
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

// ===================== フェーズ2：書き込み =====================
export const b64 = { e: b64e, d: b64d,
  ue: u8 => b64e(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  ud: s => b64d(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)) };

// 削除済み（墓標）も含めた全項目。書き込み時はこちらを使う（墓標を消すとWeb版の合流で項目が復活するため）
export async function decryptAll(rawB64, blob) {
  const key = await crypto.subtle.importKey('raw', b64d(rawB64), 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, key, b64d(blob.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
// Web版の seal() と同じ形：salt と iter は元の金庫のまま、iv だけ新しくする
export async function encryptItems(rawB64, blob, items) {
  const key = await crypto.subtle.importKey('raw', b64d(rawB64), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(items)));
  return { v: 1, iter: blob.iter, salt: blob.salt, iv: b64e(iv), data: b64e(new Uint8Array(ct)) };
}
// GET（最新）→ fn で変更 → PUT（If-Match）。409 なら取り直して fn をもう一度だけ適用
export async function mutateVault(s, rawB64, fn) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const v = await fetchVault(s);
    const items = await decryptAll(rawB64, v.blob);
    await fn(items, attempt);
    const blob = await encryptItems(rawB64, v.blob, items);
    const r = await fetch(s.url.replace(/\/+$/, '') + '/vault', { method: 'PUT', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + s.token, 'If-Match': String(v.version), 'Content-Type': 'application/json' }, body: JSON.stringify(blob) });
    if (r.ok) { const { version } = await r.json(); await chrome.storage.local.set({ cache: { version, blob } }); return { items, attempts: attempt + 1 }; }
    if (r.status !== 409) throw new Error('保存に失敗しました（' + r.status + '）');
  }
  throw new Error('別の端末と同時に更新されたため保存できませんでした。もう一度お試しください');
}

// ===================== フェーズ2：WebAuthn =====================
// rpId がページのオリジンで使ってよいものか（WebAuthn：rpId は有効ドメインそのもの、またはその登録ドメイン以上の上位）
export function rpIdValid(rpId, origin) {
  let u; try { u = new URL(origin); } catch { return false; }
  const h = u.hostname.toLowerCase(), r = String(rpId || '').toLowerCase();
  if (!(u.protocol === 'https:' || (u.protocol === 'http:' && h === 'localhost'))) return false;
  if (!r || /^[\d.]+$/.test(h) || h.includes(':')) return false; // IPアドレスは対象外
  if (r === h) return true;
  if (!h.endsWith('.' + r)) return false;
  const b = baseDomain(h);
  return r === b || r.endsWith('.' + b); // 公開サフィックス（co.jp 等）単体は不可
}
const cat = (...a) => { const n = a.reduce((x, y) => x + y.length, 0), o = new Uint8Array(n); let k = 0; for (const p of a) { o.set(p, k); k += p.length; } return o; };
const sha256 = async u8 => new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
const utf8 = s => new TextEncoder().encode(s);
// 最小のCBORエンコーダ（正の整数・負の整数・バイト列・文字列・配列・Map）
export function cbor(v) {
  const head = (mt, n) => n < 24 ? [mt << 5 | n] : n < 256 ? [mt << 5 | 24, n] : n < 65536 ? [mt << 5 | 25, n >> 8, n & 255] : [mt << 5 | 26, n >>> 24, n >> 16 & 255, n >> 8 & 255, n & 255];
  const enc = x => {
    if (typeof x === 'number') return new Uint8Array(x >= 0 ? head(0, x) : head(1, -1 - x));
    if (x instanceof Uint8Array) return cat(new Uint8Array(head(2, x.length)), x);
    if (typeof x === 'string') { const b = utf8(x); return cat(new Uint8Array(head(3, b.length)), b); }
    if (Array.isArray(x)) return cat(new Uint8Array(head(4, x.length)), ...x.map(enc));
    if (x instanceof Map) return cat(new Uint8Array(head(5, x.size)), ...[...x].flatMap(([k, val]) => [enc(k), enc(val)]));
    throw new Error('cbor: unsupported');
  };
  return enc(v);
}
// WebCrypto の署名（r||s 64バイト）→ WebAuthn が求める ASN.1 DER
export function rawToDer(sig) {
  const int = b => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; b = b.slice(i); return b[0] & 0x80 ? cat(new Uint8Array([0]), b) : b; };
  const r = int(sig.slice(0, 32)), s = int(sig.slice(32));
  return cat(new Uint8Array([0x30, r.length + s.length + 4, 0x02, r.length]), r, new Uint8Array([0x02, s.length]), s);
}
// フラグ：UP=0x01（ユーザーの承認）, UV=0x04（金庫の解錠を根拠に設定）, BE=0x08/BS=0x10（同期型）, AT=0x40
const FLAGS_CREATE = 0x5D, FLAGS_GET = 0x1D;

export async function makePasskey({ rpId, rpName, origin, challenge, userId, userName, userDisplayName }) {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
  const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
  const credId = crypto.getRandomValues(new Uint8Array(32));
  const cose = cbor(new Map([[1, 2], [3, -7], [-1, 1], [-2, rawPub.slice(1, 33)], [-3, rawPub.slice(33, 65)]]));
  const authData = cat(await sha256(utf8(rpId)), new Uint8Array([FLAGS_CREATE, 0, 0, 0, 0]), new Uint8Array(16),
    new Uint8Array([credId.length >> 8, credId.length & 255]), credId, cose);
  const clientDataJSON = utf8(JSON.stringify({ type: 'webauthn.create', challenge, origin, crossOrigin: false }));
  const attestationObject = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
  const now = Date.now();
  const item = { id: crypto.randomUUID(), kind: 'passkey', title: rpName || rpId, rpId, credentialId: b64.ue(credId),
    privateKey: b64e(pkcs8), publicKey: b64e(spki), userHandle: b64e(b64.ud(userId)), userName: userName || '', userDisplayName: userDisplayName || '',
    created: now, mt: now };
  const response = { id: item.credentialId, clientDataJSON: b64.ue(clientDataJSON), attestationObject: b64.ue(attestationObject),
    authData: b64.ue(authData), publicKey: b64.ue(spki) };
  return { item, response };
}
export async function signPasskey(item, { origin, challenge }) {
  const key = await crypto.subtle.importKey('pkcs8', b64d(item.privateKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const authData = cat(await sha256(utf8(item.rpId)), new Uint8Array([FLAGS_GET, 0, 0, 0, 0]));
  const clientDataJSON = utf8(JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, cat(authData, await sha256(clientDataJSON))));
  return { id: item.credentialId, authData: b64.ue(authData), clientDataJSON: b64.ue(clientDataJSON), signature: b64.ue(rawToDer(sig)),
    userHandle: item.userHandle ? b64.ue(b64d(item.userHandle)) : null };
}
