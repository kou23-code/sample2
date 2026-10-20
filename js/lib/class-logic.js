// 教室の絞り込み・検索・表示用データ抽出を行う純粋関数群

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

// 金額を「4,200円」形式にする
const formatYen = (amount) => `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}円`;

// 会費を「4,200円／3ヶ月（全6回）」形式にする（期間・回数が無ければ省略）
const formatFee = (fee) =>
  [formatYen(fee.amount), fee.term && `／${fee.term}`, fee.count > 0 && `（全${fee.count}回）`].filter(Boolean).join('');

// 定員を「各クラス40名」形式にする
const formatCapacity = (session) => `${session.capacityNote}${session.capacity}名`;

// クラスの見出し（「① 年少〜年長」）
const sessionHeading = (session) => `${session.label} ${session.target}`.trim();

// 教室全体の対象（クラスごとの対象を「・」でつなぐ）
const classTargetSummary = (item) => item.sessions.map((session) => session.target).join('・');

const hasMultipleSessions = (item) => item.sessions.length > 1;

// クラスごとの [項目名, 値]（複数クラスの教室で使う）
const sessionRows = (session) => [['時間', session.time], ['定員', formatCapacity(session)]];

// 教室カード上段の [項目名, 値]（1クラスのみの教室は時間・定員もここに含める）
const classMainRows = (item) => [
  ['対象', classTargetSummary(item)], ['曜日', item.day],
  ...(hasMultipleSessions(item) ? [] : sessionRows(item.sessions[0])),
];

// 教室カード下段の [項目名, 値]（年会費は全教室共通の会費システムで案内する）
const classFeeRows = (item) => [['会費', formatFee(item.fee)], ['会場', item.place]];

if (typeof module === 'object' && module.exports) {
  module.exports = {
    filterClassesByAge, findClassById, classDisplayName, ageLabels,
    formatYen, formatFee, formatCapacity, sessionHeading, classTargetSummary,
    hasMultipleSessions, sessionRows, classMainRows, classFeeRows,
  };
}
