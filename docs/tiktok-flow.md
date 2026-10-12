# TikTok素材の流れ（1日1本）

オーナーの依頼（2026-10-12）：台本を会社サイトに置く → オーナーが音声(mp3)を作って会社サイトに入れる → 社長室がmp4にして検品し、サイトに「完成」を置く → オーナーが保存してTikTokに手動投稿。

- 場所：会社サイト「TikTok素材」ビュー（db `tiktok/<id>`）。投稿は自動化しない。リンクは載せない。
- 台本は140字以内。法令・YMYLルールは docs/compliance.md。税の話（贈与税）は出さない。
- status: draft → voice_wait（音声待ち）→ audio_in → making → review → done（完成）→ posted
- 毎朝の台本づくり：新テーマ → posts/tiktok/NN-*.json（format:"tiktok" 5枚）→ scripts/make_carousel.js → 台本・説明文 → inspector検品(reviews/tiktok-YYYY-MM-DD.md) → db `tiktok` に status voice_wait で追加（動画は無し）。
- 音声拾い：db `tiktok` で status=audio_in の文書を探し、audioId を Artifact read(path=audioId) で保存 → ffprobeで長さを測り、スライド秒数を比例配分 → scripts/make_video.py --durs --audio → inspector検品 → mp4を Artifact asset:true でアップ → status=done, videoId, videoUrl, videoAt を更新。検品NGは note に理由を書き voice_wait に戻す。
- 作ったら activity と staff を更新（実際の `date -u` の時刻）。
