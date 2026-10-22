// GAS用のシート変換関数（gas/news-sheet.js）の単体テスト
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NEWS_CATEGORIES } = require('../js/data/news-data.js');
const {
  NEWS_SHEET_CATEGORY_IDS, sheetText, sheetDateText, sheetCategoryId,
  isPublishedFlag, isPublishedRow, sheetRowToEntry, newsRowsToEntries, newsResponse,
} = require('../gas/news-sheet.js');

// 日本時間 2026-10-15 0:00 は UTC では前日 15:00
const jstMidnight = new Date('2026-10-14T15:00:00Z');
// シートの列：A ID／B 日付／C カテゴリ／D タイトル／E 本文／F 添付ファイルURL／G 公開フラグ
const row = (id, date, category, title, body, attachmentUrl, published) =>
  [id, date, category, title, body, attachmentUrl, published];

test('セルの値を前後の空白を除いた文字列にする', () => {
  assert.equal(sheetText('  体験会 '), '体験会');
  assert.equal(sheetText(123), '123');
  assert.equal(sheetText(null), '');
  assert.equal(sheetText(undefined), '');
});

test('日付セルは日本時間の YYYY-MM-DD にし、文字列はそのまま返す', () => {
  assert.equal(sheetDateText(jstMidnight), '2026-10-15');
  assert.equal(sheetDateText(' 2026-10-15 '), '2026-10-15');
  assert.equal(sheetDateText(new Date('invalid')), '');
  assert.equal(sheetDateText(''), '');
});

test('日本語のカテゴリ名をIDにし、IDや未知の値はそのまま返す', () => {
  assert.equal(sheetCategoryId('イベント'), 'event');
  assert.equal(sheetCategoryId(' 募集 '), 'recruit');
  assert.equal(sheetCategoryId('class'), 'class');
  assert.equal(sheetCategoryId('その他'), 'その他');
});

test('シートのカテゴリ名はサイトのカテゴリ定義と一致している', () => {
  assert.deepEqual(
    Object.entries(NEWS_SHEET_CATEGORY_IDS).map(([label, id]) => ({ id, label })),
    NEWS_CATEGORIES.map(({ id, label }) => ({ id, label })),
  );
});

test('公開フラグはチェックボックスの ✓ と「TRUE」「公開」「1」「○」「yes」を公開とみなす', () => {
  [true, 'TRUE', 'true', ' 公開 ', 1, '1', '○', 'Yes'].forEach((value) => assert.equal(isPublishedFlag(value), true, String(value)));
  [false, 'FALSE', '非公開', '', null, undefined, 0, '×'].forEach((value) => assert.equal(isPublishedFlag(value), false, String(value)));
});

test('公開フラグがあり、日付が今日以前の行だけを公開対象にする', () => {
  assert.equal(isPublishedRow(row('n1', jstMidnight, '', '', '', '', true), '2026-10-15'), true);
  assert.equal(isPublishedRow(row('n1', '2026-10-16', '', '', '', '', true), '2026-10-15'), false);
  assert.equal(isPublishedRow(row('n1', '2026-10-01', '', '', '', '', false), '2026-10-15'), false);
  assert.equal(isPublishedRow(row('n1', '', '', '', '', '', true), '2026-10-15'), false);
  assert.equal(isPublishedRow([], '2026-10-15'), false);
});

test('1行を ID・添付ファイルURL を含むお知らせに変換し、公開フラグは含めない', () => {
  const url = 'https://drive.google.com/file/d/abc123/view?usp=sharing';
  const entry = sheetRowToEntry(row(' n-001 ', jstMidnight, 'イベント', ' 体験会 ', '本文', ` ${url} `, true));
  assert.deepEqual(entry, { id: 'n-001', date: '2026-10-15', category: 'event', title: '体験会', body: '本文', attachmentUrl: url });
  assert.equal(Object.isFrozen(entry), true);
});

test('ID・本文・添付ファイルURLが空なら空文字にする', () => {
  const entry = sheetRowToEntry(row('', '2026-10-01', 'お知らせ', 'タイトル', '', '', '公開'));
  assert.deepEqual([entry.id, entry.body, entry.attachmentUrl], ['', '', '']);
});

test('公開対象の行だけを変換し、元の配列は変更しない', () => {
  const rows = [
    row('n1', '2026-10-01', 'お知らせ', '公開', '', '', true),
    row('n2', '2026-10-02', 'お知らせ', '下書き', '', '', false),
    row('n3', '2026-12-01', 'お知らせ', '予約', '', '', true),
    row('', '', '', '', '', '', ''),
  ];
  assert.deepEqual(newsRowsToEntries(rows, '2026-10-15').map((entry) => entry.title), ['公開']);
  assert.equal(rows.length, 4);
});

test('Webアプリの応答は更新日時とお知らせの配列を持つ', () => {
  assert.deepEqual(newsResponse([], '2026-10-15T00:00:00.000Z'), { updatedAt: '2026-10-15T00:00:00.000Z', news: [] });
});
