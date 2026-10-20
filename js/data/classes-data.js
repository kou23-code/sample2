// 教室データ（日時・会場・会費はすべて架空のダミー）
const AGE_GROUPS = Object.freeze([
  Object.freeze({ id: 'preschool', label: '幼児' }),
  Object.freeze({ id: 'elementary', label: '小学生' }),
  Object.freeze({ id: 'teen', label: '中高生' }),
  Object.freeze({ id: 'adult', label: '一般（大人）' }),
  Object.freeze({ id: 'senior', label: 'シニア' }),
]);

const CLASSES_DATA = Object.freeze([
  Object.freeze({
    id: 'track-kids', icon: '🏃', name: '陸上教室', course: '小学生・基礎コース',
    ages: Object.freeze(['elementary']), target: '小学1〜6年生',
    schedule: '毎週土曜 9:00〜10:30', place: 'さくら町運動公園 陸上競技場',
    fee: '月額 2,000円', summary: '走る・跳ぶ・投げるの基本を、遊びを交えて楽しく身につけます。',
  }),
  Object.freeze({
    id: 'track-teen', icon: '⏱️', name: '陸上教室', course: '中高生・記録挑戦コース',
    ages: Object.freeze(['teen']), target: '中学生・高校生',
    schedule: '毎週水曜 18:00〜19:30／土曜 9:30〜11:30', place: 'さくら町運動公園 陸上競技場',
    fee: '月額 3,000円', summary: '専門種目の技術と練習計画づくりで、自己ベスト更新をめざします。',
  }),
  Object.freeze({
    id: 'play', icon: '🤸', name: 'うんどう遊び教室', course: '',
    ages: Object.freeze(['preschool', 'elementary']), target: '年中〜小学2年生',
    schedule: '毎週金曜 16:00〜17:00', place: 'さくら町スポーツセンター 多目的室',
    fee: '月額 2,000円', summary: '鬼ごっこやマット遊びで、体を動かす楽しさと基礎体力を育てます。',
  }),
  Object.freeze({
    id: 'gymnastics', icon: '🙆', name: '体操教室', course: '',
    ages: Object.freeze(['preschool', 'elementary']), target: '年長〜小学6年生',
    schedule: '毎週火曜 16:30〜17:30', place: 'さくら町スポーツセンター 体育室',
    fee: '月額 2,500円', summary: 'マット・跳び箱・鉄棒に段階的に挑戦し、できた！を積み重ねます。',
  }),
  Object.freeze({
    id: 'table-tennis', icon: '🏓', name: '卓球教室', course: '',
    ages: Object.freeze(['elementary', 'teen', 'adult', 'senior']), target: '小学生〜シニア',
    schedule: '毎週木曜 19:00〜21:00', place: 'さくら町スポーツセンター 体育室',
    fee: '月額 1,500円', summary: '初心者から経験者まで、レベルに合わせて親子・三世代で楽しめます。',
  }),
  Object.freeze({
    id: 'weightlifting', icon: '🏋️', name: 'ウエイトリフティング教室', course: '',
    ages: Object.freeze(['teen', 'adult']), target: '中学生〜一般',
    schedule: '毎週月曜・水曜 19:00〜20:30', place: 'さくら町スポーツセンター トレーニング室',
    fee: '月額 3,000円', summary: '正しいフォームを基礎から指導。安全に力強さを身につけます。',
  }),
  Object.freeze({
    id: 'senior-strength', icon: '💪', name: '高齢者向け筋力アップ教室', course: '',
    ages: Object.freeze(['senior']), target: 'おおむね65歳以上',
    schedule: '毎週火曜・金曜 10:00〜11:00', place: 'さくら町スポーツセンター 多目的室',
    fee: '月額 1,000円', summary: '椅子を使った無理のない運動で、転びにくく元気な体づくりを応援します。',
  }),
]);

if (typeof module === 'object' && module.exports) {
  module.exports = { AGE_GROUPS, CLASSES_DATA };
}
