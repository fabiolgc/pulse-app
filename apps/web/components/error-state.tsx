"use client"

import { AlertCircle, Loader2, RefreshCw } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

export function ErrorState({
  title = "Algo deu errado",
  message,
  onRetry,
  retrying = false,
  className = "",
}: {
  title?: string
  message: ReactNode
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div className={`py-10 px-6 text-center ${className}`}>
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
        <AlertCircle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          className="mt-4"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {retrying ? "Tentando..." : "Tentar novamente"}
        </Button>
      )}
    </div>
  )
}
