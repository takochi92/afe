// 図解カード画像を作る。使い方: node make_card.js <出力.png> '<JSON>'
// JSON: {"tag":"上の小さな文字","title":"見出し（\n で改行）","bullets":["箇条書き",...],"note":"下の注記"}
const { chromium } = require('playwright');
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
(async () => {
  const [out, json] = process.argv.slice(2);
  const d = JSON.parse(json);
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;width:1080px;height:1350px;background:#f4ecd6;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;color:#2c2a21;box-sizing:border-box;padding:100px 90px 80px 110px;display:flex;flex-direction:column;position:relative}
.bar{position:absolute;left:0;top:0;width:24px;height:100%;background:#2f7a68}
.tag{font-size:34px;color:#2f7a68;letter-spacing:.08em;margin-bottom:28px}
h1{font-size:80px;line-height:1.3;margin:0 0 56px;font-weight:700}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:30px}
li{font-size:44px;line-height:1.5;padding-left:56px;position:relative}
li::before{content:"";position:absolute;left:0;top:20px;width:22px;height:22px;background:#2f7a68}
.note{margin-top:auto;font-size:30px;color:#6c6650;line-height:1.6}
</style><div class="bar"></div><div class="tag">${esc(d.tag)}</div><h1>${esc(d.title).replace(/\n/g,'<br>')}</h1>
<ul>${(d.bullets||[]).map(b=>`<li>${esc(b)}</li>`).join('')}</ul><div class="note">${esc(d.note)}</div>`;
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
  const p = await b.newPage({viewport:{width:1080,height:1350}});
  await p.setContent(html); await p.waitForTimeout(400);
  await p.screenshot({path: out}); await b.close();
})();
