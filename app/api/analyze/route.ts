import { readSheet, updateRow } from "@/lib/sheets"
import { analyzeRow, resultToSheetValues } from "@/lib/analyze"
import { RAW_CONTENT, STATUS, ERROR_DETAILS, type AnalyzeEvent } from "@/lib/types"

export const dynamic = "force-dynamic"
export const maxDuration = 300

interface AnalyzeBody {
  // Specific row numbers to (re)process. If omitted, all rows with empty status are processed.
  rowNumbers?: number[]
}

export async function POST(req: Request) {
  let body: AnalyzeBody = {}
  try {
    body = (await req.json()) as AnalyzeBody
  } catch {
    body = {}
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AnalyzeEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        const { headers, rows } = await readSheet()

        let targets = rows.filter((r) => (r.values[RAW_CONTENT] ?? "").trim() !== "")

        if (body.rowNumbers && body.rowNumbers.length > 0) {
          const set = new Set(body.rowNumbers)
          targets = targets.filter((r) => set.has(r.rowNumber))
        } else {
          // Only rows where AI Analysis Status is empty.
          targets = targets.filter((r) => (r.values[STATUS] ?? "").trim() === "")
        }

        send({ type: "start", total: targets.length })

        let processed = 0
        let errors = 0

        for (const row of targets) {
          send({ type: "row-start", rowNumber: row.rowNumber })
          try {
            const result = await analyzeRow(row.values[RAW_CONTENT])
            const values = resultToSheetValues(result)
            const updates = {
              ...values,
              [STATUS]: "Completed",
              [ERROR_DETAILS]: "",
            }
            await updateRow(row.rowNumber, headers, updates)
            processed++
            send({ type: "row-done", rowNumber: row.rowNumber, values: updates })
          } catch (err) {
            errors++
            const message = err instanceof Error ? err.message : "Unknown error"
            console.error(`[v0] analyze row ${row.rowNumber} failed:`, message)
            try {
              await updateRow(row.rowNumber, headers, {
                [STATUS]: "Error",
                [ERROR_DETAILS]: message.slice(0, 500),
              })
            } catch (writeErr) {
              console.error("[v0] failed to write error status:", writeErr)
            }
            send({ type: "row-error", rowNumber: row.rowNumber, error: message })
          }
        }

        send({ type: "done", processed, errors })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed"
        console.error("[v0] /api/analyze fatal error:", message)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "fatal", error: message })}\n\n`),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
