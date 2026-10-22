import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  History,
  Filter,
  Activity,
  CheckCircle2,
  ShieldCheck,
  DoorOpen,
  Clock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import type { ActivityItem } from '../lib/types'
import { api } from '../lib/api'
import { formatDateTime, formatRelativeTime } from '../lib/utils'
import { RiskBadge } from '../components/ui/Badge'

export function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [kindFilter, setKindFilter] = useState<string>('')

  const loadActivity = async () => {
    setLoading(true)
    try {
      const data = await api.getActivity({
        kind: kindFilter || undefined,
        limit: 100,
      })
      setItems(data)
    } catch (err) {
      console.error('Failed to load activity:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadActivity()
  }, [kindFilter])

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-700" />
            Audit Trail & Safety Activity
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Immutable chronological record of events, risk assessments, generated plans, and human decisions.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-stone-500 font-medium">
            <Filter className="w-4 h-4" />
            <span>Filter Type:</span>
          </div>

          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="rounded-lg border-stone-200 text-xs py-1.5 px-2.5 bg-stone-50 focus:border-emerald-500 focus:ring-emerald-500 font-medium text-stone-800"
          >
            <option value="">All Activity Items</option>
            <option value="event">Simulated Events</option>
            <option value="plan">Response Plans</option>
            <option value="action">Human Action Decisions</option>
          </select>
        </div>

        <span className="text-[11px] text-stone-500 font-medium">
          Showing {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="py-12 text-center text-xs text-stone-500">Loading audit trail...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-stone-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <History className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-stone-900 text-sm">No Activity Recorded</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            No events, plans, or action decisions currently exist in the audit log.
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-stone-200 ml-4 sm:ml-6 space-y-6 py-2">
          {items.map((item) => {
            const isEvent = item._kind === 'event'
            const isPlan = item._kind === 'plan'
            const isAction = item._kind === 'action'

            return (
              <div key={item.id} className="relative pl-6 sm:pl-8 group">
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-[17px] top-1.5 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                    isEvent
                      ? 'bg-emerald-100 text-emerald-800'
                      : isPlan
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {isEvent && <Activity className="w-3.5 h-3.5" />}
                  {isPlan && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {isAction && <ShieldCheck className="w-3.5 h-3.5" />}
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-sm hover:border-emerald-200 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isEvent
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : isPlan
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : 'bg-purple-50 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {item._kind}
                      </span>
                      <span className="font-mono text-[11px] text-stone-600">
                        #{item.id.slice(0, 8)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDateTime(item._ts)}</span>
                      <span className="text-stone-300">•</span>
                      <span className="text-stone-600">{formatRelativeTime(item._ts)}</span>
                    </div>
                  </div>

                  {/* Body based on kind */}
                  <div className="pt-3 text-xs space-y-1.5">
                    {isEvent && (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-stone-900 text-sm">
                            {String(item.event_type || '').replace('_', ' ').toUpperCase()}
                          </span>
                          <RiskBadge level={(item.assessment as any)?.level} />
                        </div>
                        <p className="text-stone-600 font-mono text-[11px] mt-1">
                          {JSON.stringify(item.payload || {})}
                        </p>
                        <Link
                          to={`/events/${item.id}`}
                          className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-900 mt-2"
                        >
                          View Assessment & Reasoning
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}

                    {isPlan && (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-stone-900 text-sm">
                            {String(item.summary || 'Response Plan')}
                          </span>
                          <RiskBadge level={item.assessment_level as any} />
                        </div>
                        <p className="text-stone-600 text-xs mt-1 italic">
                          {String(item.disclaimer || '')}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[11px] text-stone-500">
                            {Array.isArray(item.steps) ? item.steps.length : 0} coordination steps
                          </span>
                          <Link
                            to={`/events/${item.event_id}`}
                            className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-900 text-xs"
                          >
                            View Plan Details
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}

                    {isAction && (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-stone-900 text-sm">
                            Decision:{' '}
                            <span
                              className={
                                item.decision === 'approved' ? 'text-emerald-700' : 'text-rose-700'
                              }
                            >
                              {String(item.decision).toUpperCase()}
                            </span>
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700">
                            Via: {String(item.via || 'rest').toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-1.5 space-y-1 text-stone-600">
                          <p>
                            <span className="font-medium text-stone-700">Step ID: </span>
                            <span className="font-mono text-[11px]">{String(item.step_id)}</span>
                          </p>
                          <p>
                            <span className="font-medium text-stone-700">Audit Outcome: </span>
                            <span className="font-mono text-emerald-800 font-semibold text-[11px]">
                              {String(item.outcome)}
                            </span>{' '}
                            ({String(item.outcome_message || '')})
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
