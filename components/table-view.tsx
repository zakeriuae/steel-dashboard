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
import { cn, getRowMetadata } from "@/lib/utils"
import { RAW_CONTENT, STATUS, type SheetRow } from "@/lib/types"
import { PRIORITY_STYLES, STATUS_STYLES, INSIGHT_STYLES } from "@/lib/field-meta"
import { RowDetailDialog } from "@/components/row-detail-dialog"

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

const PRIORITY_TRANSLATIONS: Record<string, string> = {
  Low: "کم",
  Medium: "متوسط",
  High: "زیاد",
  Critical: "بحرانی",
}

const STATUS_TRANSLATIONS: Record<string, string> = {
  Completed: "تحلیل شده",
  Error: "خطا",
  Processing: "در حال پردازش",
  Pending: "در انتظار",
  "": "در انتظار",
}

const INSIGHT_TRANSLATIONS: Record<string, string> = {
  Idea: "ایده",
  Decision: "تصمیم",
  Risk: "ریسک",
  Opportunity: "فرصت",
  Task: "کار / وظیفه",
  Question: "سؤال",
  Recommendation: "توصیه",
  Learning: "یادگیری",
}

function translateCategory(category: string): string {
  const cat = category ? category.trim() : ""
  return CATEGORY_TRANSLATIONS[cat] || cat || "—"
}

type SortKey = "Title" | "Category" | "Priority" | "Insight Type" | "Confidence Score" | "AI Analysis Status" | "Topic"
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
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در تمام فیلدها…"
            className="pr-9 pl-3"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="وضعیت" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            <SelectItem value="Pending">در انتظار تحلیل</SelectItem>
            <SelectItem value="Processing">در حال پردازش</SelectItem>
            <SelectItem value="Completed">تحلیل شده</SelectItem>
            <SelectItem value="Error">دارای خطا</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="اولویت" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه اولویت‌ها</SelectItem>
            <SelectItem value="Low">کم</SelectItem>
            <SelectItem value="Medium">متوسط</SelectItem>
            <SelectItem value="High">زیاد</SelectItem>
            <SelectItem value="Critical">بحرانی</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="دسته‌بندی" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه دسته‌بندی‌ها</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {translateCategory(c)}
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
              <tr className="border-b border-border text-right text-xs uppercase tracking-wide text-muted-foreground">
                <SortableTh label="موضوع و متن یادداشت" k="Topic" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 font-medium text-right">فرستنده و تاریخ</th>
                <SortableTh label="دسته‌بندی و نوع یافته" k="Category" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="اولویت و درصد اطمینان" k="Priority" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="وضعیت و عملیات" k="AI Analysis Status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const status = (row.values[STATUS] ?? "").trim()
                const isActive = activeRow === row.rowNumber
                const conf = Number(row.values["Confidence Score"]) || 0
                const { sender, date } = getRowMetadata(row.values)
                return (
                  <tr
                    key={row.rowNumber}
                    onClick={() => setSelected(row)}
                    className={cn(
                      "cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/40 text-right align-middle",
                      isActive && "bg-primary/5",
                    )}
                  >
                    {/* Column 1: Topic and Raw Content */}
                    <td className="max-w-md px-4 py-3 text-right">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-primary text-sm line-clamp-1 leading-snug">
                          {row.values["Topic"] || "بدون موضوع"}
                        </span>
                        <span className="text-muted-foreground text-xs line-clamp-2 leading-relaxed">
                          {row.values["Title"] || truncate(row.values[RAW_CONTENT], 75)}
                        </span>
                      </div>
                    </td>

                    {/* Column 2: Sender and Date */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col gap-1.5 justify-center">
                        <div>
                          {sender ? (
                            <span className="bg-secondary/40 px-2 py-0.5 rounded text-[10px] font-semibold text-secondary-foreground border border-border/40 inline-block">
                              {sender}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                        <div>
                          {date ? (
                            <span className="font-mono text-[10px] text-muted-foreground/75">
                              {date}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Column 3: Category and Insight Type */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-medium text-foreground text-xs line-clamp-1">
                          {row.values["Category"] ? translateCategory(row.values["Category"]) : "—"}
                        </span>
                        <div>
                          {row.values["Insight Type"] ? (
                            <Badge
                              variant="outline"
                              className={cn("font-normal text-[9px] px-1.5 py-0.5 leading-none", INSIGHT_STYLES[row.values["Insight Type"]])}
                            >
                              {INSIGHT_TRANSLATIONS[row.values["Insight Type"]] || row.values["Insight Type"]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Column 4: Priority and Confidence Score */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col gap-1.5">
                        <div>
                          {row.values["Priority"] ? (
                            <Badge
                              variant="outline"
                              className={cn("font-normal text-[9px] px-1.5 py-0.5 leading-none", PRIORITY_STYLES[row.values["Priority"]])}
                            >
                              {PRIORITY_TRANSLATIONS[row.values["Priority"]] || row.values["Priority"]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                        <div className="flex items-center justify-start">
                          {conf > 0 ? <ConfidenceBar value={conf} /> : <span className="text-muted-foreground text-xs">—</span>}
                        </div>
                      </div>
                    </td>

                    {/* Column 5: Status and Action Buttons */}
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center gap-2 justify-start md:justify-end flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <StatusBadge status={status} processing={isActive && status === "Processing"} />
                        
                        {status === "Error" && (
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={running}
                            onClick={() => onRetry(row)}
                            className="gap-1 text-[10px] h-7 px-2 border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10"
                          >
                            <RotateCw className="size-3" />
                            تلاش مجدد
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[10px] font-semibold text-primary hover:text-primary-foreground hover:bg-primary/20 gap-1 h-7 px-2.5 rounded-lg transition-all"
                          onClick={() => setSelected(row)}
                        >
                          بررسی
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t border-border bg-card/40 px-4 py-2 text-xs text-muted-foreground sm:px-6 text-right">
        نمایش {filtered.length} سطر از مجموع {rows.length} سطر
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
        در حال پردازش
      </Badge>
    )
  }
  const label = STATUS_TRANSLATIONS[status] || STATUS_TRANSLATIONS[""]
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
      <span className="text-xs tabular-nums text-muted-foreground">{value}٪</span>
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
      <h3 className="text-sm font-medium">{hasRows ? "سطری یافت نشد" : "هنوز داده‌ای وجود ندارد"}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {hasRows
          ? "جستجو یا فیلترهای خود را تغییر دهید."
          : "متن خام را به گوگل شیت اضافه کنید، سپس دکمه تحلیل هوشمند را بزنید."}
      </p>
    </div>
  )
}

function truncate(text: string, max: number) {
  if (!text) return "بدون عنوان"
  return text.length > max ? `${text.slice(0, max)}…` : text
}
