# Hit101 画像生成プロンプト集

**注意**: AIは「101」や「Hit101」の文字を正確に描けないことが多い。
推奨: 背景のみAIで生成 → Canva/Figmaで文字を上から載せる。

---

## 【OGP画像 1200×630】

### 案A: カジノ・カードテーブル調（既存UIと統一感、推奨）

英語版（DALL-E 3 / Midjourney / Flux 向け）:
```
A luxurious green felt card table background viewed from above, dramatic overhead lighting, playing cards fanned out across the felt (Ace, Jack, Queen, King, Joker), scattered red and black suit symbols, golden particles floating, dark vignette corners, rich emerald green (#0f5132) felt texture, cinematic atmosphere, professional game promotional art, empty space in the center-left for large text overlay, ultra detailed, 4k, wide 16:9 landscape composition
```

Midjourney 用追記: `--ar 1200:630 --style raw --v 6`

日本語版（Nano Banana / Gemini 向け）:
```
高級感のある深緑のカードテーブルを真上から撮影した構図。緑のフェルト地（エメラルドグリーン #0f5132）の上にトランプが扇状に並ぶ。エース、ジャック、クイーン、キング、ジョーカーが見える。黄金の粒子が浮遊し、スポットライトが中央を照らす。四隅は暗くビネット処理。中央左に大きな文字を配置するための余白を空ける。映画的で華やか、ゲーム宣伝用プロモーション画像。16:9 ランドスケープ、超高精細。
```

文字を後から乗せる内容:
- 左上〜中央: Hit101 （白 or 金色、太字、大きく）
- その下: 合計をピッタリ101にしたら勝ち
- 右下: 無料・登録不要・最大6人対戦 or hit101.cards

---

### 案B: ネオン・ゲーミング調（SNS映え重視）

```
Cyberpunk neon card game poster background, glowing red "101" motif in the far background (blurred bokeh), two playing cards crossing dramatically in the foreground with neon purple and cyan edge glow, dark navy blue base (#0a0e27) with subtle grid pattern, electric lightning effects, modern esports tournament aesthetic, wide horizontal composition with empty center-left space for typography, ultra detailed, trending on artstation, 16:9 landscape
```

---

### 案C: ミニマル・ポップ調（万人受け）

```
Flat design illustration of playing cards arranged in a fan, vibrant red heart, black spade, and yellow joker motifs, clean white or cream background with subtle geometric patterns, modern Japanese casual game promotional style, bold minimalist composition, soft drop shadows, lots of negative space on the left side for text overlay, cheerful and inviting, 16:9 landscape, vector art style
```

---

## 【Apple Touch Icon 180×180】

### 案A: カード+数字（文字あり、一発成功を狙う）

```
A single playing card icon standing upright, bold red number "101" printed in the center of a white card face with rounded corners, dark green felt background, subtle drop shadow, flat minimalist icon design, square composition, clean and recognizable at small sizes, app icon style, no text other than "101", centered composition
```

### 案B: 文字なしで生成 → 後から「101」を乗せる

```
A single white playing card with rounded corners standing upright against a dark emerald green background, subtle drop shadow, flat minimalist icon design, empty card face (no text or numbers), square composition 1:1, clean app icon aesthetic
```

### 案C: ロゴマーク風

```
Minimal geometric logo icon combining the number "1 0 1" with a playing card outline, bold red and white color scheme on dark green background, flat design, rounded corners, iOS app icon style, square 1:1 composition, highly recognizable at 60x60 pixels
```

---

## 【SNSヘッダー画像（おまけ）】

### X (Twitter) ヘッダー 1500×500

```
Wide horizontal banner for a card game social media header, scattered playing cards with "101" theme across a green felt casino table, golden highlights, dramatic side lighting, Japanese indie game aesthetic, text-free composition (text will be added later), ultra wide 3:1 aspect ratio
```

### YouTube ヘッダー 2560×1440

```
YouTube channel art for card game creator, playing cards fanning out from center across a dark green felt background, golden particles, professional gaming channel aesthetic, center area kept clean for logo and text overlay, cinematic lighting, ultra wide with important elements concentrated in the center
```

---

## 【文字を後乗せする手順】

1. AIで背景画像を生成（上記プロンプトから文字指示を削除して実行）
2. Canva → 「カスタムサイズ 1200×630」で新規作成
3. 生成画像をドラッグ＆ドロップで背景に
4. テキストツールで追加:
   - Hit101 → フォント例: Bebas Neue / Impact / Noto Sans JP Bold
   - サブコピー → Noto Sans JP Medium
5. PNGでエクスポート → client/public/og-image.png に配置

---

## 【生成後チェックリスト】

- [ ] 文字が潰れず読める（スマホのXタイムラインで表示確認）
- [ ] 画像内の文字が Hit101 / 101 と正しく書かれている（AIが H!t1O1 等にしてないか）
- [ ] 1200×630 ぴったり（ズレてるとXで勝手にクロップされる）
- [ ] ファイルサイズ 5MB以下
