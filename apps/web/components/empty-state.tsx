import Link from "next/link"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

type Action = {
  label: string
  href: string
  icon?: ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = "",
}: {
  icon?: ReactNode
  title: string
  description: ReactNode
  primaryAction?: Action
  secondaryAction?: Action
  className?: string
}) {
  return (
    <div className={`py-16 px-6 text-center ${className}`}>
      {icon && (
        <div className="mb-5 flex justify-center">
          <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            {icon}
          </div>
        </div>
      )}
      <h3 className="text-base font-medium tracking-tight">{title}</h3>
      <div className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
        {description}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {primaryAction && (
            <Link href={primaryAction.href}>
              <Button>
                {primaryAction.icon}
                {primaryAction.label}
              </Button>
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
