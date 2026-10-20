// 画面に差し込むHTML文字列を生成する純粋関数群（DOMには触れない）

// ブラウザでは先に読み込んだ各スクリプトのグローバル関数、Node.js では require で取得する
const tplDeps = typeof module === 'object' && module.exports
  ? { ...require('./news-logic.js'), ...require('./class-logic.js'), ...require('./form-validate.js') }
  : { formatDateJa, categoryLabel, classDisplayName, ageLabels, inquiryTypeLabel };

const HTML_ESCAPES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });

// HTML特殊文字をエスケープする
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

// ---- お知らせ ----

const newsItemHtml = (item, categories) => `
  <li class="news-item">
    <div class="news-item__meta">
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(tplDeps.formatDateJa(item.date))}</time>
      <span class="badge badge--${escapeHtml(item.category)}">${escapeHtml(tplDeps.categoryLabel(categories, item.category))}</span>
    </div>
    <h3 class="news-item__title">${escapeHtml(item.title)}</h3>
    <p class="news-item__body">${escapeHtml(item.body)}</p>
  </li>`;

const newsListHtml = (news, categories) =>
  news.length === 0
    ? '<li class="empty-message">該当するお知らせはありません。</li>'
    : news.map((item) => newsItemHtml(item, categories)).join('');

// ---- 絞り込みボタン ----

const filterButtonHtml = (option, activeId) => `
  <button type="button" class="filter-button" data-filter="${escapeHtml(option.id)}"
    aria-pressed="${option.id === activeId}">${escapeHtml(option.label)}</button>`;

const filterButtonsHtml = (options, activeId, allLabel) =>
  [{ id: 'all', label: allLabel }, ...options].map((option) => filterButtonHtml(option, activeId)).join('');

// ---- 教室 ----

const ageBadgesHtml = (ageGroups, ageIds) =>
  tplDeps.ageLabels(ageGroups, ageIds).map((label) => `<span class="badge badge--age">${escapeHtml(label)}</span>`).join('');

const classDetailsHtml = (item) => `
  <dl class="class-card__details">
    <div><dt>対象</dt><dd>${escapeHtml(item.target)}</dd></div>
    <div><dt>日時</dt><dd>${escapeHtml(item.schedule)}</dd></div>
    <div><dt>会場</dt><dd>${escapeHtml(item.place)}</dd></div>
    <div><dt>会費</dt><dd>${escapeHtml(item.fee)}（目安）</dd></div>
  </dl>`;

const classCardHtml = (item, ageGroups) => `
  <article class="class-card" id="${escapeHtml(item.id)}">
    <h3 class="class-card__title"><span class="class-card__icon" aria-hidden="true">${escapeHtml(item.icon)}</span>${escapeHtml(tplDeps.classDisplayName(item))}</h3>
    <div class="class-card__ages">${ageBadgesHtml(ageGroups, item.ages)}</div>
    <p class="class-card__summary">${escapeHtml(item.summary)}</p>
    ${classDetailsHtml(item)}
    <a class="button button--primary" href="./contact.html?type=trial&amp;class=${encodeURIComponent(item.id)}">この教室の体験を申し込む</a>
  </article>`;

const classListHtml = (classes, ageGroups) =>
  classes.length === 0
    ? '<p class="empty-message">該当する教室はありません。</p>'
    : classes.map((item) => classCardHtml(item, ageGroups)).join('');

const classHighlightHtml = (item) => `
  <li><a class="highlight-card" href="./classes.html#${encodeURIComponent(item.id)}">
    <span class="highlight-card__icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
    <span class="highlight-card__name">${escapeHtml(tplDeps.classDisplayName(item))}</span>
    <span class="highlight-card__target">${escapeHtml(item.target)}</span>
  </a></li>`;

// ---- フォーム ----

const classOptionsHtml = (classes, selectedId) =>
  ['<option value="">選択してください</option>', ...classes.map((item) =>
    `<option value="${escapeHtml(item.id)}"${item.id === selectedId ? ' selected' : ''}>${escapeHtml(tplDeps.classDisplayName(item))}</option>`)].join('');

const inquiryTypeRadiosHtml = (types, selectedId) =>
  types.map((type) => `
    <label class="choice"><input type="radio" name="inquiryType" value="${escapeHtml(type.id)}"${type.id === selectedId ? ' checked' : ''}>
    <span>${escapeHtml(type.label)}</span></label>`).join('');

// 送信内容の確認用 [項目名, 値] の配列を作る
const completionRows = (values, classes) => [
  ['種別', tplDeps.inquiryTypeLabel(values.inquiryType)],
  ['希望教室', tplDeps.classDisplayName(classes.find((item) => item.id === values.classId) ?? { name: '指定なし' })],
  ['お名前', values.name], ['メールアドレス', values.email],
  ['電話番号', values.tel || '未入力'], ['内容', values.message || '未入力'],
];

const completionTableHtml = (rows) =>
  `<dl class="summary-list">${rows.map(([label, value]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;

if (typeof module === 'object' && module.exports) {
  module.exports = {
    escapeHtml, newsListHtml, filterButtonsHtml, classCardHtml, classListHtml, classHighlightHtml,
    classOptionsHtml, inquiryTypeRadiosHtml, completionRows, completionTableHtml,
  };
}
