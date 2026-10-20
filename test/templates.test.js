const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NEWS_CATEGORIES, NEWS_DATA } = require('../js/data/news-data.js');
const { AGE_GROUPS, CLASSES_DATA } = require('../js/data/classes-data.js');
const { INQUIRY_TYPES } = require('../js/lib/form-validate.js');
const tpl = require('../js/lib/templates.js');

test('HTML特殊文字をエスケープする', () => {
  assert.equal(tpl.escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(tpl.escapeHtml(undefined), '');
});

test('お知らせ一覧に日付・カテゴリ・タイトルが含まれる', () => {
  const html = tpl.newsListHtml(NEWS_DATA.slice(0, 1), NEWS_CATEGORIES);
  assert.match(html, /2026年10月15日/);
  assert.match(html, /イベント/);
  assert.match(html, /秋のスポーツフェスタ/);
});

test('お知らせ・教室が0件なら案内文を表示する', () => {
  assert.match(tpl.newsListHtml([], NEWS_CATEGORIES), /該当するお知らせはありません/);
  assert.match(tpl.classListHtml([], AGE_GROUPS), /該当する教室はありません/);
});

test('絞り込みボタンは「すべて」を先頭に付け、選択中を aria-pressed で示す', () => {
  const html = tpl.filterButtonsHtml(AGE_GROUPS, 'senior', 'すべて');
  assert.equal((html.match(/<button/g) ?? []).length, AGE_GROUPS.length + 1);
  assert.match(html, /data-filter="all"\s+aria-pressed="false">すべて/);
  assert.match(html, /data-filter="senior"\s+aria-pressed="true"/);
});

test('教室カードの申込リンクは .html まで明記し教室IDを渡す', () => {
  const html = tpl.classCardHtml(CLASSES_DATA[0], AGE_GROUPS);
  assert.match(html, /href="\.\/contact\.html\?type=trial&amp;class=track-kids"/);
  assert.match(html, /陸上教室①/);
});

test('1クラスの教室カードに対象・曜日・時間・定員・会費・会場が表示される', () => {
  const html = tpl.classCardHtml(CLASSES_DATA[1], AGE_GROUPS);
  ['小学3年生〜中学3年生', '火曜日', '18:30〜19:30', '各クラス40名', '7,000円／3ヶ月（全10回）']
    .forEach((text) => assert.ok(html.includes(text), text));
  assert.equal(html.includes('class-card__sessions'), false);
});

test('複数クラスの教室カードはクラスごとの時間・定員を表示する', () => {
  const html = tpl.classCardHtml(CLASSES_DATA[2], AGE_GROUPS);
  assert.equal((html.match(/class="class-session"/g) ?? []).length, 2);
  assert.match(html, /① 年少〜年長[\s\S]*17:00〜18:00[\s\S]*20名[\s\S]*② 小学生[\s\S]*18:15〜19:15[\s\S]*25名/);
});

test('体操教室のカードは会費のみ表示し、個別の年会費は表示しない', () => {
  const html = tpl.classCardHtml(CLASSES_DATA[3], AGE_GROUPS);
  assert.match(html, /<dt>会費<\/dt><dd>3,600円<\/dd>/);
  assert.equal(CLASSES_DATA.some((item) => tpl.classCardHtml(item, AGE_GROUPS).includes('年会費')), false);
});

test('ハイライトのリンクは ./classes.html#ID 形式で、対象と曜日を表示', () => {
  const html = tpl.classHighlightHtml(CLASSES_DATA[4]);
  assert.match(html, /href="\.\/classes\.html#table-tennis"/);
  assert.match(html, /小学生〜大人／水曜日/);
});

test('教室の選択肢は7教室＋未選択で、指定IDが選択済みになる', () => {
  const html = tpl.classOptionsHtml(CLASSES_DATA, 'play');
  assert.equal((html.match(/<option/g) ?? []).length, 8);
  assert.match(html, /value="play" selected/);
});

test('種別ラジオボタンを生成する', () => {
  const html = tpl.inquiryTypeRadiosHtml(INQUIRY_TYPES, 'question');
  assert.match(html, /value="question" checked/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
});

test('送信内容の確認表示を作り、入力値はエスケープされる', () => {
  const values = { inquiryType: 'trial', classId: 'play', name: '<b>架空</b>', email: 'a@example.com', tel: '', message: '' };
  const rows = tpl.completionRows(values, CLASSES_DATA);
  assert.deepEqual(rows[1], ['希望教室', '運動あそび教室']);
  assert.deepEqual(rows[4], ['電話番号', '未入力']);
  assert.match(tpl.completionTableHtml(rows), /&lt;b&gt;架空&lt;\/b&gt;/);
});

test('件数・エラー件数の案内文を作る', () => {
  assert.equal(tpl.resultCountText(7, '教室'), '7教室を表示しています。');
  assert.equal(tpl.errorSummaryText(0), '');
  assert.match(tpl.errorSummaryText(2), /2件の確認事項/);
});

test('希望教室なしは「指定なし」', () => {
  const rows = tpl.completionRows({ inquiryType: 'other', classId: '' }, CLASSES_DATA);
  assert.deepEqual(rows[1], ['希望教室', '指定なし']);
});
