// 【GAS用】問い合わせフォームの送信内容をチェックし、シートの行・通知メールを組み立てる純粋関数群
// GASエディタに「contact-form」という名前のスクリプトファイルを作り、このファイルの内容を貼り付ける。
// 検証ルールはサイトと同じ js/lib/form-validate.js（GASでは「contact-validate」）の validateForm を使う。
// news-admin.js の escapeSheetFormula、news-sheet.js の sheetText も使う。GAS のファイルの読み込み順に左右されないよう、関数の中でだけ参照する。

// シート・メールに出す項目名（左から順にシートの B 列以降に並ぶ。同意チェックは出さない）
const CONTACT_FIELD_LABELS = Object.freeze({
  inquiryType: '種別', classId: '希望教室', preferredDate: '希望日', guardianName: '保護者名',
  participantName: '参加者のお名前', schoolName: '学校名', grade: '学年', age: '年齢',
  name: 'お名前', email: 'メールアドレス', tel: '電話番号', message: 'お問い合わせ内容',
});
const CONTACT_SHEET_HEADERS = Object.freeze(['受付日時', ...Object.values(CONTACT_FIELD_LABELS), '対応状況']);
const CONTACT_INITIAL_STATUS = '未対応';
const CONTACT_CLASS_LABEL_MAX = 100;

// 教室の一覧はサイト側にしかないため、GAS では教室IDの形（英小文字・数字・ハイフン）だけを確かめる
const isClassIdFormat = (text) => /^[a-z0-9-]{1,40}$/.test(text);

// 送信内容の誤り（サイトと同じルール。希望日は端末と GAS の時差・日付またぎを考えて1日の猶予を持たせる）
const contactInputErrors = (data, now) => {
  const classId = sheetText(data?.classId);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return Object.values(validateForm(data ?? {}, isClassIdFormat(classId) ? [classId] : [], earliestTrialDate(yesterday)).errors);
};

// サイトから届いた希望教室の表示名（無ければ教室ID。長すぎる場合は切り詰める）
const contactClassLabel = (data) =>
  (sheetText(data?.classLabel) || sheetText(data?.classId)).slice(0, CONTACT_CLASS_LABEL_MAX);

// 項目ごとの表示（種別・学年は日本語名、年齢は「8歳」、希望教室は表示名）
const contactDisplayText = (field, values, classLabel) => ({
  inquiryType: () => inquiryTypeLabel(values.inquiryType),
  classId: () => classLabel,
  grade: () => gradeLabel(values.grade),
  age: () => `${values.age}歳`,
})[field]?.() ?? values[field];

// 選ばれた種別の項目だけの [項目名, 表示] の配列（メール本文用）
const contactDisplayRows = (values, classLabel) =>
  fieldsForType(values.inquiryType).filter((field) => CONTACT_FIELD_LABELS[field])
    .map((field) => [CONTACT_FIELD_LABELS[field], contactDisplayText(field, values, classLabel)]);

// シートの1行（受付日時／各項目（その種別で使わない項目は空欄）／対応状況）。数式として実行されないよう先頭を守る
const contactToRow = (values, classLabel, receivedAt) => {
  const used = fieldsForType(values.inquiryType);
  return Object.freeze([receivedAt, ...Object.keys(CONTACT_FIELD_LABELS).map((field) =>
    (used.includes(field) ? escapeSheetFormula(String(contactDisplayText(field, values, classLabel))) : '')), CONTACT_INITIAL_STATUS]);
};

// 申込者の名前（体験申込は保護者名、一般的なお問い合わせはお名前）
const contactPersonName = (values) => (isTrialInquiry(values.inquiryType) ? values.guardianName : values.name);

const contactMailSubject = (values) =>
  `【ホームページ】${inquiryTypeLabel(values.inquiryType)}：${contactPersonName(values)} 様`;

// 通知メールの本文（全項目と、返信先・保存先の案内）
const contactMailBody = (values, classLabel, receivedAt) => [
  `ホームページのフォームから${inquiryTypeLabel(values.inquiryType)}が届きました。`, '',
  ...contactDisplayRows(values, classLabel).map(([label, text]) => `■${label}\n${text}`), '',
  `受付日時：${receivedAt}`,
  `※このメールに返信すると、送信者（${values.email}）宛てになります。`,
  '※内容はスプレッドシートの「お問い合わせ」シートにも保存されています。',
].join('\n');
