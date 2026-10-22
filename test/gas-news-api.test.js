// GASのWebアプリ（gas/news-api.js）を、GASのサービスを偽物に差し替えた実行環境で検証する
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const GAS_FILES = ['gas/news-sheet.js', 'gas/news-api.js'];

const HEADER = ['ID', '日付', 'カテゴリ', 'タイトル', '本文', '添付ファイルURL', '公開フラグ'];
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

// シート・キャッシュ・応答を記録する偽の GAS サービス
const fakeGas = (sheetRows) => {
  const cache = new Map();
  const sheet = sheetRows && { getDataRange: () => ({ getValues: () => sheetRows }) };
  return {
    cache, CacheService: fakeCacheService(cache), console: { error: () => {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ text, setMimeType: (type) => ({ text, type }) }) },
  };
};

const loadGas = (sheetRows) => {
  const context = vm.createContext(fakeGas(sheetRows));
  GAS_FILES.forEach((file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file }));
  return context;
};

const doGetJson = (context) => JSON.parse(vm.runInContext('doGet()', context).text);

test('doGet は公開中で日付が来たお知らせだけを、ID・添付ファイルURL付き・公開フラグなしの JSON で返す', () => {
  const context = loadGas(ROWS);
  const output = vm.runInContext('doGet()', context);
  assert.equal(output.type, 'json');
  assert.deepEqual(JSON.parse(output.text).news, [
    { id: 'n-001', date: '2026-10-15', category: 'event', title: '公開中', body: '本文', attachmentUrl: ATTACHMENT },
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

test('シート初期設定の見出しは確定した7列（A:ID〜G:公開フラグ）と一致している', () => {
  assert.deepEqual([...vm.runInContext('NEWS_SHEET_HEADERS', loadGas(ROWS))], HEADER);
});
