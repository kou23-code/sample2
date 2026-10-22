// 【GAS用】お知らせをJSONで返すWebアプリの入口
// GASエディタに「news-api」という名前のスクリプトファイルを作り、このファイルの内容を貼り付ける。
// シートの読み取り・キャッシュ・応答の作成（副作用）はこのファイルに集約し、変換は news-sheet.js の純粋関数に任せる。
// ※ doGet / onEdit / setupNewsSheet は GAS から呼び出すため function 宣言にしている。

const NEWS_SHEET_NAME = 'news';
const NEWS_SHEET_HEADERS = Object.freeze(['公開', '日付', 'カテゴリ', 'タイトル', '本文', 'メモ（公開されません）']);
const NEWS_CACHE_KEY = 'news-json-v1';
const NEWS_CACHE_SECONDS = 300;
// CacheService は1件100KBまで。日本語は1文字3バイトのため、文字数で余裕をもって判定する
const NEWS_CACHE_MAX_CHARS = 30000;

// 見出し行を除いたシートの全行（シートが無ければ空配列）
const readNewsRows = () => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NEWS_SHEET_NAME);
  return sheet ? sheet.getDataRange().getValues().slice(1) : [];
};

const buildNewsJson = (now) =>
  JSON.stringify(newsResponse(newsRowsToEntries(readNewsRows(), sheetDateText(now)), now.toISOString()));

// 5分間はキャッシュを返し、シートの読み取り回数と待ち時間を減らす
const cachedNewsJson = () => {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(NEWS_CACHE_KEY);
  if (cached) return cached;
  const json = buildNewsJson(new Date());
  if (json.length <= NEWS_CACHE_MAX_CHARS) cache.put(NEWS_CACHE_KEY, json, NEWS_CACHE_SECONDS);
  return json;
};

const jsonOutput = (text) => ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);

// Webアプリへの GET リクエストに応答する（失敗時もJSONで返し、サイト側は予備データを表示する）
function doGet() {
  try {
    return jsonOutput(cachedNewsJson());
  } catch (error) {
    console.error(error);
    return jsonOutput(JSON.stringify({ error: 'お知らせを読み込めませんでした' }));
  }
}

// シートが編集されたらキャッシュを消し、次のアクセスからすぐ反映させる（シンプルトリガー）
function onEdit() {
  CacheService.getScriptCache().remove(NEWS_CACHE_KEY);
}

// 公開のチェックボックス、日付とカテゴリの入力規則を設定する
const applyNewsSheetRules = (sheet) => {
  sheet.getRange('A2:A').insertCheckboxes();
  sheet.getRange('B2:B').setNumberFormat('yyyy-mm-dd')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().build());
  sheet.getRange('C2:C').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(Object.keys(NEWS_SHEET_CATEGORY_IDS)).build());
};

// 初回だけ GASエディタから実行し、シート「news」の見出し・チェックボックス・入力規則を用意する
function setupNewsSheet() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName(NEWS_SHEET_NAME) ?? book.insertSheet(NEWS_SHEET_NAME);
  sheet.getRange(1, 1, 1, NEWS_SHEET_HEADERS.length).setValues([NEWS_SHEET_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  applyNewsSheetRules(sheet);
}
