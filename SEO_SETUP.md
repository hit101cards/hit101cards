# Hit101 SEO セットアップ

公開後の検索エンジン対応。robots.txt と sitemap.xml は配置済み。

---

## 1. Google Search Console 登録（**推奨**）

Googleインデックスを高速化、検索ランキング改善、クロールエラー検知。

### 手順
1. https://search.google.com/search-console にアクセス（Googleアカウントでログイン）
2. **プロパティを追加** →「URLプレフィックス」を選択
3. `https://hit101.cards` を入力 → **続行**
4. **所有権の確認** 画面で以下のいずれかを選択:

### 所有権確認（おすすめ: HTMLメタタグ方式）

**方式A: HTMLメタタグ（最もラク）**
1. Search Console で表示される `<meta name="google-site-verification" content="XXXXX" />` をコピー
2. `client/index.html` の `<head>` 内に追加:
   ```html
   <meta name="google-site-verification" content="XXXXX" />
   ```
3. コミット＆プッシュ → Cloudflare再デプロイ後にSearch Consoleで「確認」ボタン

**方式B: DNS TXTレコード（Cloudflareで楽）**
1. Search Console で表示されるTXTレコード値をコピー
2. Cloudflare DNS → **Add record**
   - Type: `TXT`
   - Name: `@` (またはhit101.cardsそのまま)
   - Content: Search Console からコピーした値
3. Search Console で「確認」ボタン

### 登録後にやること
- **サイトマップを送信**: Search Console 左メニュー「サイトマップ」→ `sitemap.xml` を追加 → 送信
- 1〜2日で Google がクロール開始、検索結果に表示されるまで数日〜1週間

---

## 2. Bing Webmaster Tools（任意）

Microsoft Edge や Bing 検索対応（日本では利用者少なめ、優先度低）。

1. https://www.bing.com/webmasters
2. **Sign in** → Microsoftアカウント
3. サイト追加 → `https://hit101.cards`
4. 所有権確認 → Search Consoleと同様に MetaTag or DNS
5. Sitemap送信: `https://hit101.cards/sitemap.xml`

**Search Consoleからインポートも可**（1クリック）

---

## 3. OGPデバッガーで各SNSの表示確認

公開直後は全部回しておく:

| サービス | URL | 用途 |
|---|---|---|
| **OpenGraph.xyz** | https://www.opengraph.xyz/url/https%3A%2F%2Fhit101.cards | 汎用プレビュー |
| **Facebook Debugger** | https://developers.facebook.com/tools/debug/ | Facebook / Messenger |
| **X Card Validator** | https://cards-dev.twitter.com/validator | X (Twitter) |
| **LinkedIn Post Inspector** | https://www.linkedin.com/post-inspector/ | LinkedIn |

各サービスで**Scrape Again / Refresh**ボタンを押すと、新しいOGP情報を反映してくれます（初回キャッシュ更新）。

---

## 4. 構造化データ（任意、将来）

`VideoGame` スキーマを追加するとリッチリザルト対象に。今は優先度低めなので公開後1ヶ月以降に追加検討。

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "VideoGame",
  "name": "Hit101",
  "url": "https://hit101.cards",
  "description": "合計をピッタリ101にしたら勝ち、特殊カードで逆転もあるブラウザカードゲーム",
  "genre": "Card Game",
  "playMode": "MultiPlayer",
  "gamePlatform": "Web Browser",
  "applicationCategory": "Game",
  "operatingSystem": "Any"
}
</script>
```

---

## 5. Cloudflare Web Analytics（無料、推奨）

プライバシー重視のアクセス解析（Google Analytics より軽量）。

1. Cloudflare Dashboard → **Analytics & Logs** → **Web Analytics**
2. **Add a site** → `hit101.cards`
3. 表示された `<script>` タグを `client/index.html` の `<head>` 内に追加
4. コミット＆プッシュ

**取得できるデータ**:
- 訪問数、PV、ユニークビジター
- 参照元、国別、デバイス別
- コアウェブバイタル（LCP, FID, CLS）

Cookieレス・無料・超高速。公開直後から数字を見られます。

---

## 6. SEOチェックリスト（公開初期）

- [x] robots.txt 配置済み
- [x] sitemap.xml 配置済み
- [x] OGP画像 (og-image.png) 設定済み
- [x] canonical URL 設定済み (`<link rel="canonical">`)
- [ ] Google Search Console 登録
- [ ] Google Search Console にサイトマップ送信
- [ ] Cloudflare Web Analytics 設定
- [ ] OGPプレビュー4サービス全部で確認
- [ ] Bing Webmaster Tools 登録（任意）
- [ ] 構造化データ追加（公開1ヶ月後に検討）

---

## 検索ランキングを上げるコツ

| 施策 | 効果 |
|---|---|
| SNSで拡散 → 被リンク増加 | 高 |
| Discord コミュニティでエンゲージメント | 中 |
| itch.io / Newgrounds / ふりーむ 等に登録 | 高（被リンク源） |
| プレイ動画を YouTube に定期投稿 | 中〜高 |
| ブログで「ゲームの作り方」等を発信 | 中（個人開発の鉄板） |

被リンク（外部サイトからのリンク）が最重要。他の個人開発者のDiscordやRedditで紹介されるとGoogleが早く上位表示してくれます。
