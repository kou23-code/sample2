// HTMLと同じ順序で全スクリプトを1つの実行環境に読み込み、ブラウザ上での結合を確認する
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SCRIPT_ORDER = [
  'js/default-config.js', 'js/data/news-data.js', 'js/data/classes-data.js',
  'js/lib/config-merge.js', 'js/lib/news-logic.js', 'js/lib/class-logic.js',
  'js/lib/form-validate.js', 'js/lib/templates.js', 'js/app.js',
];

const loadScripts = (prelude) => {
  const context = vm.createContext({ URLSearchParams });
  vm.runInContext(prelude, context);
  SCRIPT_ORDER.forEach((file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file }));
  return context;
};

test('全スクリプトをブラウザと同じ順で読み込んでも名前が衝突しない', () => {
  const context = loadScripts('');
  assert.equal(vm.runInContext('typeof initSite', context), 'function');
});

test('ブラウザ環境でもテンプレートが依存関数を参照できる', () => {
  const context = loadScripts('');
  assert.match(vm.runInContext('newsListHtml(latestNews(NEWS_DATA, 1), NEWS_CATEGORIES)', context), /2026年10月15日/);
});

test('ブラウザ環境では検証済み・凍結済みのお知らせ（NEWS_ITEMS）を表示に使う', () => {
  const context = loadScripts('');
  assert.equal(vm.runInContext('NEWS_ITEMS.length === NEWS_DATA.length && Object.isFrozen(NEWS_ITEMS[0])', context), true);
  assert.match(vm.runInContext('newsListHtml(latestNews(NEWS_ITEMS, 3), NEWS_CATEGORIES)', context), /陸上教室②の練習時間/);
});

test('ブラウザ環境でも会費システムを組み立てられる', () => {
  const context = loadScripts('');
  assert.match(vm.runInContext('feeSystemHtml(FEE_SYSTEM)', context), /年間を4期/);
});

test('ブラウザ環境でもスポーツ安全保険の料金表を組み立てられる', () => {
  const context = loadScripts('');
  assert.match(vm.runInContext('insuranceHtml(SPORTS_INSURANCE)', context), /65歳以上<\/th><td>1,200円/);
});

test('ブラウザ環境でも「会費について」ブロック全体を組み立てられる', () => {
  const context = loadScripts('');
  const html = vm.runInContext('feeInfoHtml(CLASSES_DATA, FEE_SYSTEM, SPORTS_INSURANCE)', context);
  assert.match(html, /全教室共通[\s\S]*1期あたり 3,600円〜7,000円[\s\S]*<details class="insurance">[\s\S]*各教室1回まで無料/);
});

test('config.js 未配置ならダミー設定を使う', () => {
  const context = loadScripts('');
  assert.equal(vm.runInContext('resolveSiteConfig().clubName', context), 'あおぞら総合型地域スポーツクラブ');
});

test('config.js（SITE_CONFIG）があれば値が上書きされる', () => {
  const context = loadScripts("const SITE_CONFIG = { clubName: '上書きクラブ', tel: '000-111-2222' };");
  assert.equal(vm.runInContext('resolveSiteConfig().clubName', context), '上書きクラブ');
  assert.equal(vm.runInContext('resolveSiteConfig().address', context), '架空県みどり市さくら町1-2-3');
});

test('config-sample.js はそのまま SITE_CONFIG として読み込める', () => {
  const context = loadScripts(fs.readFileSync(path.join(ROOT, 'config-sample.js'), 'utf8'));
  assert.equal(vm.runInContext('resolveSiteConfig().tel', context), '000-111-2222');
});

// ---- お知らせの取得（fetch・タイマー・console はテスト用の偽物に差し替える） ----

const fakeBrowser = (fetchResult) => `
  class AbortController { constructor() { this.signal = {}; } abort() {} }
  const setTimeout = () => 0;
  const clearTimeout = () => {};
  const console = { warn: () => {} };
  const fetch = () => Promise.resolve(${fetchResult});
  const SITE_CONFIG = { newsEndpoint: 'https://example.invalid/exec' };`;

const loadedTitles = (context) =>
  vm.runInContext('loadNewsItems(resolveSiteConfig()).then((news) => news.map((item) => item.title))', context);

test('取得先が未設定・仮の値なら予備のお知らせを使う', async () => {
  const context = loadScripts(fs.readFileSync(path.join(ROOT, 'config-sample.js'), 'utf8'));
  assert.equal(await vm.runInContext('loadNewsItems(resolveSiteConfig()).then((news) => news === NEWS_ITEMS)', context), true);
});

test('取得に成功したら、誤りのあるお知らせを除いて Webアプリのお知らせを使う', async () => {
  const json = "{ updatedAt: 'x', news: [{ date: '2026-11-01', category: 'イベント', title: '誤り' }, { date: '2026-11-02', category: 'event', title: 'シートから取得' }] }";
  const context = loadScripts(fakeBrowser(`{ ok: true, json: () => Promise.resolve(${json}) }`));
  assert.deepEqual([...await loadedTitles(context)], ['シートから取得']);
});

test('HTTPエラーや応答の形式違いなら予備のお知らせを使う', async () => {
  const contexts = [
    loadScripts(fakeBrowser('{ ok: false, status: 500 }')),
    loadScripts(fakeBrowser("{ ok: true, json: () => Promise.resolve({ error: '読み込めませんでした' }) }")),
  ];
  const results = await Promise.all(contexts.map(loadedTitles));
  results.forEach((titles) => assert.equal(titles.length, 6));
});

// ---- お知らせ管理画面（admin.html と同じ順で読み込む） ----

const ADMIN_SCRIPT_ORDER = [...SCRIPT_ORDER.slice(0, -1), 'js/lib/admin-logic.js', 'js/admin.js'];

const loadAdminScripts = (prelude) => {
  const context = vm.createContext({ URLSearchParams });
  vm.runInContext(prelude, context);
  ADMIN_SCRIPT_ORDER.forEach((file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file }));
  return context;
};

test('管理画面のスクリプトをブラウザと同じ順で読み込んでも名前が衝突せず、依存関数を参照できる', () => {
  const context = loadAdminScripts('');
  assert.equal(vm.runInContext('typeof initAdmin', context), 'function');
  assert.match(vm.runInContext("adminNewsTableHtml([{ id: '1', date: '2026-10-22', category: 'info', title: 't', status: 'published' }], NEWS_CATEGORIES)", context), /公開中/);
});

test('管理画面とサイトのスクリプトを両方読み込んでも名前が衝突しない', () => {
  const context = loadScripts('');
  ['js/lib/admin-logic.js', 'js/admin.js'].forEach((file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context));
  assert.equal(vm.runInContext('typeof initAdmin === "function" && typeof initSite === "function"', context), true);
});

test('管理画面は config.js の newsEndpoint を取得先に使う', () => {
  const context = loadAdminScripts("const SITE_CONFIG = { newsEndpoint: 'https://script.google.com/macros/s/x/exec' };");
  assert.equal(vm.runInContext('adminSiteConfig().newsEndpoint', context), 'https://script.google.com/macros/s/x/exec');
});

test('トップページの最新のお知らせは5件表示する', () => {
  const context = loadScripts('');
  assert.equal(vm.runInContext('TOP_NEWS_COUNT', context), 5);
  const html = vm.runInContext('newsLinkListHtml(latestNews(NEWS_ITEMS, TOP_NEWS_COUNT), NEWS_CATEGORIES)', context);
  assert.equal((html.match(/<li class="news-item">/g) ?? []).length, 5);
});

// ---- お問い合わせフォームの項目の切り替え（フォームは最小限の偽物） ----

const fakeControl = () => ({ required: false, disabled: true });
const fakeGroup = (typeId, count) => {
  const controls = Array.from({ length: count }, fakeControl);
  return { dataset: { inquiryOnly: typeId }, hidden: true, controls, querySelectorAll: () => controls };
};
const fakeContactForm = (typeId) => {
  const groups = [fakeGroup('trial', 7), fakeGroup('general', 1)];
  return { groups, elements: { inquiryType: { value: typeId } }, querySelectorAll: () => groups };
};
// [表示中か, 全欄が必須か, 全欄が無効か] を種別ごとに返す
const groupStates = (form) => form.groups.map((group) => [group.dataset.inquiryOnly, !group.hidden,
  group.controls.every((control) => control.required), group.controls.every((control) => control.disabled)]);

test('種別の切り替えに合わせて、専用項目の枠の表示と各欄の required・disabled が連動する', () => {
  const toggle = vm.runInContext('toggleInquiryFields', loadScripts(''));
  const form = fakeContactForm('trial');
  toggle(form);
  assert.deepEqual(groupStates(form), [['trial', true, true, false], ['general', false, false, true]]);
  form.elements.inquiryType.value = 'general';
  toggle(form);
  assert.deepEqual(groupStates(form), [['trial', false, false, true], ['general', true, true, false]]);
});

test('種別が未選択なら、どちらの専用項目も非表示・必須なし', () => {
  const form = fakeContactForm('');
  vm.runInContext('toggleInquiryFields', loadScripts(''))(form);
  assert.deepEqual(groupStates(form), [['trial', false, false, true], ['general', false, false, true]]);
});

// ---- お問い合わせの送信（fetch は記録するだけの偽物） ----

const fakeInquiryBrowser = (response) => `
  class AbortController { constructor() { this.signal = {}; } abort() {} }
  const setTimeout = () => 0;
  const clearTimeout = () => {};
  const sentRequests = [];
  const fetch = (url, options) => { sentRequests.push({ url, options }); return Promise.resolve(${response}); };`;
const gasReply = (json) => `{ ok: true, json: () => Promise.resolve(${json}) }`;

test('お問い合わせは GAS へ text/plain の JSON（Content-Type なし）で送り、希望教室の表示名を添える', async () => {
  const context = loadScripts(fakeInquiryBrowser(gasReply('{ ok: true }')));
  const result = await vm.runInContext("postInquiry('https://example.invalid/exec', { inquiryType: 'trial', classId: 'play' })", context);
  const [request] = vm.runInContext('sentRequests', context);
  assert.equal(result, 'sent');
  assert.deepEqual([request.url, request.options.method, request.options.headers], ['https://example.invalid/exec', 'POST', undefined]);
  assert.deepEqual(JSON.parse(request.options.body), { action: 'contact', data: { inquiryType: 'trial', classId: 'play', classLabel: '運動あそび教室' } });
});

test('GAS が ok: false や HTTP エラーを返したら送信失敗として扱う', async () => {
  const failures = [gasReply("{ ok: false, errors: ['電話番号を入力してください'] }"), '{ ok: false, status: 500 }'];
  const results = await Promise.all(failures.map((reply) =>
    vm.runInContext("postInquiry('https://example.invalid/exec', {}).then(() => 'sent', (error) => error.message)", loadScripts(fakeInquiryBrowser(reply)))));
  assert.deepEqual(results, ['電話番号を入力してください', 'HTTP 500']);
});
