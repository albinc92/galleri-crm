import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { CustomerWithContacts } from '../types'
import CustomerForm from './CustomerForm'
import ExcelUploader from './ExcelUploader'
import { Search, Plus, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Menu, ChevronDown, Calendar, Mail, Filter } from 'lucide-react'

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
  const [activeFilter, setActiveFilter] = useState<'all' | 'booked' | 'offers'>('all')
  const [showEmailExport, setShowEmailExport] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

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
    queryKey: ['customers'],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        // Return data from localStorage in demo mode
        const stored = localStorage.getItem('galleri-customers')
        return stored ? JSON.parse(stored) as CustomerWithContacts[] : []
      }

      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          contacts(*),
          sales(*)
        `)
        .order('foretagsnamn')

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

  if (isLoading) {
    return <div className="text-center py-8">Laddar kunder...</div>
  }

  return (
    <div className="h-full flex flex-col">
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
          <ExcelUploader onUploadComplete={refetch} />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        {paginatedCustomers?.map((customer: CustomerWithContacts) => (
          <div
            key={customer.id}
            onClick={() => handleEditCustomer(customer)}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-3 sm:p-4 border border-gray-200"
          >
            <div className="flex justify-between items-start mb-1 sm:mb-2">
              <h3 className="font-semibold text-sm sm:text-lg text-gray-900 truncate flex-1 mr-2">{customer.foretagsnamn}</h3>
              <span
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                  customer.aktiv ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {customer.aktiv ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>
            <div className="space-y-0.5 text-xs sm:text-sm text-gray-600">
              <p>📝 {customer.kundnr}</p>
              {customer.stad && <p className="truncate">📍 {customer.stad}</p>}
              {customer.bokat_besok && (
                <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  ✓ Bokat
                </span>
              )}
            </div>
          </div>
        ))}
        </div>

        {totalItems === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchTerm ? (
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
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
