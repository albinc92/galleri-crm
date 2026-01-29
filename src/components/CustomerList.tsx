import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { CustomerWithContacts } from '../types'
import CustomerForm from './CustomerForm'
import ExcelUploader from './ExcelUploader'
import { Search, Plus, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Menu, ChevronDown, Calendar, Mail, Filter, RefreshCw, Download, Trash2, RotateCcw } from 'lucide-react'

// Mock data will be loaded from localStorage or Excel upload

type SortField = 'foretagsnamn' | 'kundnr' | 'stad' | 'aktiv' | 'bokat_besok'
type SortOrder = 'asc' | 'desc'

export default function CustomerList() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithContacts | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)
  const [sortField, setSortField] = useState<SortField>('foretagsnamn')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'booked' | 'offers' | 'swedish'>('all')
  const [showEmailExport, setShowEmailExport] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [realtimeUpdate, setRealtimeUpdate] = useState<{ type: string; id: string; timestamp: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const recentLocalChanges = useRef<Set<string>>(new Set())

  // Real-time subscription for live updates
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    console.log('Setting up realtime subscription...')
    
    const channel = supabase
      .channel('customers-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        (payload: any) => {
          console.log('🔴 Realtime update received:', payload)
          
          const recordId = payload.new?.id || payload.old?.id
          
          // Skip notification if this was a local change
          if (recentLocalChanges.current.has(recordId)) {
            console.log('Skipping notification for local change')
            recentLocalChanges.current.delete(recordId)
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            return
          }
          
          // Show notification about the update from another user
          const eventType = payload.eventType === 'INSERT' ? 'skapad' : 
                           payload.eventType === 'UPDATE' ? 'uppdaterad' : 'raderad'
          
          setRealtimeUpdate({
            type: eventType,
            id: recordId,
            timestamp: Date.now()
          })
          
          // Refetch the customers list
          queryClient.invalidateQueries({ queryKey: ['customers'] })
          
          // Clear notification after 5 seconds
          setTimeout(() => setRealtimeUpdate(null), 5000)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['customers'] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['customers'] })
        }
      )
      .subscribe((status: string, err?: Error) => {
        console.log('📡 Realtime subscription status:', status)
        if (err) console.error('Realtime error:', err)
      })

    return () => {
      console.log('Cleaning up realtime subscription')
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false)
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ['customers', showTrash],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        // Return data from localStorage in demo mode
        const stored = localStorage.getItem('galleri-customers')
        return stored ? JSON.parse(stored) as CustomerWithContacts[] : []
      }

      let query = supabase
        .from('customers')
        .select(`
          *,
          contacts(*),
          sales(*)
        `)
      
      if (showTrash) {
        // Show only deleted records
        query = query.not('deleted_at', 'is', null)
      } else {
        // Exclude soft-deleted records
        query = query.is('deleted_at', null)
      }
      
      // Remove the default 1000 row limit to get all customers
      const { data, error } = await query.order('foretagsnamn').range(0, 9999)

      if (error) throw error
      return data as CustomerWithContacts[]
    },
  })

  // Apply active filter first
  const preFilteredCustomers = customers?.filter((customer: CustomerWithContacts) => {
    if (activeFilter === 'booked') {
      return customer.bokat_besok === true
    }
    if (activeFilter === 'offers') {
      return customer.contacts?.some(contact => (contact as any).erbjudanden === true)
    }
    if (activeFilter === 'swedish') {
      // Swedish postal codes are 5 digits (with optional space): 123 45 or 12345
      const postnummer = customer.postnummer?.replace(/\s/g, '') || ''
      return /^\d{5}$/.test(postnummer) && parseInt(postnummer) >= 10000 && parseInt(postnummer) <= 99999
    }
    return true
  })

  const filteredCustomers = preFilteredCustomers?.filter((customer: CustomerWithContacts) => {
    if (!searchTerm) return true
    
    const search = searchTerm.toLowerCase()
    
    // Search in basic customer fields
    const basicMatch = (
      customer.foretagsnamn?.toLowerCase().includes(search) ||
      String(customer.kundnr || '').toLowerCase().includes(search) ||
      customer.stad?.toLowerCase().includes(search) ||
      customer.telefon?.toLowerCase().includes(search) ||
      customer.adress?.toLowerCase().includes(search) ||
      customer.postnummer?.toLowerCase().includes(search) ||
      customer.anteckningar?.toLowerCase().includes(search) ||
      customer.aktiv?.toLowerCase().includes(search)
    )
    
    if (basicMatch) return true
    
    // Search in contacts (ordförande, kassör names, emails, phones)
    const contactMatch = customer.contacts?.some(contact => 
      contact.namn?.toLowerCase().includes(search) ||
      contact.email?.toLowerCase().includes(search) ||
      contact.telefon?.toLowerCase().includes(search) ||
      contact.mobil?.toLowerCase().includes(search)
    )
    
    if (contactMatch) return true
    
    // Search in sales (sold art description)
    const salesMatch = customer.sales?.some(sale =>
      sale.sald_konst?.toLowerCase().includes(search)
    )
    
    return salesMatch || false
  })

  // Get emails for export (contacts with erbjudanden checked)
  const getOfferEmails = () => {
    const emails: string[] = []
    customers?.forEach(customer => {
      customer.contacts?.forEach(contact => {
        if ((contact as any).erbjudanden && contact.email) {
          emails.push(contact.email)
        }
      })
    })
    return [...new Set(emails)] // Remove duplicates
  }

  // Sort customers (create a copy to avoid mutating the original array)
  const sortedCustomers = filteredCustomers?.slice().sort((a: CustomerWithContacts, b: CustomerWithContacts) => {
    let aValue: any = a[sortField]
    let bValue: any = b[sortField]

    // Handle boolean field
    if (sortField === 'bokat_besok') {
      const aNum = aValue ? 1 : 0
      const bNum = bValue ? 1 : 0
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum
    }

    // Handle aktiv field (JAA, NJA, NEJ) with custom sort order
    if (sortField === 'aktiv') {
      const order = { 'JAA': 3, 'JA': 3, 'NJA': 2, 'NEJ': 1, '': 0 }
      const aOrder = order[String(aValue || '').toUpperCase() as keyof typeof order] || 0
      const bOrder = order[String(bValue || '').toUpperCase() as keyof typeof order] || 0
      return sortOrder === 'asc' ? aOrder - bOrder : bOrder - aOrder
    }

    // Handle null/undefined values by converting to empty string
    const aStr = (aValue === null || aValue === undefined) ? '' : String(aValue).toLowerCase()
    const bStr = (bValue === null || bValue === undefined) ? '' : String(bValue).toLowerCase()

    // String comparison
    if (aStr < bStr) return sortOrder === 'asc' ? -1 : 1
    if (aStr > bStr) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  // Pagination
  const totalItems = sortedCustomers?.length || 0
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCustomers = sortedCustomers?.slice(startIndex, endIndex)

  // Reset to page 1 when search term changes
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const handleNewCustomer = () => {
    setSelectedCustomer(null)
    setIsFormOpen(true)
  }

  const handleEditCustomer = (customer: CustomerWithContacts) => {
    setSelectedCustomer(customer)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setSelectedCustomer(null)
    refetch()
  }

  // Export all data to Excel
  const exportToExcel = () => {
    if (!customers || customers.length === 0) {
      alert('Ingen data att exportera')
      return
    }

    // Flatten customer data for Excel
    const exportData = customers.map((customer: CustomerWithContacts) => {
      const ordforande = customer.contacts?.find(c => c.role === 'ordforande')
      const kassor = customer.contacts?.find(c => c.role === 'kassor')
      const totalSales = customer.sales?.reduce((sum, s) => sum + (Number(s.belopp) || 0), 0) || 0

      return {
        'Kundnr': customer.kundnr,
        'Företagsnamn': customer.foretagsnamn,
        'Aktiv': customer.aktiv,
        'Adress': customer.adress || '',
        'Postnummer': customer.postnummer || '',
        'Stad': customer.stad || '',
        'Telefon': customer.telefon || '',
        'Bokat Besök': customer.bokat_besok ? 'Ja' : 'Nej',
        'Anteckningar': customer.anteckningar || '',
        // Ordförande
        'Ordförande Namn': ordforande?.namn || '',
        'Ordförande Telefon': ordforande?.telefon || '',
        'Ordförande Mobil': ordforande?.mobil || '',
        'Ordförande Email': ordforande?.email || '',
        'Ordförande Senast Kontakt': ordforande?.senast_kontakt || '',
        'Ordförande Återkom': ordforande?.aterkom || '',
        'Ordförande Erbjudanden': (ordforande as any)?.erbjudanden ? 'Ja' : 'Nej',
        // Kassör
        'Kassör Namn': kassor?.namn || '',
        'Kassör Telefon': kassor?.telefon || '',
        'Kassör Mobil': kassor?.mobil || '',
        'Kassör Email': kassor?.email || '',
        'Kassör Senast Kontakt': kassor?.senast_kontakt || '',
        'Kassör Återkom': kassor?.aterkom || '',
        'Kassör Erbjudanden': (kassor as any)?.erbjudanden ? 'Ja' : 'Nej',
        // Sales summary
        'Antal Försäljningar': customer.sales?.length || 0,
        'Total Försäljning': totalSales,
      }
    })

    // Create workbook with main data sheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)
    
    // Auto-width columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }))
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, 'Kunder')

    // Create sales detail sheet
    const salesData: any[] = []
    customers.forEach((customer: CustomerWithContacts) => {
      customer.sales?.forEach(sale => {
        salesData.push({
          'Kundnr': customer.kundnr,
          'Företagsnamn': customer.foretagsnamn,
          'Datum': sale.datum,
          'Belopp': sale.belopp,
          'Såld Konst': sale.sald_konst || '',
        })
      })
    })

    if (salesData.length > 0) {
      const salesWs = XLSX.utils.json_to_sheet(salesData)
      XLSX.utils.book_append_sheet(wb, salesWs, 'Försäljningar')
    }

    // Generate filename with date
    const date = new Date().toISOString().split('T')[0]
    const filename = `Galleri_Export_${date}.xlsx`

    // Download
    XLSX.writeFile(wb, filename)
  }

  // Restore a soft-deleted customer
  const restoreCustomer = async (customerId: string) => {
    if (!isSupabaseConfigured || !supabase) return
    
    // Mark as local change
    recentLocalChanges.current.add(customerId)
    setTimeout(() => recentLocalChanges.current.delete(customerId), 3000)
    
    try {
      const { error } = await supabase
        .from('customers')
        .update({ deleted_at: null })
        .eq('id', customerId)
      
      if (error) throw error
      refetch()
    } catch (err: any) {
      alert('Kunde inte återställa: ' + err.message)
    }
  }

  // Permanently delete a customer
  const permanentlyDelete = async (customerId: string) => {
    if (!isSupabaseConfigured || !supabase) return
    
    if (!confirm('Är du säker? Detta går inte att ångra!')) return
    
    // Mark as local change
    recentLocalChanges.current.add(customerId)
    setTimeout(() => recentLocalChanges.current.delete(customerId), 3000)
    
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)
      
      if (error) throw error
      refetch()
    } catch (err: any) {
      alert('Kunde inte radera: ' + err.message)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Laddar kunder...</div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* Real-time update notification */}
      {realtimeUpdate && (
        <div className="flex-shrink-0 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-800 animate-pulse">
          <RefreshCw className="w-4 h-4" />
          <span>En kund har blivit {realtimeUpdate.type} av en annan användare. Listan uppdaterades automatiskt.</span>
        </div>
      )}

      {/* Header with Search and Actions */}
      <div className="flex-shrink-0 flex gap-2 mb-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Sök..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Desktop buttons */}
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => setShowTrash(!showTrash)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm border ${
              showTrash 
                ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100' 
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
            title={showTrash ? 'Visa aktiva kunder' : 'Visa papperskorg'}
          >
            <Trash2 className="w-4 h-4" />
            {showTrash ? 'Visa Aktiva' : 'Papperskorg'}
          </button>
          <ExcelUploader onUploadComplete={refetch} />
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm border border-gray-300"
            title="Exportera data till Excel"
          >
            <Download className="w-4 h-4" />
            Exportera
          </button>
          <button
            onClick={handleNewCustomer}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Ny Post
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="sm:hidden relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px]">
              <button
                onClick={() => {
                  handleNewCustomer()
                  setIsMenuOpen(false)
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                Ny Post
              </button>
              <div className="border-t border-gray-100">
                <ExcelUploader onUploadComplete={() => { refetch(); setIsMenuOpen(false) }} compact />
              </div>
              <div className="border-t border-gray-100">
                <button
                  onClick={() => {
                    exportToExcel()
                    setIsMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" />
                  Exportera Data
                </button>
              </div>
              <div className="border-t border-gray-100">
                <button
                  onClick={() => {
                    setShowTrash(!showTrash)
                    setIsMenuOpen(false)
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-gray-50 ${showTrash ? 'text-red-600' : 'text-gray-700'}`}
                >
                  <Trash2 className="w-4 h-4" />
                  {showTrash ? 'Visa Aktiva' : 'Papperskorg'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compact Controls Bar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 mb-3 text-xs sm:text-sm">
        <span className="text-gray-500">
          {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems}
        </span>
        
        <select
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value))
            setCurrentPage(1)
          }}
          className="px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm bg-white"
        >
          <option value={12}>12</option>
          <option value={24}>24</option>
          <option value={48}>48</option>
        </select>

        {/* Sort dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setIsSortOpen(!isSortOpen)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
              sortField !== 'foretagsnamn' || sortOrder !== 'asc'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sortera
            <ChevronDown className="w-3 h-3" />
          </button>
          {isSortOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[140px]">
              {[
                { field: 'foretagsnamn' as SortField, label: 'Företag' },
                { field: 'kundnr' as SortField, label: 'Kundnr' },
                { field: 'stad' as SortField, label: 'Postadress' },
                { field: 'aktiv' as SortField, label: 'Aktiv' },
              ].map(({ field, label }) => (
                <button
                  key={field}
                  onClick={() => {
                    handleSort(field)
                    setIsSortOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                    sortField === field ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                  }`}
                >
                  {label} {sortField === field && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              ))}
              <div className="border-t border-gray-100">
                <button
                  onClick={() => {
                    setSortField('foretagsnamn')
                    setSortOrder('asc')
                    setCurrentPage(1)
                    setIsSortOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  ✕ Rensa
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filter dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
              activeFilter !== 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-3 h-3" />
            Filter
            <ChevronDown className="w-3 h-3" />
          </button>
          {isFilterOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px]">
              <button
                onClick={() => {
                  setActiveFilter('all')
                  setCurrentPage(1)
                  setIsFilterOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  activeFilter === 'all' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                Alla kunder
              </button>
              <button
                onClick={() => {
                  setActiveFilter('booked')
                  setCurrentPage(1)
                  setIsFilterOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  activeFilter === 'booked' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Bokade besök
              </button>
              <button
                onClick={() => {
                  setActiveFilter('offers')
                  setCurrentPage(1)
                  setIsFilterOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  activeFilter === 'offers' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <Mail className="w-4 h-4" />
                Erbjudanden
              </button>
              <button
                onClick={() => {
                  setActiveFilter('swedish')
                  setCurrentPage(1)
                  setIsFilterOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  activeFilter === 'swedish' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                🇸🇪
                Svenska kunder
              </button>
            </div>
          )}
        </div>

        {/* Export emails button */}
        <button
          onClick={() => setShowEmailExport(true)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs sm:text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          title="Exportera e-postadresser"
        >
          <Mail className="w-3 h-3" />
          <span className="hidden sm:inline">E-post</span>
        </button>
      </div>

      {/* Scrollable Customer Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-2">
        {/* Trash mode banner */}
        {showTrash && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-800">
            <Trash2 className="w-4 h-4" />
            <span>Du visar raderade kunder. Klicka för att återställa eller ta bort permanent.</span>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        {paginatedCustomers?.map((customer: CustomerWithContacts) => (
          <div
            key={customer.id}
            className={`bg-white rounded-lg shadow-sm transition-shadow p-3 sm:p-4 border ${
              showTrash ? 'border-red-200 bg-red-50/30' : 'border-gray-200 hover:shadow-md cursor-pointer'
            }`}
            onClick={() => !showTrash && handleEditCustomer(customer)}
          >
            <div className="flex justify-between items-start mb-1 sm:mb-2">
              <h3 className={`font-semibold text-sm sm:text-lg truncate flex-1 mr-2 ${showTrash ? 'text-gray-500' : 'text-gray-900'}`}>
                {customer.foretagsnamn}
              </h3>
              {!showTrash && (
                <span
                  className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                    customer.aktiv ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {customer.aktiv ? 'Aktiv' : 'Inaktiv'}
                </span>
              )}
              {showTrash && (
                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium flex-shrink-0 bg-red-100 text-red-800">
                  Raderad
                </span>
              )}
            </div>
            <div className="space-y-0.5 text-xs sm:text-sm text-gray-600">
              <p>📝 {customer.kundnr}</p>
              {customer.stad && <p className="truncate">📍 {customer.stad}</p>}
              {!showTrash && customer.bokat_besok && (
                <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  ✓ Bokat
                </span>
              )}
              {showTrash && (customer as any).deleted_at && (
                <p className="text-red-600 text-xs mt-1">
                  Raderad: {new Date((customer as any).deleted_at).toLocaleDateString('sv-SE')}
                </p>
              )}
            </div>
            
            {/* Trash actions */}
            {showTrash && (
              <div className="flex gap-2 mt-3 pt-2 border-t border-red-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    restoreCustomer(customer.id)
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Återställ
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    permanentlyDelete(customer.id)
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Ta Bort
                </button>
              </div>
            )}
          </div>
        ))}
        </div>

        {totalItems === 0 && (
          <div className="text-center py-12 text-gray-500">
            {showTrash ? (
              <>Papperskorgen är tom.</>
            ) : searchTerm ? (
              <>Inga kunder hittades. Prova en annan sökning.</>
            ) : (
              <>
                Inga kunder ännu. {(!isSupabaseConfigured || !supabase) && <>Klicka på "Import Excel" för att importera data eller </>}
                klicka på "Ny Post" för att lägga till en ny kund.
              </>
            )}
          </div>
        )}
      </div>

      {/* Pagination - Fixed at bottom */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 bg-white border-t border-gray-200 pt-3 flex items-center justify-center gap-1 sm:gap-2">
          {/* First Page */}
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="p-1.5 sm:p-2 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Första sidan"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          
          {/* Previous Page */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 sm:p-2 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Föregående"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page indicator */}
          <span className="px-2 text-xs sm:text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>

          {/* Next Page */}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1.5 sm:p-2 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Nästa"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last Page */}
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1.5 sm:p-2 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Sista sidan"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>

          {/* Jump to Page */}
          <div className="flex items-center gap-1 ml-2">
            <input
              id="jump-to-page"
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => handlePageChange(Number(e.target.value))}
              className="w-12 sm:w-14 px-1 sm:px-2 py-1 border border-gray-300 rounded text-xs text-center"
            />
          </div>
        </div>
      )}

      {/* Email Export Modal */}
      {showEmailExport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                <Mail className="w-5 h-5 inline mr-2" />
                E-postadresser för erbjudanden
              </h2>
              <button
                onClick={() => setShowEmailExport(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {(() => {
              const emails = getOfferEmails()
              return (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    {emails.length} kontakter med erbjudanden markerat:
                  </p>
                  {emails.length > 0 ? (
                    <>
                      <textarea
                        readOnly
                        value={emails.join('; ')}
                        className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm font-mono bg-gray-50"
                      />
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(emails.join('; '))
                            alert('E-postadresser kopierade!')
                          }}
                          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                        >
                          Kopiera alla
                        </button>
                        <button
                          onClick={() => {
                            window.location.href = `mailto:?bcc=${emails.join(',')}`
                          }}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Öppna e-post
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      Inga kontakter med erbjudanden markerat hittades.<br />
                      <span className="text-sm">Markera "Erbjudanden" på kontakter i kundposterna.</span>
                    </p>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Customer Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedCustomer ? 'Redigera Kund' : 'Ny Kund'}
              </h2>
              <button
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <CustomerForm
                customer={selectedCustomer}
                onClose={handleCloseForm}
                onLocalChange={(id: string) => {
                  recentLocalChanges.current.add(id)
                  // Clean up after 3 seconds in case realtime event doesn't fire
                  setTimeout(() => recentLocalChanges.current.delete(id), 3000)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
