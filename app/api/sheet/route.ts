import { NextResponse } from "next/server"
import { readSheet } from "@/lib/sheets"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  try {
    const data = await readSheet()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read sheet"
    console.error("[v0] /api/sheet error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
