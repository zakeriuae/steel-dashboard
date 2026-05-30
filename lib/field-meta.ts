// Visual metadata for AI-generated field values.

export const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-muted text-muted-foreground border-border",
  Medium: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  High: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  Critical: "bg-destructive/15 text-destructive border-destructive/30",
}

export const STATUS_STYLES: Record<string, string> = {
  Completed: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  Error: "bg-destructive/15 text-destructive border-destructive/30",
  Processing: "bg-primary/15 text-primary border-primary/30",
  "": "bg-muted text-muted-foreground border-border",
}

export const INSIGHT_STYLES: Record<string, string> = {
  Idea: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  Decision: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  Risk: "bg-destructive/15 text-destructive border-destructive/30",
  Opportunity: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  Task: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  Question: "bg-muted text-muted-foreground border-border",
  Recommendation: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  Learning: "bg-chart-5/15 text-chart-5 border-chart-5/30",
}

// Deterministic color for a category string, used by the knowledge graph.
const GRAPH_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function categoryColor(category: string): string {
  if (!category) return "var(--muted-foreground)"
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0
  }
  return GRAPH_PALETTE[hash % GRAPH_PALETTE.length]
}
