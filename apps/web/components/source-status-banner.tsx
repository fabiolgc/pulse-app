"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase"

type AccountRow = {
  id: string
  label: string
  last_seen: string | null
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000
const POLL_INTERVAL_MS = 60_000

export function SourceStatusBanner() {
  const supabase = useMemo(() => createClient(), [])
  const [stale, setStale] = useState<AccountRow[]>([])
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
        setStale([])
        return
      }
      setAuthed(true)

      // Quais contas 'importam': as referenciadas por pelo menos uma regra ativa.
      const { data: rules } = await supabase
        .from("rules")
        .select("account_id")
        .eq("user_id", user.id)
        .eq("active", true)
        .not("account_id", "is", null)

      if (cancelled) return
      const neededIds = new Set<string>()
      for (const r of rules ?? []) {
        if (r.account_id) neededIds.add(r.account_id as string)
      }
      if (neededIds.size === 0) {
        setStale([])
        return
      }

      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, label, last_seen")
        .in("id", Array.from(neededIds))

      if (cancelled || !accounts) return

      const now = Date.now()
      const offline = (accounts as AccountRow[]).filter((a) => {
        if (!a.last_seen) return true
        return now - new Date(a.last_seen).getTime() > STALE_THRESHOLD_MS
      })
      setStale(offline)
    }

    check()
    const id = window.setInterval(check, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [supabase])

  if (!authed || stale.length === 0) return null

  const labels = stale.map((a) => a.label).join(", ")

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-6 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>{labels}</strong> sem heartbeat. Suas regras ativas dessa(s)
          conta(s) não vão disparar até o agent voltar.
        </span>
        <Link
          href="/settings/accounts"
          className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
        >
          Ver contas →
        </Link>
      </div>
    </div>
  )
}
