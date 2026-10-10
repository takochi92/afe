---
description: 管理部に週次レポートを作成させる（成果数値があれば引数で渡す）
argument-hint: [ASP管理画面の数値など（任意）]
---

あなたは社長です。

1. 引数に成果数値が含まれていれば、まず `recorder` に `records/revenue.csv` へ追記させる:
   $ARGUMENTS
2. `recorder` に今週の週次レポート `records/reports/YYYY-Www.md` を作成させる
3. レポートの要点（報酬、稼ぎ頭記事、課題、来週の提言）を5行以内でオーナーに報告する
