import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  Clock,
  Sparkles,
  Check,
  X,
  MessageSquare,
  Activity,
} from 'lucide-react'
import type { EventDetail, ResponsePlan, PlanStep } from '../lib/types'
import { api } from '../lib/api'
import { RiskBadge, StepStatusBadge } from '../components/ui/Badge'
import { formatDateTime, formatRelativeTime } from '../lib/utils'

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [plan, setPlan] = useState<ResponsePlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({})
  const [isCreatingPlan, setIsCreatingPlan] = useState(false)

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const d = await api.getEvent(id)
      setDetail(d)

      // Fetch any plan associated with this event
      try {
        const plans = await api.getPlans({ event_id: id })
        if (plans.length > 0) {
          setPlan(plans[0])
        }
      } catch (planErr) {
        console.warn('Could not fetch plan for event:', planErr)
      }
    } catch (err) {
      console.error('Failed to load event detail:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleGeneratePlan = async () => {
    if (!id) return
    setIsCreatingPlan(true)
    try {
      const newPlan = await api.createPlan(id)
      setPlan(newPlan)
    } catch (err) {
      alert('Error creating plan: ' + (err as Error).message)
    } finally {
      setIsCreatingPlan(false)
    }
  }

  const handleStepDecision = async (step: PlanStep, decision: 'approved' | 'rejected') => {
    if (!plan) return
    try {
      await api.decideStep(plan.id, step.step_id, decision, true)
      setActionFeedback((prev) => ({
        ...prev,
        [step.step_id]: `${decision === 'approved' ? '✓ Approved' : '✕ Rejected'} (Simulated outcome: recorded_only)`,
      }))
      // Reload plan
      const updatedPlan = await api.getPlan(plan.id)
      setPlan(updatedPlan)
    } catch (err) {
      alert('Error recording decision: ' + (err as Error).message)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-xs text-stone-500">Loading event evidence...</div>
  }

  if (!detail) {
    return (
      <div className="text-center py-12 space-y-3">
        <h2 className="font-semibold text-stone-900 text-sm">Event Not Found</h2>
        <Link to="/events" className="text-xs text-emerald-800 underline">
          &larr; Back to Events
        </Link>
      </div>
    )
  }

  const evt = detail.event
  const assessment = evt.assessment

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* Back button & top meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/events"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events Stream
        </Link>

        <Link
          to={`/assistant?eventId=${evt.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium self-start sm:self-auto transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Ask AI Assistant About This Event
        </Link>
      </div>

      {/* Main Event Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <RiskBadge level={assessment?.level} className="text-xs px-3 py-1" />
              <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                Simulated Event
              </span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-stone-900">
              {evt.event_type.replace('_', ' ').toUpperCase()}
            </h1>
          </div>

          <div className="text-left sm:text-right space-y-0.5 text-xs text-stone-500">
            <div>
              <span className="font-medium text-stone-700">Occurred: </span>
              {formatDateTime(evt.occurred_at)}
            </div>
            <div>
              <span className="font-medium text-stone-700">Household Mode: </span>
              <span className="font-semibold text-stone-900 capitalize">
                {evt.household_mode_at_event || 'home'}
              </span>
            </div>
            <div className="font-mono text-[10px] text-stone-600">ID: {evt.id}</div>
          </div>
        </div>

        {/* Payload Inspector */}
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide block mb-2">
            Sensor Payload
          </span>
          <pre className="text-xs font-mono text-stone-800 overflow-x-auto">
            {JSON.stringify(evt.payload, null, 2)}
          </pre>
        </div>
      </div>

      {/* Deterministic Risk Assessment Card */}
      {assessment ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm space-y-6">
          <div className="border-b border-stone-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-700" />
                Deterministic Risk Assessment
              </h2>
              <p className="text-xs text-stone-500">
                Rule-based classification with explicit evidence grounding. No black-box guesses.
              </p>
            </div>
            <span className="text-[11px] font-mono text-stone-600">
              Engine v{assessment.engine_version}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Matched Rules & Inferred Risk */}
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide block mb-1.5">
                  Matched Deterministic Rules
                </span>
                <div className="flex flex-wrap gap-2">
                  {assessment.rule_ids.map((ruleId) => (
                    <span
                      key={ruleId}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 font-mono text-xs font-semibold border border-emerald-200"
                    >
                      {ruleId}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide block mb-1">
                  Inferred Safety Risk
                </span>
                <p className="text-xs text-stone-800 leading-relaxed font-medium bg-stone-50 p-3 rounded-xl border border-stone-200/80">
                  {assessment.inferred_risk}
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide block mb-1">
                  Explanation
                </span>
                <p className="text-xs text-stone-700 leading-relaxed">
                  {assessment.explanation}
                </p>
              </div>
            </div>

            {/* Right: Known Facts vs Missing Evidence (Transparent AI) */}
            <div className="space-y-4">
              {/* Known facts */}
              <div>
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide block mb-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  Verified Known Facts ({assessment.known_facts.length})
                </span>
                <ul className="space-y-1.5 text-xs text-stone-700">
                  {assessment.known_facts.map((fact, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50/40 border border-emerald-100"
                    >
                      <span className="text-emerald-700 font-bold">•</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Missing evidence / unknowns */}
              <div>
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide block mb-1.5 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                  Missing Evidence / Unknowns ({assessment.missing_evidence.length})
                </span>
                <ul className="space-y-1.5 text-xs text-stone-700">
                  {assessment.missing_evidence.map((unknown, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/40 border border-amber-100"
                    >
                      <span className="text-amber-600 font-bold">?</span>
                      <span>{unknown}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-stone-50 rounded-2xl text-center text-xs text-stone-500">
          No assessment available for this event yet.
        </div>
      )}

      {/* Response Plan Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm space-y-6">
        <div className="border-b border-stone-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              Safety Coordination Response Plan
            </h2>
            <p className="text-xs text-stone-500">
              Human-in-the-loop action coordination. Steps require explicit human approval.
            </p>
          </div>

          {!plan && (
            <button
              onClick={handleGeneratePlan}
              disabled={isCreatingPlan}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {isCreatingPlan ? 'Generating Plan...' : 'Generate Plan'}
            </button>
          )}
        </div>

        {plan ? (
          <div className="space-y-5">
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-stone-900 text-sm">{plan.summary}</h3>
                <span className="text-[11px] font-mono text-stone-600 uppercase font-semibold">
                  Status: {plan.status}
                </span>
              </div>
              <p className="text-xs text-stone-500 italic">{plan.disclaimer}</p>
            </div>

            {/* Steps list */}
            <div className="space-y-3">
              {plan.steps.map((step) => {
                const feedback = actionFeedback[step.step_id]
                return (
                  <div
                    key={step.step_id}
                    className="p-4 rounded-2xl border border-stone-200/80 bg-white hover:border-emerald-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-serif font-bold text-stone-900 text-sm">
                          Step {step.order}: {step.title}
                        </span>
                        <StepStatusBadge status={step.status} />
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-700">
                          {step.kind}
                        </span>
                        <span className="text-[10px] text-stone-600 uppercase font-semibold">
                          Priority: {step.priority}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600">{step.detail}</p>
                      {feedback && (
                        <p className="text-xs font-semibold text-emerald-800">{feedback}</p>
                      )}
                    </div>

                    {step.status === 'proposed' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStepDecision(step, 'approved')}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve Step
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStepDecision(step, 'rejected')}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject Step
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-stone-50 rounded-2xl text-xs text-stone-500">
            No response plan generated yet. Click "Generate Plan" above to create deterministic coordination steps.
          </div>
        )}
      </div>

      {/* Related Historical Context */}
      {detail.related_events && detail.related_events.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm space-y-4">
          <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-700" />
            Related Household Events (Correlation Window)
          </h3>
          <div className="space-y-2">
            {detail.related_events.map((rel) => (
              <Link
                key={rel.id}
                to={`/events/${rel.id}`}
                className="flex items-center justify-between p-3 rounded-xl border border-stone-150 hover:border-emerald-300 transition-all text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-900">
                    {rel.event_type.replace('_', ' ').toUpperCase()}
                  </span>
                  <RiskBadge level={rel.assessment?.level} />
                </div>
                <span className="text-stone-600">{formatRelativeTime(rel.occurred_at)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
