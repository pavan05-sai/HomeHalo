import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { AlertBanner } from './components/ui/AlertBanner'
import { Navbar } from './components/Navbar'
import { SimulationModal } from './components/SimulationModal'
import { DashboardPage } from './pages/DashboardPage'
import { EventsPage } from './pages/EventsPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { PlansPage } from './pages/PlansPage'
import { AssistantPage } from './pages/AssistantPage'
import { ActivityPage } from './pages/ActivityPage'
import type { Household } from './lib/types'
import { api } from './lib/api'

export default function App() {
  const navigate = useNavigate()
  const [household, setHousehold] = useState<Household | null>(null)
  const [isSimulateOpen, setIsSimulateOpen] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)

  const fetchHousehold = async () => {
    try {
      const data = await api.getHousehold()
      setHousehold(data)
    } catch (err) {
      console.warn('Could not load household yet (backend might be starting):', err)
    }
  }

  useEffect(() => {
    fetchHousehold()
  }, [dataVersion])

  const handleEventCreated = (eventId: string) => {
    setDataVersion((v) => v + 1)
    navigate(`/events/${eventId}`)
  }

  const handleResetComplete = () => {
    setDataVersion((v) => v + 1)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[#F8F7F2] text-stone-900 flex flex-col font-sans selection:bg-emerald-200">
      {/* Safety Notice Banner */}
      <AlertBanner />

      {/* Main Navbar */}
      <Navbar
        household={household}
        onHouseholdUpdated={(h) => setHousehold(h)}
        onSimulateClick={() => setIsSimulateOpen(true)}
        onResetComplete={handleResetComplete}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Routes>
          <Route
            path="/"
            element={
              <DashboardPage
                household={household}
                onOpenSimulate={() => setIsSimulateOpen(true)}
              />
            }
          />
          <Route
            path="/events"
            element={<EventsPage onOpenSimulate={() => setIsSimulateOpen(true)} />}
          />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route
            path="/plans"
            element={<PlansPage onOpenSimulate={() => setIsSimulateOpen(true)} />}
          />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/activity" element={<ActivityPage />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white/60 py-6 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            <strong className="text-stone-700">HomeHalo</strong> — AI Home-Safety Coordination Prototype (Simulated Events Only)
          </p>
          <p className="text-[11px] text-stone-400">
            Amazon "Build, Ship, Shape" Hackathon (Alexa+ Track)
          </p>
        </div>
      </footer>

      {/* Simulation Modal */}
      <SimulationModal
        isOpen={isSimulateOpen}
        onClose={() => setIsSimulateOpen(false)}
        household={household}
        onEventCreated={handleEventCreated}
      />
    </div>
  )
}
