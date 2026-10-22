// 【GAS用】スプレッドシートの行をお知らせデータに変換する純粋関数群
// GASエディタに「news-sheet」という名前のスクリプトファイルを作り、このファイルの内容を貼り付ける。
// Node.js の単体テスト（test/gas-news-sheet.test.js）からも同じコードを読み込んで検証する。
//
// シート「news」の列：A ID／B 日付／C カテゴリ／D タイトル／E 本文／F 添付ファイルURL／G 公開フラグ／H 固定順位

const NEWS_SHEET_COLUMNS = Object.freeze({
  id: 0, date: 1, category: 2, title: 3, body: 4, attachmentUrl: 5, published: 6, order: 7,
});

// シートのプルダウンで選ぶ日本語名 → サイトで使うカテゴリID
const NEWS_SHEET_CATEGORY_IDS = Object.freeze({ お知らせ: 'info', イベント: 'event', 教室情報: 'class', 募集: 'recruit' });

// 公開フラグとして認める文字（チェックボックスの true 以外。英字は小文字で比較する）
const NEWS_PUBLISHED_WORDS = Object.freeze(['true', '公開', '1', '○', 'yes']);

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// セルの値を前後の空白を除いた文字列にする（空セルは空文字）
const sheetText = (value) => (value === null || value === undefined ? '' : String(value).trim());

const isSheetDate = (value) => Object.prototype.toString.call(value) === '[object Date]';

const jstDateText = (date) =>
  Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);

const pad2 = (text) => text.padStart(2, '0');

// 文字列の日付（2026/10/20、2026.10.20、2026-1-5、2026年10月20日）を 'YYYY-MM-DD' にそろえる（それ以外の形はそのまま）
const normalizeDateText = (text) => {
  const match = /^(\d{4})[/.\-年](\d{1,2})[/.\-月](\d{1,2})日?$/.exec(text);
  return match ? `${match[1]}-${pad2(match[2])}-${pad2(match[3])}` : text;
};

// 日付セル（Date）を日本時間の 'YYYY-MM-DD' にする。文字列のセルは区切りをそろえる（形式の誤りはサイト側で検出する）
const sheetDateText = (value) => (isSheetDate(value) ? jstDateText(value) : normalizeDateText(sheetText(value)));

// 固定順位のセル：数値（または数字だけの文字列）なら数値、空や数値でないものは null（サイトでは日付順に並ぶ）
const sheetOrder = (value) => {
  const number = typeof value === 'number' ? value : sheetText(value) === '' ? NaN : Number(sheetText(value));
  return Number.isFinite(number) ? number : null;
};

// 日本語のカテゴリ名をIDに変換する（ID が直接書かれていればそのまま）
const sheetCategoryId = (value) => NEWS_SHEET_CATEGORY_IDS[sheetText(value)] ?? sheetText(value);

// 公開フラグ：チェックボックスの ✓（true）か、「TRUE」「公開」「1」「○」「yes」なら公開
const isPublishedFlag = (value) => value === true || NEWS_PUBLISHED_WORDS.includes(sheetText(value).toLowerCase());

// 行が公開されない理由（公開フラグなし／日付が読めない／未来の日付）。公開される行は空文字
const rowSkipReason = (row, today) => {
  const date = sheetDateText(row[NEWS_SHEET_COLUMNS.date]);
  if (!isPublishedFlag(row[NEWS_SHEET_COLUMNS.published])) return 'notPublished';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'invalidDate';
  return date <= today ? '' : 'future';
};

// 公開フラグがあり、日付が今日（'YYYY-MM-DD'）以前の行だけを出す（未来の日付は予約公開）
const isPublishedRow = (row, today) => rowSkipReason(row, today) === '';

// 1行を { id, date, category, title, body, attachmentUrl, order } にする（公開フラグは出力しない）
// 添付ファイルURLはシートの値のまま出し、Googleドライブのプレビュー用URLへの変換はサイト側で行う
const sheetRowToEntry = (row) => Object.freeze({
  id: sheetText(row[NEWS_SHEET_COLUMNS.id]),
  date: sheetDateText(row[NEWS_SHEET_COLUMNS.date]),
  category: sheetCategoryId(row[NEWS_SHEET_COLUMNS.category]),
  title: sheetText(row[NEWS_SHEET_COLUMNS.title]),
  body: sheetText(row[NEWS_SHEET_COLUMNS.body]),
  attachmentUrl: sheetText(row[NEWS_SHEET_COLUMNS.attachmentUrl]),
  order: sheetOrder(row[NEWS_SHEET_COLUMNS.order]),
});

// 見出し行を除いた行の配列から、公開するお知らせの配列を作る
const newsRowsToEntries = (rows, today) =>
  Object.freeze(rows.filter((row) => isPublishedRow(row, today)).map(sheetRowToEntry));

// Webアプリが返すJSONの中身
const newsResponse = (entries, updatedAt) => Object.freeze({ updatedAt, news: entries });

// ---- 診断用（URL に ?debug=1 を付けたときだけ返す。お知らせの中身は含めない） ----

const countOf = (list, value) => list.filter((item) => item === value).length;

const distinctSamples = (values) => [...new Set(values.filter((value) => value !== ''))].slice(0, 5);

const samplesFor = (rows, reasons, reason, toText) => distinctSamples(rows.filter((_, i) => reasons[i] === reason).map(toText));

// 行数・公開されない理由ごとの件数と、認識できなかった公開フラグ・日付の値の例（各5種類まで）
const newsRowDiagnostics = (rows, today) => {
  const reasons = rows.map((row) => rowSkipReason(row, today));
  return Object.freeze({
    today, rowCount: rows.length, published: countOf(reasons, ''),
    notPublished: countOf(reasons, 'notPublished'), invalidDate: countOf(reasons, 'invalidDate'), future: countOf(reasons, 'future'),
    notPublishedFlagSamples: samplesFor(rows, reasons, 'notPublished', (row) => sheetText(row[NEWS_SHEET_COLUMNS.published])),
    invalidDateSamples: samplesFor(rows, reasons, 'invalidDate', (row) => sheetDateText(row[NEWS_SHEET_COLUMNS.date])),
  });
};

if (typeof module === 'object' && module.exports) {
  module.exports = {
    NEWS_SHEET_COLUMNS, NEWS_SHEET_CATEGORY_IDS, NEWS_PUBLISHED_WORDS, sheetText, sheetDateText, sheetCategoryId, sheetOrder,
    isPublishedFlag, rowSkipReason, isPublishedRow, sheetRowToEntry, newsRowsToEntries, newsResponse, newsRowDiagnostics,
  };
}
