// 【GAS用】問い合わせフォームから届いた内容をシートに追記し、担当者へ通知メールを送る
// GASエディタに「contact-api」という名前のスクリプトファイルを作り、このファイルの内容を貼り付ける。
// 入口は news-api.js の doPost（action が 'contact' のリクエストをここへ振り分ける）。
// シート・メール・キャッシュの操作（副作用）はこのファイルに集約し、組み立ては contact-form.js の純粋関数に任せる。
// 通知先のメールアドレスはコードに書かず、スクリプト プロパティ CONTACT_NOTIFY_EMAIL に登録する（未登録なら仮置きのダミー宛て）。

const CONTACT_SHEET_NAME = 'お問い合わせ';
const CONTACT_NOTIFY_EMAIL_KEY = 'CONTACT_NOTIFY_EMAIL';
const CONTACT_NOTIFY_DUMMY_EMAIL = 'admin@example.com';
const CONTACT_MAIL_SENDER_NAME = 'ホームページ お問い合わせフォーム';
// いたずらの大量送信でメールの1日の上限を使い切らないよう、10分間の受付件数を制限する
const CONTACT_RATE_KEY = 'contact-post-count';
const CONTACT_RATE_MAX = 20;
const CONTACT_RATE_SECONDS = 600;

const contactNotifyEmail = () =>
  sheetText(PropertiesService.getScriptProperties().getProperty(CONTACT_NOTIFY_EMAIL_KEY)) || CONTACT_NOTIFY_DUMMY_EMAIL;

const contactReceivedAt = (now) => Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

const contactPostCount = () => Number(CacheService.getScriptCache().get(CONTACT_RATE_KEY) ?? 0);

const recordContactPost = () =>
  CacheService.getScriptCache().put(CONTACT_RATE_KEY, String(contactPostCount() + 1), CONTACT_RATE_SECONDS);

// シート「お問い合わせ」（無ければ見出し付きで作る。電話番号の先頭の0などが消えないよう全体を書式なしテキストにする）
const contactSheet = () => {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const existing = book.getSheetByName(CONTACT_SHEET_NAME);
  if (existing) return existing;
  const sheet = book.insertSheet(CONTACT_SHEET_NAME);
  sheet.getRange(1, 1, 1, CONTACT_SHEET_HEADERS.length).setValues([[...CONTACT_SHEET_HEADERS]]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.getRange('A:Z').setNumberFormat('@');
  return sheet;
};

// 担当者へ全項目を記載した通知メールを送る（返信すると送信者に届くよう replyTo を付ける）
const sendContactMail = (values, classLabel, receivedAt) => MailApp.sendEmail({
  to: contactNotifyEmail(),
  subject: contactMailSubject(values),
  body: contactMailBody(values, classLabel, receivedAt),
  replyTo: values.email,
  name: CONTACT_MAIL_SENDER_NAME,
});

// メールが送れなくても（1日の送信上限など）、シートには保存済みのため受付は成功として扱い、記録だけ残す
const trySendContactMail = (values, classLabel, receivedAt) => {
  try {
    sendContactMail(values, classLabel, receivedAt);
  } catch (error) {
    console.error('通知メールを送れませんでした（内容はシートに保存済み）', error);
  }
};

// 保存してから通知する（同時に送信されてもシートの作成・追記が重ならないよう1件ずつ行う）
const saveContact = (data) => {
  const values = normalizeFormValues(data);
  const classLabel = contactClassLabel(data);
  const receivedAt = contactReceivedAt(new Date());
  withNewsLock(() => contactSheet().appendRow([...contactToRow(values, classLabel, receivedAt)]));
  recordContactPost();
  trySendContactMail(values, classLabel, receivedAt);
  return { ok: true };
};

// 問い合わせフォームからの送信（パスワード不要）。誤りがあればシートにもメールにも出さずに返す
const handleContactRequest = (data) => {
  if (contactPostCount() >= CONTACT_RATE_MAX) return { ok: false, errors: ['送信が集中しています。お手数ですがお電話でお問い合わせください'] };
  const errors = contactInputErrors(data, new Date());
  return errors.length > 0 ? { ok: false, errors } : saveContact(data);
};
