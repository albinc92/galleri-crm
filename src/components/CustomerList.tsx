import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { CustomerWithContacts } from '../types'
import CustomerForm from './CustomerForm'
import { Search, Plus, X } from 'lucide-react'

// Mock data for demo mode
const mockCustomers: CustomerWithContacts[] = [
  {
    id: '1',
    kundnr: 'K001',
    aktiv: true,
    foretagsnamn: 'Konstgalleriet Stockholm',
    adress: 'Storgatan 10',
    postnummer: '111 22',
    stad: 'Stockholm',
    telefon: '08-123 45 67',
    bokat_besok: true,
    anteckningar: 'Intresserade av moderna målningar',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    contacts: [],
    sales: []
  },
  {
    id: '2',
    kundnr: 'K002',
    aktiv: true,
    foretagsnamn: 'Galleri Moderna',
    adress: 'Kungsgatan 25',
    postnummer: '411 19',
    stad: 'Göteborg',
    telefon: '031-987 65 43',
    bokat_besok: false,
    anteckningar: 'Besökt mässan i februari',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    contacts: [],
    sales: []
  },
  {
    id: '3',
    kundnr: 'K003',
    aktiv: false,
    foretagsnamn: 'Konst & Design Malmö',
    adress: 'Västra Hamngatan 5',
    postnummer: '211 22',
    stad: 'Malmö',
    telefon: '040-555 12 34',
    bokat_besok: false,
    anteckningar: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    contacts: [],
    sales: []
  }
]

export default function CustomerList() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithContacts | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        // Return mock data in demo mode
        return mockCustomers
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

  const filteredCustomers = customers?.filter((customer) => {
    const search = searchTerm.toLowerCase()
    return (
      customer.foretagsnamn.toLowerCase().includes(search) ||
      customer.kundnr.toLowerCase().includes(search) ||
      customer.stad?.toLowerCase().includes(search) ||
      customer.telefon?.toLowerCase().includes(search)
    )
  })

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
      {/* Header with Search and New Button */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Sök företagsnamn, kundnr, stad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={handleNewCustomer}
          className="flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Ny Post
        </button>
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers?.map((customer) => (
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

      {filteredCustomers?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Inga kunder hittades. {searchTerm && 'Prova en annan sökning eller '}Klicka på "Ny Post" för att lägga till en ny kund.
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
