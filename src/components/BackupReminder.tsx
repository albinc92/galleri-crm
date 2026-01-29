import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { CustomerWithContacts } from '../types'
import { Download, X, Clock, AlertTriangle, CheckCircle } from 'lucide-react'

const BACKUP_INTERVAL_DAYS = 30

interface BackupReminderProps {
  onBackupComplete?: () => void
}

export default function BackupReminder({ onBackupComplete }: BackupReminderProps) {
  const [showReminder, setShowReminder] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const queryClient = useQueryClient()

  // Fetch last backup date from database
  const { data: lastBackupSetting } = useQuery({
    queryKey: ['system-settings', 'last_backup_date'],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) return null

      const { data, error } = await supabase
        .from('system_settings')
        .select('value, updated_at')
        .eq('key', 'last_backup_date')
        .single()

      if (error) {
        // Table might not exist yet
        console.log('Could not fetch backup setting:', error.message)
        return null
      }
      return data
    },
  })

  // Mutation to update backup date
  const updateBackupDate = useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured || !supabase) return

      const now = new Date().toISOString()
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'last_backup_date',
          value: now,
          updated_at: now,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'last_backup_date'] })
    },
  })

  // Check if backup reminder should be shown
  useEffect(() => {
    const checkBackupNeeded = () => {
      if (!lastBackupSetting) {
        // Never backed up or settings not loaded - show reminder
        setShowReminder(true)
        return
      }

      const lastBackupValue = lastBackupSetting.value
      if (!lastBackupValue) {
        setShowReminder(true)
        return
      }

      const lastBackupDate = new Date(lastBackupValue)
      const now = new Date()
      const daysSinceBackup = Math.floor((now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysSinceBackup >= BACKUP_INTERVAL_DAYS) {
        setShowReminder(true)
      }
    }

    // Check after settings are loaded
    if (lastBackupSetting !== undefined) {
      const timer = setTimeout(checkBackupNeeded, 1000)
      return () => clearTimeout(timer)
    }
  }, [lastBackupSetting])

  // Fetch all customers for export
  const { data: customers, refetch } = useQuery({
    queryKey: ['customers-backup'],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        const stored = localStorage.getItem('galleri-customers')
        return stored ? JSON.parse(stored) as CustomerWithContacts[] : []
      }

      // Fetch all customers including deleted ones for complete backup
      const BATCH_SIZE = 1000
      let allData: CustomerWithContacts[] = []
      let from = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('customers')
          .select(`
            *,
            contacts(*),
            sales(*)
          `)
          .order('foretagsnamn')
          .range(from, from + BATCH_SIZE - 1)

        if (error) throw error
        
        if (data && data.length > 0) {
          allData = [...allData, ...data]
          from += BATCH_SIZE
          hasMore = data.length === BATCH_SIZE
        } else {
          hasMore = false
        }
      }

      return allData as CustomerWithContacts[]
    },
    enabled: showReminder, // Only fetch when reminder is shown
  })

  const getLastBackupText = (): string => {
    if (!lastBackupSetting?.value) return 'Aldrig'
    
    const lastBackupDate = new Date(lastBackupSetting.value)
    const now = new Date()
    const daysSinceBackup = Math.floor((now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceBackup === 0) return 'Idag'
    if (daysSinceBackup === 1) return 'Igår'
    return `${daysSinceBackup} dagar sedan`
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    
    try {
      // Refetch to get latest data
      const result = await refetch()
      const data = result.data || []

      if (data.length === 0) {
        alert('Inga kunder att exportera')
        setIsExporting(false)
        return
      }

      // Flatten data for Excel
      const exportData = data.map((customer: any) => {
        const ordforande = customer.contacts?.find((c: any) => c.role === 'ordforande')
        const kassor = customer.contacts?.find((c: any) => c.role === 'kassor')
        const lastSale = customer.sales?.[customer.sales.length - 1]

        return {
          'Kundnr': customer.kundnr,
          'Aktiv kund': customer.aktiv,
          'Namn': customer.foretagsnamn,
          'Adress': customer.adress,
          'Postnr': customer.postnummer,
          'Postadress': customer.stad,
          'Telefon': customer.telefon,
          'Bokat besök': customer.bokat_besok ? 'JA' : 'NEJ',
          'Raderad': customer.deleted_at ? 'JA' : 'NEJ',
          'Anteckningar': customer.anteckningar,
          // Ordförande
          'Namn Ordförande': ordforande?.namn || '',
          'Email Ordförande': ordforande?.email || '',
          'Tel ordförande': ordforande?.telefon || '',
          'Mobil Ordförande': ordforande?.mobil || '',
          'Kontakt Ordf': ordforande?.senast_kontakt || '',
          'Återkom Ordförande': ordforande?.aterkom || '',
          // Kassör
          'Namn Kassör': kassor?.namn || '',
          'Email Kassör': kassor?.email || '',
          'Tel kassör': kassor?.telefon || '',
          'Mobil Kassör': kassor?.mobil || '',
          'Kontakt Kassör': kassor?.senast_kontakt || '',
          'Återkom Kassör': kassor?.aterkom || '',
          // Sales
          'Senaste besök': lastSale?.datum || '',
          'Köpt vad': lastSale?.sald_konst || '',
        }
      })

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Kunder')

      // Generate filename with date
      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `galleri_backup_${dateStr}.xlsx`

      // Download
      XLSX.writeFile(wb, filename)

      // Update last backup date in database
      await updateBackupDate.mutateAsync()
      
      setExportSuccess(true)
      setTimeout(() => {
        setShowReminder(false)
        setExportSuccess(false)
        onBackupComplete?.()
      }, 2000)

    } catch (error: any) {
      console.error('Export failed:', error)
      alert('Kunde inte exportera: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDismiss = () => {
    // Just close without updating backup date - will remind again on next visit
    setShowReminder(false)
  }

  const handleRemindLater = async () => {
    // Set a partial reminder - will remind in 7 days instead of 30
    if (isSupabaseConfigured && supabase) {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - (BACKUP_INTERVAL_DAYS - 7))
      
      await supabase
        .from('system_settings')
        .upsert({
          key: 'last_backup_date',
          value: sevenDaysAgo.toISOString(),
          updated_at: new Date().toISOString(),
        })
      
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'last_backup_date'] })
    }
    setShowReminder(false)
  }

  if (!showReminder) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              {exportSuccess ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <Clock className="w-5 h-5 text-amber-600" />
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {exportSuccess ? 'Backup klar!' : 'Dags för backup'}
            </h2>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {exportSuccess ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-700">Din backup har laddats ner!</p>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    <strong>Rekommendation:</strong> Säkerhetskopiera din data regelbundet för att undvika dataförlust.
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Senaste backup:</span>
                  <span className="font-medium text-gray-900">{getLastBackupText()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Antal kunder:</span>
                  <span className="font-medium text-gray-900">{customers?.length || '...'}</span>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Ladda ner en Excel-fil med alla dina kunder, kontakter och försäljningar.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        {!exportSuccess && (
          <div className="flex flex-col gap-2 p-4 border-t bg-gray-50">
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              {isExporting ? 'Exporterar...' : 'Ladda ner backup (Excel)'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleRemindLater}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Påminn om 7 dagar
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
              >
                Stäng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
