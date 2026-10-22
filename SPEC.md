# SPEC.md（仕様書）

> 機能追加・修正時は必ず本書を最新状態に更新すること。
> 本書には実在の名称・個人情報を記載せず、架空のダミー情報のみを使用すること。

## 1. プロジェクト概要

| 項目 | 内容 |
| --- | --- |
| システム名 | 総合型地域スポーツクラブ ホームページ（公開コード上の名称はダミー「あおぞら総合型地域スポーツクラブ」） |
| 目的 | クラブ概要・お知らせ・教室情報を発信し、電話とWebフォームで入会・体験の問い合わせを受け付ける |
| 想定利用者 | 子育て世代の保護者、小中高生、一般成人、高齢の方 |
| 構成 | サーバーレスの静的Webサイト（HTML / CSS / JavaScript、ビルド不要） |
| 公開先 | GitHub Pages 等の静的ホスティング。`file://` で直接開いても動作する |
| 個人情報の扱い | サーバー上には一切保持しない（フォーム送信先は任意設定。未設定時はどこにも送信しない） |

### 1.1 機能一覧

| ID | 機能名 | 概要 | 状態 |
| --- | --- | --- | --- |
| F-001 | 設定の上書き表示 | ダミー設定を `config.js` の値で上書きし、名称・住所・電話番号等をDOMへ反映 | 実装済 |
| F-002 | トップページ | 最新お知らせ3件、7教室のハイライト、電話・フォームへの導線 | 実装済 |
| F-003 | クラブ概要 | 概要表・理念・会費（共通の会費システム）・アクセス | 実装済 |
| F-004 | お知らせ一覧 | 新しい順の一覧とカテゴリ絞り込み | 実装済 |
| F-005 | 教室案内 | 7教室のカード表示と対象年代フィルタ、体験申込への導線 | 実装済 |
| F-006 | 問い合わせ・体験申込 | 電話受付案内（tel リンク）、入力フォーム、検証、送信完了表示 | 実装済 |
| F-007 | 共通UI | ヘッダー・メニュー・フッター、スマホ用の固定連絡バー | 実装済 |
| F-008 | お知らせのシート連携 | スプレッドシートに書いたお知らせを GAS の Webアプリ経由で取得して表示（未設定・失敗時は予備データ） | 実装済（GASの公開は運用時に実施） |
| F-009 | お知らせ管理画面 | 共通パスワードでログインし、お知らせの追加（添付ファイルはドライブに保存）と一覧の確認を行う（admin.html） | 実装済（GASの再デプロイは運用時に実施） |

## 2. ディレクトリ構成

```
/
├─ index.html              トップ（data-page="top"）
├─ about.html              クラブ概要（data-page="about"）
├─ news.html               お知らせ一覧（data-page="news"）
├─ classes.html            教室案内（data-page="classes"）
├─ contact.html            お問い合わせ・体験申込（data-page="contact"）
├─ admin.html              職員用のお知らせ管理画面（data-page="admin"・メニューからはリンクしない）
├─ config-sample.js        config.js のひな形（ダミー値のみ）
├─ config.js               実名設定（.gitignore 対象・任意。リポジトリには含めない）
├─ css/style.css           共通スタイル
├─ js/
│  ├─ default-config.js    ダミー設定 DEFAULT_CONFIG
│  ├─ data/news-data.js    お知らせ NEWS_DATA・カテゴリ NEWS_CATEGORIES
│  ├─ data/classes-data.js 教室 CLASSES_DATA・年代 AGE_GROUPS
│  ├─ lib/config-merge.js  設定マージ・tel リンク・タイトル生成（純粋関数）
│  ├─ lib/news-logic.js    お知らせの並べ替え・絞り込み・入力チェック（純粋関数）
│  ├─ lib/class-logic.js   教室の絞り込み・検索・表示用データ抽出（純粋関数）
│  ├─ lib/form-validate.js フォーム検証・URLクエリ解析（純粋関数）
│  ├─ lib/templates.js     HTML文字列の生成・エスケープ（純粋関数）
│  ├─ lib/admin-logic.js   管理画面の入力チェック・送信データ・一覧HTML（純粋関数）
│  ├─ admin.js             管理画面の画面操作と GAS への送信（副作用）
│  └─ app.js               DOM反映・イベント登録（副作用はここに集約）
├─ gas/                    GASエディタに貼り付けるスクリプト（ブラウザでは読み込まない）
│  ├─ news-sheet.js        シートの行→お知らせへの変換（純粋関数）
│  ├─ news-admin.js        管理画面からの入力チェック・行の組み立て・採番・添付ファイルの検証（純粋関数）
│  ├─ news-api.js          Webアプリの入口 doGet・doPost・キャッシュ・認証・ドライブ保存・シート初期設定（副作用）
│  └─ README.md            スプレッドシートと GAS の設定手順・職員向けの書き方
├─ test/                   Node.js 標準テストランナーの単体テスト
├─ package.json            npm test → node --test
├─ SPEC.md
└─ .claude/CLAUDE.md
```

## 3. 設計方針

### 3.1 スクリプト構成

- `file://` では ES Modules が使えないため、通常の `<script>` を決められた順で読み込む（全ページ共通）。
  1. `js/default-config.js` → 2. `config.js`（任意） → 3. `js/data/*.js` → 4. `js/lib/*.js` → 5. `js/app.js`
- 各ファイルはトップレベルの `const` で定義し、ブラウザでは全スクリプト共通のグローバルとして参照する。そのため **定義名はプロジェクト全体で一意** にすること。
- Node.js では末尾の `if (typeof module === 'object' && module.exports)` で同じ関数をエクスポートし、単体テストから `require` する。
- `templates.js` の依存関数は、Node.js では `require`、ブラウザではグローバルから取得する（`tplDeps`）。

### 3.2 純粋関数と副作用の分離

- 判定・絞り込み・検証・HTML生成は `js/lib` の純粋関数で行う（引数を変更せず、新しい値を返す。返す値は必要に応じて `Object.freeze`）。
- DOM の書き換え・イベント登録・`fetch` は `js/app.js` だけで行い、処理の中身は純粋関数に任せる。
- すべての関数は10行以下、`const` のみで実装する（`test/code-rules.test.js` で自動チェック）。
- `innerHTML` には `templates.js` でエスケープ済みの文字列だけを渡す。設定値は `textContent` で反映する。

## 4. ダミー設定と上書き仕様

### 4.1 設定項目（DEFAULT_CONFIG）

| キー | 説明 | ダミー値 |
| --- | --- | --- |
| `clubName` | クラブ名 | `あおぞら総合型地域スポーツクラブ` |
| `clubShortName` | 略称 | `あおぞらクラブ` |
| `address` | 所在地 | `架空県みどり市さくら町1-2-3` |
| `tel` | 電話番号 | `000-000-0000` |
| `telHours` | 電話受付時間 | `受付：火〜土 9:00〜17:00` |
| `access` | 交通案内 | `架空鉄道みどり線「さくら町駅」から徒歩約10分` |
| `venue` | 活動拠点 | `さくら町スポーツセンター（架空）` |
| `copyrightYear` | 著作権表示の年 | `2026` |
| `formEndpoint` | フォーム送信先URL | `''`（空＝送信しない） |
| `newsEndpoint` | お知らせの取得先（GAS の Webアプリの URL） | `''`（空・`http(s)://` 以外の仮の値＝取得せず予備データを表示） |

### 4.2 上書きの手順

1. `config-sample.js` をコピーして `config.js` を作成し、`const SITE_CONFIG = { ... }` に実際の値を書く。
2. `config.js` は `.gitignore` 対象のため、リポジトリにはコミットされない。
3. `config.js` が無い場合、ブラウザは読み込みエラーをコンソールに出すが、ダミー値で正常に表示される。

### 4.3 マージ規則（`mergeConfig`）

- `DEFAULT_CONFIG` に存在するキーだけを上書きする（未知のキーは無視）。
- 上書きに使うのは空でない文字列のみ。前後の空白は除去する。
- 結果は凍結した新しいオブジェクトで、入力は変更しない。

### 4.4 DOM への反映

| 属性 | 反映内容 |
| --- | --- |
| `data-config="キー"` | 要素のテキストを設定値に置き換える（HTML側には同じダミー値を初期表示として記述） |
| `data-tel-link` | `href` を `tel:` + 数字のみの電話番号に置き換える |
| `body[data-page-title]` | `ページ名｜クラブ名` を `document.title` に設定（空ならクラブ名のみ） |
| `body[data-page]` と `[data-nav]` | 現在ページのメニューに `aria-current="page"` を付ける |

## 5. ページ仕様

### 5.1 共通

- ページ間リンクはすべて `./about.html` のように **末尾の `.html` まで明記** する（`test/html-pages.test.js` で検証）。
- ヘッダー：クラブ名（トップへのリンク）、PC表示時は電話番号と受付時間、5ページへのメニュー。
- フッター：クラブ名・所在地・電話（tel リンク）・受付時間・メニュー。
- スマホ表示（幅720px未満）：画面下部に「電話する」「Webで申込」の固定バーを表示する。

### 5.2 トップ（index.html）

- ヒーロー：キャッチコピー、教室案内・体験申込（`./contact.html?type=trial`）へのボタン。
  - メインビジュアル（仮）：PC表示では文章の右、スマホでは文章の下に写真を配置する。メイン写真（芝生でサッカーをする子どもたち）と丸型のサブ写真（芝生とボール）、「はじめての方も大歓迎」のタグで構成する。
  - 写真は Unsplash のダミー画像を外部URLで参照する仮素材。本番では自前の写真（`img/` 配下など）に差し替える。読み込めない場合（オフライン等）は緑のグラデーションが表示される。
  - 下端は芝生の丘をイメージした波形（CSSのSVG背景）で次のセクションへつなぐ。
- 最新お知らせ：表示順（5.4「表示順」）で先頭から3件（`latestNews`）。一覧（`./news.html`）へのリンク。
- 7教室ハイライト：全7教室をカード表示し、`./classes.html#教室ID` へリンク。
- 問い合わせ導線：大きな電話番号（tel リンク）と受付時間、フォームへのボタン。

### 5.3 クラブ概要（about.html）

- 概要表（名称・設立・活動拠点・所在地・会員数・教室数・電話）、理念3項目、会費について（共通の会費システム＋教室の会費・スポーツ安全保険（任意）・体験参加の表）、アクセス表。
- スポーツ安全保険（任意）：表のセル内に `<details>`/`<summary>` の開閉式で表示する。閉じた状態では料金の幅（`800円〜2,000円`）と「区分ごとの料金を見る」だけを見せ、開くと小さな料金表（高校生以上 2,000円／中学生以下 800円／65歳以上 1,200円）と注記を表示する。
  - データ：`js/data/classes-data.js` の `SPORTS_INSURANCE`（`name`、`optional`、`plans`：`insurancePlan(label, amount)` の配列、`note`）。
  - 抽出関数（`class-logic.js`）：`insuranceTitle`（任意なら「（任意）」付き）、`insuranceRows`（[区分, 料金]）、`insuranceRangeText`（最小〜最大。1区分なら金額のみ。内部で `yenRangeText` を使用）。
- 「会費について」ブロックは教室案内と共通（5.5.1 参照）。
- 地図は外部サービスを埋め込まず、準備中の表示とする（実在住所の露出と外部通信を避けるため）。

### 5.4 お知らせ（news.html）

- カテゴリ：すべて／お知らせ（info）／イベント（event）／教室情報（class）／募集（recruit）。
- ボタンで絞り込み、選択中のボタンを `aria-pressed="true"` で示す。件数を `aria-live` で読み上げる。
- 該当なしの場合は「該当するお知らせはありません。」を表示する。

#### データと更新方法（`js/data/news-data.js`）

- 職員が更新しやすいよう、`NEWS_DATA` は `Object.freeze` や `id` を書かない、ふつうのオブジェクトの配列とする。1件は `{ date, category, title, body }`。並び順は自由（表示時に日付の新しい順に並べる）。
- ファイルの先頭のコメントに、追加方法と各項目の書き方を記載する。

| 項目 | 必須 | ルール |
| --- | --- | --- |
| `date` | 必須 | `YYYY-MM-DD` 形式の実在する日付（`2026-02-30` などは不可） |
| `category` | 必須 | `NEWS_CATEGORIES` の ID（`info` / `event` / `class` / `recruit`） |
| `title` | 必須 | 空白だけは不可 |
| `body` | 任意 | 文字列（省略時は空文字として扱う） |

#### 入力チェックと表示用への整形（`js/lib/news-logic.js`・純粋関数）

- `isNewsDate`：日付の形式と実在を判定する。
- `newsEntryErrors(entry, categories)`：1件の誤りを、直し方が分かる日本語メッセージの配列で返す（誤りがなければ空配列）。
- `findNewsProblems(entries, categories)`：誤りのあるお知らせだけを `{ number（1始まり）, title, errors }` で返す。
- `toNewsItem`：前後の空白を除いて凍結した表示用の1件を返す。`prepareNews`：誤りのないお知らせだけを整え、凍結した配列で返す。
- `app.js` は `NEWS_ITEMS = prepareNews(NEWS_DATA, NEWS_CATEGORIES)` をトップ（最新3件）とお知らせ一覧に使う。誤りのあるお知らせは画面に出さず、起動時に `console.warn` で「n件目〈タイトル〉を表示できません：〈誤りの内容〉」を出す。
- 単体テスト（`test/news-logic.test.js`）で `findNewsProblems(NEWS_DATA)` が空であることを確認するため、データの書き間違いは `npm test` でも見つかる。

#### スプレッドシート＋GAS からの取得（F-008）

- 構成：職員がスプレッドシート（シート `news`）を編集 → GAS の Webアプリ（`doGet`）が JSON を返す → サイトの `app.js` が `fetch` → `prepareNews` で検証 → 描画。設定手順は `gas/README.md`。
- `js/data/news-data.js` は予備データとして残す（`newsEndpoint` 未設定・取得失敗時に表示）。

| 列 | 見出し | 内容 | JSON への出力 |
| --- | --- | --- | --- |
| A | ID | お知らせの識別子（省略可） | `id`（文字列） |
| B | 日付 | 日付（入力規則で日付のみ） | `date`（日本時間の `YYYY-MM-DD`） |
| C | カテゴリ | プルダウン（お知らせ／イベント／教室情報／募集） | `category`（ID に変換） |
| D | タイトル | 必須 | `title` |
| E | 本文 | 省略可 | `body` |
| F | 添付ファイルURL | 画像・PDF 等の URL（省略可） | `attachmentUrl`（シートの値のまま。Googleドライブのプレビュー用 URL への変換はサイト側で行う） |
| G | 公開フラグ | チェックボックス、または文字（`TRUE`／`公開`／`1`／`○`／`yes`） | 出力しない（絞り込みのみ） |
| H | 固定順位 | 数値（省略可。入力規則で 1〜9999） | `order`（数値。空や数値でないものは `null`） |

- 公開条件：公開フラグ（`isPublishedFlag`）が公開を示し、日付が今日（日本時間）以前の行のみ（未来の日付は予約公開）。
- 日付：日付型のセルは日本時間の `YYYY-MM-DD` に、文字列のセル（`2026/10/20`・`2026.1.5`・`2026-1-5`・`2026年10月20日`）は `normalizeDateText` で `YYYY-MM-DD` にそろえる。それ以外の形は「日付が読めない」として公開しない。
- 公開されない理由（`rowSkipReason`）：`notPublished`（公開フラグなし）／`invalidDate`（日付が読めない）／`future`（未来の日付）。
- 診断モード：Webアプリの URL に `?debug=1` を付けると、お知らせの代わりに `{ sheetFound, headers, today, rowCount, published, notPublished, invalidDate, future, notPublishedFlagSamples, invalidDateSamples }`（シートが無い場合は `{ sheetFound: false, expectedSheetName, sheetNames }`）を返す。タイトル・本文・添付URLは含めず、キャッシュもしない（`newsRowDiagnostics`）。
- 応答：`{ updatedAt: ISO日時, news: [{ id, date, category, title, body, attachmentUrl, order }] }`。例外時は `{ error: 'お知らせを読み込めませんでした' }`。
- GAS 側（`gas/news-sheet.js`・純粋関数）：`sheetText`、`sheetDateText`（Date→日本時間の日付、文字列はそのまま）、`sheetCategoryId`（日本語名→ID）、`isPublishedFlag`（公開フラグの判定）、`isPublishedRow`、`sheetRowToEntry`、`newsRowsToEntries`、`newsResponse`。
- GAS 側（`gas/news-api.js`・副作用）：`doGet`（JSON を返す）、`CacheService` で5分キャッシュ（3万文字超は保存しない）、`onEdit`（シート編集でキャッシュ削除）、`setupNewsSheet`（新規シートのみ。見出し8列・入力規則・G列のチェックボックスを作成）。応答の形を変えたらキャッシュキーの版数を上げる（現在 `news-json-v3`）。GAS から呼ぶ `doGet` / `onEdit` / `setupNewsSheet` のみ `function` 宣言とする。
- Webアプリの公開設定：実行するユーザー「自分」、アクセスできるユーザー「全員」。シート自体は職員のみに共有する。シートには個人情報を書かない運用とし、公開フラグ列は外部に出さない。添付ファイルも公開してよいものだけを置く。
- サイト側（`js/lib/news-logic.js`・純粋関数）：`isNewsEndpoint`（`http(s)://` で始まる URL のみ true。`YOUR_GAS_WEB_APP_URL` などの仮の値は false）、`parseNewsResponse`（応答から `news` 配列を取り出す。形が違えば `null`）。
- サイト側（`js/app.js`）：`loadNewsItems(config)` が Promise でお知らせを返す。
  - 取得先あり：`fetch`（5秒で `AbortController` により打ち切り）→ HTTP エラー・形式違い・通信失敗・タイムアウトはすべて予備データにフォールバックし、`console.warn` を出す。
  - 取得先なし：すぐに予備データを返す。
  - 取得が終わるまでは HTML の「お知らせを読み込んでいます…」を表示し、終わってから一度だけ描画する（予備データからの差し替えによる表示のちらつきを避ける）。
  - お知らせ一覧の絞り込みは、取得中に押された場合も取得完了後に押された順で反映する。
- 表示する HTML は `templates.js` でエスケープするため、シートに HTML やスクリプトが書かれても実行されない。

#### 表示順（固定順位 `order`）

- 並べ方（`sortNewsForDisplay`・`compareNewsForDisplay`）：固定順位が数値のお知らせを先に小さい順（同じ順位どうしは日付の新しい順）、固定順位がないお知らせはその後ろに日付（B列）の新しい順。トップの最新3件・お知らせ一覧・管理画面の一覧で共通（カテゴリで絞り込んだ後も同じ並べ方）。
- 固定順位の値（`newsOrder`／GAS は `sheetOrder`）：数値または数字だけの文字列なら数値、空や数値でないものは `null`。予備データ（`js/data/news-data.js`）でも `order` を省略可で指定できる。数値でない `order` は入力の誤りとして表示しない。
- 管理画面からの追加では、1〜9999 の整数か空欄のみ受け付け（画面 `adminFormErrors`・GAS `adminInputErrors`）、H列に数値で書き込む。

#### 添付ファイルの表示（`attachmentUrl`）

- 判定・変換はサイト側の純粋関数（`js/lib/news-logic.js`）で行う。GAS はシートの値をそのまま返す。
  - `isHttpsUrl`：`https://` で始まり、空白・引用符・山かっこを含まない URL のみ使う（`http:`・`javascript:` 等は使わない）。
  - `driveFileId`：Googleドライブの共有リンク（`/file/d/ID/…`・`open?id=ID`・`uc?id=ID`）からファイルIDを取り出す。
  - `attachmentPreviewSrc`：ドライブは `https://drive.google.com/thumbnail?id=ID&sz=w800`、拡張子が jpg / jpeg / png / gif / webp / avif の URL はそのまま、それ以外はプレビューなし。
  - `newsAttachment`：`{ href（開くURL＝元のURL）, previewSrc }` を返す（使えない URL は `null`）。
  - `findAttachmentProblems`：添付URLが書かれているのに使えないお知らせを返す。お知らせ自体は表示し、添付だけ出さずに `console.warn` で知らせる。
  - `toNewsItem` は `id` と `attachmentUrl`（使えない URL は空文字）も表示用データに残す。
- 画面（`templates.js` の `newsAttachmentHtml`）：
  - プレビューあり：画像（クリックで添付を開く。ボタンと重複するため読み上げ・Tab移動の対象外）＋「📎 添付ファイルを開く」ボタン。
  - プレビューなし（PDF 等）：ボタンのみ。
  - リンクは新しいタブで開く（`target="_blank" rel="noopener noreferrer"`）。画像は `loading="lazy"`・`referrerpolicy="no-referrer"`。
  - トップの最新3件（`.news-list--compact`）はプレビューを出さずボタンのみ。
  - プレビュー画像が読み込めない場合（非公開のドライブファイル等）は、`app.js` が document のキャプチャ段階で `error` を受け取り、プレビュー枠を削除してボタンだけを残す。
- ドライブのファイルを添付する場合は、共有設定を「リンクを知っている全員が閲覧可」にする（そうでないとプレビューが出ず、閲覧者は開けない）。

### 5.5 教室案内（classes.html）

| ID | 教室名 | 対象 | 曜日 | 時間 | 定員 | 会費 | 絞り込み年代 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `track-kids` | 陸上教室① | 小学生 | 土曜日 | 18:00〜19:30 | 40名 | 4,200円／3ヶ月（全6回） | 小学生 |
| `track-teen` | 陸上教室② | 小学3年生〜中学3年生 | 火曜日 | 18:30〜19:30 | 各クラス40名 | 7,000円／3ヶ月（全10回） | 小学生・中高生 |
| `play` | 運動あそび教室 | ①年少〜年長 ②小学生 | 金曜日 | ①17:00〜18:00 ②18:15〜19:15 | ①20名 ②25名 | 4,800円／3ヶ月（全8回） | 幼児・小学生 |
| `gymnastics` | 体操教室 | ①年少〜年長 ②小学生 | 水曜日 | ①17:00〜18:00 ②18:15〜19:15 | ①8名 ②15名 | 3,600円 | 幼児・小学生 |
| `table-tennis` | 卓球教室 | 小学生〜大人 | 水曜日 | 19:00〜20:30 | 20名 | 4,200円／3ヶ月（全6回） | 小学生・中高生・一般・シニア |
| `weightlifting` | ウエイトリフティング教室 | 小学生〜高校生 | 隔週 | 19:00〜20:30 | 15名 | 5,000円／3ヶ月（全10回） | 小学生・中高生 |
| `senior-strength` | 高齢者向け筋力アップ教室 | 運動制限をされていない女性等 | 水曜日 | 10:00〜11:00 | 15名 | 4,000円／3ヶ月（全8回） | シニア |

#### データ構造（`js/data/classes-data.js`）

| キー | 内容 |
| --- | --- |
| `id` / `icon` / `name` | 教室ID・アイコン・教室名 |
| `ages` | 絞り込み用の年代ID配列（`AGE_GROUPS` の ID） |
| `day` | 曜日（例：`金曜日`、`隔週`） |
| `sessions` | クラス（時間帯）の配列。`classSession(label, target, time, capacity, capacityNote)` で作る。`label` は「①」などの区分（1クラスなら空）、`capacity` は数値、`capacityNote` は「各クラス」などの補足 |
| `fee` | `classFee(amount, term, count)`。金額（数値）・期間（例：`3ヶ月`）・回数。期間・回数が無い場合は省略 |
| `place` / `summary` | 会場・紹介文（架空のダミー） |

#### 会費システム（全教室共通・`FEE_SYSTEM`）

- 年間を4期（第1期 4〜6月、第2期 7〜9月、第3期 10〜12月、第4期 1〜3月）に分けて実施する。
- 年会費は1,000円で年度内1回のみ（複数教室を受講する場合も1回のみで可）。
- 各教室の会費は期ごとの支払いとなる。
- データは `js/data/classes-data.js` の `FEE_SYSTEM`（`terms`：`feeTerm(label, months)` の配列、`annualFee`、`annualFeeNote`、`classFeeNote`、`trialNote`、`disclaimer`）に1か所だけ定義する。
- 表示場所：「会費について」ブロック（5.5.1）の中。教室案内では年代フィルタの直上、クラブ概要では理念とアクセスの間。

#### 表示用の抽出関数（`js/lib/class-logic.js`）

- `formatYen`（`4,200円`）、`formatFee`（`4,200円／3ヶ月（全6回）`）、`formatCapacity`（`各クラス40名`）、`sessionHeading`（`① 年少〜年長`）、`classTargetSummary`（クラスごとの対象を「・」で連結）
- `classMainRows`：カード上段。対象・曜日に加え、1クラスの教室は時間・定員も含める。
- `sessionRows`：複数クラスの教室で、クラスごとの時間・定員を返す。
- `classFeeRows`：カード下段。会費・会場（年会費は教室ごとには持たず、共通の会費システムで案内する）。
- `feeTermsText`：期の月を「4〜6月、7〜9月、…」の形で連結する。
- `feeSystemRows`：会費システムの [項目名, 値]（実施期間・年会費・教室の会費）。

#### 画面表示

- カード：教室名、年代バッジ、紹介文、上段（対象・曜日〔・時間・定員〕）、複数クラスの教室はクラス別の小枠（①②ごとに時間・定員）、下段（会費・会場、薄いオレンジ背景）、`./contact.html?type=trial&class=教室ID` への体験申込ボタン。
- トップのハイライトには「対象／曜日」を表示する。
- 年代フィルタ：すべての年代／幼児／小学生／中高生／一般（大人）／シニア。複数年代の教室は該当する各年代で表示する。
- `#教室ID` 付きで開いた場合は、描画後にその教室の位置まで移動する。
- 会場・紹介文は架空のダミー値。

### 5.5.1 「会費について」共通ブロック（about.html・classes.html）

- 両ページとも、見出し `<h2 id="fee-heading">会費について</h2>` の下に `<div class="fee-info" data-fee-info></div>` を1つ置き、`app.js` の `renderFeeInfo` が `feeInfoHtml(CLASSES_DATA, FEE_SYSTEM, SPORTS_INSURANCE)` で同じ内容を描画する（HTMLはコピーせず、テンプレートを共通化）。
- ブロックの構成（上から）：
  1. 緑枠の「会費システム 全教室共通」（4期・実施期間・年会費・教室の会費）
  2. 表：教室の会費（`1期あたり` + `classFeeRangeText` で教室データから計算した幅＋`./classes.html#class-list-heading` へのリンク）／スポーツ安全保険（任意）（開閉式の料金表）／体験参加（`trialNote`）
  3. 注記（`disclaimer`）
- 教室案内での配置：ページ見出し → 会費について → 年代フィルタ → 教室カード。PC表示でも余白が開きすぎないよう `.section.section--compact` / `.section.section--after-compact` で上下の余白を詰める。

### 5.6 お問い合わせ・体験申込（contact.html）

- 電話受付案内：大きな電話番号（tel リンク）と受付時間を最上部に表示する。
- URLクエリ `type`・`class` で種別と希望教室を初期選択する（`class` だけ指定時は種別を体験申込にする。不正値は無視）。

| 項目 | name | 必須 | 検証ルール |
| --- | --- | --- | --- |
| 種別 | `inquiryType` | 必須 | `trial`（体験申込）／`question`（教室・入会についての質問）／`other`（その他）のいずれか |
| 希望教室 | `classId` | 体験申込のとき必須 | 7教室のIDのいずれか（質問・その他は未選択可） |
| お名前 | `name` | 必須 | 50文字以内 |
| メールアドレス | `email` | 必須 | `xxx@xxx.xx` 形式 |
| 電話番号 | `tel` | 任意 | 数字・ハイフン等のみで数字10〜11桁 |
| 内容 | `message` | 質問・その他のとき必須 | 1000文字以内 |
| 同意 | `agree` | 必須 | チェックあり |

- 入力値は前後の空白を除去してから検証する（`validateForm` は `{ valid, values, errors }` を返す）。
- エラー時：項目ごとに赤字のメッセージ、`aria-invalid="true"`、フォーム上部にエラー件数（`role="alert"`）を表示し、最初のエラー項目へフォーカスする。
- 送信：
  - `formEndpoint` が空（既定）の場合：どこにも送信せず、完了画面に「デモ設定のため送信・保存されていません」と表示する。
  - `formEndpoint` が設定されている場合：JSON を POST し、成功時に完了画面、失敗時に電話案内付きのエラーを表示する。
- 完了画面：「送信が完了しました」と入力内容の一覧（エスケープ済み）を表示し、見出しにフォーカスを移す。

### 5.7 お知らせ管理画面（admin.html・F-009）

- 職員がスプレッドシートを開かずに、お知らせの追加（添付ファイルのアップロードを含む）と登録済みの一覧の確認を行う画面。公開ページのメニューからはリンクせず、`<meta name="robots" content="noindex, nofollow">` で検索エンジンに載せない。
- スクリプト：`app.js` の代わりに `js/lib/admin-logic.js`（純粋関数）と `js/admin.js`（画面操作・通信）を読み込む。取得先は公開ページと同じ `config.js` の `newsEndpoint`。

#### 認証（共通パスワード）

- 職員共通のパスワード1つ。誰が更新したかの履歴は持たない。
- パスワードはコード・HTML・リポジトリに書かず、GAS の「スクリプト プロパティ」`ADMIN_PASSWORD` に登録する（未設定の場合は誰もログインできない）。照合は GAS 側（`isAdminPasswordMatch`）で行い、画面側では判定しない。
- 画面は入力されたパスワードを `sessionStorage` に置き（タブを閉じると消える）、すべての操作でパスワードを送る。GAS が `auth: false` を返したらログイン画面に戻す。
- 総当たり対策：失敗回数を CacheService に記録し、15分以内に10回失敗したら15分間は正しいパスワードでも受け付けない。

#### 通信（admin.html → GAS doPost）

- `fetch` の POST で、本文は JSON の文字列 `{ action, password, data }`（`Content-Type: text/plain` の単純なリクエストにして事前確認の通信を避ける）。応答は `{ ok, errors[], ... }`（`normalizeAdminResponse` で形をそろえる）。60秒で打ち切る。
- エラーの原因の特定（`js/lib/admin-logic.js`・純粋関数）：応答は文字列で受け取り、`parseAdminHttpResponse` で次のように区別する。失敗した場合は `{ ok: false, errors, detail }` を返し、画面には `adminErrorLines` で「詳細：…」の行を付けて表示し、`console.error` にも `[お知らせ管理] 「操作名」に失敗しました` として出す。
  - HTTP エラー：「サーバーがエラーを返しました（HTTP 状態コード）」＋本文の先頭（`responseSnippet`：HTML のタグを除き300文字まで）。
  - JSON でない応答（Google のログイン画面・エラーページなど）：「応答が JSON ではありませんでした」＋本文の先頭。
  - 通信の失敗（`describeFetchError`）：`AbortError` はタイムアウト、`TypeError` は通信不可（ネットワーク・URL の誤り・CORS）、それ以外は予期しないエラー。詳細は「エラー名: メッセージ」。
  - GAS が返したエラー：`errors` と、あれば `detail` をそのまま表示する。
  - 送信後の画面処理やファイルの読み込みで起きたエラー（`reportSubmitError`）：エラー名で文言を分け、詳細を表示して `console.error` に出す。
- GAS の `doPost` で例外が起きた場合は、`{ ok: false, errors: [「処理中にエラーが発生しました…」], detail: 「例外の種類: メッセージ」（300文字まで、`adminErrorDetail`） }` を返す。例外は GAS の「実行数」にも記録される。

| action | 内容 | 応答 |
| --- | --- | --- |
| `login` | パスワードの確認のみ | `{ ok: true }` |
| `list` | 下書き・予約公開を含む全件（`adminNewsList`。状態 `status`：published／notPublished／future／invalidDate） | `{ ok: true, news: [...] }` |
| `create` | お知らせの追加（`data`：date・category・title・body・attachmentUrl・published・order・file） | `{ ok: true, id, attachmentUrl }` |

- 追加の流れ（GAS）：入力チェック（`adminInputErrors`・`adminFileErrors`）→ `LockService` で排他 → 添付ファイルがあればドライブに保存 → ID を自動採番（`nextNewsId`：数字のIDの最大値＋1）→ シート末尾に追加（`adminInputToRow`。カテゴリは日本語名、公開フラグは「公開」／「非公開」、先頭が `= + - @` の文字は `'` を付けて数式の実行を防ぐ）→ 公開用キャッシュを削除してすぐサイトに反映。
- 入力の上限：タイトル100文字（必須）、本文2000文字、添付URLは https で500文字まで。日付は実在する `YYYY-MM-DD`。画面側（`adminFormErrors`）でも確認するが、最終的な検証は GAS 側で必ず行う。
- 削除・編集は現時点では行わない（シートを直接編集する）。

#### 添付ファイルのアップロード

- 画面の `<input type="file">` で PDF・JPEG・PNG・GIF・WebP（10MBまで）を選ぶ。`FileReader` で Base64 にし、`data.file = { name, type, data }` として送る。ファイルを選んだ場合は「添付ファイルのURL」欄より優先する。
- GAS は Base64 を復元して、マイドライブの専用フォルダ「お知らせ添付ファイル」に保存する（初回に自動作成し、フォルダIDをスクリプト プロパティ `ADMIN_FOLDER_ID` に保存。別のフォルダを使う場合はこの値を書き換える）。ファイル名は `日付_元のファイル名`（使えない文字は `_`、名前は100文字まで）。
- 保存したファイルは「リンクを知っている全員が閲覧可」にし、その共有URL（`https://drive.google.com/file/d/ID/view?…`）をシートの F列に書く。サイト側は既存の仕組み（5.4）でプレビューとボタンを表示する。
- 受け付ける種類・大きさは GAS（`NEWS_ADMIN_FILE_TYPES`・`NEWS_ADMIN_MAX_FILE_BYTES`）と画面（`ADMIN_UPLOAD_TYPES`・`ADMIN_UPLOAD_MAX_BYTES`）で同じ値にする（単体テストで一致を確認）。

## 6. デザイン方針

- 芝生や木々を連想させるグリーン系を基調にする（メイン：フォレストグリーン `#2a7348`、濃色 `#1e5a38`、若草色 `#8cc63f`〔装飾のみ〕、背景 `#f6faf1`）。申込ボタンはオレンジ系で目立たせる。文字色と背景色のコントラストはWCAG AA相当を確保する。
- 親しみやすさを重視し、角丸は大きめ（カード22px・小要素14px）、カードとセクションの余白はゆったりとる。見出しは丸ゴシック系（端末にある場合のみ。外部フォントは読み込まない）。
- 装飾：セクション見出しの左に丸いアイコン（見出しIDごとの絵文字、CSSの `::before`）と下に若草色の短いライン、お知らせカードの左端にカテゴリ別の色帯とカテゴリバッジのアイコン、教室アイコンの丸背景、理念・問い合わせ枠のアイコン。装飾の絵文字は `content: "…" / ""` で読み上げ対象から外す。HTMLの見出しテキストは変更しない。
- 動きを減らす設定（`prefers-reduced-motion`）ではカードのホバー移動を無効にする。
- 本文18px・行間1.8。ボタンや選択肢のタップ領域は高さ44px以上。
- モバイルファーストのレスポンシブ設計（幅720pxでPC用レイアウトに切り替え）。幅480px未満ではクラブ概要の表（`.info-table`）を見出し・内容の縦並びにする。画面幅320pxでも横スクロールが出ないようにする。
- フォーカス枠を明示し、スキップリンク・`aria-live`・`aria-current` 等で支援技術に配慮する。
- 外部フォント・外部CDNは使わない（オフライン・`file://` でも同じ表示にするため）。例外として、トップの仮メインビジュアルのみ Unsplash の画像URLを参照する（読み込めなくても表示は崩れない）。

## 7. テスト方針

- 実装中：`node --test`（または `npm test`）による単体テストのみ実行する。
  - `config-merge` / `news-logic` / `class-logic` / `form-validate` / `templates`：各純粋関数
  - `browser-scripts`：全スクリプトをブラウザと同じ順で1つの実行環境に読み込み、名前の衝突がないこと、`config.js` による上書き、お知らせ取得（偽の `fetch` で成功・HTTPエラー・形式違い・未設定）を検証
  - `html-pages`：リンクの `.html` 明記・リンク先の存在・スクリプト順・ファイル名規約
  - `code-rules`：関数10行以下・`let` / `var` 不使用（対象：`js/`・`gas/`・`test/`。GAS用の `function` 宣言も含む）
  - `gas-news-sheet`：シートの行の変換（日本時間の日付・カテゴリ名・公開フラグの判定・公開条件・ID と添付ファイルURL の出力）
  - `gas-news-api`：偽の SpreadsheetApp・CacheService・ContentService 上で `doGet`・キャッシュ・`onEdit`・エラー時の JSON を検証
- マージ直前：ヘッドレスChromeによる画面E2E確認を、変更箇所に対して1回だけ実行する。

## 8. 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-10-20 | 初期セットアップ（CLAUDE.md、.gitignore、SPEC.md の作成） |
| 2026-10-20 | サイト一式（5ページ、設定上書き機構、お知らせ・教室の絞り込み、問い合わせフォーム、単体テスト）を実装 |
| 2026-10-20 | 教室案内を更新（7教室の対象・曜日・時間・定員・会費、クラス別表示、年会費表示） |
| 2026-10-20 | 全教室共通の会費システムを教室案内・クラブ概要に追加。陸上教室②の曜日を火曜日のみに修正。体操教室の個別年会費を廃止し共通ルールに統合 |
| 2026-10-20 | クラブ概要の保険欄を「スポーツ安全保険（任意）」に改め、区分別料金を開閉式の小さな表で追加 |
| 2026-10-20 | 「会費について」ブロック全体を共通テンプレート化し、教室案内の年代フィルタ直上にも配置 |
| 2026-10-22 | デザインをグリーン系に刷新（配色・角丸・余白）、トップに仮メインビジュアル（Unsplash）を追加、各セクションにアイコンと装飾を追加。HTMLテストのスクリプト順検証を `<script>` タグに限定 |
| 2026-10-22 | お知らせデータを freeze・id 不要の簡単な書き方に変更し、入力チェック（誤りは非表示＋警告＋テストで検出）を追加 |
| 2026-10-22 | お知らせをスプレッドシート＋GAS の Webアプリから fetch で取得する仕組みを追加（gas/ のスクリプト・設定手順書、予備データへのフォールバック、予約公開） |
| 2026-10-22 | スプレッドシートの列構成を確定版（A:ID／B:日付／C:カテゴリ／D:タイトル／E:本文／F:添付ファイルURL／G:公開フラグ）に変更し、GAS の応答に `id`・`attachmentUrl` を追加 |
| 2026-10-22 | お知らせに添付ファイルの画像プレビューと「添付ファイルを開く」ボタンを追加（Googleドライブの共有リンクはサムネイルURLに変換） |
| 2026-10-22 | GAS で文字列の日付（`2026/10/20` 等）が未来と判定され公開されない不具合を修正。`?debug=1` の診断モードを追加 |
| 2026-10-22 | お知らせ管理画面（admin.html）を追加：共通パスワード（スクリプト プロパティ）でログインし、お知らせの追加・一覧表示、添付ファイルのドライブ保存に対応 |
| 2026-10-22 | スプレッドシートの H列に「固定順位」を追加し、数値があるお知らせを先に昇順、ないものを日付の新しい順で表示。管理画面に固定順位の入力欄と一覧の順位列を追加 |
| 2026-10-22 | 管理画面の通信エラーの原因（HTTP エラー・JSON でない応答・通信失敗・GAS の例外の詳細）を画面と console.error に出すよう改修 |
