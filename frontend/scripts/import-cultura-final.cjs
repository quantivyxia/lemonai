const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {parse} = require('@babel/parser');
const root = path.resolve(__dirname, '../..');
const input = process.argv[2];
assert.ok(input, 'Usage: node frontend/scripts/import-cultura-final.cjs <private HTML> [--check]');
const scripts = [...fs.readFileSync(input, 'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const source = scripts.find(s => /\bconst EMBEDDED_DATA\b/.test(s));
assert.ok(source, 'Dashboard script not found');
function literal(n) {
  if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(n.type)) return n.value;
  if (n.type === 'NullLiteral') return null;
  if (n.type === 'UnaryExpression' && n.operator === '-') return -literal(n.argument);
  if (n.type === 'ArrayExpression') return n.elements.map(literal);
  if (n.type === 'ObjectExpression') return Object.fromEntries(n.properties.map(p => {
    assert.ok(p.type === 'ObjectProperty' && !p.computed);
    return [p.key.name ?? p.key.value, literal(p.value)];
  }));
  throw new Error('Not a static literal');
}
const theme = {NAVY:'#0f172a', RED:'#0f6fe8', CREAM:'#f5f7fb', CARD:'#ffffff', LINE:'#d8e0e9', INK:'#0f172a', MUTED:'#64748b', SERIF:'Sora, sans-serif', MONO:'Manrope, sans-serif', SANS:'Manrope, sans-serif'};
const dataset = {}, edits = [];
for (const statement of parse(source).program.body) {
  if (statement.type !== 'VariableDeclaration') continue;
  for (const decl of statement.declarations) {
    const name = decl.id.name;
    if (name in theme) edits.push({start:decl.init.start,end:decl.init.end,text:JSON.stringify(theme[name])});
    else {
      let value;
      try { value = literal(decl.init); } catch { continue; }
      if (value && typeof value === 'object' && !Object.keys(value).length) continue;
      dataset[name] = value;
      edits.push({start:decl.init.start,end:decl.init.end,text:`dataset.${name}`});
    }
  }
}
assert.ok(dataset.SGC_DETALHADO_ROWS.length && dataset.SGC_PESSOA_L.length && dataset.DRE_BI_DATA.length);
let adapted = source;
for (const e of edits.sort((a,b)=>b.start-a.start)) adapted=adapted.slice(0,e.start)+e.text+adapted.slice(e.end);
// Only replace the renderer and theme. All functions and calculations remain verbatim.
adapted = `import ReactRuntime, {useState, useMemo, useRef, useCallback, useEffect} from 'react';
import * as XLSX from 'xlsx';
import {ChevronRight, ChevronDown, UploadCloud, RotateCcw, Info, FileSpreadsheet, X, AlertTriangle} from 'lucide-react';
import {culturaElement} from './cultura-element';
export function createCulturaDashboard(dataset) {
const React = {...ReactRuntime, createElement: culturaElement};
` + adapted + '\nreturn App;\n}\n';
const viewer = path.join(root,'frontend/src/features/dashboards/cultura/cultura-final.jsx');
const data = path.join(root,'backend/apps/dashboards/private_data/cultura_final.json');
if (process.argv.includes('--check')) {
  assert.equal(fs.readFileSync(viewer,'utf8'), adapted);
  assert.deepEqual(JSON.parse(fs.readFileSync(data,'utf8')), dataset);
  console.log('Final HTML verified: all static data identical, calculation bodies unchanged.');
} else {
  fs.writeFileSync(viewer,adapted);fs.writeFileSync(data,JSON.stringify(dataset));
  console.log(`Final viewer generated: ${Object.keys(dataset).length} private data/config entries; ${dataset.EMBEDDED_ROWS.length} accounting rows.`);
}
