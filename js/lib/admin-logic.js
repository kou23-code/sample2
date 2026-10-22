// お知らせ管理画面（admin.html）で使う純粋関数群（DOMには触れない）
// 入力チェックは使いやすさのためのもので、パスワードの確認と最終的な検証は GAS 側で必ず行う

// ブラウザでは先に読み込んだ各スクリプトのグローバル関数、Node.js では require で取得する
const adminDeps = typeof module === 'object' && module.exports
  ? { ...require('./news-logic.js'), ...require('./templates.js') }
  : { newsText, isNewsDate, isHttpsUrl, formatDateJa, categoryLabel, sortNewsByDate, escapeHtml };

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

// フォームの値の誤り（GAS 側でも同じ内容を確認する）
const adminFormErrors = (values, categories) => [
  adminDeps.isNewsDate(values.date) ? '' : '日付を選んでください',
  categories.some((category) => category.id === values.category) ? '' : 'カテゴリを選んでください',
  adminDeps.newsText(values.title) ? '' : 'タイトルを入力してください',
  adminDeps.newsText(values.attachmentUrl) === '' || adminDeps.isHttpsUrl(values.attachmentUrl)
    ? '' : '添付ファイルURLは https:// で始まるURLにしてください',
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
  ...(file ? { file } : {}),
});

// GAS へ送る本文（事前確認の通信が起きない text/plain で送るため、JSON の文字列にする）
const adminRequestBody = (action, password, data) => JSON.stringify({ action, password, data });

// GAS の応答を { ok, errors, ... } の形にそろえる（形が違えば失敗扱い）
const normalizeAdminResponse = (json) =>
  json !== null && typeof json === 'object' && typeof json.ok === 'boolean'
    ? { ...json, errors: Array.isArray(json.errors) ? json.errors.map(String) : [] }
    : { ok: false, errors: ['サーバーからの応答を読み取れませんでした'] };

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
    <td>${adminDeps.escapeHtml(adminDeps.categoryLabel(categories, item.category))}</td>
    <td>${adminDeps.escapeHtml(item.title)}${item.attachmentUrl ? ' <span class="admin-clip" role="img" aria-label="添付あり">📎</span>' : ''}</td>
  </tr>`;

// 管理画面の一覧（日付の新しい順。下書き・予約公開も含む）
const adminNewsTableHtml = (list, categories) =>
  list.length === 0
    ? '<tr><td colspan="5" class="admin-table__empty">お知らせはまだありません。</td></tr>'
    : adminDeps.sortNewsByDate(list).map((item) => adminNewsRowHtml(item, categories)).join('');

if (typeof module === 'object' && module.exports) {
  module.exports = {
    ADMIN_UPLOAD_TYPES, ADMIN_UPLOAD_MAX_BYTES, ADMIN_STATUS_LABELS, uploadFileErrors, adminFormErrors, dataUrlBase64,
    adminNewsPayload, adminRequestBody, normalizeAdminResponse, dateInputValue, adminCategoryOptionsHtml, adminNewsTableHtml,
  };
}
