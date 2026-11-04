import { useEffect, useRef, useState } from 'react'
import './login-animation.css'

const initial = Array.from({ length: 40 }, (_, i) => 55 + Math.sin(i / 4) * 8)
const coordinates = (values: number[]) => values.map((y, i) => `${i / 39 * 100},${100 - y}`).join(' ')
const caption = 'Dados organizados.\nIndicadores conectados.\nUma visão mais clara.\nDecisões reais.'

export const LoginAnimation = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<SVGPolylineElement>(null)
  const areaRef = useRef<SVGPolygonElement>(null)
  const barsRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLPreElement>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const panel = canvas?.closest<HTMLElement>('.lemon-login-brand')
    const ctx = canvas?.getContext('2d')
    if (!canvas || !panel || !ctx) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const desktop = matchMedia('(min-width: 1024px)')
    let frame = 0, width = 0, height = 0, last = 0, elapsed = 0, chartTick = 0, barTick = 0
    let points: { x: number; y: number; vx: number; vy: number }[] = []
    let values = [...initial]
    const mouse = { x: -9999, y: -9999 }
    const tilt = { x: 0, y: 0 }
    function paint(move = false) {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      points.forEach((a, i) => {
        if (move) { a.x += a.vx; a.y += a.vy }
        if (a.x < 0 || a.x > width) a.vx *= -1
        if (a.y < 0 || a.y > height) a.vy *= -1
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j], distance = Math.hypot(a.x - b.x, a.y - b.y)
          if (distance >= 130) continue
          ctx.strokeStyle = `rgba(150,180,255,${(1 - distance / 130) * .35})`
          ctx.lineWidth = .6
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
        const distance = Math.hypot(a.x - mouse.x, a.y - mouse.y)
        if (distance < 180) {
          ctx.strokeStyle = `rgba(255,220,90,${(1 - distance / 180) * .5})`
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke()
        }
        ctx.fillStyle = 'rgba(190,210,255,.7)'
        ctx.beginPath(); ctx.arc(a.x, a.y, 1.4, 0, Math.PI * 2); ctx.fill()
      })
    }
    const canAnimate = () => !paused && !motion.matches && desktop.matches && !document.hidden
    function tick(now: number) {
      if (!canAnimate()) { frame = 0; return }
      frame = requestAnimationFrame(tick)
      if (now - last < 32) return
      elapsed += Math.min(now - (last || now), 64); last = now
      paint(true)
      const targetX = mouse.x < 0 ? 0 : (mouse.x / width - .5) * 2
      const targetY = mouse.y < 0 ? 0 : (mouse.y / height - .5) * 2
      tilt.x += (targetX - tilt.x) * .06; tilt.y += (targetY - tilt.y) * .06
      if (stackRef.current) stackRef.current.style.transform = `rotateX(${10 - tilt.y * 8}deg) rotateY(${-16 + tilt.x * 12 + Math.sin(elapsed / 2600) * 3}deg)`
      if (elapsed - chartTick > 600) {
        chartTick = elapsed
        values = [...values.slice(1), Math.max(25, Math.min(80, values[39] + (Math.random() - .48) * 9))]
        lineRef.current?.setAttribute('points', coordinates(values))
        areaRef.current?.setAttribute('points', `0,100 ${coordinates(values)} 100,100`)
      }
      if (elapsed - barTick > 1500) {
        barTick = elapsed
        barsRef.current?.querySelectorAll<HTMLElement>('span').forEach(bar => { bar.style.height = `${25 + Math.random() * 65}%` })
      }
      if (textRef.current) textRef.current.textContent = caption.slice(0, Math.floor(elapsed / 65) % (caption.length + 50))
    }
    function sync() {
      cancelAnimationFrame(frame); frame = 0; last = 0
      panel?.classList.toggle('login-motion-paused', !canAnimate())
      if (canAnimate()) frame = requestAnimationFrame(tick)
      else { paint(); if (textRef.current) textRef.current.textContent = caption }
    }
    function resize() {
      if (!canvas || !panel || !ctx) return
      width = panel.clientWidth; height = panel.clientHeight
      const dpr = Math.min(devicePixelRatio || 1, 2)
      canvas.width = width * dpr; canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      points = Array.from({ length: Math.min(80, Math.round(width * height / 9000)) }, () => ({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5 }))
      paint(); sync()
    }
    const pointer = (event: PointerEvent) => { const rect = panel.getBoundingClientRect(); mouse.x = event.clientX - rect.left; mouse.y = event.clientY - rect.top }
    const leave = () => { mouse.x = -9999; mouse.y = -9999 }
    const observer = new ResizeObserver(resize)
    observer.observe(panel)
    panel.addEventListener('pointermove', pointer); panel.addEventListener('pointerleave', leave)
    motion.addEventListener('change', sync); desktop.addEventListener('change', sync); document.addEventListener('visibilitychange', sync)
    return () => {
      cancelAnimationFrame(frame); observer.disconnect()
      panel.removeEventListener('pointermove', pointer); panel.removeEventListener('pointerleave', leave)
      motion.removeEventListener('change', sync); desktop.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync)
    }
  }, [paused])

  return <>
    <canvas className="login-network" ref={canvasRef} aria-hidden="true" />
    <div className="login-art">
      <div className="login-art-scene" aria-hidden="true">
        <div className="login-art-glow" />
        <div className="login-art-stack" ref={stackRef}>
          <div className="login-glass login-art-revenue"><span className="login-art-label">VISÃO DOS INDICADORES</span><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="login-art-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f5c518" stopOpacity=".45" /><stop offset="1" stopColor="#f5c518" stopOpacity="0" /></linearGradient></defs>{[25, 50, 75].map(y => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#ffffff14" vectorEffect="non-scaling-stroke" />)}<polygon ref={areaRef} points={`0,100 ${coordinates(initial)} 100,100`} fill="url(#login-art-gradient)" /><polyline ref={lineRef} points={coordinates(initial)} fill="none" stroke="#f5c518" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><div className="login-art-shimmer" /></div>
          <div className="login-glass login-art-indicators"><span className="login-art-label">INDICADORES</span><div className="login-art-ring" /></div>
          <div className="login-glass login-art-branches"><span className="login-art-label">COMPARATIVOS</span><div className="login-art-bars" ref={barsRef}>{[80, 62, 30, 68, 50, 32, 28, 86].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div></div>
          <div className="login-glass login-art-code"><pre ref={textRef}>{caption}</pre><span className="login-art-caret" /></div>
        </div>
      </div>
      <div className="login-art-caption"><span>Ilustração de dashboards</span><button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Retomar animação' : 'Pausar animação'}</button></div>
    </div>
  </>
}
