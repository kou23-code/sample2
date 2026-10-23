const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  INQUIRY_TYPES, validateForm, normalizeFormValues, isEmail, isTel, inquiryTypeLabel, parseContactQuery,
  isTrialInquiry, isIsoDate, earliestTrialDate,
} = require('../js/lib/form-validate.js');

const CLASS_IDS = ['track-kids', 'table-tennis'];
const MIN_DATE = '2026-10-25';
const validTrial = {
  inquiryType: 'trial', classId: 'track-kids', preferredDate: '2026-11-10', name: '架空 太郎',
  email: 'taro@example.com', tel: '000-000-0000', message: '', agree: 'on',
};
const errorsOf = (raw) => validateForm(raw, CLASS_IDS, MIN_DATE).errors;

test('正しい体験申込は検証を通過する（内容は任意）', () => {
  const result = validateForm(validTrial, CLASS_IDS, MIN_DATE);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('空のフォームは必須項目すべてがエラー', () => {
  assert.deepEqual(Object.keys(errorsOf({})).sort(), ['agree', 'email', 'inquiryType', 'message', 'name']);
});

test('体験申込では希望教室が必須', () => {
  assert.match(errorsOf({ ...validTrial, classId: '' }).classId, /教室を選択/);
});

test('存在しない教室IDはエラー', () => {
  assert.match(errorsOf({ ...validTrial, classId: 'fake' }).classId, /正しくありません/);
});

test('一般的なお問い合わせでは教室・希望日は任意だが内容が必須', () => {
  const errors = errorsOf({ ...validTrial, inquiryType: 'general', classId: '', preferredDate: '' });
  assert.deepEqual(Object.keys(errors), ['message']);
});

test('不正な種別はエラー', () => {
  assert.ok(errorsOf({ ...validTrial, inquiryType: 'spam' }).inquiryType);
});

test('メールアドレス形式を検証する', () => {
  assert.equal(isEmail('a@example.com'), true);
  assert.equal(isEmail('a@example'), false);
  assert.ok(errorsOf({ ...validTrial, email: 'bad' }).email);
});

test('電話番号は任意で、入力時は10〜11桁', () => {
  assert.equal(isTel('000-000-0000'), true);
  assert.equal(isTel('090-0000-0000'), true);
  assert.equal(isTel('123'), false);
  assert.equal(isTel('abc-defg-hijk'), false);
  assert.equal(errorsOf({ ...validTrial, tel: '' }).tel, undefined);
});

test('文字数上限を超えるとエラー', () => {
  assert.ok(errorsOf({ ...validTrial, name: 'あ'.repeat(51) }).name);
  assert.ok(errorsOf({ ...validTrial, message: 'あ'.repeat(1001) }).message);
});

test('同意チェックがないとエラー', () => {
  assert.ok(errorsOf({ ...validTrial, agree: '' }).agree);
});

test('入力値は前後空白が除去され、元の入力は変更されない', () => {
  const raw = { ...validTrial, name: '  架空 花子  ' };
  assert.equal(normalizeFormValues(raw).name, '架空 花子');
  assert.equal(raw.name, '  架空 花子  ');
  assert.equal(validateForm({ ...validTrial, name: '   ' }, CLASS_IDS).valid, false);
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

test('種別は体験申込と一般的なお問い合わせの2つ', () => {
  assert.deepEqual(INQUIRY_TYPES.map((type) => type.label), ['体験申込', '一般的なお問い合わせ']);
  assert.equal(isTrialInquiry('trial'), true);
  assert.equal(isTrialInquiry('general'), false);
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

test('体験申込では希望日が必須', () => {
  assert.match(errorsOf({ ...validTrial, preferredDate: '' }).preferredDate, /希望日を選択/);
});

test('体験申込の希望日は明後日以降のみ（今日・明日はエラー）', () => {
  assert.match(errorsOf({ ...validTrial, preferredDate: '2026-10-23' }).preferredDate, /明後日以降/);
  assert.match(errorsOf({ ...validTrial, preferredDate: '2026-10-24' }).preferredDate, /お電話/);
  assert.equal(errorsOf({ ...validTrial, preferredDate: MIN_DATE }).preferredDate, undefined);
});

test('存在しない日付や形式違いの希望日はエラー', () => {
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2026/11/10'), false);
  assert.match(errorsOf({ ...validTrial, preferredDate: '2026-13-01' }).preferredDate, /形式/);
});

test('一般的なお問い合わせでは希望日を検証しない', () => {
  const errors = errorsOf({ ...validTrial, inquiryType: 'general', preferredDate: '2026-10-23', message: '質問です' });
  assert.deepEqual(errors, {});
});
