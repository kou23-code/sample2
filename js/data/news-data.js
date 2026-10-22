// お知らせデータ（内容はすべて架空のダミー）
//
// 【お知らせの追加方法】
//   NEWS_DATA の [ ] の中に、次の形の { } を1つ追加してください（並び順は自由。表示時に日付の新しい順に並びます）。
//     { date: '2026-11-01', category: 'info', title: 'タイトル', body: '本文（省略可）' },
//   - date     … 'YYYY-MM-DD' 形式の日付
//   - category … 'info'（お知らせ）／'event'（イベント）／'class'（教室情報）／'recruit'（募集）のいずれか
//   - title    … タイトル（必須）
//   - body     … 本文（一覧ページに表示。省略可）
//   書き間違いのあるお知らせは画面に表示されず、`npm test` やブラウザのコンソールで誤りの内容を確認できます。

const NEWS_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'info', label: 'お知らせ' }),
  Object.freeze({ id: 'event', label: 'イベント' }),
  Object.freeze({ id: 'class', label: '教室情報' }),
  Object.freeze({ id: 'recruit', label: '募集' }),
]);

const NEWS_DATA = [
  {
    date: '2026-10-15', category: 'event',
    title: '秋のスポーツフェスタを開催します',
    body: '11月3日（祝）にさくら町スポーツセンターで、どなたでも参加できる体験会を行います。',
  },
  {
    date: '2026-10-01', category: 'recruit',
    title: '高齢者向け筋力アップ教室の新規会員を募集しています',
    body: '椅子に座ったままできる運動が中心です。運動が久しぶりの方も安心してご参加ください。',
  },
  {
    date: '2026-09-20', category: 'class',
    title: '陸上教室②の練習時間が変わります',
    body: '10月から火曜日の練習時間を18:30〜19:30に変更します。',
  },
  {
    date: '2026-09-05', category: 'info',
    title: '台風接近時の教室開催について',
    body: '警報が発表された場合は、その日の教室をすべてお休みとします。',
  },
  {
    date: '2026-08-25', category: 'class',
    title: '運動あそび教室に新しい遊具が加わりました',
    body: 'やわらかいマットとトンネルで、楽しく体を動かせます。',
  },
  {
    date: '2026-08-01', category: 'recruit',
    title: '指導ボランティアを募集しています',
    body: '資格がなくても大丈夫です。子どもたちと一緒に楽しめる方を歓迎します。',
  },
];

if (typeof module === 'object' && module.exports) {
  module.exports = { NEWS_CATEGORIES, NEWS_DATA };
}
