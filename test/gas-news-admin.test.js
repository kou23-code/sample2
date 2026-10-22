// GAS用の管理画面入力チェック・行の組み立て（gas/news-admin.js）の単体テスト
// news-admin.js は news-sheet.js の関数を GAS と同じく共通の実行環境から参照するため、vm に両方を読み込んで検証する
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

const loadAdmin = () => {
  const context = vm.createContext({});
  ['gas/news-sheet.js', 'gas/news-admin.js'].forEach((file) =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file }));
  return context;
};

const gas = loadAdmin();
// vm の実行環境の関数を呼び、結果を JSON で受け取る（実行環境をまたぐ配列の比較を避ける）
const call = (name, ...args) => JSON.parse(vm.runInContext(`JSON.stringify(${name}(...${JSON.stringify(args)}))`, gas));

const okInput = { date: '2026-10-22', category: 'info', title: '教室のお休み', body: '本文', attachmentUrl: '', published: true };
const row = (id, date, category, title, published) => [id, date, category, title, '', '', published];

test('先頭が = + - @ の文字は数式として実行されないよう先頭に \' を付ける', () => {
  ['=SUM(A1)', '+1', '-1', '@x'].forEach((text) => assert.equal(call('escapeSheetFormula', text), `'${text}`, text));
  ['お知らせ', '1-2', 'a=b', ''].forEach((text) => assert.equal(call('escapeSheetFormula', text), text, text));
});

test('正しい入力は誤りなし（本文・添付URLは省略可）', () => {
  assert.deepEqual(call('adminInputErrors', okInput), []);
  assert.deepEqual(call('adminInputErrors', { ...okInput, body: '', attachmentUrl: 'https://drive.google.com/file/d/x/view' }), []);
});

test('日付・カテゴリ・タイトル・本文・添付URLの誤りを日本語で返す', () => {
  const errors = call('adminInputErrors', { date: '2026-02-30', category: 'zzz', title: ' ', body: 'あ'.repeat(2001), attachmentUrl: 'javascript:alert(1)' });
  assert.equal(errors.length, 5);
  [/日付/, /カテゴリ/, /タイトルを入力/, /本文は2000文字以内/, /添付ファイルURL/].forEach((pattern, i) => assert.match(errors[i], pattern));
});

test('タイトルは100文字まで、入力が無い場合もすべての必須項目の誤りを返す', () => {
  assert.match(call('adminInputErrors', { ...okInput, title: 'あ'.repeat(101) })[0], /タイトルは100文字以内/);
  assert.deepEqual(call('adminInputErrors', { ...okInput, title: 'あ'.repeat(100) }), []);
  assert.equal(call('adminInputErrors', null).length, 3);
});

test('入力をシートの7列（ID〜公開フラグ）の1行にし、カテゴリは日本語名、文字は数式対策をする', () => {
  assert.deepEqual(call('adminInputToRow', { ...okInput, title: '=危険' }, '5'),
    ['5', '2026-10-22', 'お知らせ', "'=危険", '本文', '', '公開']);
  assert.equal(call('adminInputToRow', { ...okInput, published: 'true' }, '5')[6], '非公開');
});

test('次のIDは数字のIDの最大値＋1（数字以外のIDは無視、無ければ 1）', () => {
  assert.equal(call('nextNewsId', [row('1'), row('3'), row('n-9'), row('')]), '4');
  assert.equal(call('nextNewsId', [row(2), row('10')]), '11');
  assert.equal(call('nextNewsId', []), '1');
});

test('IDが一致する行の位置を返し、空のIDや見つからない場合は -1', () => {
  const rows = [row('1'), row(2), row('3')];
  assert.equal(call('findNewsRowIndex', rows, '2'), 1);
  assert.equal(call('findNewsRowIndex', rows, ' 3 '), 2);
  assert.equal(call('findNewsRowIndex', rows, '9'), -1);
  assert.equal(call('findNewsRowIndex', [row('')], ''), -1);
});

test('管理画面の一覧は空行を除き、下書き・予約公開も公開フラグと状態付きで返す', () => {
  const rows = [
    row('1', '2026-10-01', 'お知らせ', '公開中', '公開'),
    row('2', '2026-10-01', 'イベント', '下書き', '非公開'),
    row('3', '2099-01-01', '募集', '予約', true),
    row('', '', '', '', ''),
  ];
  const list = call('adminNewsList', rows, '2026-10-22');
  assert.deepEqual(list.map((item) => [item.id, item.category, item.published, item.status]),
    [['1', 'info', true, 'published'], ['2', 'event', false, 'notPublished'], ['3', 'recruit', true, 'future']]);
});
