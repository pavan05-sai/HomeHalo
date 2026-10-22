import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Filter, Sparkles, ArrowRight, Clock, ShieldAlert, DoorOpen, BellRing, Flame } from 'lucide-react'
import type { HomeEvent, RiskLevel, EventType } from '../lib/types'
import { api } from '../lib/api'
import { RiskBadge } from '../components/ui/Badge'
import { formatDateTime, formatRelativeTime } from '../lib/utils'

interface EventsPageProps {
  onOpenSimulate: () => void
}

export function EventsPage({ onOpenSimulate }: EventsPageProps) {
  const [events, setEvents] = useState<HomeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')

  const loadEvents = async () => {
    setLoading(true)
    try {
      const data = await api.getEvents({
        level: selectedLevel || undefined,
        event_type: selectedType || undefined,
        limit: 100,
      })
      setEvents(data)
    } catch (err) {
      console.error('Failed to load events:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [selectedLevel, selectedType])

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'smoke_alarm':
        return <Flame className="w-5 h-5 text-rose-600" />
      case 'missed_checkin':
        return <Clock className="w-5 h-5 text-amber-600" />
      case 'door_activity':
      default:
        return <DoorOpen className="w-5 h-5 text-emerald-600" />
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-700" />
            Simulated Safety Events
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Event stream with deterministic risk classifications and verifiable reasoning.
          </p>
        </div>

        <button
          onClick={onOpenSimulate}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2 self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          Simulate New Event
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-stone-500 font-medium">
            <Filter className="w-4 h-4" />
            <span>Filter:</span>
          </div>

          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="rounded-lg border-stone-200 text-xs py-1.5 px-2.5 bg-stone-50 focus:border-emerald-500 focus:ring-emerald-500 font-medium text-stone-800"
          >
            <option value="">All Risk Levels</option>
            <option value="critical">Critical Risk</option>
            <option value="high">High Risk</option>
            <option value="elevated">Elevated Risk</option>
            <option value="low">Low Risk</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-lg border-stone-200 text-xs py-1.5 px-2.5 bg-stone-50 focus:border-emerald-500 focus:ring-emerald-500 font-medium text-stone-800"
          >
            <option value="">All Event Types</option>
            <option value="door_activity">Door Activity</option>
            <option value="missed_checkin">Missed Check-in</option>
            <option value="smoke_alarm">Smoke Alarm</option>
          </select>
        </div>

        <span className="text-[11px] text-stone-500 font-medium">
          Showing {events.length} event{events.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-stone-500">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-stone-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-stone-900 text-sm">No Events Found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {selectedLevel || selectedType
              ? 'No events match the selected filters. Try resetting the filter.'
              : 'No simulated events recorded yet. Click below to inject a simulated safety event.'}
          </p>
          <button
            onClick={onOpenSimulate}
            className="mt-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold"
          >
            Simulate Event
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {getEventIcon(evt.event_type)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-stone-900 text-sm">
                        {evt.event_type.replace('_', ' ').toUpperCase()}
                      </h3>
                      <RiskBadge level={evt.assessment?.level} />
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600">
                        Mode: {evt.household_mode_at_event || 'home'}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 font-mono">
                      {JSON.stringify(evt.payload)
                        .replace(/[{"}]/g, '')
                        .replace(/,/g, ' • ')}
                    </p>

                    {evt.assessment && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-stone-500">
                        <span className="font-semibold text-stone-700">Rules:</span>
                        {evt.assessment.rule_ids.map((r) => (
                          <span
                            key={r}
                            className="font-mono text-[10px] px-1.5 py-0.5 bg-stone-100 rounded text-stone-700 border border-stone-200"
                          >
                            {r}
                          </span>
                        ))}
                        <span className="text-stone-300">•</span>
                        <span>{evt.assessment.explanation}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-100">
                  <span className="text-[11px] text-stone-400 font-medium">
                    {formatRelativeTime(evt.occurred_at)}
                  </span>
                  <Link
                    to={`/events/${evt.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-900 group-hover:underline"
                  >
                    View Evidence
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
