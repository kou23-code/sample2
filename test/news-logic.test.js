const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NEWS_CATEGORIES, NEWS_DATA } = require('../js/data/news-data.js');
const {
  sortNewsByDate, filterNewsByCategory, latestNews, categoryLabel, formatDateJa,
} = require('../js/lib/news-logic.js');

const sample = [
  { id: 'a', date: '2026-01-10', category: 'info' },
  { id: 'b', date: '2026-03-01', category: 'event' },
  { id: 'c', date: '2026-02-15', category: 'info' },
];

test('日付の新しい順に並べ、元の配列は変更しない', () => {
  assert.deepEqual(sortNewsByDate(sample).map((n) => n.id), ['b', 'c', 'a']);
  assert.deepEqual(sample.map((n) => n.id), ['a', 'b', 'c']);
});

test('カテゴリで絞り込める', () => {
  assert.deepEqual(filterNewsByCategory(sample, 'info').map((n) => n.id), ['a', 'c']);
});

test("'all' や未指定なら全件を返す", () => {
  assert.equal(filterNewsByCategory(sample, 'all').length, 3);
  assert.equal(filterNewsByCategory(sample, undefined).length, 3);
});

test('該当なしのカテゴリは空配列', () => {
  assert.deepEqual(filterNewsByCategory(sample, 'recruit'), []);
});

test('最新3件を取得できる', () => {
  assert.deepEqual(latestNews(NEWS_DATA, 3).map((n) => n.date), ['2026-10-15', '2026-10-01', '2026-09-20']);
  assert.deepEqual(latestNews(sample, -1), []);
});

test('カテゴリ表示名を引ける', () => {
  assert.equal(categoryLabel(NEWS_CATEGORIES, 'event'), 'イベント');
  assert.equal(categoryLabel(NEWS_CATEGORIES, 'zzz'), 'zzz');
});

test('日付を日本語表記に整形する', () => {
  assert.equal(formatDateJa('2026-09-05'), '2026年9月5日');
});

test('お知らせデータのカテゴリはすべて定義済み', () => {
  const ids = NEWS_CATEGORIES.map((c) => c.id);
  assert.equal(NEWS_DATA.every((n) => ids.includes(n.category)), true);
});
