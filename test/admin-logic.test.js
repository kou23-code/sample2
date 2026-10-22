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
    { date: '2026-10-22', category: 'info', title: '教室のお休み', body: '本文', attachmentUrl: '', published: true, order: '' });
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

test('一覧は（固定順位がなければ）日付の新しい順で、状態・カテゴリ名・添付の有無を表示し、文字をエスケープする', () => {
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
// ---- 固定順位 ----

test('固定順位は空欄か1〜9999の整数だけを受け付け、送信データに文字のまま含める', () => {
  ['', '1', '9999'].forEach((order) => assert.deepEqual(admin.adminFormErrors({ ...okValues, order }, NEWS_CATEGORIES), [], order));
  ['0', '10000', '1.5', 'abc'].forEach((order) =>
    assert.match(admin.adminFormErrors({ ...okValues, order }, NEWS_CATEGORIES)[0], /固定順位は1〜9999の整数/, order));
  assert.equal(admin.adminNewsPayload({ ...okValues, order: ' 2 ' }, undefined).order, '2');
});

test('一覧は固定順位があるものを先頭に並べ、順位の列に数値、ないものは — を表示する', () => {
  const list = [
    { id: '1', date: '2026-10-22', category: 'info', title: '新しい', attachmentUrl: '', status: 'published', order: null },
    { id: '2', date: '2026-01-01', category: 'info', title: '固定', attachmentUrl: '', status: 'published', order: 1 },
  ];
  const html = admin.adminNewsTableHtml(list, NEWS_CATEGORIES);
  assert.ok(html.indexOf('固定') < html.indexOf('新しい'));
  assert.match(html, /公開中<\/span><\/td>\s*<td>1<\/td>[\s\S]*公開中<\/span><\/td>\s*<td><span aria-label="固定順位なし">—<\/span><\/td>/);
});

test('案内の行は表の全列（6列）にまたがり、文字をエスケープする', () => {
  assert.equal(admin.adminTableNoticeHtml('<読み込み中>'), '<tr><td colspan="6" class="admin-table__empty">&lt;読み込み中&gt;</td></tr>');
});

// ---- エラーの原因の詳細 ----

test('GAS が JSON を返したときは通常どおり読み、detail があれば残す', () => {
  assert.deepEqual(admin.parseAdminHttpResponse({ ok: true, status: 200, text: '{"ok":true,"id":"3"}' }), { ok: true, id: '3', errors: [] });
  const result = admin.parseAdminHttpResponse({ ok: true, status: 200, text: '{"ok":false,"errors":["処理中にエラー"],"detail":"Exception: 権限がありません"}' });
  assert.deepEqual(admin.adminErrorLines(result), ['処理中にエラー', '詳細：Exception: 権限がありません']);
});

test('HTTP エラーは状態コードと、HTML のタグを除いた本文の先頭を詳細にする', () => {
  const result = admin.parseAdminHttpResponse({ ok: false, status: 500, text: '<html><body><h1>Error</h1>\n<p>Script function not found: doPost</p></body></html>' });
  assert.deepEqual(result, { ok: false, errors: ['サーバーがエラーを返しました（HTTP 500）'], detail: 'Error Script function not found: doPost' });
});

test('JSON でない応答（Google のログイン画面など）は、その旨と本文の先頭を詳細にする', () => {
  const result = admin.parseAdminHttpResponse({ ok: true, status: 200, text: '<!doctype html><title>Google アカウント</title>' + 'x'.repeat(500) });
  assert.match(result.errors[0], /JSON ではありませんでした/);
  assert.equal(result.detail.length, 300);
  assert.match(result.detail, /^Google アカウント/);
});

test('通信の失敗はタイムアウト・CORS やネットワーク・その他に分け、エラー名とメッセージを詳細にする', () => {
  const abort = admin.describeFetchError(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
  const network = admin.describeFetchError(new TypeError('Failed to fetch'));
  const other = admin.describeFetchError(new RangeError('x'));
  assert.deepEqual([abort, network, other].map((r) => r.errors[0].slice(0, 6)), ['60秒たって', 'サーバーと通', '通信中に予期']);
  assert.equal(network.detail, 'TypeError: Failed to fetch');
});

test('詳細が無いときは「詳細：」の行を付けない', () => {
  assert.deepEqual(admin.adminErrorLines({ ok: false, errors: ['パスワードが違います'] }), ['パスワードが違います']);
  assert.deepEqual(admin.adminErrorLines(admin.adminFailure('失敗', '')), ['失敗']);
});
