import * as L from './lib.js';
const $ = id => document.getElementById(id);
const say = (t, bad) => { $('msg').textContent = t; $('msg').style.color = bad ? 'var(--bad)' : 'var(--ok)'; };
const read = () => ({ url: $('url').value.trim().replace(/\/+$/, ''), token: $('token').value.trim(), autoLockMin: Math.min(120, Math.max(1, Number($('lockMin').value) || 10)) });
(async () => { const s = await L.getSettings(); $('url').value = s.url; $('token').value = s.token; $('lockMin').value = s.autoLockMin; })();

async function ensurePermission(url) {
  let u; try { u = new URL(url); } catch { throw new Error('URLの形式が正しくありません'); }
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw new Error('https のURLにしてください（開発用の localhost のみ http 可）');
  const origins = [u.origin + '/*'];
  if (!(await chrome.permissions.contains({ origins }))) { // 保存ボタン押下（ユーザー操作）の中で、このサーバーだけに許可を求める
    if (!(await chrome.permissions.request({ origins }))) throw new Error('このサーバーへの通信が許可されませんでした');
  }
}
$('save').onclick = async () => {
  const s = read();
  try { await ensurePermission(s.url); await chrome.storage.local.set({ settings: s }); await chrome.storage.local.remove('cache'); await L.lock(); say('保存しました'); }
  catch (e) { say(e.message, true); }
};
$('test').onclick = async () => {
  const s = read();
  try { await ensurePermission(s.url); const v = await L.fetchVault(s); say('接続OK（金庫の版 ' + v.version + '）'); } catch (e) { say(e.message === 'Failed to fetch' ? 'サーバーに接続できません（Tailscaleは接続中ですか？）' : e.message, true); }
};
$('reset').onclick = async () => { await chrome.storage.local.remove('cache'); await L.lock(); say('端末内のキャッシュを消しました'); };
