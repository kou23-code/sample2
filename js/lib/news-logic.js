// お知らせの並べ替え・絞り込み・入力チェックを行う純粋関数群

// 日付の新しい順に並べた新しい配列を返す
const sortNewsByDate = (news) => [...news].sort((a, b) => b.date.localeCompare(a.date));

// カテゴリで絞り込む（'all' または未指定なら全件）
const filterNewsByCategory = (news, categoryId) =>
  !categoryId || categoryId === 'all' ? [...news] : news.filter((item) => item.category === categoryId);

// ---- 表示順（固定順位） ----

// 固定順位：数値（または数字だけの文字列）なら数値、空や数値でないものは null（日付順で表示）
const newsOrder = (value) => {
  const number = typeof value === 'number' ? value : newsText(value) === '' ? NaN : Number(newsText(value));
  return Number.isFinite(number) ? number : null;
};

const hasNewsOrder = (item) => typeof item.order === 'number' && Number.isFinite(item.order);

// 固定順位があるものを先に小さい順、ないものは後ろに日付の新しい順（同じ順位どうしも日付の新しい順）
const compareNewsForDisplay = (a, b) => {
  if (hasNewsOrder(a) !== hasNewsOrder(b)) return hasNewsOrder(a) ? -1 : 1;
  if (hasNewsOrder(a) && a.order !== b.order) return a.order - b.order;
  return b.date.localeCompare(a.date);
};

// 表示順に並べた新しい配列を返す（トップ・お知らせ一覧・管理画面で共通）
const sortNewsForDisplay = (news) => [...news].sort(compareNewsForDisplay);

// 表示順で先頭から n 件を返す
const latestNews = (news, count) => sortNewsForDisplay(news).slice(0, Math.max(0, count));

// カテゴリIDから表示名を引く（見つからなければIDをそのまま返す）
const categoryLabel = (categories, categoryId) =>
  categories.find((category) => category.id === categoryId)?.label ?? categoryId;

// 'YYYY-MM-DD' を 'YYYY年M月D日' に整形する
const formatDateJa = (isoDate) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${year}年${month}月${day}日`;
};

// ---- 職員が書いたお知らせデータの入力チェックと整形 ----

// 文字列なら前後の空白を除いて返し、それ以外は空文字にする
const newsText = (value) => (typeof value === 'string' ? value.trim() : '');

// 'YYYY-MM-DD' 形式で、かつ実在する日付か（2026-02-30 などは不可）
const isNewsDate = (value) => {
  const text = newsText(value);
  const parsed = new Date(`${text}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === text;
};

const isNewsObject = (entry) => typeof entry === 'object' && entry !== null && !Array.isArray(entry);

const isEmptyNewsValue = (value) => value === undefined || value === null || value === '';

// 省略できる項目（本文・固定順位）の誤り
const newsOptionalErrors = (entry) => [
  entry.body === undefined || typeof entry.body === 'string' ? '' : 'body（本文）は文字列にしてください',
  isEmptyNewsValue(entry.order) || newsOrder(entry.order) !== null ? '' : `order（固定順位）「${entry.order}」は数値にしてください`,
];

// 1件分の誤りを、職員が直し方の分かる日本語のメッセージの配列で返す（誤りがなければ空配列）
const newsEntryErrors = (entry, categories) => {
  if (!isNewsObject(entry)) return ['{ date, category, title, body } の形で書いてください'];
  const ids = categories.map((category) => category.id);
  return [
    isNewsDate(entry.date) ? '' : `date「${entry.date ?? ''}」は 2026-10-15 のような実在する日付にしてください`,
    ids.includes(newsText(entry.category)) ? '' : `category「${entry.category ?? ''}」は ${ids.join(' / ')} のいずれかにしてください`,
    newsText(entry.title) ? '' : 'title（タイトル）を入力してください',
    ...newsOptionalErrors(entry),
  ].filter(Boolean);
};

// 誤りのあるお知らせだけを { 番号（1始まり）, タイトル, 誤り一覧 } で返す
const findNewsProblems = (entries, categories) =>
  entries
    .map((entry, index) => ({ number: index + 1, title: newsText(entry?.title), errors: newsEntryErrors(entry, categories) }))
    .filter((problem) => problem.errors.length > 0);

// ---- 添付ファイル（GoogleドライブのプレビューURLへの変換もここで行う） ----

// 添付として使える URL か（https で始まり、空白や引用符・山かっこを含まない）
const isHttpsUrl = (url) => /^https:\/\/[^\s"'<>]+$/.test(newsText(url));

// Googleドライブの共有リンク（/file/d/ID/…、open?id=ID、uc?id=ID）からファイルIDを取り出す（ドライブ以外は空文字）
const driveFileId = (url) => {
  const match = /^https:\/\/drive\.google\.com\/(?:file\/d\/([\w-]+)|(?:open|uc)\?(?:[^#]*&)?id=([\w-]+))/.exec(newsText(url));
  return match ? match[1] ?? match[2] : '';
};

const isImageFileUrl = (url) => /\.(jpe?g|png|gif|webp|avif)(?:[?#]|$)/i.test(newsText(url));

// 画像プレビューのURL（ドライブはサムネイル、画像ファイルはそのまま、それ以外は空文字）
const attachmentPreviewSrc = (url) => {
  const fileId = driveFileId(url);
  if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  return isImageFileUrl(url) ? newsText(url) : '';
};

// 添付ファイルURLを { href（開くURL）, previewSrc（プレビュー画像のURL。無ければ空文字） } にする（使えないURLは null）
const newsAttachment = (url) =>
  isHttpsUrl(url) ? Object.freeze({ href: newsText(url), previewSrc: attachmentPreviewSrc(url) }) : null;

// 添付ファイルURLが書かれているのに使えないお知らせを { 番号, タイトル, URL } で返す（お知らせ自体は表示する）
const findAttachmentProblems = (entries) =>
  entries
    .map((entry, index) => ({ number: index + 1, title: newsText(entry?.title), url: newsText(entry?.attachmentUrl) }))
    .filter((problem) => problem.url !== '' && !isHttpsUrl(problem.url));

// 表示用に、前後の空白を除いて凍結したお知らせを作る（id・body・attachmentUrl・order は省略可。使えない添付URLは空文字、固定順位なしは null）
const toNewsItem = (entry) => Object.freeze({
  id: newsText(entry.id),
  date: newsText(entry.date),
  category: newsText(entry.category),
  title: newsText(entry.title),
  body: newsText(entry.body),
  attachmentUrl: isHttpsUrl(entry.attachmentUrl) ? newsText(entry.attachmentUrl) : '',
  order: newsOrder(entry.order),
});

// ---- GAS の Webアプリからの取得 ----

// 取得先として使える URL か（未設定や 'YOUR_GAS_WEB_APP_URL' のような仮の値は false）
const isNewsEndpoint = (url) => /^https?:\/\/\S+$/.test(newsText(url));

// Webアプリの応答 { updatedAt, news: [...] } からお知らせの配列を取り出す（形が違えば null）
const parseNewsResponse = (json) => (Array.isArray(json?.news) ? json.news : null);

// 誤りのないお知らせだけを表示用に整えた凍結配列を返す
const prepareNews = (entries, categories) =>
  Object.freeze(entries.filter((entry) => newsEntryErrors(entry, categories).length === 0).map(toNewsItem));

if (typeof module === 'object' && module.exports) {
  module.exports = {
    sortNewsByDate, filterNewsByCategory, latestNews, categoryLabel, formatDateJa, newsOrder, sortNewsForDisplay,
    newsText, isNewsDate, newsEntryErrors, findNewsProblems, toNewsItem, prepareNews,
    isNewsEndpoint, parseNewsResponse,
    isHttpsUrl, driveFileId, attachmentPreviewSrc, newsAttachment, findAttachmentProblems,
  };
}
