// 設定のマージ・整形を行う純粋関数群

// 上書き値として採用できるか（空でない文字列のみ許可）
const isUsableOverride = (value) => typeof value === 'string' && value.trim() !== '';

// ダミー設定に存在するキーだけを上書きし、新しいオブジェクトを返す
const mergeConfig = (defaults, overrides) =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(defaults).map(([key, value]) => [
        key,
        isUsableOverride(overrides?.[key]) ? overrides[key].trim() : value,
      ]),
    ),
  );

// 電話番号表記から tel: リンク用の値を生成する
const toTelHref = (tel) => `tel:${String(tel).replace(/[^0-9+]/g, '')}`;

// ページ名とクラブ名からタイトルを組み立てる
const buildPageTitle = (pageName, clubName) =>
  pageName ? `${pageName}｜${clubName}` : clubName;

if (typeof module === 'object' && module.exports) {
  module.exports = { isUsableOverride, mergeConfig, toTelHref, buildPageTitle };
}
