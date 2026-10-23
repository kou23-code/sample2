// DOMへの反映とイベント登録を行う処理（副作用はこのファイルに集約する）
// 判定・整形・HTML生成はすべて js/lib の純粋関数に委ねる

const CLASS_IDS = Object.freeze(CLASSES_DATA.map((item) => item.id));

// 予備のお知らせ（js/data/news-data.js）のうち、誤りのないもの。取得先が未設定・取得失敗のときに表示する
const NEWS_ITEMS = prepareNews(NEWS_DATA, NEWS_CATEGORIES);
const NEWS_FETCH_TIMEOUT_MS = 5000;
// トップページの「最新のお知らせ」に表示する件数
const TOP_NEWS_COUNT = 5;
// お問い合わせの送信を打ち切るまでの時間（GAS はシート書き込みとメール送信で数秒かかることがある）
const INQUIRY_FETCH_TIMEOUT_MS = 20000;

// 誤りのあるお知らせは表示せず、直し方をコンソールに出す（使えない添付URLは、添付だけ出さずに知らせる）
const warnNewsProblems = (entries, source) => {
  findNewsProblems(entries, NEWS_CATEGORIES).forEach((problem) =>
    console.warn(`${source}のお知らせ ${problem.number}件目「${problem.title}」を表示できません：${problem.errors.join('／')}`));
  findAttachmentProblems(entries).forEach((problem) =>
    console.warn(`${source}のお知らせ ${problem.number}件目「${problem.title}」の添付ファイルURL「${problem.url}」は https:// で始まるURLではないため、添付を表示しません`));
};

// 添付の画像が読み込めない場合（非公開のドライブファイルなど）は画像の枠ごと消し、「ファイルを開く」ボタンだけを残す
// （画像の error イベントは親へ伝わらないため、document のキャプチャ段階で受け取る）
const removeBrokenPreviews = (doc) =>
  doc.addEventListener('error', (event) => event.target.closest?.('.news-figure')?.remove(), true);

// GAS の Webアプリから取得したお知らせの配列を返す（5秒で打ち切り。応答の形が違えば失敗扱い）
const fetchNewsEntries = (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
    .then((json) => parseNewsResponse(json) ?? Promise.reject(new Error('応答の形式が違います')))
    .finally(() => clearTimeout(timer));
};

const fetchRemoteNews = (url) =>
  fetchNewsEntries(url).then((entries) => {
    warnNewsProblems(entries, 'スプレッドシート');
    return prepareNews(entries, NEWS_CATEGORIES);
  });

// 取得先が設定されていれば Webアプリから取得し、未設定・失敗時は予備のお知らせを返す
const loadNewsItems = (config) =>
  isNewsEndpoint(config.newsEndpoint)
    ? fetchRemoteNews(config.newsEndpoint.trim()).catch((error) => {
      console.warn('お知らせを取得できなかったため、予備データを表示します：', error);
      return NEWS_ITEMS;
    })
    : Promise.resolve(NEWS_ITEMS);

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

// data-fee-info を置いたページ（クラブ概要・教室案内）に「会費について」ブロックを表示する
const renderFeeInfo = (doc) =>
  doc.querySelectorAll('[data-fee-info]').forEach((el) =>
    renderHtml(el, feeInfoHtml(CLASSES_DATA, FEE_SYSTEM, SPORTS_INSURANCE)));

const applyCommon = (doc, config) => {
  applyConfigText(doc, config);
  renderFeeInfo(doc);
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

// お知らせは取得が終わってから描画する（それまでは HTML の「読み込んでいます…」を表示）
const initTopPage = (doc, config) => {
  loadNewsItems(config).then((news) =>
    renderHtml(doc.getElementById('latest-news'), newsLinkListHtml(latestNews(news, TOP_NEWS_COUNT), NEWS_CATEGORIES)));
  renderHtml(doc.getElementById('class-highlights'), CLASSES_DATA.map(classHighlightHtml).join(''));
};

const renderNews = (doc, categoryId, news) => {
  const items = sortNewsForDisplay(filterNewsByCategory(news, categoryId));
  renderHtml(doc.getElementById('news-list'), newsListHtml(items, NEWS_CATEGORIES));
  renderText(doc.getElementById('news-count'), resultCountText(items.length, '件のお知らせ'));
};

// トップの最新お知らせから来たとき（news.html#news-…）は、そのお知らせを開いた状態で表示位置まで移動する
const openNewsFromHash = (doc) => {
  const hash = doc.defaultView.location.hash;
  const target = hash && doc.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return undefined;
  target.querySelectorAll('details').forEach((entry) => (entry.open = true));
  return target.scrollIntoView({ block: 'start' });
};

// 取得中に押された絞り込みも、取得完了後に押された順で反映される
const initNewsPage = (doc, config) => {
  const newsReady = loadNewsItems(config);
  setupFilter(doc.getElementById('news-filter'), NEWS_CATEGORIES, 'すべて', (id) =>
    newsReady.then((news) => renderNews(doc, id, news)));
  newsReady.then(() => openNewsFromHash(doc));
};

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

// 希望教室の表示名（通知メール・シートで読めるように添える。未選択なら空）
const classLabelOf = (classId) => {
  const item = CLASSES_DATA.find((entry) => entry.id === classId);
  return item ? classDisplayName(item) : '';
};

// GAS の Webアプリへ送り、{ ok: true } が返れば成功（GAS は誤りがあっても HTTP 200 で { ok: false, errors } を返す）
const postInquiry = (endpoint, values) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INQUIRY_FETCH_TIMEOUT_MS);
  return fetch(endpoint, { method: 'POST', body: inquiryRequestBody(values, classLabelOf(values.classId)), signal: controller.signal })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
    .then((json) => (isInquiryAccepted(json) ? 'sent' : Promise.reject(new Error((json?.errors ?? []).join('／') || '応答の形式が違います'))))
    .finally(() => clearTimeout(timer));
};

const showCompletion = (doc, values, isDemo) => {
  const section = doc.getElementById('form-complete');
  renderHtml(doc.getElementById('complete-summary'), completionTableHtml(completionRows(values, CLASSES_DATA)));
  doc.getElementById('demo-notice').hidden = !isDemo;
  doc.getElementById('contact-form').hidden = true;
  section.hidden = false;
  section.querySelector('[tabindex="-1"]').focus();
};

const showSendError = (doc, form, error) => {
  console.warn('お問い合わせを送信できませんでした：', error);
  doc.getElementById('send-error').hidden = false;
  form.querySelector('[type="submit"]').disabled = false;
};

// 送信先（formEndpoint、無ければ newsEndpoint の GAS）が未設定ならデモとして完了画面だけ出す
const submitInquiry = (doc, form, config, values) => {
  const endpoint = inquiryEndpoint(config);
  form.querySelector('[type="submit"]').disabled = true;
  doc.getElementById('send-error').hidden = true;
  return (endpoint ? postInquiry(endpoint, values) : Promise.resolve('demo'))
    .then((mode) => showCompletion(doc, values, mode === 'demo'))
    .catch((error) => showSendError(doc, form, error));
};

const handleSubmit = (event, doc, config) => {
  event.preventDefault();
  const result = validateForm(Object.fromEntries(new FormData(event.target)), CLASS_IDS, earliestTrialDate(new Date()));
  showErrors(event.target, result.errors);
  return result.valid && submitInquiry(doc, event.target, config, result.values);
};

// 種別専用のコンテナ（data-inquiry-only="種別ID"）の表示と、中の入力欄の required・disabled を連動させる
// 選ばれていない種別の欄は非表示・必須なし・無効（無効の欄は送信されない）
const setGroupActive = (group, active) => {
  group.hidden = !active;
  group.querySelectorAll('input, select, textarea').forEach((control) => {
    control.required = active;
    control.disabled = !active;
  });
};

const toggleInquiryFields = (form) =>
  form.querySelectorAll('[data-inquiry-only]').forEach((group) =>
    setGroupActive(group, group.dataset.inquiryOnly === form.elements.inquiryType.value));

// 希望日は明後日以降だけ選べるようにし、種別の変更に合わせて項目を切り替える
const setupInquiryFields = (form) => {
  form.elements.preferredDate.min = earliestTrialDate(new Date());
  form.addEventListener('change', (event) => event.target.name === 'inquiryType' && toggleInquiryFields(form));
  toggleInquiryFields(form);
};

const initContactPage = (doc, config) => {
  const form = doc.getElementById('contact-form');
  const query = parseContactQuery(doc.defaultView.location.search, CLASS_IDS);
  renderHtml(doc.getElementById('inquiry-types'), inquiryTypeRadiosHtml(INQUIRY_TYPES, query.type));
  renderHtml(form.elements.classId, classOptionsHtml(CLASSES_DATA, query.classId));
  renderHtml(form.elements.grade, gradeOptionsHtml(GRADES));
  setupInquiryFields(form);
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
  warnNewsProblems(NEWS_DATA, '予備データ（js/data/news-data.js）');
  removeBrokenPreviews(doc);
  PAGE_INITIALIZERS[doc.body.dataset.page]?.(doc, config);
};

if (typeof document !== 'undefined') {
  initSite(document);
}
