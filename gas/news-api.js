// 【GAS用】お知らせをJSONで返すWebアプリの入口
// GASエディタに「news-api」という名前のスクリプトファイルを作り、このファイルの内容を貼り付ける。
// シートの読み取り・キャッシュ・応答の作成（副作用）はこのファイルに集約し、変換は news-sheet.js の純粋関数に任せる。
// ※ doGet / onEdit / setupNewsSheet は GAS から呼び出すため function 宣言にしている。

const NEWS_SHEET_NAME = 'news';
const NEWS_SHEET_HEADERS = Object.freeze(['ID', '日付', 'カテゴリ', 'タイトル', '本文', '添付ファイルURL', '公開フラグ', '固定順位']);
// 応答の形を変えたときは末尾の版数を上げ、古い形のキャッシュを使わないようにする
const NEWS_CACHE_KEY = 'news-json-v3';
const NEWS_CACHE_SECONDS = 300;
// CacheService は1件100KBまで。日本語は1文字3バイトのため、文字数で余裕をもって判定する
const NEWS_CACHE_MAX_CHARS = 30000;

// 見出し行を含むシートの全セルの値（シートが無ければ null）
const readNewsValues = () => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NEWS_SHEET_NAME);
  return sheet ? sheet.getDataRange().getValues() : null;
};

// 見出し行を除いたシートの全行（シートが無ければ空配列）
const readNewsRows = () => (readNewsValues() ?? [[]]).slice(1);

const sheetNames = () => SpreadsheetApp.getActiveSpreadsheet().getSheets().map((sheet) => sheet.getName());

// 診断用：シートの有無・見出し・件数・公開されない理由（お知らせの中身は含めない。キャッシュしない）
const buildDiagnosticsJson = (now) => {
  const values = readNewsValues();
  return JSON.stringify(values
    ? { sheetFound: true, headers: values[0].map(sheetText), ...newsRowDiagnostics(values.slice(1), sheetDateText(now)) }
    : { sheetFound: false, expectedSheetName: NEWS_SHEET_NAME, sheetNames: sheetNames() });
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
// URL の末尾に ?debug=1 を付けると、お知らせの代わりに診断結果を返す
function doGet(e) {
  try {
    return jsonOutput(e?.parameter?.debug === '1' ? buildDiagnosticsJson(new Date()) : cachedNewsJson());
  } catch (error) {
    console.error(error);
    return jsonOutput(JSON.stringify({ error: 'お知らせを読み込めませんでした' }));
  }
}

// シートが編集されたらキャッシュを消し、次のアクセスからすぐ反映させる（シンプルトリガー）
function onEdit() {
  CacheService.getScriptCache().remove(NEWS_CACHE_KEY);
}

// 日付・カテゴリ・固定順位の入力規則、公開フラグのチェックボックスを設定する
const applyNewsSheetRules = (sheet) => {
  sheet.getRange('G2:G').insertCheckboxes();
  sheet.getRange('H2:H').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(1, 9999).build());
  sheet.getRange('B2:B').setNumberFormat('yyyy-mm-dd')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().build());
  sheet.getRange('C2:C').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(Object.keys(NEWS_SHEET_CATEGORY_IDS)).build());
};

// 新しくシートを作るときだけ GASエディタから実行し、シート「news」の見出し・入力規則・チェックボックスを用意する
// ※ 公開フラグを文字（「公開」など）で入力済みのシートでは実行しないこと（G列がチェックボックスに変わるため）
function setupNewsSheet() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName(NEWS_SHEET_NAME) ?? book.insertSheet(NEWS_SHEET_NAME);
  sheet.getRange(1, 1, 1, NEWS_SHEET_HEADERS.length).setValues([NEWS_SHEET_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  applyNewsSheetRules(sheet);
}

// ---- 管理画面（admin.html）からの POST：ログイン・一覧・追加（添付ファイルのアップロードを含む） ----
// 共通パスワードはコードに書かず、GAS の「プロジェクトの設定」→「スクリプト プロパティ」に ADMIN_PASSWORD として登録する

const NEWS_ADMIN_PASSWORD_KEY = 'ADMIN_PASSWORD';
const NEWS_ADMIN_FOLDER_KEY = 'ADMIN_FOLDER_ID';
const NEWS_ADMIN_FOLDER_NAME = 'お知らせ添付ファイル';
const NEWS_LOGIN_FAIL_KEY = 'news-admin-login-fail';
const NEWS_LOGIN_MAX_FAILS = 10;
const NEWS_LOGIN_LOCK_SECONDS = 900;
const NEWS_LOCK_WAIT_MS = 20000;

const scriptProperties = () => PropertiesService.getScriptProperties();

const loginFailCount = () => Number(CacheService.getScriptCache().get(NEWS_LOGIN_FAIL_KEY) ?? 0);

const recordLoginFail = () =>
  CacheService.getScriptCache().put(NEWS_LOGIN_FAIL_KEY, String(loginFailCount() + 1), NEWS_LOGIN_LOCK_SECONDS);

// パスワードを確認し、誤りがあればメッセージを返す（15分間に10回失敗したら一時的に受け付けない）
const adminPasswordError = (password) => {
  const expected = scriptProperties().getProperty(NEWS_ADMIN_PASSWORD_KEY) ?? '';
  if (sheetText(expected) === '') return '管理画面のパスワードが設定されていません（スクリプト プロパティ ADMIN_PASSWORD）';
  if (loginFailCount() >= NEWS_LOGIN_MAX_FAILS) return 'パスワードの誤りが続いたため、15分ほど時間をおいてからお試しください';
  if (isAdminPasswordMatch(password, expected)) return '';
  recordLoginFail();
  return 'パスワードが違います';
};

// 添付ファイルの保存先フォルダ（初回はマイドライブに作成し、IDをスクリプト プロパティに保存する）
const newsAttachmentFolder = () => {
  const savedId = scriptProperties().getProperty(NEWS_ADMIN_FOLDER_KEY);
  if (savedId) return DriveApp.getFolderById(savedId);
  const folder = DriveApp.createFolder(NEWS_ADMIN_FOLDER_NAME);
  scriptProperties().setProperty(NEWS_ADMIN_FOLDER_KEY, folder.getId());
  return folder;
};

// 添付ファイルをドライブに保存し、「リンクを知っている全員が閲覧可」にして共有URLを返す
const saveNewsAttachment = (file, date) => {
  const blob = Utilities.newBlob(Utilities.base64Decode(sheetText(file.data)), sheetText(file.type), adminFileName(file.name, date));
  const saved = newsAttachmentFolder().createFile(blob);
  saved.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return saved.getUrl();
};

// 同時に複数の職員が追加しても ID が重ならないよう、書き込みは1人ずつ行う
const withNewsLock = (task) => {
  const lock = LockService.getScriptLock();
  lock.waitLock(NEWS_LOCK_WAIT_MS);
  try {
    return task();
  } finally {
    lock.releaseLock();
  }
};

// シートの末尾に1行追加し、公開用のキャッシュを消してすぐサイトに反映させる（追加したIDを返す）
const appendNewsRow = (input, attachmentUrl) => {
  const id = nextNewsId(readNewsRows());
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NEWS_SHEET_NAME)
    .appendRow([...adminInputToRow({ ...input, attachmentUrl }, id)]);
  CacheService.getScriptCache().remove(NEWS_CACHE_KEY);
  return id;
};

// お知らせを追加する（ファイルがあればドライブに保存し、その共有URLを添付ファイルURLにする）
const createNews = (input) => {
  const errors = [...adminInputErrors(input), ...adminFileErrors(input?.file)];
  if (errors.length > 0) return { ok: false, errors };
  return withNewsLock(() => {
    const attachmentUrl = input.file ? saveNewsAttachment(input.file, sheetText(input.date)) : sheetText(input.attachmentUrl);
    return { ok: true, id: appendNewsRow(input, attachmentUrl), attachmentUrl };
  });
};

const listAdminNews = () => ({ ok: true, news: adminNewsList(readNewsRows(), sheetDateText(new Date())) });

const NEWS_ADMIN_ACTIONS = Object.freeze({ login: () => ({ ok: true }), list: listAdminNews, create: createNews });

// どの操作も、先にパスワードを確認する（auth: false のとき管理画面はログイン画面に戻る）
const handleAdminRequest = (request) => {
  const action = NEWS_ADMIN_ACTIONS[request?.action];
  if (!action) return { ok: false, errors: ['不明な操作です'] };
  const passwordError = adminPasswordError(request.password);
  return passwordError ? { ok: false, auth: false, errors: [passwordError] } : action(request.data);
};

// 管理画面からの POST（本文は text/plain の JSON）に応答する
function doPost(e) {
  try {
    return jsonOutput(JSON.stringify(handleAdminRequest(parseAdminRequest(e?.postData?.contents))));
  } catch (error) {
    console.error(error);
    return jsonOutput(JSON.stringify({ ok: false, errors: ['処理中にエラーが発生しました。時間をおいてもう一度お試しください'] }));
  }
}
