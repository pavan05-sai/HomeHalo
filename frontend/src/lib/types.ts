// All TypeScript types for HomeHalo

export type HouseholdMode = 'home' | 'away' | 'sleeping'
export type RiskLevel = 'low' | 'elevated' | 'high' | 'critical'
export type EventType = 'door_activity' | 'missed_checkin' | 'smoke_alarm'
export type StepStatus = 'proposed' | 'approved' | 'rejected'
export type StepPriority = 'urgent' | 'high' | 'normal'
export type StepKind = 'advice' | 'action'
export type Decision = 'approved' | 'rejected'
export type ActivityKind = 'event' | 'plan' | 'action'

export interface HouseholdMember {
  id: string
  name: string
  role: string
}

export interface HouseholdDevice {
  id: string
  name: string
  type: string
  location: string
}

export interface QuietHours {
  start: string
  end: string
}

export interface CheckinSchedule {
  id: string
  member_id: string
  expected_time: string
  grace_minutes: number
}

export interface Household {
  id: string
  name: string
  mode: HouseholdMode
  timezone: string
  members: HouseholdMember[]
  devices: HouseholdDevice[]
  quiet_hours?: QuietHours
  checkin_schedules: CheckinSchedule[]
  is_demo: boolean
  emergency_number?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Assessment {
  level: RiskLevel
  rule_ids: string[]
  known_facts: string[]
  missing_evidence: string[]
  inferred_risk: string
  related_event_ids: string[]
  explanation: string
  engine_version: string
  assessed_at: string
}

export interface HomeEvent {
  id: string
  household_id: string
  event_type: EventType
  source: 'simulated'
  occurred_at: string
  recorded_at: string
  payload: Record<string, unknown>
  status: 'recorded' | 'assessed'
  household_mode_at_event?: string
  assessment?: Assessment
  client_request_id?: string
}

export interface PlanStep {
  step_id: string
  order: number
  priority: StepPriority
  title: string
  detail: string
  kind: StepKind
  requires_confirmation: boolean
  status: StepStatus
}

export interface ResponsePlan {
  id: string
  household_id: string
  event_id: string
  assessment_level: RiskLevel
  summary: string
  steps: PlanStep[]
  source: 'rules'
  disclaimer: string
  status: 'open' | 'closed'
  created_at: string
}

export interface ActionLog {
  id: string
  household_id: string
  event_id: string
  plan_id: string
  step_id: string
  decision: Decision
  outcome: 'recorded_only'
  outcome_message: string
  via: 'rest' | 'mcp'
  decided_at: string
  note?: string
}

export interface Summary {
  total_events: number
  by_level: Record<RiskLevel, number>
  open_plans: number
  recent_events: HomeEvent[]
}

export interface EventDetail {
  event: HomeEvent
  household: Household
  related_events: HomeEvent[]
}

export interface ActivityItem {
  _kind: ActivityKind
  _ts: string
  id: string
  [key: string]: unknown
}

export interface ChatResponse {
  answer: string
  sources: { collection: string; id: string }[]
  unknowns: string[]
  used_llm: boolean
}

export interface HealthResponse {
  status: string
  database: 'ok' | 'not_configured' | 'unavailable'
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}
