"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

type ToastKind = "success" | "error" | "info"

type ToastItem = {
  id: string
  kind: ToastKind
  message: string
}

type ToastCtx = {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const noop = () => {}

const ToastContext = createContext<ToastCtx>({
  success: noop,
  error: noop,
  info: noop,
})

export function useToast() {
  return useContext(ToastContext)
}

const TOAST_DURATION_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_DURATION_MS)
  }, [])

  const ctx: ToastCtx = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
    info: (message) => push("info", message),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  const Icon =
    toast.kind === "success"
      ? CheckCircle2
      : toast.kind === "error"
      ? AlertCircle
      : Info

  const tone =
    toast.kind === "success"
      ? "text-emerald-500"
      : toast.kind === "error"
      ? "text-destructive"
      : "text-primary"

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-sm rounded-md border border-border bg-popover px-4 py-3 shadow-lg animate-in slide-in-from-right-2 fade-in duration-200"
    >
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${tone}`} />
      <p className="flex-1 text-sm leading-relaxed">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
