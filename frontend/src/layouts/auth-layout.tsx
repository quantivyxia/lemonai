import { useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'

const DOT_SPACING = 48
const DOT_RADIUS = 1.8
const DOT_COLOR = 'rgba(255,255,255,0.55)'
const LINE_COLOR = 'rgba(255,255,255,0.08)'
const MAX_CONNECT_DIST = 110
const WAVE_AMPLITUDE = 6
const WAVE_SPEED = 0.0008

function useMeshCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    type Dot = { baseX: number; baseY: number; phaseX: number; phaseY: number; speedX: number; speedY: number }
    let dots: Dot[] = []
    let animId: number

    const buildDots = (w: number, h: number) => {
      dots = []
      const cols = Math.ceil(w / DOT_SPACING) + 2
      const rows = Math.ceil(h / DOT_SPACING) + 2
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            baseX: c * DOT_SPACING,
            baseY: r * DOT_SPACING,
            phaseX: Math.random() * Math.PI * 2,
            phaseY: Math.random() * Math.PI * 2,
            speedX: 0.4 + Math.random() * 0.4,
            speedY: 0.4 + Math.random() * 0.4,
          })
        }
      }
    }

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      buildDots(canvas.width, canvas.height)
    }

    const draw = (ts: number) => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const t = ts * WAVE_SPEED

      const positions = dots.map(d => ({
        x: d.baseX + Math.sin(t * d.speedX + d.phaseX) * WAVE_AMPLITUDE,
        y: d.baseY + Math.sin(t * d.speedY + d.phaseY) * WAVE_AMPLITUDE,
      }))

      ctx.strokeStyle = LINE_COLOR
      ctx.lineWidth = 0.8
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dx = positions[i].x - positions[j].x
          const dy = positions[i].y - positions[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < MAX_CONNECT_DIST) {
            ctx.globalAlpha = (1 - dist / MAX_CONNECT_DIST) * 0.35
            ctx.beginPath()
            ctx.moveTo(positions[i].x, positions[i].y)
            ctx.lineTo(positions[j].x, positions[j].y)
            ctx.stroke()
          }
        }
      }

      ctx.globalAlpha = 1
      ctx.fillStyle = DOT_COLOR
      for (const p of positions) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [canvasRef])
}

export const AuthLayout = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useMeshCanvas(canvasRef)

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="relative hidden lg:flex lg:w-[58%] flex-col overflow-hidden bg-gradient-to-br from-[#0d2a5e] via-[#1a3f7a] to-[#0d2a5e]">
        {/* Animated mesh canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* Glow blobs */}
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-16 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="LemonAI" className="h-9 w-9" />
            <span className="font-display text-2xl font-bold tracking-tight text-white">LemonAI</span>
          </div>

          {/* Main content */}
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="font-display mb-5 text-5xl font-bold leading-[1.12] text-white">
              Dados que geram
              <br />
              <span className="text-yellow-300">decisões reais.</span>
            </h1>

            <p className="mb-12 max-w-sm text-base leading-relaxed text-blue-200/80">
              Dashboards inteligentes com governança, segurança avançada e Row-Level Security
              integrados para toda a sua empresa.
            </p>

            {/* Feature list */}
            <div className="space-y-4">
              {[
                { icon: '📊', label: 'Dashboards Power BI embarcados em tempo real' },
                { icon: '🔒', label: 'Controle de acesso por usuário, grupo e função' },
                { icon: '🏢', label: 'Multi-tenant com isolamento e auditoria completos' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-base">
                    {item.icon}
                  </div>
                  <span className="text-sm text-blue-100/90">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-blue-500">
            © {new Date().getFullYear()} LemonAI · Todos os direitos reservados
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-white p-8 sm:p-12">
        <Outlet />
      </div>
    </div>
  )
}
