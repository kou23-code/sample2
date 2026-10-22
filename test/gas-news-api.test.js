// GASのWebアプリ（gas/news-api.js）を、GASのサービスを偽物に差し替えた実行環境で検証する
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const GAS_FILES = ['gas/news-sheet.js', 'gas/news-admin.js', 'gas/news-api.js'];

const HEADER = ['ID', '日付', 'カテゴリ', 'タイトル', '本文', '添付ファイルURL', '公開フラグ', '固定順位'];
const ATTACHMENT = 'https://drive.google.com/file/d/abc123/view';
const ROWS = [
  HEADER,
  ['n-001', new Date('2026-10-14T15:00:00Z'), 'イベント', '公開中', '本文', ATTACHMENT, true],
  ['n-002', new Date('2026-10-01T15:00:00Z'), 'お知らせ', '下書き', '', '', false],
  ['n-003', new Date('2099-01-01T00:00:00Z'), '募集', '予約', '', '', '公開'],
];

// Map に保存する偽の CacheService
const fakeCacheService = (cache) => ({
  getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }),
});

// 保存したファイルを記録する偽のドライブのフォルダ
const fakeFolder = (record, id) => ({
  getId: () => id,
  createFile: (blob) => {
    record.files.push({ ...blob, folderId: id });
    const url = `https://drive.google.com/file/d/file-${record.files.length}/view?usp=drivesdk`;
    return { setSharing: (access, permission) => record.sharing.push([access, permission]), getUrl: () => url };
  },
});

const fakeDriveApp = (record) => ({
  Access: { ANYONE_WITH_LINK: 'anyone-with-link' }, Permission: { VIEW: 'view' },
  getFolderById: (id) => fakeFolder(record, id),
  createFolder: (name) => record.folders.push(name) && fakeFolder(record, `folder-${record.folders.length}`),
});

// 管理画面の POST で使う偽のスクリプト プロパティ・ロック・Base64 変換・ドライブ
const fakeAdminServices = (record, props) => ({
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
  LockService: { getScriptLock: () => ({ waitLock: () => record.locks.push('wait'), releaseLock: () => record.locks.push('release') }) },
  Utilities: { base64Decode: (data) => [...Buffer.from(data, 'base64')], newBlob: (bytes, type, name) => ({ bytes, type, name }) },
  DriveApp: fakeDriveApp(record),
});

// シート・キャッシュ・応答・書き込みを記録する偽の GAS サービス
const fakeGas = (sheetRows, props) => {
  const cache = new Map();
  const record = { locks: [], folders: [], files: [], sharing: [] };
  const sheet = sheetRows && { getDataRange: () => ({ getValues: () => sheetRows }), appendRow: (values) => sheetRows.push(values) };
  return {
    cache, record, props, CacheService: fakeCacheService(cache), console: { error: () => {} }, ...fakeAdminServices(record, props),
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, getSheets: () => [{ getName: () => 'シート1' }] }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ text, setMimeType: (type) => ({ text, type }) }) },
  };
};

const loadGas = (sheetRows, props = new Map([['ADMIN_PASSWORD', 'secret']])) => {
  const context = vm.createContext(fakeGas(sheetRows, props));
  GAS_FILES.forEach((file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file }));
  return context;
};

const doGetJson = (context) => JSON.parse(vm.runInContext('doGet()', context).text);

test('doGet は公開中で日付が来たお知らせだけを、ID・添付ファイルURL付き・公開フラグなしの JSON で返す', () => {
  const context = loadGas(ROWS);
  const output = vm.runInContext('doGet()', context);
  assert.equal(output.type, 'json');
  assert.deepEqual(JSON.parse(output.text).news, [
    { id: 'n-001', date: '2026-10-15', category: 'event', title: '公開中', body: '本文', attachmentUrl: ATTACHMENT, order: null },
  ]);
  assert.match(JSON.parse(output.text).updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('応答をキャッシュに保存し、onEdit でキャッシュが消える', () => {
  const context = loadGas(ROWS);
  doGetJson(context);
  assert.equal(context.cache.size, 1);
  vm.runInContext('onEdit()', context);
  assert.equal(context.cache.size, 0);
});

test('シート「news」が無ければ空の一覧を返す', () => {
  assert.deepEqual(doGetJson(loadGas(null)).news, []);
});

test('シートの読み取りに失敗しても JSON のエラーを返す', () => {
  const context = loadGas(ROWS);
  vm.runInContext("SpreadsheetApp.getActiveSpreadsheet = () => { throw new Error('権限なし'); };", context);
  assert.deepEqual(doGetJson(context), { error: 'お知らせを読み込めませんでした' });
});

test('シート初期設定の見出しは8列（A:ID〜G:公開フラグ・H:固定順位）と一致している', () => {
  assert.deepEqual([...vm.runInContext('NEWS_SHEET_HEADERS', loadGas(ROWS))], HEADER);
});

test('?debug=1 では見出し・件数・公開されない理由を返し、お知らせの中身は含めない', () => {
  const context = loadGas(ROWS);
  const result = JSON.parse(vm.runInContext("doGet({ parameter: { debug: '1' } })", context).text);
  assert.equal(result.sheetFound, true);
  assert.deepEqual(result.headers, HEADER);
  assert.deepEqual([result.rowCount, result.published, result.notPublished, result.future], [3, 1, 1, 1]);
  assert.equal('news' in result, false);
  assert.doesNotMatch(JSON.stringify(result), /公開中|n-001|drive\.google/);
  assert.equal(context.cache.size, 0);
});

test('?debug=1 でシート「news」が無ければ、実際のシート名の一覧を返す', () => {
  const result = JSON.parse(vm.runInContext("doGet({ parameter: { debug: '1' } })", loadGas(null)).text);
  assert.deepEqual(result, { sheetFound: false, expectedSheetName: 'news', sheetNames: ['シート1'] });
});

// ---- 管理画面からの POST（doPost） ----

const copyRows = () => ROWS.map((values) => [...values]);
const post = (context, body) =>
  JSON.parse(vm.runInContext(`doPost(${JSON.stringify({ postData: { contents: JSON.stringify(body) } })})`, context).text);
const newsInput = { date: '2026-10-22', category: 'info', title: '教室のお休み', body: '本文', attachmentUrl: '', published: true };
const pdfFile = { name: '案内.pdf', type: 'application/pdf', data: Buffer.from('%PDF-1.4').toString('base64') };

test('ログインは共通パスワードが一致したときだけ成功する', () => {
  const context = loadGas(copyRows());
  assert.deepEqual(post(context, { action: 'login', password: 'secret' }), { ok: true });
  assert.deepEqual(post(context, { action: 'login', password: 'wrong' }), { ok: false, auth: false, errors: ['パスワードが違います'] });
});

test('スクリプト プロパティにパスワードが未設定なら、どのパスワードでも入れない', () => {
  const result = post(loadGas(copyRows(), new Map()), { action: 'login', password: '' });
  assert.equal(result.auth, false);
  assert.match(result.errors[0], /ADMIN_PASSWORD/);
});

test('パスワードを10回間違えると、正しいパスワードでも一時的に受け付けない', () => {
  const context = loadGas(copyRows());
  Array.from({ length: 10 }).forEach(() => post(context, { action: 'login', password: 'wrong' }));
  assert.match(post(context, { action: 'login', password: 'secret' }).errors[0], /15分ほど/);
});

test('一覧は下書き・予約公開も含めて状態付きで返し、パスワードが無ければ返さない', () => {
  const context = loadGas(copyRows());
  assert.deepEqual(post(context, { action: 'list', password: 'secret' }).news.map((item) => item.status), ['published', 'notPublished', 'future']);
  assert.equal(post(context, { action: 'list' }).news, undefined);
});

test('追加すると自動採番した行をシートの末尾に書き、ロックをかけ、公開用キャッシュを消す', () => {
  const rows = copyRows();
  const context = loadGas(rows);
  context.cache.set('news-json-v3', 'old');
  assert.deepEqual(post(context, { action: 'create', password: 'secret', data: newsInput }), { ok: true, id: '1', attachmentUrl: '' });
  assert.deepEqual([...rows.at(-1)], ['1', '2026-10-22', 'お知らせ', '教室のお休み', '本文', '', '公開', '']);
  assert.deepEqual([context.record.locks, context.cache.has('news-json-v3')], [['wait', 'release'], false]);
});

test('添付ファイルはドライブの専用フォルダに保存し、全員閲覧可にした共有URLを F列に書く', () => {
  const rows = copyRows();
  const context = loadGas(rows);
  const result = post(context, { action: 'create', password: 'secret', data: { ...newsInput, file: pdfFile } });
  assert.equal(result.attachmentUrl, 'https://drive.google.com/file/d/file-1/view?usp=drivesdk');
  assert.equal(rows.at(-1)[5], result.attachmentUrl);
  assert.deepEqual(context.record.files.map((f) => [f.name, f.type, f.folderId, Buffer.from(f.bytes).toString()]),
    [['2026-10-22_案内.pdf', 'application/pdf', 'folder-1', '%PDF-1.4']]);
  assert.deepEqual([context.record.sharing, context.props.get('ADMIN_FOLDER_ID')], [[['anyone-with-link', 'view']], 'folder-1']);
});

test('2回目以降の添付は、保存済みのフォルダIDのフォルダを使い、新しく作らない', () => {
  const context = loadGas(copyRows());
  [1, 2].forEach(() => post(context, { action: 'create', password: 'secret', data: { ...newsInput, file: pdfFile } }));
  assert.deepEqual(context.record.folders, ['お知らせ添付ファイル']);
  assert.deepEqual(context.record.files.map((f) => f.folderId), ['folder-1', 'folder-1']);
});

test('入力や添付ファイルに誤りがあれば、シートにもドライブにも書かずに誤りを返す', () => {
  const rows = copyRows();
  const context = loadGas(rows);
  const result = post(context, { action: 'create', password: 'secret', data: { ...newsInput, title: '', file: { ...pdfFile, type: 'text/html' } } });
  assert.deepEqual([result.ok, result.errors.length], [false, 2]);
  assert.deepEqual([rows.length, context.record.files.length, context.record.locks.length], [4, 0, 0]);
});

test('不明な操作や JSON として読めない本文は「不明な操作です」を返す', () => {
  const context = loadGas(copyRows());
  assert.deepEqual(post(context, { action: 'delete', password: 'secret' }), { ok: false, errors: ['不明な操作です'] });
  const raw = vm.runInContext("doPost({ postData: { contents: 'not json' } })", context);
  assert.deepEqual(JSON.parse(raw.text).errors, ['不明な操作です']);
});

test('書き込み中に例外が起きても JSON のエラーを返す', () => {
  const context = loadGas(copyRows());
  vm.runInContext("LockService.getScriptLock = () => { throw new Error('ロック取得失敗'); };", context);
  const result = post(context, { action: 'create', password: 'secret', data: newsInput });
  assert.deepEqual([result.ok, /時間をおいて/.test(result.errors[0])], [false, true]);
});

test('追加時に入力した固定順位は H列に数値で書き、公開用の応答にも order として出す', () => {
  const rows = copyRows();
  const context = loadGas(rows);
  post(context, { action: 'create', password: 'secret', data: { ...newsInput, order: '1' } });
  assert.equal(rows.at(-1)[7], 1);
  assert.deepEqual(doGetJson(context).news.map((item) => [item.title, item.order]), [['公開中', null], ['教室のお休み', 1]]);
});
