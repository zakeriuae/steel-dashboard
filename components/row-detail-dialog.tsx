"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { AI_FIELDS, RAW_CONTENT, STATUS, ERROR_DETAILS, type SheetRow } from "@/lib/types"
import { PRIORITY_STYLES, STATUS_STYLES, INSIGHT_STYLES } from "@/lib/field-meta"

const LIST_FIELDS = new Set([
  "Secondary Categories",
  "Tags",
  "Action Items",
  "Risks",
  "Opportunities",
])

export function RowDetailDialog({ row, onClose }: { row: SheetRow | null; onClose: () => void }) {
  if (!row) return null
  const v = row.values
  const status = (v[STATUS] ?? "").trim()

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b border-border p-6 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("font-normal", STATUS_STYLES[status] ?? STATUS_STYLES[""])}>
              {status || "Pending"}
            </Badge>
            {v["Insight Type"] && (
              <Badge variant="outline" className={cn("font-normal", INSIGHT_STYLES[v["Insight Type"]])}>
                {v["Insight Type"]}
              </Badge>
            )}
            {v["Priority"] && (
              <Badge variant="outline" className={cn("font-normal", PRIORITY_STYLES[v["Priority"]])}>
                {v["Priority"]}
              </Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground">Row {row.rowNumber}</span>
          </div>
          <DialogTitle className="text-pretty text-lg leading-snug">
            {v["Title"] || "Untitled note"}
          </DialogTitle>
          {v["Topic"] && <p className="text-sm text-muted-foreground">{v["Topic"]}</p>}
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="flex flex-col gap-5 p-6">
            {status === "Error" && v[ERROR_DETAILS] && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {v[ERROR_DETAILS]}
              </div>
            )}

            {v["Summary"] && (
              <Section title="Summary">
                <p className="text-pretty text-sm leading-relaxed text-foreground">{v["Summary"]}</p>
              </Section>
            )}

            <Section title="Raw Content">
              <p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed text-muted-foreground">
                {v[RAW_CONTENT]}
              </p>
            </Section>

            {v["Normalized Content"] && v["Normalized Content"] !== v[RAW_CONTENT] && (
              <Section title="Normalized Content">
                <p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed text-foreground">
                  {v["Normalized Content"]}
                </p>
              </Section>
            )}

            <Separator />

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {AI_FIELDS.filter(
                (f) =>
                  ![
                    "Normalized Content",
                    "Title",
                    "Summary",
                    "Topic",
                    "Insight Type",
                    "Priority",
                  ].includes(f),
              ).map((field) => {
                const value = (v[field] ?? "").trim()
                if (!value) return null
                return <Field key={field} label={field} value={value} isList={LIST_FIELDS.has(field)} />
              })}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  )
}

function Field({ label, value, isList }: { label: string; value: string; isList: boolean }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </h4>
      {isList ? (
        <div className="flex flex-wrap gap-1.5">
          {value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((item, i) => (
              <Badge key={i} variant="secondary" className="font-normal">
                {item}
              </Badge>
            ))}
        </div>
      ) : (
        <p className="text-pretty text-sm text-foreground">{value}</p>
      )}
    </div>
  )
}
