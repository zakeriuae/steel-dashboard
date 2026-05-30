import { google, type sheets_v4 } from "googleapis"
import { REQUIRED_COLUMNS, type SheetData, type SheetRow } from "./types"

const SHEET_ID = process.env.GOOGLE_SHEET_ID

function normalizeNewlines(value: string): string {
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim()
}

// Resolve { email, key } from env, tolerating several common ways people
// store Google service-account credentials:
//  - GOOGLE_PRIVATE_KEY = raw PEM key  (+ GOOGLE_SERVICE_ACCOUNT_EMAIL)
//  - GOOGLE_PRIVATE_KEY = full service-account JSON blob (single var)
function resolveCredentials(): { email: string; key: string } {
  let rawKey = process.env.GOOGLE_PRIVATE_KEY?.trim()
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()

  // Case: the entire service-account JSON was pasted into GOOGLE_PRIVATE_KEY
  // (or into a dedicated GOOGLE_CREDENTIALS_JSON var).
  const jsonBlob = process.env.GOOGLE_CREDENTIALS_JSON?.trim() ||
    (rawKey && rawKey.startsWith("{") ? rawKey : undefined)

  if (jsonBlob) {
    try {
      const parsed = JSON.parse(jsonBlob) as {
        private_key?: string
        client_email?: string
      }
      if (parsed.private_key) rawKey = parsed.private_key
      if (!email && parsed.client_email) email = parsed.client_email
    } catch {
      throw new Error(
        "GOOGLE_PRIVATE_KEY looks like JSON but could not be parsed. Paste the full service-account JSON exactly, or paste only the private_key value.",
      )
    }
  }

  // Strip wrapping quotes if pasted including JSON quotes.
  if (
    rawKey &&
    ((rawKey.startsWith('"') && rawKey.endsWith('"')) ||
      (rawKey.startsWith("'") && rawKey.endsWith("'")))
  ) {
    rawKey = rawKey.slice(1, -1)
  }

  const key = rawKey ? normalizeNewlines(rawKey) : undefined

  if (!email || !key) {
    throw new Error(
      "Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY (or paste the full service-account JSON into GOOGLE_PRIVATE_KEY).",
    )
  }

  if (!key.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "Could not find a valid PEM private key. Check the GOOGLE_PRIVATE_KEY value.",
    )
  }

  return { email, key }
}

function getAuth() {
  const { email, key } = resolveCredentials()
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
