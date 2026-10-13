// 依存なしの静的サイト生成。使い方: node build.js  → dist/ に出力
// content/posts/*.md（記事）と content/pages/*.md（固定ページ）を読み、HTML・sitemap.xml・rss.xml・robots.txt を作る。
const fs = require('fs'), path = require('path');
const site = JSON.parse(fs.readFileSync('site.json', 'utf8'));
const OUT = 'dist';
// 案件リンク：affiliate.json の {キー: {url, name}}。urlが空（提携前）なら、リンクにせず文字だけ出す。urlがあれば rel=sponsored で、記事の冒頭にPR表記が自動で入る
const AFF = fs.existsSync('affiliate.json') ? JSON.parse(fs.readFileSync('affiliate.json', 'utf8')) : {};
let affUsed = false;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = {}; let body = raw;
  if (m) { body = m[2]; for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1'); } }
  meta.slug = meta.slug || path.basename(file, '.md');
  return { meta, body };
}
const inline = t => esc(t)
  .replace(/!\[([^\]]*)\]\((\/[^)\s]+)\)/g, (_, a, u) => `<img class="fig" src="${u}" alt="${a}" loading="lazy" width="800">`)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(aff:([a-z0-9-]+)\)/g, (_, a, k) => { const ad = AFF[k]; const u = ad && ad.url; if (!u) return a; affUsed = true; return ad.html ? `${ad.html}<span class="prtag">PR</span>` : `<a href="${esc(u)}" rel="sponsored nofollow noopener" target="_blank">${a}</a><span class="prtag">PR</span>`; })
  .replace(/\[([^\]]+)\]\((https?:[^)\s]+|\/[^)\s]*)\)/g, (_, a, u) => `<a href="${u}"${u.startsWith('http') ? ' rel="noopener nofollow" target="_blank"' : ''}>${a}</a>`);
function md(src) {
  const lines = src.replace(/\r/g, '').split('\n'); const out = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^---+$/.test(l.trim())) { out.push('<hr>'); i++; continue; }
    if (l.startsWith('>')) { const q = []; while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`); continue; }
    if (/^\s*[-*]\s+/.test(l)) { const it = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) it.push(`<li>${inline(lines[i++].replace(/^\s*[-*]\s+/, ''))}</li>`); out.push(`<ul>${it.join('')}</ul>`); continue; }
    if (/^\s*\d+\.\s+/.test(l)) { const it = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) it.push(`<li>${inline(lines[i++].replace(/^\s*\d+\.\s+/, ''))}</li>`); out.push(`<ol>${it.join('')}</ol>`); continue; }
    if (l.includes('|') && lines[i + 1] && /^\s*\|?\s*:?-+/.test(lines[i + 1])) {
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(`<div class="tablewrap"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\s*[-*]\s|\s*\d+\.\s|---+$)/.test(lines[i])) p.push(lines[i++]);
    { const h = inline(p.join(' ')); out.push(/^<img class="fig"[^>]*>$/.test(h) ? `<figure>${h}</figure>` : `<p>${h}</p>`); }
  }
  return out.join('\n');
}

const CSS = `:root{--bg:#FFFBEA;--ink:#161616;--soft:#5b5640;--accent:#E5322D;--pop:#FFD92E;--line:#e6dca4;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#1b1a14;--ink:#f3efdc;--soft:#b9b393;--accent:#ff6b63;--pop:#c9a400;--line:#3a3722;--card:#26241a}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Sans","Noto Sans JP","Yu Gothic",system-ui,sans-serif;line-height:1.85;font-size:17px}
a{color:var(--accent)}a:focus-visible{outline:3px solid var(--pop);outline-offset:2px}
header.top{background:var(--pop);color:#161616;border-bottom:4px solid #161616}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
header.top .wrap{display:flex;gap:14px;align-items:center;padding-block:14px;flex-wrap:wrap}
header.top img{width:52px;height:52px;border-radius:50%;border:3px solid #161616;background:#fff;object-fit:cover}
header.top a.name{color:#161616;font-weight:900;font-size:1.35rem;text-decoration:none}
header.top .tag{font-size:.8rem;margin:0;opacity:.85;flex-basis:100%}
nav.main{background:var(--card);border-bottom:1px solid var(--line)}nav.main .wrap{display:flex;gap:18px;flex-wrap:wrap;padding-block:8px;font-size:.9rem}nav.main a{color:var(--ink)}
main{padding-block:28px 56px}
h1{font-size:1.75rem;line-height:1.4;margin:.2em 0 .6em;text-wrap:balance}h2{font-size:1.4rem;margin:2.2em 0 .6em;padding:.15em .6em;border-left:8px solid var(--accent);background:var(--card);line-height:1.5}h3{font-size:1.15rem;margin:1.8em 0 .4em}
.meta{color:var(--soft);font-size:.85rem}
.note{background:var(--card);border:2px solid var(--ink);border-radius:12px;padding:12px 16px;margin:1.4em 0;font-size:.92rem}
.tablewrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.92rem;min-width:480px}th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}th{background:var(--card)}
blockquote{margin:1.2em 0;padding:.4em 1em;border-left:6px solid var(--pop);background:var(--card)}
.cards{display:grid;gap:14px;margin-top:20px}.card{background:var(--card);border:2px solid var(--ink);border-radius:14px;padding:14px 18px}.card a.t{font-weight:700;font-size:1.08rem;text-decoration:none}.card p{margin:.3em 0 0;color:var(--soft);font-size:.9rem;line-height:1.6}
.talk{display:flex;gap:14px;align-items:flex-start;margin:1.2em 0}.talk img{width:68px;height:68px;border-radius:50%;border:3px solid var(--ink);background:#fff;object-fit:cover;flex:none}.talk .b{background:var(--card);border:2px solid var(--ink);border-radius:16px;padding:10px 14px;flex:1}.talk.owl .b{background:#FFF3C4;color:#161616}
figure{margin:1.4em 0}.prtag{font-size:.7rem;border:1px solid var(--ink);border-radius:4px;padding:0 4px;margin-left:4px;color:var(--soft)}img.fig{display:block;width:100%;height:auto;background:#fff;border:3px solid var(--ink);border-radius:14px}
.sharebox{background:var(--card);border:2px solid var(--ink);border-radius:14px;padding:16px;margin:2em 0}.sharebox p{margin:.2em 0 .8em}.shareactions{display:flex;gap:10px;flex-wrap:wrap}.shareactions button{font:inherit;font-weight:700;cursor:pointer;border:2px solid var(--ink);border-radius:10px;padding:8px 14px;background:var(--pop);color:#161616}.shareactions button+button{background:var(--card);color:var(--ink)}.shareactions button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}.sharestatus{min-height:1.5em;font-size:.86rem;color:var(--soft)}.related{margin:2em 0}.related ul{padding-left:1.25em}
footer{border-top:1px solid var(--line);color:var(--soft);font-size:.82rem;padding-block:20px}footer a{color:var(--soft)}
`;
const layout = ({ title, desc, body, url, jsonld, noindex, ogType, ogImage }) => `<!doctype html><html lang="${site.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">${noindex ? '<meta name="robots" content="noindex">' : ''}${site.googleVerification ? `<meta name="google-site-verification" content="${esc(site.googleVerification)}">` : ''}${site.baseUrl && !noindex ? `<link rel="canonical" href="${site.baseUrl}${url}">` : ''}
<link rel="icon" href="/img/owl.jpg" type="image/jpeg"><meta property="og:type" content="${ogType || 'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:site_name" content="${esc(site.name)}"><meta property="og:locale" content="ja_JP">${site.baseUrl ? `<meta property="og:url" content="${site.baseUrl}${url}"><meta property="og:image" content="${esc(ogImage || site.baseUrl + '/img/owl.jpg')}"><meta property="og:image:alt" content="${esc(title)}">` : ''}<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ''}

<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="/rss.xml"><style>${CSS}</style>${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ''}</head><body>
<header class="top"><div class="wrap"><img src="/img/owl.jpg" alt="ふくろう博士" width="52" height="52"><a class="name" href="/">${esc(site.name)}</a><p class="tag">${esc(site.tagline)}</p></div></header>
<nav class="main"><div class="wrap"><a href="/">記事一覧</a><a href="/about/">運営者情報</a><a href="/editorial-policy/">編集方針</a><a href="/ad-policy/">広告について</a><a href="/disclaimer/">免責事項</a></div></nav>
<main><div class="wrap">${body}</div></main>
<footer><div class="wrap"><p>${esc(site.name)}は、公表資料にもとづく情報提供を目的としたサイトです。投資の勧誘ではありません。投資には元本割れのリスクがあります。</p><p><a href="/about/">運営者情報</a>・<a href="/privacy/">プライバシー</a>・<a href="/contact/">お問い合わせ</a></p></div></footer></body></html>`;

// 会話ブロック: 本文中の「:::rabbit ...」「:::owl ...」で1行ずつ吹き出しを作る
const talk = html => html.replace(/<p>:::(rabbit|squirrel|owl)\s+([\s\S]*?)<\/p>/g, (_, who, t) => `<div class="talk ${who}"><img src="/img/${who}.jpg" alt="${{rabbit:'うさぎ',squirrel:'りす',owl:'ふくろう博士'}[who]}" width="68" height="68"><div class="b">${t}</div></div>`);

fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
fs.cpSync('public', OUT, { recursive: true });
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(OUT, p)), { recursive: true }); fs.writeFileSync(path.join(OUT, p), s); };

const readDir = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.md')).map(f => parse(path.join(d, f))) : [];
const posts = readDir('content/posts').filter(p => p.meta.draft !== 'true').sort((a, b) => (b.meta.updated || '').localeCompare(a.meta.updated || ''));
const pages = readDir('content/pages');
const urls = [{ u: '/', m: posts[0] ? posts[0].meta.updated : '' }];

for (const p of posts) {
  affUsed = false;
  const { meta } = p, url = `/${meta.slug}/`; urls.push({ u: url, m: meta.updated });
  const jsonld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: meta.title, description: meta.description || '', image: meta.ogImage || undefined, mainEntityOfPage: site.baseUrl ? `${site.baseUrl}${url}` : undefined, dateModified: meta.updated, datePublished: meta.published || meta.updated, inLanguage: 'ja', author: { '@type': 'Organization', name: site.name }, publisher: { '@type': 'Organization', name: site.name } });
  const head = `<p class="meta">更新日：${esc(meta.updated)}${meta.published ? `　公開日：${esc(meta.published)}` : ''}　${esc(meta.asof || '')}</p><h1>${esc(meta.title)}</h1>`;
  const bodyHtml = talk(md(p.body));
  const pr = (meta.pr === 'true' || affUsed) ? '<div class="note">本記事はアフィリエイト広告（PR）を含みます。</div>' : '';
  const shareUrl = site.baseUrl ? `${site.baseUrl}${url}?utm_source=reader_share&utm_medium=referral&utm_campaign=kodomo_nisa_2026` : url;
  const share = `<aside class="sharebox" aria-label="記事を共有"><strong>家族にも、この図解を共有</strong><p>「申込」と「制度開始」の違いを、一緒に確認できます。</p><div class="shareactions"><button type="button" data-share-url="${esc(shareUrl)}" data-share-title="${esc(meta.title)}">共有する</button><button type="button" data-copy-url="${esc(shareUrl)}">リンクをコピー</button></div><p class="sharestatus" role="status" aria-live="polite"></p></aside><script>document.querySelectorAll('.sharebox').forEach(box=>{const status=box.querySelector('.sharestatus');const copy=async url=>{try{await navigator.clipboard.writeText(url);status.textContent='リンクをコピーしました';}catch{status.textContent='リンクをコピーできませんでした。ブラウザの共有機能をご利用ください。';}};box.querySelector('[data-copy-url]').addEventListener('click',e=>copy(e.currentTarget.dataset.copyUrl));box.querySelector('[data-share-url]').addEventListener('click',async e=>{const b=e.currentTarget;if(navigator.share){try{await navigator.share({title:b.dataset.shareTitle,url:b.dataset.shareUrl});}catch(err){if(err.name!=='AbortError')copy(b.dataset.shareUrl);}}else copy(b.dataset.shareUrl);});});</script>`;
  const related = posts.filter(x => x.meta.slug !== meta.slug).slice(0, 3).map(x => `<li><a href="/${x.meta.slug}/">${esc(x.meta.title)}</a></li>`).join('');
  write(url + 'index.html', layout({ title: `${meta.title} | ${site.name}`, desc: meta.description || '', url, jsonld, ogType: 'article', ogImage: meta.ogImage, body: `<article>${head}${pr}${bodyHtml}${share}${related ? `<aside class="related"><h2>あわせて読む</h2><ul>${related}</ul></aside>` : ''}<div class="note">この記事は、公表資料にもとづいて作成しています。制度や手続きは変更されることがあります。最新の情報は各金融機関や公式の資料で確認してください。投資には元本割れのリスクがあります。</div></article>` }));
}
for (const p of pages) {
  const { meta } = p, url = `/${meta.slug}/`; urls.push({ u: url, m: meta.updated });
  write(url + 'index.html', layout({ title: `${meta.title} | ${site.name}`, desc: meta.description || '', url, body: `<article><p class="meta">更新日：${esc(meta.updated || '')}</p><h1>${esc(meta.title)}</h1>${md(p.body)}</article>` }));
}
write('index.html', layout({ title: `${site.name} | ${site.tagline}`, desc: site.tagline, url: '/', body: `<h1>${esc(site.name)}</h1><p>${esc(site.tagline)}。うさぎとりすの疑問に、ふくろう博士が答えます。</p><div class="cards">${posts.map(p => `<div class="card"><a class="t" href="/${p.meta.slug}/">${esc(p.meta.title)}</a><p>${esc(p.meta.description || '')}（更新：${esc(p.meta.updated)}）</p></div>`).join('') || '<div class="card"><p>記事を準備しています。</p></div>'}</div>` }));
write('404.html', layout({ title: `ページが見つかりません | ${site.name}`, desc: 'お探しのページは見つかりませんでした。記事一覧から探せます。', url: '/404.html', noindex: true, body: '<h1>ページが見つかりません</h1><p><a href="/">記事一覧へ</a></p>' }));
const base = site.baseUrl || '';
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(x => `<url><loc>${base}${x.u}</loc>${x.m ? `<lastmod>${x.m}</lastmod>` : ''}</url>`).join('')}</urlset>`);
write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.name)}</title><link>${base}/</link><description>${esc(site.tagline)}</description>${posts.map(p => `<item><title>${esc(p.meta.title)}</title><link>${base}/${p.meta.slug}/</link><description>${esc(p.meta.description || '')}</description></item>`).join('')}</channel></rss>`);
write('robots.txt', `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
console.log(`built: ${posts.length} posts, ${pages.length} pages`);

