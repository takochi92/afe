// Cloudflareのビルド設定が「ルートディレクトリ = /」のままでも動くようにする入口。blog/ に移ってビルドする
process.chdir(require('path').join(__dirname, 'blog'));
require('./blog/build.js');
