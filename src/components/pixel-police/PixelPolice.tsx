import { useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

type Point = { x: number; y: number }

interface Measurement {
  id: number
  a: Point
  b: Point
}

const SNAP_RADIUS = 25
const INDICATOR_RADIUS = 50

const Canvas = styled.canvas<{ $active: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 100;
  pointer-events: none;
  visibility: ${({ $active }) => ($active ? 'visible' : 'hidden')};
  background: linear-gradient(to right, rgba(124, 92, 255, 0.4), rgba(255, 92, 124, 0.6));
  backdrop-filter: blur(2px);
`

const WidgetContainer = styled.div`
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: all;
  min-width: 220px;
`

const ToggleHeader = styled.button`
  background: transparent;
  border: none;
  width: 100%;
  padding: 12px 24px;
  color: black;
  font-size: 14px;
  font-weight: 900;
  font-style: italic;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  line-height: 1;
  transition: background 0.1s;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  &:active {
    background: rgba(0, 0, 0, 0.1);
  }
`


const MeasurementList = styled.div`
  border-top: 1px solid #eaeaea;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 250px;
  overflow-y: auto;
`

const MeasurementItem = styled.div`
  font-family: ${({ theme }) => theme.fonts.mono}, monospace;
  font-size: 12px;
  color: #333;
`

function drawMeasurementLine(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  isDraft: boolean
) {
  const dist = Math.round(Math.hypot(b.x - a.x, b.y - a.y))
  const mid: Point = {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }

  const lineColour = isDraft
    ? 'rgba(124,92,255,0.65)'
    : '#7c5cff'

  const labelColour = isDraft
    ? 'rgba(56,217,201,0.8)'
    : '#38d9c9'

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.strokeStyle = lineColour
  ctx.lineWidth = 1.5

  if (isDraft) ctx.setLineDash([6, 4])

  ctx.stroke()
  ctx.setLineDash([])

  const angle = Math.atan2(b.y - a.y, b.x - a.x)
  const perp = angle + Math.PI / 2
  const tick = 7

  for (const pt of [a, b]) {
    ctx.beginPath()
    ctx.moveTo(
      pt.x + Math.cos(perp) * tick,
      pt.y + Math.sin(perp) * tick
    )
    ctx.lineTo(
      pt.x - Math.cos(perp) * tick,
      pt.y - Math.sin(perp) * tick
    )
    ctx.strokeStyle = lineColour
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  for (const pt of [a, b]) {
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = lineColour
    ctx.fill()
  }

  ctx.restore()

  ctx.save()
  ctx.font = 'bold 11px "JetBrains Mono", ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'

  const label = `${dist}px`
  const textW = ctx.measureText(label).width
  const padX = 7
  const padY = 4
  const boxW = textW + padX * 2
  const boxH = 19
  const boxX = mid.x - boxW / 2
  const boxY = mid.y - boxH - 5

  ctx.fillStyle = 'rgba(15,17,21,0.9)'
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxW, boxH, 4)
  ctx.fill()

  ctx.strokeStyle = isDraft
    ? 'rgba(124,92,255,0.35)'
    : 'rgba(124,92,255,0.6)'

  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxW, boxH, 4)
  ctx.stroke()

  ctx.fillStyle = labelColour
  ctx.fillText(label, mid.x, boxY + boxH - padY + 1)
  ctx.restore()
}

function drawCornerIndicator(
  ctx: CanvasRenderingContext2D,
  corner: Point,
  isSnapTarget: boolean
) {
  const colour = isSnapTarget
    ? '#38d9c9'
    : 'rgba(56,217,201,0.5)'

  const squareHalf = isSnapTarget ? 8 : 5
  const dotRadius = isSnapTarget ? 3 : 2

  ctx.save()
  ctx.beginPath()
  ctx.strokeStyle = colour
  ctx.lineWidth = isSnapTarget ? 1.5 : 1

  ctx.strokeRect(
    corner.x - squareHalf,
    corner.y - squareHalf,
    squareHalf * 2,
    squareHalf * 2
  )

  ctx.beginPath()
  ctx.arc(
    corner.x,
    corner.y,
    dotRadius,
    0,
    Math.PI * 2
  )

  ctx.fillStyle = colour
  ctx.fill()
  ctx.restore()
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  measurements: Measurement[],
  pendingAnchor: Point | null,
  cursor: Point,
  snappableCorners: Point[],
  snapTarget: Point | null
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  for (const m of measurements) {
    drawMeasurementLine(ctx, m.a, m.b, false)
  }

  if (pendingAnchor) {
    const endpoint = snapTarget ?? cursor
    drawMeasurementLine(ctx, pendingAnchor, endpoint, true)
  }

  for (const corner of snappableCorners) {
    const isSnap =
      snapTarget &&
      Math.abs(corner.x - snapTarget.x) < 0.5 &&
      Math.abs(corner.y - snapTarget.y) < 0.5

    if (!isSnap) {
      drawCornerIndicator(ctx, corner, false)
    }
  }

  if (snapTarget) {
    drawCornerIndicator(ctx, snapTarget, true)
  }
}

function computeSnapState(cursor: Point) {
  const snappableCorners: Point[] = []
  let snapTarget: Point | null = null
  let snapDist = Infinity

  for (const el of document.querySelectorAll('*')) {
    if (el.closest('[data-pixel-police]')) continue

    const rect = el.getBoundingClientRect()

    if (rect.width === 0 || rect.height === 0) continue

    if (
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.top > window.innerHeight
    ) {
      continue
    }

    const corners: Point[] = [
      { x: rect.left, y: rect.top },
      { x: rect.right, y: rect.top },
      { x: rect.left, y: rect.bottom },
      { x: rect.right, y: rect.bottom },
    ]

    let nearest: Point | null = null
    let nearestDist = Infinity

    for (const corner of corners) {
      const d = Math.hypot(
        corner.x - cursor.x,
        corner.y - cursor.y
      )

      if (
        d <= INDICATOR_RADIUS &&
        d < nearestDist
      ) {
        nearestDist = d
        nearest = corner
      }
    }

    if (nearest) {
      snappableCorners.push(nearest)

      if (
        nearestDist <= SNAP_RADIUS &&
        nearestDist < snapDist
      ) {
        snapDist = nearestDist
        snapTarget = nearest
      }
    }
  }

  return {
    snappableCorners,
    snapTarget,
  }
}

export function PixelPolice() {
  const [active, setActive] = useState(false)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [pendingAnchor, setPendingAnchor] = useState<Point | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const cursorRef = useRef<Point>({ x: 0, y: 0 })

  // Ref for rAF to access latest state without closures
  const stateRef = useRef({ measurements, pendingAnchor })
  stateRef.current = { measurements, pendingAnchor }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const setSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    setSize()
    window.addEventListener('resize', setSize)

    return () => window.removeEventListener('resize', setSize)
  }, [])

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current)
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!ctx) return

    const tick = () => {
      const { measurements, pendingAnchor } = stateRef.current
      const cursor = cursorRef.current
      const { snappableCorners, snapTarget } = computeSnapState(cursor)

      drawFrame(
        ctx,
        measurements,
        pendingAnchor,
        cursor,
        snappableCorners,
        snapTarget
      )

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafRef.current)
  }, [active])

  useEffect(() => {
    if (!active) return

    const onMove = (e: MouseEvent) => {
      cursorRef.current = {
        x: e.clientX,
        y: e.clientY,
      }
    }

    window.addEventListener('mousemove', onMove)

    return () => window.removeEventListener('mousemove', onMove)
  }, [active])

  useEffect(() => {
    document.body.style.cursor = active ? 'crosshair' : ''

    return () => {
      document.body.style.cursor = ''
    }
  }, [active])

  const handleMeasurementClick = useCallback((e: MouseEvent) => {
    if ((e.target as Element).closest('[data-pixel-police]')) return

    // Capture phase allows us to swallow clicks meant for the underlying page
    e.preventDefault()
    e.stopPropagation()

    const { snapTarget } = computeSnapState({
  x: e.clientX,
  y: e.clientY,
})

const point: Point =
  snapTarget ?? {
    x: e.clientX,
    y: e.clientY,
  }

    const { pendingAnchor } = stateRef.current

    if (pendingAnchor === null) {
      setPendingAnchor(point)
    } else {
      setMeasurements((prev) => [
        ...prev,
        {
          id: Date.now(),
          a: pendingAnchor,
          b: point,
        },
      ])

      setPendingAnchor(null)
    }
  }, [])

  useEffect(() => {
    if (!active) return

    document.addEventListener(
      'click',
      handleMeasurementClick,
      { capture: true }
    )

    return () =>
      document.removeEventListener(
        'click',
        handleMeasurementClick,
        { capture: true }
      )
  }, [active, handleMeasurementClick])

  useEffect(() => {
  if (!active) return

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (stateRef.current.pendingAnchor !== null) {
        setPendingAnchor(null)
      } else {
        setActive(false)
      }
    }
  }

  window.addEventListener('keydown', onKeyDown)

  return () => window.removeEventListener('keydown', onKeyDown)
}, [active])

const handleClearAll = () => {
  setMeasurements([])
  setPendingAnchor(null)
}
  const handleToggle = () => setActive((prev) => !prev)

  return (
    <>
    <Canvas
      ref={canvasRef}
      $active={active}
      data-pixel-police
    />

    <WidgetContainer data-pixel-police>
      <ToggleHeader
        onClick={handleToggle}
        aria-label={
          active
            ? 'Deactivate Pixel Police'
            : 'Activate Pixel Police'
        }
        title="Pixel Police (Esc to close)"
      >
        🚨 PIXEL POLICE 🚨
      </ToggleHeader>

      {active && measurements.length > 0 && (
        <MeasurementList>
          {measurements.map((m, i) => {
            const dist = Math.round(
              Math.hypot(
                m.b.x - m.a.x,
                m.b.y - m.a.y
              )
            )

            return (
              <MeasurementItem key={m.id}>
                {i}: {dist}px
              </MeasurementItem>
            )
          })}
        </MeasurementList>
      )}
    </WidgetContainer>
  </>
  )
}