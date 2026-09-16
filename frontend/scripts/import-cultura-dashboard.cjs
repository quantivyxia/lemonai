// Reproducible adaptation: original calculations stay unchanged; data is private.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parse } = require('@babel/parser');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'dre-contabil-viewer/dre-contabil-viewer.jsx'), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const dataset = {};
const edits = [];

function literal(node) {
  if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(node.type)) return node.value;
  if (node.type === 'NullLiteral') return null;
  if (node.type === 'UnaryExpression' && node.operator === '-') return -literal(node.argument);
  if (node.type === 'ArrayExpression') return node.elements.map(literal);
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(p => {
    if (p.type !== 'ObjectProperty' || p.computed) throw new Error('Not a literal');
    return [p.key.name ?? p.key.value, literal(p.value)];
  }));
  throw new Error('Not a literal');
}

const theme = {
  NAVY: '#0f172a', RED: '#0f6fe8', CREAM: '#f5f7fb', CARD: '#ffffff',
  LINE: '#d8e0e9', INK: '#0f172a', MUTED: '#64748b',
  SERIF: 'Sora, sans-serif', SANS: 'Manrope, sans-serif',
};
for (const statement of ast.program.body) {
  if (statement.type !== 'VariableDeclaration') continue;
  for (const decl of statement.declarations) {
    const name = decl.id.name;
    if (name in theme) {
      edits.push({ start: decl.init.start, end: decl.init.end, text: JSON.stringify(theme[name]) });
    } else if (decl.init && ['ArrayExpression', 'ObjectExpression'].includes(decl.init.type)) {
      let value;
      try { value = literal(decl.init); } catch { continue; }
      // Empty mutable lookup dictionaries must remain per-instance, not dataset entries.
      if (!Array.isArray(value) && Object.keys(value).length === 0) continue;
      dataset[name] = value;
      edits.push({ start: decl.init.start, end: decl.init.end, text: `dataset.${name}` });
    }
  }
}
let adapted = source;
for (const edit of edits.sort((a, b) => b.start - a.start)) {
  adapted = adapted.slice(0, edit.start) + edit.text + adapted.slice(edit.end);
}
const importEnd = ast.program.body.filter(n => n.type === 'ImportDeclaration').at(-1).end;
adapted = adapted.slice(0, importEnd) + '\n\nexport function createCulturaDashboard(dataset) {\n' + adapted.slice(importEnd);
adapted = adapted.replace('export default function App()', 'function App()');
adapted += '\nreturn App;\n}\n';
adapted = 'import { CulturaStatCard as StatCard } from "./cultura-stat-card";\n' + adapted;

const targetDir = path.join(root, 'frontend/src/features/dashboards/cultura');
const dataDir = path.join(root, 'backend/apps/dashboards/private_data');
const target = path.join(targetDir, 'cultura-viewer.jsx');
const dataTarget = path.join(dataDir, 'cultura_inglesa.json');
if (process.argv.includes('--check')) {
  assert.equal(fs.readFileSync(target, 'utf8'), adapted, 'Viewer changed beyond data extraction and theme tokens');
  assert.deepEqual(JSON.parse(fs.readFileSync(dataTarget, 'utf8')), dataset, 'Dataset differs from supplied original');
  console.log(`Original preserved: ${Object.keys(dataset).length} datasets/configurations; calculation and JSX bodies unchanged.`);
} else {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(target, adapted);
  fs.writeFileSync(dataTarget, JSON.stringify(dataset));
  console.log(`Adapted viewer and ${Object.keys(dataset).length} private datasets/configurations created.`);
}
