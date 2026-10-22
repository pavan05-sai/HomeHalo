import type {
  Household,
  HouseholdMode,
  HomeEvent,
  EventDetail,
  ResponsePlan,
  ActionLog,
  Summary,
  ActivityItem,
  ChatResponse,
  HealthResponse,
  EventType,
} from './types'

const BASE_URL = '/api'

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let errorDetail = 'An unexpected error occurred'
    try {
      const errJson = await response.json()
      errorDetail = errJson.error?.message || errJson.detail || JSON.stringify(errJson)
    } catch {
      errorDetail = await response.text()
    }
    throw new Error(errorDetail || `HTTP error ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const api = {
  // Health
  getHealth: () => request<HealthResponse>('/health'),

  // Household
  getHousehold: () => request<Household>('/household'),
  setHouseholdMode: (mode: HouseholdMode) =>
    request<Household>('/household/mode', {
      method: 'PATCH',
      body: JSON.stringify({ mode }),
    }),
  resetDemo: () =>
    request<{ status: string; deleted_events: number; deleted_plans: number; deleted_actions: number }>(
      '/household/reset',
      { method: 'POST' }
    ),

  // Summary
  getSummary: () => request<Summary>('/summary'),

  // Events
  getEvents: (params?: { limit?: number; event_type?: string; level?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.event_type) q.set('event_type', params.event_type)
    if (params?.level) q.set('level', params.level)
    const qs = q.toString()
    return request<HomeEvent[]>(`/events${qs ? `?${qs}` : ''}`)
  },
  getEvent: (id: string) => request<EventDetail>(`/events/${id}`),
  recordEvent: (data: {
    event_type: EventType
    payload: Record<string, unknown>
    occurred_at?: string
    client_request_id?: string
  }) =>
    request<HomeEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  assessEvent: (id: string) =>
    request<HomeEvent>(`/events/${id}/assess`, {
      method: 'POST',
    }),
  createPlan: (eventId: string) =>
    request<ResponsePlan>(`/events/${eventId}/plan`, {
      method: 'POST',
    }),

  // Plans
  getPlans: (params?: { event_id?: string; status?: string }) => {
    const q = new URLSearchParams()
    if (params?.event_id) q.set('event_id', params.event_id)
    if (params?.status) q.set('status', params.status)
    const qs = q.toString()
    return request<ResponsePlan[]>(`/plans${qs ? `?${qs}` : ''}`)
  },
  getPlan: (id: string) => request<ResponsePlan>(`/plans/${id}`),
  decideStep: (
    planId: string,
    stepId: string,
    decision: 'approved' | 'rejected',
    confirmed = true,
    note?: string
  ) =>
    request<ActionLog>(`/plans/${planId}/steps/${stepId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, confirmed, note }),
    }),

  // Activity & Actions
  getActivity: (params?: { limit?: number; kind?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.kind) q.set('kind', params.kind)
    const qs = q.toString()
    return request<ActivityItem[]>(`/activity${qs ? `?${qs}` : ''}`)
  },
  getActions: () => request<ActionLog[]>('/actions'),

  // Assistant
  chatAssistant: (message: string, eventId?: string) =>
    request<ChatResponse>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message, event_id: eventId }),
    }),
}
