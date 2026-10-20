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
