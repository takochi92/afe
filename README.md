# 株式会社AFE — Claude Code で動くアフィリエイト会社

Claude Code のサブエージェント機能で、6人の社員がアフィリエイト記事の制作・収益化を分業する仕組みです。
あなた（オーナー）が Claude Code を起動すると、Claude が **社長** として社員に仕事を割り振ります。

## 社員

| 担当 | エージェント | 定義ファイル |
|------|-------------|-------------|
| リサーチ | `researcher` | `.claude/agents/researcher.md` |
| 企画 | `planner` | `.claude/agents/planner.md` |
| 執筆 | `writer` | `.claude/agents/writer.md` |
| 検品 | `inspector` | `.claude/agents/inspector.md` |
| 記録 | `recorder` | `.claude/agents/recorder.md` |
| 営業 | `sales` | `.claude/agents/sales.md` |

## 使い方

```text
/produce 30代向け 格安SIM 乗り換え
```
→ リサーチ → 営業（案件確保）→ 企画 → 執筆 → 検品（差し戻しは最大2回）→ 記録 まで自動で回り、最後にオーナーへの依頼事項が報告されます。

```text
/morning-meeting          # 仕掛かり状況の確認と今日のタスク決め
/weekly-report A8: 記事xxx 1,200クリック 8件 24,000円   # 成果入力＋週次レポート
```

個別に頼むこともできます：「営業に、転職エージェント系の高単価案件を洗い出させて」

## ディレクトリ

```
research/            リサーチ結果
plans/               記事企画・構成案
articles/drafts/     執筆中の記事
articles/published/  検品合格した記事（公開待ち）
reviews/             検品レポート
records/             記事台帳・成果台帳・業務日誌・週次レポート
sales/               案件リスト・提携申請/交渉メールの下書き
docs/                コンプライアンス規程・文体ガイド
```

## オーナーがやること

AIが代行しない（できない）部分です。

- ASPへの登録、提携申請・交渉メールの**送信**（営業部が下書きを `sales/drafts/` に用意）
- `[[AFF:案件名]]` プレースホルダを実際のアフィリエイトリンクに差し替えて公開
- ASP管理画面の成果数値を `/weekly-report` で入力
- 法令面で判断に迷う表現の最終確認（`docs/compliance.md`）
