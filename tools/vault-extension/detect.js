// 常駐の content script（isolated world、https のページ、document_start、最上位フレームのみ）。
// 1) ログイン・登録フォームの送信を検知して保存を提案  2) page.js からのパスキー要求を拡張本体に中継
// 提示UIは閉じた Shadow DOM。ボタンは本物のユーザー操作（isTrusted）だけを受け付ける。
(() => {
  'use strict';
  if (window.top !== window) return;
  if (!(location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) return;
  const send = m => new Promise(r => { try { chrome.runtime.sendMessage(m, res => { void chrome.runtime.lastError; r(res || {}); }); } catch { r({}); } });

  // ---------- 提示UI ----------
  let hostEl = null, root = null, chain = Promise.resolve();
  const CSS = `:host{all:initial}
  .w{position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;max-width:340px;font:14px/1.45 system-ui,sans-serif}
  .c{background:#fff;color:#1b1f24;border:1px solid #d8dce1;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:12px 14px}
  @media(prefers-color-scheme:dark){.c{background:#1e2327;color:#e6e8ea;border-color:#3a4249}}
  .t{font-weight:700;margin-bottom:4px}.x{font-size:12px;opacity:.75;word-break:break-all;margin-bottom:8px}
  .r{display:flex;gap:6px;flex-wrap:wrap}.col{flex-direction:column}
  button{font:inherit;padding:6px 10px;border-radius:6px;border:1px solid #d8dce1;background:transparent;color:inherit;cursor:pointer;text-align:left}
  button.p{background:#2563eb;border-color:#2563eb;color:#fff}`;
  function wrap() {
    if (!root) {
      hostEl = document.createElement('afe-vault-ui');
      root = hostEl.attachShadow({ mode: 'closed' });
      const st = document.createElement('style'); st.textContent = CSS;
      const w = document.createElement('div'); w.className = 'w';
      root.append(st, w);
    }
    if (!hostEl.isConnected) (document.body || document.documentElement).appendChild(hostEl);
    return root.querySelector('.w');
  }
  const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
  // 1枚ずつ順番に出す。押されたボタンの value を返す
  function ask({ title, text, buttons, column, focus }) {
    const p = chain.then(() => new Promise(res => {
      const c = el('div', null, 'c'); c.append(el('div', '🔐 ' + title, 't'));
      if (text) c.append(el('div', text, 'x'));
      const r = el('div', null, column ? 'r col' : 'r'); let first = null;
      for (const b of buttons) {
        const bt = el('button', b.label, b.primary ? 'p' : '');
        bt.addEventListener('click', e => { if (!e.isTrusted) return; c.remove(); res(b.value); });
        r.append(bt); if (b.primary && !first) first = bt;
      }
      c.append(r); wrap().append(c);
      if (focus && first) first.focus();
    }));
    chain = p.catch(() => { }); return p;
  }
  function toast(text, ms = 7000) {
    const c = el('div', null, 'c'); c.append(el('div', '🔐 マイ金庫', 't'), el('div', text, 'x'));
    const b = el('button', '閉じる'); b.addEventListener('click', e => e.isTrusted && c.remove()); c.append(b);
    wrap().append(c); setTimeout(() => c.remove(), ms);
  }
  const ready = f => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', f, { once: true }) : f();

  // ---------- A. 保存提案 ----------
  const fieldOk = i => !i.disabled && i.type !== 'hidden';
  const isText = i => ['text', 'email', 'tel', ''].includes(i.type) || i.type === 'url';
  function collect(scope) {
    const ins = [...(scope || document).querySelectorAll('input')].filter(fieldOk);
    const pws = ins.filter(i => i.type === 'password' && i.value);
    const userBefore = idx => { for (let k = idx - 1; k >= 0; k--) if (isText(ins[k]) && ins[k].value.trim()) return ins[k].value.trim(); return ''; };
    if (!pws.length) { // ユーザー名だけの画面（2段階ログイン）
      const u = ins.find(i => isText(i) && i.value.trim() && /user|login|mail|account|id/i.test(i.name + i.id + i.autocomplete));
      return u ? { user: u.value.trim(), pass: '' } : null;
    }
    const vals = pws.map(p => p.value);
    const pass = vals.find((v, k) => vals.indexOf(v) !== k) || vals[vals.length - 1]; // 確認欄と一致する値＝新パスワード
    return { user: userBefore(ins.indexOf(pws[0])), pass };
  }
  let lastKey = '', lastAt = 0;
  async function onSubmitLike(scope) {
    const c = collect(scope); if (!c) return;
    const key = c.user + '\u0000' + c.pass; if (key === lastKey && Date.now() - lastAt < 3000) return; lastKey = key; lastAt = Date.now();
    if (!c.pass) { send({ type: 'noteUser', user: c.user }); return; }
    const r = await send({ type: 'capture', user: c.user, pass: c.pass });
    if (r.locked) toast('金庫がロック中のため、保存の提案を保留しました。拡張のアイコンから解錠すると保存できます。');
    else if (r.pid) offer(r);
  }
  async function offer(p) {
    const upd = p.mode === 'update';
    const v = await ask({ title: upd ? 'パスワードを更新しますか？' : '金庫に保存しますか？', text: p.host + ' ・ ' + (p.user || '(ユーザー名なし)'),
      buttons: [{ label: upd ? '更新する' : '保存する', value: 'yes', primary: true }, { label: '保存しない', value: 'no' }] });
    const r = await send({ type: 'resolve', pid: p.pid, accept: v === 'yes' });
    if (v === 'yes') toast(r.ok ? (upd ? '更新しました' : '金庫に保存しました') : '保存できませんでした：' + (r.error || ''), 4000);
  }
  // 送信の検知：フォームの submit、送信ボタンのクリック、パスワード欄での Enter
  document.addEventListener('submit', e => onSubmitLike(e.target), true);
  document.addEventListener('click', e => {
    if (!e.isTrusted) return;
    const b = e.target.closest && e.target.closest('button,input[type=submit],input[type=button],[role=button]'); if (!b) return;
    const form = b.form || b.closest('form');
    if (form) { if (b.type === 'submit' || (b.tagName === 'BUTTON' && !b.getAttribute('type'))) onSubmitLike(form); return; }
    if (/log ?in|sign ?in|sign ?up|ログイン|サインイン|登録|続行|次へ|continue|next|submit|送信/i.test(b.textContent || b.value || '')) onSubmitLike(document);
  }, true);
  document.addEventListener('keydown', e => {
    if (e.isTrusted && e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && e.target.type === 'password') onSubmitLike(e.target.form || document);
  }, true);
  // 画面遷移した後のページでも、保留中の提案を出す（解錠済みのときだけ）
  ready(() => send({ type: 'pendingFor' }).then(r => (r.items || []).forEach(offer)));

  // ---------- B. パスキー（page.js からの要求を中継）----------
  const reply = (id, body) => window.postMessage({ __afeVault: 'res', id, ...body }, location.origin);
  const NATIVE = { action: 'native' }, CANCEL = { action: 'error', name: 'NotAllowedError' };
  async function lockedLoop(mode, rpId) {
    for (;;) {
      const v = await ask({ title: '金庫がロック中です', focus: true,
        text: rpId + '：拡張のアイコンから金庫を解錠すると、' + (mode === 'create' ? 'パスキーを金庫に保存できます。' : '金庫のパスキーでサインインできます。'),
        buttons: [{ label: '解錠したので再確認', value: 'retry', primary: true }, { label: 'ブラウザ標準を使う', value: 'native' }, { label: 'キャンセル', value: 'cancel' }] });
      if (v !== 'retry') return v;
      const s = await send({ type: 'status' }); if (s.unlocked) return 'retry';
    }
  }
  async function handleCreate(m) {
    for (;;) {
      const chk = await send({ type: 'pkCheck', mode: 'create', rpId: m.rpId, algs: m.algs, exclude: m.exclude });
      if (!chk.valid) return NATIVE; // rpId 不一致・ES256 非対応など → 素通し
      if (chk.locked) { const v = await lockedLoop('create', chk.rpId); if (v === 'retry') continue; return v === 'native' ? NATIVE : CANCEL; }
      if (chk.excluded) { await ask({ title: 'このアカウントのパスキーは既に金庫にあります', text: chk.rpId, buttons: [{ label: 'OK', value: 'ok', primary: true }], focus: true });
        return { action: 'error', name: 'InvalidStateError', message: 'The authenticator was previously registered.' }; }
      const v = await ask({ title: 'パスキーを金庫に保存しますか？', text: chk.rpId + ' ・ ' + (m.userName || m.userDisplayName || ''), focus: true,
        buttons: [{ label: '金庫に保存', value: 'save', primary: true }, { label: 'ブラウザ標準を使う', value: 'native' }, { label: 'キャンセル', value: 'cancel' }] });
      if (v === 'native') return NATIVE; if (v !== 'save') return CANCEL;
      const r = await send({ type: 'pkCreate', rpId: m.rpId, rpName: m.rpName, challenge: m.challenge, userId: m.userId, userName: m.userName, userDisplayName: m.userDisplayName });
      if (!r.ok) { toast('パスキーを保存できませんでした：' + (r.error || '')); return CANCEL; }
      toast('パスキーを金庫に保存しました', 4000);
      return { action: 'ok', cred: r.cred };
    }
  }
  async function handleGet(m) {
    for (;;) {
      const chk = await send({ type: 'pkCheck', mode: 'get', rpId: m.rpId, allow: m.allow });
      if (!chk.valid) return NATIVE;
      if (chk.locked) { const v = await lockedLoop('get', chk.rpId); if (v === 'retry') continue; return v === 'native' ? NATIVE : CANCEL; }
      if (!chk.candidates.length) return NATIVE; // 金庫にこのサイトのパスキーがない → 標準へ
      const v = await ask({ title: '金庫のパスキーでサインイン', text: chk.rpId, column: true, focus: true,
        buttons: [...chk.candidates.map((c, k) => ({ label: c.userName, value: 'c' + k, primary: k === 0 })), { label: 'ブラウザ標準を使う', value: 'native' }, { label: 'キャンセル', value: 'cancel' }] });
      if (v === 'native') return NATIVE; if (!v || v[0] !== 'c') return CANCEL;
      const r = await send({ type: 'pkGet', rpId: m.rpId, itemId: chk.candidates[+v.slice(1)].id, challenge: m.challenge });
      if (!r.ok) { toast('サインインできませんでした：' + (r.error || '')); return CANCEL; }
      return { action: 'ok', cred: r.cred };
    }
  }
  window.addEventListener('message', e => {
    const d = e.data; if (e.source !== window || !d || d.__afeVault !== 'req' || typeof d.id !== 'string') return;
    const h = d.kind === 'create' ? handleCreate : d.kind === 'get' ? handleGet : null; if (!h) return;
    h(d).then(r => reply(d.id, r), () => reply(d.id, NATIVE));
  });
})();
