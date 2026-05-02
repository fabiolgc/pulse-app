import fs from "node:fs"
import path from "node:path"
import JSZip from "jszip"
import { generateBootstrapScript, type AgentOS } from "@/lib/agent-bootstrap"

const AGENT_FILES = [
  "agent.py",
  "ingest_client.py",
  "import_history.py",
  "requirements.txt",
] as const

export function slugifyLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "pulse-agent"
}

function findAgentDir(): string {
  // Tenta paths conhecidos: dev local (../agent), Vercel deploy (./apps/agent ou similar via tracing)
  const candidates = [
    path.resolve(process.cwd(), "..", "agent"),
    path.resolve(process.cwd(), "apps", "agent"),
    path.resolve(process.cwd(), "..", "..", "apps", "agent"),
  ]
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "agent.py"))) return p
  }
  throw new Error(
    `Agent files not found. Tried: ${candidates.join(", ")}`
  )
}

export interface BuildPackageInput {
  label: string
  ingestUrl: string
  ingestToken: string
  mt5Path?: string | null
  symbols?: string[]
  timeframes?: string[]
}

export interface AgentPackage {
  filename: string
  base64: string
}

export async function buildAgentPackage(
  input: BuildPackageInput
): Promise<AgentPackage> {
  const zip = new JSZip()
  const slug = slugifyLabel(input.label)
  const root = zip.folder(slug)
  if (!root) throw new Error("Failed to create zip root folder")

  // Scripts pros 3 SOs (usuário escolhe qual rodar)
  const symbolsCsv =
    input.symbols && input.symbols.length > 0 ? input.symbols.join(",") : undefined
  const timeframesCsv =
    input.timeframes && input.timeframes.length > 0
      ? input.timeframes.join(",")
      : undefined

  for (const os of ["windows", "mac", "linux"] as AgentOS[]) {
    const s = generateBootstrapScript({
      os,
      ingestUrl: input.ingestUrl,
      ingestToken: input.ingestToken,
      mt5Path: input.mt5Path ?? null,
      symbols: symbolsCsv,
      timeframes: timeframesCsv,
    })
    root.file(s.filename, s.content)
  }

  // Arquivos do agent Python
  const agentDir = findAgentDir()
  for (const f of AGENT_FILES) {
    const p = path.join(agentDir, f)
    if (fs.existsSync(p)) {
      root.file(f, fs.readFileSync(p))
    }
  }

  // Pasta sources/
  const sourcesDir = path.join(agentDir, "sources")
  if (fs.existsSync(sourcesDir)) {
    const sourcesFolder = root.folder("sources")
    if (sourcesFolder) {
      for (const f of fs.readdirSync(sourcesDir)) {
        if (f.endsWith(".py")) {
          sourcesFolder.file(f, fs.readFileSync(path.join(sourcesDir, f)))
        }
      }
    }
  }

  // README curto pro usuário
  root.file(
    "README.txt",
    `Pulse Agent — ${input.label}

Como rodar:
  1. Extraia este zip em qualquer pasta (ex: C:\\Pulse\\${slug}\\).
  2. No Windows: dê duplo clique em "pulse-agent-start.bat".
     No macOS: chmod +x pulse-agent-start.command e dê duplo clique.
     No Linux: chmod +x pulse-agent-start.sh && ./pulse-agent-start.sh
  3. O script verifica Python, cria venv, instala dependências, escreve .env
     com seu token, abre o MT5 dessa conta e inicia o agent.
  4. Mantenha a janela aberta — feche ou Ctrl+C pra parar.

Pra parar de monitorar essa conta no Pulse, desative ela em
/settings/accounts.
`
  )

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  })

  return {
    filename: `${slug}.zip`,
    base64: buffer.toString("base64"),
  }
}
