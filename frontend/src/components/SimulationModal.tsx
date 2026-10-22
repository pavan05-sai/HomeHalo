import React, { useState } from 'react'
import { X, Flame, ShieldAlert, Clock, Sparkles, AlertCircle } from 'lucide-react'
import type { Household, EventType } from '../lib/types'
import { api } from '../lib/api'

interface SimulationModalProps {
  isOpen: boolean
  onClose: () => void
  household: Household | null
  onEventCreated: (eventId: string) => void
}

export function SimulationModal({ isOpen, onClose, household, onEventCreated }: SimulationModalProps) {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Custom Form state
  const [eventType, setEventType] = useState<EventType>('door_activity')
  const [deviceId, setDeviceId] = useState('dev-front-door')
  const [doorAction, setDoorAction] = useState('opened')
  const [memberId, setMemberId] = useState('mem-004')
  const [minutesLate, setMinutesLate] = useState(45)
  const [smokeLevel, setSmokeLevel] = useState('high')

  if (!isOpen) return null

  const runSimulation = async (type: EventType, payload: Record<string, unknown>, occurredAt?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // 1. Record simulated event
      const event = await api.recordEvent({
        event_type: type,
        payload,
        occurred_at: occurredAt || new Date().toISOString(),
      })

      // 2. Run deterministic risk assessment
      await api.assessEvent(event.id)

      // 3. Generate response plan
      try {
        await api.createPlan(event.id)
      } catch (planErr) {
        // If plan already exists or not needed, continue
        console.warn('Plan creation note:', planErr)
      }

      onEventCreated(event.id)
      onClose()
    } catch (err) {
      console.error('Simulation error:', err)
      setError((err as Error).message || 'Failed to simulate event')
    } finally {
      setIsLoading(false)
    }
  }

  // Preset 1: Night Door Opening (High Risk)
  const triggerNightDoor = async () => {
    // 2:15 AM timestamp
    const d = new Date()
    d.setHours(2, 15, 0, 0)
    await runSimulation('door_activity', {
      device_id: 'dev-back-door',
      action: 'opened',
      location: 'Back Yard',
      duration_seconds: 45,
    }, d.toISOString())
  }

  // Preset 2: Missed Senior Check-in (Elevated Risk)
  const triggerMissedCheckin = async () => {
    const d = new Date()
    d.setHours(10, 45, 0, 0)
    await runSimulation('missed_checkin', {
      schedule_id: 'cs-001',
      member_id: 'mem-004',
      member_name: 'Grandma Rosa',
      expected_time: '10:00',
      minutes_late: 45,
    }, d.toISOString())
  }

  // Preset 3: Smoke Alarm Alert (Critical Risk)
  const triggerSmokeAlarm = async () => {
    const d = new Date()
    d.setHours(11, 30, 0, 0)
    await runSimulation('smoke_alarm', {
      device_id: 'dev-smoke-kitchen',
      location: 'Kitchen',
      smoke_detected: true,
      alarm_state: 'active',
      co_ppm: 28,
    }, d.toISOString())
  }

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let payload: Record<string, unknown> = {}

    if (eventType === 'door_activity') {
      const dev = household?.devices.find((d) => d.id === deviceId)
      payload = {
        device_id: deviceId,
        action: doorAction,
        location: dev?.location || 'Main Entrance',
      }
    } else if (eventType === 'missed_checkin') {
      const mem = household?.members.find((m) => m.id === memberId)
      payload = {
        schedule_id: 'cs-custom',
        member_id: memberId,
        member_name: mem?.name || 'Elena Rivera',
        expected_time: '12:00',
        minutes_late: Number(minutesLate),
      }
    } else if (eventType === 'smoke_alarm') {
      const dev = household?.devices.find((d) => d.id === deviceId)
      payload = {
        device_id: deviceId,
        location: dev?.location || 'Kitchen',
        smoke_detected: true,
        alarm_state: 'active',
        severity: smokeLevel,
      }
    }

    await runSimulation(eventType, payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              Simulate Safety Event
            </h3>
            <p className="text-xs text-stone-500">
              Inject a simulated event into the deterministic risk engine & response planner.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-stone-200 px-6 pt-2 bg-stone-50/30">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'presets'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Curated Scenarios (1-Click)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'custom'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Custom Event Builder
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6">
          {activeTab === 'presets' ? (
            <div className="space-y-3">
              {/* Scenario 1 */}
              <button
                type="button"
                disabled={isLoading}
                onClick={triggerNightDoor}
                className="w-full text-left p-3.5 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50/40 transition-all group flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 group-hover:scale-105 transition-transform">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-stone-900 group-hover:text-amber-900">
                      Night Door Opening
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      High Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                    Back yard door opened at 2:15 AM during quiet hours. Triggers alert verification and exterior lighting check.
                  </p>
                </div>
              </button>

              {/* Scenario 2 */}
              <button
                type="button"
                disabled={isLoading}
                onClick={triggerMissedCheckin}
                className="w-full text-left p-3.5 rounded-xl border border-stone-200 hover:border-yellow-400 hover:bg-yellow-50/40 transition-all group flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0 text-yellow-800 group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-stone-900 group-hover:text-yellow-900">
                      Missed Senior Check-in
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                      Elevated Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                    Grandma Rosa missed scheduled 10:00 AM check-in (+45m past grace period). Generates gentle inquiry steps.
                  </p>
                </div>
              </button>

              {/* Scenario 3 */}
              <button
                type="button"
                disabled={isLoading}
                onClick={triggerSmokeAlarm}
                className="w-full text-left p-3.5 rounded-xl border border-stone-200 hover:border-rose-400 hover:bg-rose-50/40 transition-all group flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 text-rose-700 group-hover:scale-105 transition-transform">
                  <Flame className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-stone-900 group-hover:text-rose-900">
                      Kitchen Smoke Alarm Trigger
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                      Critical Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                    Smoke detector active in kitchen with carbon monoxide reading. Requires immediate safety verification steps.
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Event Type
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  className="w-full text-xs rounded-lg border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-2 px-3 border"
                >
                  <option value="door_activity">Door Activity (Sensors)</option>
                  <option value="missed_checkin">Missed Check-in (Schedules)</option>
                  <option value="smoke_alarm">Smoke Alarm (Detectors)</option>
                </select>
              </div>

              {eventType === 'door_activity' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Sensor Location
                    </label>
                    <select
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      className="w-full text-xs rounded-lg border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-2 px-3 border"
                    >
                      {household?.devices
                        .filter((d) => d.type === 'door_sensor')
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.location})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Door State
                    </label>
                    <select
                      value={doorAction}
                      onChange={(e) => setDoorAction(e.target.value)}
                      className="w-full text-xs rounded-lg border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-2 px-3 border"
                    >
                      <option value="opened">Opened</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </>
              )}

              {eventType === 'missed_checkin' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Household Member
                    </label>
                    <select
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                      className="w-full text-xs rounded-lg border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-2 px-3 border"
                    >
                      {household?.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Minutes Late
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={minutesLate}
                      onChange={(e) => setMinutesLate(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-2 px-3 border"
                    />
                  </div>
                </>
              )}

              {eventType === 'smoke_alarm' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Detector
                  </label>
                  <select
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    className="w-full text-xs rounded-lg border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-2 px-3 border"
                  >
                    {household?.devices
                      .filter((d) => d.type === 'smoke_alarm')
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.location})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-50"
              >
                {isLoading ? 'Processing Simulation...' : 'Simulate Custom Event'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
          <span>Flow: Event &rarr; Context &rarr; Risk Rules &rarr; Plan</span>
          {isLoading && <span className="font-semibold text-emerald-700 animate-pulse">Running assessment...</span>}
        </div>
      </div>
    </div>
  )
}
