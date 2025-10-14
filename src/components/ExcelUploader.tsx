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
      const customers: CustomerWithContacts[] = jsonData.map((row: any, index: number) => ({
        id: `imported-${index}-${Date.now()}`,
        kundnr: row['Kundnr'] || row['kundnr'] || `K${String(index + 1).padStart(3, '0')}`,
        aktiv: row['Aktiv'] === 'Ja' || row['aktiv'] === true || row['Aktiv'] === true || true,
        foretagsnamn: row['Företagsnamn'] || row['foretagsnamn'] || row['Företag'] || '',
        adress: row['Adress'] || row['adress'] || '',
        postnummer: row['Postnummer'] || row['postnummer'] || '',
        stad: row['Stad'] || row['stad'] || '',
        telefon: row['Telefon'] || row['telefon'] || row['Telefon företag'] || '',
        bokat_besok: row['Bokat besök'] === 'Ja' || row['bokat_besok'] === true || false,
        anteckningar: row['Anteckningar'] || row['anteckningar'] || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        contacts: [],
        sales: [],
      }))

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
              <li>Expected columns: Kundnr, Företagsnamn, Adress, Postnummer, Stad, Telefon, etc.</li>
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
