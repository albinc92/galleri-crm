import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react'
import { CustomerWithContacts } from '../types'
import { supabase } from '../lib/supabase'

interface ExcelUploaderProps {
  onUploadComplete: () => void
}

// Helper function to convert Excel date serial to ISO date string
const excelDateToISO = (serial: any): string | null => {
  if (!serial) return null
  
  // If it's already a string
  if (typeof serial === 'string') {
    // Check if it's already a valid date format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(serial)) {
      // Validate the actual date
      const date = new Date(serial)
      if (!isNaN(date.getTime())) {
        return serial
      }
    }
    // Handle partial dates like "2018-05" (missing day)
    if (/^\d{4}-\d{2}$/.test(serial)) {
      return `${serial}-01` // Default to first day of month
    }
    // If it's some other string format, try parsing it
    const parsed = new Date(serial)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]
    }
    return null
  }
  
  // Convert Excel serial number to date
  const excelEpoch = new Date(1899, 11, 30) // Excel's epoch
  const days = typeof serial === 'number' ? serial : parseFloat(serial)
  
  if (isNaN(days)) return null
  
  const date = new Date(excelEpoch.getTime() + days * 86400000)
  
  // Validate the date is reasonable (not in far future/past)
  if (date.getFullYear() < 1900 || date.getFullYear() > 2100) return null
  
  return date.toISOString().split('T')[0] // Return YYYY-MM-DD
}

export default function ExcelUploader({ onUploadComplete }: ExcelUploaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'progress' | null
    message: string
  }>({ type: null, message: '' })
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      // Transform Excel data to CustomerWithContacts format
      const customers: CustomerWithContacts[] = jsonData.map((row: any, index: number) => {
        const customer: CustomerWithContacts = {
          id: `imported-${index}-${Date.now()}`,
          kundnr: String(row['Kundnr'] || `K${String(index + 1).padStart(3, '0')}`),
          aktiv: String(row['Aktiv kund'] || 'NEJ').toUpperCase(),
          foretagsnamn: row['Namn'] || '',
          adress: row['Adress'] || '',
          postnummer: row['Postnr'] || '',
          stad: row['Postadress'] || '',
          telefon: row['Telefon'] || '',
          bokat_besok: !!row['Nästa besök'],
          anteckningar: [
            row['Intresse'] ? `Intresse: ${row['Intresse']}` : '',
            row['Köpt vad'] ? `Köpt: ${row['Köpt vad']}` : '',
            row['Köpt vad innan'] ? `Tidigare köp: ${row['Köpt vad innan']}` : '',
            row['Text email Erbjudande 1'] ? `Erbjudande 1: ${row['Text email Erbjudande 1']}` : '',
            row['Text email Erbjudande 2'] ? `Erbjudande 2: ${row['Text email Erbjudande 2']}` : '',
          ].filter(Boolean).join('\n\n') || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          contacts: [],
          sales: [],
        }

        // Add Ordförande contact if data exists
        if (row['Namn Ordförande'] || row['Email Ordförande']) {
          customer.contacts!.push({
            id: `contact-ordf-${index}-${Date.now()}`,
            customer_id: customer.id,
            role: 'ordforande',
            namn: row['Namn Ordförande'] || '',
            email: row['Email Ordförande'] || '',
            telefon: row['Tel ordförande'] || '',
            mobil: row['Mobil Ordförande'] || '',
            senast_kontakt: row['Kontakt Ordf'] || '',
            aterkom: row['Återkom Ordförande'] || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }

        // Add Kassör contact if data exists
        if (row['Namn Kassör'] || row['Email Kassör']) {
          customer.contacts!.push({
            id: `contact-kass-${index}-${Date.now()}`,
            customer_id: customer.id,
            role: 'kassor',
            namn: row['Namn Kassör'] || '',
            email: row['Email Kassör'] || '',
            telefon: row['Tel kassör'] || '',
            mobil: row['Mobil Kassör'] || '',
            senast_kontakt: row['Kontakt Kassör'] || '',
            aterkom: row['Återkom Kassör'] || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }

        // Add Ansvarig contact if data exists
        if (row['Namn Ansvarig 1'] || row['Email Ansvarig 1']) {
          customer.contacts!.push({
            id: `contact-ansv-${index}-${Date.now()}`,
            customer_id: customer.id,
            role: 'ansvarig',
            namn: row['Namn Ansvarig 1'] || '',
            email: row['Email Ansvarig 1'] || '',
            telefon: row['Tel Ansvarig 1'] || '',
            mobil: row['Mobil Ansvarig 1'] || '',
            senast_kontakt: row['Kontakt Ansv 1'] || '',
            aterkom: row['Återkom Ansv 1'] || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }

        // Add sales data if exists
        if (row['Köpt vad'] && row['Senaste besök']) {
          customer.sales!.push({
            id: `sale-${index}-${Date.now()}`,
            customer_id: customer.id,
            datum: row['Senaste besök'] || '',
            belopp: 0, // Not in Excel
            sald_konst: row['Köpt vad'] || '',
            created_at: new Date().toISOString(),
          })
        }

        return customer
      })

      // Insert customers into Supabase
      let successCount = 0
      let errorCount = 0
      
      setProgress({ current: 0, total: customers.length })
      setStatus({
        type: 'progress',
        message: `Importerar 0/${customers.length} kunder...`,
      })

      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i]
        try {
          // Update progress
          setProgress({ current: i + 1, total: customers.length })
          setStatus({
            type: 'progress',
            message: `Importerar ${i + 1}/${customers.length} kunder...`,
          })

          // Insert customer (without contacts and sales)
          const { data: insertedCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              kundnr: customer.kundnr,
              aktiv: customer.aktiv,
              foretagsnamn: customer.foretagsnamn,
              adress: customer.adress,
              postnummer: customer.postnummer,
              stad: customer.stad,
              telefon: customer.telefon,
              bokat_besok: customer.bokat_besok,
              anteckningar: customer.anteckningar,
            })
            .select()
            .single()

          if (customerError) {
            // Skip duplicates silently
            if (customerError.code === '23505') {
              console.log(`Skipping duplicate customer: ${customer.kundnr}`)
              continue
            }
            throw customerError
          }

          // Insert contacts if any
          if (customer.contacts && customer.contacts.length > 0) {
            const contactsToInsert = customer.contacts.map(contact => ({
              customer_id: insertedCustomer.id,
              role: contact.role,
              namn: contact.namn,
              telefon: contact.telefon,
              mobil: contact.mobil,
              email: contact.email,
              senast_kontakt: excelDateToISO(contact.senast_kontakt),
              aterkom: excelDateToISO(contact.aterkom),
            }))

            const { error: contactsError } = await supabase
              .from('contacts')
              .insert(contactsToInsert)

            if (contactsError) console.error('Error inserting contacts:', contactsError)
          }

          // Insert sales if any
          if (customer.sales && customer.sales.length > 0) {
            const salesToInsert = customer.sales.map(sale => ({
              customer_id: insertedCustomer.id,
              datum: excelDateToISO(sale.datum),
              belopp: sale.belopp,
              sald_konst: sale.sald_konst,
            }))

            const { error: salesError } = await supabase
              .from('sales')
              .insert(salesToInsert)

            if (salesError) console.error('Error inserting sales:', salesError)
          }

          successCount++
        } catch (error: any) {
          console.error('Error inserting customer:', error)
          errorCount++
        }
      }

      if (errorCount === 0) {
        setStatus({
          type: 'success',
          message: `✅ Successfully imported ${successCount} customers!`,
        })
      } else {
        setStatus({
          type: 'error',
          message: `⚠️ Imported ${successCount} customers, ${errorCount} failed.`,
        })
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Notify parent and close after delay
      setTimeout(() => {
        onUploadComplete()
        setIsOpen(false)
        setStatus({ type: null, message: '' })
      }, 2000)
    } catch (error: any) {
      setStatus({
        type: 'error',
        message: `❌ Error importing file: ${error.message}`,
      })
    }
  }

  const handleClearData = async () => {
    if (confirm('Are you sure you want to delete all customer data from the database?')) {
      try {
        const { error } = await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        
        if (error) throw error

        setStatus({
          type: 'success',
          message: '🗑️ All customer data deleted!',
        })
        setTimeout(() => {
          onUploadComplete()
          setIsOpen(false)
          setStatus({ type: null, message: '' })
        }, 1500)
      } catch (error: any) {
        setStatus({
          type: 'error',
          message: `❌ Error deleting data: ${error.message}`,
        })
      }
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Upload className="w-5 h-5" />
        Import Excel
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Import Customer Data</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Instructions:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Upload an Excel file (.xlsx or .xls)</li>
              <li>First row should contain column headers</li>
              <li>Supports columns: Kundnr, Namn, Adress, Postnr, Telefon, Aktiv kund, etc.</li>
              <li>Will import contacts (Ordförande, Kassör, Ansvarig) and sales data</li>
              <li>Data will be stored in Supabase cloud database</li>
            </ul>
          </div>

          {status.type && (
            <div
              className={`flex flex-col gap-2 p-3 rounded-lg ${
                status.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : status.type === 'progress'
                  ? 'bg-blue-50 text-blue-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              <div className="flex items-start gap-2">
                {status.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : status.type === 'progress' ? (
                  <div className="w-5 h-5 flex-shrink-0 mt-0.5">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm">{status.message}</p>
              </div>
              {status.type === 'progress' && progress.total > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}

          <div className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors ${status.type === 'progress' ? 'opacity-50 pointer-events-none' : 'hover:border-blue-400'}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="excel-upload"
              disabled={status.type === 'progress'}
            />
            <label
              htmlFor="excel-upload"
              className={`flex flex-col items-center gap-3 ${status.type === 'progress' ? '' : 'cursor-pointer'}`}
            >
              <Upload className="w-12 h-12 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {status.type === 'progress' ? 'Uploading...' : 'Click to upload Excel file'}
                </p>
                <p className="text-xs text-gray-500 mt-1">.xlsx or .xls files only</p>
              </div>
            </label>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <button
              onClick={handleClearData}
              className="text-sm text-red-600 hover:text-red-700 hover:underline"
            >
              Clear all data
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
