import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  Clock,
  Sparkles,
  Users,
  Activity,
  Check,
  X,
} from 'lucide-react'
import type { Summary, Household, ResponsePlan, PlanStep } from '../lib/types'
import { api } from '../lib/api'
import { RiskBadge, ModeBadge, StepStatusBadge } from '../components/ui/Badge'
import { formatRelativeTime } from '../lib/utils'

interface DashboardProps {
  household: Household | null
  onOpenSimulate: () => void
}

export function DashboardPage({ household, onOpenSimulate }: DashboardProps) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [openPlans, setOpenPlans] = useState<ResponsePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({})

  const loadData = async () => {
    try {
      setLoading(true)
      const [sum, plans] = await Promise.all([
        api.getSummary(),
        api.getPlans({ status: 'open' }),
      ])
      setSummary(sum)
      setOpenPlans(plans)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleStepDecision = async (planId: string, step: PlanStep, decision: 'approved' | 'rejected') => {
    try {
      await api.decideStep(planId, step.step_id, decision, true)
      setActionFeedback((prev) => ({
        ...prev,
        [step.step_id]: `${decision === 'approved' ? '✓ Approved' : '✕ Rejected'} (Simulated outcome: recorded_only)`,
      }))
      // Reload plans
      const plans = await api.getPlans({ status: 'open' })
      setOpenPlans(plans)
      const sum = await api.getSummary()
      setSummary(sum)
    } catch (err) {
      alert('Error recording decision: ' + (err as Error).message)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero / Header greeting */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-emerald-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Alexa+ Architecture Track
              </span>
              {household && <ModeBadge mode={household.mode} />}
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">
              {household ? household.name : 'The Rivera Household'}
            </h1>
            <p className="text-stone-300 text-xs sm:text-sm mt-1 max-w-xl">
              Deterministic risk assessment, explainable reasoning with verifiable rule IDs, and human-in-the-loop safety coordination.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSimulate}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-900/40 transition-all hover:scale-[1.02] flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Simulate Safety Event
            </button>
            <Link
              to="/assistant"
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur border border-white/10 transition-all flex items-center gap-2"
            >
              Ask Assistant
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Events */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium">
            <span>Simulated Events</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-stone-900 font-serif">
              {summary?.total_events ?? 0}
            </span>
            <span className="text-[11px] text-stone-600">logged</span>
          </div>
        </div>

        {/* Critical & High */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium">
            <span>High & Critical Risk</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-rose-600 font-serif">
              {(summary?.by_level.critical ?? 0) + (summary?.by_level.high ?? 0)}
            </span>
            <span className="text-[11px] text-stone-600">
              ({summary?.by_level.critical ?? 0} crit, {summary?.by_level.high ?? 0} high)
            </span>
          </div>
        </div>

        {/* Elevated & Low */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium">
            <span>Elevated & Low</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-amber-600 font-serif">
              {(summary?.by_level.elevated ?? 0) + (summary?.by_level.low ?? 0)}
            </span>
            <span className="text-[11px] text-stone-600">
              ({summary?.by_level.elevated ?? 0} elev, {summary?.by_level.low ?? 0} low)
            </span>
          </div>
        </div>

        {/* Open Plans */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium">
            <span>Active Plans</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-teal-800 font-serif">
              {summary?.open_plans ?? 0}
            </span>
            <span className="text-[11px] text-stone-600">requiring review</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Plans & Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (7 cols): Active Response Plans */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                Active Response Plans
              </h2>
              <p className="text-xs text-stone-500">
                AI proposed actions requiring human confirmation before execution.
              </p>
            </div>
            <Link
              to="/plans"
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 group"
            >
              All Plans
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {openPlans.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-stone-200/80 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-stone-900 text-sm">No Pending Plans</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                All response plans have been reviewed or no active incidents are pending. Trigger a simulated event to generate a plan.
              </p>
              <button
                onClick={onOpenSimulate}
                className="mt-2 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium"
              >
                Simulate Scenario
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {openPlans.slice(0, 3).map((plan) => (
                <div
                  key={plan.id}
                  className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RiskBadge level={plan.assessment_level} />
                      <span className="text-[11px] font-mono text-stone-600">
                        Plan #{plan.id.slice(0, 8)}
                      </span>
                    </div>
                    <span className="text-[11px] text-stone-500">
                      {formatRelativeTime(plan.created_at)}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-stone-900 text-sm">{plan.summary}</h3>
                    <p className="text-[11px] text-stone-600 mt-1 italic">{plan.disclaimer}</p>
                  </div>

                  {/* Steps */}
                  <div className="space-y-2.5 pt-1">
                    {plan.steps.map((step) => {
                      const feedback = actionFeedback[step.step_id]
                      return (
                        <div
                          key={step.step_id}
                          className="p-3 rounded-xl border border-stone-150 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-stone-900">
                                {step.order}. {step.title}
                              </span>
                              <StepStatusBadge status={step.status} />
                              <span className="text-[10px] text-stone-600 uppercase font-bold">
                                [{step.kind}]
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-600">{step.detail}</p>
                            {feedback && (
                              <p className="text-[10px] font-semibold text-emerald-800">
                                {feedback}
                              </p>
                            )}
                          </div>

                          {step.status === 'proposed' && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStepDecision(plan.id, step, 'approved')}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-semibold flex items-center gap-1 shadow-sm"
                              >
                                <Check className="w-3 h-3" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStepDecision(plan.id, step, 'rejected')}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded text-[11px] font-semibold flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
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

        {/* Right Column (5 cols): Recent Events & Household Info */}
        <div className="lg:col-span-5 space-y-6">
          {/* Household Context Card */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                Household Context
              </h3>
              {household && <ModeBadge mode={household.mode} />}
            </div>

            {household && (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-wide">
                    Residents ({household.members.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {household.members.map((m) => (
                      <span
                        key={m.id}
                        className="px-2 py-0.5 rounded bg-stone-100 text-stone-800 font-medium text-[11px]"
                      >
                        {m.name} <span className="text-stone-600">({m.role})</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-wide">
                    Monitored Sensors ({household.devices.length})
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    {household.devices.map((d) => (
                      <div
                        key={d.id}
                        className="p-1.5 rounded bg-stone-50 border border-stone-100 text-[11px]"
                      >
                        <div className="font-medium text-stone-800">{d.name}</div>
                        <div className="text-[10px] text-stone-600">{d.location}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {household.quiet_hours && (
                  <div className="flex items-center justify-between pt-1 text-[11px] text-stone-600 border-t border-stone-100">
                    <span>Quiet Hours:</span>
                    <span className="font-semibold text-stone-900">
                      {household.quiet_hours.start} – {household.quiet_hours.end}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Events List */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-700" />
                Recent Events
              </h3>
              <Link
                to="/events"
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 group"
              >
                View all
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {!summary || summary.recent_events.length === 0 ? (
              <p className="text-xs text-stone-500 py-3 text-center">No recent events recorded.</p>
            ) : (
              <div className="space-y-2.5">
                {summary.recent_events.map((evt) => (
                  <Link
                    key={evt.id}
                    to={`/events/${evt.id}`}
                    className="block p-3 rounded-xl border border-stone-150 hover:border-emerald-300 hover:bg-emerald-50/20 transition-all text-xs group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-900 group-hover:text-emerald-900">
                        {evt.event_type.replace('_', ' ').toUpperCase()}
                      </span>
                      <RiskBadge level={evt.assessment?.level} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-500 mt-1">
                      <span>{formatRelativeTime(evt.occurred_at)}</span>
                      {evt.assessment && (
                        <span className="font-mono text-[10px] text-stone-600">
                          {evt.assessment.rule_ids.join(', ')}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
