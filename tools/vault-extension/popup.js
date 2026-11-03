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
  const pc = await chrome.runtime.sendMessage({ type: 'listPending' }).catch(() => ({}));
  $('pendHint').textContent = pc && pc.count ? '保存の提案が ' + pc.count + ' 件あります（解錠すると表示）' : '';
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
const msgBg = m => chrome.runtime.sendMessage(m).catch(e => ({ ok: false, error: e.message }));
// 保留中の保存提案（ロック中にページで検知したもの）を、解錠後にまとめて表示
async function renderPending() {
  const P = $('pending'); P.replaceChildren();
  const r = await msgBg({ type: 'listPending' }); const list = (r && r.items) || [];
  if (!list.length) return;
  P.append(el('div', '保存の提案（' + list.length + '件）', 't'));
  for (const p of list) {
    const c = el('div', null, 'item'), upd = p.mode === 'update';
    c.append(el('div', (upd ? 'パスワードを更新：' : '新規保存：') + p.host, 't'), el('div', p.user || '(ユーザー名なし)', 'u'));
    const row = el('div', null, 'row'), y = el('button', upd ? '更新する' : '保存する', 'p'), n = el('button', '保存しない');
    const act = async accept => { y.disabled = n.disabled = true; const res = await msgBg({ type: 'resolve', pid: p.pid, accept });
      if (!res.ok) { say(res.error || '失敗しました', true); y.disabled = n.disabled = false; return; }
      say(accept ? '保存しました' : '破棄しました'); const s = await L.getSession(); if (s) await open(s.raw); };
    y.onclick = () => act(true); n.onclick = () => act(false);
    row.append(y, n); c.append(row); P.append(c);
  }
}
function pkCard(i) {
  const c = el('div', null, 'item');
  c.append(el('div', (i.title || i.rpId) + '（パスキー）', 't'), el('div', [i.userName, i.rpId].filter(Boolean).join(' ・ '), 'u'));
  const row = el('div', null, 'row'), d = el('button', '削除');
  d.onclick = async () => { if (!confirm('このパスキーを金庫から削除しますか？\nサイト側に登録したパスキーは別途削除してください。')) return;
    const r = await msgBg({ type: 'pkDelete', id: i.id }); if (!r.ok) return say(r.error || '失敗しました', true);
    const s = await L.getSession(); if (s) await open(s.raw); say('削除しました'); };
  row.append(d); c.append(row); return c;
}
function render() {
  renderPending();
  const url = tab && tab.url, ok = url && /^https?:/.test(url);
  const vaultTab = ok && L.isVaultOrigin(url, settings); // 金庫サーバー自身のタブでは「このサイトの項目」を出さない
  const m = ok && !vaultTab ? L.matchItems(items.filter(i => i.kind !== 'passkey'), url) : [];
  $('site').textContent = ok ? new URL(url).hostname : 'このページでは使えません';
  const M = $('matches'); M.replaceChildren();
  if (ok && !L.fillAllowed(url)) M.append(el('p', 'https 以外のページです。自動入力はできません（コピーのみ）。', 'mu'));
  if (m.length) m.forEach(i => M.append(card(i, L.fillAllowed(url))));
  else M.append(el('p', vaultTab ? '金庫サーバーのページです（自動入力・照合の対象外）。' : ok ? '一致する項目がありません。下の一覧からコピーできます。' : '', 'mu'));
  $('allBox').open = !m.length; renderAll();
}
function renderAll() {
  const q = $('q').value.toLowerCase(), A = $('all'); A.replaceChildren();
  items.filter(i => [i.title, i.url, i.user, i.userName, i.rpId].join(' ').toLowerCase().includes(q))
    .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja')).forEach(i => A.append(i.kind === 'passkey' ? pkCard(i) : card(i, false)));
}
$('q').oninput = renderAll;
init();
