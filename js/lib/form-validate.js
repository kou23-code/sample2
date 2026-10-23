// お問い合わせ・体験申込フォームの検証を行う純粋関数群

const INQUIRY_TYPES = Object.freeze([
  Object.freeze({ id: 'trial', label: '体験申込' }),
  Object.freeze({ id: 'general', label: '一般的なお問い合わせ' }),
]);

const TRIAL_TYPE_ID = 'trial';

// 参加者の学年の選択肢（学校に通っていない方は「その他」）
const GRADES = Object.freeze([
  ['preschool', '未就学'], ...[1, 2, 3, 4, 5, 6].map((year) => [`es${year}`, `小学${year}年`]),
  ...[1, 2, 3].map((year) => [`jh${year}`, `中学${year}年`]), ...[1, 2, 3].map((year) => [`hs${year}`, `高校${year}年`]),
  ['other', 'その他（大学生・社会人など）'],
].map(([id, label]) => Object.freeze({ id, label })));

// 画面に並ぶ順の項目名（エラー時は先頭のエラー項目へフォーカスする）
const FORM_FIELDS = Object.freeze([
  'inquiryType', 'classId', 'preferredDate', 'guardianName', 'participantName', 'schoolName', 'grade', 'age',
  'name', 'email', 'tel', 'message', 'agree',
]);

// 種別専用の項目と、その項目を使う種別ID（ここに無い項目は両方の種別で使う）
const TYPE_ONLY_FIELDS = Object.freeze({
  classId: 'trial', preferredDate: 'trial', guardianName: 'trial', participantName: 'trial',
  schoolName: 'trial', grade: 'trial', age: 'trial', name: 'general',
});

const NAME_MAX_LENGTH = 50;
const MESSAGE_MAX_LENGTH = 1000;
const AGE_MAX = 120;
// 体験の希望日は今日から何日後以降を選べるか（前日・当日の予約は電話のみ受け付ける）
const TRIAL_MIN_DAYS_AHEAD = 2;

const isBlank = (value) => String(value ?? '').trim() === '';
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const countDigits = (value) => value.replace(/\D/g, '').length;
const isTel = (value) => /^[0-9+\-()\s]+$/.test(value) && countDigits(value) >= 10 && countDigits(value) <= 11;
const isAge = (value) => /^\d{1,3}$/.test(value) && Number(value) <= AGE_MAX;
const isTrialInquiry = (typeId) => typeId === TRIAL_TYPE_ID;

// 種別で入力を求める項目名（画面の並び順）。種別が未選択・不正なら共通の項目だけ
const fieldsForType = (typeId) =>
  FORM_FIELDS.filter((field) => (TYPE_ONLY_FIELDS[field] ?? typeId) === typeId);

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
  isBlank(values.classId) ? '体験を希望する教室を選択してください'
    : !classIds.includes(values.classId) ? '教室の選択が正しくありません' : '';

// minDate（earliestTrialDate の値）より前の日付は受け付けない
const checkPreferredDate = (values, classIds, minDate) =>
  isBlank(values.preferredDate) ? '体験の希望日を選択してください'
    : !isIsoDate(values.preferredDate) ? '希望日の形式が正しくありません'
      : values.preferredDate < minDate ? '希望日は明後日以降を選択してください（前日・当日のご予約はお電話でお願いいたします）' : '';

// 必須・文字数上限のある文字入力の検証関数を作る
const requiredText = (field, label) => (values) =>
  isBlank(values[field]) ? `${label}を入力してください`
    : values[field].length > NAME_MAX_LENGTH ? `${label}は${NAME_MAX_LENGTH}文字以内で入力してください` : '';

const checkGrade = (values) =>
  isBlank(values.grade) ? '学年を選択してください'
    : !GRADES.some((grade) => grade.id === values.grade) ? '学年の選択が正しくありません' : '';

const checkAge = (values) =>
  isBlank(values.age) ? '年齢を入力してください'
    : !isAge(values.age) ? `年齢は0〜${AGE_MAX}の数字で入力してください` : '';

const checkEmail = (values) =>
  isBlank(values.email) ? 'メールアドレスを入力してください'
    : !isEmail(values.email) ? 'メールアドレスの形式が正しくありません（例：taro@example.com）' : '';

const checkTel = (values) =>
  isBlank(values.tel) ? '電話番号を入力してください'
    : !isTel(values.tel) ? '電話番号は10〜11桁の数字で入力してください（ハイフン可）' : '';

const checkMessage = (values) =>
  isBlank(values.message) ? 'お問い合わせ内容を入力してください'
    : values.message.length > MESSAGE_MAX_LENGTH ? `内容は${MESSAGE_MAX_LENGTH}文字以内で入力してください` : '';

const checkAgree = (values) => (values.agree === 'on' ? '' : '個人情報の取り扱いへの同意が必要です');

const FIELD_CHECKS = Object.freeze({
  inquiryType: checkInquiryType, classId: checkClassId, preferredDate: checkPreferredDate,
  guardianName: requiredText('guardianName', '保護者名'), participantName: requiredText('participantName', '参加者のお名前'),
  schoolName: requiredText('schoolName', '学校名'), grade: checkGrade, age: checkAge,
  name: requiredText('name', 'お名前'), email: checkEmail, tel: checkTel, message: checkMessage, agree: checkAgree,
});

// 選ばれた種別の項目だけを検証し、{ valid, values, errors } を返す（minDate は体験の希望日の下限 YYYY-MM-DD）
const validateForm = (raw, classIds, minDate) => {
  const values = normalizeFormValues(raw);
  const results = fieldsForType(values.inquiryType).map((field) => [field, FIELD_CHECKS[field](values, classIds, minDate)]);
  const errors = Object.freeze(Object.fromEntries(results.filter(([, message]) => message !== '')));
  return Object.freeze({ valid: Object.keys(errors).length === 0, values, errors });
};

// 種別・学年のIDから表示名を引く
const inquiryTypeLabel = (typeId) => INQUIRY_TYPES.find((type) => type.id === typeId)?.label ?? '';
const gradeLabel = (gradeId) => GRADES.find((grade) => grade.id === gradeId)?.label ?? '';

// URLのクエリ（?type=trial&class=play）から初期選択値を取り出す。不正な値は空にする
const parseContactQuery = (search, classIds) => {
  const params = new URLSearchParams(search);
  const classId = classIds.includes(params.get('class')) ? params.get('class') : '';
  const typeId = INQUIRY_TYPES.some((type) => type.id === params.get('type')) ? params.get('type') : '';
  return Object.freeze({ type: typeId || (classId ? 'trial' : ''), classId });
};

if (typeof module === 'object' && module.exports) {
  module.exports = {
    INQUIRY_TYPES, GRADES, FORM_FIELDS, TYPE_ONLY_FIELDS, isBlank, isEmail, isTel, isAge, isTrialInquiry, isIsoDate,
    fieldsForType, earliestTrialDate, normalizeFormValues, validateForm, inquiryTypeLabel, gradeLabel, parseContactQuery,
  };
}
