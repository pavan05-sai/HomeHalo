import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Filter, ArrowRight, Check, X, ShieldAlert, Sparkles, ExternalLink } from 'lucide-react'
import type { ResponsePlan, PlanStep } from '../lib/types'
import { api } from '../lib/api'
import { RiskBadge, StepStatusBadge } from '../components/ui/Badge'
import { formatRelativeTime } from '../lib/utils'

interface PlansPageProps {
  onOpenSimulate: () => void
}

export function PlansPage({ onOpenSimulate }: PlansPageProps) {
  const [plans, setPlans] = useState<ResponsePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  const loadPlans = async () => {
    setLoading(true)
    try {
      const data = await api.getPlans({
        status: statusFilter || undefined,
      })
      setPlans(data)
    } catch (err) {
      console.error('Failed to load plans:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlans()
  }, [statusFilter])

  const handleStepDecision = async (planId: string, step: PlanStep, decision: 'approved' | 'rejected') => {
    try {
      await api.decideStep(planId, step.step_id, decision, true)
      setFeedback((prev) => ({
        ...prev,
        [step.step_id]: `${decision === 'approved' ? '✓ Approved' : '✕ Rejected'} (Simulated outcome: recorded_only)`,
      }))
      const updated = await api.getPlans({ status: statusFilter || undefined })
      setPlans(updated)
    } catch (err) {
      alert('Error recording decision: ' + (err as Error).message)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-700" />
            Response Plans & Decisions
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Deterministic step-by-step coordination protocols generated for safety incidents.
          </p>
        </div>

        <button
          onClick={onOpenSimulate}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2 self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          Simulate Incident
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-stone-500 font-medium">
            <Filter className="w-4 h-4" />
            <span>Filter Status:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border-stone-200 text-xs py-1.5 px-2.5 bg-stone-50 focus:border-emerald-500 focus:ring-emerald-500 font-medium text-stone-800"
          >
            <option value="">All Plans</option>
            <option value="open">Open (Pending Review)</option>
            <option value="closed">Closed (All Steps Decided)</option>
          </select>
        </div>

        <span className="text-[11px] text-stone-500 font-medium">
          Showing {plans.length} plan{plans.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-stone-500">Loading response plans...</div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-stone-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-stone-900 text-sm">No Plans Found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {statusFilter
              ? `No ${statusFilter} plans found.`
              : 'No safety response plans have been generated yet.'}
          </p>
          <button
            onClick={onOpenSimulate}
            className="mt-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold"
          >
            Simulate Event & Plan
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {plans.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/80 shadow-sm space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <RiskBadge level={p.assessment_level} />
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-stone-100 text-stone-700">
                      {p.status}
                    </span>
                    <span className="text-[11px] text-stone-600 font-mono">
                      #{p.id.slice(0, 8)}
                    </span>
                  </div>
                  <h2 className="font-serif text-lg font-bold text-stone-900">{p.summary}</h2>
                  <p className="text-xs text-stone-500 italic">{p.disclaimer}</p>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto text-xs">
                  <span className="text-stone-600">{formatRelativeTime(p.created_at)}</span>
                  <Link
                    to={`/events/${p.event_id}`}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-900"
                  >
                    View Triggering Event
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide block">
                  Action Steps ({p.steps.length})
                </span>

                {p.steps.map((step) => {
                  const fb = feedback[step.step_id]
                  return (
                    <div
                      key={step.step_id}
                      className="p-4 rounded-2xl border border-stone-200/80 bg-stone-50/40 hover:bg-white hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-stone-900 text-sm">
                            {step.order}. {step.title}
                          </span>
                          <StepStatusBadge status={step.status} />
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-stone-100 text-stone-600">
                            {step.kind}
                          </span>
                          <span className="text-[10px] uppercase font-semibold text-stone-600">
                            Priority: {step.priority}
                          </span>
                        </div>
                        <p className="text-stone-600 leading-relaxed">{step.detail}</p>
                        {fb && <p className="text-xs font-semibold text-emerald-800">{fb}</p>}
                      </div>

                      {step.status === 'proposed' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStepDecision(p.id, step, 'approved')}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepDecision(p.id, step, 'rejected')}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
