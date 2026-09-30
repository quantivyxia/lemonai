import { createElement } from 'react'
import {
  Activity, BarChart3, BookOpen, Briefcase, ClipboardCheck, ClipboardList, FileSpreadsheet, GitCompareArrows,
  GraduationCap, Landmark, Layers, Percent, PiggyBank, Presentation, Receipt, School, SlidersHorizontal,
  Ticket, TrendingDown, TrendingUp, Trophy, UserCheck, Users, Wallet,
} from 'lucide-react'

const SERIF = 'Sora, sans-serif'
const NAVY = '#0f172a'
const BLUE = '#0f6fe8'

const viewIcons = {
  'Relatório Executivo': Presentation, 'DRE Contábil': FileSpreadsheet, 'DRE Rateio': BarChart3,
  'Comparativo de Filial': GitCompareArrows, Alunos: Users, Turmas: School, 'Cursos e Turmas': BookOpen,
  Professores: GraduationCap, 'Validações DRE': ClipboardCheck, 'Ligar/Desligar Regras': SlidersHorizontal,
}

// KPI icon chosen from the label text only; first match wins.
const kpiIcons = [
  [/margem|%|encargos/i, Percent], [/ticket/i, Ticket], [/ebitda/i, Activity],
  [/lucro|resultado/i, PiggyBank], [/receita/i, TrendingUp], [/custo|despesa/i, TrendingDown],
  [/professor/i, GraduationCap], [/aluno/i, Users], [/turma/i, School], [/curso/i, BookOpen],
  [/matr[ií]cula/i, ClipboardList], [/cargo/i, Briefcase], [/filia/i, Landmark], [/maior|top/i, Trophy],
  [/valor|total/i, Wallet], [/linha|conta/i, Receipt], [/pessoa|ativo/i, UserCheck],
]
const kpiIcon = label => kpiIcons.find(([pattern]) => pattern.test(label))?.[1] || Layers

// Legacy palette -> Lemon palette. Only presentation colours; values are untouched.
const palette = {
  '#1b6b3c': '#059669', '#b3273e': '#e11d48', '#1f8a70': '#059669', '#eef7f1': '#ecfdf5',
  '#8a6d00': '#1d4ed8', '#5c4a00': '#1e3a8a', '#fff6da': '#f3f8ff', '#e9cd6e': '#cfe1fb', '#fcfbf3': '#f8fbff',
  '#8a6d3b': '#93c5fd', '#eeece6': '#eef2f7', '#fcfbf9': '#f8fafc', '#f4f1ea': '#f8fafc', '#f4f3ef': '#f1f5f9',
  '#fbfaf7': '#f8fafc', '#fafaf8': '#f8fafc', '#f3f3f3': '#f1f5f9', '#d9d9d9': '#cbd5e1', '#1f2a44': NAVY,
  '#eef1f6': '#f1f5f9', '#b7b7b7': '#94a3b8',
}
// Data marks (bars, stacked segments, legend swatches) use a blue series scale.
const series = {
  [NAVY]: BLUE, [BLUE]: '#7cb3f7', '#8a6d00': '#1e4fae', '#8a6d3b': '#93c5fd',
}
const recolor = value => typeof value === 'string'
  ? value.replace(/#[0-9a-f]{6}\b/gi, hex => palette[hex.toLowerCase()] || hex)
  : value
const isPct = value => typeof value === 'string' && value.endsWith('%')
const textOf = node => typeof node === 'string' || typeof node === 'number'
  ? String(node)
  : Array.isArray(node) ? node.map(textOf).join('') : ''
const iconChip = (Icon, className, key) => createElement(
  'span', { className, 'aria-hidden': true, key }, createElement(Icon, { size: 18, strokeWidth: 2 }),
)

// Adapt presentation at the React element boundary. Props, events, children and
// all financial computations from the supplied HTML are otherwise preserved.
export function culturaElement(type, props, ...children) {
  if (typeof type !== 'string') return createElement(type, props, ...children)
  // SVG sparkline marks carry colours as attributes rather than styles.
  if (props && (props.fill || props.stroke) && ['path', 'circle'].includes(type)) {
    props = { ...props }
    if (props.fill === '#EEECE6') { props.fill = BLUE; props.fillOpacity = 0.08 }
    if (props.fill === NAVY) { props.fill = '#fff'; props.stroke = BLUE; props.strokeWidth = 2 }
    if (props.stroke === NAVY) { props.stroke = BLUE; props.strokeWidth = '2.25'; props.strokeLinejoin = 'round' }
  }
  if (!props?.style) return createElement(type, props, ...children)
  const style = { ...props.style }
  const classes = [props.className].filter(Boolean)
  const next = { ...props, style }
  const add = name => classes.push(name)
  const omit = (...keys) => keys.forEach(key => delete style[key])
  const bg = typeof style.background === 'string' ? style.background.toLowerCase() : null
  const white = bg === '#ffffff' || bg === '#fff'

  // Data marks: percentage-sized bars/segments and small legend swatches.
  const swatch = typeof style.width === 'number' && typeof style.height === 'number' && style.width <= 12 && style.height <= 12
  const bar = type === 'div' && bg && ((isPct(style.width) && (style.height === '100%' || !style.height)) || isPct(style.height))
  if ((bar || swatch) && bg) {
    if (series[bg]) style.background = series[bg]
    // Revenue x cost columns and their legend: blue scale instead of green/red.
    if ((style.width === 9 || (swatch && style.width === 10)) && bg === '#1b6b3c') style.background = BLUE
    if ((style.width === 9 || (swatch && style.width === 10)) && bg === '#b3273e') style.background = '#93c5fd'
    if (bar) add('cultura-mark')
  }

  if (type === 'div') {
    if (style.minHeight === '100%' && typeof style.background === 'string' && style.background.toLowerCase() === '#f5f7fb') {
      add('cultura-view'); omit('background')
    }
    if (style.maxWidth && style.margin === '0 auto' && ['28px 20px 60px', '20px 20px 0'].includes(style.padding)) {
      add('cultura-content'); omit('maxWidth', 'margin', 'padding')
    }
    if (style.height === 6 && String(style.background).includes('linear-gradient')) style.display = 'none'
    if (style.padding === '10px 20px 0' && style.borderBottom) {
      add('cultura-navigation'); omit('padding', 'borderBottom', 'background', 'gap', 'flexWrap', 'display')
      next.role = 'group'; next['aria-label'] = 'Visões do dashboard Cultura Inglesa'
    }
    // View header: eyebrow + h1 + description on the left, actions on the right.
    if (style.display === 'flex' && style.justifyContent === 'space-between' && children.some(child => child?.props?.children && [].concat(child.props.children).some(c => c?.type === 'h1'))) {
      add('cultura-header'); omit('marginBottom', 'alignItems', 'gap')
    }
    if (style.letterSpacing === 1.6 && style.textTransform === 'uppercase') {
      add('cultura-eyebrow'); omit('fontSize', 'letterSpacing', 'color')
    }
    // Filter bar: label/control pairs laid out as an even grid.
    if (style.display === 'flex' && white && style.border && typeof style.padding === 'string' && style.padding.startsWith('14px')) {
      add('cultura-filters'); omit('padding', 'gap', 'alignItems', 'border', 'borderRadius', 'background', 'display', 'flexWrap')
    }
    // Rule toggle rows and bar value labels.
    if (style.justifyContent === 'space-between' && style.borderTop && style.padding === '16px 0') add('cultura-toggle-row')
    if (style.textAlign === 'right' && style.flexShrink === 0 && typeof style.width === 'number' && style.width >= 60 && style.width < 96) {
      style.width = 96; style.whiteSpace = 'nowrap'
    }
    if (style.marginLeft === 'auto' && style.fontSize === 11) { add('cultura-filter-note'); omit('marginLeft') }
    // Multi-select / searchable combo wrappers fill their grid cell.
    if (style.position === 'relative' && (style.display === 'inline-block' || style.display === 'inline-flex') && children.some(child => child?.type === 'button')) {
      add('cultura-control')
    }
    // Notices (info / warning / error boxes).
    if (style.display === 'flex' && style.gap === 8 && style.borderRadius === 8 && typeof style.border === 'string' && style.padding === '10px 12px') {
      add('cultura-notice')
    }
    // KPI cards: a white bordered card whose second line is a large Sora value.
    const valueChild = children.find(child => child?.props?.style?.fontFamily === SERIF && typeof child.props.style.fontSize === 'number' && child.props.style.fontSize >= 17)
    const labelChild = children[0]
    if (valueChild && style.border && (white || style.position === 'relative' || style.flex) && labelChild?.type === 'div') {
      add('cultura-kpi')
      const Icon = kpiIcon(textOf(labelChild.props.children))
      children = [iconChip(Icon, 'cultura-kpi-icon', 'kpi-icon'), ...children]
    } else if (style.border && style.borderRadius && white) add('cultura-panel')
    const isKpi = child => child?.props?.className?.includes('cultura-kpi') || (typeof child?.type === 'function' && child.props && 'label' in child.props && ('valor' in child.props || 'value' in child.props))
    if (style.display === 'flex' && children.flat().filter(isKpi).length >= 2) {
      add('cultura-kpi-grid'); omit('display', 'gap', 'flexWrap')
    }
    if (children.some(child => child?.type === 'table')) add('cultura-table-shell')
    if (style.display === 'flex' && children.some(child => child?.props?.className?.includes('cultura-metrics-rail'))) {
      add('cultura-metrics-layout'); omit('display', 'gap')
    }
    if (style.width === 230 && style.flexDirection === 'column') {
      add('cultura-metrics-rail'); omit('width', 'display', 'flexDirection', 'gap')
    }
    // Uppercase group captions inside cards ("Resultado financeiro", etc.).
    if (style.textTransform === 'uppercase' && style.fontSize === 11 && style.fontWeight === 700 && !style.letterSpacing?.toString().startsWith('1.6')) {
      add('cultura-caption')
    }
    if (style.flexDirection === 'column' && style.justifyContent === 'flex-end' && style.height === '100%') add('cultura-column')
  }

  if (type === 'h1') {
    const Icon = viewIcons[textOf(children)] || ClipboardCheck
    add('cultura-title'); omit('fontSize', 'fontWeight', 'margin', 'color')
    return createElement(type, { ...next, className: classes.join(' ') },
      iconChip(Icon, 'cultura-title-icon', 'title-icon'), createElement('span', { key: 'title' }, ...children))
  }
  if ((type === 'h2' || type === 'h3') && style.fontFamily === SERIF) {
    add('cultura-heading'); omit('fontSize', 'color')
  }
  if (type === 'p' && style.color && style.maxWidth) add('cultura-description')

  if (type === 'span' && style.textTransform === 'uppercase' && style.marginRight === 6) {
    add('cultura-filter-label'); omit('fontSize', 'textTransform', 'letterSpacing', 'marginRight', 'color', 'fontWeight')
  }
  // Rule status pills.
  if (type === 'span' && style.borderRadius === 999 && style.padding === '5px 10px') {
    add('cultura-pill'); omit('background', 'color', 'padding', 'fontSize')
  }
  // Account chips on the rules view.
  if (type === 'span' && style.padding === '3px 7px' && style.borderRadius === 5) {
    add('cultura-chip')
    if (bg === '#fbeaec') { style.background = '#eef5ff' }
  }
  if (type === 'select') { add('cultura-select'); omit('minWidth', 'padding', 'borderRadius', 'border', 'background', 'fontSize') }
  if (type === 'input' && style.padding && props.type !== 'checkbox' && props.type !== 'file') add('cultura-input')

  if (type === 'button') {
    if (style.borderBottom && style.borderRadius === '8px 8px 0 0') {
      add('cultura-nav-button'); next['aria-pressed'] = !String(style.borderBottom).includes('transparent')
      omit('padding', 'borderRadius', 'border', 'borderBottom', 'background', 'color', 'fontSize', 'fontWeight', 'fontFamily')
      const Icon = viewIcons[children[0]]
      if (Icon) children = [iconChip(Icon, 'cultura-nav-icon', 'icon'), createElement('span', { key: 'label' }, ...children)]
    } else if (style.fontSize === 12.5 && style.fontWeight && style.borderRadius === 7) {
      add('cultura-subnav-button'); next['aria-pressed'] = style.fontWeight === 700
      omit('background', 'color', 'border', 'borderRadius', 'padding', 'fontWeight')
    } else if (style.width === 44 && style.height === 24 && style.borderRadius === 999) {
      add('cultura-switch'); next['aria-pressed'] = bg !== '#d9d9d9'; omit('background')
    } else if (style.padding && !style.width && !style.display) {
      // Action buttons: filled for the primary (blue/navy) ones, outline otherwise.
      const filled = bg === BLUE || bg === NAVY
      add(filled ? 'cultura-btn-primary' : 'cultura-btn')
      style.display = 'inline-flex'; style.alignItems = 'center'; style.justifyContent = 'center'; style.gap = 6
      if (filled) omit('background', 'color', 'border')
    }
  }

  for (const key of Object.keys(style)) style[key] = recolor(style[key])
  next.className = classes.join(' ') || undefined
  return createElement(type, next, ...children)
}
