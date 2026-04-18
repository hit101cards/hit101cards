# Hit101

合計をピッタリ101にしたら勝ち。特殊カードで逆転もある、ブラウザで遊べるリアルタイム対戦カードゲーム。

- 🌐 公開URL: https://hit101.cards
- 無料・登録不要・最大6人対戦
- 日本語対応、スマートフォン対応

## 技術構成

| | 技術 |
|---|---|
| Client | React 18 + TypeScript + Vite + Tailwind CSS + socket.io-client |
| Server | Node.js + Express + socket.io + better-sqlite3 |
| Deploy (server) | Fly.io (Tokyo region, SQLite on persistent volume) |
| Deploy (client) | Cloudflare Pages |

## ディレクトリ

```
101ゲーム/
├── client/        # フロントエンド (Vite)
│   ├── src/
│   └── .env.example
├── server/        # バックエンド (Node.js)
│   ├── index.js
│   ├── gameLogic.js
│   ├── playerStats.js   # better-sqlite3 ラッパー
│   ├── botAi.js
│   ├── audit.js
│   ├── loadtest.js
│   ├── Dockerfile
│   ├── fly.toml
│   └── .env.example
└── LAUNCH_GUIDE.md      # 公開・マネタイズ手順
```

## ローカル起動

```bash
# サーバー
cd server
npm install
npm run dev        # http://localhost:3001

# クライアント (別ターミナル)
cd client
npm install
npm run dev        # http://localhost:5173
```

同じLAN内のスマホからも `http://<PCのIP>:5173` で接続できます（Vite の `host: true` 設定済み）。

## 環境変数

### Server (`server/.env`)

| 変数 | 既定値 | 用途 |
|---|---|---|
| `PORT` | `3001` | HTTP/Socket.IO 待ち受けポート |
| `CORS_ORIGINS` | localhost/LAN許可 | 許可するオリジン（カンマ区切り） |
| `DATA_DIR` | `./` | SQLite/audit.log の配置ディレクトリ |
| `DB_PATH` | `${DATA_DIR}/playerStats.sqlite` | DBファイルの明示指定 |
| `AUDIT_LOG_PATH` | `${DATA_DIR}/audit.log` | 監査ログの明示指定 |

### Client (`client/.env`)

| 変数 | 既定値 | 用途 |
|---|---|---|
| `VITE_SERVER_URL` | 自動検出 | Socket.IO サーバーURL。未指定時は同ホストの `:3001` |

## デプロイ

### サーバー (Fly.io)

```bash
cd server
flyctl auth signup              # 未登録の場合
flyctl launch --no-deploy       # 既存 fly.toml を読み込み
flyctl volumes create hit101_data --region nrt --size 1
flyctl secrets set CORS_ORIGINS=https://hit101.cards,https://www.hit101.cards
flyctl deploy
```

### クライアント (Cloudflare Pages)

1. GitHubリポジトリと連携
2. ビルドコマンド: `cd client && npm install && npm run build`
3. 出力ディレクトリ: `client/dist`
4. 環境変数: `VITE_SERVER_URL=https://<your-fly-app>.fly.dev`
5. カスタムドメイン `hit101.cards` を設定

## 負荷テスト

```bash
cd server
npm run loadtest 100 4 60 http://localhost:3001
# [clients] [groupSize] [durationSec] [url]
```

## ルール概要

- 順番にカードを出し、場の合計を増やす
- 合計が **101ちょうど** → 勝利ポイント獲得
- 合計が **102以上** → バースト（マイナス）
- カード値: A=1, 2〜7=数字通り, J=10, Q=20, K=30, Joker=50（合計100時は1扱い）
- 特殊: 8=+8 or スキップ / 9=+9 or 順番反転 / 10=±10

詳細はゲーム内「？ルール確認」を参照。

## 法的情報

- プライバシーポリシーと利用規約はゲーム内フッターから閲覧可能
- ポイントは**換金・景品交換不可**（賭博罪リスク回避）

## ライセンス

未定（個人開発。公開後に検討予定）。

## お問い合わせ

xufangxiyin@gmail.com
