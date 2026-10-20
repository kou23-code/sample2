// 画面に差し込むHTML文字列を生成する純粋関数群（DOMには触れない）

// ブラウザでは先に読み込んだ各スクリプトのグローバル関数、Node.js では require で取得する
const tplDeps = typeof module === 'object' && module.exports
  ? { ...require('./news-logic.js'), ...require('./class-logic.js'), ...require('./form-validate.js') }
  : {
    formatDateJa, categoryLabel, classDisplayName, ageLabels, inquiryTypeLabel,
    classMainRows, classFeeRows, sessionRows, sessionHeading, classTargetSummary, hasMultipleSessions,
    feeSystemRows, insuranceTitle, insuranceRows, insuranceRangeText,
  };

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

// [項目名, 値] の配列を定義リストにする
const detailRowsHtml = (rows, modifier) => `
  <dl class="class-card__details${modifier ? ` class-card__details--${modifier}` : ''}">${rows.map(([label, value]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;

const sessionHtml = (session) => `
  <li class="class-session">
    <p class="class-session__title">${escapeHtml(tplDeps.sessionHeading(session))}</p>
    ${detailRowsHtml(tplDeps.sessionRows(session), 'session')}
  </li>`;

// 複数クラスに分かれる教室だけ、クラスごとの時間・定員を並べる
const sessionsHtml = (item) =>
  tplDeps.hasMultipleSessions(item)
    ? `<ul class="class-card__sessions" aria-label="クラス別の時間・定員">${item.sessions.map(sessionHtml).join('')}</ul>` : '';

const classCardHtml = (item, ageGroups) => `
  <article class="class-card" id="${escapeHtml(item.id)}">
    <h3 class="class-card__title"><span class="class-card__icon" aria-hidden="true">${escapeHtml(item.icon)}</span>${escapeHtml(tplDeps.classDisplayName(item))}</h3>
    <div class="class-card__ages">${ageBadgesHtml(ageGroups, item.ages)}</div>
    <p class="class-card__summary">${escapeHtml(item.summary)}</p>
    ${detailRowsHtml(tplDeps.classMainRows(item))}${sessionsHtml(item)}${detailRowsHtml(tplDeps.classFeeRows(item), 'fee')}
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
    <span class="highlight-card__target">${escapeHtml(tplDeps.classTargetSummary(item))}／${escapeHtml(item.day)}</span>
  </a></li>`;

// ---- 会費システム（全教室共通） ----

const feeTermsHtml = (terms) => `
  <ol class="fee-terms" aria-label="4つの期">${terms.map((term) => `
    <li><span class="fee-terms__label">${escapeHtml(term.label)}</span><span class="fee-terms__months">${escapeHtml(term.months)}</span></li>`).join('')}
  </ol>`;

// 見出しはページ側に置き、ここでは期の一覧と説明の定義リストを返す
const feeSystemHtml = (feeSystem) => `
  ${feeTermsHtml(feeSystem.terms)}
  <dl class="fee-system__rows">${tplDeps.feeSystemRows(feeSystem).map(([label, value]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;

// ---- スポーツ安全保険（開閉式の小さな料金表） ----

const insuranceTableHtml = (insurance) => `
  <table class="mini-table">
    <thead><tr><th scope="col">区分</th><th scope="col">料金</th></tr></thead>
    <tbody>${tplDeps.insuranceRows(insurance).map(([label, price]) =>
      `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(price)}</td></tr>`).join('')}</tbody>
  </table>`;

// 閉じた状態では料金の幅だけを見せ、開くと区分ごとの料金表を表示する
const insuranceHtml = (insurance) => `
  <details class="insurance">
    <summary><span class="insurance__range">${escapeHtml(tplDeps.insuranceRangeText(insurance))}</span><span class="insurance__toggle">区分ごとの料金を見る</span></summary>
    ${insuranceTableHtml(insurance)}
    <p class="insurance__note">${escapeHtml(insurance.note)}</p>
  </details>`;

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

// ---- 案内文 ----

const resultCountText = (count, unit) => `${count}${unit}を表示しています。`;

const errorSummaryText = (count) =>
  count === 0 ? '' : `入力内容に${count}件の確認事項があります。赤字の説明をご確認ください。`;

if (typeof module === 'object' && module.exports) {
  module.exports = {
    escapeHtml, newsListHtml, filterButtonsHtml, classCardHtml, classListHtml, classHighlightHtml, feeSystemHtml, insuranceHtml,
    classOptionsHtml, inquiryTypeRadiosHtml, completionRows, completionTableHtml,
    resultCountText, errorSummaryText,
  };
}
