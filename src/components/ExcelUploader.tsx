import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, X, AlertCircle, CheckCircle, FileSearch, Download } from 'lucide-react'
import { CustomerWithContacts } from '../types'
import { supabase } from '../lib/supabase'

interface ExcelUploaderProps {
  onUploadComplete: () => void
  compact?: boolean
}

// Validation issue types
interface ValidationIssue {
  row: number
  field: string
  value: string
  type: 'error' | 'warning'
  message: string
}

interface ValidationReport {
  totalRows: number
  validRows: number
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  duplicateKundnr: Map<string, number[]>
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

export default function ExcelUploader({ onUploadComplete, compact = false }: ExcelUploaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null)
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'progress' | 'validation' | null
    message: string
  }>({ type: null, message: '' })
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [errors, setErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const validateInputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef(false)

  // Email validation regex
  const isValidEmail = (email: string): boolean => {
    if (!email) return true // Empty is ok
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // Phone validation (basic - just check it's not obviously wrong)
  const isValidPhone = (phone: string): boolean => {
    if (!phone) return true
    // Should contain at least some digits
    return /\d{3,}/.test(phone.replace(/[\s\-\+\(\)]/g, ''))
  }

  // Validate Excel file without importing
  const handleValidateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsValidating(true)
    setValidationReport(null)
    setStatus({ type: 'progress', message: 'Validerar fil...' })

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      const report: ValidationReport = {
        totalRows: jsonData.length,
        validRows: 0,
        errors: [],
        warnings: [],
        duplicateKundnr: new Map(),
      }

      // Track kundnr for duplicate detection
      const kundnrMap = new Map<string, number[]>()

      // Validate each row
      jsonData.forEach((row: any, index: number) => {
        const rowNum = index + 2 // Excel rows start at 1, plus header row
        let hasError = false

        // Check Kundnr
        const kundnr = String(row['Kundnr'] || '').trim()
        if (!kundnr) {
          report.warnings.push({
            row: rowNum,
            field: 'Kundnr',
            value: '',
            type: 'warning',
            message: 'Saknar Kundnr - kommer att autogenereras',
          })
        } else {
          // Track for duplicates
          if (!kundnrMap.has(kundnr)) {
            kundnrMap.set(kundnr, [])
          }
          kundnrMap.get(kundnr)!.push(rowNum)
        }

        // Check company name (required)
        const namn = String(row['Namn'] || '').trim()
        if (!namn) {
          report.errors.push({
            row: rowNum,
            field: 'Namn',
            value: '',
            type: 'error',
            message: 'Saknar företagsnamn (Namn) - obligatoriskt fält',
          })
          hasError = true
        }

        // Validate emails
        const emails = [
          { field: 'Email Ordförande', value: row['Email Ordförande'] },
          { field: 'Email Kassör', value: row['Email Kassör'] },
          { field: 'Email Ansvarig 1', value: row['Email Ansvarig 1'] },
        ]
        
        emails.forEach(({ field, value }) => {
          if (value && !isValidEmail(String(value).trim())) {
            report.warnings.push({
              row: rowNum,
              field,
              value: String(value),
              type: 'warning',
              message: `Ogiltigt e-postformat: "${value}"`,
            })
          }
        })

        // Validate phone numbers
        const phones = [
          { field: 'Telefon', value: row['Telefon'] },
          { field: 'Tel ordförande', value: row['Tel ordförande'] },
          { field: 'Mobil Ordförande', value: row['Mobil Ordförande'] },
          { field: 'Tel kassör', value: row['Tel kassör'] },
          { field: 'Mobil Kassör', value: row['Mobil Kassör'] },
        ]

        phones.forEach(({ field, value }) => {
          if (value && !isValidPhone(String(value))) {
            report.warnings.push({
              row: rowNum,
              field,
              value: String(value),
              type: 'warning',
              message: `Ovanligt telefonformat: "${value}"`,
            })
          }
        })

        // Check for completely empty rows (only has auto-generated fields)
        const hasAnyData = namn || row['Adress'] || row['Telefon'] || 
          row['Namn Ordförande'] || row['Namn Kassör']
        
        if (!hasAnyData) {
          report.warnings.push({
            row: rowNum,
            field: '(hela raden)',
            value: '',
            type: 'warning',
            message: 'Tom rad utan användbar data',
          })
        }

        if (!hasError) {
          report.validRows++
        }
      })

      // Add duplicate errors
      kundnrMap.forEach((rows, kundnr) => {
        if (rows.length > 1) {
          report.duplicateKundnr.set(kundnr, rows)
          rows.forEach(row => {
            report.errors.push({
              row,
              field: 'Kundnr',
              value: kundnr,
              type: 'error',
              message: `Duplicerat Kundnr "${kundnr}" finns även på rad ${rows.filter(r => r !== row).join(', ')}`,
            })
          })
          // Adjust valid count for duplicates
          report.validRows = Math.max(0, report.validRows - (rows.length - 1))
        }
      })

      // Sort errors by row number
      report.errors.sort((a, b) => a.row - b.row)
      report.warnings.sort((a, b) => a.row - b.row)

      setValidationReport(report)
      setIsValidating(false)
      
      if (report.errors.length === 0) {
        setStatus({
          type: 'success',
          message: `✅ Validering klar! ${report.validRows} av ${report.totalRows} rader är redo att importeras.`,
        })
      } else {
        setStatus({
          type: 'validation',
          message: `⚠️ Hittade ${report.errors.length} fel och ${report.warnings.length} varningar`,
        })
      }

      // Reset file input
      if (validateInputRef.current) {
        validateInputRef.current.value = ''
      }
    } catch (error: any) {
      setIsValidating(false)
      setStatus({
        type: 'error',
        message: `❌ Fel vid validering: ${error.message}`,
      })
    }
  }

  // Generate and download validation report
  const downloadValidationReport = () => {
    if (!validationReport) return

    // Calculate non-duplicate errors
    const nonDuplicateErrors = validationReport.errors.filter(err => !err.message.startsWith('Duplicerat Kundnr'))
    const duplicateCount = validationReport.duplicateKundnr.size

    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════',
      '                    VALIDERINGSRAPPORT',
      `                    ${new Date().toLocaleString('sv-SE')}`,
      '═══════════════════════════════════════════════════════════════',
      '',
      `Totalt antal rader: ${validationReport.totalRows}`,
      `Giltiga rader: ${validationReport.validRows}`,
      `Duplicerade kundnummer: ${duplicateCount}`,
      `Andra fel: ${nonDuplicateErrors.length}`,
      `Varningar: ${validationReport.warnings.length}`,
      '',
    ]

    if (validationReport.duplicateKundnr.size > 0) {
      lines.push('───────────────────────────────────────────────────────────────')
      lines.push('DUPLICERADE KUNDNUMMER:')
      lines.push('───────────────────────────────────────────────────────────────')
      validationReport.duplicateKundnr.forEach((rows, kundnr) => {
        lines.push(`  "${kundnr}" finns på raderna: ${rows.join(', ')}`)
      })
      lines.push('')
    }

    if (nonDuplicateErrors.length > 0) {
      lines.push('───────────────────────────────────────────────────────────────')
      lines.push('FEL (måste åtgärdas innan import):')
      lines.push('───────────────────────────────────────────────────────────────')
      nonDuplicateErrors.forEach(err => {
        lines.push(`  Rad ${err.row}: ${err.message}`)
      })
      lines.push('')
    }

    if (validationReport.warnings.length > 0) {
      lines.push('───────────────────────────────────────────────────────────────')
      lines.push('VARNINGAR (kan importeras men bör kontrolleras):')
      lines.push('───────────────────────────────────────────────────────────────')
      validationReport.warnings.forEach(warn => {
        lines.push(`  Rad ${warn.row}: [${warn.field}] ${warn.message}`)
      })
      lines.push('')
    }

    lines.push('═══════════════════════════════════════════════════════════════')

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `validering_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Cancel upload when modal closes
  const handleClose = () => {
    if (isUploading) {
      cancelRef.current = true
    }
    setIsOpen(false)
    setStatus({ type: null, message: '' })
    setIsUploading(false)
    setValidationReport(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    cancelRef.current = false
    setIsUploading(true)

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
            namn: row['Namn Ordförande'] || null,
            email: row['Email Ordförande'] || null,
            telefon: row['Tel ordförande'] || null,
            mobil: row['Mobil Ordförande'] || null,
            senast_kontakt: row['Kontakt Ordf'] || null,
            aterkom: row['Återkom Ordförande'] || null,
            erbjudanden: false,
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
            namn: row['Namn Kassör'] || null,
            email: row['Email Kassör'] || null,
            telefon: row['Tel kassör'] || null,
            mobil: row['Mobil Kassör'] || null,
            senast_kontakt: row['Kontakt Kassör'] || null,
            aterkom: row['Återkom Kassör'] || null,
            erbjudanden: false,
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
            namn: row['Namn Ansvarig 1'] || null,
            email: row['Email Ansvarig 1'] || null,
            telefon: row['Tel Ansvarig 1'] || null,
            mobil: row['Mobil Ansvarig 1'] || null,
            senast_kontakt: row['Kontakt Ansv 1'] || null,
            aterkom: row['Återkom Ansv 1'] || null,
            erbjudanden: false,
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
      const errorMessages: string[] = []
      
      setProgress({ current: 0, total: customers.length })
      setErrors([])
      setStatus({
        type: 'progress',
        message: `Importerar 0/${customers.length} kunder...`,
      })

      for (let i = 0; i < customers.length; i++) {
        // Check if cancelled
        if (cancelRef.current) {
          setStatus({
            type: 'error',
            message: `Import avbruten. ${successCount} kunder importerades.`,
          })
          setIsUploading(false)
          return
        }
        
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

            if (contactsError) {
              console.error('Error inserting contacts:', contactsError)
              errorMessages.push(`${customer.foretagsnamn} (contacts): ${contactsError.message}`)
            }
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

            if (salesError) {
              console.error('Error inserting sales:', salesError)
              errorMessages.push(`${customer.foretagsnamn} (sales): ${salesError.message}`)
            }
          }

          successCount++
        } catch (error: any) {
          console.error('Error inserting customer:', error)
          errorCount++
          errorMessages.push(`${customer.foretagsnamn || customer.kundnr || 'Unknown'}: ${error.message}`)
        }
      }

      // Set collected errors
      setErrors(errorMessages)
      setIsUploading(false)

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
        handleClose()
      }, 2000)
    } catch (error: any) {
      setIsUploading(false)
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
          handleClose()
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
    if (compact) {
      return (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Upload className="w-4 h-4" />
          Import Excel
        </button>
      )
    }
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
      >
        <Upload className="w-4 h-4" />
        Import Excel
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Import Customer Data</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Instructions:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Steg 1:</strong> Validera filen först för att hitta problem</li>
              <li><strong>Steg 2:</strong> Ladda ner rapporten och åtgärda fel i Excel</li>
              <li><strong>Steg 3:</strong> När valideringen är OK, importera filen</li>
            </ul>
          </div>

          {status.type && (
            <div
              className={`flex flex-col gap-2 p-3 rounded-lg ${
                status.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : status.type === 'progress'
                  ? 'bg-blue-50 text-blue-800'
                  : status.type === 'validation'
                  ? 'bg-amber-50 text-amber-800'
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

          {/* Validation Report */}
          {validationReport && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Valideringsresultat</h3>
                <button
                  onClick={downloadValidationReport}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Ladda ner rapport
                </button>
              </div>
              
              <div className="p-4 space-y-3">
                {/* Summary - calculate non-duplicate errors for display */}
                {(() => {
                  const nonDuplicateErrors = validationReport.errors.filter(err => !err.message.startsWith('Duplicerat Kundnr'))
                  const duplicateCount = validationReport.duplicateKundnr.size
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-2xl font-bold text-gray-900">{validationReport.totalRows}</div>
                        <div className="text-xs text-gray-600">Totalt</div>
                      </div>
                      <div className="bg-green-50 rounded p-2">
                        <div className="text-2xl font-bold text-green-600">{validationReport.validRows}</div>
                        <div className="text-xs text-green-700">Giltiga</div>
                      </div>
                      <div className="bg-red-50 rounded p-2">
                        <div className="text-2xl font-bold text-red-600">{duplicateCount}</div>
                        <div className="text-xs text-red-700">Dubletter</div>
                      </div>
                      <div className="bg-orange-50 rounded p-2">
                        <div className="text-2xl font-bold text-orange-600">{nonDuplicateErrors.length}</div>
                        <div className="text-xs text-orange-700">Andra fel</div>
                      </div>
                      <div className="bg-amber-50 rounded p-2">
                        <div className="text-2xl font-bold text-amber-600">{validationReport.warnings.length}</div>
                        <div className="text-xs text-amber-700">Varningar</div>
                      </div>
                    </div>
                  )
                })()}

                {/* Duplicates */}
                {validationReport.duplicateKundnr.size > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <h4 className="text-sm font-semibold text-red-800 mb-2">
                      🔴 Duplicerade Kundnr ({validationReport.duplicateKundnr.size} st):
                    </h4>
                    <div className="text-xs text-red-700 space-y-1 max-h-24 overflow-y-auto">
                      {Array.from(validationReport.duplicateKundnr.entries()).slice(0, 5).map(([kundnr, rows]) => (
                        <div key={kundnr}>
                          <strong>"{kundnr}"</strong> på raderna: {rows.join(', ')}
                        </div>
                      ))}
                      {validationReport.duplicateKundnr.size > 5 && (
                        <div className="font-semibold">...och {validationReport.duplicateKundnr.size - 5} till (se rapport)</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Other Errors (non-duplicate) */}
                {(() => {
                  const nonDuplicateErrors = validationReport.errors.filter(err => !err.message.startsWith('Duplicerat Kundnr'))
                  if (nonDuplicateErrors.length === 0) return null
                  return (
                    <div className="bg-orange-50 border border-orange-200 rounded p-3">
                      <h4 className="text-sm font-semibold text-orange-800 mb-2">
                        🟠 Andra fel ({nonDuplicateErrors.length} st):
                      </h4>
                      <div className="text-xs text-orange-700 space-y-1 max-h-24 overflow-y-auto">
                        {nonDuplicateErrors.slice(0, 5).map((err, i) => (
                          <div key={i}>Rad {err.row}: {err.message}</div>
                        ))}
                        {nonDuplicateErrors.length > 5 && (
                          <div className="font-semibold">...och {nonDuplicateErrors.length - 5} till (se rapport)</div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Warnings */}
                {validationReport.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3">
                    <h4 className="text-sm font-semibold text-amber-800 mb-2">
                      🟡 Varningar ({validationReport.warnings.length} st):
                    </h4>
                    <div className="text-xs text-amber-700 space-y-1 max-h-24 overflow-y-auto">
                      {validationReport.warnings.slice(0, 5).map((warn, i) => (
                        <div key={i}>Rad {warn.row}: {warn.message}</div>
                      ))}
                      {validationReport.warnings.length > 5 && (
                        <div className="font-semibold">...och {validationReport.warnings.length - 5} till (se rapport)</div>
                      )}
                    </div>
                  </div>
                )}

                {validationReport.errors.length === 0 && validationReport.warnings.length === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-green-800 font-medium">Inga problem hittades! Filen är redo att importeras.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
              <h3 className="text-sm font-semibold text-red-900 mb-2">
                ⚠️ Import Errors ({errors.length}):
              </h3>
              <ul className="text-xs text-red-800 space-y-1">
                {errors.slice(0, 10).map((error, index) => (
                  <li key={index} className="break-words">
                    {error}
                  </li>
                ))}
                {errors.length > 10 && (
                  <li className="font-semibold">
                    ... and {errors.length - 10} more errors
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Two-column action area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Validate */}
            <div className={`border-2 border-dashed border-amber-300 rounded-lg p-4 text-center transition-colors ${isValidating ? 'opacity-50 pointer-events-none' : 'hover:border-amber-400 hover:bg-amber-50'}`}>
              <input
                ref={validateInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleValidateFile}
                className="hidden"
                id="excel-validate"
                disabled={isValidating || isUploading}
              />
              <label
                htmlFor="excel-validate"
                className={`flex flex-col items-center gap-2 ${isValidating ? '' : 'cursor-pointer'}`}
              >
                <FileSearch className="w-10 h-10 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {isValidating ? 'Validerar...' : 'Steg 1: Validera fil'}
                  </p>
                  <p className="text-xs text-gray-500">Hitta problem innan import</p>
                </div>
              </label>
            </div>

            {/* Import */}
            <div className={`border-2 border-dashed border-green-300 rounded-lg p-4 text-center transition-colors ${status.type === 'progress' ? 'opacity-50 pointer-events-none' : 'hover:border-green-400 hover:bg-green-50'}`}>
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
                className={`flex flex-col items-center gap-2 ${status.type === 'progress' ? '' : 'cursor-pointer'}`}
              >
                <Upload className="w-10 h-10 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {status.type === 'progress' ? 'Importerar...' : 'Steg 2: Importera fil'}
                  </p>
                  <p className="text-xs text-gray-500">Ladda upp till databasen</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <button
              onClick={handleClearData}
              className="text-sm text-red-600 hover:text-red-700 hover:underline"
            >
              Radera all data
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {isUploading ? 'Avbryt' : 'Stäng'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
