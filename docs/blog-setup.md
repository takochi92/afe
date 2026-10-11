# ブログ公開の手順書（オーナー用）

結論：**Cloudflare（無料）で公開する。** WordPressなどの別のブログサービスは使わない。
理由：サイトの中身（`blog/`）はもう出来ている。ドメインなし・費用0円で始められ、記事を足すたびに自動で公開される。

## やること（所要 約15分、1回だけ）
1. https://dash.cloudflare.com/sign-up でアカウントを作る（無料。メール認証あり）
2. https://dash.cloudflare.com/ を開き、左メニュー「Workers & Pages」→「Create」→「Import a repository」
3. GitHubと連携する → リポジトリ `takochi92/afe` を選ぶ（非公開のままでよい）
4. 設定を入れる
   - Project name: `kodomo-okane-note`
   - Production branch: `ccr-622bec71-djrqes`
   - Root directory: `blog`
   - Build command: `node build.js`
   - Deploy command: `npx wrangler deploy`
5. 「Save and Deploy」を押す。1〜2分で終わる
6. 公開アドレス `https://kodomo-okane-note.<アカウント名>.workers.dev` を、会社サイトの指示欄で教える

## そのあと（私たちがやる）
- アドレスを `blog/site.json` の `baseUrl` に入れる
- 記事を `blog/content/posts/` に足してプッシュするだけで、自動で公開される（検品に合格したものだけ）
- 公開後に、Threads・Instagramのプロフィールにブログのアドレスを載せる（リンクの掲載は、その都度オーナーに確認する）

## つまずいたとき
- GitHubのリポジトリが一覧に出ない → GitHubの設定で、Cloudflareに `takochi92/afe` へのアクセスを許可する
- ビルドが失敗する → 画面のエラーを会社サイトに貼る（トークンなどの秘密は貼らない）
- 独自ドメインは、様子を見てから（今回は使わない）
