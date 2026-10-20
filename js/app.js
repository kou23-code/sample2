// DOMへの反映とイベント登録を行う処理（副作用はこのファイルに集約する）
// 判定・整形・HTML生成はすべて js/lib の純粋関数に委ねる

const CLASS_IDS = Object.freeze(CLASSES_DATA.map((item) => item.id));

// ダミー設定に config.js（SITE_CONFIG）があれば上書きした最終設定
const resolveSiteConfig = () =>
  mergeConfig(DEFAULT_CONFIG, typeof SITE_CONFIG === 'object' ? SITE_CONFIG : undefined);

// html は templates.js でエスケープ済みの文字列のみを渡すこと
const renderHtml = (el, html) => el && (el.innerHTML = html);
const renderText = (el, text) => el && (el.textContent = text);

// ---- 全ページ共通 ----

const applyConfigText = (doc, config) =>
  doc.querySelectorAll('[data-config]').forEach((el) => renderText(el, config[el.dataset.config] ?? el.textContent));

const applyTelLinks = (doc, config) =>
  doc.querySelectorAll('[data-tel-link]').forEach((el) => el.setAttribute('href', toTelHref(config.tel)));

const markCurrentNav = (doc) =>
  doc.querySelectorAll(`[data-nav="${doc.body.dataset.page}"]`).forEach((el) => el.setAttribute('aria-current', 'page'));

const applyCommon = (doc, config) => {
  applyConfigText(doc, config);
  applyTelLinks(doc, config);
  markCurrentNav(doc);
  doc.title = buildPageTitle(doc.body.dataset.pageTitle, config.clubName);
};

// ---- 絞り込み（お知らせ・教室で共通） ----

const updatePressed = (container, activeId) =>
  container.querySelectorAll('[data-filter]').forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.filter === activeId)));

const setupFilter = (container, options, allLabel, onChange) => {
  renderHtml(container, filterButtonsHtml(options, 'all', allLabel));
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    updatePressed(container, button.dataset.filter);
    onChange(button.dataset.filter);
  });
  onChange('all');
};

// ---- 各ページ ----

const initTopPage = (doc) => {
  renderHtml(doc.getElementById('latest-news'), newsListHtml(latestNews(NEWS_DATA, 3), NEWS_CATEGORIES));
  renderHtml(doc.getElementById('class-highlights'), CLASSES_DATA.map(classHighlightHtml).join(''));
};

const renderNews = (doc, categoryId) => {
  const items = sortNewsByDate(filterNewsByCategory(NEWS_DATA, categoryId));
  renderHtml(doc.getElementById('news-list'), newsListHtml(items, NEWS_CATEGORIES));
  renderText(doc.getElementById('news-count'), resultCountText(items.length, '件のお知らせ'));
};

const initNewsPage = (doc) =>
  setupFilter(doc.getElementById('news-filter'), NEWS_CATEGORIES, 'すべて', (id) => renderNews(doc, id));

const renderClasses = (doc, ageId) => {
  const items = filterClassesByAge(CLASSES_DATA, ageId);
  renderHtml(doc.getElementById('class-list'), classListHtml(items, AGE_GROUPS));
  renderText(doc.getElementById('class-count'), resultCountText(items.length, '教室'));
};

// 描画後に URL の #教室ID の位置へ移動する（JS描画のためブラウザ標準の移動が効かない）
const scrollToHash = (doc) => {
  const target = doc.defaultView.location.hash && doc.getElementById(decodeURIComponent(doc.defaultView.location.hash.slice(1)));
  return target && target.scrollIntoView();
};

const initClassesPage = (doc) => {
  setupFilter(doc.getElementById('class-filter'), AGE_GROUPS, 'すべての年代', (id) => renderClasses(doc, id));
  scrollToHash(doc);
};

// ---- お問い合わせフォーム ----

const showErrors = (form, errors) => {
  form.querySelectorAll('[data-error-for]').forEach((el) => renderText(el, errors[el.dataset.errorFor] ?? ''));
  form.querySelectorAll('[data-field]').forEach((el) =>
    el.setAttribute('aria-invalid', String(Boolean(errors[el.dataset.field]))));
  renderText(form.querySelector('#form-error-summary'), errorSummaryText(Object.keys(errors).length));
  const firstField = Object.keys(errors)[0];
  return firstField && form.querySelector(`[name="${firstField}"]`)?.focus();
};

const postInquiry = (endpoint, values) =>
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(values),
  }).then((response) => (response.ok ? 'sent' : Promise.reject(new Error(`HTTP ${response.status}`))));

const showCompletion = (doc, values, isDemo) => {
  const section = doc.getElementById('form-complete');
  renderHtml(doc.getElementById('complete-summary'), completionTableHtml(completionRows(values, CLASSES_DATA)));
  doc.getElementById('demo-notice').hidden = !isDemo;
  doc.getElementById('contact-form').hidden = true;
  section.hidden = false;
  section.querySelector('[tabindex="-1"]').focus();
};

const showSendError = (doc, form) => {
  doc.getElementById('send-error').hidden = false;
  form.querySelector('[type="submit"]').disabled = false;
};

const submitInquiry = (doc, form, config, values) => {
  form.querySelector('[type="submit"]').disabled = true;
  return (config.formEndpoint ? postInquiry(config.formEndpoint, values) : Promise.resolve('demo'))
    .then((mode) => showCompletion(doc, values, mode === 'demo'))
    .catch(() => showSendError(doc, form));
};

const handleSubmit = (event, doc, config) => {
  event.preventDefault();
  const result = validateForm(Object.fromEntries(new FormData(event.target)), CLASS_IDS);
  showErrors(event.target, result.errors);
  return result.valid && submitInquiry(doc, event.target, config, result.values);
};

const initContactPage = (doc, config) => {
  const form = doc.getElementById('contact-form');
  const query = parseContactQuery(doc.defaultView.location.search, CLASS_IDS);
  renderHtml(doc.getElementById('inquiry-types'), inquiryTypeRadiosHtml(INQUIRY_TYPES, query.type));
  renderHtml(form.elements.classId, classOptionsHtml(CLASSES_DATA, query.classId));
  form.setAttribute('novalidate', '');
  form.addEventListener('submit', (event) => handleSubmit(event, doc, config));
};

// ---- 起動 ----

const PAGE_INITIALIZERS = Object.freeze({
  top: initTopPage, news: initNewsPage, classes: initClassesPage, contact: initContactPage,
});

const initSite = (doc) => {
  const config = resolveSiteConfig();
  applyCommon(doc, config);
  PAGE_INITIALIZERS[doc.body.dataset.page]?.(doc, config);
};

if (typeof document !== 'undefined') {
  initSite(document);
}
