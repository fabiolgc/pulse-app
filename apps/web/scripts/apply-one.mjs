import postgres from "postgres"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = fileURLToPath(new URL(".", import.meta.url))
const filename = process.argv[2]
if (!filename) {
  console.error("Usage: node apply-one.mjs <migration_file>")
  process.exit(1)
}
const fullPath = resolve(here, "../../../supabase/migrations", filename)

const envPath = resolve(here, "../.env.local")
const envContent = readFileSync(envPath, "utf-8")
const databaseUrl = envContent
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="))
  ?.slice("DATABASE_URL=".length)

if (!databaseUrl) {
  console.error("DATABASE_URL missing in .env.local")
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 })
const content = readFileSync(fullPath, "utf-8").trim()
console.log(`APPLY ${filename}...`)
try {
  await sql.unsafe(content)
  console.log("  OK")
} catch (err) {
  console.error(`  FAIL: ${err.message}`)
  process.exit(1)
} finally {
  await sql.end()
}
