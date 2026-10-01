import { useEffect, useRef } from 'react'

const padding = 24
const keyboardStep = 20

// Sistemas de coordenadas:
//   'fit'     → escala el dibujo para que quepa (solo lectura).
//   'percent' → puntos en 0..100 (editor del LAB05).
//   'pixels'  → puntos en píxeles del canvas (tiempo real, igual que el backend guía).
export default function BlueprintCanvas({
  points = [],
  width = 520,
  height = 360,
  interactive = false,
  coordinates,
  onPointAdd,
}) {
  const ref = useRef(null)
  const mode = coordinates ?? (interactive ? 'percent' : 'fit')

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const validPoints = points.filter(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    )
    let canvasPoints

    if (mode === 'pixels') {
      canvasPoints = validPoints.map((point) => ({ x: point.x, y: point.y }))
    } else if (mode === 'percent') {
      const drawableWidth = canvas.width - padding * 2
      const drawableHeight = canvas.height - padding * 2
      canvasPoints = validPoints.map((point) => ({
        x: padding + (point.x / 100) * drawableWidth,
        y: canvas.height - padding - (point.y / 100) * drawableHeight,
      }))
    } else {
      const minX = validPoints.length ? Math.min(...validPoints.map((point) => point.x)) : 0
      const maxX = validPoints.length ? Math.max(...validPoints.map((point) => point.x)) : 0
      const minY = validPoints.length ? Math.min(...validPoints.map((point) => point.y)) : 0
      const maxY = validPoints.length ? Math.max(...validPoints.map((point) => point.y)) : 0
      const rangeX = maxX - minX
      const rangeY = maxY - minY
      const scale = Math.min(
        rangeX === 0 ? Infinity : (canvas.width - padding * 2) / rangeX,
        rangeY === 0 ? Infinity : (canvas.height - padding * 2) / rangeY,
      )
      const safeScale = Number.isFinite(scale) ? scale : 1
      const drawingWidth = rangeX * safeScale
      const drawingHeight = rangeY * safeScale
      const offsetX = (canvas.width - drawingWidth) / 2
      const offsetY = (canvas.height - drawingHeight) / 2
      canvasPoints = validPoints.map((point) => ({
        x: offsetX + (point.x - minX) * safeScale,
        y: offsetY + (point.y - minY) * safeScale,
      }))
    }

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#0b1220'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = 'rgba(148,163,184,0.15)'
    context.lineWidth = 1
    for (let x = 0; x < canvas.width; x += 40) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, canvas.height)
      context.stroke()
    }
    for (let y = 0; y < canvas.height; y += 40) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(canvas.width, y)
      context.stroke()
    }
    if (canvasPoints.length > 1) {
      context.strokeStyle = '#93c5fd'
      context.lineWidth = 2
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.beginPath()
      context.moveTo(canvasPoints[0].x, canvasPoints[0].y)
      for (let index = 1; index < canvasPoints.length; index += 1) {
        context.lineTo(canvasPoints[index].x, canvasPoints[index].y)
      }
      context.stroke()
    }
    context.fillStyle = '#fbbf24'
    for (const point of canvasPoints) {
      context.beginPath()
      context.arc(point.x, point.y, 4, 0, Math.PI * 2)
      context.fill()
    }
  }, [points, mode, width, height])

  const addPointAt = (x, y) => {
    if (!interactive || !onPointAdd) return
    if (mode === 'pixels') {
      const point = { x: Math.round(x), y: Math.round(y) }
      if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) return
      onPointAdd(point)
      return
    }
    const drawableWidth = width - padding * 2
    const drawableHeight = height - padding * 2
    const point = {
      x: Math.round(((x - padding) / drawableWidth) * 100),
      y: Math.round(((height - padding - y) / drawableHeight) * 100),
    }

    if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) return
    onPointAdd(point)
  }

  const handleClick = (event) => {
    const canvas = ref.current
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    addPointAt(
      ((event.clientX - bounds.left) / bounds.width) * width,
      ((event.clientY - bounds.top) / bounds.height) * height,
    )
  }

  const handleKeyDown = (event) => {
    if (!interactive || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    const previous = points.at(-1)
    if (mode === 'pixels') {
      addPointAt(
        previous ? Math.min(width, previous.x + keyboardStep) : width / 2,
        previous ? Math.min(height, previous.y + keyboardStep) : height / 2,
      )
      return
    }
    const nextX = previous ? Math.min(100, previous.x + 5) : 50
    const nextY = previous ? Math.min(100, previous.y + 5) : 50
    addPointAt(
      padding + (nextX / 100) * (width - padding * 2),
      height - padding - (nextY / 100) * (height - padding * 2),
    )
  }

  return (
    <canvas
      id="blueprint-canvas"
      className={`blueprint-canvas${interactive ? ' blueprint-canvas-interactive' : ''}`}
      ref={ref}
      width={width}
      height={height}
      role={interactive ? 'application' : 'img'}
      tabIndex={interactive ? 0 : undefined}
      aria-label={
        interactive
          ? 'Lienzo interactivo: haz clic para agregar puntos; pulsa Enter para continuar la secuencia.'
          : 'Lienzo del blueprint actual'
      }
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ '--canvas-max-width': `${width}px` }}
    />
  )
}
