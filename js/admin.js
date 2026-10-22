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

// GAS に POST し、応答を { ok, errors, ... } にそろえて返す（通信の失敗やタイムアウトもエラーとして返す）
const postAdmin = (endpoint, action, data) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN_FETCH_TIMEOUT_MS);
  return fetch(endpoint, { method: 'POST', body: adminRequestBody(action, readAdminPassword(), data), signal: controller.signal })
    .then((response) => response.json())
    .then(normalizeAdminResponse)
    .catch(() => normalizeAdminResponse({ ok: false, errors: ['通信に失敗しました。インターネット接続を確認して、もう一度お試しください'] }))
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
  renderAdminRows(body, '<tr><td colspan="5" class="admin-table__empty">読み込んでいます…</td></tr>');
  return postAdmin(endpoint, 'list').then((result) => {
    handleAuthFailure(doc, result);
    renderAdminRows(body, result.ok ? adminNewsTableHtml(result.news ?? [], NEWS_CATEGORIES)
      : `<tr><td colspan="5" class="admin-table__empty">${escapeHtml(result.errors[0] ?? '')}</td></tr>`);
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
    return result.ok ? enterAdmin(doc, endpoint, form) : logoutAdmin(doc, result.errors[0]);
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
    result.ok ? [`お知らせ（ID：${result.id}）を追加しました。サイトにはすぐ反映されます。`] : result.errors, result.ok ? 'success' : 'error');
  if (!result.ok) return undefined;
  resetNewsForm(doc, form);
  return loadAdminList(doc, endpoint);
};

// 添付ファイルを読み込んでから送信する（読み込みに失敗したら知らせる）
const submitNews = (doc, endpoint, form, values) => {
  setSubmitting(doc, form, true);
  return uploadPayload(form).then((file) => postAdmin(endpoint, 'create', adminNewsPayload(values, file)))
    .then((result) => finishCreate(doc, endpoint, form, result))
    .catch(() => showAdminMessage(doc.getElementById('form-message'), ['添付ファイルを読み込めませんでした。ファイルを選び直してください'], 'error'))
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
