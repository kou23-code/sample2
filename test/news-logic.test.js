const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NEWS_CATEGORIES, NEWS_DATA } = require('../js/data/news-data.js');
const {
  sortNewsByDate, filterNewsByCategory, latestNews, categoryLabel, formatDateJa, newsOrder, sortNewsForDisplay,
  isNewsDate, newsEntryErrors, findNewsProblems, toNewsItem, prepareNews,
  isNewsEndpoint, parseNewsResponse,
  isHttpsUrl, driveFileId, attachmentPreviewSrc, newsAttachment, findAttachmentProblems,
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

test('表示用データは前後の空白を除いて凍結し、id・body・添付URLの省略時は空文字、固定順位の省略時は null にする', () => {
  const item = toNewsItem({ date: ' 2026-10-15 ', category: ' event ', title: ' 体験会 ' });
  assert.deepEqual(item, { id: '', date: '2026-10-15', category: 'event', title: '体験会', body: '', attachmentUrl: '', order: null });
  assert.equal(Object.isFrozen(item), true);
});

test('表示用データは ID と https の添付URLを残し、使えない添付URLは空文字にする', () => {
  const url = 'https://example.com/a.pdf';
  assert.deepEqual([toNewsItem({ ...okEntry, id: ' n-1 ', attachmentUrl: ` ${url} ` })].map((n) => [n.id, n.attachmentUrl]), [['n-1', url]]);
  assert.equal(toNewsItem({ ...okEntry, attachmentUrl: 'http://example.com/a.pdf' }).attachmentUrl, '');
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

// ---- 添付ファイル ----

const DRIVE_ID = '1AbC_d-EfG';
const THUMBNAIL = `https://drive.google.com/thumbnail?id=${DRIVE_ID}&sz=w800`;

test('https で始まり、空白・引用符・山かっこを含まない URL だけを添付として使う', () => {
  assert.equal(isHttpsUrl(' https://example.com/a.pdf '), true);
  ['', undefined, 'http://example.com/a.pdf', 'javascript:alert(1)', 'https://a.com/x"onerror', 'https://a.com/<x>', 'https://a.com/a b']
    .forEach((url) => assert.equal(isHttpsUrl(url), false, String(url)));
});

test('Googleドライブの共有リンクの3つの形からファイルIDを取り出し、ドライブ以外は空文字', () => {
  [`https://drive.google.com/file/d/${DRIVE_ID}/view?usp=sharing`, `https://drive.google.com/open?id=${DRIVE_ID}`,
    `https://drive.google.com/uc?export=view&id=${DRIVE_ID}`].forEach((url) => assert.equal(driveFileId(url), DRIVE_ID, url));
  ['https://example.com/file/d/x/view', 'https://docs.google.com/document/d/x/edit', ''].forEach((url) =>
    assert.equal(driveFileId(url), '', url));
});

test('プレビュー画像はドライブならサムネイル、画像ファイルならそのURL、それ以外は無し', () => {
  assert.equal(attachmentPreviewSrc(`https://drive.google.com/file/d/${DRIVE_ID}/view`), THUMBNAIL);
  assert.equal(attachmentPreviewSrc('https://example.com/photo.JPG?w=800'), 'https://example.com/photo.JPG?w=800');
  assert.equal(attachmentPreviewSrc('https://example.com/guide.pdf'), '');
});

test('添付ファイルは開くURLとプレビュー画像のURLにし、使えないURLは null', () => {
  const share = `https://drive.google.com/file/d/${DRIVE_ID}/view`;
  assert.deepEqual(newsAttachment(share), { href: share, previewSrc: THUMBNAIL });
  assert.deepEqual(newsAttachment('https://example.com/guide.pdf'), { href: 'https://example.com/guide.pdf', previewSrc: '' });
  assert.equal(Object.isFrozen(newsAttachment(share)), true);
  [undefined, '', 'http://example.com/a.png'].forEach((url) => assert.equal(newsAttachment(url), null, String(url)));
});

test('添付URLが書かれているのに使えないお知らせだけを番号付きで返す', () => {
  const entries = [okEntry, { ...okEntry, attachmentUrl: 'https://ok.example/a.pdf' }, { ...okEntry, attachmentUrl: 'ドライブ参照' }, null];
  assert.deepEqual(findAttachmentProblems(entries), [{ number: 3, title: '体験会', url: 'ドライブ参照' }]);
});

// ---- 表示順（固定順位） ----

const ordered = (id, date, order) => ({ id, date, category: 'info', title: id, order });

test('固定順位は数値・数字の文字列なら数値にし、空や数値でないものは null にする', () => {
  [[1, 1], ['2', 2], [' 3 ', 3], [1.5, 1.5]].forEach(([value, expected]) => assert.equal(newsOrder(value), expected, String(value)));
  [undefined, null, '', ' ', 'abc', NaN, Infinity].forEach((value) => assert.equal(newsOrder(value), null, String(value)));
});

test('固定順位があるものを先に小さい順、ないものは日付の新しい順に並べ、元の配列は変更しない', () => {
  const news = [ordered('a', '2026-10-20', null), ordered('b', '2026-09-01', 2), ordered('c', '2026-10-22', null), ordered('d', '2026-08-01', 1)];
  assert.deepEqual(sortNewsForDisplay(news).map((n) => n.id), ['d', 'b', 'c', 'a']);
  assert.deepEqual(news.map((n) => n.id), ['a', 'b', 'c', 'd']);
});

test('同じ固定順位どうしは日付の新しい順に並べる', () => {
  const news = [ordered('old', '2026-09-01', 1), ordered('new', '2026-10-01', 1)];
  assert.deepEqual(sortNewsForDisplay(news).map((n) => n.id), ['new', 'old']);
});

test('トップの最新3件も固定順位のお知らせを先頭に表示する', () => {
  const news = [ordered('a', '2026-10-22', null), ordered('b', '2026-10-21', null), ordered('pin', '2026-01-01', 1), ordered('c', '2026-10-20', null)];
  assert.deepEqual(latestNews(news, 3).map((n) => n.id), ['pin', 'a', 'b']);
});

test('固定順位が数値でないお知らせは誤りとして知らせ、空・省略・数値は誤りなし', () => {
  assert.match(newsEntryErrors({ ...okEntry, order: '一番上' }, NEWS_CATEGORIES)[0], /order（固定順位）「一番上」は数値/);
  [undefined, null, '', 3, '3'].forEach((order) => assert.deepEqual(newsEntryErrors({ ...okEntry, order }, NEWS_CATEGORIES), [], String(order)));
});

test('表示用データは固定順位を数値で残す', () => {
  assert.equal(toNewsItem({ ...okEntry, order: '2' }).order, 2);
  assert.deepEqual(prepareNews([ordered('x', '2026-10-01', 5)], NEWS_CATEGORIES).map((n) => n.order), [5]);
});
