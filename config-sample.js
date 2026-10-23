// config.js のひな形（このファイル自体はダミー値のみ）
// 使い方：このファイルを config.js という名前でコピーし、値を書き換える。
// config.js は .gitignore 対象のため、実名を書いてもリポジトリには含まれない。
// 指定しなかった項目は js/default-config.js のダミー値が使われる。
const SITE_CONFIG = {
  clubName: 'サンプル総合型地域スポーツクラブ',
  address: '架空県サンプル市1-1-1',
  tel: '000-111-2222',
  telHours: '受付：月〜金 10:00〜16:00',
  // GAS の Webアプリの URL は js/default-config.js に設定済み（GitHub Pages では config.js が配信されないため）
  // 手元だけ別の GAS で試すときは、次の行のコメントを外して URL を書く（仮の値のままにすると送信・取得しなくなる）
  // newsEndpoint: 'YOUR_GAS_WEB_APP_URL',
};
