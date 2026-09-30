import { createElement } from 'react'
import { FileSpreadsheet, BarChart3, GitCompareArrows, Users, GraduationCap, BookOpen, SlidersHorizontal, ClipboardCheck, Presentation } from 'lucide-react'

const icons = {
  'DRE Contábil': FileSpreadsheet, 'DRE Rateio': BarChart3,
  'Comparativo de Filial': GitCompareArrows, Alunos: Users, Turmas: GraduationCap,
  'Cursos e Turmas': BookOpen, 'Ligar/Desligar Regras': SlidersHorizontal,
  Professores: GraduationCap, 'Validações DRE': ClipboardCheck, 'Relatório Executivo': Presentation,
}

// Adapt presentation at the React element boundary. Props, events, children and
// all financial computations from the supplied HTML are otherwise preserved.
export function culturaElement(type, props, ...children) {
  if (typeof type !== 'string' || !props?.style) return createElement(type, props, ...children)
  const style = { ...props.style }
  const classes = [props.className].filter(Boolean)
  const next = { ...props, style }
  const add = name => classes.push(name)
  const omit = (...keys) => keys.forEach(key => delete style[key])
  if (type === 'div') {
    if (style.minHeight === '100%' && style.background === '#f5f7fb') {
      add('cultura-view'); omit('background')
    }
    if (style.maxWidth && style.margin === '0 auto' && ['28px 20px 60px', '20px 20px 0'].includes(style.padding)) {
      add('cultura-content'); omit('maxWidth', 'margin', 'padding')
    }
    if (style.height === 6 && String(style.background).includes('linear-gradient')) style.display = 'none'
    if (style.padding === '10px 20px 0' && style.borderBottom) {
      add('cultura-navigation'); omit('padding', 'borderBottom', 'background', 'gap', 'flexWrap')
      next.role = 'group'; next['aria-label'] = 'Visões do dashboard Cultura Inglesa'
    }
    if (style.padding === '14px 18px' && style.border && style.display === 'flex') {
      add('cultura-filters'); omit('padding', 'gap', 'alignItems', 'border', 'borderRadius', 'background')
    }
    if (style.letterSpacing === 1.6 && style.textTransform === 'uppercase') {
      add('cultura-eyebrow'); omit('fontSize', 'letterSpacing', 'color')
    }
    if (style.border && style.borderRadius && (style.background === '#ffffff' || style.background === '#fff')) add('cultura-panel')
    if (children.some(child => child?.type === 'table')) add('cultura-table-shell')
    if (style.display === 'flex' && children.some(child => child?.props?.className?.includes('cultura-metrics-rail'))) {
      add('cultura-metrics-layout'); omit('display', 'gap')
    }
    if (style.width === 230 && style.flexDirection === 'column') {
      add('cultura-metrics-rail'); omit('width', 'display', 'flexDirection', 'gap')
    }
    if ((style.position === 'relative' || style.flex) && style.border && children.some(child => child?.props?.style?.fontFamily === 'Sora, sans-serif')) add('cultura-metric')
  }
  if (type === 'span' && style.textTransform === 'uppercase' && style.marginRight === 6) {
    add('cultura-filter-label'); omit('fontSize', 'textTransform', 'letterSpacing', 'marginRight')
  }
  if (type === 'button' && style.borderBottom && style.borderRadius === '8px 8px 0 0') {
    add('cultura-nav-button'); next['aria-pressed'] = !String(style.borderBottom).includes('transparent')
    omit('padding', 'borderRadius', 'border', 'borderBottom', 'background', 'color', 'fontSize', 'fontWeight')
    const Icon = icons[children[0]]
    if (Icon) children.unshift(createElement(Icon, { size: 16, 'aria-hidden': true, key: 'icon' }))
  }
  if (type === 'button' && style.padding && !style.width && !style.display) {
    style.display = 'inline-flex'; style.alignItems = 'center'; style.justifyContent = 'center'; style.gap = 6
  }
  if (type === 'button' && style.fontSize === 12.5 && style.fontWeight && style.borderRadius === 7) {
    add('cultura-subnav-button'); next['aria-pressed'] = style.fontWeight === 700
    omit('background', 'color', 'border'); style.borderRadius = 10
  }
  if (style.background === '#EEECE6') style.background = '#edf2f7'
  if (style.background === '#FCFBF9') style.background = '#f8fafc'
  next.className = classes.join(' ') || undefined
  return createElement(type, next, ...children)
}
