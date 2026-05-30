import { google, type sheets_v4 } from "googleapis"
import { REQUIRED_COLUMNS, type SheetData, type SheetRow } from "./types"

const SHEET_ID = process.env.GOOGLE_SHEET_ID

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  // Support keys stored with literal "\n" sequences (common in env vars).
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!email || !key) {
    throw new Error(
      "Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.",
    )
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

let cachedClient: sheets_v4.Sheets | null = null

function getClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient
  cachedClient = google.sheets({ version: "v4", auth: getAuth() })
  return cachedClient
}

function requireSheetId(): string {
  if (!SHEET_ID) throw new Error("Missing GOOGLE_SHEET_ID environment variable.")
  return SHEET_ID
}

// Convert a 1-based column index into an A1 column letter (1 -> A, 27 -> AA).
function columnLetter(index: number): string {
  let result = ""
  let n = index
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

// Get the title of the first sheet/tab.
async function getFirstSheetTitle(client: sheets_v4.Sheets, spreadsheetId: string): Promise<string> {
  const meta = await client.spreadsheets.get({ spreadsheetId })
  const title = meta.data.sheets?.[0]?.properties?.title
  if (!title) throw new Error("Spreadsheet has no sheets.")
  return title
}

// Read the full sheet, ensuring all required columns exist (adds missing headers).
export async function readSheet(): Promise<SheetData> {
  const client = getClient()
  const spreadsheetId = requireSheetId()
  const sheetTitle = await getFirstSheetTitle(client, spreadsheetId)

  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}`,
  })

  const matrix = res.data.values ?? []
  let headers: string[] = (matrix[0] as string[] | undefined)?.map((h) => String(h ?? "").trim()) ?? []

  // Ensure required columns exist; append any that are missing.
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c))
  if (headers.length === 0) {
    headers = [...REQUIRED_COLUMNS]
    await writeHeaders(client, spreadsheetId, sheetTitle, headers)
  } else if (missing.length > 0) {
    headers = [...headers, ...missing]
    await writeHeaders(client, spreadsheetId, sheetTitle, headers)
  }

  const rows: SheetRow[] = []
  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] as string[]
    const values: Record<string, string> = {}
    headers.forEach((h, idx) => {
      values[h] = raw?.[idx] != null ? String(raw[idx]) : ""
    })
    // Skip fully empty rows.
    const hasContent = Object.values(values).some((v) => v.trim() !== "")
    if (!hasContent) continue
    rows.push({ rowNumber: i + 1, values })
  }

  return { headers, rows }
}

async function writeHeaders(
  client: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  headers: string[],
) {
  const lastCol = columnLetter(headers.length)
  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTitle}!A1:${lastCol}1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  })
}

// Write a set of field values back to a specific row, mapped by header name.
export async function updateRow(
  rowNumber: number,
  headers: string[],
  updates: Record<string, string>,
): Promise<void> {
  const client = getClient()
  const spreadsheetId = requireSheetId()
  const sheetTitle = await getFirstSheetTitle(client, spreadsheetId)

  // Build a full row array spanning all headers so positions line up.
  const lastCol = columnLetter(headers.length)

  // Read existing row so we only overwrite provided fields.
  const existing = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!A${rowNumber}:${lastCol}${rowNumber}`,
  })
  const current = (existing.data.values?.[0] as string[] | undefined) ?? []

  const rowValues = headers.map((h, idx) => {
    if (h in updates) return updates[h]
    return current[idx] != null ? current[idx] : ""
  })

  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTitle}!A${rowNumber}:${lastCol}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [rowValues] },
  })
}
