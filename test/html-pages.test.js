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
    assert.deepEqual(attrValues(html, 'src'), SCRIPTS);
  });
});

test('教室案内・クラブ概要に共通の会費システム表示枠がある', () => {
  ['classes.html', 'about.html'].forEach((page) => assert.match(readPage(page), /data-fee-system/, page));
});

test('ファイル名・フォルダ名は半角英数字とハイフンのみ（拡張子のドットを除く）', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
    .flatMap((entry) => (entry.isDirectory() ? [entry.name, ...walk(path.join(dir, entry.name))] : [entry.name]));
  walk(ROOT).forEach((name) => assert.match(name, /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*$/, name));
});
