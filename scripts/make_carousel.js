// カルーセル（複数枚）画像を作る。Instagram / Threads 共用。
// format:"tiktok" を JSON に入れると 1080×1920（9:16）で作る
// 使い方: node scripts/make_carousel.js <出力フォルダ> '<JSON>'
// 出力: <出力フォルダ>/slide-01.jpg, slide-02.jpg ...（JPEG。Instagramの投稿APIはJPEGのみ）
// JSON: {"footer":"2026年10月時点｜公表資料にもとづく｜投資には元本割れのリスクがあります",
//        "slides":[
//          {"type":"cover","tag":"小さな見出し","title":"大きな見出し\n（\\nで改行）","who":"owl"},
//          {"type":"point","label":"ポイント1","title":"対象は\n0〜17歳","body":"説明（1〜2文）","who":"owl","say":"博士のひとこと"},
//          {"type":"summary","title":"まとめ","bullets":["…","…"],"cta":"保存して、あとで見返してね"} ]}
// who: owl（ふくろう博士）/ rabbit / squirrel。1投稿は2〜10枚（Instagramの投稿APIの上限は10枚）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const NAME = {owl:'ふくろう博士', rabbit:'うさぎ', squirrel:'りす'};
const img = k => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname,'..','assets','characters',k + '.jpg')).toString('base64');
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])).replace(/\n/g,'<br>');
const CSS = `body{word-break:auto-phrase;margin:0;width:1080px;height:1350px;background:#FFD92E;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;color:#161616;position:relative;overflow:hidden;box-sizing:border-box;padding:84px 80px 130px 96px}
.bar{position:absolute;left:0;top:0;width:28px;height:100%;background:#161616}
.pill{display:inline-block;background:#E5322D;color:#fff;font-size:40px;font-weight:700;padding:8px 26px;letter-spacing:.06em}
h1{font-size:112px;line-height:1.2;margin:34px 0 0;font-weight:900}
h2{font-size:96px;line-height:1.22;margin:30px 0 0;font-weight:900}
.body{font-size:50px;line-height:1.6;font-weight:700;margin-top:36px}
ul{list-style:none;padding:0;margin:40px 0 0;display:flex;flex-direction:column;gap:30px}li{font-size:52px;line-height:1.5;font-weight:700;padding-left:60px;position:relative}li:before{content:"";position:absolute;left:0;top:22px;width:28px;height:28px;background:#E5322D}
.who{position:absolute;right:70px;bottom:150px;width:260px;text-align:center;font-size:30px;font-weight:700}.who img{width:260px;height:260px;border-radius:50%;border:8px solid #161616;background:#fff;object-fit:cover;display:block}
.say{position:absolute;left:96px;right:380px;bottom:170px;background:#fff;border:8px solid #161616;border-radius:36px;padding:26px 34px;font-size:44px;line-height:1.5;font-weight:700}
.cta{position:absolute;left:96px;right:80px;bottom:170px;background:#161616;color:#FFD92E;border-radius:30px;padding:26px 34px;font-size:50px;font-weight:900;text-align:center}
.swipe{position:absolute;left:96px;bottom:200px;font-size:48px;font-weight:900}
.foot{position:absolute;left:96px;right:80px;bottom:52px;font-size:26px;line-height:1.5;display:flex;justify-content:space-between;gap:20px}.foot span:last-child{white-space:nowrap}
`;
(async () => {
  const [outDir, json] = process.argv.slice(2); const d = JSON.parse(json); const N = d.slides.length;
  if (N < 2 || N > 10) throw new Error('枚数は2〜10枚');
  fs.mkdirSync(outDir, {recursive:true});
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
  const TT = d.format === 'tiktok', H = TT ? 1920 : 1350;  // tiktok: 9:16（1080×1920）。下と右はアプリの表示で隠れるので、余白を広げる
  const p = await b.newPage({viewport:{width:1080,height:H}});
  for (let i = 0; i < N; i++) {
    const s = d.slides[i]; let inner = '';
    if (s.type === 'cover') inner = `<span class="pill">${esc(s.tag)}</span><h1>${esc(s.title)}</h1><div class="swipe">スワイプして見てね →</div><div class="who"><img src="${img(s.who||'owl')}">${NAME[s.who||'owl']}</div>`;
    else if (s.type === 'summary') inner = `<span class="pill">まとめ</span><h2>${esc(s.title)}</h2><ul>${(s.bullets||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="cta">${esc(s.cta||'保存して、あとで見返してね')}</div>`;
    else inner = `<span class="pill">${esc(s.label||'')}</span><h2>${esc(s.title)}</h2><div class="body">${esc(s.body)}</div>${s.say?`<div class="say">${esc(s.say)}</div><div class="who"><img src="${img(s.who||'owl')}">${NAME[s.who||'owl']}</div>`:''}`;
    const html = `<!doctype html><meta charset="utf-8"><style>${CSS.replace('height:1350px', 'height:' + H + 'px')}${TT ? 'body{padding-bottom:420px!important;padding-right:170px!important}.foot{bottom:300px!important;right:170px!important}.say{bottom:430px!important;right:420px!important}.who{bottom:400px!important;right:150px!important}.cta{bottom:430px!important;right:170px!important}.swipe{bottom:430px!important}h1{font-size:112px!important}h2{font-size:88px!important}' : ''}</style><div class="bar"></div>${inner}<div class="foot"><span>${esc(d.footer||'')}</span><span>${i+1} / ${N}</span></div>`;
    await p.setContent(html); await p.waitForTimeout(250);
    await p.screenshot({path: path.join(outDir, `slide-${String(i+1).padStart(2,'0')}.jpg`), type:'jpeg', quality:92});
  }
  await b.close(); console.log(`${N}枚を ${outDir} に作成`);
})();
