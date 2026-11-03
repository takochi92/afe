// 背景処理（service worker）。復号・署名・保存はここだけで行い、秘密鍵や復号した項目はページ側に渡さない。
// 通信先は設定された金庫サーバーのみ。
import * as L from './lib.js';

chrome.alarms.onAlarm.addListener(a => { if (a.name === 'autolock') chrome.storage.session.remove('unlock'); });

const PENDING_TTL = 60 * 60 * 1000, USER_TTL = 10 * 60 * 1000;
// 拡張自身のページ（ポップアップ等）か、Webページの content script（最上位フレーム）かを、送信元URLで判定する
const isPopup = s => s.id === chrome.runtime.id && (s.url || '').startsWith(chrome.runtime.getURL(''));
const isPage = s => s.id === chrome.runtime.id && !isPopup(s) && !!s.tab && s.frameId === 0;
const originOf = s => s.origin || new URL(s.url).origin; // 送信元のオリジンはChromeが付けたものだけを信用する
const err = e => ({ ok: false, error: e && e.message || String(e) });

async function unlocked() { return L.getSession(); }
async function touch(ses, s) { await L.startSession(ses.raw, s.autoLockMin); } // 操作したら自動ロックを延長
async function liveItems(ses, s) { const v = await L.getVault(s); return L.decryptAll(ses.raw, v.blob); }

// ---- 保留キュー（chrome.storage.session：メモリ上のみ・ブラウザ終了で消える）----
async function getQueue() {
  const { pending = [] } = await chrome.storage.session.get('pending');
  const now = Date.now(), q = pending.filter(p => now - p.at < PENDING_TTL);
  if (q.length !== pending.length) await chrome.storage.session.set({ pending: q });
  return q;
}
const setQueue = pending => chrome.storage.session.set({ pending });
const sameLogin = p => i => !i.del && i.kind !== 'passkey' && L.hostOf(i.url || '') === p.host && (i.user || '') === (p.user || '');
function modeFor(items, p) { const ex = items.find(sameLogin(p)); return !ex ? 'new' : ex.pass === p.pass ? 'same' : 'update'; }

async function capture(msg, sender) {
  const origin = originOf(sender), s = await L.getSettings();
  if (!L.fillAllowed(origin) || L.isVaultOrigin(origin, s)) return { ok: false }; // 金庫サーバー自身のページは対象外
  const pass = String(msg.pass || ''); let user = String(msg.user || '').trim();
  if (!pass) return { ok: false }; // 空のパスワードは保存しない
  if (!user) { // 2段階ログイン：直前にユーザー名だけ送信していれば使う
    const { lastUser = {} } = await chrome.storage.session.get('lastUser');
    const lu = lastUser[origin]; if (lu && Date.now() - lu.at < USER_TTL) user = lu.user;
  }
  const p = { pid: crypto.randomUUID(), origin, host: L.hostOf(origin), user, pass, at: Date.now() };
  const ses = await unlocked();
  let mode = 'new';
  if (ses) { try { mode = modeFor(await liveItems(ses, s), p); } catch { } }
  if (mode === 'same') return { ok: true, same: true };
  const q = (await getQueue()).filter(x => !(x.origin === origin && x.user === user)); // 同じアカウントの古い提案は置き換え
  q.push(p); await setQueue(q);
  return ses ? { ok: true, pid: p.pid, mode, host: p.host, user } : { ok: true, locked: true };
}
async function pendingList(ses, s, filter) {
  let q = (await getQueue()).filter(p => !L.isVaultOrigin(p.origin, s)); if (filter) q = q.filter(filter);
  if (!ses) return { locked: true, count: q.length };
  let items = []; try { items = await liveItems(ses, s); } catch { }
  const out = [], drop = new Set();
  for (const p of q) { const m = modeFor(items, p); if (m === 'same') drop.add(p.pid); else out.push({ pid: p.pid, host: p.host, user: p.user, mode: m }); }
  if (drop.size) await setQueue((await getQueue()).filter(p => !drop.has(p.pid)));
  return { items: out };
}
async function resolve(msg, sender) {
  const q = await getQueue(), p = q.find(x => x.pid === msg.pid);
  if (!p) return { ok: false, error: '提案が見つかりません（処理済みか期限切れ）' };
  if (!isPopup(sender) && p.origin !== originOf(sender)) return { ok: false, error: 'オリジンが一致しません' };
  if (msg.accept) {
    const ses = await unlocked(); if (!ses) return { ok: false, error: '金庫がロック中です' };
    const s = await L.getSettings();
    const r = await L.mutateVault(s, ses.raw, items => {
      const ex = items.find(sameLogin(p)), now = Date.now();
      if (ex) { ex.pass = p.pass; ex.mt = now; }
      else items.push({ id: crypto.randomUUID(), title: p.host, url: p.origin, user: p.user || '', pass: p.pass, note: '', mt: now });
    });
    await touch(ses, s);
    await setQueue((await getQueue()).filter(x => x.pid !== p.pid));
    return { ok: true, attempts: r.attempts };
  }
  await setQueue(q.filter(x => x.pid !== p.pid));
  return { ok: true };
}

// ---- パスキー ----
function checkRp(msg, sender) {
  const origin = originOf(sender), rpId = String(msg.rpId || new URL(origin).hostname).toLowerCase();
  return L.rpIdValid(rpId, origin) ? { origin, rpId } : null;
}
const okChallenge = c => typeof c === 'string' && /^[A-Za-z0-9_-]{16,1400}$/.test(c);

async function pkCheck(msg, sender) {
  const rp = checkRp(msg, sender); if (!rp) return { valid: false };
  if (msg.mode === 'create' && !(msg.algs || []).includes(-7)) return { valid: false }; // ES256 を受け付けないサイトは標準へ
  const ses = await unlocked(); if (!ses) return { valid: true, locked: true, rpId: rp.rpId };
  const s = await L.getSettings(); const items = await liveItems(ses, s);
  const mine = items.filter(i => !i.del && i.kind === 'passkey' && i.rpId === rp.rpId);
  if (msg.mode === 'create') return { valid: true, rpId: rp.rpId, excluded: mine.some(i => (msg.exclude || []).includes(i.credentialId)) };
  const allow = msg.allow || [];
  const c = mine.filter(i => !allow.length || allow.includes(i.credentialId));
  return { valid: true, rpId: rp.rpId, candidates: c.map(i => ({ id: i.id, userName: i.userName || i.userDisplayName || '(名前なし)', title: i.title })) };
}
async function pkCreate(msg, sender) {
  const rp = checkRp(msg, sender); if (!rp) return { ok: false, error: 'rpId がこのページと一致しません' };
  if (!okChallenge(msg.challenge) || typeof msg.userId !== 'string' || !msg.userId) return { ok: false, error: '要求の形式が不正です' };
  const ses = await unlocked(); if (!ses) return { ok: false, error: '金庫がロック中です' };
  const s = await L.getSettings();
  const { item, response } = await L.makePasskey({ rpId: rp.rpId, rpName: msg.rpName, origin: rp.origin, challenge: msg.challenge,
    userId: msg.userId, userName: msg.userName, userDisplayName: msg.userDisplayName });
  // 金庫への保存が成功してから、サイトに結果を返す（返したのに鍵を失う、を防ぐ）
  await L.mutateVault(s, ses.raw, items => { if (!items.some(i => i.id === item.id)) items.push(item); });
  await touch(ses, s);
  return { ok: true, cred: response };
}
async function pkGet(msg, sender) {
  const rp = checkRp(msg, sender); if (!rp) return { ok: false, error: 'rpId がこのページと一致しません' };
  if (!okChallenge(msg.challenge)) return { ok: false, error: '要求の形式が不正です' };
  const ses = await unlocked(); if (!ses) return { ok: false, error: '金庫がロック中です' };
  const s = await L.getSettings(); const items = await liveItems(ses, s);
  const item = items.find(i => i.id === msg.itemId && !i.del && i.kind === 'passkey' && i.rpId === rp.rpId);
  if (!item) return { ok: false, error: 'パスキーが見つかりません' };
  const cred = await L.signPasskey(item, { origin: rp.origin, challenge: msg.challenge });
  await touch(ses, s);
  return { ok: true, cred };
}
async function pkDelete(msg) {
  const ses = await unlocked(); if (!ses) return { ok: false, error: '金庫がロック中です' };
  const s = await L.getSettings();
  await L.mutateVault(s, ses.raw, items => { const i = items.find(x => x.id === msg.id && x.kind === 'passkey'); if (i) Object.keys(i).forEach(k => { if (!['id', 'kind'].includes(k)) delete i[k]; }), Object.assign(i, { del: true, mt: Date.now(), title: '' }); });
  return { ok: true };
}

const handlers = {
  // ページ（content script）から
  status: async () => ({ unlocked: !!(await unlocked()) }),
  capture, resolve,
  noteUser: async (m, s) => { const o = originOf(s), u = String(m.user || '').trim(); if (!u || L.isVaultOrigin(o, await L.getSettings())) return {};
    const { lastUser = {} } = await chrome.storage.session.get('lastUser'); lastUser[o] = { user: u, at: Date.now() };
    await chrome.storage.session.set({ lastUser }); return {}; },
  pendingFor: async (m, s) => { const ses = await unlocked(); if (!ses) return {}; return pendingList(ses, await L.getSettings(), p => p.origin === originOf(s)); },
  pkCheck, pkCreate, pkGet,
  // ポップアップから
  listPending: async () => pendingList(await unlocked(), await L.getSettings()),
  pkDelete
};
const POPUP_ONLY = new Set(['listPending', 'pkDelete']), PAGE_ONLY = new Set(['capture', 'noteUser', 'pendingFor', 'pkCheck', 'pkCreate', 'pkGet']);

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const h = msg && handlers[msg.type];
  const fromPopup = isPopup(sender), fromPage = isPage(sender);
  if (!h || (!fromPopup && !fromPage) || (POPUP_ONLY.has(msg.type) && !fromPopup) || (PAGE_ONLY.has(msg.type) && !fromPage)) { reply({ ok: false }); return; }
  Promise.resolve().then(() => h(msg, sender)).then(reply, e => reply(err(e)));
  return true;
});
