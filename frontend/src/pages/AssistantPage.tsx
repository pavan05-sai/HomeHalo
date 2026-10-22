import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  ShieldAlert,
  Database,
  HelpCircle,
  Cpu,
} from 'lucide-react'
import type { ChatResponse } from '../lib/types'
import { api } from '../lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: { collection: string; id: string }[]
  unknowns?: string[]
  usedLlm?: boolean
  timestamp: string
}

export function AssistantPage() {
  const [searchParams] = useSearchParams()
  const eventIdParam = searchParams.get('eventId')

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I am HomeHalo's AI Safety Assistant. I coordinate simulated household safety incidents, explain deterministic risk assessments, and track human decisions. How can I assist you with the Rivera household today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (eventIdParam) {
      const q = `Can you explain the safety assessment and plan for event ${eventIdParam}?`
      sendMessage(q, eventIdParam)
    }
  }, [eventIdParam])

  const sendMessage = async (text: string, eventId?: string) => {
    if (!text.trim() || isLoading) return
    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const resp = await api.chatAssistant(text, eventId)
      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: resp.answer,
        sources: resp.sources,
        unknowns: resp.unknowns,
        usedLlm: resp.used_llm,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: `Error retrieving response: ${(err as Error).message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const promptSuggestions = [
    'What open response plans currently require human review?',
    'Why was the night door opening assessed as high risk?',
    'What is the household mode and who is scheduled for check-ins?',
    'What actions were recently logged for this household?',
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-emerald-700" />
            AI Safety Coordination Assistant
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Transparent reasoning engine grounded in verified household context and rule-based assessments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-600" />
            Evidence-Grounded
          </span>
        </div>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm overflow-hidden flex flex-col h-[600px]">
        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-stone-50/30">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 max-w-2xl ${
                m.role === 'user' ? 'ml-auto flex-row-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  m.role === 'user'
                    ? 'bg-stone-900 text-white'
                    : 'bg-gradient-to-tr from-emerald-700 to-teal-500 text-white shadow-sm'
                }`}
              >
                {m.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>

              {/* Message bubble */}
              <div className="space-y-2">
                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-stone-900 text-white rounded-tr-none'
                      : 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-none shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Evidence & Sources tags (for assistant) */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-stone-100 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="font-semibold text-stone-500 flex items-center gap-1">
                        <Database className="w-3 h-3 text-emerald-600" />
                        Grounded In:
                      </span>
                      {m.sources.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-stone-100 font-mono text-stone-700 border border-stone-200"
                        >
                          {s.collection}:{s.id.slice(0, 10)}
                        </span>
                      ))}
                      {m.usedLlm && (
                        <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-medium">
                          Reworded by LLM
                        </span>
                      )}
                    </div>
                  )}

                  {/* Explicit Unknowns */}
                  {m.unknowns && m.unknowns.length > 0 && (
                    <div className="mt-2 text-[10px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-start gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">Missing Evidence:</span>
                        <span>{m.unknowns.join('; ')}</span>
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-stone-400 block px-1">
                  {m.timestamp}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 max-w-lg">
              <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-white p-4 rounded-2xl border border-stone-200 rounded-tl-none shadow-sm text-xs text-stone-500 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                Analyzing evidence and synthesizing answer...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="px-4 py-2 border-t border-stone-100 bg-stone-50/60 overflow-x-auto flex items-center gap-2">
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide shrink-0">
            Quick Prompts:
          </span>
          {promptSuggestions.map((prompt, i) => (
            <button
              key={i}
              type="button"
              disabled={isLoading}
              onClick={() => sendMessage(prompt)}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded-full text-[11px] text-stone-700 font-medium whitespace-nowrap transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <form
          onSubmit={handleSubmit}
          className="p-3 sm:p-4 bg-white border-t border-stone-200 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about incidents, risk explanations, schedules, or plans..."
            disabled={isLoading}
            className="flex-1 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all text-stone-900"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl shadow-sm transition-all"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
