// 問い合わせフォームの受付（gas/contact-form.js・gas/contact-api.js と doPost の振り分け）を、GASのサービスを偽物に差し替えた実行環境で検証する
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { inquiryRequestBody, FORM_FIELDS } = require('../js/lib/form-validate.js');

const ROOT = path.join(__dirname, '..');
// GAS に貼り付けるファイル一式（js/lib/form-validate.js は「contact-validate」としてサイトと共用する）
const GAS_FILES = [
  'js/lib/form-validate.js', 'gas/news-sheet.js', 'gas/news-admin.js', 'gas/contact-form.js', 'gas/contact-api.js', 'gas/news-api.js',
];
const RECEIVED_AT = '2026-10-23 10:00:00';
const FAR_DATE = '2099-01-10';

const trialValues = {
  inquiryType: 'trial', classId: 'play', preferredDate: FAR_DATE, guardianName: '架空 花子', participantName: '架空 太郎',
  schoolName: '架空小学校', grade: 'es3', age: '8', name: '', email: 'hanako@example.com', tel: '000-000-0000',
  message: 'よろしくお願いします', agree: 'on',
};
const generalValues = {
  inquiryType: 'general', name: '架空 一郎', email: 'ichiro@example.com', tel: '000-000-0000', message: '駐車場はありますか', agree: 'on',
};

// 範囲の操作を記録するだけの偽のセル範囲
const fakeRange = (record, a1) => {
  const range = {
    setValues: (values) => record.ranges.push(['setValues', a1, values]) && range,
    setFontWeight: () => range,
    setNumberFormat: (format) => record.ranges.push(['setNumberFormat', a1, format]) && range,
  };
  return range;
};

const fakeSheet = (record, name) => ({
  rows: [],
  appendRow(values) { this.rows.push(values); },
  getRange: (...args) => fakeRange(record, args.join(',')),
  setFrozenRows: () => {},
  name,
});

// シート「名前」を作成・取得できる偽のスプレッドシート
const fakeBook = (record) => ({
  getSheetByName: (name) => record.sheets.get(name) ?? null,
  insertSheet: (name) => record.sheets.set(name, fakeSheet(record, name)).get(name),
});

// 時刻・プロパティ・キャッシュ・ロック・応答の偽物
const fakeServices = (record, cache, props) => ({
  Session: { getScriptTimeZone: () => 'Asia/Tokyo' },
  Utilities: { formatDate: () => RECEIVED_AT },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null }) },
  CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
  LockService: { getScriptLock: () => ({ waitLock: () => record.locks.push('wait'), releaseLock: () => record.locks.push('release') }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ text, setMimeType: (type) => ({ text, type }) }) },
});

// シートの作成・追記、メール、キャッシュ、ロックを記録する偽の GAS サービス
const fakeGas = (props) => {
  const record = { sheets: new Map(), mails: [], ranges: [], locks: [] };
  const cache = new Map();
  return {
    record, cache, console: { error: () => {} }, ...fakeServices(record, cache, props),
    SpreadsheetApp: { getActiveSpreadsheet: () => fakeBook(record) },
    MailApp: { sendEmail: (message) => record.mails.push(message) },
  };
};

const loadGas = (props = new Map([['ADMIN_PASSWORD', 'secret']])) => {
  const context = vm.createContext(fakeGas(props));
  GAS_FILES.forEach((file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file }));
  return context;
};

// サイトと同じ形の本文で doPost を呼ぶ
const postRaw = (context, contents) =>
  JSON.parse(vm.runInContext(`doPost(${JSON.stringify({ postData: { contents } })})`, context).text);
const postContact = (context, values, classLabel = '') => postRaw(context, inquiryRequestBody(values, classLabel));
const contactRows = (context) => context.record.sheets.get('お問い合わせ')?.rows ?? [];

test('体験申込を受け付けると「お問い合わせ」シートを見出し付きで作り、全項目を1行追記する', () => {
  const context = loadGas();
  assert.deepEqual(postContact(context, trialValues, '運動あそび教室'), { ok: true });
  assert.deepEqual(JSON.parse(JSON.stringify(context.record.ranges[0])), ['setValues', '1,1,1,14', [[
    '受付日時', '種別', '希望教室', '希望日', '保護者名', '参加者のお名前', '学校名', '学年', '年齢',
    'お名前', 'メールアドレス', '電話番号', 'お問い合わせ内容', '対応状況',
  ]]]);
  assert.deepEqual(contactRows(context).map((row) => [...row]), [[
    RECEIVED_AT, '体験申込', '運動あそび教室', FAR_DATE, '架空 花子', '架空 太郎', '架空小学校', '小学3年', '8歳',
    '', 'hanako@example.com', '000-000-0000', 'よろしくお願いします', '未対応',
  ]]);
  assert.deepEqual(context.record.locks, ['wait', 'release']);
});

test('電話番号の先頭の0などが消えないよう、作成したシートは書式なしテキストにする', () => {
  const context = loadGas();
  postContact(context, trialValues);
  assert.ok(context.record.ranges.some(([op, , format]) => op === 'setNumberFormat' && format === '@'));
});

test('一般的なお問い合わせは、体験専用の列を空欄にして追記する（2件目以降は同じシートに追記）', () => {
  const context = loadGas();
  postContact(context, trialValues);
  postContact(context, { ...generalValues, preferredDate: '2026-10-01', guardianName: '送られても書かない' });
  assert.deepEqual([...contactRows(context)[1]], [
    RECEIVED_AT, '一般的なお問い合わせ', '', '', '', '', '', '', '', '架空 一郎', 'ichiro@example.com', '000-000-0000', '駐車場はありますか', '未対応',
  ]);
  assert.equal(context.record.ranges.filter(([op]) => op === 'setValues').length, 1);
});

test('通知メールは、宛先・件名・全項目を記載した本文・返信先（送信者）で送る', () => {
  const context = loadGas(new Map([['CONTACT_NOTIFY_EMAIL', 'staff@example.com']]));
  postContact(context, trialValues, '運動あそび教室');
  const [mail] = context.record.mails;
  assert.deepEqual([mail.to, mail.subject, mail.replyTo], ['staff@example.com', '【ホームページ】体験申込：架空 花子 様', 'hanako@example.com']);
  ['■種別\n体験申込', '■希望教室\n運動あそび教室', `■希望日\n${FAR_DATE}`, '■保護者名\n架空 花子', '■参加者のお名前\n架空 太郎',
    '■学校名\n架空小学校', '■学年\n小学3年', '■年齢\n8歳', '■メールアドレス\nhanako@example.com', '■電話番号\n000-000-0000',
    '■お問い合わせ内容\nよろしくお願いします', `受付日時：${RECEIVED_AT}`].forEach((text) => assert.ok(mail.body.includes(text), text));
  assert.equal(mail.body.includes('■お名前'), false);
});

test('一般的なお問い合わせのメールは、お名前・連絡先・内容だけを記載する', () => {
  const context = loadGas();
  postContact(context, generalValues);
  const [mail] = context.record.mails;
  assert.equal(mail.subject, '【ホームページ】一般的なお問い合わせ：架空 一郎 様');
  assert.deepEqual(mail.body.match(/^■.+$/gm), ['■種別', '■お名前', '■メールアドレス', '■電話番号', '■お問い合わせ内容']);
});

test('通知先がスクリプト プロパティに未登録なら、仮置きのダミーアドレス宛てにする', () => {
  const context = loadGas(new Map());
  postContact(context, generalValues);
  assert.equal(context.record.mails[0].to, 'admin@example.com');
});

test('入力に誤りがあれば、シートにもメールにも出さずに誤りを返す（サイトと同じ検証ルール）', () => {
  const context = loadGas();
  const result = postContact(context, { ...trialValues, guardianName: '', tel: '123', preferredDate: '2020-01-01' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.length, 3);
  assert.deepEqual([contactRows(context).length, context.record.mails.length], [0, 0]);
});

test('GAS では希望日の下限に1日の猶予を持たせる（今日は不可、明日は可。端末との時差・日付またぎ対策）', () => {
  const toIso = (offset) => vm.runInContext(`toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + ${offset}))`, loadGas());
  assert.equal(postContact(loadGas(), { ...trialValues, preferredDate: toIso(0) }).ok, false);
  assert.equal(postContact(loadGas(), { ...trialValues, preferredDate: toIso(1) }).ok, true);
});

test('教室IDの形が不正なら受け付けない（教室の一覧はサイト側にしかないため形だけ確かめる）', () => {
  assert.equal(postContact(loadGas(), { ...trialValues, classId: '<script>' }).ok, false);
});

test('先頭が = + - @ の入力は数式として実行されないよう先頭に \' を付けて書く', () => {
  const context = loadGas();
  postContact(context, { ...generalValues, name: '=HYPERLINK("x")', message: '+1' });
  const row = contactRows(context)[0];
  assert.deepEqual([row[9], row[12]], ['\'=HYPERLINK("x")', '\'+1']);
});

test('希望教室の表示名が届かなければ教室IDを書き、長すぎる表示名は100文字で切る', () => {
  const context = loadGas();
  postContact(context, trialValues, '');
  postContact(context, trialValues, 'あ'.repeat(150));
  assert.deepEqual(contactRows(context).map((row) => row[2].length), ['play'.length, 100]);
});

test('メールが送れなくても（送信上限など）、シートに保存済みのため成功を返す', () => {
  const context = loadGas();
  vm.runInContext("MailApp.sendEmail = () => { throw new Error('Service invoked too many times'); };", context);
  assert.deepEqual(postContact(context, generalValues), { ok: true });
  assert.equal(contactRows(context).length, 1);
});

test('10分間に20件を超える送信は受け付けない（メールの上限を使い切らないため）', () => {
  const context = loadGas();
  Array.from({ length: 20 }).forEach(() => postContact(context, generalValues));
  const result = postContact(context, generalValues);
  assert.deepEqual([result.ok, /お電話/.test(result.errors[0]), contactRows(context).length], [false, true, 20]);
});

test('シートへの書き込みで例外が起きたら、一般公開のフォームには例外の詳細（detail）を返さない', () => {
  const context = loadGas();
  vm.runInContext("SpreadsheetApp.getActiveSpreadsheet = () => { throw new Error('内部の詳細'); };", context);
  const result = postContact(context, generalValues);
  assert.deepEqual(result, { ok: false, errors: ['送信できませんでした。お手数ですがお電話でお問い合わせください'] });
});

// ---- doPost の振り分け ----

test('action が contact の POST はパスワード不要で受け付け、管理画面の操作には振り分けない', () => {
  const context = loadGas();
  assert.deepEqual(postContact(context, generalValues), { ok: true });
  assert.equal(context.cache.has('news-admin-login-fail'), false);
});

test('お知らせ管理の POST は従来どおりパスワードで認証し、問い合わせ処理には振り分けない', () => {
  const context = loadGas();
  assert.deepEqual(postRaw(context, JSON.stringify({ action: 'login', password: 'secret' })), { ok: true });
  assert.equal(postRaw(context, JSON.stringify({ action: 'login', password: 'x' })).auth, false);
  assert.deepEqual(postRaw(context, JSON.stringify({ action: 'list', data: generalValues })).auth, false);
  assert.deepEqual([contactRows(context).length, context.record.mails.length], [0, 0]);
});

test('管理画面の操作で例外が起きたときは、従来どおり detail を返す', () => {
  const context = loadGas();
  vm.runInContext("LockService.getScriptLock = () => { throw new Error('ロック取得失敗'); };", context);
  const input = { date: '2026-10-22', category: 'info', title: 't', body: '', attachmentUrl: '', published: true };
  vm.runInContext("SpreadsheetApp.getActiveSpreadsheet = () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => [[]] }) }) });", context);
  assert.equal(postRaw(context, JSON.stringify({ action: 'create', password: 'secret', data: input })).detail, 'Error: ロック取得失敗');
});

// ---- サイトと GAS の整合性 ----

test('シート・メールの項目は、サイトのフォームの全項目（同意を除く）と一致している', () => {
  const labels = vm.runInContext('Object.keys(CONTACT_FIELD_LABELS)', loadGas());
  assert.deepEqual([...labels], FORM_FIELDS.filter((field) => field !== 'agree'));
});
