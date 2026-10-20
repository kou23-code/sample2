// 教室データ（会場・紹介文は架空のダミー）
const AGE_GROUPS = Object.freeze([
  Object.freeze({ id: 'preschool', label: '幼児' }),
  Object.freeze({ id: 'elementary', label: '小学生' }),
  Object.freeze({ id: 'teen', label: '中高生' }),
  Object.freeze({ id: 'adult', label: '一般（大人）' }),
  Object.freeze({ id: 'senior', label: 'シニア' }),
]);

// クラス（時間帯）1つ分。label は「①」などの区分、capacityNote は「各クラス」などの補足
const classSession = (label, target, time, capacity, capacityNote = '') =>
  Object.freeze({ label, target, time, capacity, capacityNote });

// 会費。term（期間）・count（回数）は無い場合は省略する
const classFee = (amount, term = '', count = 0) => Object.freeze({ amount, term, count });

const CLASSES_DATA = Object.freeze([
  Object.freeze({
    id: 'track-kids', icon: '🏃', name: '陸上教室①', ages: Object.freeze(['elementary']),
    day: '土曜日', sessions: Object.freeze([classSession('', '小学生', '18:00〜19:30', 40)]),
    fee: classFee(4200, '3ヶ月', 6), place: 'さくら町運動公園 陸上競技場',
    summary: '走る・跳ぶ・投げるの基本を、遊びを交えて楽しく身につけます。',
  }),
  Object.freeze({
    id: 'track-teen', icon: '⏱️', name: '陸上教室②', ages: Object.freeze(['elementary', 'teen']),
    day: '火曜日', sessions: Object.freeze([classSession('', '小学3年生〜中学3年生', '18:30〜19:30', 40, '各クラス')]),
    fee: classFee(7000, '3ヶ月', 10), place: 'さくら町運動公園 陸上競技場',
    summary: '専門的な練習で、記録への挑戦をめざします。',
  }),
  Object.freeze({
    id: 'play', icon: '🤸', name: '運動あそび教室', ages: Object.freeze(['preschool', 'elementary']),
    day: '金曜日',
    sessions: Object.freeze([classSession('①', '年少〜年長', '17:00〜18:00', 20), classSession('②', '小学生', '18:15〜19:15', 25)]),
    fee: classFee(4800, '3ヶ月', 8), place: 'さくら町スポーツセンター 多目的室',
    summary: '鬼ごっこやマット遊びで、体を動かす楽しさと基礎体力を育てます。',
  }),
  Object.freeze({
    id: 'gymnastics', icon: '🙆', name: '体操教室', ages: Object.freeze(['preschool', 'elementary']),
    day: '水曜日',
    sessions: Object.freeze([classSession('①', '年少〜年長', '17:00〜18:00', 8), classSession('②', '小学生', '18:15〜19:15', 15)]),
    fee: classFee(3600), place: 'さくら町スポーツセンター 体育室',
    summary: 'マット・跳び箱・鉄棒に段階的に挑戦し、できた！を積み重ねます。',
  }),
  Object.freeze({
    id: 'table-tennis', icon: '🏓', name: '卓球教室', ages: Object.freeze(['elementary', 'teen', 'adult', 'senior']),
    day: '水曜日', sessions: Object.freeze([classSession('', '小学生〜大人', '19:00〜20:30', 20)]),
    fee: classFee(4200, '3ヶ月', 6), place: 'さくら町スポーツセンター 体育室',
    summary: '初心者から経験者まで、レベルに合わせて親子・三世代で楽しめます。',
  }),
  Object.freeze({
    id: 'weightlifting', icon: '🏋️', name: 'ウエイトリフティング教室', ages: Object.freeze(['elementary', 'teen']),
    day: '隔週', sessions: Object.freeze([classSession('', '小学生〜高校生', '19:00〜20:30', 15)]),
    fee: classFee(5000, '3ヶ月', 10), place: 'さくら町スポーツセンター トレーニング室',
    summary: '正しいフォームを基礎から指導。成長期の体に合わせて、安全に力強さを身につけます。',
  }),
  Object.freeze({
    id: 'senior-strength', icon: '💪', name: '高齢者向け筋力アップ教室', ages: Object.freeze(['senior']),
    day: '水曜日', sessions: Object.freeze([classSession('', '運動制限をされていない女性等', '10:00〜11:00', 15)]),
    fee: classFee(4000, '3ヶ月', 8), place: 'さくら町スポーツセンター 多目的室',
    summary: '椅子を使った無理のない運動で、転びにくく元気な体づくりを応援します。',
  }),
]);

// 全教室共通の会費システム（期の区切り・年会費・支払い方法）
const feeTerm = (label, months) => Object.freeze({ label, months });

const FEE_SYSTEM = Object.freeze({
  terms: Object.freeze([
    feeTerm('第1期', '4〜6月'), feeTerm('第2期', '7〜9月'), feeTerm('第3期', '10〜12月'), feeTerm('第4期', '1〜3月'),
  ]),
  annualFee: 1000,
  annualFeeNote: '年度内1回のみ。複数教室を受講する場合も1回のみで可',
  classFeeNote: '各教室の会費は期ごとの支払いとなります。',
  trialNote: '各教室1回まで無料',
  disclaimer: '※金額はすべて目安です。くわしくはお電話またはお問い合わせフォームでおたずねください。',
});

// スポーツ安全保険（任意加入）の区分ごとの料金
const insurancePlan = (label, amount) => Object.freeze({ label, amount });

const SPORTS_INSURANCE = Object.freeze({
  name: 'スポーツ安全保険',
  optional: true,
  plans: Object.freeze([insurancePlan('高校生以上', 2000), insurancePlan('中学生以下', 800), insurancePlan('65歳以上', 1200)]),
  note: 'ご加入は任意です。補償内容など、くわしくはお問い合わせください。',
});

if (typeof module === 'object' && module.exports) {
  module.exports = {
    AGE_GROUPS, CLASSES_DATA, FEE_SYSTEM, SPORTS_INSURANCE, classSession, classFee, feeTerm, insurancePlan,
  };
}
