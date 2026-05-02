"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase"

type DataSourceRow = {
  id: string
  label: string
  last_seen: string | null
}

type ActiveRuleRow = {
  source_pref: string | null
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutos sem heartbeat = stale
const POLL_INTERVAL_MS = 60_000

export function SourceStatusBanner() {
  const supabase = useMemo(() => createClient(), [])
  const [missing, setMissing] = useState<DataSourceRow[]>([])
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setAuthed(false)
        setMissing([])
        return
      }
      setAuthed(true)

      const { data: rules } = await supabase
        .from("rules")
        .select("source_pref")
        .eq("user_id", user.id)
        .eq("active", true)

      if (cancelled) return
      if (!rules || rules.length === 0) {
        setMissing([])
        return
      }

      const neededSources = new Set<string>()
      for (const r of rules as ActiveRuleRow[]) {
        neededSources.add(r.source_pref ?? "mt5")
      }

      const { data: sources } = await supabase
        .from("data_sources")
        .select("id, label, last_seen")
        .in("id", Array.from(neededSources))

      if (cancelled || !sources) return

      const now = Date.now()
      const stale = (sources as DataSourceRow[]).filter((s) => {
        if (!s.last_seen) return true
        return now - new Date(s.last_seen).getTime() > STALE_THRESHOLD_MS
      })
      setMissing(stale)
    }

    check()
    const id = window.setInterval(check, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [supabase])

  if (!authed || missing.length === 0) return null

  const labels = missing.map((s) => s.label).join(", ")

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-6 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>{labels}</strong> sem heartbeat. Suas regras ativas não vão
          disparar até a fonte voltar a empurrar dados.
        </span>
        <Link
          href="/settings/agent"
          className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
        >
          Como conectar →
        </Link>
      </div>
    </div>
  )
}
