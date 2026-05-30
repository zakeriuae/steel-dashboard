"use client"

import { useMemo, useState } from "react"
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Loader2,
  Inbox,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { RAW_CONTENT, STATUS, type SheetRow } from "@/lib/types"
import { PRIORITY_STYLES, STATUS_STYLES, INSIGHT_STYLES } from "@/lib/field-meta"
import { RowDetailDialog } from "@/components/row-detail-dialog"

type SortKey = "Title" | "Category" | "Priority" | "Insight Type" | "Confidence Score" | "AI Analysis Status"
type SortDir = "asc" | "desc"

const PRIORITY_ORDER: Record<string, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 }

export function TableView({
  rows,
  isLoading,
  activeRow,
  running,
  onRetry,
}: {
  rows: SheetRow[]
  isLoading: boolean
  activeRow: number | null
  running: boolean
  onRetry: (row: SheetRow) => void
}) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("AI Analysis Status")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [selected, setSelected] = useState<SheetRow | null>(null)

  const categories = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => {
      const c = (r.values["Category"] ?? "").trim()
      if (c) set.add(c)
    })
    return Array.from(set).sort()
  }, [rows])

  const filtered = useMemo(() => {
    let result = rows.filter((r) => (r.values[RAW_CONTENT] ?? "").trim() !== "")

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter((r) =>
        Object.values(r.values).some((v) => v.toLowerCase().includes(q)),
      )
    }
    if (statusFilter !== "all") {
      result = result.filter((r) => {
        const s = (r.values[STATUS] ?? "").trim() || "Pending"
        return s === statusFilter
      })
    }
    if (priorityFilter !== "all") {
      result = result.filter((r) => (r.values["Priority"] ?? "").trim() === priorityFilter)
    }
    if (categoryFilter !== "all") {
      result = result.filter((r) => (r.values["Category"] ?? "").trim() === categoryFilter)
    }

    const sorted = [...result].sort((a, b) => {
      let av: string | number = a.values[sortKey] ?? ""
      let bv: string | number = b.values[sortKey] ?? ""
      if (sortKey === "Priority") {
        av = PRIORITY_ORDER[a.values["Priority"]] ?? -1
        bv = PRIORITY_ORDER[b.values["Priority"]] ?? -1
      } else if (sortKey === "Confidence Score") {
        av = Number(a.values["Confidence Score"]) || 0
        bv = Number(b.values["Confidence Score"]) || 0
      } else {
        av = String(av).toLowerCase()
        bv = String(bv).toLowerCase()
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return a.rowNumber - b.rowNumber
    })
    return sorted
  }, [rows, query, statusFilter, priorityFilter, categoryFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/40 px-4 py-3 sm:px-6">
        <div className="relative min-w-50 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all fields…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Processing">Processing</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="relative flex-1 overflow-auto">
        {isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState hasRows={rows.length > 0} />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <SortableTh label="Status" k="AI Analysis Status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Title" k="Title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Category" k="Category" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 font-medium">Topic</th>
                <SortableTh label="Insight" k="Insight Type" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Priority" k="Priority" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Conf." k="Confidence Score" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const status = (row.values[STATUS] ?? "").trim()
                const isActive = activeRow === row.rowNumber
                const conf = Number(row.values["Confidence Score"]) || 0
                return (
                  <tr
                    key={row.rowNumber}
                    onClick={() => setSelected(row)}
                    className={cn(
                      "cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/40",
                      isActive && "bg-primary/5",
                    )}
                  >
                    <td className="px-4 py-3">
                      <StatusBadge status={status} processing={isActive && status === "Processing"} />
                    </td>
                    <td className="max-w-64 px-4 py-3" dir="auto">
                      <span className="line-clamp-2 font-medium text-foreground">
                        {row.values["Title"] || (
                          <span className="text-muted-foreground">
                            {truncate(row.values[RAW_CONTENT], 60)}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3" dir="auto">
                      {row.values["Category"] ? (
                        <span className="text-foreground">{row.values["Category"]}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-40 px-4 py-3 text-muted-foreground" dir="auto">
                      <span className="line-clamp-1">{row.values["Topic"] || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {row.values["Insight Type"] ? (
                        <Badge
                          variant="outline"
                          className={cn("font-normal", INSIGHT_STYLES[row.values["Insight Type"]])}
                        >
                          {row.values["Insight Type"]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.values["Priority"] ? (
                        <Badge
                          variant="outline"
                          className={cn("font-normal", PRIORITY_STYLES[row.values["Priority"]])}
                        >
                          {row.values["Priority"]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {conf > 0 ? <ConfidenceBar value={conf} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === "Error" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={running}
                          onClick={(e) => {
                            e.stopPropagation()
                            onRetry(row)
                          }}
                          className="gap-1.5 text-muted-foreground"
                        >
                          <RotateCw className="size-3.5" />
                          Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t border-border bg-card/40 px-4 py-2 text-xs text-muted-foreground sm:px-6">
        Showing {filtered.length} of {rows.length} rows
      </div>

      <RowDetailDialog row={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function SortableTh({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = sortKey === k
  return (
    <th className="px-4 py-3 font-medium">
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  )
}

function StatusBadge({ status, processing }: { status: string; processing: boolean }) {
  if (processing || status === "Processing") {
    return (
      <Badge variant="outline" className={cn("gap-1 font-normal", STATUS_STYLES["Processing"])}>
        <Loader2 className="size-3 animate-spin" />
        Processing
      </Badge>
    )
  }
  const label = status || "Pending"
  return (
    <Badge variant="outline" className={cn("font-normal", STATUS_STYLES[status] ?? STATUS_STYLES[""])}>
      {label}
    </Badge>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{value}</span>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-2 p-4 sm:p-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/60" />
      ))}
    </div>
  )
}

function EmptyState({ hasRows }: { hasRows: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
        <Inbox className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium">{hasRows ? "No matching rows" : "No data yet"}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {hasRows
          ? "Try adjusting your search or filters."
          : "Add rows with content to your Google Sheet, then run AI analysis."}
      </p>
    </div>
  )
}

function truncate(text: string, max: number) {
  if (!text) return "Untitled"
  return text.length > max ? `${text.slice(0, max)}…` : text
}
