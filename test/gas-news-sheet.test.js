// GAS用のシート変換関数（gas/news-sheet.js）の単体テスト
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NEWS_CATEGORIES } = require('../js/data/news-data.js');
const {
  NEWS_SHEET_CATEGORY_IDS, sheetText, sheetDateText, sheetCategoryId,
  sheetOrder, isPublishedFlag, rowSkipReason, isPublishedRow, sheetRowToEntry, newsRowsToEntries, newsResponse, newsRowDiagnostics,
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
  assert.deepEqual(entry, { id: 'n-001', date: '2026-10-15', category: 'event', title: '体験会', body: '本文', attachmentUrl: url, order: null });
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

test('文字列の日付は区切りや桁をそろえて YYYY-MM-DD にし、認識できない形はそのまま返す', () => {
  [['2026/10/20', '2026-10-20'], ['2026.1.5', '2026-01-05'], ['2026-1-5', '2026-01-05'], ['2026年10月20日', '2026-10-20']]
    .forEach(([text, expected]) => assert.equal(sheetDateText(text), expected, text));
  assert.equal(sheetDateText('10/20'), '10/20');
});

test('文字列の日付（2026/10/20）の行も、公開フラグが「公開」なら公開対象にする', () => {
  assert.equal(isPublishedRow(row('n1', '2026/10/20', 'お知らせ', 'a', '', '', '公開'), '2026-10-22'), true);
});

test('公開されない理由を「公開フラグなし・日付が読めない・未来の日付」に分ける', () => {
  assert.equal(rowSkipReason(row('n1', '2026-10-01', '', '', '', '', '非公開'), '2026-10-15'), 'notPublished');
  assert.equal(rowSkipReason(row('n1', '10/01', '', '', '', '', '公開'), '2026-10-15'), 'invalidDate');
  assert.equal(rowSkipReason(row('n1', '2026-10-16', '', '', '', '', '公開'), '2026-10-15'), 'future');
  assert.equal(rowSkipReason(row('n1', '2026-10-15', '', '', '', '', '公開'), '2026-10-15'), '');
});

test('診断結果は件数と理由ごとの件数、認識できない値の例だけを返し、タイトルや本文は含めない', () => {
  const rows = [
    row('n1', '2026-10-01', 'お知らせ', '秘密のタイトル', '秘密の本文', '', '公開'),
    row('n2', '2026-10-01', 'お知らせ', 'b', '', '', '公開済み'),
    row('n3', '2026-10-01', 'お知らせ', 'c', '', '', '公開済み'),
    row('n4', '10月1日', 'お知らせ', 'd', '', '', '公開'),
    row('n5', '2099-01-01', 'お知らせ', 'e', '', '', true),
  ];
  const result = newsRowDiagnostics(rows, '2026-10-15');
  assert.deepEqual(result, {
    today: '2026-10-15', rowCount: 5, published: 1, notPublished: 2, invalidDate: 1, future: 1,
    notPublishedFlagSamples: ['公開済み'], invalidDateSamples: ['10月1日'],
  });
  assert.doesNotMatch(JSON.stringify(result), /秘密/);
});

test('H列の固定順位は数値・数字の文字列なら数値、空や数値でなければ null にする', () => {
  [[1, 1], ['2', 2], [' 3 ', 3]].forEach(([value, expected]) => assert.equal(sheetOrder(value), expected, String(value)));
  [undefined, null, '', 'abc'].forEach((value) => assert.equal(sheetOrder(value), null, String(value)));
  assert.equal(sheetRowToEntry([...row('n1', '2026-10-01', 'お知らせ', 'a', '', '', true), 4]).order, 4);
});
