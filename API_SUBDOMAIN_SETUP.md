# `api.hit101.cards` サブドメイン設定手順

**目的**: クライアントが `https://hit101-server.fly.dev` ではなく `https://api.hit101.cards` に接続するようにし、ブランドを統一する。

**所要時間**: 15〜30分（DNS反映待ち含む）

---

## ⚠️ 作業順序が重要

以下の順番で進めないと一時的にサイトが動かなくなります:

```
① Fly.io 証明書リクエスト
  ↓
② Cloudflare に DNS レコード追加 (プロキシOFF)
  ↓
③ 証明書発行待ち (数分)
  ↓
④ curl で api.hit101.cards/health を確認 (ここが成功するまで⑤に進まない)
  ↓
⑤ client/.env.production を更新 & push
  ↓
⑥ CORS_ORIGINS を更新 & flyctl deploy
```

---

## Phase 1: Fly.io 側で証明書を作成

ターミナルで:
```bash
cd "C:/Users/PC_User/OneDrive/デスクトップ/ai_prog/101ゲーム/server"
flyctl certs create api.hit101.cards
```

出力例:
```
The certificate for api.hit101.cards has been created
Required DNS records:
  A     api       66.241.124.xx
  AAAA  api       2a09:8280:1::xx:xxxx
```

**表示された A と AAAA レコードの値をメモ**してください（次で使います）。

もし出力に値が見えない場合は:
```bash
flyctl certs show api.hit101.cards
```

---

## Phase 2: Cloudflare DNS レコード追加

### 1. Cloudflare Dashboard → `hit101.cards` → **DNS** タブ

### 2. Aレコード追加
**Add record** を押して以下を入力:

| 項目 | 値 |
|---|---|
| Type | `A` |
| Name | `api` |
| IPv4 address | Phase 1 でメモした **A レコードの値** |
| Proxy status | ⚠️ **DNS only (グレーの雲)** ← 必ずプロキシOFF |
| TTL | Auto |

**Save** をクリック

### 3. AAAAレコード追加
**Add record** → 以下を入力:

| 項目 | 値 |
|---|---|
| Type | `AAAA` |
| Name | `api` |
| IPv6 address | Phase 1 でメモした **AAAA レコードの値** |
| Proxy status | ⚠️ **DNS only (グレーの雲)** |
| TTL | Auto |

**Save** をクリック

---

## 🚨 プロキシを必ずOFF（DNS only）にする理由

Cloudflareのプロキシ（オレンジ雲）を有効にすると、WebSocket接続が不安定になります。Fly.ioが直接SSL証明書を発行し、TLSハンドシェイクするためには**DNS only** が必須。

---

## Phase 3: 証明書発行の確認

ターミナルで数分間隔でチェック:
```bash
flyctl certs show api.hit101.cards
```

以下のようになればOK:
```
  Hostname                = api.hit101.cards
  DNS Provider            = cloudflare
  DNS Validation Hostname =
  DNS Validation Target   =
  DNS Validation Instructions =
  Source                  = fly
  Issued                  = rsa, ecdsa
  Added at                = xxx
  Status                  = Ready
```

**`Issued: rsa, ecdsa`** と **`Status: Ready`** になるまで待つ（通常5分以内）。

### 動作確認:
```bash
curl https://api.hit101.cards/health
```
→ `{"status":"ok",...}` が返ってきたら Phase 3 完了

---

## Phase 4: クライアントを api.hit101.cards に切り替え

`client/.env.production` を更新:
```
VITE_SERVER_URL=https://api.hit101.cards
```

コミット＆プッシュ:
```bash
cd "C:/Users/PC_User/OneDrive/デスクトップ/ai_prog/101ゲーム"
git add client/.env.production
git commit -m "switch VITE_SERVER_URL to api.hit101.cards"
git push
```

Cloudflare Pages が自動で再ビルド（1〜3分）

---

## Phase 5: CORS 設定更新（fly.dev URL を削除）

```bash
cd server
flyctl secrets set "CORS_ORIGINS=https://hit101.cards,https://www.hit101.cards,https://api.hit101.cards"
```

→ サーバーが自動再起動（1〜2分）。`hit101-server.fly.dev` を CORS から除外したので、**カスタムドメイン経由のみ受け付ける**ようになります。

---

## Phase 6: 最終動作確認

1. ブラウザで https://hit101.cards を Ctrl+Shift+R で再読み込み
2. F12 → **Network** タブでフィルタ「socket」
3. WebSocket接続先が `wss://api.hit101.cards/socket.io/...` になっているか確認
4. ゲーム実際にプレイして動くか

---

## トラブルシューティング

### `Status: Awaiting configuration` のまま進まない
- Cloudflare DNS のプロキシがONになっていないか再確認（グレー雲 = OFF）
- A / AAAA レコード両方が追加されているか確認
- 10〜30分待つ（初回はDNS伝播に時間がかかる）

### 証明書は発行されたが接続できない
- Cloudflare で「SSL/TLS encryption mode」が **Full** か **Full (strict)** になっているか確認（Flexibleだと二重TLSで不安定）
- `flyctl logs` でサーバー側にリクエストが届いているか確認

### CORSエラーに戻った
- `flyctl secrets list` で CORS_ORIGINS が正しく設定されているか確認
- ブラウザキャッシュのクリア (Ctrl+Shift+R)

---

## 🎯 完了後のメリット

- `hit101.cards` ブランド内で完結（URLを見て「これAPI」とわかる）
- SNSで `hit101-server.fly.dev` という内部URLが露出しない
- Fly.io の URL が変わってもクライアントに影響しない（DNSだけ書き換えれば済む）
