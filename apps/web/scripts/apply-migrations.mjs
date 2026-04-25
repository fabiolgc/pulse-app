import postgres from "postgres"
import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = fileURLToPath(new URL(".", import.meta.url))
const migrationsDir = resolve(here, "../../../supabase/migrations")

const envPath = resolve(here, "../.env.local")
const envContent = readFileSync(envPath, "utf-8")
const envVars = Object.fromEntries(
  envContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const eq = l.indexOf("=")
      return [l.slice(0, eq), l.slice(eq + 1)]
    })
)

// Reads DATABASE_URL from .env.local. For Supabase free tier you usually need the
// pooler URL (direct db.* hostname is IPv6-only). Pooler format example:
//   postgres://postgres.<ref>:<pwd>@aws-1-<region>.pooler.supabase.com:6543/postgres
const databaseUrl = envVars.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL missing in .env.local")
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 })

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()

for (const file of files) {
  const fullPath = join(migrationsDir, file)
  const content = readFileSync(fullPath, "utf-8").trim()
  if (!content) {
    console.log(`SKIP ${file} (empty)`)
    continue
  }
  try {
    console.log(`APPLY ${file}...`)
    await sql.unsafe(content)
    console.log(`  OK`)
  } catch (err) {
    console.error(`  FAIL: ${err.message}`)
    await sql.end()
    process.exit(1)
  }
}

await sql.end()
console.log("Done.")
