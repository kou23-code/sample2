// 教室の絞り込み・検索を行う純粋関数群

// 対象年代で絞り込む（'all' または未指定なら全件）
const filterClassesByAge = (classes, ageId) =>
  !ageId || ageId === 'all' ? [...classes] : classes.filter((item) => item.ages.includes(ageId));

// 教室IDから教室を探す（見つからなければ undefined）
const findClassById = (classes, classId) => classes.find((item) => item.id === classId);

// 教室の表示名（コース名があれば括弧書きで付ける）
const classDisplayName = (item) => (item.course ? `${item.name}（${item.course}）` : item.name);

// 年代IDの配列を表示名の配列に変換する
const ageLabels = (ageGroups, ageIds) =>
  ageIds.map((id) => ageGroups.find((group) => group.id === id)?.label ?? id);

if (typeof module === 'object' && module.exports) {
  module.exports = { filterClassesByAge, findClassById, classDisplayName, ageLabels };
}
