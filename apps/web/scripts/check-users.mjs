import postgres from "postgres"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = fileURLToPath(new URL(".", import.meta.url))
const envPath = resolve(here, "../.env.local")
const url = readFileSync(envPath, "utf-8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="))
  ?.slice("DATABASE_URL=".length)

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10 })
const rows = await sql`
  select email, created_at, confirmation_sent_at, last_sign_in_at, email_confirmed_at
  from auth.users order by created_at desc limit 5
`
console.log(JSON.stringify(rows, null, 2))
await sql.end()
