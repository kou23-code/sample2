const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_CONFIG } = require('../js/default-config.js');
const { mergeConfig, toTelHref, buildPageTitle, isUsableOverride } = require('../js/lib/config-merge.js');

test('上書きなしの場合はダミー設定がそのまま使われる', () => {
  assert.deepEqual(mergeConfig(DEFAULT_CONFIG, undefined), DEFAULT_CONFIG);
});

test('config.js の値でダミー設定が上書きされる', () => {
  const merged = mergeConfig(DEFAULT_CONFIG, { clubName: 'テストクラブ' });
  assert.equal(merged.clubName, 'テストクラブ');
  assert.equal(merged.tel, DEFAULT_CONFIG.tel);
});

test('未知のキー・空文字・文字列以外は無視される', () => {
  const merged = mergeConfig(DEFAULT_CONFIG, { unknown: 'x', tel: '  ', address: 123 });
  assert.equal('unknown' in merged, false);
  assert.equal(merged.tel, DEFAULT_CONFIG.tel);
  assert.equal(merged.address, DEFAULT_CONFIG.address);
});

test('マージは入力を変更せず、凍結された新しいオブジェクトを返す', () => {
  const overrides = { clubName: ' 前後空白 ' };
  const merged = mergeConfig(DEFAULT_CONFIG, overrides);
  assert.equal(merged.clubName, '前後空白');
  assert.equal(overrides.clubName, ' 前後空白 ');
  assert.equal(Object.isFrozen(merged), true);
});

test('isUsableOverride は空でない文字列のみ true', () => {
  assert.equal(isUsableOverride('a'), true);
  assert.equal(isUsableOverride(''), false);
  assert.equal(isUsableOverride(null), false);
});

test('電話番号から tel: リンクを生成する', () => {
  assert.equal(toTelHref('000-000-0000'), 'tel:0000000000');
  assert.equal(toTelHref('+81 00-0000'), 'tel:+81000000');
});

test('ページタイトルを組み立てる', () => {
  assert.equal(buildPageTitle('教室案内', 'Aクラブ'), '教室案内｜Aクラブ');
  assert.equal(buildPageTitle('', 'Aクラブ'), 'Aクラブ');
});
