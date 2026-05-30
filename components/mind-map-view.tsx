"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force"
import { ZoomIn, ZoomOut, Maximize, Move, Network } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RAW_CONTENT, STATUS, type SheetRow } from "@/lib/types"
import { categoryColor } from "@/lib/field-meta"
import { RowDetailDialog } from "@/components/row-detail-dialog"

interface GraphNode extends SimulationNodeDatum {
  id: string
  kind: "topic" | "hub"
  label: string
  category: string
  color: string
  radius: number
  rowNumber?: number
}

type GraphLink = SimulationLinkDatum<GraphNode> & { strength: number }

interface Transform {
  x: number
  y: number
  k: number
}

// Resolve a "var(--token)" string to a concrete color the canvas can paint.
const colorCache = new Map<string, string>()
function resolveColor(value: string): string {
  if (typeof window === "undefined") return "#888"
  if (!value.startsWith("var(")) return value
  const token = value.slice(4, -1).trim()
  if (colorCache.has(token)) return colorCache.get(token)!
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "#888"
  colorCache.set(token, resolved)
  return resolved
}

export function MindMapView({ rows, activeRow }: { rows: SheetRow[]; activeRow: number | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const linksRef = useRef<GraphLink[]>([])
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 })
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const rafRef = useRef<number>(0)
  const hoverRef = useRef<GraphNode | null>(null)
  const ambientRef = useRef(true)

  const [selectedRow, setSelectedRow] = useState<SheetRow | null>(null)
  const [legend, setLegend] = useState<{ category: string; color: string }[]>([])
  const [nodeCount, setNodeCount] = useState(0)

  const rowMap = useMemo(() => {
    const m = new Map<number, SheetRow>()
    rows.forEach((r) => m.set(r.rowNumber, r))
    return m
  }, [rows])

  // Build graph data from analyzed rows.
  const buildGraph = useCallback(() => {
    const analyzed = rows.filter(
      (r) =>
        (r.values[STATUS] ?? "").trim() === "Completed" &&
        ((r.values["Topic"] ?? "").trim() || (r.values["Title"] ?? "").trim()),
    )

    const hubMap = new Map<string, GraphNode>()
    const nodes: GraphNode[] = []
    const links: GraphLink[] = []
    const prev = positionsRef.current

    const ensureHub = (category: string): GraphNode | null => {
      const cat = category.trim()
      if (!cat) return null
      if (hubMap.has(cat)) return hubMap.get(cat)!
      const id = `hub:${cat}`
      const p = prev.get(id)
      const hub: GraphNode = {
        id,
        kind: "hub",
        label: cat,
        category: cat,
        color: resolveColor(categoryColor(cat)),
        radius: 14,
        x: p?.x ?? (Math.random() - 0.5) * 200,
        y: p?.y ?? (Math.random() - 0.5) * 200,
      }
      hubMap.set(cat, hub)
      nodes.push(hub)
      return hub
    }

    for (const r of analyzed) {
      const id = `row:${r.rowNumber}`
      const label = (r.values["Topic"] ?? "").trim() || (r.values["Title"] ?? "").trim()
      const category = (r.values["Category"] ?? "").trim() || "Uncategorized"
      const p = prev.get(id)
      const node: GraphNode = {
        id,
        kind: "topic",
        label,
        category,
        color: resolveColor(categoryColor(category)),
        radius: 7,
        rowNumber: r.rowNumber,
        x: p?.x ?? (Math.random() - 0.5) * 600,
        y: p?.y ?? (Math.random() - 0.5) * 600,
      }
      nodes.push(node)

      const hub = ensureHub(category)
      if (hub) links.push({ source: node.id, target: hub.id, strength: 0.7 })

      // Secondary categories create weaker links for cross-cluster gravity.
      const secondary = (r.values["Secondary Categories"] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      for (const sc of secondary) {
        const shub = ensureHub(sc)
        if (shub) links.push({ source: node.id, target: shub.id, strength: 0.15 })
      }
    }

    // Connect hubs loosely to keep the whole graph cohesive.
    const hubs = Array.from(hubMap.values())
    for (let i = 1; i < hubs.length; i++) {
      links.push({ source: hubs[0].id, target: hubs[i].id, strength: 0.02 })
    }

    nodesRef.current = nodes
    linksRef.current = links
    setNodeCount(nodes.filter((n) => n.kind === "topic").length)
    setLegend(hubs.map((h) => ({ category: h.category, color: h.color })))
    return { nodes, links }
  }, [rows])

  // (Re)create the simulation when the graph data changes.
  useEffect(() => {
    const { nodes, links } = buildGraph()

    if (simRef.current) simRef.current.stop()

    const sim = forceSimulation<GraphNode, GraphLink>(nodes)
      .force(
        "charge",
        forceManyBody<GraphNode>().strength((d) => (d.kind === "hub" ? -400 : -90)),
      )
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((l) => ((l.target as GraphNode).kind === "hub" ? 70 : 120))
          .strength((l) => l.strength),
      )
      .force("collide", forceCollide<GraphNode>().radius((d) => d.radius + 8))
      .force("x", forceX(0).strength(0.03))
      .force("y", forceY(0).strength(0.03))
      .alphaDecay(0.015)
      .velocityDecay(0.35)

    sim.on("tick", () => {
      // Persist positions so adding/removing nodes is a soft transition.
      for (const n of nodes) {
        if (n.x != null && n.y != null) positionsRef.current.set(n.id, { x: n.x, y: n.y })
      }
    })

    // Ambient idle motion: keep a gentle simmer so the canvas feels alive.
    sim.alphaTarget(ambientRef.current ? 0.015 : 0).restart()
    simRef.current = sim

    return () => {
      sim.stop()
    }
  }, [buildGraph])

  // Center the view on first meaningful render.
  useEffect(() => {
    if (nodeCount > 0 && transformRef.current.x === 0 && transformRef.current.y === 0) {
      const el = containerRef.current
      if (el) {
        transformRef.current = { x: el.clientWidth / 2, y: el.clientHeight / 2, k: 1 }
      }
    }
  }, [nodeCount])

  // Canvas setup + render loop.
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext("2d")!

    let width = 0
    let height = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      width = container.clientWidth
      height = container.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    const draw = () => {
      const t = transformRef.current
      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      // Subtle dotted grid background (FigJam-like).
      drawGrid(ctx, width, height, t)

      ctx.translate(t.x, t.y)
      ctx.scale(t.k, t.k)

      const nodes = nodesRef.current
      const links = linksRef.current
      const showLabels = t.k > 0.55

      // Links (elastic springs).
      ctx.lineWidth = 1 / t.k
      for (const l of links) {
        const s = l.source as GraphNode
        const tg = l.target as GraphNode
        if (s.x == null || tg.x == null) continue
        ctx.strokeStyle = withAlpha(tg.kind === "hub" ? tg.color : s.color, l.strength > 0.3 ? 0.28 : 0.1)
        ctx.beginPath()
        ctx.moveTo(s.x, s.y!)
        ctx.lineTo(tg.x, tg.y!)
        ctx.stroke()
      }

      const hover = hoverRef.current

      // Nodes.
      for (const n of nodes) {
        if (n.x == null || n.y == null) continue
        const isHub = n.kind === "hub"
        const isHover = hover === n
        const isActive = n.rowNumber != null && n.rowNumber === activeRow

        // Glow for active/hovered nodes.
        if (isHover || isActive) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2)
          ctx.fillStyle = withAlpha(n.color, 0.18)
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fillStyle = isHub ? n.color : withAlpha(n.color, 0.85)
        ctx.fill()
        ctx.lineWidth = (isHub ? 2 : 1.5) / t.k
        ctx.strokeStyle = withAlpha("#ffffff", isHub ? 0.5 : 0.3)
        ctx.stroke()

        // Glassmorphism label card.
        if (showLabels && (isHub || isHover || n.radius > 6)) {
          drawLabel(ctx, n, t.k, isHub, isHover)
        }
      }

      ctx.restore()
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [activeRow])

  // ---- Interaction: pan, zoom, drag, hover, click ----
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const t = transformRef.current
    return { x: (sx - t.x) / t.k, y: (sy - t.y) / t.k }
  }, [])

  const pickNode = useCallback(
    (sx: number, sy: number): GraphNode | null => {
      const { x, y } = screenToWorld(sx, sy)
      const nodes = nodesRef.current
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]
        if (n.x == null || n.y == null) continue
        const dx = x - n.x
        const dy = y - n.y
        if (dx * dx + dy * dy <= (n.radius + 4) ** 2) return n
      }
      return null
    },
    [screenToWorld],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let mode: "idle" | "pan" | "drag" = "idle"
    let dragNode: GraphNode | null = null
    let last = { x: 0, y: 0 }
    let moved = false

    const localPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const onPointerDown = (e: PointerEvent) => {
      const p = localPos(e)
      moved = false
      const node = pickNode(p.x, p.y)
      if (node) {
        mode = "drag"
        dragNode = node
        const sim = simRef.current
        if (sim) sim.alphaTarget(0.3).restart()
        const w = screenToWorld(p.x, p.y)
        dragNode.fx = w.x
        dragNode.fy = w.y
      } else {
        mode = "pan"
      }
      last = p
      canvas.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      const p = localPos(e)
      if (mode === "idle") {
        const node = pickNode(p.x, p.y)
        hoverRef.current = node
        canvas.style.cursor = node ? "pointer" : "grab"
        return
      }
      moved = true
      if (mode === "pan") {
        transformRef.current.x += p.x - last.x
        transformRef.current.y += p.y - last.y
      } else if (mode === "drag" && dragNode) {
        const w = screenToWorld(p.x, p.y)
        dragNode.fx = w.x
        dragNode.fy = w.y
      }
      last = p
    }

    const onPointerUp = (e: PointerEvent) => {
      const p = localPos(e)
      if (mode === "drag" && dragNode) {
        // Release so physics resumes (live re-layout).
        dragNode.fx = null
        dragNode.fy = null
        const sim = simRef.current
        if (sim) sim.alphaTarget(ambientRef.current ? 0.015 : 0)
        if (!moved && dragNode.rowNumber != null) {
          const row = rowMap.get(dragNode.rowNumber)
          if (row) setSelectedRow(row)
        }
      }
      mode = "idle"
      dragNode = null
      canvas.releasePointerCapture?.(e.pointerId)
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const t = transformRef.current
      const factor = Math.exp(-e.deltaY * 0.0015)
      const newK = Math.max(0.15, Math.min(4, t.k * factor))
      // Zoom toward cursor.
      t.x = mx - ((mx - t.x) * newK) / t.k
      t.y = my - ((my - t.y) * newK) / t.k
      t.k = newK
    }

    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerup", onPointerUp)
    canvas.addEventListener("wheel", onWheel, { passive: false })

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("wheel", onWheel)
    }
  }, [pickNode, screenToWorld, rowMap])

  const zoomBy = (factor: number) => {
    const el = containerRef.current
    if (!el) return
    const t = transformRef.current
    const cx = el.clientWidth / 2
    const cy = el.clientHeight / 2
    const newK = Math.max(0.15, Math.min(4, t.k * factor))
    t.x = cx - ((cx - t.x) * newK) / t.k
    t.y = cy - ((cy - t.y) * newK) / t.k
    t.k = newK
  }

  const fitView = () => {
    const el = containerRef.current
    const nodes = nodesRef.current
    if (!el || nodes.length === 0) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x)
      maxY = Math.max(maxY, n.y)
    }
    const w = maxX - minX || 1
    const h = maxY - minY || 1
    const k = Math.min(el.clientWidth / (w + 160), el.clientHeight / (h + 160), 2)
    transformRef.current = {
      k,
      x: el.clientWidth / 2 - ((minX + maxX) / 2) * k,
      y: el.clientHeight / 2 - ((minY + maxY) / 2) * k,
    }
  }

  const hasData = nodeCount > 0

  return (
    <div ref={containerRef} className="relative h-[calc(100vh-7.5rem)] w-full overflow-hidden bg-background">
      <canvas ref={canvasRef} className="absolute inset-0 touch-none" style={{ cursor: "grab" }} />

      {!hasData && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
              <Network className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium">No analyzed topics yet</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Run AI analysis to populate the knowledge graph with connected topic nodes.
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 rounded-xl border border-border bg-card/80 p-1.5 backdrop-blur-xl">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => zoomBy(1.25)} title="Zoom in">
          <ZoomIn className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => zoomBy(0.8)} title="Zoom out">
          <ZoomOut className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={fitView} title="Fit to view">
          <Maximize className="size-4" />
        </Button>
      </div>

      {/* Legend */}
      {hasData && legend.length > 0 && (
        <div className="absolute left-4 top-4 max-w-56 rounded-xl border border-border bg-card/80 p-3 backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Move className="size-3.5" />
            Drag nodes · scroll to zoom
          </div>
          <div className="flex flex-wrap gap-1.5">
            {legend.slice(0, 12).map((l) => (
              <span key={l.category} className="flex items-center gap-1.5 text-xs">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-foreground">{l.category}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {hasData && (
        <Badge
          variant="outline"
          className="absolute right-4 top-4 border-border bg-card/80 font-normal backdrop-blur-xl"
        >
          {nodeCount} topics · {legend.length} clusters
        </Badge>
      )}

      <RowDetailDialog row={selectedRow} onClose={() => setSelectedRow(null)} />
    </div>
  )
}

// ---- Canvas drawing helpers ----

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, t: Transform) {
  const spacing = 32 * t.k
  if (spacing < 8) return
  const offsetX = t.x % spacing
  const offsetY = t.y % spacing
  ctx.fillStyle = withAlpha(resolveColor("var(--muted-foreground)"), 0.12)
  for (let x = offsetX; x < w; x += spacing) {
    for (let y = offsetY; y < h; y += spacing) {
      ctx.beginPath()
      ctx.arc(x, y, 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  n: GraphNode,
  k: number,
  isHub: boolean,
  isHover: boolean,
) {
  const fontSize = isHub ? 12 : 10
  ctx.font = `${isHub ? "600" : "400"} ${fontSize}px ui-sans-serif, system-ui, sans-serif`
  const text = n.label.length > 28 ? `${n.label.slice(0, 28)}…` : n.label
  const metrics = ctx.measureText(text)
  const padX = 7
  const padY = 4
  const boxW = metrics.width + padX * 2
  const boxH = fontSize + padY * 2
  const bx = n.x! + n.radius + 6
  const by = n.y! - boxH / 2

  // Glassmorphism card.
  ctx.beginPath()
  roundRect(ctx, bx, by, boxW, boxH, 6)
  ctx.fillStyle = withAlpha(resolveColor("var(--card)"), isHover ? 0.95 : 0.7)
  ctx.fill()
  ctx.lineWidth = 1 / k
  ctx.strokeStyle = withAlpha(n.color, 0.5)
  ctx.stroke()

  ctx.fillStyle = resolveColor("var(--foreground)")
  ctx.textBaseline = "middle"
  ctx.fillText(text, bx + padX, n.y!)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, h / 2, w / 2)
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

// Apply alpha to a CSS color string (supports oklch / hex / rgb).
function withAlpha(color: string, alpha: number): string {
  const c = color.trim()
  if (c.startsWith("oklch")) {
    const inner = c.slice(c.indexOf("(") + 1, c.lastIndexOf(")")).trim()
    return `oklch(${inner} / ${alpha})`
  }
  if (c.startsWith("#")) {
    let hex = c.slice(1)
    if (hex.length === 3) hex = hex.split("").map((x) => x + x).join("")
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  if (c.startsWith("rgb(")) {
    return `rgba(${c.slice(4, -1)}, ${alpha})`
  }
  return c
}
