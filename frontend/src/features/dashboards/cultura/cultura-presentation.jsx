import { Children, cloneElement, createElement, isValidElement, useRef, useState } from 'react'

export const elementText = node => {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(elementText).join('')
  return elementText(node.props?.children)
}

const asElements = children => Children.toArray(children).filter(isValidElement)
const findTitle = nodes => {
  for (const node of asElements(nodes)) {
    if (node.type === 'h1') return elementText(node)
    const nested = findTitle(node.props.children)
    if (nested) return nested
  }
  return ''
}
const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const compact = value => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

// Read only values already formatted for the original chart's tooltips.
// No financial formula or dataset is recomputed in this presentation layer.
function chartPoints(panel) {
  const points = []
  function visit(node) {
    for (const child of asElements(node)) {
      const title = child.props.title
      if (typeof title === 'string' && /^\d{2}\/\d{4}/.test(title)) {
        const amounts = [...title.matchAll(/(-?)R\$\s*([\d.]+,\d{2})/g)]
          .map(match => (match[1] ? -1 : 1) * Number(match[2].replaceAll('.', '').replace(',', '.')))
        if (amounts.length) points.push({ month: title.slice(0, 7), amounts, title })
      } else visit(child.props.children)
    }
  }
  visit(panel)
  return points
}

function ExecutiveChart({ heading, points, paired }) {
  const [active, setActive] = useState(null)
  const values = points.flatMap(point => point.amounts)
  const rawMax = Math.max(0, ...values)
  const rawMin = Math.min(0, ...values)
  const magnitude = Math.max(Math.abs(rawMin), rawMax, 1)
  const step = 10 ** Math.floor(Math.log10(magnitude)) / 2
  const high = Math.max(step, Math.ceil(rawMax / step) * step)
  const low = Math.floor(rawMin / step) * step
  const width = 800, left = 72, right = 22, top = 24, bottom = 254
  const y = value => bottom - (value - low) / (high - low) * (bottom - top)
  const groupWidth = (width - left - right) / Math.max(points.length, 1)
  const barWidth = Math.min(paired ? 18 : 30, groupWidth / (paired ? 3 : 2))
  const ticks = Array.from({ length: 5 }, (_, i) => low + (high - low) * i / 4)
  return (
    <section className="cultura-executive-chart" data-chart-values={JSON.stringify(points)}>
      <header>{heading}<span className="cultura-chart-unit">Valores em R$</span></header>
      <div className="cultura-chart-legend">
        {paired ? <><span><i style={{ background: '#0f6fe8' }} />Receita Bruta</span><span><i style={{ background: '#93c5fd' }} />Custo Total (Variável + Fixo + Despesas)</span></> : <><span><i style={{ background: '#059669' }} />Lucro</span><span><i style={{ background: '#e11d48' }} />Prejuízo</span></>}
      </div>
      <div className="cultura-chart-canvas">
        <svg viewBox="0 0 800 292" role="img" aria-label={elementText(heading)}>
          {ticks.map((tick, index) => <g key={index}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#dbe4ef" strokeDasharray="3 5" />
            <text x={left - 12} y={y(tick) + 4} textAnchor="end" fill="#64748b" fontSize="11">{compact(tick)}</text>
          </g>)}
          <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="#94a3b8" />
          {points.map((point, index) => {
            const center = left + groupWidth * (index + .5)
            return <g key={point.month} tabIndex={0} aria-label={point.title}
              onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
              <title>{point.title}</title>
              <rect x={center - groupWidth / 2 + 2} y={top} width={Math.max(1, groupWidth - 4)} height={bottom - top} fill={active === index ? '#eff6ff' : 'transparent'} rx={6} />
              {point.amounts.map((value, series) => <rect key={series}
                x={center + (paired ? (series === 0 ? -barWidth - 2 : 2) : -barWidth / 2)}
                y={Math.min(y(value), y(0))} width={barWidth} height={Math.max(value === 0 ? 0 : 1, Math.abs(y(value) - y(0)))} rx={3}
                fill={paired ? (series === 0 ? '#0f6fe8' : '#93c5fd') : (value < 0 ? '#e11d48' : '#059669')} />)}
              <text x={center} y={278} textAnchor="middle" fill="#64748b" fontSize="12">{point.month.slice(0, 2)}</text>
            </g>
          })}
        </svg>
      </div>
      <div className="cultura-chart-detail" aria-live="polite">
        {!points[active] ? 'Passe o mouse ou use Tab para consultar os valores de cada mês.' : <><strong>{points[active].month}</strong>{points[active].amounts.map((value, index) => <span key={index}>{paired ? (index === 0 ? 'Receita: ' : 'Custo: ') : 'Resultado: '}{money(value)}</span>)}</>}
      </div>
    </section>
  )
}

export function arrangeCulturaContent(children) {
  const items = Children.toArray(children)
  const title = findTitle(items[0])
  if (!['Relatório Executivo', 'Alunos'].includes(title) || !items[1]?.props?.className?.includes('cultura-filters')) return children
  const metrics = items[2]
  const main = items.slice(3)
  if (title === 'Relatório Executivo') {
    for (let index = 0; index < main.length - 1; index++) {
      const text = elementText(main[index])
      if (main[index]?.type !== 'h2' || !['Tendência do Lucro Líquido', 'Receita vs. Custo Total — Evolução Mensal'].includes(text)) continue
      const points = chartPoints(main[index + 1])
      if (!points.length) continue
      main.splice(index, 2, <ExecutiveChart key={text} heading={main[index]} points={points} paired={text.startsWith('Receita')} />)
    }
  }
  return [items[0], items[1], <div key="sidebar-layout" className="cultura-analysis-layout">
    <aside className="cultura-indicator-rail" aria-label={`Indicadores de ${title}`}>{metrics}</aside>
    <div className="cultura-analysis-main">{main}</div>
  </div>]
}

export function isProfessorTable(children) {
  const head = asElements(children).find(child => child.type === 'thead')
  const row = asElements(head?.props.children)[0]
  return elementText(asElements(row?.props.children)[0]) === 'Professor'
}

// Width preferences live only in this mounted table. Changing a filter preserves
// existing columns by label; leaving the dashboard discards the preferences.
export function ResizableProfessorTable({ tableProps, children }) {
  const [widths, setWidths] = useState({})
  const drag = useRef(null)
  const sections = asElements(children)
  const head = sections.find(child => child.type === 'thead')
  const row = asElements(head.props.children)[0]
  const headers = asElements(row.props.children)
  const labels = headers.map(elementText)
  const defaults = labels.map((label, i) => i === 0 ? 300 : i === 1 ? 240 : i === 2 ? 360 : i === 3 ? 280 : Math.max(170, Math.min(320, label.length * 7 + 40)))
  const current = labels.map((label, i) => widths[label] ?? defaults[i])
  const resize = (index, width) => setWidths(previous => ({ ...previous, [labels[index]]: Math.max(100, Math.min(1400, Math.round(width))) }))
  const decorate = section => cloneElement(section, {}, Children.map(section.props.children, tr => {
    if (!isValidElement(tr) || tr.type !== 'tr') return tr
    return cloneElement(tr, {}, Children.toArray(tr.props.children).map((cell, index) => {
      if (!isValidElement(cell)) return cell
      if (cell.type !== 'th') return cloneElement(cell, { title: cell.props.title || elementText(cell) })
      return cloneElement(cell, { title: elementText(cell), style: { ...cell.props.style, width: current[index] } },
        cell.props.children,
        <span key="resize" role="separator" tabIndex={0} aria-orientation="vertical"
          aria-label={`Largura da coluna ${labels[index]}`} aria-valuemin={100} aria-valuemax={1400} aria-valuenow={current[index]}
          className="cultura-column-resizer" title="Arraste para ajustar. Use as setas ou dê dois cliques para restaurar."
          onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); drag.current = { x: event.clientX, width: current[index], index }; event.currentTarget.setPointerCapture(event.pointerId) }}
          onPointerMove={event => { if (drag.current?.index === index) resize(index, drag.current.width + event.clientX - drag.current.x) }}
          onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
          onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
          onClick={event => event.stopPropagation()} onDoubleClick={() => resize(index, defaults[index])}
          onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); resize(index, event.key === 'Home' ? defaults[index] : current[index] + (event.key === 'ArrowRight' ? 20 : -20)) } }} />)
    }))
  }))
  return createElement('table', { ...tableProps, className: `${tableProps.className || ''} cultura-resizable-table`, style: { ...tableProps.style, width: current.reduce((sum, width) => sum + width, 0), tableLayout: 'fixed' } },
    <colgroup>{labels.map((label, index) => <col key={label} style={{ width: current[index] }} />)}</colgroup>,
    sections.map(decorate))
}
