// GAS用のシート変換関数（gas/news-sheet.js）の単体テスト
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NEWS_CATEGORIES } = require('../js/data/news-data.js');
const {
  NEWS_SHEET_CATEGORY_IDS, sheetText, sheetDateText, sheetCategoryId,
  isPublishedRow, sheetRowToEntry, newsRowsToEntries, newsResponse,
} = require('../gas/news-sheet.js');

// 日本時間 2026-10-15 0:00 は UTC では前日 15:00
const jstMidnight = new Date('2026-10-14T15:00:00Z');
const row = (published, date, category, title, body, memo) => [published, date, category, title, body, memo];

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

test('公開にチェックがあり、日付が今日以前の行だけを公開対象にする', () => {
  assert.equal(isPublishedRow(row(true, jstMidnight), '2026-10-15'), true);
  assert.equal(isPublishedRow(row(true, '2026-10-16'), '2026-10-15'), false);
  assert.equal(isPublishedRow(row(false, '2026-10-01'), '2026-10-15'), false);
  assert.equal(isPublishedRow(row('TRUE', '2026-10-01'), '2026-10-15'), false);
  assert.equal(isPublishedRow(row(true, ''), '2026-10-15'), false);
  assert.equal(isPublishedRow([], '2026-10-15'), false);
});

test('1行をお知らせに変換し、メモ列は含めない', () => {
  const entry = sheetRowToEntry(row(true, jstMidnight, 'イベント', ' 体験会 ', '本文', '担当メモ'));
  assert.deepEqual(entry, { date: '2026-10-15', category: 'event', title: '体験会', body: '本文' });
  assert.equal(Object.isFrozen(entry), true);
});

test('公開対象の行だけを変換し、元の配列は変更しない', () => {
  const rows = [
    row(true, '2026-10-01', 'お知らせ', '公開'),
    row(false, '2026-10-02', 'お知らせ', '下書き'),
    row(true, '2026-12-01', 'お知らせ', '予約'),
    row('', '', '', ''),
  ];
  assert.deepEqual(newsRowsToEntries(rows, '2026-10-15').map((entry) => entry.title), ['公開']);
  assert.equal(rows.length, 4);
});

test('Webアプリの応答は更新日時とお知らせの配列を持つ', () => {
  assert.deepEqual(newsResponse([], '2026-10-15T00:00:00.000Z'), { updatedAt: '2026-10-15T00:00:00.000Z', news: [] });
});
