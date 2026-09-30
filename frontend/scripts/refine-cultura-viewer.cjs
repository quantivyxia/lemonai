const assert = require('node:assert/strict');

// Presentation-only changes applied after extracting the private dataset.
// Keep this separate from the original viewer's calculations and event handlers.
module.exports = function refineCulturaViewer(source) {
  function replace(from, to) {
    assert.ok(source.includes(from), `Presentation anchor missing: ${from.slice(0, 80)}`);
    source = source.split(from).join(to);
  }
  replace('ChevronRight, ChevronDown, UploadCloud, RotateCcw, Info, FileSpreadsheet,', 'ChevronRight, ChevronDown, UploadCloud, RotateCcw, Info, FileSpreadsheet,\n  BarChart3, GitCompareArrows, Users, GraduationCap, BookOpen, SlidersHorizontal,');
  replace(`const MONO = '\"IBM Plex Mono\", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';`, 'const MONO = "Manrope, sans-serif";');
  replace('<div style={{ minHeight: "100%", background: CREAM, fontFamily: SANS, color: INK }}>', '<div className="cultura-view">');
  source = source.replace(/<div style=\{\{ maxWidth: \d+, margin: "0 auto", padding: "28px 20px 60px" \}\}>/g, '<div className="cultura-content">');
  replace('<div style={{ height: 6, background: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY} 60%, ${RED} 100%)` }} />', '');
  replace('<div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: RED, textTransform: "uppercase" }}>', '<div className="cultura-eyebrow">');
  replace('<div style={{ marginBottom: 20 }}>\n          <div className="cultura-eyebrow">', '<div className="cultura-section-header">\n          <div className="cultura-eyebrow">');
  replace('<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>', '<div className="cultura-section-header cultura-section-header-actions">');
  source = source.replace(/<div style=\{\{ display: "flex", gap: 20, alignItems: "center", (?:flexWrap: "wrap", )?background: CARD, border: `1px solid \$\{LINE\}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 \}\}>/g, '<div className="cultura-filters">');
  replace('<span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 0.4, textTransform: "uppercase", marginRight: 6 }}>', '<span className="cultura-filter-label">');
  replace('<div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: 22, ...style }}>', '<div className="cultura-card" style={style}>');
  replace('<div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>', '<div className="cultura-table-shell">');
  replace('<div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, overflow: "auto", maxWidth: "100%" }}>', '<div className="cultura-table-shell">');
  // This side-by-side chart layout needs a dedicated stacking breakpoint.
  replace('<div style={{ display: "flex", gap: 20 }}>\n          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 230, flexShrink: 0 }}>', '<div className="cultura-metrics-layout">\n          <div className="cultura-metrics-rail">');
  replace('const CardLat = ({ id, label, valor, cor, calculo }) => (\n    <div', 'const CardLat = ({ id, label, valor, cor, calculo }) => (\n    <div className="cultura-metric"');
  replace('const CardMini = ({ id, label, valor, cor, calculo }) => (\n    <div', 'const CardMini = ({ id, label, valor, cor, calculo }) => (\n    <div className="cultura-metric"');
  replace('  const tabBtn = (id, label) => (', '  const tabIcons = { contabil: FileSpreadsheet, rateio: BarChart3, comparativo: GitCompareArrows, alunos: Users, turmas: GraduationCap, cursos: BookOpen, toggles: SlidersHorizontal };\n  const tabBtn = (id, label) => {\n    const Icon = tabIcons[id];\n    return (');
  const start = source.indexOf('  const tabBtn =');
  const end = source.indexOf('  return (\n    <div style={{ minHeight: "100%", background: CREAM }}>', start);
  assert.ok(end > start);
  source = source.slice(0, start) + source.slice(start, end).replace(/      style=\{\{[\s\S]*?\}\}/, '      className="cultura-nav-button"\n      aria-pressed={tab === id}').replace('      {label}', '      <Icon size={16} aria-hidden="true" />\n      {label}').replace('  );', '  );\n  };') + source.slice(end);
  replace('<div style={{ minHeight: "100%", background: CREAM }}>', '<div className="cultura-workspace">');
  replace('<div style={{ display: "flex", gap: 4, padding: "10px 20px 0", background: CREAM, borderBottom: `1px solid ${LINE}`, flexWrap: "wrap" }}>', '<div className="cultura-navigation" role="group" aria-label="Visões do dashboard Cultura Inglesa">');
  // Chart colors share the application palette; positive/negative colors stay semantic.
  replace('corBarra={NAVY}', 'corBarra={RED}');
  replace('corBarra="#8A6D00"', 'corBarra="#0d9488"');
  replace('stroke={NAVY} strokeWidth="2"', 'stroke={RED} strokeWidth="2"');
  replace('fill={hover === i ? RED : NAVY}', 'fill={hover === i ? NAVY : RED}');
  replace('#EEECE6', '#edf2f7');
  replace('#FCFBF9', '#f8fafc');
  // Surface classes for existing metric groups and chart panels.
  source = source.replace(/<div style=\{\{ (flex: "[^"\n]+", )?background: CARD, border: `1px solid \$\{LINE\}`, borderRadius: (10|12),/g, '<div className="cultura-panel" style={{ $1background: CARD, border: `1px solid $' + '{LINE}`, borderRadius: $2,');
  return source;
};
