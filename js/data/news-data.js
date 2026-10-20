// お知らせデータ（内容はすべて架空のダミー）
const NEWS_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'info', label: 'お知らせ' }),
  Object.freeze({ id: 'event', label: 'イベント' }),
  Object.freeze({ id: 'class', label: '教室情報' }),
  Object.freeze({ id: 'recruit', label: '募集' }),
]);

const NEWS_DATA = Object.freeze([
  Object.freeze({
    id: 'n-2026-10-15', date: '2026-10-15', category: 'event',
    title: '秋のスポーツフェスタを開催します',
    body: '11月3日（祝）にさくら町スポーツセンターで、どなたでも参加できる体験会を行います。',
  }),
  Object.freeze({
    id: 'n-2026-10-01', date: '2026-10-01', category: 'recruit',
    title: '高齢者向け筋力アップ教室の新規会員を募集しています',
    body: '椅子に座ったままできる運動が中心です。運動が久しぶりの方も安心してご参加ください。',
  }),
  Object.freeze({
    id: 'n-2026-09-20', date: '2026-09-20', category: 'class',
    title: '陸上教室②の練習時間が変わります',
    body: '10月から火曜日コース・木曜日コースとも、練習時間を18:30〜19:30に変更します。',
  }),
  Object.freeze({
    id: 'n-2026-09-05', date: '2026-09-05', category: 'info',
    title: '台風接近時の教室開催について',
    body: '警報が発表された場合は、その日の教室をすべてお休みとします。',
  }),
  Object.freeze({
    id: 'n-2026-08-25', date: '2026-08-25', category: 'class',
    title: '運動あそび教室に新しい遊具が加わりました',
    body: 'やわらかいマットとトンネルで、楽しく体を動かせます。',
  }),
  Object.freeze({
    id: 'n-2026-08-01', date: '2026-08-01', category: 'recruit',
    title: '指導ボランティアを募集しています',
    body: '資格がなくても大丈夫です。子どもたちと一緒に楽しめる方を歓迎します。',
  }),
]);

if (typeof module === 'object' && module.exports) {
  module.exports = { NEWS_CATEGORIES, NEWS_DATA };
}
