// 【GAS用】管理画面からの入力をチェックし、シートの行を組み立てる純粋関数群
// GASエディタに「news-admin」という名前のスクリプトファイルを作り、このファイルの内容を貼り付ける。
// news-sheet.js の関数（sheetText など）を使う。GAS のファイルの読み込み順に左右されないよう、関数の中でだけ参照する。
// 管理画面のチェックはすり抜けられるため、シートに書き込む前に必ずこちらでも検証する。

const NEWS_ADMIN_LIMITS = Object.freeze({ title: 100, body: 2000, attachmentUrl: 500 });

// 先頭が = + - @ などのセルは数式として実行されないよう ' を付ける（スプレッドシートの数式埋め込み対策）
const escapeSheetFormula = (text) => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);

// 'YYYY-MM-DD' 形式で、かつ実在する日付か（2026-02-30 などは不可）
const isAdminDate = (text) => {
  const parsed = new Date(`${text}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
};

const isAdminAttachmentUrl = (text) =>
  text === '' || (/^https:\/\/[^\s"'<>]+$/.test(text) && text.length <= NEWS_ADMIN_LIMITS.attachmentUrl);

// カテゴリID → シートのプルダウンと同じ日本語名（未知のIDは空文字）
const categoryLabelForSheet = (categoryId) =>
  Object.keys(NEWS_SHEET_CATEGORY_IDS).find((label) => NEWS_SHEET_CATEGORY_IDS[label] === categoryId) ?? '';

// タイトル・本文の文字数の誤り
const adminLengthErrors = (title, body) => [
  title.length > NEWS_ADMIN_LIMITS.title ? `タイトルは${NEWS_ADMIN_LIMITS.title}文字以内にしてください` : '',
  body.length > NEWS_ADMIN_LIMITS.body ? `本文は${NEWS_ADMIN_LIMITS.body}文字以内にしてください` : '',
];

// 管理画面からの入力の誤りを、職員が直し方の分かる日本語で返す（誤りがなければ空配列）
const adminInputErrors = (input) => {
  const value = (key) => sheetText(input?.[key]);
  return [
    isAdminDate(value('date')) ? '' : '日付は 2026-10-22 のような実在する日付にしてください',
    categoryLabelForSheet(value('category')) ? '' : 'カテゴリを選んでください',
    value('title') ? '' : 'タイトルを入力してください',
    ...adminLengthErrors(value('title'), value('body')),
    isAdminAttachmentUrl(value('attachmentUrl')) ? '' : '添付ファイルURLは https:// で始まるURL（500文字以内）にしてください',
  ].filter(Boolean);
};

// 入力をシートの1行（A ID／B 日付／C カテゴリ／D タイトル／E 本文／F 添付ファイルURL／G 公開フラグ）にする
const adminInputToRow = (input, id) => Object.freeze([
  escapeSheetFormula(sheetText(id)),
  sheetText(input.date),
  categoryLabelForSheet(sheetText(input.category)),
  escapeSheetFormula(sheetText(input.title)),
  escapeSheetFormula(sheetText(input.body)),
  sheetText(input.attachmentUrl),
  input.published === true ? '公開' : '非公開',
]);

// 次に使うID（数字のIDの最大値＋1。数字のIDが1つも無ければ '1'）
const nextNewsId = (rows) =>
  String(Math.max(0, ...rows.map((row) => Number(sheetText(row[NEWS_SHEET_COLUMNS.id]))).filter(Number.isInteger)) + 1);

// IDが一致する行の位置（見出しを除いた行の配列での番号。空のIDや見つからない場合は -1）
const findNewsRowIndex = (rows, id) =>
  sheetText(id) === '' ? -1 : rows.findIndex((row) => sheetText(row[NEWS_SHEET_COLUMNS.id]) === sheetText(id));

const isBlankNewsRow = (row) => sheetText(row[NEWS_SHEET_COLUMNS.id]) === '' && sheetText(row[NEWS_SHEET_COLUMNS.title]) === '';

// 管理画面の一覧用の1件（下書き・予約公開も含め、公開フラグと状態を付ける）
// status：'published'（公開中）／'notPublished'（非公開）／'future'（予約公開）／'invalidDate'（日付が読めない）
const sheetRowToAdminEntry = (row, today) => Object.freeze({
  ...sheetRowToEntry(row),
  published: isPublishedFlag(row[NEWS_SHEET_COLUMNS.published]),
  status: rowSkipReason(row, today) || 'published',
});

// 管理画面の一覧（空行を除く。並び順はサイト側で決める）
const adminNewsList = (rows, today) =>
  Object.freeze(rows.filter((row) => !isBlankNewsRow(row)).map((row) => sheetRowToAdminEntry(row, today)));
