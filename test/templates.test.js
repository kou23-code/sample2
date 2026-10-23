const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NEWS_CATEGORIES, NEWS_DATA } = require('../js/data/news-data.js');
const { AGE_GROUPS, CLASSES_DATA, FEE_SYSTEM, SPORTS_INSURANCE } = require('../js/data/classes-data.js');
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

test('会費システムは4期の一覧と3項目の説明を表示する', () => {
  const html = tpl.feeSystemHtml(FEE_SYSTEM);
  assert.equal((html.match(/<li>/g) ?? []).length, 4);
  assert.match(html, /第1期<\/span><span class="fee-terms__months">4〜6月/);
  assert.match(html, /<dt>年会費<\/dt><dd>1,000円（年度内1回のみ。複数教室を受講する場合も1回のみで可）<\/dd>/);
  assert.match(html, /各教室の会費は期ごとの支払いとなります。/);
});

test('スポーツ安全保険は details/summary の開閉式で、閉じた状態は料金の幅のみ', () => {
  const html = tpl.insuranceHtml(SPORTS_INSURANCE);
  assert.match(html, /^\s*<details class="insurance">/);
  assert.equal(/<details[^>]*\sopen/.test(html), false);
  assert.match(html, /<summary>[\s\S]*800円〜2,000円[\s\S]*<\/summary>/);
});

test('スポーツ安全保険の料金表に3区分が並ぶ', () => {
  const html = tpl.insuranceHtml(SPORTS_INSURANCE);
  assert.equal((html.match(/<tr><th scope="row">/g) ?? []).length, 3);
  assert.match(html, /高校生以上<\/th><td>2,000円[\s\S]*中学生以下<\/th><td>800円[\s\S]*65歳以上<\/th><td>1,200円/);
  assert.match(html, /ご加入は任意です/);
});

test('「会費について」ブロックは会費システム・3行の表・注記をこの順で含む', () => {
  const html = tpl.feeInfoHtml(CLASSES_DATA, FEE_SYSTEM, SPORTS_INSURANCE);
  assert.match(html, /class="fee-system"[\s\S]*全教室共通[\s\S]*class="info-table"[\s\S]*class="note"/);
  const positions = ['教室の会費', 'スポーツ安全保険（任意）', '体験参加'].map((head) => html.indexOf(`<th scope="row">${head}</th>`));
  assert.equal(positions.every((pos) => pos > 0), true);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('「会費について」ブロックの各行の内容', () => {
  const html = tpl.feeInfoHtml(CLASSES_DATA, FEE_SYSTEM, SPORTS_INSURANCE);
  assert.match(html, /1期あたり 3,600円〜7,000円/);
  assert.match(html, /href="\.\/classes\.html#class-list-heading"/);
  assert.match(html, /<details class="insurance">[\s\S]*800円〜2,000円/);
  assert.match(html, /<td>各教室1回まで無料<\/td>/);
  assert.match(html, /※金額はすべて目安です。/);
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
  const html = tpl.inquiryTypeRadiosHtml(INQUIRY_TYPES, 'general');
  assert.match(html, /value="general" checked/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
});

test('送信内容の確認表示を作り、入力値はエスケープされる', () => {
  const values = { inquiryType: 'trial', classId: 'play', preferredDate: '2026-11-03', name: '<b>架空</b>', email: 'a@example.com', tel: '', message: '' };
  const rows = tpl.completionRows(values, CLASSES_DATA);
  assert.deepEqual(rows[1], ['希望教室', '運動あそび教室']);
  assert.deepEqual(rows[2], ['希望日', '2026年11月3日']);
  assert.deepEqual(rows[5], ['電話番号', '未入力']);
  assert.match(tpl.completionTableHtml(rows), /&lt;b&gt;架空&lt;\/b&gt;/);
});

test('件数・エラー件数の案内文を作る', () => {
  assert.equal(tpl.resultCountText(7, '教室'), '7教室を表示しています。');
  assert.equal(tpl.errorSummaryText(0), '');
  assert.match(tpl.errorSummaryText(2), /2件の確認事項/);
});

test('希望教室なしは「指定なし」', () => {
  const rows = tpl.completionRows({ inquiryType: 'general', classId: '', preferredDate: '' }, CLASSES_DATA);
  assert.deepEqual(rows[1], ['希望教室', '指定なし']);
  assert.ok(rows.every(([label]) => label !== '希望日'), '一般的なお問い合わせでは希望日を表示しない');
});

// ---- お知らせの添付ファイル ----

const newsWith = (attachmentUrl) => ({ date: '2026-10-15', category: 'event', title: '体験会<案内>', body: '', attachmentUrl });

test('本文も添付も無いお知らせは、開かない1行だけにし、添付ありのアイコンも付けない', () => {
  const html = tpl.newsListHtml([newsWith('')], NEWS_CATEGORIES);
  assert.match(html, /<div class="news-row news-row--static">/);
  assert.doesNotMatch(html, /<details|news-row__clip|news-file-button/);
});

test('本文があるお知らせは、行を押すと本文が開く（改行を保つため段落1つに入れる）', () => {
  const html = tpl.newsListHtml([{ ...newsWith(''), body: '1行目\n<2行目>' }], NEWS_CATEGORIES);
  assert.match(html, /<details class="news-entry">\s*<summary class="news-row">/);
  assert.match(html, /<p class="news-detail__body">1行目\n&lt;2行目&gt;<\/p>/);
});

test('ドライブの添付は大きな画像（幅1600pxのサムネイル）と、元の共有リンクを新しいタブで開くボタンを表示する', () => {
  const html = tpl.newsListHtml([newsWith('https://drive.google.com/file/d/abc123/view?usp=sharing')], NEWS_CATEGORIES);
  assert.match(html, /<img class="news-figure__image" src="https:\/\/drive\.google\.com\/thumbnail\?id=abc123&amp;sz=w1600"/);
  assert.match(html, /href="https:\/\/drive\.google\.com\/file\/d\/abc123\/view\?usp=sharing" target="_blank" rel="noopener noreferrer">/);
  assert.match(html, /ファイルを開く<span class="visually-hidden">（体験会&lt;案内&gt;・新しいタブで開きます）/);
  assert.match(html, /class="news-row__clip" role="img" aria-label="添付ファイルあり"/);
});

test('画像以外の添付は大きな「ファイルを開く」ボタンだけを表示し、画像は付けない', () => {
  const html = tpl.newsListHtml([newsWith('https://example.com/guide.pdf')], NEWS_CATEGORIES);
  assert.match(html, /class="button button--primary news-file-button"[^>]*>\s*<span aria-hidden="true">📄<\/span>ファイルを開く/);
  assert.doesNotMatch(html, /<img|news-figure/);
});

test('https 以外の添付URLはリンクにしない', () => {
  ['javascript:alert(1)', 'http://example.com/a.png'].forEach((url) =>
    assert.doesNotMatch(tpl.newsListHtml([newsWith(url)], NEWS_CATEGORIES), /news-file-button|news-row__clip|javascript:/, url));
});

test('固定順位があるお知らせには「固定」バッジを付ける', () => {
  assert.match(tpl.newsListHtml([{ ...newsWith(''), order: 1 }], NEWS_CATEGORIES), /<span class="badge badge--pinned">固定<\/span>/);
  assert.doesNotMatch(tpl.newsListHtml([{ ...newsWith(''), order: null }], NEWS_CATEGORIES), /badge--pinned/);
});

test('一覧の各お知らせにはアンカー用の id を付け、トップの最新お知らせはそこへのリンクにする', () => {
  const item = { ...newsWith(''), id: '12' };
  assert.match(tpl.newsListHtml([item], NEWS_CATEGORIES), /<li class="news-item" id="news-12">/);
  const html = tpl.newsLinkListHtml([item], NEWS_CATEGORIES);
  assert.match(html, /<a class="news-row" href="\.\/news\.html#news-12">/);
  assert.match(html, /2026年10月15日[\s\S]*体験会&lt;案内&gt;/);
  assert.doesNotMatch(html, /<details|news-detail/);
  assert.match(tpl.newsLinkListHtml([], NEWS_CATEGORIES), /該当するお知らせはありません/);
});
