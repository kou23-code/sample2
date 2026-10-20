// お知らせの並べ替え・絞り込みを行う純粋関数群

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

if (typeof module === 'object' && module.exports) {
  module.exports = { sortNewsByDate, filterNewsByCategory, latestNews, categoryLabel, formatDateJa };
}
