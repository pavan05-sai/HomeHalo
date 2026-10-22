import { AlertTriangle } from 'lucide-react'

export function AlertBanner() {
  return (
    <aside
      aria-label="Safety Notice"
      className="bg-amber-500/10 border-b border-amber-500/20 text-amber-900 px-4 py-2 text-xs font-medium flex items-center justify-between"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-2 text-center sm:text-left justify-center w-full">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold uppercase tracking-wide mr-1">Simulated Events Only:</strong>
          HomeHalo is an AI safety coordination prototype, not a certified emergency dispatch or primary life-safety alarm. In a real emergency, always call 911 immediately.
        </span>
      </div>
    </aside>
  )
}
