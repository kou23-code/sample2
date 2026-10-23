// 【GAS用】問い合わせフォームから届いた内容をシートに追記し、担当者へ通知メール、送信者へ自動返信メールを送る
// GASエディタに「contact-api」という名前のスクリプトファイルを作り、このファイルの内容を貼り付ける。
// 入口は news-api.js の doPost（action が 'contact' のリクエストをここへ振り分ける）。
// シート・メール・キャッシュの操作（副作用）はこのファイルに集約し、組み立ては contact-form.js の純粋関数に任せる。
// 通知先のメールアドレスはコードに書かず、スクリプト プロパティ CONTACT_NOTIFY_EMAIL に登録する（未登録なら仮置きのダミー宛て）。

const CONTACT_SHEET_NAME = 'お問い合わせ';
const CONTACT_NOTIFY_EMAIL_KEY = 'CONTACT_NOTIFY_EMAIL';
const CONTACT_NOTIFY_DUMMY_EMAIL = 'admin@example.com';
const CONTACT_MAIL_SENDER_NAME = 'ホームページ お問い合わせフォーム';
// 自動返信メールの署名（任意）。実名を含むためコードには書かず、スクリプト プロパティに登録する
const CONTACT_REPLY_SIGNATURE_KEY = 'CONTACT_REPLY_SIGNATURE';
// いたずらの大量送信でメールの1日の上限を使い切らないよう、10分間の受付件数を制限する
// （1件の受付で通知と自動返信の2通を送る。第三者のアドレス宛てに自動返信を大量に送らせる悪用の防止も兼ねる）
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

// 自動返信メールの末尾に付ける署名（クラブ名・電話番号など。スクリプト プロパティの値の「\n」は改行にする。未登録なら付けない）
const contactReplySignature = () =>
  sheetText(PropertiesService.getScriptProperties().getProperty(CONTACT_REPLY_SIGNATURE_KEY)).replace(/\\n/g, '\n');

// 担当者へ全項目を記載した通知メールを送る（返信すると送信者に届くよう replyTo を付ける）
const sendContactMail = (values, classLabel, receivedAt) => MailApp.sendEmail({
  to: contactNotifyEmail(),
  subject: contactMailSubject(values),
  body: contactMailBody(values, classLabel, receivedAt),
  replyTo: values.email,
  name: CONTACT_MAIL_SENDER_NAME,
});

// 送信者（お客様）が入力したメールアドレス（to）へ、受付のお知らせと入力内容の控えを自動返信する
const sendContactReply = (to, values, classLabel, receivedAt) => MailApp.sendEmail({
  to,
  subject: CONTACT_REPLY_SUBJECT,
  body: contactReplyBody(values, classLabel, receivedAt, contactReplySignature()),
  name: CONTACT_MAIL_SENDER_NAME,
});

// メールが送れなくても（1日の送信上限・宛先の誤り・貼り付けたファイルが古いなど）、シートには保存済みのため
// 受付全体は止めずに成功として扱い、原因（例外の種類とメッセージ）を GAS の「実行数」に記録する
const trySendMail = (description, send) => {
  try {
    send();
  } catch (error) {
    console.error(`${description}を送れませんでした（内容はシートに保存済み）：${adminErrorDetail(error)}`);
  }
};

// 宛先のメールアドレスが正しく取れたときだけ自動返信を送る（取れなければ送らずに記録だけ残す）
// 宛先の取り出しも try の中で行い、どこで失敗しても受付全体（シート保存・通知メール）は止めない
const trySendContactReply = (values, classLabel, receivedAt) => trySendMail('自動返信メール', () => {
  const to = contactReplyAddress(values);
  if (!to) return console.warn('自動返信メールの宛先（フォームの email）が空か、メールアドレスの形ではないため送信しませんでした');
  return sendContactReply(to, values, classLabel, receivedAt);
});

// 保存してから、担当者への通知と送信者への自動返信を送る（片方が失敗してももう片方は送る）
// 同時に送信されてもシートの作成・追記が重ならないよう、書き込みは1件ずつ行う
const saveContact = (data) => {
  const values = normalizeFormValues(data);
  const classLabel = contactClassLabel(data);
  const receivedAt = contactReceivedAt(new Date());
  withNewsLock(() => contactSheet().appendRow([...contactToRow(values, classLabel, receivedAt)]));
  recordContactPost();
  trySendMail('通知メール', () => sendContactMail(values, classLabel, receivedAt));
  trySendContactReply(values, classLabel, receivedAt);
  return { ok: true };
};

// メール送信の権限（OAuth スコープ）の承認用。GASエディタで一度だけ手動実行し、承認画面で許可する
// （Webアプリからは呼ばない。1日に送れる残り通数を読むだけで、メールは送らない）
function authMail() {
  MailApp.getRemainingDailyQuota();
}

// 問い合わせの受付に必要なファイル・設定の不足（GAS では const の関数は globalThis から引けないため typeof で1つずつ確かめる）
const contactSetupProblems = () => [
  typeof validateForm === 'function' ? '' : '「contact-validate」が無いか古い（js/lib/form-validate.js の内容を貼る）',
  typeof contactReplyBody === 'function' && typeof contactReplyAddress === 'function'
    ? '' : '「contact-form」が自動返信に対応していない古い版（gas/contact-form.js の最新の内容に置き換える）',
  typeof escapeSheetFormula === 'function' && typeof sheetText === 'function' ? '' : '「news-admin」または「news-sheet」が無い',
  contactNotifyEmail() === CONTACT_NOTIFY_DUMMY_EMAIL ? 'スクリプト プロパティ CONTACT_NOTIFY_EMAIL が未登録（通知がダミー宛てになる）' : '',
].filter(Boolean);

// 問い合わせ受付の設定を確認する（GASエディタで手動実行。メールは送らず、結果を実行ログに出す）
function checkContactSetup() {
  const problems = contactSetupProblems();
  console.log(problems.length === 0 ? '問い合わせの受付に必要なファイル・設定はそろっています' : `要対応：\n- ${problems.join('\n- ')}`);
  console.log(`今日あと送れるメールの通数：${MailApp.getRemainingDailyQuota()}`);
  return problems;
}

// 問い合わせフォームからの送信（パスワード不要）。誤りがあればシートにもメールにも出さずに返す
const handleContactRequest = (data) => {
  if (contactPostCount() >= CONTACT_RATE_MAX) return { ok: false, errors: ['送信が集中しています。お手数ですがお電話でお問い合わせください'] };
  const errors = contactInputErrors(data, new Date());
  return errors.length > 0 ? { ok: false, errors } : saveContact(data);
};
