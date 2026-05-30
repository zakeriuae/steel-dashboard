import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { BUSINESS_STAGES, INSIGHT_TYPES, PRIORITIES, STRATEGIC_IMPORTANCE, VALID_CATEGORIES } from "./types"

const analysisSchema = z.object({
  normalizedContent: z
    .string()
    .describe("The raw content cleaned of corrupted symbols, extra spaces, and formatting artifacts. Fix Persian/Arabic character issues. Keep the original meaning and language."),
  category: z.enum(VALID_CATEGORIES).describe("The single primary business category."),
  secondaryCategories: z.array(z.string()).describe("Zero or more secondary categories."),
  topic: z.string().describe("A concise business topic (2-5 words)."),
  title: z.string().describe("A descriptive title, maximum 10 words."),
  summary: z.string().describe("A summary of the content, maximum 100 words."),
  tags: z.array(z.string()).describe("Relevant keyword tags."),
  insightType: z.enum(INSIGHT_TYPES),
  priority: z.enum(PRIORITIES),
  businessStage: z.enum(BUSINESS_STAGES),
  strategicImportance: z.enum(STRATEGIC_IMPORTANCE),
  confidenceScore: z.number().min(0).max(100).describe("Confidence in this analysis, 0-100."),
  actionItems: z.array(z.string()).describe("Concrete next actions implied by the content."),
  owner: z.string().describe("Suggested owner/role responsible, or empty string if unknown."),
  relatedProject: z.string().describe("Related project name, or empty string if unknown."),
  risks: z.array(z.string()).describe("Risks identified."),
  opportunities: z.array(z.string()).describe("Opportunities identified."),
  revenueModel: z.string().describe("Implied or relevant revenue model, or empty string."),
})

export type AnalysisResult = z.infer<typeof analysisSchema>

// Maps the structured AI result to the sheet's named columns (all as strings).
export function resultToSheetValues(r: AnalysisResult): Record<string, string> {
  const list = (arr: string[]) => arr.filter(Boolean).join(", ")
  return {
    "Normalized Content": r.normalizedContent,
    Category: r.category,
    "Secondary Categories": list(r.secondaryCategories),
    Topic: r.topic,
    Title: r.title,
    Summary: r.summary,
    Tags: list(r.tags),
    "Insight Type": r.insightType,
    Priority: r.priority,
    "Business Stage": r.businessStage,
    "Strategic Importance": r.strategicImportance,
    "Confidence Score": String(Math.round(r.confidenceScore)),
    "Action Items": list(r.actionItems),
    Owner: r.owner,
    "Related Project": r.relatedProject,
    Risks: list(r.risks),
    Opportunities: list(r.opportunities),
    "Revenue Model": r.revenueModel,
  }
}

export async function analyzeRow(rawContent: string): Promise<AnalysisResult> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: analysisSchema,
    system:
      "You are a senior business analyst. You read raw, possibly messy notes (which may be in Persian/Farsi, Arabic, or English) and extract a structured, strategic analysis. Always normalize and clean the text first, then analyze. Respond in the same language as the source content for textual fields. Be precise and concise.",
    prompt: `Analyze the following raw business note and produce the structured analysis.\n\nRAW CONTENT:\n"""\n${rawContent}\n"""`,
  })
  return object
}
