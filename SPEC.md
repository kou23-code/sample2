# SPEC.md（仕様書）

> 機能追加・修正時は必ず本書を最新状態に更新すること。
> 本書には実在の名称・個人情報を記載せず、架空のダミー情報のみを使用すること。

## 1. プロジェクト概要

| 項目 | 内容 |
| --- | --- |
| システム名 | （未定：例「サンプル施設案内システム」） |
| 目的 | （未定：本システムで解決したい課題を記載） |
| 想定利用者 | （未定：例「一般利用者」「管理担当者」） |
| 構成 | サーバーレス構成の静的Webサイト（HTML / CSS / JavaScript） |
| 公開先 | GitHub Pages 等の静的ホスティング |
| 個人情報の扱い | サーバー上には一切保持しない |

### 1.1 機能一覧

| ID | 機能名 | 概要 | 状態 |
| --- | --- | --- | --- |
| F-001 | （未定） | （未定） | 未着手 |

## 2. ディレクトリ構成（予定）

```
/
├─ index.html              トップページ
├─ js/
│  ├─ default-config.js    ダミー設定（リポジトリに含める）
│  └─ config-loader.js     設定の読み込み・マージ処理
├─ config.js               実名設定（.gitignore 対象・任意）
├─ test/                   Node.js 標準テストランナーによる単体テスト
├─ SPEC.md
└─ .claude/CLAUDE.md
```

※ フォルダ名・ファイル名は半角英数字とハイフンのみとする。

## 3. ダミー設定の読み込み仕様

### 3.1 基本方針

- リポジトリには架空のダミー情報のみを含む `default-config.js` をコミットする。
- 実名表示が必要な環境では、`.gitignore` 対象の `config.js`（または `local-config.js`）を配置し、ダミー値を上書きする。
- `config.js` が存在しない場合でも、ダミー情報のみで正常に動作すること。

### 3.2 設定項目（ダミー値の例）

| キー | 説明 | ダミー値 |
| --- | --- | --- |
| `siteName` | サイト名 | `サンプル施設` |
| `organizationName` | 運営団体名 | `架空団体ダミー` |
| `address` | 住所 | `〇〇県△△市1-2-3` |
| `tel` | 電話番号 | `000-0000-0000` |
| `email` | メールアドレス | `info@example.com` |

※ メールアドレスは予約ドメイン `example.com` 等を使用する。

### 3.3 読み込み順序

1. `default-config.js` を読み込み、`window.DEFAULT_CONFIG` にダミー設定を定義する。
2. `config.js` を読み込む（存在しない場合は読み込みエラーを無視する）。存在する場合は `window.LOCAL_CONFIG` に上書き値を定義する。
3. `config-loader.js` が両者をマージし、最終設定を生成する（`LOCAL_CONFIG` の値を優先）。

```html
<script src="js/default-config.js"></script>
<script src="config.js" onerror="void 0"></script>
<script src="js/config-loader.js"></script>
```

### 3.4 マージ処理（純粋関数）

```js
// 副作用なし：入力を変更せず新しいオブジェクトを返す
const mergeConfig = (defaults, overrides) => ({ ...defaults, ...(overrides ?? {}) });
```

- 再代入を行わず `const` のみで実装する。
- 単体テストは Node.js 標準テストランナー（`node --test`）で実施する。

## 4. テスト方針

- 実装中：`node --test` による単体テストのみを実行する。
- マージ直前：ヘッドレスChrome等による画面E2Eテストを、変更箇所のみ1回だけ実行する。

## 5. 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-10-20 | 初期セットアップ（CLAUDE.md、.gitignore、SPEC.md の作成） |
