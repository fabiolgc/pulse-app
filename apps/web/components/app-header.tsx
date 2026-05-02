"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Activity, LogOut, Menu, Rocket, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SourceStatusBanner } from "@/components/source-status-banner"
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
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
    })
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  function navClass(active: boolean, extra = "") {
    return `${
      active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
    } ${extra}`
  }

  return (
    <>
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative inline-flex h-6 w-6 items-center justify-center">
              <span className="absolute inset-1 rounded-full bg-primary/30 animate-ping" />
              <Activity className="relative h-5 w-5 text-primary" strokeWidth={2.5} />
            </span>
            <h1 className="text-lg font-semibold tracking-tight">Pulse</h1>
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider font-medium"
            >
              Beta
            </Badge>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link key={item.href} href={item.href} className={navClass(isActive)}>
                  {item.label}
                </Link>
              )
            })}
            {email && (
              <>
                <Link
                  href="/onboarding"
                  className={navClass(
                    pathname === "/onboarding",
                    "inline-flex items-center gap-1.5"
                  )}
                  title="Onboarding"
                >
                  <Rocket className="h-4 w-4" />
                  Onboarding
                </Link>
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
              </>
            )}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <nav className="md:hidden mt-4 pt-4 border-t border-border flex flex-col gap-1 text-sm">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navClass(
                    isActive,
                    "py-2 px-2 rounded-md hover:bg-accent"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
            {email && (
              <>
                <Link
                  href="/onboarding"
                  className={navClass(
                    pathname === "/onboarding",
                    "py-2 px-2 rounded-md hover:bg-accent inline-flex items-center gap-2"
                  )}
                >
                  <Rocket className="h-4 w-4" />
                  Onboarding
                </Link>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="w-full py-2 px-2 rounded-md text-left text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair ({email})
                  </button>
                </form>
              </>
            )}
          </nav>
        )}
      </header>
      <SourceStatusBanner />
    </>
  )
}
