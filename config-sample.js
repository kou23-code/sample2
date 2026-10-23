// config.js のひな形（このファイル自体はダミー値のみ）
// 使い方：このファイルを config.js という名前でコピーし、値を書き換える。
// config.js は .gitignore 対象のため、実名を書いてもリポジトリには含まれない。
// 指定しなかった項目は js/default-config.js のダミー値が使われる。
const SITE_CONFIG = {
  clubName: 'サンプル総合型地域スポーツクラブ',
  address: '架空県サンプル市1-1-1',
  tel: '000-111-2222',
  telHours: '受付：月〜金 10:00〜16:00',
  // GAS の Webアプリの URL に置き換える（手順は gas/README.md）。仮の値のままなら取得しない
  // 問い合わせフォームも、この URL の GAS へ送信される（別の送信先を使う場合だけ formEndpoint を追加する）
  newsEndpoint: 'YOUR_GAS_WEB_APP_URL',
};
