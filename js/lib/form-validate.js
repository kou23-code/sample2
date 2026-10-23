// お問い合わせ・体験申込フォームの検証を行う純粋関数群

const INQUIRY_TYPES = Object.freeze([
  Object.freeze({ id: 'trial', label: '体験申込' }),
  Object.freeze({ id: 'general', label: '一般的なお問い合わせ' }),
]);

const TRIAL_TYPE_ID = 'trial';
const FORM_FIELDS = Object.freeze(['inquiryType', 'classId', 'preferredDate', 'name', 'email', 'tel', 'message', 'agree']);
// 体験の希望日は今日から何日後以降を選べるか（前日・当日の予約は電話のみ受け付ける）
const TRIAL_MIN_DAYS_AHEAD = 2;
const NAME_MAX_LENGTH = 50;
const MESSAGE_MAX_LENGTH = 1000;

const isBlank = (value) => String(value ?? '').trim() === '';
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const countDigits = (value) => value.replace(/\D/g, '').length;
const isTel = (value) => /^[0-9+\-()\s]+$/.test(value) && countDigits(value) >= 10 && countDigits(value) <= 11;
const isTrialInquiry = (typeId) => typeId === TRIAL_TYPE_ID;

// Date を端末の現地時刻の YYYY-MM-DD にする
const pad2 = (number) => String(number).padStart(2, '0');
const toIsoDate = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && toIsoDate(new Date(`${value}T00:00:00`)) === value;

// 体験の希望日として選べる最初の日（今日を渡すと明後日の YYYY-MM-DD を返す。引数は変更しない）
const earliestTrialDate = (today) =>
  toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + TRIAL_MIN_DAYS_AHEAD));

// 入力値を文字列化・前後空白除去した新しいオブジェクトにする
const normalizeFormValues = (raw) =>
  Object.freeze(Object.fromEntries(FORM_FIELDS.map((key) => [key, String(raw?.[key] ?? '').trim()])));

const checkInquiryType = (values) =>
  INQUIRY_TYPES.some((type) => type.id === values.inquiryType) ? '' : 'お問い合わせ種別を選択してください';

const checkClassId = (values, classIds) =>
  isTrialInquiry(values.inquiryType) && isBlank(values.classId) ? '体験を希望する教室を選択してください'
    : !isBlank(values.classId) && !classIds.includes(values.classId) ? '教室の選択が正しくありません' : '';

// 体験申込のときだけ必須。minDate（earliestTrialDate の値）より前の日付は受け付けない
const checkPreferredDate = (values, classIds, minDate) =>
  !isTrialInquiry(values.inquiryType) ? ''
    : isBlank(values.preferredDate) ? '体験の希望日を選択してください'
      : !isIsoDate(values.preferredDate) ? '希望日の形式が正しくありません'
        : values.preferredDate < minDate ? '希望日は明後日以降を選択してください（前日・当日のご予約はお電話でお願いいたします）' : '';

const checkName = (values) =>
  isBlank(values.name) ? 'お名前を入力してください'
    : values.name.length > NAME_MAX_LENGTH ? `お名前は${NAME_MAX_LENGTH}文字以内で入力してください` : '';

const checkEmail = (values) =>
  isBlank(values.email) ? 'メールアドレスを入力してください'
    : !isEmail(values.email) ? 'メールアドレスの形式が正しくありません（例：taro@example.com）' : '';

const checkTel = (values) =>
  isBlank(values.tel) || isTel(values.tel) ? '' : '電話番号は10〜11桁の数字で入力してください（ハイフン可）';

const checkMessage = (values) =>
  !isTrialInquiry(values.inquiryType) && isBlank(values.message) ? 'お問い合わせ内容を入力してください'
    : values.message.length > MESSAGE_MAX_LENGTH ? `内容は${MESSAGE_MAX_LENGTH}文字以内で入力してください` : '';

const checkAgree = (values) => (values.agree === 'on' ? '' : '個人情報の取り扱いへの同意が必要です');

const FIELD_CHECKS = Object.freeze([
  ['inquiryType', checkInquiryType], ['classId', checkClassId], ['preferredDate', checkPreferredDate],
  ['name', checkName], ['email', checkEmail], ['tel', checkTel], ['message', checkMessage], ['agree', checkAgree],
]);

// フォーム全体を検証し、{ valid, values, errors } を返す（minDate は体験の希望日の下限 YYYY-MM-DD）
const validateForm = (raw, classIds, minDate) => {
  const values = normalizeFormValues(raw);
  const results = FIELD_CHECKS.map(([field, check]) => [field, check(values, classIds, minDate)]);
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
    INQUIRY_TYPES, FORM_FIELDS, isBlank, isEmail, isTel, isTrialInquiry, isIsoDate, earliestTrialDate,
    normalizeFormValues, validateForm, inquiryTypeLabel, parseContactQuery,
  };
}
