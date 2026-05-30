const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

if (!SHEET_ID || !privateKey || !email) {
  console.log("Missing env vars!");
  console.log("SHEET_ID:", SHEET_ID ? "Loaded" : "Missing");
  console.log("EMAIL:", email ? "Loaded" : "Missing");
  process.exit(1);
}

function resolveCredentials() {
  let rawKey = privateKey.trim();
  if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
    rawKey = rawKey.slice(1, -1);
  }
  return {
    email: email.trim(),
    key: rawKey.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
  };
}

const creds = resolveCredentials();
const auth = new google.auth.JWT({
  email: creds.email,
  key: creds.key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const client = google.sheets({ version: "v4", auth });

async function check() {
  try {
    const meta = await client.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheetTitle = meta.data.sheets[0].properties.title;
    const res = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${sheetTitle}!A1:Z5`,
    });
    console.log("HEADERS:", res.data.values[0]);
    console.log("ROW 1:", res.data.values[1]);
  } catch (err) {
    console.error("Error checking sheet:", err.message);
  }
}

check();
