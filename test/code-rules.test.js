// コーディング規約（1関数10行以下・let/var 不使用）の簡易チェック
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SOURCE_DIRS = ['js', 'gas', 'test'];
const MAX_FUNCTION_LINES = 10;

const listJsFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? listJsFiles(path.join(dir, entry.name))
    : entry.name.endsWith('.js') ? [path.join(dir, entry.name)] : []);

const sourceFiles = SOURCE_DIRS.flatMap((dir) => listJsFiles(path.join(ROOT, dir)));

// トップレベルの文ごとに分割する（閉じ括弧以外で始まるインデントなしの行で区切る）
const topLevelBlocks = (source) => source.split(/\r?\n(?=[^\s})\]])/);
// GAS の doGet など、function 宣言が必須の関数も対象にする
const isFunctionBlock = (block) => /^(const \w+ = (async )?(\([^)]*\)|\w+) =>|function \w+\s*\()/.test(block);
const countCodeLines = (block) => block.split(/\r?\n/).filter((line) => line.trim() !== '').length;

sourceFiles.forEach((file) => {
  const relative = path.relative(ROOT, file);
  const source = fs.readFileSync(file, 'utf8');

  test(`${relative}：関数は${MAX_FUNCTION_LINES}行以下`, () => {
    topLevelBlocks(source).filter(isFunctionBlock).forEach((block) =>
      assert.ok(countCodeLines(block) <= MAX_FUNCTION_LINES, `${block.split('\n')[0]} が${countCodeLines(block)}行`));
  });

  test(`${relative}：let / var を使っていない`, () => {
    assert.doesNotMatch(source, /(^|[\s;(])(let|var)\s+[\w{[]/m);
  });
});
