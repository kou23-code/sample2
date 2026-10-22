// お知らせの並べ替え・絞り込み・入力チェックを行う純粋関数群

// 日付の新しい順に並べた新しい配列を返す
const sortNewsByDate = (news) => [...news].sort((a, b) => b.date.localeCompare(a.date));

// カテゴリで絞り込む（'all' または未指定なら全件）
const filterNewsByCategory = (news, categoryId) =>
  !categoryId || categoryId === 'all' ? [...news] : news.filter((item) => item.category === categoryId);

// 最新 n 件を返す
const latestNews = (news, count) => sortNewsByDate(news).slice(0, Math.max(0, count));

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

// 1件分の誤りを、職員が直し方の分かる日本語のメッセージの配列で返す（誤りがなければ空配列）
const newsEntryErrors = (entry, categories) => {
  if (!isNewsObject(entry)) return ['{ date, category, title, body } の形で書いてください'];
  const ids = categories.map((category) => category.id);
  return [
    isNewsDate(entry.date) ? '' : `date「${entry.date ?? ''}」は 2026-10-15 のような実在する日付にしてください`,
    ids.includes(newsText(entry.category)) ? '' : `category「${entry.category ?? ''}」は ${ids.join(' / ')} のいずれかにしてください`,
    newsText(entry.title) ? '' : 'title（タイトル）を入力してください',
    entry.body === undefined || typeof entry.body === 'string' ? '' : 'body（本文）は文字列にしてください',
  ].filter(Boolean);
};

// 誤りのあるお知らせだけを { 番号（1始まり）, タイトル, 誤り一覧 } で返す
const findNewsProblems = (entries, categories) =>
  entries
    .map((entry, index) => ({ number: index + 1, title: newsText(entry?.title), errors: newsEntryErrors(entry, categories) }))
    .filter((problem) => problem.errors.length > 0);

// 表示用に、前後の空白を除いて凍結したお知らせを作る（body は省略可）
const toNewsItem = (entry) => Object.freeze({
  date: newsText(entry.date), category: newsText(entry.category), title: newsText(entry.title), body: newsText(entry.body),
});

// 誤りのないお知らせだけを表示用に整えた凍結配列を返す
const prepareNews = (entries, categories) =>
  Object.freeze(entries.filter((entry) => newsEntryErrors(entry, categories).length === 0).map(toNewsItem));

if (typeof module === 'object' && module.exports) {
  module.exports = {
    sortNewsByDate, filterNewsByCategory, latestNews, categoryLabel, formatDateJa,
    newsText, isNewsDate, newsEntryErrors, findNewsProblems, toNewsItem, prepareNews,
  };
}
