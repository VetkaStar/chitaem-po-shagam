import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const root = postcss.parse(fs.readFileSync('app/globals.css', 'utf8'));
const groups = new Map();
root.walkRules((rule) => {
  const context = [];
  for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent)
    context.unshift(parent.type === 'atrule' ? `@${parent.name} ${parent.params}` : parent.selector);
  const key = context.join('|') + '|' + rule.selector;
  const group = groups.get(key) ?? [];
  group.push(rule);
  groups.set(key, group);
});
const repeated = [...groups].filter(([, rules]) => rules.length > 1).map(([selector, rules]) => ({
  selector, lines: rules.map((rule) => rule.source.start.line),
  exact: rules.every((rule) => rule.nodes.map(String).join(';') === rules[0].nodes.map(String).join(';')),
}));
const inline = [], cssFiles = [], cssImports = [], duplicateDeclarations = [];
const scan = (directory) => {
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { scan(file); continue; }
    if (file.endsWith('.css')) cssFiles.push(file.replaceAll('\\', '/'));
    if (!/\.[jt]sx?$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier.text.endsWith('.css')) cssImports.push(file.replaceAll('\\', '/'));
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(source);
        if (tag === 'style' || (/^[a-z]/.test(tag) && node.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(source) === 'style'))) inline.push(file);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
};
for (const directory of ['app', 'components', 'features', 'static-entry']) scan(directory);
root.walkRules((rule) => {
  const seen = new Set();
  for (const node of rule.nodes) {
    if (node.type !== 'decl') continue;
    const key = `${node.prop}:${node.value}:${!!node.important}`;
    if (seen.has(key)) duplicateDeclarations.push({selector:rule.selector, line:node.source.start.line, key});
    seen.add(key);
  }
});
const report = { cssFiles, cssImports, inline, repeated, duplicateDeclarations };
console.log(JSON.stringify(report, null, 2));
assert.deepEqual(cssFiles, ['app/globals.css']);
assert.deepEqual(cssImports, ['static-entry/main.tsx']);
assert.deepEqual(inline, [], 'native inline styles must stay in globals.css');
assert.deepEqual(repeated.filter((rule) => rule.exact), [], 'identical repeated CSS rules');
assert.deepEqual(duplicateDeclarations, [], 'identical declarations in one rule');
