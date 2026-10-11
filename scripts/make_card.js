// 図解カード画像を作る。使い方: node make_card.js <出力.png> '<JSON>'
// JSON: {"theme":"pop"(既定。黄色×赤)|"calm","tag":"上の小さな文字","title":"見出し（\n で改行）","bullets":["箇条書き",...],"note":"下の注記"}
const { chromium } = require('playwright');
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
(async () => {
  const [out, json] = process.argv.slice(2);
  const d = JSON.parse(json);
  const pop = (d.theme || 'pop') === 'pop';
  const C = pop ? {bg:'#FFD92E',ink:'#161616',acc:'#E5322D',tagbg:'#E5322D',tagfg:'#FFFFFF',note:'#161616',bar:'#161616'}
                : {bg:'#f4ecd6',ink:'#2c2a21',acc:'#2f7a68',tagbg:'transparent',tagfg:'#2f7a68',note:'#2c2a21',bar:'#2f7a68'};
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;width:1080px;height:1350px;background:${C.bg};font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;color:${C.ink};box-sizing:border-box;padding:90px 80px 80px 100px;display:flex;flex-direction:column;position:relative}
.bar{position:absolute;left:0;top:0;width:28px;height:100%;background:${C.bar}}
.tag{align-self:flex-start;font-size:38px;font-weight:700;color:${C.tagfg};background:${C.tagbg};padding:${pop?'8px 24px':'0'};letter-spacing:.06em;margin-bottom:32px}
h1{font-size:${pop?86:80}px;line-height:1.25;margin:0 0 52px;font-weight:900}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:30px}
li{font-size:44px;line-height:1.5;padding-left:56px;position:relative}
li::before{content:"";position:absolute;left:0;top:20px;width:24px;height:24px;background:${C.acc}}
li{font-weight:${pop?700:400}}
.note{margin-top:auto;font-size:34px;color:${C.note};line-height:1.6;word-break:keep-all}
</style><div class="bar"></div><div class="tag">${esc(d.tag)}</div><h1>${esc(d.title).replace(/\n/g,'<br>')}</h1>
<ul>${(d.bullets||[]).map(b=>`<li>${esc(b)}</li>`).join('')}</ul><div class="note">${esc(d.note).replace(/\n/g,"<br>")}</div>`;
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
  const p = await b.newPage({viewport:{width:1080,height:1350}});
  await p.setContent(html); await p.waitForTimeout(400);
  await p.screenshot({path: out}); await b.close();
})();
