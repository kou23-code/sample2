const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NEWS_CATEGORIES, NEWS_DATA } = require('../js/data/news-data.js');
const {
  sortNewsByDate, filterNewsByCategory, latestNews, categoryLabel, formatDateJa,
  isNewsDate, newsEntryErrors, findNewsProblems, toNewsItem, prepareNews,
  isNewsEndpoint, parseNewsResponse,
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

const okEntry = { date: '2026-10-15', category: 'event', title: '体験会', body: '本文' };

test('実在する YYYY-MM-DD 形式の日付だけを正しい日付とみなす', () => {
  assert.equal(isNewsDate('2026-10-15'), true);
  assert.equal(isNewsDate(' 2028-02-29 '), true);
  ['2026-02-30', '2026-13-01', '2026/10/15', '2026-1-5', '', undefined, 20261015]
    .forEach((value) => assert.equal(isNewsDate(value), false, String(value)));
});

test('正しいお知らせは誤りなし（body は省略可）', () => {
  assert.deepEqual(newsEntryErrors(okEntry, NEWS_CATEGORIES), []);
  assert.deepEqual(newsEntryErrors({ ...okEntry, body: undefined }, NEWS_CATEGORIES), []);
});

test('日付・カテゴリ・タイトル・本文の誤りをそれぞれ日本語で知らせる', () => {
  const errors = newsEntryErrors({ date: '2026/10/15', category: 'evnt', title: ' ', body: 123 }, NEWS_CATEGORIES);
  assert.equal(errors.length, 4);
  assert.match(errors[0], /2026\/10\/15.*実在する日付/);
  assert.match(errors[1], /evnt.*info \/ event \/ class \/ recruit/);
  assert.match(errors[2], /title/);
  assert.match(errors[3], /body/);
});

test('オブジェクトでない行は書き方の誤りとして知らせる', () => {
  [null, 'text', ['2026-10-15']].forEach((entry) =>
    assert.match(newsEntryErrors(entry, NEWS_CATEGORIES)[0], /\{ date, category, title, body \}/));
});

test('誤りのあるお知らせだけを番号とタイトル付きで返す', () => {
  const problems = findNewsProblems([okEntry, { ...okEntry, date: '' }, null], NEWS_CATEGORIES);
  assert.deepEqual(problems.map((p) => [p.number, p.title, p.errors.length]), [[2, '体験会', 1], [3, '', 1]]);
});

test('表示用データは前後の空白を除いて凍結し、body 省略時は空文字にする', () => {
  const item = toNewsItem({ date: ' 2026-10-15 ', category: ' event ', title: ' 体験会 ' });
  assert.deepEqual(item, { date: '2026-10-15', category: 'event', title: '体験会', body: '' });
  assert.equal(Object.isFrozen(item), true);
});

test('誤りのあるお知らせを除いて表示用に整え、元の配列は変更しない', () => {
  const entries = [okEntry, { ...okEntry, category: 'zzz' }];
  const news = prepareNews(entries, NEWS_CATEGORIES);
  assert.deepEqual(news.map((n) => n.title), ['体験会']);
  assert.equal(Object.isFrozen(news), true);
  assert.equal(entries.length, 2);
});

test('お知らせデータ（js/data/news-data.js）に入力の誤りがない', () => {
  assert.deepEqual(findNewsProblems(NEWS_DATA, NEWS_CATEGORIES), []);
});

test('http(s) で始まる URL だけを取得先として使い、未設定や仮の値は使わない', () => {
  assert.equal(isNewsEndpoint('https://script.google.com/macros/s/abc/exec'), true);
  assert.equal(isNewsEndpoint(' http://localhost:8080/news '), true);
  ['', undefined, 'YOUR_GAS_WEB_APP_URL', 'javascript:alert(1)', 'https://'].forEach((url) =>
    assert.equal(isNewsEndpoint(url), false, String(url)));
});

test('Webアプリの応答からお知らせの配列を取り出し、形が違えば null を返す', () => {
  const news = [{ date: '2026-10-15', category: 'info', title: 'a' }];
  assert.equal(parseNewsResponse({ updatedAt: 'x', news }), news);
  [null, undefined, {}, { news: 'x' }, { error: '読み込めませんでした' }, []].forEach((json) =>
    assert.equal(parseNewsResponse(json), null, JSON.stringify(json)));
});
