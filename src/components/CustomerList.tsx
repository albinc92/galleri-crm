import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { CustomerWithContacts } from '../types'
import CustomerForm from './CustomerForm'
import ExcelUploader from './ExcelUploader'
import { Search, Plus, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

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

  const filteredCustomers = customers?.filter((customer: CustomerWithContacts) => {
    if (!searchTerm) return true
    
    const search = searchTerm.toLowerCase()
    return (
      customer.foretagsnamn?.toLowerCase().includes(search) ||
      String(customer.kundnr || '').toLowerCase().includes(search) ||
      customer.stad?.toLowerCase().includes(search) ||
      customer.telefon?.toLowerCase().includes(search)
    )
  })

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
    <div className="space-y-4">
      {/* Header with Search and Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Sök företagsnamn, kundnr, stad..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <ExcelUploader onUploadComplete={refetch} />
        <button
          onClick={handleNewCustomer}
          className="flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Ny Post
        </button>
      </div>

      {/* Stats and Controls Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col gap-4">
          {/* Stats Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm text-gray-600">
              Visar {startIndex + 1}-{Math.min(endIndex, totalItems)} av {totalItems} kunder
            </span>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Per sida:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
                <option value={96}>96</option>
              </select>
            </div>
          </div>

          {/* Sorting Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Sortera:</span>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <button
                onClick={() => handleSort('foretagsnamn')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortField === 'foretagsnamn'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Företag {sortField === 'foretagsnamn' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleSort('kundnr')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortField === 'kundnr'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Kundnr {sortField === 'kundnr' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleSort('stad')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortField === 'stad'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Postadress {sortField === 'stad' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleSort('aktiv')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortField === 'aktiv'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Aktiv {sortField === 'aktiv' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => {
                  setSortField('foretagsnamn')
                  setSortOrder('asc')
                  setCurrentPage(1)
                }}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors col-span-2 sm:col-span-1"
              >
                ✕ Rensa sortering
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedCustomers?.map((customer: CustomerWithContacts) => (
          <div
            key={customer.id}
            onClick={() => handleEditCustomer(customer)}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4 border border-gray-200"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-lg text-gray-900">{customer.foretagsnamn}</h3>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  customer.aktiv ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {customer.aktiv ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <p>📝 Kundnr: {customer.kundnr}</p>
              {customer.stad && <p>📍 {customer.stad}</p>}
              {customer.telefon && <p>📞 {customer.telefon}</p>}
              {customer.bokat_besok && (
                <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  ✓ Bokat besök
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t">
          <div className="text-sm text-gray-600">
            Sida {currentPage} av {totalPages}
          </div>
          
          <div className="flex items-center gap-2">
            {/* First Page */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Första sidan"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>
            
            {/* Previous Page */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Föregående"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Nästa"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Sista sidan"
            >
              <ChevronsRight className="w-5 h-5" />
            </button>
          </div>

          {/* Jump to Page */}
          <div className="flex items-center gap-2">
            <label htmlFor="jump-to-page" className="text-sm text-gray-600">
              Gå till:
            </label>
            <input
              id="jump-to-page"
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => handlePageChange(Number(e.target.value))}
              className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center"
            />
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
