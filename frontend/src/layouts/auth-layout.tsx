import { BarChart3, Building2, ShieldCheck } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'

const DOT_SPACING = 56
const MAX_CONNECT_DIST = 132
const DOT_RADIUS_MIN = 1.2
const DOT_RADIUS_MAX = 2.2
const DOT_COLOR_BASE = 0.36
const DOT_COLOR_GLOW = 0.28
const LINE_ALPHA = 0.18
const DRIFT_SCALE = 11
const PULSE_SCALE = 1.6

type Dot = {
  ampX: number
  ampY: number
  baseX: number
  baseY: number
  flowSeed: number
  phaseX: number
  phaseY: number
  pulseSeed: number
  radius: number
  speedX: number
  speedY: number
  zoneX: number
  zoneY: number
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function useMeshCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dots: Dot[] = []
    let animationId = 0

    const buildDots = (width: number, height: number) => {
      dots = []
      const cols = Math.ceil(width / DOT_SPACING) + 3
      const rows = Math.ceil(height / DOT_SPACING) + 3

      for (let row = -1; row < rows; row += 1) {
        for (let col = -1; col < cols; col += 1) {
          const xJitter = randomBetween(-10, 10) + (row % 2 === 0 ? randomBetween(-4, 4) : randomBetween(-8, 8))
          const yJitter = randomBetween(-9, 9)

          dots.push({
            baseX: col * DOT_SPACING + xJitter,
            baseY: row * DOT_SPACING + yJitter,
            ampX: randomBetween(3, 10),
            ampY: randomBetween(3, 11),
            phaseX: randomBetween(0, Math.PI * 2),
            phaseY: randomBetween(0, Math.PI * 2),
            speedX: randomBetween(0.00022, 0.00074),
            speedY: randomBetween(0.00018, 0.00066),
            flowSeed: randomBetween(0, Math.PI * 2),
            pulseSeed: randomBetween(0, Math.PI * 2),
            radius: randomBetween(DOT_RADIUS_MIN, DOT_RADIUS_MAX),
            zoneX: randomBetween(0.55, 1.35),
            zoneY: randomBetween(0.55, 1.35),
          })
        }
      }
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildDots(canvas.offsetWidth, canvas.offsetHeight)
    }

    const getPosition = (dot: Dot, time: number) => {
      const localWaveX =
        Math.sin(time * dot.speedX + dot.phaseX) * dot.ampX +
        Math.cos(time * dot.speedY * 0.8 + dot.flowSeed) * (dot.ampX * 0.65)

      const localWaveY =
        Math.cos(time * dot.speedY + dot.phaseY) * dot.ampY +
        Math.sin(time * dot.speedX * 0.9 + dot.flowSeed * 1.2) * (dot.ampY * 0.6)

      const zoneDriftX =
        Math.sin(dot.baseY * 0.008 + time * 0.00012 * dot.zoneY) * DRIFT_SCALE +
        Math.cos(dot.baseX * 0.005 + time * 0.00009) * 4

      const zoneDriftY =
        Math.cos(dot.baseX * 0.007 + time * 0.00011 * dot.zoneX) * DRIFT_SCALE +
        Math.sin(dot.baseY * 0.004 + time * 0.00007) * 4

      const pulse = (Math.sin(time * 0.0011 + dot.pulseSeed) + 1) * 0.5

      return {
        x: dot.baseX + localWaveX + zoneDriftX,
        y: dot.baseY + localWaveY + zoneDriftY,
        radius: dot.radius + pulse * PULSE_SCALE * 0.18,
        glow: pulse,
      }
    }

    const draw = (time: number) => {
      const width = canvas.offsetWidth
      const height = canvas.offsetHeight
      ctx.clearRect(0, 0, width, height)

      const positions = dots.map((dot) => getPosition(dot, time))

      ctx.lineWidth = 0.85
      for (let i = 0; i < positions.length; i += 1) {
        const a = positions[i]
        for (let j = i + 1; j < positions.length; j += 1) {
          const b = positions[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)

          if (dist > MAX_CONNECT_DIST) continue

          const strength = 1 - dist / MAX_CONNECT_DIST
          const alpha = strength * LINE_ALPHA
          ctx.strokeStyle = `rgba(190, 225, 255, ${alpha})`
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      for (const point of positions) {
        ctx.beginPath()
        ctx.fillStyle = `rgba(255,255,255,${DOT_COLOR_BASE + point.glow * DOT_COLOR_GLOW})`
        ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2)
        ctx.fill()

        if (point.glow > 0.92) {
          ctx.beginPath()
          ctx.fillStyle = `rgba(255,216,77,${(point.glow - 0.92) * 1.4})`
          ctx.arc(point.x, point.y, point.radius + 1.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      animationId = window.requestAnimationFrame(draw)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    animationId = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(animationId)
      observer.disconnect()
    }
  }, [canvasRef])
}

const featureItems = [
  {
    icon: BarChart3,
    label: 'Dashboards Power BI embarcados em tempo real',
  },
  {
    icon: ShieldCheck,
    label: 'Controle de acesso por usuario, grupo e funcao',
  },
  {
    icon: Building2,
    label: 'Multi-tenant com isolamento e auditoria completos',
  },
]

export const AuthLayout = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useMeshCanvas(canvasRef)

  return (
    <div className="flex min-h-screen">
      <div
        className="relative hidden overflow-hidden lg:flex lg:w-[58%] lg:flex-col"
        style={{
          backgroundImage:
            'radial-gradient(circle at 82% 18%, rgba(126, 205, 255, 0.15), transparent 28%), radial-gradient(circle at 18% 84%, rgba(52, 119, 255, 0.16), transparent 30%), linear-gradient(135deg, #081a3c 0%, #0d2a5e 28%, #14366f 62%, #102b5f 100%)',
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-screen"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08) 0, transparent 1px), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.07) 0, transparent 1px), radial-gradient(circle at 35% 75%, rgba(255,255,255,0.06) 0, transparent 1px)',
            backgroundSize: '160px 160px, 220px 220px, 260px 260px',
          }}
        />

        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-16 h-64 w-64 rounded-full bg-yellow-300/10 blur-3xl" />
        <div className="pointer-events-none absolute left-[38%] top-[18%] h-56 w-56 rounded-full bg-sky-300/10 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col p-12">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="LemonAI" className="h-9 w-9" />
            <span className="font-display text-2xl font-bold tracking-tight text-white">LemonAI</span>
          </div>

          <div className="flex flex-1 flex-col justify-center">
            <h1 className="font-display mb-5 text-5xl font-bold leading-[1.08] tracking-[-0.04em] text-white">
              Dados que geram
              <br />
              <span className="text-yellow-300">decisoes reais.</span>
            </h1>

            <p className="mb-12 max-w-sm text-base leading-relaxed text-white/95">
              Dashboards inteligentes com governanca, seguranca avancada e Row-Level Security integrados para toda a sua
              empresa.
            </p>

            <div className="space-y-4">
              {featureItems.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-sm text-white/95">{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-xs text-blue-100/50">(c) {new Date().getFullYear()} LemonAI · Todos os direitos reservados</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white p-8 sm:p-12">
        <Outlet />
      </div>
    </div>
  )
}
