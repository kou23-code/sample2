const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateForm, normalizeFormValues, isEmail, isTel, inquiryTypeLabel,
} = require('../js/lib/form-validate.js');

const CLASS_IDS = ['track-kids', 'table-tennis'];
const validTrial = {
  inquiryType: 'trial', classId: 'track-kids', name: '架空 太郎',
  email: 'taro@example.com', tel: '000-000-0000', message: '', agree: 'on',
};
const errorsOf = (raw) => validateForm(raw, CLASS_IDS).errors;

test('正しい体験申込は検証を通過する（内容は任意）', () => {
  const result = validateForm(validTrial, CLASS_IDS);
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

test('質問では教室は任意だが内容が必須', () => {
  const errors = errorsOf({ ...validTrial, inquiryType: 'question', classId: '' });
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

test('種別の表示名を引ける', () => {
  assert.equal(inquiryTypeLabel('trial'), '体験申込');
  assert.equal(inquiryTypeLabel('x'), '');
});
