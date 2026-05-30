"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn, getRowMetadata } from "@/lib/utils"
import { AI_FIELDS, RAW_CONTENT, STATUS, ERROR_DETAILS, type SheetRow } from "@/lib/types"
import { PRIORITY_STYLES, STATUS_STYLES, INSIGHT_STYLES } from "@/lib/field-meta"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

const FIELD_TRANSLATIONS: Record<string, string> = {
  "Category": "دسته‌بندی اصلی",
  "Secondary Categories": "دسته‌بندی‌های ثانویه",
  "Topic": "موضوع پیشنهادی",
  "Title": "عنوان تحلیل",
  "Summary": "خلاصه یادداشت",
  "Tags": "برچسب‌های کلیدی",
  "Insight Type": "نوع یافته / تحلیل",
  "Priority": "سطح اولویت",
  "Business Stage": "مرحله کسب و کار",
  "Strategic Importance": "اهمیت استراتژیک",
  "Confidence Score": "درصد اطمینان هوش مصنوعی",
  "Action Items": "اقدامات پیشنهادی بعدی",
  "Owner": "مسئول پیشنهادی",
  "Related Project": "پروژه مرتبط",
  "Risks": "ریسک‌های شناسایی‌شده",
  "Opportunities": "فرصت‌های شناسایی‌شده",
  "Revenue Model": "مدل درآمدی مرتبط",
  "Normalized Content": "محتوای نرمال‌سازی شده",
  "Raw Content": "متن خام اولیه",
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
  Pending: "در انتظار تحلیل",
  "": "در انتظار تحلیل",
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
  const { sender, date } = getRowMetadata(v)

  const handleDownloadCSV = () => {
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
    const rowData = [
      row.rowNumber,
      `"${(v["Topic"] || "بدون موضوع").replace(/"/g, '""')}"`,
      `"${(CATEGORY_TRANSLATIONS[v["Category"]] || v["Category"] || "—").replace(/"/g, '""')}"`,
      `"${(v["Insight Type"] || "—").replace(/"/g, '""')}"`,
      `"${(v["Summary"] || "—").replace(/"/g, '""')}"`,
      `"${(v["Priority"] || "—").replace(/"/g, '""')}"`,
      `"${v["Confidence Score"] ? `${v["Confidence Score"]}%` : "—"}"`,
      `"${(sender || "—").replace(/"/g, '""')}"`,
      `"${(date || "—").replace(/"/g, '""')}"`,
      `"${(v[RAW_CONTENT] || "").replace(/"/g, '""')}"`
    ]
    const csvContent = BOM + [csvHeaders.join(","), rowData.join(",")].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    const safeTitle = (v["Topic"] || v["Title"] || "یادداشت").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_")
    link.setAttribute("download", `تحلیل_یادداشت_${safeTitle}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl gap-0 p-0 text-right">
        <DialogHeader className="border-b border-border p-6 pb-4 text-right">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("font-normal", STATUS_STYLES[status] ?? STATUS_STYLES[""])}>
              {STATUS_TRANSLATIONS[status] || STATUS_TRANSLATIONS[""]}
            </Badge>
            {v["Insight Type"] && (
              <Badge variant="outline" className={cn("font-normal", INSIGHT_STYLES[v["Insight Type"]])}>
                {INSIGHT_TRANSLATIONS[v["Insight Type"]] || v["Insight Type"]}
              </Badge>
            )}
            {v["Priority"] && (
              <Badge variant="outline" className={cn("font-normal", PRIORITY_STYLES[v["Priority"]])}>
                {PRIORITY_TRANSLATIONS[v["Priority"]] || v["Priority"]}
              </Badge>
            )}
            <div className="mr-auto ml-0 flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={handleDownloadCSV}
                className="gap-1 text-[10px] h-7 px-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500 rounded-lg shrink-0 transition-all font-sans"
              >
                <Download className="size-3" />
                دانلود CSV
              </Button>
              <span className="text-xs text-muted-foreground">سطر {row.rowNumber}</span>
            </div>
          </div>
          <DialogTitle className="text-pretty text-lg leading-snug text-right font-sans mt-3" dir="auto">
            {v["Title"] || "یادداشت بدون عنوان"}
          </DialogTitle>
          {v["Topic"] && <p className="text-sm text-muted-foreground text-right" dir="auto">{v["Topic"]}</p>}
          {(sender || date) && (
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground/80 font-sans text-right" dir="auto">
              {sender && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">فرستنده:</span>
                  <span className="bg-secondary px-2 py-0.5 rounded text-xs font-semibold text-secondary-foreground border border-border/40">
                    {sender}
                  </span>
                </div>
              )}
              {sender && date && <span className="opacity-40">•</span>}
              {date && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">تاریخ:</span>
                  <span className="font-mono text-xs text-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/20">
                    {date}
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="flex flex-col gap-5 p-6 text-right">
            {status === "Error" && v[ERROR_DETAILS] && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive text-right" dir="auto">
                {v[ERROR_DETAILS]}
              </div>
            )}

            {v["Summary"] && (
              <Section title={FIELD_TRANSLATIONS["Summary"] || "خلاصه"}>
                <p className="text-pretty text-sm leading-relaxed text-foreground text-right" dir="auto">{v["Summary"]}</p>
              </Section>
            )}

            <Section title={FIELD_TRANSLATIONS["Raw Content"] || "متن اولیه"}>
              <p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed text-muted-foreground text-right" dir="auto">
                {v[RAW_CONTENT]}
              </p>
            </Section>

            {v["Normalized Content"] && v["Normalized Content"] !== v[RAW_CONTENT] && (
              <Section title={FIELD_TRANSLATIONS["Normalized Content"] || "متن اصلاح‌شده"}>
                <p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed text-foreground text-right" dir="auto">
                  {v["Normalized Content"]}
                </p>
              </Section>
            )}

            <Separator />

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 text-right">
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
                return <Field key={field} label={FIELD_TRANSLATIONS[field] || field} value={value} isList={LIST_FIELDS.has(field)} fieldName={field} />
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
    <div className="text-right">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary border-r-2 border-primary pr-2">
        {title}
      </h4>
      {children}
    </div>
  )
}

function Field({ label, value, isList, fieldName }: { label: string; value: string; isList: boolean; fieldName?: string }) {
  return (
    <div className="text-right">
      <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </h4>
      {isList ? (
        <div className="flex flex-wrap gap-1.5 justify-start" dir="auto">
          {value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((item, i) => {
              const displayVal = fieldName === "Secondary Categories" ? (CATEGORY_TRANSLATIONS[item] || item) : item
              return (
                <Badge key={i} variant="secondary" className="font-normal">
                  {displayVal}
                </Badge>
              )
            })}
        </div>
      ) : (
        <p className="text-pretty text-sm text-foreground" dir="auto">
          {fieldName === "Confidence Score" ? `${value}٪` : value}
        </p>
      )}
    </div>
  )
}
