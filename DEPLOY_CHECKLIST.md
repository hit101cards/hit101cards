# Hit101 デプロイ手順（完全版）

**所要時間**: 初回は約2〜3時間。以後のアップデートは5分。

**構成**:
- `hit101.cards` → Cloudflare Pages（クライアント）
- `api.hit101.cards` → Fly.io（サーバー、Tokyoリージョン）
- ドメイン管理: Cloudflare Registrar

---

## Phase 0: 事前準備

### アカウント作成
- [ ] **GitHub** アカウント（無料） — https://github.com/signup
- [ ] **Fly.io** アカウント（無料枠あり、クレカ登録のみ） — https://fly.io/app/sign-up
- [ ] **Cloudflare** アカウント（無料） — https://dash.cloudflare.com/sign-up

### CLIツールのインストール（ローカル）
```bash
# flyctl (Fly.io CLI) — Windows (PowerShellで)
iwr https://fly.io/install.ps1 -useb | iex

# GitHub CLI (あるとラク、なくてもOK)
winget install GitHub.cli
```

---

## Phase 1: GitHubリポジトリ作成 & Push

### 1-1. リポジトリ作成（GitHub Web UI）
1. https://github.com/new を開く
2. Repository name: `hit101`
3. Visibility: **Public**（Cloudflare Pagesに繋ぐため。Privateでもよいが無料枠の注意点あり）
4. **Initialize オプションは全部OFF**（すでにローカルにコミット済みのため）
5. 「Create repository」

### 1-2. ローカルからPush
```bash
cd "C:/Users/PC_User/OneDrive/デスクトップ/ai_prog/101ゲーム"
git remote add origin https://github.com/<あなたのユーザー名>/hit101.git
git push -u origin main
```

※ 初回push時に認証を求められます。ブラウザ認証 or Personal Access Token で対応。

---

## Phase 2: Fly.io にサーバーデプロイ

### 2-1. 認証
```bash
cd "C:/Users/PC_User/OneDrive/デスクトップ/ai_prog/101ゲーム/server"
flyctl auth login
```

### 2-2. アプリ作成
```bash
flyctl launch --no-deploy --copy-config --name hit101-server
```
- `fly.toml` はすでに配置済みなので **`--copy-config`** で既存を使う
- アプリ名 `hit101-server` が使われていたら `hit101-api` 等に変更
- リージョン確認: `nrt` (Tokyo)

### 2-3. 永続ボリューム作成（SQLite用）
```bash
flyctl volumes create hit101_data --region nrt --size 1
```
- 1GB無料枠内
- このボリューム名は `fly.toml` の `[[mounts]] source` と一致している必要あり

### 2-4. 環境変数（秘密情報）をセット
```bash
flyctl secrets set CORS_ORIGINS=https://hit101.cards,https://www.hit101.cards
```

### 2-5. デプロイ
```bash
flyctl deploy
```

### 2-6. 動作確認
```bash
flyctl status
flyctl logs                                  # サーバーログ確認
curl https://hit101-server.fly.dev/health    # ヘルスチェック
```
→ `{"status":"ok",...}` が返ればOK

---

## Phase 3: Cloudflare Pages にクライアントデプロイ

### 3-1. Cloudflare Dashboard
1. https://dash.cloudflare.com/ にログイン
2. 左メニュー「Workers & Pages」
3. 「Create application」→「Pages」→「Connect to Git」
4. GitHub認証 → `hit101` リポジトリを選択

### 3-2. ビルド設定
| 項目 | 値 |
|---|---|
| Project name | `hit101` |
| Production branch | `main` |
| Framework preset | `Vite` |
| Build command | `cd client && npm install && npm run build` |
| Build output directory | `client/dist` |
| Root directory | （空欄） |

### 3-3. 環境変数
「Environment variables」で追加:

| 名前 | 値 |
|---|---|
| `VITE_SERVER_URL` | `https://api.hit101.cards` |

※ Fly.io デフォルトの `hit101-server.fly.dev` を使う場合も**本番ではカスタムドメイン経由**を推奨（WebSocketのCORSがシンプルになる）

### 3-4. 初回デプロイ
「Save and Deploy」→ 2〜3分でビルド完了。
`hit101-<hash>.pages.dev` のURLでアクセス可能に。

---

## Phase 4: ドメイン設定（DNS）

### 4-1. Cloudflare Pages にカスタムドメイン紐付け
1. Pages プロジェクト → 「Custom domains」タブ
2. 「Set up a custom domain」→ `hit101.cards` 入力 → 「Continue」
3. Cloudflare が自動的にDNSレコードを追加（CNAME推奨、自動でAレコード）
4. 「Activate domain」

### 4-2. Fly.io にサブドメイン `api.hit101.cards` を紐付け
```bash
cd server
flyctl certs create api.hit101.cards
flyctl certs show api.hit101.cards
```
表示された **A レコード / AAAA レコード** を Cloudflare DNS に追加:

1. Cloudflare Dashboard → `hit101.cards` → 「DNS」
2. 「Add record」
   - Type: `A`
   - Name: `api`
   - IPv4: （flyctlが表示したIPv4）
   - Proxy status: **DNS only（グレーの雲）** ← ⚠️ WebSocketのため必ずProxy OFF
3. 同様にAAAAレコード（IPv6）も追加（Proxy OFF）

5〜10分でSSL証明書が発行される。確認:
```bash
flyctl certs show api.hit101.cards
```
→ `Issued` になればOK

### 4-3. 動作確認
```bash
curl https://api.hit101.cards/health
curl https://hit101.cards    # HTMLが返る
```

ブラウザで https://hit101.cards にアクセス → ロビー画面が開く → ランダムマッチ押下 → 接続成功なら完全成功。

---

## Phase 5: OGPプレビュー確認

- [ ] https://www.opengraph.xyz/url/https%3A%2F%2Fhit101.cards — OGP画像・タイトル表示確認
- [ ] X のポスト作成画面でURLを貼り付け → プレビュー確認
- [ ] Discord のチャットに貼り付け → 埋め込みカード確認

※ キャッシュがある場合はURL末尾に `?v=1` を付けて再確認

---

## Phase 6: 公開前最終テスト

- [ ] 友人数人でプレイテスト（スマホ/PC両方）
- [ ] 負荷テスト（Fly.io上で確認は有料のためローカルで）
  ```bash
  cd server
  npm run loadtest 50 4 30 https://api.hit101.cards
  ```
- [ ] プライバシー・利用規約モーダルが開く
- [ ] 切断 → 再接続 → ゲーム続行できる

---

## トラブルシューティング

### WebSocket接続が失敗する
- Cloudflare DNS の `api` レコードで Proxy が **グレー雲（DNS only）** になっているか確認
- Cloudflareの「オレンジ雲」(Proxy ON)は WebSocket で問題発生しやすい

### CORS エラーが出る
```bash
flyctl secrets list -a hit101-server
flyctl secrets set CORS_ORIGINS=https://hit101.cards,https://www.hit101.cards
flyctl deploy --app hit101-server
```

### SQLite のデータが消える
- `flyctl volumes list` で `hit101_data` が存在するか確認
- `fly.toml` の `[[mounts]]` が正しく記述されているか確認

### Fly.io の無料枠を超える警告
- `min_machines_running = 0` + `auto_stop_machines = "stop"` 設定済み（アクセスない時は停止）
- `flyctl scale show` で現在のマシン数確認
- 想定外の課金が見えたら `flyctl scale count 1` でマシン数を1に絞る

---

## 費用目安（公開初期）

| サービス | 月額 |
|---|---|
| Cloudflare Registrar (hit101.cards) | 年 $10 相当 (約月$0.8) |
| Cloudflare Pages | $0 (無料枠内) |
| Fly.io | $0〜$2 (1マシン・256MB・Autostop有効) |
| GitHub | $0 (Publicリポジトリ) |
| 合計 | **月 $0〜3** |

アクセスが爆発的に伸びたら、Fly.io の VM サイズを上げる or DB を Turso/Neon に移す（LAUNCH_GUIDE.md のスケール章参照）。

---

## アップデート時の手順（2回目以降）

```bash
cd "C:/Users/PC_User/OneDrive/デスクトップ/ai_prog/101ゲーム"

# 変更をコミット
git add <changed-files>
git commit -m "<変更内容>"

# クライアントのみ変更 → Push すれば Cloudflare Pages が自動デプロイ
git push

# サーバー変更 → Push後、手動でFly.ioへデプロイ
git push
cd server && flyctl deploy
```
