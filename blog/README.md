# こどものお金ノート（ブログのソース）

依存なしの静的サイト。`node build.js` で `dist/` を作る。記事は `content/posts/*.md`、固定ページは `content/pages/*.md`。

## 公開のしかた（Cloudflare Workers、無料のアドレス `*.workers.dev`）
このリポジトリ（takochi92/afe、非公開のまま）の `blog/` を、Cloudflareが自動でビルドして公開する。**公開されるのは `blog/dist/` の中身だけ**（会社の資料は公開されない）。

オーナーの作業（1回だけ）:
1. https://dash.cloudflare.com/ でアカウントを作る（無料）
2. 左のメニュー「Workers & Pages」→「Create」→「Import a repository（Git）」→ GitHub を連携し、`takochi92/afe` を選ぶ
3. 設定:
   - Project name: `kodomo-okane-note`
   - Production branch: `ccr-622bec71-djrqes`
   - Root directory: `blog`
   - Build command: `node build.js`
   - Deploy command: `npx wrangler deploy`
4. 「Save and Deploy」。完了すると `https://kodomo-okane-note.<アカウント名>.workers.dev` で見られる
5. そのアドレスを私に教える（`blog/site.json` の `baseUrl` に入れる。サイトマップなどに使う）

あとは、私たちが記事を `blog/content/posts/` に追加して、ブランチにプッシュするだけで、自動で公開される。

## 記事の書き方
- フロントマター: `title` `slug`（英数字）`description` `updated` `published` `asof`。広告を含む場合は `pr: true`（冒頭にPR表記が自動で入る）。下書きは `draft: true`
- 会話ブロック: 1行ごとに `:::rabbit ...` `:::squirrel ...` `:::owl ...`（各行を空行で区切る）
- 公開の前に、検品部（`inspector`）の合格が必要。記録は `reviews/` に残す
