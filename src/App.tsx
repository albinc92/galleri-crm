import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { Session } from '@supabase/supabase-js'
import Auth from './components/Auth'
import CustomerList from './components/CustomerList'
import AuditLogViewer from './components/AuditLogViewer'
import BackupReminder from './components/BackupReminder'
import AccountSettings from './components/AccountSettings'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [showAccountSettings, setShowAccountSettings] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: Session | null) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Laddar...</div>
      </div>
    )
  }

  // Demo mode when Supabase is not configured
  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">🎨 Galleri CRM</h1>
            <span className="text-sm text-gray-500">(Demoläge)</span>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Demoläge - Supabase ej konfigurerad</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Konfigurera Supabase-uppgifter i <code className="bg-yellow-100 px-1 rounded">.env</code> för att aktivera full funktionalitet.</p>
                </div>
              </div>
            </div>
          </div>
          <CustomerList />
        </main>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">🎨 Galleri CRM</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowAuditLog(true)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              title="Visa ändringshistorik"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              Historik
            </button>
            <button
              onClick={() => setShowAccountSettings(true)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              title="Kontoinställningar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Konto
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logga ut
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <CustomerList />
      </main>
      <AuditLogViewer isOpen={showAuditLog} onClose={() => setShowAuditLog(false)} />
      <AccountSettings 
        isOpen={showAccountSettings} 
        onClose={() => setShowAccountSettings(false)} 
        userEmail={session?.user?.email || ''}
      />
      <BackupReminder />
    </div>
  )
}

export default App
