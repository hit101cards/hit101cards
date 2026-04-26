# Hit101 ブランドアセット使い分け

## アイコン（SNSプロフィール画像）

各SNSは自動で縮小しますが、**元画像は推奨サイズ以上を使うと綺麗**です。迷ったら **`icon-512.png` が汎用**。

| 用途 | 推奨ファイル | 備考 |
|---|---|---|
| **X (Twitter)** プロフィール | `icon-400.png` | X推奨400×400 |
| **Instagram** プロフィール | `icon-320.png` | 実表示は320×320 |
| **TikTok** プロフィール | `icon-200.png` | 実表示は200×200 |
| **YouTube** チャンネルアイコン | `icon-512.png` | 800×800推奨だが512でも問題なし |
| **Discord** サーバーアイコン | `icon-512.png` | 512×512推奨 |
| **Discord** ユーザーアイコン | `icon-512.png` | 汎用 |
| **favicon** (サイト用) | すでに配置済み | `client/public/favicon.svg` |
| **Apple Touch Icon** (iOSホーム画面) | すでに配置済み | `client/public/apple-touch-icon.png` |

## バナー/ヘッダー画像

| 用途 | 推奨ファイル | サイズ |
|---|---|---|
| **SNSシェア時のOGP** | `client/public/og-image.png` | 1200×630 |
| **X ヘッダー** | `brand/banner-x-header.png` | 1500×500 |
| **YouTube チャンネルバナー** | `brand/banner-youtube.png` | 2560×1440 |
| **Discord サーバーバナー** | `brand/banner-discord.png` | 960×540（Boost Lv1要） |

いずれも背景のみ。必要なら Canva で「Hit101」の文字を乗せて差し替えてください。

## 色・フォント（統一ガイド）

```
メインカラー:  深緑 #0f5132 (カジノフェルト)
アクセント:    金 #facc15 / 赤 #dc2626 (「101」の数字)
背景:          濃紺 #1e293b (tailwind slate-800)
```

**タイポグラフィ**: 「Hit101」を書く時は、**「Hit」と「101」の色を分ける**と視認性UP（例: Hitが白、101が金 or 赤）。

## 迷ったら

**`icon-512.png`** を全SNSで使っても問題ありません。各プラットフォームが自動でリサイズします。

## QRコード

`https://hit101.cards` に飛ぶ QRコードを 3形式で配置済み:

| ファイル | 用途 |
|---|---|
| `qr-hit101-512.png` | SNS投稿、スマホ画面、画像合成 |
| `qr-hit101-1024.png` | チラシ・名刺・ステッカー印刷 |
| `qr-hit101.svg` | ベクター形式、Canva/Figma で拡大縮小・色変更可能 |

エラー訂正レベル H (高)、紺色 (#0f172a) ベース。中央にロゴを重ねても読み取れる耐性あり。
