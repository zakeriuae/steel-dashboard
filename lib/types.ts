// Canonical column names used in the Google Sheet.
// The first column is the source content; the rest are AI-generated.

export const RAW_CONTENT = "Raw Content"
export const STATUS = "AI Analysis Status"
export const ERROR_DETAILS = "Error Details"

// AI-generated fields (written back to the sheet, in this order if missing).
export const AI_FIELDS = [
  "Normalized Content",
  "Category",
  "Secondary Categories",
  "Topic",
  "Title",
  "Summary",
  "Tags",
  "Insight Type",
  "Priority",
  "Business Stage",
  "Strategic Importance",
  "Confidence Score",
  "Action Items",
  "Owner",
  "Related Project",
  "Risks",
  "Opportunities",
  "Revenue Model",
] as const

export type AiField = (typeof AI_FIELDS)[number]

// Every column the sheet should contain, in canonical order.
export const REQUIRED_COLUMNS = [RAW_CONTENT, STATUS, ...AI_FIELDS, ERROR_DETAILS] as const

export type AnalysisStatus = "" | "Completed" | "Error" | "Processing"

export interface SheetRow {
  // 1-based row index in the sheet (header is row 1, so data starts at 2)
  rowNumber: number
  values: Record<string, string>
}

export interface SheetData {
  headers: string[]
  rows: SheetRow[]
}

export const VALID_CATEGORIES = [
  "Vision & Business Concept",
  "Business Model",
  "Strategy",
  "Product",
  "Services",
  "AI Solutions",
  "Steel Industry Applications",
  "Market Research",
  "Sales",
  "Marketing",
  "Operations",
  "Technology & Infrastructure",
  "Finance",
  "Legal & DIFC",
  "Partnerships",
  "Investment & Fundraising",
  "Risk Assessment",
  "Decisions",
  "Tasks & Action Items",
  "Meetings & Discussions",
] as const

export const INSIGHT_TYPES = [
  "Idea",
  "Decision",
  "Risk",
  "Opportunity",
  "Task",
  "Question",
  "Recommendation",
  "Learning",
] as const

export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const

export const BUSINESS_STAGES = [
  "Ideation",
  "Validation",
  "MVP",
  "Pilot",
  "Launch",
  "Growth",
  "Scale",
] as const

export const STRATEGIC_IMPORTANCE = ["Low", "Medium", "High", "Critical"] as const

// Server-Sent-Event payloads streamed by /api/analyze
export type AnalyzeEvent =
  | { type: "start"; total: number }
  | { type: "row-start"; rowNumber: number }
  | { type: "row-done"; rowNumber: number; values: Record<string, string> }
  | { type: "row-error"; rowNumber: number; error: string }
  | { type: "done"; processed: number; errors: number }
