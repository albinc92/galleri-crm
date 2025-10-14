import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react'
import { CustomerWithContacts } from '../types'
import { storageService } from '../lib/storage'

interface ExcelUploaderProps {
  onUploadComplete: () => void
}

export default function ExcelUploader({ onUploadComplete }: ExcelUploaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null
    message: string
  }>({ type: null, message: '' })
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
        // In this Excel format:
        // - "Adress" = street address (e.g., "FURUVÄGEN 23")
        // - "Postadress" = city + postal code (e.g., "BEDDINGESTRAND 231 76" or "LUND 221 86")
        const streetAddress = row['Adress'] || ''
        const postadress = row['Postadress'] || ''
        
        // Extract city and postal code from Postadress
        // Format is typically "CITY POSTNR" like "BEDDINGESTRAND 231 76"
        let stad = ''
        let postnummer = row['Postnr'] || ''
        
        if (postadress) {
          // Try to extract city and postal code
          // Pattern: "CITY ### ##" where city can be multiple words
          const match = postadress.match(/^(.+?)\s+(\d{3}\s?\d{2})$/)
          if (match) {
            stad = match[1].trim()
            postnummer = postnummer || match[2].replace(/\s+/g, ' ').trim()
          } else {
            // If no postal code found, treat entire string as city
            stad = postadress.trim()
          }
        }

        const customer: CustomerWithContacts = {
          id: `imported-${index}-${Date.now()}`,
          kundnr: String(row['Kundnr'] || `K${String(index + 1).padStart(3, '0')}`),
          aktiv: String(row['Aktiv kund'] || 'NEJ').toUpperCase(),
          foretagsnamn: row['Namn'] || '',
          adress: streetAddress,
          postnummer: postnummer,
          stad: stad,
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
            role: 'ordforande', // Use ordforande role as placeholder
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

      // Save to localStorage
      storageService.saveCustomers(customers)

      setStatus({
        type: 'success',
        message: `✅ Successfully imported ${customers.length} customers!`,
      })

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

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all customer data from localStorage?')) {
      storageService.clearCustomers()
      setStatus({
        type: 'success',
        message: '🗑️ All customer data cleared!',
      })
      setTimeout(() => {
        onUploadComplete()
        setIsOpen(false)
        setStatus({ type: null, message: '' })
      }, 1500)
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
              <li>Data will be stored in browser localStorage (demo mode)</li>
            </ul>
          </div>

          {status.type && (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg ${
                status.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm">{status.message}</p>
            </div>
          )}

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="excel-upload"
            />
            <label
              htmlFor="excel-upload"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <Upload className="w-12 h-12 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Click to upload Excel file
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
