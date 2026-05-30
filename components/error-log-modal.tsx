"use client"

import { CheckCircle2, XCircle, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface LogEntry {
  rowNumber: number
  status: "Completed" | "Error"
  message: string
  time: string
}

export function ErrorLogModal({
  open,
  onOpenChange,
  logs,
  onClear,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  logs: LogEntry[]
  onClear: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Analysis Logs</DialogTitle>
          <DialogDescription>
            Per-row results from the AI analysis engine, newest first.
          </DialogDescription>
        </DialogHeader>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No logs yet.</div>
        ) : (
          <ScrollArea className="max-h-[55vh] pr-3">
            <ul className="flex flex-col gap-2">
              {logs.map((log, i) => (
                <li
                  key={`${log.rowNumber}-${log.time}-${i}`}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-sm",
                    log.status === "Error"
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-card",
                  )}
                >
                  {log.status === "Error" ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-3" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {log.rowNumber > 0 ? `Row ${log.rowNumber}` : "System"}
                      </span>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {new Date(log.time).toLocaleTimeString()}
                      </time>
                    </div>
                    <p className="mt-0.5 break-words text-muted-foreground">{log.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        {logs.length > 0 && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={onClear} className="gap-2 text-muted-foreground">
              <Trash2 className="size-4" />
              Clear logs
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
