// お問い合わせ・体験申込フォームの検証を行う純粋関数群

const INQUIRY_TYPES = Object.freeze([
  Object.freeze({ id: 'trial', label: '体験申込' }),
  Object.freeze({ id: 'question', label: '教室・入会についての質問' }),
  Object.freeze({ id: 'other', label: 'その他' }),
]);

const FORM_FIELDS = Object.freeze(['inquiryType', 'classId', 'name', 'email', 'tel', 'message', 'agree']);
const NAME_MAX_LENGTH = 50;
const MESSAGE_MAX_LENGTH = 1000;

const isBlank = (value) => String(value ?? '').trim() === '';
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const countDigits = (value) => value.replace(/\D/g, '').length;
const isTel = (value) => /^[0-9+\-()\s]+$/.test(value) && countDigits(value) >= 10 && countDigits(value) <= 11;

// 入力値を文字列化・前後空白除去した新しいオブジェクトにする
const normalizeFormValues = (raw) =>
  Object.freeze(Object.fromEntries(FORM_FIELDS.map((key) => [key, String(raw?.[key] ?? '').trim()])));

const checkInquiryType = (values) =>
  INQUIRY_TYPES.some((type) => type.id === values.inquiryType) ? '' : 'お問い合わせ種別を選択してください';

const checkClassId = (values, classIds) =>
  values.inquiryType === 'trial' && isBlank(values.classId) ? '体験を希望する教室を選択してください'
    : !isBlank(values.classId) && !classIds.includes(values.classId) ? '教室の選択が正しくありません' : '';

const checkName = (values) =>
  isBlank(values.name) ? 'お名前を入力してください'
    : values.name.length > NAME_MAX_LENGTH ? `お名前は${NAME_MAX_LENGTH}文字以内で入力してください` : '';

const checkEmail = (values) =>
  isBlank(values.email) ? 'メールアドレスを入力してください'
    : !isEmail(values.email) ? 'メールアドレスの形式が正しくありません（例：taro@example.com）' : '';

const checkTel = (values) =>
  isBlank(values.tel) || isTel(values.tel) ? '' : '電話番号は10〜11桁の数字で入力してください（ハイフン可）';

const checkMessage = (values) =>
  values.inquiryType !== 'trial' && isBlank(values.message) ? 'お問い合わせ内容を入力してください'
    : values.message.length > MESSAGE_MAX_LENGTH ? `内容は${MESSAGE_MAX_LENGTH}文字以内で入力してください` : '';

const checkAgree = (values) => (values.agree === 'on' ? '' : '個人情報の取り扱いへの同意が必要です');

const FIELD_CHECKS = Object.freeze([
  ['inquiryType', checkInquiryType], ['classId', checkClassId], ['name', checkName],
  ['email', checkEmail], ['tel', checkTel], ['message', checkMessage], ['agree', checkAgree],
]);

// フォーム全体を検証し、{ valid, values, errors } を返す
const validateForm = (raw, classIds) => {
  const values = normalizeFormValues(raw);
  const results = FIELD_CHECKS.map(([field, check]) => [field, check(values, classIds)]);
  const errors = Object.freeze(Object.fromEntries(results.filter(([, message]) => message !== '')));
  return Object.freeze({ valid: Object.keys(errors).length === 0, values, errors });
};

// 種別IDから表示名を引く
const inquiryTypeLabel = (typeId) => INQUIRY_TYPES.find((type) => type.id === typeId)?.label ?? '';

// URLのクエリ（?type=trial&class=play）から初期選択値を取り出す。不正な値は空にする
const parseContactQuery = (search, classIds) => {
  const params = new URLSearchParams(search);
  const classId = classIds.includes(params.get('class')) ? params.get('class') : '';
  const typeId = INQUIRY_TYPES.some((type) => type.id === params.get('type')) ? params.get('type') : '';
  return Object.freeze({ type: typeId || (classId ? 'trial' : ''), classId });
};

if (typeof module === 'object' && module.exports) {
  module.exports = {
    INQUIRY_TYPES, FORM_FIELDS, isBlank, isEmail, isTel,
    normalizeFormValues, validateForm, inquiryTypeLabel, parseContactQuery,
  };
}
