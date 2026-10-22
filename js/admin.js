// お知らせ管理画面（admin.html）の画面操作と GAS への送信（副作用はこのファイルに集約する）
// 判定・整形・HTML生成は js/lib/admin-logic.js などの純粋関数に委ねる

const ADMIN_PASSWORD_STORAGE_KEY = 'news-admin-password';
const ADMIN_FETCH_TIMEOUT_MS = 60000;

const adminSiteConfig = () => mergeConfig(DEFAULT_CONFIG, typeof SITE_CONFIG === 'object' ? SITE_CONFIG : undefined);

// パスワードはタブを閉じると消える sessionStorage に置く（使えない環境では毎回ログインする）
const readAdminPassword = () => {
  try {
    return sessionStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) ?? '';
  } catch (error) {
    return '';
  }
};

const writeAdminPassword = (password) => {
  try {
    return password ? sessionStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, password) : sessionStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
  } catch (error) {
    return undefined;
  }
};

// 失敗した操作を、原因の詳細とともに開発者ツールのコンソールに出す（結果はそのまま返す）
const logAdminFailure = (action, result) => {
  if (!result.ok) console.error(`[お知らせ管理] 「${action}」に失敗しました`, { errors: result.errors, detail: result.detail ?? '' });
  return result;
};

// GAS に POST し、応答を { ok, errors, detail, ... } にそろえて返す
// 応答は文字列で受け取り、HTTP エラー・JSON でない応答・通信の失敗（CORS・タイムアウトなど）を区別して詳細を残す
const postAdmin = (endpoint, action, data) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN_FETCH_TIMEOUT_MS);
  return fetch(endpoint, { method: 'POST', body: adminRequestBody(action, readAdminPassword(), data), signal: controller.signal })
    .then((response) => response.text().then((text) => parseAdminHttpResponse({ ok: response.ok, status: response.status, text })))
    .catch(describeFetchError)
    .then((result) => logAdminFailure(action, result))
    .finally(() => clearTimeout(timer));
};

// 選んだファイルを { name, type, data（Base64） } にする
const readUploadFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve({ name: file.name, type: file.type, data: dataUrlBase64(reader.result) });
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

// ---- 表示 ----

const showAdminView = (doc, loggedIn) => {
  doc.getElementById('login-view').hidden = loggedIn;
  doc.getElementById('admin-view').hidden = !loggedIn;
};

// メッセージ欄に文字（配列なら箇条書き）を表示する。type は 'error' / 'success' / 'info'
const showAdminMessage = (el, messages, type) => {
  const list = [].concat(messages);
  el.className = `admin-message admin-message--${type}`;
  el.innerHTML = list.length > 1 ? `<ul>${list.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>` : escapeHtml(list[0] ?? '');
  el.hidden = list.length === 0;
};

const logoutAdmin = (doc, message) => {
  writeAdminPassword('');
  showAdminView(doc, false);
  showAdminMessage(doc.getElementById('login-message'), message ? [message] : [], 'error');
};

// パスワードが通らなくなった応答（auth: false）ならログイン画面に戻す
const handleAuthFailure = (doc, result) => result.auth === false && logoutAdmin(doc, result.errors[0]);

const loadAdminList = (doc, endpoint) => {
  const body = doc.getElementById('admin-news-rows');
  renderAdminRows(body, adminTableNoticeHtml('読み込んでいます…'));
  return postAdmin(endpoint, 'list').then((result) => {
    handleAuthFailure(doc, result);
    renderAdminRows(body, result.ok ? adminNewsTableHtml(result.news ?? [], NEWS_CATEGORIES) : adminTableNoticeHtml(adminErrorLines(result).join(' ')));
  });
};

// html は admin-logic.js / templates.js でエスケープ済みの文字列のみを渡すこと
const renderAdminRows = (el, html) => (el.innerHTML = html);

// ---- ログイン ----

const handleAdminLogin = (event, doc, endpoint) => {
  event.preventDefault();
  const form = event.target;
  writeAdminPassword(form.elements.password.value);
  form.querySelector('[type="submit"]').disabled = true;
  return postAdmin(endpoint, 'login').then((result) => {
    form.querySelector('[type="submit"]').disabled = false;
    return result.ok ? enterAdmin(doc, endpoint, form) : logoutAdmin(doc, adminErrorLines(result).join(' '));
  });
};

const enterAdmin = (doc, endpoint, loginForm) => {
  loginForm.reset();
  showAdminMessage(doc.getElementById('login-message'), [], 'info');
  showAdminView(doc, true);
  return loadAdminList(doc, endpoint);
};

// ---- お知らせの追加 ----

const uploadPayload = (form) => {
  const file = form.elements.file.files[0];
  return file ? readUploadFile(file) : Promise.resolve(undefined);
};

const finishCreate = (doc, endpoint, form, result) => {
  handleAuthFailure(doc, result);
  showAdminMessage(doc.getElementById('form-message'),
    result.ok ? [`お知らせ（ID：${result.id}）を追加しました。サイトにはすぐ反映されます。`] : adminErrorLines(result), result.ok ? 'success' : 'error');
  if (!result.ok) return undefined;
  resetNewsForm(doc, form);
  return loadAdminList(doc, endpoint);
};

// ファイルの読み込みや画面の更新で起きたエラーを、種類ごとの文言と詳細で知らせ、コンソールにも出す
const reportSubmitError = (doc, error) => {
  console.error('[お知らせ管理] 送信の処理中にエラーが発生しました', error);
  const message = error?.name === 'NotReadableError' || error?.name === 'NotFoundError'
    ? '添付ファイルを読み込めませんでした。ファイルを選び直してください' : '送信の処理中にエラーが発生しました';
  return showAdminMessage(doc.getElementById('form-message'), adminErrorLines(adminFailure(message, `${error?.name}: ${error?.message}`)), 'error');
};

// 添付ファイルを読み込んでから送信する（失敗したら原因の詳細とともに知らせる）
const submitNews = (doc, endpoint, form, values) => {
  setSubmitting(doc, form, true);
  return uploadPayload(form).then((file) => postAdmin(endpoint, 'create', adminNewsPayload(values, file)))
    .then((result) => finishCreate(doc, endpoint, form, result))
    .catch((error) => reportSubmitError(doc, error))
    .finally(() => setSubmitting(doc, form, false));
};

const handleCreateNews = (event, doc, endpoint) => {
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  const errors = [...adminFormErrors(values, NEWS_CATEGORIES), ...uploadFileErrors(form.elements.file.files[0])];
  if (errors.length > 0) return showAdminMessage(doc.getElementById('form-message'), errors, 'error');
  return submitNews(doc, endpoint, form, values);
};

const setSubmitting = (doc, form, submitting) => {
  form.querySelector('[type="submit"]').disabled = submitting;
  return submitting && showAdminMessage(doc.getElementById('form-message'), ['送信しています…（添付ファイルがある場合は少し時間がかかります）'], 'info');
};

const resetNewsForm = (doc, form) => {
  form.reset();
  form.elements.date.value = dateInputValue(new Date());
};

// ---- 起動 ----

const setupAdminForms = (doc, endpoint) => {
  const newsForm = doc.getElementById('news-form');
  newsForm.elements.category.innerHTML = adminCategoryOptionsHtml(NEWS_CATEGORIES);
  resetNewsForm(doc, newsForm);
  doc.getElementById('login-form').addEventListener('submit', (event) => handleAdminLogin(event, doc, endpoint));
  newsForm.addEventListener('submit', (event) => handleCreateNews(event, doc, endpoint));
  doc.getElementById('logout-button').addEventListener('click', () => logoutAdmin(doc, ''));
  doc.getElementById('reload-button').addEventListener('click', () => loadAdminList(doc, endpoint));
};

const initAdmin = (doc) => {
  const endpoint = adminSiteConfig().newsEndpoint;
  if (!isNewsEndpoint(endpoint)) return showAdminMessage(doc.getElementById('login-message'), ['config.js の newsEndpoint に GAS の Webアプリの URL を設定してください'], 'error');
  setupAdminForms(doc, endpoint.trim());
  return readAdminPassword() ? enterAdmin(doc, endpoint.trim(), doc.getElementById('login-form')) : showAdminView(doc, false);
};

if (typeof document !== 'undefined') {
  initAdmin(document);
}
