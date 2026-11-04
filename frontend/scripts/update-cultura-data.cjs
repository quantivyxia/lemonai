const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {parse} = require('@babel/parser');
// Parse literals only: never execute scripts from the supplied HTML.
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node frontend/scripts/update-cultura-data.cjs <private HTML path> [--check]');
const root = path.resolve(__dirname, '../..');
const target = path.join(root, 'backend/apps/dashboards/private_data/cultura_inglesa.json');
const current = JSON.parse(fs.readFileSync(target, 'utf8'));
const scripts = [...fs.readFileSync(sourcePath, 'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const source = scripts.find(script => /\bconst EMBEDDED_DATA\b/.test(script));
assert.ok(source, 'HTML dashboard data script not found');
function literal(node) {
  if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(node.type)) return node.value;
  if (node.type === 'NullLiteral') return null;
  if (node.type === 'UnaryExpression' && node.operator === '-') return -literal(node.argument);
  if (node.type === 'ArrayExpression') return node.elements.map(literal);
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(prop => {
    assert.ok(prop.type === 'ObjectProperty' && !prop.computed);
    return [prop.key.name ?? prop.key.value, literal(prop.value)];
  }));
  throw new Error('Expected literal data');
}
// Only existing record sets, dictionaries, metadata and aggregates are updated.
// Rules, formula classifications, labels and rendering code remain unchanged.
const keys = [
  'DRE_L', 'CLASSIF_L', 'CONTA_L', 'FILIAL_L', 'DATA_L', 'EMBEDDED_ROWS', 'EMBEDDED_META',
  'FILIAL_META', 'GRUPO_FILIAL_OPTIONS',
  'ALUNOS_FILIAL_L', 'ALUNOS_FORIG_L', 'ALUNOS_DATA_L', 'ALUNOS_ROWS',
  'SGC_FILIAL_L', 'SGC_CLASSIF_L', 'SGC_CONTA_L', 'SGC_DATA_L', 'SGC_ROWS',
  'CURSOS_FILIAL_L', 'CURSOS_DATA_L', 'CURSOS_FM_ROWS', 'CURSOS_RANKING', 'TURMAS_RANKING',
  'TURMAS_FILIAL_L', 'TURMAS_CURSO_L', 'TURMAS_SEM_L', 'TURMAS_ROWS',
  'CURSOS_POR_FILIAL_ANO', 'CURSOS_REDE_POR_MES', 'CURSOS_REDE_ANO',
];
const extracted = {};
for (const statement of parse(source).program.body) {
  if (statement.type !== 'VariableDeclaration') continue;
  for (const declaration of statement.declarations) {
    if (keys.includes(declaration.id.name)) extracted[declaration.id.name] = literal(declaration.init);
  }
}
assert.deepEqual(Object.keys(extracted).sort(), [...keys].sort(), 'Missing required data');
assert.ok(extracted.EMBEDDED_ROWS.length > 0, 'Empty accounting data');
const updated = {...current, ...extracted};
if (process.argv.includes('--check')) {
  for (const key of keys) assert.deepEqual(current[key], extracted[key], `Data mismatch: ${key}`);
  console.log('All existing data sets match the supplied HTML exactly.');
} else {
  fs.writeFileSync(target, JSON.stringify(updated));
  console.log(`Updated ${keys.length} data sets; ${updated.EMBEDDED_ROWS.length} accounting rows. Existing rules preserved.`);
}
