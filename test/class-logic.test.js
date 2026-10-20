const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AGE_GROUPS, CLASSES_DATA, classSession, classFee } = require('../js/data/classes-data.js');
const {
  filterClassesByAge, findClassById, classDisplayName, ageLabels,
  formatYen, formatFee, formatCapacity, sessionHeading, classTargetSummary,
  hasMultipleSessions, sessionRows, classMainRows, classFeeRows,
} = require('../js/lib/class-logic.js');

const byId = (id) => findClassById(CLASSES_DATA, id);
const ids = (classes) => classes.map((c) => c.id);
const rowValue = (rows, label) => rows.find(([name]) => name === label)?.[1];

// 画面に表示される「対象・曜日・時間・定員・会費」を1行の文字列にまとめる
const displayedInfo = (item) => [
  classTargetSummary(item), item.day,
  item.sessions.map((s) => `${s.label}${s.time}`).join(' '),
  item.sessions.map((s) => `${s.label}${formatCapacity(s)}`).join(' '),
  formatFee(item.fee),
].join(' | ');

test('7教室が指定の順・名称で収録されている', () => {
  assert.deepEqual(CLASSES_DATA.map(classDisplayName), [
    '陸上教室①', '陸上教室②', '運動あそび教室', '体操教室',
    '卓球教室', 'ウエイトリフティング教室', '高齢者向け筋力アップ教室',
  ]);
});

test('各教室の対象・曜日・時間・定員・会費が指定どおり', () => {
  assert.deepEqual(CLASSES_DATA.map(displayedInfo), [
    '小学生 | 土曜日 | 18:00〜19:30 | 40名 | 4,200円／3ヶ月（全6回）',
    '小学3年生〜中学3年生 | 火曜日 | 18:30〜19:30 | 各クラス40名 | 7,000円／3ヶ月（全10回）',
    '年少〜年長・小学生 | 金曜日 | ①17:00〜18:00 ②18:15〜19:15 | ①20名 ②25名 | 4,800円／3ヶ月（全8回）',
    '年少〜年長・小学生 | 水曜日 | ①17:00〜18:00 ②18:15〜19:15 | ①8名 ②15名 | 3,600円',
    '小学生〜大人 | 水曜日 | 19:00〜20:30 | 20名 | 4,200円／3ヶ月（全6回）',
    '小学生〜高校生 | 隔週 | 19:00〜20:30 | 15名 | 5,000円／3ヶ月（全10回）',
    '運動制限をされていない女性等 | 水曜日 | 10:00〜11:00 | 15名 | 4,000円／3ヶ月（全8回）',
  ]);
});

test('年会費は体操教室のみ1,000円', () => {
  assert.deepEqual(CLASSES_DATA.filter((c) => c.annualFee > 0).map((c) => [c.id, c.annualFee]), [['gymnastics', 1000]]);
});

test('教室IDは重複しない', () => {
  assert.equal(new Set(ids(CLASSES_DATA)).size, CLASSES_DATA.length);
});

test('年代での絞り込み', () => {
  assert.deepEqual(ids(filterClassesByAge(CLASSES_DATA, 'preschool')), ['play', 'gymnastics']);
  assert.deepEqual(ids(filterClassesByAge(CLASSES_DATA, 'senior')), ['table-tennis', 'senior-strength']);
  assert.deepEqual(ids(filterClassesByAge(CLASSES_DATA, 'adult')), ['table-tennis']);
  assert.equal(filterClassesByAge(CLASSES_DATA, 'elementary').length, 6);
});

test("'all' や未指定なら全7教室", () => {
  assert.equal(filterClassesByAge(CLASSES_DATA, 'all').length, 7);
  assert.equal(filterClassesByAge(CLASSES_DATA, '').length, 7);
});

test('すべての年代に少なくとも1教室ある', () => {
  assert.equal(AGE_GROUPS.every((g) => filterClassesByAge(CLASSES_DATA, g.id).length > 0), true);
});

test('IDで教室を検索できる', () => {
  assert.equal(byId('table-tennis').name, '卓球教室');
  assert.equal(byId('none'), undefined);
});

test('年代IDを表示名に変換する', () => {
  assert.deepEqual(ageLabels(AGE_GROUPS, ['teen', 'senior', 'x']), ['中高生', 'シニア', 'x']);
});

test('金額・会費・定員の整形', () => {
  assert.equal(formatYen(1000), '1,000円');
  assert.equal(formatYen(500), '500円');
  assert.equal(formatYen(1234567), '1,234,567円');
  assert.equal(formatFee(classFee(4200, '3ヶ月', 6)), '4,200円／3ヶ月（全6回）');
  assert.equal(formatFee(classFee(3600)), '3,600円');
  assert.equal(formatCapacity(classSession('', '小学生', '', 40, '各クラス')), '各クラス40名');
});

test('クラス見出しは区分がなければ対象のみ', () => {
  assert.equal(sessionHeading(classSession('①', '年少〜年長', '', 20)), '① 年少〜年長');
  assert.equal(sessionHeading(classSession('', '小学生', '', 40)), '小学生');
});

test('1クラスの教室はカード上段に時間・定員まで含める', () => {
  const rows = classMainRows(byId('track-kids'));
  assert.deepEqual(rows.map(([label]) => label), ['対象', '曜日', '時間', '定員']);
  assert.equal(hasMultipleSessions(byId('track-kids')), false);
});

test('複数クラスの教室はカード上段に対象・曜日のみ、クラスごとに時間・定員', () => {
  const play = byId('play');
  assert.equal(hasMultipleSessions(play), true);
  assert.deepEqual(classMainRows(play), [['対象', '年少〜年長・小学生'], ['曜日', '金曜日']]);
  assert.deepEqual(play.sessions.map(sessionRows), [
    [['時間', '17:00〜18:00'], ['定員', '20名']],
    [['時間', '18:15〜19:15'], ['定員', '25名']],
  ]);
});

test('カード下段は会費・会場で、年会費は該当教室のみ', () => {
  assert.deepEqual(classFeeRows(byId('gymnastics')).map(([label]) => label), ['会費', '年会費', '会場']);
  assert.equal(rowValue(classFeeRows(byId('gymnastics')), '年会費'), '1,000円');
  assert.deepEqual(classFeeRows(byId('table-tennis')).map(([label]) => label), ['会費', '会場']);
});

test('抽出関数は元データを変更しない', () => {
  const before = JSON.stringify(CLASSES_DATA);
  CLASSES_DATA.forEach((item) => [classMainRows(item), classFeeRows(item), classTargetSummary(item)]);
  assert.equal(JSON.stringify(CLASSES_DATA), before);
  assert.equal(Object.isFrozen(CLASSES_DATA[2].sessions[0]), true);
});
