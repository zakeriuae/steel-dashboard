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
import { ZoomIn, ZoomOut, Maximize, Move, Network, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RAW_CONTENT, STATUS, VALID_CATEGORIES, type SheetRow } from "@/lib/types"
import { categoryColor, PRIORITY_STYLES } from "@/lib/field-meta"
import { RowDetailDialog } from "@/components/row-detail-dialog"
import { cn, getRowMetadata } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const PRIORITY_TRANSLATIONS: Record<string, string> = {
  Low: "کم",
  Medium: "متوسط",
  High: "زیاد",
  Critical: "بحرانی",
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{value}٪</span>
    </div>
  )
}

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Vision & Business Concept": "چشم‌انداز و مفهوم کسب و کار",
  "Business Model": "مدل کسب و کار",
  "Strategy": "استراتژی",
  "Product": "محصول",
  "Services": "خدمات",
  "AI Solutions": "راهکارهای هوش مصنوعی",
  "Steel Industry Applications": "کاربردهای صنعت فولاد",
  "Market Research": "تحقیقات بازار",
  "Sales": "فروش",
  "Marketing": "بازاریابی",
  "Operations": "عملیات",
  "Technology & Infrastructure": "فناوری و زیرساخت",
  "Finance": "مالی",
  "Legal & DIFC": "حقوقی و منطقه DIFC",
  "Partnerships": "شراکت‌ها و همکاری‌ها",
  "Investment & Fundraising": "سرمایه‌گذاری و جذب سرمایه",
  "Risk Assessment": "ارزیابی ریسک",
  "Decisions": "تصمیمات",
  "Tasks & Action Items": "کارها و اقدامات پیشنهادی",
  "Meetings & Discussions": "جلسات و گفتگوها",
  "Uncategorized": "دسته‌بندی نشده",
}

function translateCategory(category: string): string {
  const cat = category ? category.trim() : ""
  return CATEGORY_TRANSLATIONS[cat] || cat || "—"
}

interface GraphNode extends SimulationNodeDatum {
  id: string
  kind: "root" | "hub" | "topic"
  label: string
  category: string
  color: string
  radius: number
  rowNumbers?: number[]
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

function normalizeCategory(cat: string): string {
  const c = (cat || "").trim().toLowerCase()
  if (!c) return "Meetings & Discussions"

  // Check exact/partial matches in English
  for (const vc of VALID_CATEGORIES) {
    if (vc.toLowerCase() === c) return vc
  }

  // Persian/Farsi & direct mapping rules
  // 1. Vision & Business Concept
  if (c.includes("چشم انداز") || c.includes("مفهوم کسب و کار") || c.includes("اهداف") || c.includes("vision")) {
    return "Vision & Business Concept"
  }
  // 2. Business Model
  if (c.includes("مدل کسب و کار") || c.includes("بیزینس مدل") || c.includes("business model")) {
    return "Business Model"
  }
  // 3. Strategy
  if (c.includes("استراتژی") || c.includes("بهبود فرآیند") || c.includes("توسعه کسب و کار") || c.includes("strategy")) {
    return "Strategy"
  }
  // 4. Product
  if (c.includes("محصول") || c.includes("product")) {
    return "Product"
  }
  // 5. Services
  if (c.includes("خدمات") || c.includes("مشاوره") || c.includes("services")) {
    return "Services"
  }
  // 6. AI Solutions
  if (c.includes("هوش مصنوعی") || c.includes("تحلیل داده") || c.includes("ai solutions") || c.includes("ai")) {
    return "AI Solutions"
  }
  // 7. Steel Industry Applications
  if (c.includes("فولاد") || c.includes("صنعت فولاد") || c.includes("steel")) {
    return "Steel Industry Applications"
  }
  // 8. Market Research
  if (c.includes("تحقیق بازار") || c.includes("بازار") || c.includes("market research")) {
    return "Market Research"
  }
  // 9. Sales
  if (c.includes("فروش") || c.includes("sales")) {
    return "Sales"
  }
  // 10. Marketing
  if (c.includes("بازاریابی") || c.includes("تبلیغات") || c.includes("marketing")) {
    return "Marketing"
  }
  // 11. Operations
  if (c.includes("تولید") || c.includes("فضای کاری") || c.includes("مدیریت") || c.includes("عملیات") || c.includes("operations")) {
    return "Operations"
  }
  // 12. Technology & Infrastructure
  if (c.includes("فناوری") || c.includes("فنی و مهندسی") || c.includes("زیرساخت") || c.includes("technology")) {
    return "Technology & Infrastructure"
  }
  // 13. Finance
  if (c.includes("مالی") || c.includes("بانک") || c.includes("حسابداری") || c.includes("finance")) {
    return "Finance"
  }
  // 14. Legal & DIFC
  if (c.includes("حقوقی") || c.includes("قانون") || c.includes("legal") || c.includes("difc")) {
    return "Legal & DIFC"
  }
  // 15. Partnerships
  if (c.includes("مشارکت") || c.includes("همکاری") || c.includes("شرکا") || c.includes("partnerships")) {
    return "Partnerships"
  }
  // 16. Investment & Fundraising
  if (c.includes("سرمایه") || c.includes("سرمایه گذاری") || c.includes("سرمایه‌گذاری") || c.includes("سرمایه گذاری ها") || c.includes("سرمایه‌گذاری‌ها") || c.includes("جذب سرمایه") || c.includes("fundraising") || c.includes("investment")) {
    return "Investment & Fundraising"
  }
  // 17. Risk Assessment
  if (c.includes("ریسک") || c.includes("ارزیابی ریسک") || c.includes("risk")) {
    return "Risk Assessment"
  }
  // 18. Decisions
  if (c.includes("تصمیم") || c.includes("تصمیمات") || c.includes("decisions")) {
    return "Decisions"
  }
  // 19. Tasks & Action Items
  if (c.includes("کارها") || c.includes("وظایف") || c.includes("پروژه") || c.includes("tasks") || c.includes("action items")) {
    return "Tasks & Action Items"
  }
  // 20. Meetings & Discussions
  if (c.includes("جلسه") || c.includes("مذاکره") || c.includes("گفتگو") || c.includes("meetings")) {
    return "Meetings & Discussions"
  }

  // Fallback direct word-by-word containment search in valid categories
  for (const vc of VALID_CATEGORIES) {
    const words = vc.toLowerCase().split(/\s+&\s+|\s+/)
    for (const word of words) {
      if (word.length > 3 && c.includes(word)) {
        return vc
      }
    }
  }

  return "Meetings & Discussions"
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
  const [nodeDetailsSelected, setNodeDetailsSelected] = useState<{
    title: string
    category: string
    rows: SheetRow[]
    type: "hub" | "topic"
  } | null>(null)
  const [legend, setLegend] = useState<{ category: string; color: string }[]>([])
  const [nodeCount, setNodeCount] = useState(0)

  const sortedDetailsRows = useMemo(() => {
    if (!nodeDetailsSelected) return []
    return [...nodeDetailsSelected.rows].sort((a, b) => {
      const priorityOrder: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 }
      const pA = priorityOrder[a.values["Priority"]] ?? 0
      const pB = priorityOrder[b.values["Priority"]] ?? 0
      if (pA !== pB) return pB - pA
      const cA = Number(a.values["Confidence Score"]) || 0
      const cB = Number(b.values["Confidence Score"]) || 0
      return cB - cA
    })
  }, [nodeDetailsSelected])

  const handleDownloadCSV = () => {
    if (!nodeDetailsSelected || sortedDetailsRows.length === 0) return

    const BOM = "\uFEFF"
    const csvHeaders = [
      "شماره سطر",
      "موضوع",
      "دسته‌بندی اصلی",
      "نوع یافته",
      "خلاصه یافته",
      "اولویت",
      "درصد اطمینان",
      "فرستنده",
      "تاریخ ثبت",
      "متن خام یادداشت"
    ]

    const csvLines = [csvHeaders.join(",")]

    for (const r of sortedDetailsRows) {
      const { sender, date } = getRowMetadata(r.values)
      const rowData = [
        r.rowNumber,
        `"${(r.values["Topic"] || "بدون موضوع").replace(/"/g, '""')}"`,
        `"${translateCategory(r.values["Category"]).replace(/"/g, '""')}"`,
        `"${(r.values["Insight Type"] || "—").replace(/"/g, '""')}"`,
        `"${(r.values["Summary"] || "—").replace(/"/g, '""')}"`,
        `"${(r.values["Priority"] || "—").replace(/"/g, '""')}"`,
        `"${r.values["Confidence Score"] ? `${r.values["Confidence Score"]}%` : "—"}"`,
        `"${(sender || "—").replace(/"/g, '""')}"`,
        `"${(date || "—").replace(/"/g, '""')}"`,
        `"${(r.values[RAW_CONTENT] || "").replace(/"/g, '""')}"`
      ]
      csvLines.push(rowData.join(","))
    }

    const blob = new Blob([BOM + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    const safeTitle = nodeDetailsSelected.title.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_")
    link.setAttribute("download", `تحلیل_موضوع_${safeTitle}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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

    const nodes: GraphNode[] = []
    const links: GraphLink[] = []
    const prev = positionsRef.current

    // 1. Create Root Node "AI Steel"
    const rootId = "root:aisteel"
    const rootP = prev.get(rootId)
    const rootNode: GraphNode = {
      id: rootId,
      kind: "root",
      label: "AI Steel",
      category: "Root",
      color: "#3b82f6",
      radius: 20,
      x: rootP?.x ?? 0,
      y: rootP?.y ?? 0,
      fx: 0,
      fy: 0,
    }
    nodes.push(rootNode)

    // 2. Create Hub Nodes (Categories)
    const hubMap = new Map<string, GraphNode>()
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
        x: p?.x ?? (Math.random() - 0.5) * 150,
        y: p?.y ?? (Math.random() - 0.5) * 150,
      }
      hubMap.set(cat, hub)
      nodes.push(hub)

      // Connect Hub directly to AI Steel Root node!
      links.push({ source: id, target: rootId, strength: 0.9 })
      return hub
    }

    // 3. Group analyzed rows by unique Category and Topic combination
    const topicGroupMap = new Map<string, SheetRow[]>()
    for (const r of analyzed) {
      const category = normalizeCategory(r.values["Category"])
      const topicName = (r.values["Topic"] ?? "").trim() || (r.values["Title"] ?? "").trim()
      const key = `${category}::${topicName}`

      if (!topicGroupMap.has(key)) {
        topicGroupMap.set(key, [])
      }
      topicGroupMap.get(key)!.push(r)
    }

    // 4. Create Topic Nodes
    for (const [key, groupRows] of topicGroupMap.entries()) {
      const [category, topicName] = key.split("::")
      const id = `topic:${key}`
      const p = prev.get(id)

      // Radius depends on the number of messages inside the node!
      const radius = 7 + Math.min(8, (groupRows.length - 1) * 2)
      const rowNumbers = groupRows.map((r) => r.rowNumber)

      const node: GraphNode = {
        id,
        kind: "topic",
        label: topicName,
        category,
        color: resolveColor(categoryColor(category)),
        radius,
        rowNumbers,
        x: p?.x ?? (Math.random() - 0.5) * 600,
        y: p?.y ?? (Math.random() - 0.5) * 600,
      }
      nodes.push(node)

      // Connect Topic Node to its Category Hub Node
      const hub = ensureHub(category)
      if (hub) {
        links.push({ source: id, target: hub.id, strength: 0.6 })
      }

      // Check secondary categories for cross-cluster gravity links
      for (const r of groupRows) {
        const secondary = (r.values["Secondary Categories"] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        for (const sc of secondary) {
          const shub = ensureHub(normalizeCategory(sc))
          if (shub) {
            links.push({ source: id, target: shub.id, strength: 0.12 })
          }
        }
      }
    }

    nodesRef.current = nodes
    linksRef.current = links
    setNodeCount(nodes.filter((n) => n.kind === "topic").length)
    setLegend(Array.from(hubMap.values()).map((h) => ({ category: h.category, color: h.color })))
    return { nodes, links }
  }, [rows])

  // (Re)create the simulation when the graph data changes.
  useEffect(() => {
    const { nodes, links } = buildGraph()

    if (simRef.current) simRef.current.stop()

    const sim = forceSimulation<GraphNode, GraphLink>(nodes)
      .force(
        "charge",
        forceManyBody<GraphNode>().strength((d) => (d.kind === "root" ? -2500 : d.kind === "hub" ? -1200 : -200)),
      )
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((l) => {
            const tg = l.target as GraphNode
            if (tg.kind === "root") return 260
            if (tg.kind === "hub") return 110
            return 100
          })
          .strength((l) => l.strength),
      )
      .force("collide", forceCollide<GraphNode>().radius((d) => d.radius + 25))
      .force("x", forceX(0).strength(0.015))
      .force("y", forceY(0).strength(0.015))
      .alphaDecay(0.012)
      .velocityDecay(0.4)

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
        const isRoot = n.kind === "root"
        const isHub = n.kind === "hub"
        const isHover = hover === n
        const isActive = n.rowNumbers?.includes(activeRow ?? -1)

        // Glow for active/hovered/root nodes.
        if (isHover || isActive || isRoot) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2)
          ctx.fillStyle = withAlpha(n.color, isRoot ? 0.08 : 0.18)
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fillStyle = isRoot ? "#3b82f6" : isHub ? n.color : withAlpha(n.color, 0.85)
        ctx.fill()
        ctx.lineWidth = (isRoot ? 2.5 : isHub ? 2 : 1.5) / t.k
        ctx.strokeStyle = withAlpha("#ffffff", isRoot ? 0.7 : isHub ? 0.5 : 0.3)
        ctx.stroke()

        // Glassmorphism label card.
        if (showLabels && (isRoot || isHub || isHover || n.radius > 7)) {
          drawLabel(ctx, n, t.k, isRoot || isHub, isHover)
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
        if (!moved && dragNode) {
          if (dragNode.kind === "hub") {
            const matchedRows = rows.filter(
              (r) =>
                (r.values[STATUS] ?? "").trim() === "Completed" &&
                normalizeCategory(r.values["Category"]) === dragNode.category
            )
            setNodeDetailsSelected({
              title: translateCategory(dragNode.category),
              category: dragNode.category,
              rows: matchedRows,
              type: "hub",
            })
          } else if (dragNode.kind === "topic" && dragNode.rowNumbers) {
            const matchedRows = dragNode.rowNumbers.map((rn) => rowMap.get(rn)).filter(Boolean) as SheetRow[]
            setNodeDetailsSelected({
              title: dragNode.label,
              category: dragNode.category,
              rows: matchedRows,
              type: "topic",
            })
          }
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
            <h3 className="text-sm font-medium">هیچ موضوع تحلیل‌شده‌ای وجود ندارد</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              روی اجرای تحلیل هوشمند کلیک کنید تا نودهای متصل در نقشه دانش تشکیل شوند.
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 rounded-xl border border-border bg-card/80 p-1.5 backdrop-blur-xl">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => zoomBy(1.25)} title="بزرگنمایی">
          <ZoomIn className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => zoomBy(0.8)} title="کوچکنمایی">
          <ZoomOut className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={fitView} title="تنظیم فیت صفحه">
          <Maximize className="size-4" />
        </Button>
      </div>

      {/* Legend */}
      {hasData && legend.length > 0 && (
        <div className="absolute right-4 top-16 max-w-56 rounded-xl border border-border bg-card/80 p-3 backdrop-blur-xl text-right">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground justify-end">
            <Move className="size-3.5" />
            نودها را بکشید · اسکرول برای زوم
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end">
            {legend.slice(0, 15).map((l) => (
              <span key={l.category} className="flex items-center gap-1.5 text-xs">
                <span className="text-foreground">{translateCategory(l.category)}</span>
                <span className="size-2.5 rounded-full" style={{ backgroundColor: l.color }} />
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
          {nodeCount} موضوع · {legend.length} خوشه دسته‌بندی
        </Badge>
      )}

      <RowDetailDialog row={selectedRow} onClose={() => setSelectedRow(null)} />

      {/* Node Details selector dialog with sorting & download */}
      <Dialog open={!!nodeDetailsSelected} onOpenChange={(open) => !open && setNodeDetailsSelected(null)}>
        <DialogContent className="max-w-2xl p-6 bg-card/95 backdrop-blur-xl border-border/80 shadow-2xl rounded-2xl">
          <DialogHeader className="text-right sm:text-right flex flex-col gap-1.5 border-b border-border pb-4">
            <div className="flex items-center justify-between gap-4" dir="rtl">
              <div className="flex flex-col gap-1 text-right">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground font-sans">
                  {nodeDetailsSelected?.title}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1 justify-start">
                  <Badge variant="outline" className="font-normal border-primary/30 text-primary bg-primary/5">
                    {nodeDetailsSelected?.type === "hub" ? "خوشه دسته‌بندی اصلی" : "نود موضوع تحلیل‌شده"}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-sans">
                    تعداد: {sortedDetailsRows.length} یافته
                  </span>
                </div>
              </div>
              
              <Button
                onClick={handleDownloadCSV}
                className="gap-2 text-xs font-semibold px-4 h-9 rounded-xl shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 transition-all flex items-center"
              >
                <Download className="size-4" />
                دانلود خروجی اکسل (CSV)
              </Button>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-3.5 mt-4 max-h-[55vh] overflow-y-auto p-1" dir="rtl">
            {sortedDetailsRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm font-sans">
                هیچ یادداشت تحلیل‌شده‌ای در این دسته‌بندی یافت نشد.
              </div>
            ) : (
              sortedDetailsRows.map((row, idx) => {
                const { sender, date } = getRowMetadata(row.values)
                const raw = row.values[RAW_CONTENT] || ""
                const conf = Number(row.values["Confidence Score"]) || 0
                const priority = row.values["Priority"] || ""
                
                return (
                  <div
                    key={row.rowNumber}
                    onClick={() => {
                      setSelectedRow(row)
                      setNodeDetailsSelected(null)
                    }}
                    className="group relative flex flex-col gap-2.5 p-4 rounded-xl border border-border/60 bg-card/30 transition-all hover:bg-accent/40 hover:border-primary/40 cursor-pointer text-right"
                  >
                    {/* Item header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-sans font-medium">
                          رتبه {idx + 1} اهمیت
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 font-sans">سطر {row.rowNumber}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {priority && (
                          <Badge
                            variant="outline"
                            className={cn("font-normal text-[9px] px-1.5 py-0.5 leading-none", PRIORITY_STYLES[priority])}
                          >
                            {PRIORITY_TRANSLATIONS[priority] || priority}
                          </Badge>
                        )}
                        {conf > 0 && <ConfidenceBar value={conf} />}
                      </div>
                    </div>

                    {/* Topic/Title & snippet */}
                    <div className="flex flex-col gap-1">
                      <h4 className="font-semibold text-primary text-sm line-clamp-1 leading-snug group-hover:text-primary/80 transition-colors">
                        {row.values["Topic"] || "بدون موضوع"}
                      </h4>
                      {row.values["Summary"] && (
                        <p className="text-xs font-medium text-foreground/80 line-clamp-2 leading-relaxed mt-0.5">
                          {row.values["Summary"]}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground/75 line-clamp-1 leading-relaxed mt-0.5">
                        {raw}
                      </p>
                    </div>

                    {/* Metadata footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                      <div className="flex items-center gap-2 text-[10px]">
                        {sender && (
                          <span className="bg-secondary/60 px-2 py-0.5 rounded text-[10px] text-secondary-foreground font-medium font-sans">
                            فرستنده: {sender}
                          </span>
                        )}
                        {date && (
                          <span className="font-mono text-[9px] text-muted-foreground/75">
                            {date}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-sans">
                        مشاهده تحلیل کامل ←
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
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
  const labelText = isHub ? (CATEGORY_TRANSLATIONS[n.label] || n.label) : n.label
  const text = labelText.length > 28 ? `${labelText.slice(0, 28)}…` : labelText
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
