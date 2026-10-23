// HTMLページの規約（file:// 対策のリンク表記・リンク先の存在・スクリプト読み込み順）を検証する
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PAGES = ['index.html', 'about.html', 'news.html', 'classes.html', 'contact.html'];
const SCRIPTS = [
  './js/default-config.js', './config.js', './js/data/news-data.js', './js/data/classes-data.js',
  './js/lib/config-merge.js', './js/lib/news-logic.js', './js/lib/class-logic.js',
  './js/lib/form-validate.js', './js/lib/templates.js', './js/app.js',
];

const readPage = (page) => fs.readFileSync(path.join(ROOT, page), 'utf8');
const attrValues = (html, attr) => [...html.matchAll(new RegExp(`${attr}="([^"]*)"`, 'g'))].map((m) => m[1]);
const isExternal = (url) => /^(tel:|mailto:|https?:|#)/.test(url);
const stripQuery = (url) => url.split(/[?#]/)[0];
const scriptSrcs = (html) => [...html.matchAll(/<script src="([^"]*)"/g)].map((m) => m[1]);

PAGES.forEach((page) => {
  test(`${page}：ページ内リンクは ./ で始まり .html 等の拡張子まで明記している`, () => {
    const links = attrValues(readPage(page), 'href').filter((url) => !isExternal(url));
    assert.ok(links.length > 0);
    links.forEach((url) => assert.match(stripQuery(url), /^\.\/[a-z0-9\-/]+\.(html|css|js)$/, url));
  });

  test(`${page}：リンク先・読み込みファイルが存在する（config.js を除く）`, () => {
    const html = readPage(page);
    const targets = [...attrValues(html, 'href'), ...attrValues(html, 'src')]
      .filter((url) => !isExternal(url) && url !== './config.js').map(stripQuery);
    targets.forEach((url) => assert.ok(fs.existsSync(path.join(ROOT, url)), `${url} が見つかりません`));
  });

  test(`${page}：5ページ分のメニューと決められた順のスクリプトを持つ`, () => {
    const html = readPage(page);
    assert.equal((html.match(/data-nav="/g) ?? []).length, 5);
    assert.deepEqual(scriptSrcs(html), SCRIPTS);
  });
});

test('教室案内・クラブ概要に共通の「会費について」見出しと表示枠が1つずつある', () => {
  ['classes.html', 'about.html'].forEach((page) => {
    const html = readPage(page);
    assert.equal((html.match(/data-fee-info/g) ?? []).length, 1, page);
    assert.match(html, /<h2 id="fee-heading">会費について<\/h2>/, page);
  });
});

test('教室案内では「会費について」が年代フィルタの直前にある', () => {
  const html = readPage('classes.html');
  assert.ok(html.indexOf('data-fee-info') < html.indexOf('id="class-filter"'));
  assert.equal(/data-fee-info[\s\S]*class-card|class="filter"[\s\S]*data-fee-info/.test(html), false);
});

test('会費の旧い個別の表示枠は残っていない', () => {
  ['classes.html', 'about.html'].forEach((page) => assert.doesNotMatch(readPage(page), /data-fee-system|data-insurance/, page));
});

test('ファイル名・フォルダ名は半角英数字とハイフンのみ（拡張子のドットを除く）', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
    .flatMap((entry) => (entry.isDirectory() ? [entry.name, ...walk(path.join(dir, entry.name))] : [entry.name]));
  walk(ROOT).forEach((name) => assert.match(name, /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*$/, name));
});

// ---- お知らせ管理画面（admin.html） ----

const ADMIN_SCRIPTS = [...SCRIPTS.slice(0, -1), './js/lib/admin-logic.js', './js/admin.js'];

test('admin.html は検索エンジンに載せず、管理画面用の順でスクリプトを読み込む（app.js は読み込まない）', () => {
  const html = readPage('admin.html');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.deepEqual(scriptSrcs(html), ADMIN_SCRIPTS);
  assert.equal(/data-nav="/.test(html), false);
});

test('admin.html のリンクは .html まで明記し、読み込むファイルが存在する（config.js を除く）', () => {
  const html = readPage('admin.html');
  attrValues(html, 'href').filter((url) => !isExternal(url)).forEach((url) => assert.match(stripQuery(url), /^\.\/[a-z0-9\-/]+\.(html|css|js)$/, url));
  scriptSrcs(html).filter((url) => url !== './config.js').forEach((url) => assert.ok(fs.existsSync(path.join(ROOT, url)), url));
});

test('公開ページのどこからも admin.html へリンクしない', () => {
  PAGES.forEach((page) => assert.doesNotMatch(readPage(page), /admin\.html/, page));
});

test('admin.html のフォームは日付・カテゴリ・タイトル・本文・ファイル・URL・固定順位・公開の入力欄を持つ', () => {
  const html = readPage('admin.html');
  ['date', 'category', 'title', 'body', 'file', 'attachmentUrl', 'order', 'published', 'password'].forEach((name) =>
    assert.match(html, new RegExp(`name="${name}"`), name));
  assert.match(html, /type="file"[^>]*accept="application\/pdf,image\/jpeg,image\/png,image\/gif,image\/webp"/);
});

test('contact.html：フォームより上に、電話への誘導の注意書きを持つ', () => {
  const html = readPage('contact.html');
  assert.match(html, /class="urgent-notice">※前日・当日のご予約や、お急ぎのご連絡は、必ずお電話にてお願いいたします。</);
  assert.ok(html.indexOf('urgent-notice') < html.indexOf('<form id="contact-form"'), '注意書きはフォームより上');
});

// 種別専用の枠の中身（開始タグから次の枠・共通項目の手前まで）
const contactSection = (html, start, end) => html.slice(html.indexOf(start), html.indexOf(end));

test('contact.html：種別専用の項目は対応する枠に入り、初期は非表示・無効（検証ロジックの対象項目と一致）', () => {
  const html = readPage('contact.html');
  const { TYPE_ONLY_FIELDS } = require('../js/lib/form-validate.js');
  const sections = {
    trial: contactSection(html, '<div id="trial-fields" class="form-group" data-inquiry-only="trial" hidden>', 'id="general-fields"'),
    general: contactSection(html, '<div id="general-fields" class="form-group" data-inquiry-only="general" hidden>', 'id="email"'),
  };
  Object.entries(TYPE_ONLY_FIELDS).forEach(([field, typeId]) => {
    assert.match(sections[typeId], new RegExp(`name="${field}"[^>]*disabled>`), `${field} は ${typeId} の枠にあり無効で始まる`);
  });
  assert.match(sections.trial, /<input type="date" id="preferredDate"/);
});

test('contact.html：共通項目（メール・電話・内容・同意）は常に required', () => {
  const html = readPage('contact.html');
  ['email', 'tel', 'message', 'agree'].forEach((field) => assert.match(html, new RegExp(`name="${field}"[^>]*required`), field));
});
