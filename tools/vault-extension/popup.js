import * as L from './lib.js';
const $ = id => document.getElementById(id);
const say = (t, bad) => { const m = $('msg'); m.textContent = t || ''; m.style.color = bad ? 'var(--bad)' : 'var(--ok)'; };
const show = v => { for (const s of ['setup', 'lockView', 'mainView']) $(s).classList.toggle('hide', s !== v);
  for (const b of ['syncBtn', 'lockBtn']) $(b).classList.toggle('hide', v !== 'mainView'); };
let items = [], tab = null, settings = null, clipTimer = null;

async function activeTab() { return (await chrome.tabs.query({ active: true, currentWindow: true }))[0] || null; }

async function init() {
  settings = await L.getSettings(); tab = await activeTab();
  if (!settings.token) return show('setup');
  const ses = await L.getSession();
  if (ses) { try { await open(ses.raw); return; } catch { await L.lock(); } }
  show('lockView'); $('mp').focus();
}
async function open(raw, fresh) {
  const v = await L.getVault(settings);
  items = await L.decryptItems(raw, v.blob);
  await L.startSession(raw, settings.autoLockMin); // 操作のたびに自動ロックを延長
  say(v.offline ? 'サーバーに接続できません（端末内のキャッシュを表示中）' : '', v.offline);
  render(); show('mainView');
}
$('unlockBtn').onclick = unlock;
$('mp').addEventListener('keydown', e => e.key === 'Enter' && unlock());
async function unlock() {
  const pw = $('mp').value; if (!pw) return;
  say('開いています…');
  try {
    const v = await L.getVault(settings);
    const raw = await L.deriveRaw(pw, v.blob);
    $('mp').value = '';
    try { items = await L.decryptItems(raw, v.blob); } catch { return say('マスターパスワードが違います', true); }
    await L.startSession(raw, settings.autoLockMin);
    say(v.offline ? 'サーバーに接続できません（端末内のキャッシュを表示中）' : '', v.offline);
    render(); show('mainView');
  } catch (e) { say(e.message, true); }
}
$('lockBtn').onclick = async () => { await L.lock(); items = []; show('lockView'); say('ロックしました'); };
$('syncBtn').onclick = async () => { const s = await L.getSession(); if (s) try { await open(s.raw); say('更新しました'); } catch (e) { say(e.message, true); } };
$('setBtn').onclick = $('setup2').onclick = () => chrome.runtime.openOptionsPage();

const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
async function copy(t, label, secret) {
  try { await navigator.clipboard.writeText(t || ''); say(label + 'をコピーしました'); } catch { return say('コピーできませんでした', true); }
  if (secret) { clearTimeout(clipTimer); clipTimer = setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 20000); } // ポップアップを開いている間だけ有効
  const s = await L.getSession(); if (s) L.startSession(s.raw, settings.autoLockMin);
}
async function fill(item) {
  const t = await activeTab();
  if (!t || !L.matchItems([item], t.url).length) return say('このページの項目ではありません', true);
  if (!L.fillAllowed(t.url)) return say('https 以外のページには入力しません', true);
  try {
    await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['content.js'] });
    const [r] = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: (u, p) => window.__afeVaultFill(u, p), args: [item.user || '', item.pass || ''] });
    const res = r && r.result;
    if (!res || (!res.user && !res.pass)) return say('入力欄が見つかりませんでした。コピーを使ってください', true);
    say(res.pass ? '入力しました' : 'ユーザー名を入力しました（次の画面でもう一度「入力」）');
    const s = await L.getSession(); if (s) L.startSession(s.raw, settings.autoLockMin);
  } catch (e) { say('入力できませんでした（このページには注入できません）', true); }
}
function card(i, canFill) {
  const c = el('div', null, 'item');
  c.append(el('div', i.title || '(無題)', 't'), el('div', [i.user, i.url].filter(Boolean).join(' ・ '), 'u'));
  const r = el('div', null, 'row');
  if (canFill) { const f = el('button', '入力', 'p'); f.onclick = () => fill(i); r.append(f); }
  const cu = el('button', 'ユーザー名'); cu.onclick = () => copy(i.user, 'ユーザー名');
  const cp = el('button', 'パスワード'); cp.onclick = () => copy(i.pass, 'パスワード', true);
  r.append(cu, cp); c.append(r); return c;
}
function render() {
  const url = tab && tab.url, ok = url && /^https?:/.test(url);
  const m = ok ? L.matchItems(items, url) : [];
  $('site').textContent = ok ? new URL(url).hostname : 'このページでは使えません';
  const M = $('matches'); M.replaceChildren();
  if (ok && !L.fillAllowed(url)) M.append(el('p', 'https 以外のページです。自動入力はできません（コピーのみ）。', 'mu'));
  if (m.length) m.forEach(i => M.append(card(i, L.fillAllowed(url))));
  else M.append(el('p', ok ? '一致する項目がありません。下の一覧からコピーできます。' : '', 'mu'));
  $('allBox').open = !m.length; renderAll();
}
function renderAll() {
  const q = $('q').value.toLowerCase(), A = $('all'); A.replaceChildren();
  items.filter(i => [i.title, i.url, i.user].join(' ').toLowerCase().includes(q))
    .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja')).forEach(i => A.append(card(i, false)));
}
$('q').oninput = renderAll;
init();
