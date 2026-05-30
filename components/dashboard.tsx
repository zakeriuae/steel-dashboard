"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { Sparkles, Table2, Network, RefreshCw, ScrollText, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { RAW_CONTENT, STATUS, type AnalyzeEvent, type SheetData, type SheetRow } from "@/lib/types"
import { TableView } from "@/components/table-view"
import { MindMapView } from "@/components/mind-map-view"
import { ErrorLogModal, type LogEntry } from "@/components/error-log-modal"
import { Switch } from "@/components/ui/switch"

const fetcher = async (url: string): Promise<SheetData> => {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json()
}

export function Dashboard() {
  const { data, error, isLoading, mutate } = useSWR<SheetData>("/api/sheet", fetcher, {
    revalidateOnFocus: false,
  })

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [activeRow, setActiveRow] = useState<number | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const [filterShort, setFilterShort] = useState(true)
  const allRows = data?.rows ?? []

  const rows = useMemo(() => {
    if (!filterShort) return allRows
    return allRows.filter((r) => (r.values[RAW_CONTENT] ?? "").trim().length >= 70)
  }, [allRows, filterShort])

  const headers = data?.headers ?? []

  const pendingCount = useMemo(
    () => rows.filter((r) => (r.values[STATUS] ?? "").trim() === "" && (r.values[RAW_CONTENT] ?? "").trim() !== "").length,
    [rows],
  )
  const completedCount = useMemo(
    () => rows.filter((r) => (r.values[STATUS] ?? "").trim() === "Completed").length,
    [rows],
  )
  const errorCount = useMemo(
    () => rows.filter((r) => (r.values[STATUS] ?? "").trim() === "Error").length,
    [rows],
  )

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 200))
  }, [])

  // Optimistically patch a single row's values in the SWR cache.
  const patchRow = useCallback(
    (rowNumber: number, values: Record<string, string>) => {
      mutate((current) => {
        if (!current) return current
        const nextRows = current.rows.map((r) =>
          r.rowNumber === rowNumber ? { ...r, values: { ...r.values, ...values } } : r,
        )
        return { ...current, rows: nextRows }
      }, false)
    },
    [mutate],
  )

  const runAnalysis = useCallback(
    async (rowNumbers?: number[]) => {
      if (running) return
      setRunning(true)
      setProgress({ current: 0, total: 0 })
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowNumbers }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) throw new Error(`Analysis failed to start (${res.status})`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split("\n\n")
          buffer = chunks.pop() ?? ""
          for (const chunk of chunks) {
            const line = chunk.trim()
            if (!line.startsWith("data:")) continue
            const json = line.slice(5).trim()
            if (!json) continue
            let event: AnalyzeEvent | { type: "fatal"; error: string }
            try {
              event = JSON.parse(json)
            } catch {
              continue
            }
            handleEvent(event)
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          addLog({
            rowNumber: 0,
            status: "Error",
            message: err instanceof Error ? err.message : "Analysis failed",
            time: new Date().toISOString(),
          })
        }
      } finally {
        setRunning(false)
        setActiveRow(null)
        abortRef.current = null
        // Final revalidation to sync with the sheet.
        mutate()
      }

      function handleEvent(event: AnalyzeEvent | { type: "fatal"; error: string }) {
        switch (event.type) {
          case "start":
            setProgress({ current: 0, total: event.total })
            break
          case "row-start":
            setActiveRow(event.rowNumber)
            patchRow(event.rowNumber, { [STATUS]: "Processing" })
            break
          case "row-done":
            patchRow(event.rowNumber, event.values)
            setProgress((p) => ({ ...p, current: p.current + 1 }))
            addLog({
              rowNumber: event.rowNumber,
              status: "Completed",
              message: event.values["Title"] || "Analyzed successfully",
              time: new Date().toISOString(),
            })
            break
          case "row-error":
            patchRow(event.rowNumber, { [STATUS]: "Error" })
            setProgress((p) => ({ ...p, current: p.current + 1 }))
            addLog({
              rowNumber: event.rowNumber,
              status: "Error",
              message: event.error,
              time: new Date().toISOString(),
            })
            break
          case "done":
            break
          case "fatal":
            addLog({
              rowNumber: 0,
              status: "Error",
              message: event.error,
              time: new Date().toISOString(),
            })
            break
        }
      }
    },
    [running, addLog, patchRow, mutate],
  )

  const retryRow = useCallback((row: SheetRow) => runAnalysis([row.rowNumber]), [runAnalysis])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        running={running}
        pendingCount={pendingCount}
        completedCount={completedCount}
        errorCount={errorCount}
        progress={progress}
        onRun={() => runAnalysis()}
        onRefresh={() => mutate()}
        onOpenLogs={() => setLogOpen(true)}
        logCount={logs.length}
        filterShort={filterShort}
        onFilterShortChange={setFilterShort}
      />

      <main className="flex flex-1 flex-col">
        {error ? (
          <ConnectionError message={error.message} onRetry={() => mutate()} />
        ) : (
          <Tabs defaultValue="table" className="flex flex-1 flex-col">
            <div className="border-b border-border bg-card/40 px-4 sm:px-6">
              <TabsList className="h-12 bg-transparent p-0">
                <TabsTrigger
                  value="table"
                  className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <Table2 className="size-4" />
                  Table
                </TabsTrigger>
                <TabsTrigger
                  value="map"
                  className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <Network className="size-4" />
                  Knowledge Graph
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="table" className="flex-1 p-0 data-[state=inactive]:hidden">
              <TableView
                rows={rows}
                isLoading={isLoading}
                activeRow={activeRow}
                onRetry={retryRow}
                running={running}
              />
            </TabsContent>

            <TabsContent
              value="map"
              className="flex-1 p-0 data-[state=inactive]:hidden"
              forceMount
            >
              <MindMapView rows={rows} activeRow={activeRow} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <ErrorLogModal open={logOpen} onOpenChange={setLogOpen} logs={logs} onClear={() => setLogs([])} />
    </div>
  )
}

function Header(props: {
  running: boolean
  pendingCount: number
  completedCount: number
  errorCount: number
  progress: { current: number; total: number }
  onRun: () => void
  onRefresh: () => void
  onOpenLogs: () => void
  logCount: number
  filterShort: boolean
  onFilterShortChange: (val: boolean) => void
}) {
  const { running, pendingCount, completedCount, errorCount, progress, onRun, onRefresh, onOpenLogs, logCount, filterShort, onFilterShortChange } = props
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-tight">Insight Board</h1>
            <p className="text-xs text-muted-foreground">AI sheet analysis</p>
          </div>
        </div>

        <div className="hidden items-center gap-4 pl-2 text-xs text-muted-foreground md:flex">
          <Stat label="Pending" value={pendingCount} dotClass="bg-muted-foreground" />
          <Stat label="Completed" value={completedCount} dotClass="bg-chart-3" />
          <Stat label="Errors" value={errorCount} dotClass="bg-destructive" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {running && (
            <div className="hidden w-40 items-center gap-2 sm:flex">
              <Progress value={pct} className="h-1.5" />
              <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                {progress.current}/{progress.total}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-1.5 h-9 text-xs transition-all hover:bg-background/80 hover:border-border">
            <Switch
              id="short-filter"
              checked={filterShort}
              onCheckedChange={onFilterShortChange}
            />
            <label
              htmlFor="short-filter"
              className="cursor-pointer font-medium text-muted-foreground select-none leading-none hover:text-foreground transition-colors"
            >
              فیلتر پیام‌های کوتاه (&lt; 70)
            </label>
          </div>

          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={running} title="Refresh data">
            <RefreshCw className="size-4" />
            <span className="sr-only">Refresh</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenLogs} className="gap-2">
            <ScrollText className="size-4" />
            <span className="hidden sm:inline">Logs</span>
            {logCount > 0 && (
              <span className="rounded-full bg-secondary px-1.5 text-xs tabular-nums text-secondary-foreground">
                {logCount}
              </span>
            )}
          </Button>
          <Button onClick={onRun} disabled={running} className="gap-2">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {running ? "Analyzing…" : "Run AI Analysis"}
          </Button>
        </div>
      </div>
    </header>
  )
}

function Stat({ label, value, dotClass }: { label: string; value: number; dotClass: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", dotClass)} />
      <span className="tabular-nums font-medium text-foreground">{value}</span>
      {label}
    </span>
  )
}

function ConnectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertCircle className="mx-auto mb-3 size-8 text-destructive" />
        <h2 className="mb-1 text-sm font-semibold">Couldn&apos;t load the sheet</h2>
        <p className="mb-4 text-sm text-muted-foreground">{message}</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Make sure the sheet is shared with your service account email as an Editor, and that the
          environment variables are set correctly.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </div>
    </div>
  )
}
