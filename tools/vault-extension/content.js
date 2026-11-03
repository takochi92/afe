// 常駐させない。「入力」ボタンを押したときだけ、popup.js が activeTab 経由で一度だけ注入する。
(() => {
  const visible = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.disabled && !e.readOnly; };
  const setVal = (el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    el.focus(); set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  window.__afeVaultFill = (user, pass) => {
    const inputs = [...document.querySelectorAll('input')].filter(visible);
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
