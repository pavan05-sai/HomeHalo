import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield, Sparkles, RefreshCw, Home, Moon, Briefcase, Plus, Check } from 'lucide-react'
import type { Household, HouseholdMode } from '../lib/types'
import { api } from '../lib/api'

interface NavbarProps {
  household: Household | null
  onHouseholdUpdated: (h: Household) => void
  onSimulateClick: () => void
  onResetComplete: () => void
}

export function Navbar({ household, onHouseholdUpdated, onSimulateClick, onResetComplete }: NavbarProps) {
  const location = useLocation()
  const [isSwitchingMode, setIsSwitchingMode] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  const handleModeChange = async (newMode: HouseholdMode) => {
    if (!household || household.mode === newMode) return
    setIsSwitchingMode(true)
    try {
      const updated = await api.setHouseholdMode(newMode)
      onHouseholdUpdated(updated)
    } catch (err) {
      console.error('Failed to change mode:', err)
    } finally {
      setIsSwitchingMode(false)
    }
  }

  const handleReset = async () => {
    if (!window.confirm('Reset demo state? This will clear all simulated events, plans, and actions, and restore the default Rivera household.')) {
      return
    }
    setIsResetting(true)
    try {
      await api.resetDemo()
      const h = await api.getHousehold()
      onHouseholdUpdated(h)
      setResetSuccess(true)
      setTimeout(() => setResetSuccess(false), 2500)
      onResetComplete()
    } catch (err) {
      console.error('Reset failed:', err)
      alert('Reset failed: ' + (err as Error).message)
    } finally {
      setIsResetting(false)
    }
  }

  const navItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Events & Simulation', path: '/events' },
    { label: 'Response Plans', path: '/plans' },
    { label: 'AI Assistant', path: '/assistant' },
    { label: 'Audit Trail', path: '/activity' },
  ]

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-serif text-xl font-bold tracking-tight text-stone-900">
                    HomeHalo
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-emerald-100 text-emerald-800 rounded">
                    Sim
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 font-medium -mt-1">
                  AI Home-Safety Coordinator
                </p>
              </div>
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right actions: Mode selector & simulate */}
          <div className="flex items-center gap-3">
            {/* Household mode selector */}
            {household && (
              <div className="hidden sm:flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200/80">
                <span className="text-[11px] font-semibold text-stone-600 px-2 uppercase tracking-wide">
                  Mode:
                </span>
                <button
                  type="button"
                  onClick={() => handleModeChange('home')}
                  disabled={isSwitchingMode}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    household.mode === 'home'
                      ? 'bg-white text-emerald-800 shadow-sm font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Household Mode: Home"
                >
                  <Home className="w-3.5 h-3.5 text-emerald-600" />
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('away')}
                  disabled={isSwitchingMode}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    household.mode === 'away'
                      ? 'bg-white text-amber-800 shadow-sm font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Household Mode: Away"
                >
                  <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                  Away
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('sleeping')}
                  disabled={isSwitchingMode}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    household.mode === 'sleeping'
                      ? 'bg-white text-indigo-800 shadow-sm font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Household Mode: Sleeping (Quiet Hours)"
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  Sleeping
                </button>
              </div>
            )}

            {/* Quick Simulate Button */}
            <button
              type="button"
              onClick={onSimulateClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-sm shadow-emerald-700/20 transition-all hover:shadow"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Simulate Event
            </button>

            {/* Reset demo data */}
            <button
              type="button"
              onClick={handleReset}
              disabled={isResetting}
              className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors border border-transparent hover:border-stone-200"
              title="Reset Demo Data"
            >
              {resetSuccess ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin text-stone-900' : ''}`} />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
