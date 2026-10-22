// 【GAS用】スプレッドシートの行をお知らせデータに変換する純粋関数群
// GASエディタに「news-sheet」という名前のスクリプトファイルを作り、このファイルの内容を貼り付ける。
// Node.js の単体テスト（test/gas-news-sheet.test.js）からも同じコードを読み込んで検証する。
//
// シート「news」の列：A 公開（チェックボックス）／B 日付／C カテゴリ／D タイトル／E 本文／F メモ（外部に出さない）

const NEWS_SHEET_COLUMNS = Object.freeze({ published: 0, date: 1, category: 2, title: 3, body: 4 });

// シートのプルダウンで選ぶ日本語名 → サイトで使うカテゴリID
const NEWS_SHEET_CATEGORY_IDS = Object.freeze({ お知らせ: 'info', イベント: 'event', 教室情報: 'class', 募集: 'recruit' });

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// セルの値を前後の空白を除いた文字列にする（空セルは空文字）
const sheetText = (value) => (value === null || value === undefined ? '' : String(value).trim());

const isSheetDate = (value) => Object.prototype.toString.call(value) === '[object Date]';

const jstDateText = (date) =>
  Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);

// 日付セル（Date）を日本時間の 'YYYY-MM-DD' にする。文字列のセルはそのまま（形式の誤りはサイト側で検出する）
const sheetDateText = (value) => (isSheetDate(value) ? jstDateText(value) : sheetText(value));

// 日本語のカテゴリ名をIDに変換する（ID が直接書かれていればそのまま）
const sheetCategoryId = (value) => NEWS_SHEET_CATEGORY_IDS[sheetText(value)] ?? sheetText(value);

// 公開にチェックがあり、日付が今日（'YYYY-MM-DD'）以前の行だけを出す（未来の日付は予約公開）
const isPublishedRow = (row, today) => {
  const date = sheetDateText(row[NEWS_SHEET_COLUMNS.date]);
  return row[NEWS_SHEET_COLUMNS.published] === true && date !== '' && date <= today;
};

// 1行を { date, category, title, body } にする（メモ列など公開しない列は含めない）
const sheetRowToEntry = (row) => Object.freeze({
  date: sheetDateText(row[NEWS_SHEET_COLUMNS.date]),
  category: sheetCategoryId(row[NEWS_SHEET_COLUMNS.category]),
  title: sheetText(row[NEWS_SHEET_COLUMNS.title]),
  body: sheetText(row[NEWS_SHEET_COLUMNS.body]),
});

// 見出し行を除いた行の配列から、公開するお知らせの配列を作る
const newsRowsToEntries = (rows, today) =>
  Object.freeze(rows.filter((row) => isPublishedRow(row, today)).map(sheetRowToEntry));

// Webアプリが返すJSONの中身
const newsResponse = (entries, updatedAt) => Object.freeze({ updatedAt, news: entries });

if (typeof module === 'object' && module.exports) {
  module.exports = {
    NEWS_SHEET_COLUMNS, NEWS_SHEET_CATEGORY_IDS, sheetText, sheetDateText, sheetCategoryId,
    isPublishedRow, sheetRowToEntry, newsRowsToEntries, newsResponse,
  };
}
