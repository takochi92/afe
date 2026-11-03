// 入力処理（共通）。ポップアップの「入力」では popup.js が注入し、インライン入力では content_scripts として detect.js より先に読み込まれる。
// ネイティブの value セッターで値を入れ、input / change を発火させる（React 等のフレームワークが検知できるように）。
(() => {
  const visible = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.disabled && !e.readOnly; };
  const setVal = (el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    el.focus(); set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  window.__afeVaultFill = (user, pass, scope) => { // scope：対象のフォーム（省略時はページ全体）
    const inputs = [...(scope || document).querySelectorAll('input')].filter(visible);
    const pw = inputs.find(i => i.type === 'password');
    const isText = i => ['text', 'email', 'tel', 'search', ''].includes(i.type) || i.type === 'url';
    let ue = null;
    if (pw) { // パスワード欄より前にある、最も近い文字入力欄
      const idx = inputs.indexOf(pw);
      for (let k = idx - 1; k >= 0; k--) if (isText(inputs[k])) { ue = inputs[k]; break; }
    } else { // 2段階ログイン（ユーザー名だけの画面）
      ue = inputs.find(i => isText(i) && /user|login|mail|account|id/i.test(i.name + i.id + i.autocomplete)) || inputs.find(isText) || null;
    }
    const res = { user: false, pass: false };
    if (ue && user) { setVal(ue, user); res.user = true; }
    if (pw && pass) { setVal(pw, pass); res.pass = true; }
    return res;
  };
})();
