import React from 'react'
import { cn } from '../../lib/utils'
import type { RiskLevel, HouseholdMode, StepStatus } from '../../lib/types'
import { ShieldAlert, ShieldCheck, AlertTriangle, Flame, Moon, Home, Briefcase } from 'lucide-react'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode
  variant?: 'default' | 'outline'
}

export function RiskBadge({ level, className }: { level?: RiskLevel | string; className?: string }) {
  if (!level) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700', className)}>
        Pending
      </span>
    )
  }

  const normalized = level.toLowerCase()

  switch (normalized) {
    case 'critical':
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse', className)}>
          <Flame className="w-3.5 h-3.5 text-rose-600" />
          Critical Risk
        </span>
      )
    case 'high':
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300', className)}>
          <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
          High Risk
        </span>
      )
    case 'elevated':
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-200', className)}>
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />
          Elevated Risk
        </span>
      )
    case 'low':
    default:
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200', className)}>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Low Risk
        </span>
      )
  }
}

export function ModeBadge({ mode, className }: { mode: HouseholdMode; className?: string }) {
  switch (mode) {
    case 'sleeping':
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200', className)}>
          <Moon className="w-3.5 h-3.5 text-indigo-600" />
          Sleeping
        </span>
      )
    case 'away':
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200', className)}>
          <Briefcase className="w-3.5 h-3.5 text-amber-600" />
          Away
        </span>
      )
    case 'home':
    default:
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200', className)}>
          <Home className="w-3.5 h-3.5 text-emerald-600" />
          Home
        </span>
      )
  }
}

export function StepStatusBadge({ status, className }: { status: StepStatus; className?: string }) {
  switch (status) {
    case 'approved':
      return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200', className)}>
          ✓ Approved
        </span>
      )
    case 'rejected':
      return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200', className)}>
          ✕ Rejected
        </span>
      )
    case 'proposed':
    default:
      return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200', className)}>
          Proposed
        </span>
      )
  }
}
