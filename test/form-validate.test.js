const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  INQUIRY_TYPES, GRADES, validateForm, normalizeFormValues, isEmail, isTel, isAge, inquiryTypeLabel, gradeLabel,
  parseContactQuery, isTrialInquiry, isIsoDate, earliestTrialDate, fieldsForType,
} = require('../js/lib/form-validate.js');

const CLASS_IDS = ['track-kids', 'table-tennis'];
const MIN_DATE = '2026-10-25';
const validTrial = {
  inquiryType: 'trial', classId: 'track-kids', preferredDate: '2026-11-10',
  guardianName: '架空 花子', participantName: '架空 太郎', schoolName: '架空小学校', grade: 'es3', age: '8',
  email: 'taro@example.com', tel: '000-000-0000', message: 'よろしくお願いします', agree: 'on',
};
const validGeneral = {
  inquiryType: 'general', name: '架空 一郎', email: 'ichiro@example.com', tel: '000-000-0000', message: '駐車場はありますか', agree: 'on',
};
const errorsOf = (raw) => validateForm(raw, CLASS_IDS, MIN_DATE).errors;

test('正しい体験申込は検証を通過する', () => {
  const result = validateForm(validTrial, CLASS_IDS, MIN_DATE);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('正しい一般的なお問い合わせは検証を通過する', () => {
  assert.deepEqual(errorsOf(validGeneral), {});
});

test('種別は体験申込と一般的なお問い合わせの2つ', () => {
  assert.deepEqual(INQUIRY_TYPES.map((type) => type.label), ['体験申込', '一般的なお問い合わせ']);
  assert.equal(isTrialInquiry('trial'), true);
  assert.equal(isTrialInquiry('general'), false);
});

test('種別ごとの入力項目（画面の並び順）', () => {
  assert.deepEqual(fieldsForType('trial'), [
    'inquiryType', 'classId', 'preferredDate', 'guardianName', 'participantName', 'schoolName', 'grade', 'age',
    'email', 'tel', 'message', 'agree',
  ]);
  assert.deepEqual(fieldsForType('general'), ['inquiryType', 'name', 'email', 'tel', 'message', 'agree']);
  assert.deepEqual(fieldsForType(''), ['inquiryType', 'email', 'tel', 'message', 'agree']);
});

test('体験申込の空のフォームは、体験の項目と連絡先・内容・同意がすべてエラー（お名前は対象外）', () => {
  assert.deepEqual(Object.keys(errorsOf({ inquiryType: 'trial' })), [
    'classId', 'preferredDate', 'guardianName', 'participantName', 'schoolName', 'grade', 'age',
    'email', 'tel', 'message', 'agree',
  ]);
});

test('一般的なお問い合わせの空のフォームは、お名前・連絡先・内容・同意だけがエラー', () => {
  assert.deepEqual(Object.keys(errorsOf({ inquiryType: 'general' })), ['name', 'email', 'tel', 'message', 'agree']);
});

test('種別が未選択なら種別と共通項目だけがエラー', () => {
  assert.deepEqual(Object.keys(errorsOf({})), ['inquiryType', 'email', 'tel', 'message', 'agree']);
});

test('一般的なお問い合わせでは体験専用の項目を検証しない', () => {
  const errors = errorsOf({ ...validGeneral, preferredDate: '2026-10-23', grade: 'x', age: 'abc', classId: 'fake' });
  assert.deepEqual(errors, {});
});

test('体験申込では一般用のお名前を検証しない', () => {
  assert.deepEqual(errorsOf({ ...validTrial, name: '' }), {});
});

test('不正な種別はエラー', () => {
  assert.ok(errorsOf({ ...validTrial, inquiryType: 'spam' }).inquiryType);
});

test('体験申込の希望教室：未選択・存在しない教室IDはエラー', () => {
  assert.match(errorsOf({ ...validTrial, classId: '' }).classId, /教室を選択/);
  assert.match(errorsOf({ ...validTrial, classId: 'fake' }).classId, /正しくありません/);
});

test('体験の希望日の下限は明後日（月末・年末もまたげる）', () => {
  assert.equal(earliestTrialDate(new Date(2026, 9, 23)), '2026-10-25');
  assert.equal(earliestTrialDate(new Date(2026, 9, 30, 23, 59)), '2026-11-01');
  assert.equal(earliestTrialDate(new Date(2026, 11, 31)), '2027-01-02');
});

test('earliestTrialDate は渡した日付を変更しない', () => {
  const today = new Date(2026, 9, 23);
  earliestTrialDate(today);
  assert.equal(today.getDate(), 23);
});

test('体験申込の希望日：必須で、明後日以降のみ（今日・明日はエラー）', () => {
  assert.match(errorsOf({ ...validTrial, preferredDate: '' }).preferredDate, /希望日を選択/);
  assert.match(errorsOf({ ...validTrial, preferredDate: '2026-10-23' }).preferredDate, /明後日以降/);
  assert.match(errorsOf({ ...validTrial, preferredDate: '2026-10-24' }).preferredDate, /お電話/);
  assert.equal(errorsOf({ ...validTrial, preferredDate: MIN_DATE }).preferredDate, undefined);
});

test('存在しない日付や形式違いの希望日はエラー', () => {
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2026/11/10'), false);
  assert.match(errorsOf({ ...validTrial, preferredDate: '2026-13-01' }).preferredDate, /形式/);
});

test('体験申込の保護者名・参加者名・学校名は必須で50文字以内', () => {
  assert.match(errorsOf({ ...validTrial, guardianName: ' ' }).guardianName, /保護者名を入力/);
  assert.match(errorsOf({ ...validTrial, participantName: '' }).participantName, /参加者のお名前を入力/);
  assert.match(errorsOf({ ...validTrial, schoolName: '' }).schoolName, /学校名を入力/);
  assert.match(errorsOf({ ...validTrial, schoolName: 'あ'.repeat(51) }).schoolName, /50文字以内/);
});

test('学年は選択肢のいずれか', () => {
  assert.equal(GRADES.length, 14);
  assert.match(errorsOf({ ...validTrial, grade: '' }).grade, /学年を選択/);
  assert.match(errorsOf({ ...validTrial, grade: 'es9' }).grade, /正しくありません/);
  assert.equal(gradeLabel('jh2'), '中学2年');
  assert.equal(gradeLabel('x'), '');
});

test('年齢は0〜120の整数', () => {
  assert.equal(isAge('0'), true);
  assert.equal(isAge('120'), true);
  assert.equal(isAge('121'), false);
  assert.equal(isAge('8.5'), false);
  assert.match(errorsOf({ ...validTrial, age: '' }).age, /年齢を入力/);
  assert.match(errorsOf({ ...validTrial, age: '-1' }).age, /0〜120/);
});

test('メールアドレス形式を検証する', () => {
  assert.equal(isEmail('a@example.com'), true);
  assert.equal(isEmail('a@example'), false);
  assert.ok(errorsOf({ ...validTrial, email: 'bad' }).email);
});

test('電話番号は両方の種別で必須で、10〜11桁', () => {
  assert.equal(isTel('000-000-0000'), true);
  assert.equal(isTel('090-0000-0000'), true);
  assert.equal(isTel('123'), false);
  assert.equal(isTel('abc-defg-hijk'), false);
  assert.match(errorsOf({ ...validTrial, tel: '' }).tel, /電話番号を入力/);
  assert.match(errorsOf({ ...validGeneral, tel: '' }).tel, /電話番号を入力/);
});

test('お問い合わせ内容は両方の種別で必須', () => {
  assert.ok(errorsOf({ ...validTrial, message: '' }).message);
  assert.ok(errorsOf({ ...validGeneral, message: '' }).message);
});

test('文字数上限を超えるとエラー', () => {
  assert.ok(errorsOf({ ...validGeneral, name: 'あ'.repeat(51) }).name);
  assert.ok(errorsOf({ ...validTrial, message: 'あ'.repeat(1001) }).message);
});

test('同意チェックがないとエラー', () => {
  assert.ok(errorsOf({ ...validTrial, agree: '' }).agree);
});

test('入力値は前後空白が除去され、元の入力は変更されない', () => {
  const raw = { ...validGeneral, name: '  架空 花子  ' };
  assert.equal(normalizeFormValues(raw).name, '架空 花子');
  assert.equal(raw.name, '  架空 花子  ');
  assert.equal(validateForm({ ...validGeneral, name: '   ' }, CLASS_IDS, MIN_DATE).valid, false);
});

test('URLクエリから初期選択値を取り出す', () => {
  assert.deepEqual(parseContactQuery('?type=trial&class=track-kids', CLASS_IDS), { type: 'trial', classId: 'track-kids' });
  assert.deepEqual(parseContactQuery('?class=table-tennis', CLASS_IDS), { type: 'trial', classId: 'table-tennis' });
  assert.deepEqual(parseContactQuery('?type=general', CLASS_IDS), { type: 'general', classId: '' });
});

test('URLクエリの不正な値は無視する', () => {
  assert.deepEqual(parseContactQuery('?type=<x>&class=fake', CLASS_IDS), { type: '', classId: '' });
  assert.deepEqual(parseContactQuery('', CLASS_IDS), { type: '', classId: '' });
});

test('種別の表示名を引ける', () => {
  assert.equal(inquiryTypeLabel('trial'), '体験申込');
  assert.equal(inquiryTypeLabel('x'), '');
});
