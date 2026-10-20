const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AGE_GROUPS, CLASSES_DATA } = require('../js/data/classes-data.js');
const { filterClassesByAge, findClassById, classDisplayName, ageLabels } = require('../js/lib/class-logic.js');

const names = (classes) => classes.map(classDisplayName);

test('7教室が収録されている', () => {
  assert.deepEqual(names(CLASSES_DATA), [
    '陸上教室（小学生・基礎コース）',
    '陸上教室（中高生・記録挑戦コース）',
    'うんどう遊び教室',
    '体操教室',
    '卓球教室',
    'ウエイトリフティング教室',
    '高齢者向け筋力アップ教室',
  ]);
});

test('教室IDは重複しない', () => {
  assert.equal(new Set(CLASSES_DATA.map((c) => c.id)).size, CLASSES_DATA.length);
});

test('シニアで絞り込むと卓球と筋力アップ教室', () => {
  assert.deepEqual(filterClassesByAge(CLASSES_DATA, 'senior').map((c) => c.id), ['table-tennis', 'senior-strength']);
});

test('幼児で絞り込むとうんどう遊びと体操', () => {
  assert.deepEqual(filterClassesByAge(CLASSES_DATA, 'preschool').map((c) => c.id), ['play', 'gymnastics']);
});

test("'all' や未指定なら全7教室", () => {
  assert.equal(filterClassesByAge(CLASSES_DATA, 'all').length, 7);
  assert.equal(filterClassesByAge(CLASSES_DATA, '').length, 7);
});

test('すべての年代に少なくとも1教室ある', () => {
  assert.equal(AGE_GROUPS.every((g) => filterClassesByAge(CLASSES_DATA, g.id).length > 0), true);
});

test('IDで教室を検索できる', () => {
  assert.equal(findClassById(CLASSES_DATA, 'table-tennis').name, '卓球教室');
  assert.equal(findClassById(CLASSES_DATA, 'none'), undefined);
});

test('年代IDを表示名に変換する', () => {
  assert.deepEqual(ageLabels(AGE_GROUPS, ['teen', 'senior', 'x']), ['中高生', 'シニア', 'x']);
});
