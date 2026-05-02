"use client"

import { HelpCircle } from "lucide-react"
import type { ReactNode } from "react"

export function InfoTooltip({
  hint,
  ariaLabel,
  className = "",
}: {
  hint: ReactNode
  ariaLabel: string
  className?: string
}) {
  return (
    <span className={`relative inline-flex group ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        className="inline-flex items-center justify-center text-muted-foreground/60 hover:text-foreground focus:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-20 w-60 rounded-md border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md opacity-0 translate-y-1 transition-[opacity,transform] duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 normal-case tracking-normal font-normal"
      >
        {hint}
      </span>
    </span>
  )
}
