// 図解カード画像を作る。使い方: node make_card.js <出力.png> '<JSON>'
// 会話カード: {"layout":"dialog","tag":"","title":"","lines":[{"who":"rabbit|squirrel|owl","text":""}],"note":""}（うさぎ・りす＝教わる側、ふくろう博士＝教える側）
// JSON: {"theme":"pop"(既定。黄色×赤)|"calm","tag":"上の小さな文字","title":"見出し（\n で改行）","bullets":["箇条書き",...],"note":"下の注記"}
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const CH = {rabbit:{name:'うさぎ',file:'rabbit.jpg',learner:true}, squirrel:{name:'りす',file:'squirrel.jpg',learner:true}, owl:{name:'ふくろう博士',file:'owl.jpg',learner:false}};
const img = k => { const f = path.join(__dirname,'..','assets','characters',CH[k].file); return 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64'); };
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
  if (d.layout === 'dialog') {
    const rows = (d.lines||[]).map(l => { const c = CH[l.who]; const right = !c.learner;
      return `<div class="row ${right?'r':'l'}"><div class="av"><img src="${img(l.who)}"><span>${esc(c.name)}</span></div><div class="bub ${right?'ow':''}">${esc(l.text).replace(/\n/g,'<br>')}</div></div>`; }).join('');
    const dh = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;width:1080px;height:1350px;background:${C.bg};font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;color:${C.ink};box-sizing:border-box;padding:64px 56px 56px 72px;display:flex;flex-direction:column;position:relative}
.bar{position:absolute;left:0;top:0;width:28px;height:100%;background:${C.bar}}
.tag{align-self:flex-start;font-size:38px;font-weight:700;color:${C.tagfg};background:${C.tagbg};padding:${pop?'8px 24px':'0'};letter-spacing:.06em;margin-bottom:26px}
h1{font-size:${pop?66:62}px;line-height:1.25;margin:0 0 26px;font-weight:900}
.rows{display:flex;flex-direction:column;gap:20px}
.row{display:flex;gap:22px;align-items:flex-start}.row.r{flex-direction:row-reverse}
.av{width:150px;flex:none;text-align:center;font-size:24px;font-weight:700}
.av img{width:150px;height:150px;border-radius:50%;object-fit:cover;border:6px solid ${C.ink};background:#fff;display:block;margin-bottom:6px}
.bub{flex:1;background:#fff;border:6px solid ${C.ink};border-radius:30px;padding:18px 26px;font-size:37px;line-height:1.45;font-weight:700;min-width:0}
.bub.ow{background:#FFF3C4}
.note{margin-top:auto;font-size:30px;color:${C.note};line-height:1.55;word-break:keep-all}
</style><div class="bar"></div><div class="tag">${esc(d.tag)}</div><h1>${esc(d.title).replace(/\n/g,'<br>')}</h1><div class="rows">${rows}</div><div class="note">${esc(d.note).replace(/\n/g,'<br>')}</div>`;
    const b2 = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
    const p2 = await b2.newPage({viewport:{width:1080,height:1350}});
    await p2.setContent(dh); await p2.waitForTimeout(500); await p2.screenshot({path: out}); await b2.close(); return;
  }
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
  const p = await b.newPage({viewport:{width:1080,height:1350}});
  await p.setContent(html); await p.waitForTimeout(400);
  await p.screenshot({path: out}); await b.close();
})();
