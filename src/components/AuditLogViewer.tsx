import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { AuditLog } from '../types'
import { X, ChevronDown, ChevronUp, Clock, User, Database, ArrowLeft, ArrowRight, Filter } from 'lucide-react'

interface AuditLogViewerProps {
  isOpen: boolean
  onClose: () => void
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  INSERT: { label: 'Skapad', color: 'bg-green-100 text-green-800' },
  UPDATE: { label: 'Uppdaterad', color: 'bg-blue-100 text-blue-800' },
  DELETE: { label: 'Raderad', color: 'bg-red-100 text-red-800' },
  RESTORE: { label: 'Återställd', color: 'bg-purple-100 text-purple-800' },
}

const TABLE_LABELS: Record<string, string> = {
  customers: 'Kund',
  contacts: 'Kontakt',
  sales: 'Försäljning',
}

// Field labels for Swedish display
const FIELD_LABELS: Record<string, string> = {
  foretagsnamn: 'Företagsnamn',
  kundnr: 'Kundnr',
  aktiv: 'Aktiv',
  adress: 'Adress',
  postnummer: 'Postnummer',
  stad: 'Stad',
  telefon: 'Telefon',
  bokat_besok: 'Bokat besök',
  anteckningar: 'Anteckningar',
  deleted_at: 'Raderad',
  namn: 'Namn',
  email: 'E-post',
  mobil: 'Mobil',
  role: 'Roll',
  senast_kontakt: 'Senast kontakt',
  aterkom: 'Återkom',
  erbjudanden: 'Erbjudanden',
  datum: 'Datum',
  belopp: 'Belopp',
  sald_konst: 'Såld konst',
}

export default function AuditLogViewer({ isOpen, onClose }: AuditLogViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [filterTable, setFilterTable] = useState<string>('all')
  const [filterAction, setFilterAction] = useState<string>('all')
  const itemsPerPage = 20

  // Helper to get field label
  const getFieldLabel = (field: string): string => {
    return FIELD_LABELS[field] || field
  }

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterTable, filterAction])

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', filterTable, filterAction],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        return []
      }

      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterTable !== 'all') {
        query = query.eq('table_name', filterTable)
      }

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction)
      }

      const { data, error } = await query.limit(500)

      if (error) throw error
      return data as AuditLog[]
    },
    enabled: isOpen && isSupabaseConfigured,
  })

  if (!isOpen) return null

  const totalPages = Math.ceil((logs?.length || 0) / itemsPerPage)
  const paginatedLogs = logs?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getRecordName = (log: AuditLog): string => {
    const data = log.new_data || log.old_data
    if (!data) return log.record_id.slice(0, 8)
    
    // Try common name fields
    if (data.foretagsnamn) return data.foretagsnamn as string
    if (data.namn) return data.namn as string
    if (data.sald_konst) return data.sald_konst as string
    
    return log.record_id.slice(0, 8)
  }

  const renderChangedFields = (log: AuditLog) => {
    if (!log.changed_fields || log.changed_fields.length === 0) return null
    if (!log.old_data || !log.new_data) return null

    // Helper to format values for display
    const formatValue = (value: any): string => {
      if (value === null || value === undefined) return '(tom)'
      if (value === true) return 'Ja'
      if (value === false) return 'Nej'
      if (value === '') return '(tom)'
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    }

    // Filter out technical fields and fields where both old and new are effectively empty
    const meaningfulChanges = log.changed_fields.filter((field) => {
      if (field === 'updated_at') return false
      const oldValue = log.old_data?.[field]
      const newValue = log.new_data?.[field]
      // Skip if both are empty/null
      if ((oldValue === null || oldValue === undefined || oldValue === '') &&
          (newValue === null || newValue === undefined || newValue === '')) {
        return false
      }
      return true
    })

    if (meaningfulChanges.length === 0) return null

    return (
      <div className="mt-3 space-y-2">
        <div className="text-xs font-medium text-gray-500 uppercase">Ändringar:</div>
        <div className="space-y-1">
          {meaningfulChanges.map((field) => {
            const oldValue = log.old_data?.[field]
            const newValue = log.new_data?.[field]
            
            return (
              <div key={field} className="text-sm bg-gray-50 rounded p-2">
                <span className="font-medium text-gray-700">{getFieldLabel(field)}:</span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 mt-1">
                  <span className="text-red-600 line-through text-xs">
                    {formatValue(oldValue)}
                  </span>
                  <span className="hidden sm:inline text-gray-400">→</span>
                  <span className="text-green-600 text-xs">
                    {formatValue(newValue)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Helper to format values for display (also used by renderNewData)
  const formatDisplayValue = (value: any): string => {
    if (value === null || value === undefined) return '(tom)'
    if (value === true) return 'Ja'
    if (value === false) return 'Nej'
    if (value === '') return '(tom)'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const renderNewData = (log: AuditLog) => {
    if (log.action !== 'INSERT' || !log.new_data) return null

    const relevantFields = Object.entries(log.new_data).filter(
      ([key, value]) => {
        // Skip technical fields
        if (['id', 'created_at', 'updated_at', 'deleted_at', 'customer_id'].includes(key)) return false
        // Skip empty values
        if (value === null || value === undefined || value === '') return false
        return true
      }
    )

    return (
      <div className="mt-3 space-y-2">
        <div className="text-xs font-medium text-gray-500 uppercase">Nya värden:</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {relevantFields.slice(0, 8).map(([key, value]) => (
            <div key={key} className="bg-gray-50 rounded p-2">
              <span className="font-medium text-gray-600">{getFieldLabel(key)}:</span>{' '}
              <span className="text-gray-800">
                {formatDisplayValue(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-xl shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-4 sm:px-6 flex-shrink-0 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Ändringshistorik
            </h2>
            <button
              onClick={onClose}
              className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
                  <select
                    value={filterTable}
                    onChange={(e) => setFilterTable(e.target.value)}
                    className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="all">Alla tabeller</option>
                    <option value="customers">Kunder</option>
                    <option value="contacts">Kontakter</option>
                    <option value="sales">Försäljningar</option>
                  </select>
                </div>

                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="all">Alla åtgärder</option>
                  <option value="INSERT">Skapade</option>
                  <option value="UPDATE">Uppdaterade</option>
                  <option value="DELETE">Raderade</option>
                  <option value="RESTORE">Återställda</option>
                </select>

                {logs && (
                  <span className="text-sm text-gray-500 ml-auto">
                    {logs.length} poster
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {!isSupabaseConfigured ? (
                <div className="text-center py-12">
                  <Database className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-500">
                    Ändringshistorik är inte tillgänglig i demo-läge.
                  </p>
                </div>
              ) : isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : !paginatedLogs || paginatedLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-500">Inga ändringar hittades.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedLogs.map((log) => {
                    const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-800' }
                    const isExpanded = expandedLog === log.id

                    return (
                      <div
                        key={log.id}
                        className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${actionInfo.color}`}>
                              {actionInfo.label}
                            </span>
                            <span className="text-sm text-gray-500">
                              {TABLE_LABELS[log.table_name] || log.table_name}
                            </span>
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {getRecordName(log)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-xs text-gray-400">
                              {formatDate(log.created_at)}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-gray-100">
                            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                              <User className="h-4 w-4" />
                              <span>{log.user_email || 'Okänd användare'}</span>
                            </div>

                            {log.action === 'UPDATE' && renderChangedFields(log)}
                            {log.action === 'INSERT' && renderNewData(log)}
                            
                            {log.action === 'DELETE' && log.old_data && (
                              <div className="mt-3">
                                <div className="text-xs font-medium text-gray-500 uppercase mb-2">Raderad data:</div>
                                <div className="text-sm text-gray-600 bg-red-50 rounded p-2">
                                  {log.old_data.foretagsnamn !== undefined && (
                                    <div><strong>Företag:</strong> {String(log.old_data.foretagsnamn)}</div>
                                  )}
                                  {log.old_data.namn !== undefined && (
                                    <div><strong>Namn:</strong> {String(log.old_data.namn)}</div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="mt-3 text-xs text-gray-400">
                              ID: {log.record_id}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-gray-200 px-4 py-3 sm:px-6 flex-shrink-0 rounded-b-xl">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Föregående
                  </button>
                  <span className="text-sm text-gray-600">
                    Sida {currentPage} av {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Nästa
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
    </div>
  )
}
