// 公開用ダミー設定（実在の名称・個人情報は記載しないこと）
// 実名表示が必要な場合は .gitignore 対象の ./config.js で SITE_CONFIG を定義して上書きする
const DEFAULT_CONFIG = Object.freeze({
  clubName: 'あおぞら総合型地域スポーツクラブ',
  clubShortName: 'あおぞらクラブ',
  address: '架空県みどり市さくら町1-2-3',
  tel: '000-000-0000',
  telHours: '受付：火〜土 9:00〜17:00',
  access: '架空鉄道みどり線「さくら町駅」から徒歩約10分',
  venue: 'さくら町スポーツセンター（架空）',
  copyrightYear: '2026',
  // 問い合わせフォームの送信先。空なら newsEndpoint の GAS へ送り、どちらも無ければ送信せず完了表示のみ行う（デモ）
  formEndpoint: '',
  // お知らせの取得先・問い合わせの送信先（GAS の Webアプリの URL。末尾が /exec）。空の場合は js/data/news-data.js を表示する
  // config.js は .gitignore 対象で GitHub Pages には載らないため、公開サイトで使う URL はここに書く
  // （この URL はブラウザから誰でも見える値で、個人情報・秘密情報ではない。再デプロイで「新しいデプロイ」を作ると URL が変わるので注意）
  newsEndpoint: 'https://script.google.com/macros/s/AKfycbwqv_FRcYhobQh7V60vETonitQFXkpZLbFWfGgyx69abnaOky9GSOosjdHjnIIr9hG1/exec',
});

if (typeof module === 'object' && module.exports) {
  module.exports = { DEFAULT_CONFIG };
}
