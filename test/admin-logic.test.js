// 管理画面の純粋関数（js/lib/admin-logic.js）の単体テスト
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { NEWS_CATEGORIES } = require('../js/data/news-data.js');
const admin = require('../js/lib/admin-logic.js');

const okValues = { date: '2026-10-22', category: 'info', title: ' 教室のお休み ', body: '本文', attachmentUrl: '', published: 'on' };

test('ファイル未選択なら誤りなし、PDF・画像で10MB以下なら誤りなし', () => {
  assert.deepEqual(admin.uploadFileErrors(undefined), []);
  assert.deepEqual(admin.uploadFileErrors({ name: 'a.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 }), []);
});

test('種類違い・10MB超のファイルは日本語の誤りを返す', () => {
  assert.deepEqual(admin.uploadFileErrors({ name: 'a.exe', type: 'application/x-msdownload', size: 10 * 1024 * 1024 + 1 }),
    ['添付ファイルは PDF・JPEG・PNG・GIF・WebP のいずれかにしてください', '添付ファイルは10MB以下にしてください']);
});

test('受け付けるファイルの種類と大きさは GAS 側の定義と一致している', () => {
  const context = vm.createContext({});
  ['gas/news-sheet.js', 'gas/news-admin.js'].forEach((file) =>
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context));
  assert.deepEqual(vm.runInContext('JSON.stringify(Object.keys(NEWS_ADMIN_FILE_TYPES))', context), JSON.stringify(admin.ADMIN_UPLOAD_TYPES));
  assert.equal(vm.runInContext('NEWS_ADMIN_MAX_FILE_BYTES', context), admin.ADMIN_UPLOAD_MAX_BYTES);
});

test('フォームの日付・カテゴリ・タイトル・添付URLの誤りを返す', () => {
  assert.deepEqual(admin.adminFormErrors(okValues, NEWS_CATEGORIES), []);
  const errors = admin.adminFormErrors({ date: '', category: 'zzz', title: ' ', attachmentUrl: 'http://x' }, NEWS_CATEGORIES);
  assert.deepEqual(errors.map((e) => e.slice(0, 4)), ['日付を選', 'カテゴリ', 'タイトル', '添付ファ']);
});

test('FileReader の data URL から Base64 の部分だけを取り出す', () => {
  assert.equal(admin.dataUrlBase64('data:application/pdf;base64,JVBERi0='), 'JVBERi0=');
});

test('送信データは前後の空白を除き、公開チェックを true/false にし、ファイルがあれば URL 入力より優先する', () => {
  assert.deepEqual(admin.adminNewsPayload(okValues, undefined),
    { date: '2026-10-22', category: 'info', title: '教室のお休み', body: '本文', attachmentUrl: '', published: true });
  const file = { name: 'a.pdf', type: 'application/pdf', data: 'JVBERi0=' };
  const payload = admin.adminNewsPayload({ ...okValues, attachmentUrl: 'https://x.example/a.pdf', published: undefined }, file);
  assert.deepEqual([payload.attachmentUrl, payload.published, payload.file], ['', false, file]);
});

test('GAS へ送る本文は action・password・data の JSON', () => {
  assert.deepEqual(JSON.parse(admin.adminRequestBody('list', 'pw', undefined)), { action: 'list', password: 'pw' });
});

test('GAS の応答をそろえ、形が違えば失敗扱いにする', () => {
  assert.deepEqual(admin.normalizeAdminResponse({ ok: true, id: '3' }), { ok: true, id: '3', errors: [] });
  [null, 'x', {}, { ok: 'yes' }].forEach((json) =>
    assert.deepEqual(admin.normalizeAdminResponse(json), { ok: false, errors: ['サーバーからの応答を読み取れませんでした'] }));
});

test('日付入力欄の初期値はその端末の日付の YYYY-MM-DD', () => {
  assert.equal(admin.dateInputValue(new Date(2026, 0, 5)), '2026-01-05');
});

test('一覧は日付の新しい順で、状態・カテゴリ名・添付の有無を表示し、文字をエスケープする', () => {
  const list = [
    { id: '1', date: '2026-10-01', category: 'info', title: '<古い>', attachmentUrl: '', status: 'notPublished' },
    { id: '2', date: '2026-10-22', category: 'event', title: '新しい', attachmentUrl: 'https://x', status: 'published' },
  ];
  const html = admin.adminNewsTableHtml(list, NEWS_CATEGORIES);
  assert.ok(html.indexOf('新しい') < html.indexOf('&lt;古い&gt;'));
  assert.match(html, /status--published">公開中[\s\S]*イベント[\s\S]*添付あり[\s\S]*status--notPublished">非公開/);
});

test('一覧が空なら案内文、カテゴリの選択肢は全カテゴリ分を作る', () => {
  assert.match(admin.adminNewsTableHtml([], NEWS_CATEGORIES), /まだありません/);
  assert.equal((admin.adminCategoryOptionsHtml(NEWS_CATEGORIES).match(/<option /g) ?? []).length, 4);
});
