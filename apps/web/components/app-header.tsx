"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Activity, LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/rules", label: "Regras" },
  { href: "/backtest", label: "Backtest" },
  { href: "/settings", label: "Settings" },
] as const

export function AppHeader() {
  const pathname = usePathname()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
    })
  }, [])

  return (
    <header className="border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Pulse</h1>
          <Badge variant="outline" className="text-xs">Beta</Badge>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {item.label}
              </Link>
            )
          })}
          {email && (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                title={`Sair (${email})`}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </form>
          )}
        </nav>
      </div>
    </header>
  )
}
