// お知らせ管理画面（admin.html）で使う純粋関数群（DOMには触れない）
// 入力チェックは使いやすさのためのもので、パスワードの確認と最終的な検証は GAS 側で必ず行う

// ブラウザでは先に読み込んだ各スクリプトのグローバル関数、Node.js では require で取得する
const adminDeps = typeof module === 'object' && module.exports
  ? { ...require('./news-logic.js'), ...require('./templates.js') }
  : { newsText, isNewsDate, isHttpsUrl, formatDateJa, categoryLabel, sortNewsForDisplay, escapeHtml };

// 一覧の表の列数（ID・日付・状態・順位・カテゴリ・タイトル）。読み込み中・空の行の colspan に使う
const ADMIN_TABLE_COLUMNS = 6;
const ADMIN_ORDER_MAX = 9999;

// 送れる添付ファイルの種類と大きさ（GAS の NEWS_ADMIN_FILE_TYPES・NEWS_ADMIN_MAX_FILE_BYTES と同じ）
const ADMIN_UPLOAD_TYPES = Object.freeze(['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ADMIN_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const ADMIN_STATUS_LABELS = Object.freeze({
  published: '公開中', notPublished: '非公開', future: '予約公開', invalidDate: '日付エラー',
});

// 選んだファイル { name, type, size } の誤り（未選択なら空配列）
const uploadFileErrors = (file) =>
  !file ? [] : [
    ADMIN_UPLOAD_TYPES.includes(file.type) ? '' : '添付ファイルは PDF・JPEG・PNG・GIF・WebP のいずれかにしてください',
    file.size <= ADMIN_UPLOAD_MAX_BYTES ? '' : '添付ファイルは10MB以下にしてください',
  ].filter(Boolean);

// 固定順位は空欄（日付順）か、1〜9999 の整数
const isAdminOrderInput = (value) => {
  const text = adminDeps.newsText(value);
  return text === '' || (/^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= ADMIN_ORDER_MAX);
};

// フォームの値の誤り（GAS 側でも同じ内容を確認する）
const adminFormErrors = (values, categories) => [
  adminDeps.isNewsDate(values.date) ? '' : '日付を選んでください',
  categories.some((category) => category.id === values.category) ? '' : 'カテゴリを選んでください',
  adminDeps.newsText(values.title) ? '' : 'タイトルを入力してください',
  adminDeps.newsText(values.attachmentUrl) === '' || adminDeps.isHttpsUrl(values.attachmentUrl)
    ? '' : '添付ファイルURLは https:// で始まるURLにしてください',
  isAdminOrderInput(values.order) ? '' : `固定順位は1〜${ADMIN_ORDER_MAX}の整数で入力してください（空欄なら日付順）`,
].filter(Boolean);

// FileReader の結果 "data:application/pdf;base64,xxxx" から Base64 の部分だけを取り出す
const dataUrlBase64 = (dataUrl) => String(dataUrl).slice(String(dataUrl).indexOf(',') + 1);

// 送信するお知らせ（ファイルを選んだ場合はファイルを優先し、添付ファイルURLの入力は使わない）
const adminNewsPayload = (values, file) => Object.freeze({
  date: adminDeps.newsText(values.date),
  category: adminDeps.newsText(values.category),
  title: adminDeps.newsText(values.title),
  body: adminDeps.newsText(values.body),
  attachmentUrl: file ? '' : adminDeps.newsText(values.attachmentUrl),
  published: values.published === 'on',
  order: adminDeps.newsText(values.order),
  ...(file ? { file } : {}),
});

// GAS へ送る本文（事前確認の通信が起きない text/plain で送るため、JSON の文字列にする）
const adminRequestBody = (action, password, data) => JSON.stringify({ action, password, data });

// GAS の応答を { ok, errors, ... } の形にそろえる（形が違えば失敗扱い）
const normalizeAdminResponse = (json) =>
  json !== null && typeof json === 'object' && typeof json.ok === 'boolean'
    ? { ...json, errors: Array.isArray(json.errors) ? json.errors.map(String) : [] }
    : { ok: false, errors: ['サーバーからの応答を読み取れませんでした'] };

// ---- エラーの原因を特定しやすくするための詳細 ----

const ADMIN_DETAIL_MAX_CHARS = 300;

// 失敗の結果（画面に出すメッセージと、原因調査用の詳細）
const adminFailure = (message, detail) => Object.freeze({ ok: false, errors: [message], detail: String(detail ?? '') });

// 応答本文の先頭（HTML のタグを除き、空白をまとめて300文字まで）。Google のエラーページの内容を知るため
const responseSnippet = (text) =>
  String(text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, ADMIN_DETAIL_MAX_CHARS);

// JSON として読めなければ undefined を返す
const parseJsonText = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    return undefined;
  }
};

// fetch の応答 { ok, status, text } を結果にする（HTTP エラー・JSON でない応答も原因が分かる形で返す）
const parseAdminHttpResponse = ({ ok, status, text }) => {
  if (!ok) return adminFailure(`サーバーがエラーを返しました（HTTP ${status}）`, responseSnippet(text));
  const json = parseJsonText(text);
  if (json === undefined) {
    return adminFailure('サーバーの応答が JSON ではありませんでした（GAS のデプロイ設定・アクセスできるユーザーを確認してください）', responseSnippet(text));
  }
  return normalizeAdminResponse(json);
};

// fetch 自体の失敗（タイムアウト／CORS・ネットワーク・URL の誤りなど）を結果にする
const describeFetchError = (error) => {
  const detail = `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}`;
  if (error?.name === 'AbortError') return adminFailure('60秒たっても応答がないため中断しました。時間をおいてもう一度お試しください', detail);
  if (error?.name === 'TypeError') return adminFailure('サーバーと通信できませんでした（インターネット接続・config.js の URL・CORS の可能性があります）', detail);
  return adminFailure('通信中に予期しないエラーが発生しました', detail);
};

// 画面に出すメッセージ（詳細があれば最後に「詳細：…」を付ける）
const adminErrorLines = (result) => [...result.errors, ...(result.detail ? [`詳細：${result.detail}`] : [])];

// 日付入力欄の初期値（その端末の今日の日付を 'YYYY-MM-DD' にする）
const dateInputValue = (date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n, i) => String(n).padStart(i === 0 ? 4 : 2, '0')).join('-');

const adminCategoryOptionsHtml = (categories) =>
  categories.map((c) => `<option value="${adminDeps.escapeHtml(c.id)}">${adminDeps.escapeHtml(c.label)}</option>`).join('');

const adminDateText = (date) => (adminDeps.isNewsDate(date) ? adminDeps.formatDateJa(date) : date);

const adminNewsRowHtml = (item, categories) => `
  <tr>
    <td>${adminDeps.escapeHtml(item.id)}</td>
    <td>${adminDeps.escapeHtml(adminDateText(item.date))}</td>
    <td><span class="status status--${adminDeps.escapeHtml(item.status)}">${adminDeps.escapeHtml(ADMIN_STATUS_LABELS[item.status] ?? item.status)}</span></td>
    <td>${typeof item.order === 'number' ? adminDeps.escapeHtml(item.order) : '<span aria-label="固定順位なし">—</span>'}</td>
    <td>${adminDeps.escapeHtml(adminDeps.categoryLabel(categories, item.category))}</td>
    <td>${adminDeps.escapeHtml(item.title)}${item.attachmentUrl ? ' <span class="admin-clip" role="img" aria-label="添付あり">📎</span>' : ''}</td>
  </tr>`;

// 一覧の表の、全列にまたがる案内の行（読み込み中・空・エラー）
const adminTableNoticeHtml = (message) =>
  `<tr><td colspan="${ADMIN_TABLE_COLUMNS}" class="admin-table__empty">${adminDeps.escapeHtml(message)}</td></tr>`;

// 管理画面の一覧（サイトと同じ表示順：固定順位があるものを先に、ほかは日付の新しい順。下書き・予約公開も含む）
const adminNewsTableHtml = (list, categories) =>
  list.length === 0
    ? adminTableNoticeHtml('お知らせはまだありません。')
    : adminDeps.sortNewsForDisplay(list).map((item) => adminNewsRowHtml(item, categories)).join('');

if (typeof module === 'object' && module.exports) {
  module.exports = {
    ADMIN_UPLOAD_TYPES, ADMIN_UPLOAD_MAX_BYTES, ADMIN_STATUS_LABELS, uploadFileErrors, adminFormErrors, dataUrlBase64,
    adminNewsPayload, adminRequestBody, normalizeAdminResponse, dateInputValue, adminCategoryOptionsHtml, adminNewsTableHtml,
    adminTableNoticeHtml, ADMIN_TABLE_COLUMNS, ADMIN_ORDER_MAX,
    adminFailure, responseSnippet, parseAdminHttpResponse, describeFetchError, adminErrorLines,
  };
}
