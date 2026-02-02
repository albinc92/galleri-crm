import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { CustomerWithContacts, Contact, Sale } from '../types'
import ContactSection from './ContactSection'
import SalesSection from './SalesSection'
import { ConfirmationModal } from './ConfirmationModal'
import { AlertTriangle, RefreshCw, Phone } from 'lucide-react'

export interface CustomerFormRef {
  submit: () => void
  openDeleteConfirm: () => void
  isLoading: boolean
}

interface CustomerFormProps {
  customer: CustomerWithContacts | null
  onClose: () => void
  onLocalChange?: (id: string) => void
  onLoadingChange?: (loading: boolean) => void
}

const CustomerForm = forwardRef<CustomerFormRef, CustomerFormProps>(({ customer, onClose, onLocalChange, onLoadingChange }, ref) => {
  const [loading, setLoading] = useState(false)
  const [isStale, setIsStale] = useState(false)
  const [staleMessage, setStaleMessage] = useState('')
  const originalUpdatedAt = useRef<string | null>(null)
  const [formData, setFormData] = useState({
    kundnr: '',
    aktiv: 'NEJ',
    foretagsnamn: '',
    adress: '',
    postnummer: '',
    stad: '',
    telefon: '',
    bokat_besok: false,
    anteckningar: '',
  })

  const [ordforande, setOrdforande] = useState<Partial<Contact> & { erbjudanden?: boolean }>({
    namn: '',
    telefon: '',
    mobil: '',
    email: '',
    senast_kontakt: '',
    aterkom: '',
    erbjudanden: false,
  })

  const [kassor, setKassor] = useState<Partial<Contact> & { erbjudanden?: boolean }>({
    namn: '',
    telefon: '',
    mobil: '',
    email: '',
    senast_kontakt: '',
    aterkom: '',
    erbjudanden: false,
  })

  const [sales, setSales] = useState<Partial<Sale>[]>([
    { datum: '', belopp: 0, sald_konst: '' },
  ])
  const [reloading, setReloading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    submit: () => formRef.current?.requestSubmit(),
    openDeleteConfirm: () => setShowDeleteConfirm(true),
    isLoading: loading,
  }), [loading])

  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange?.(loading)
  }, [loading, onLoadingChange])

  // Reload customer data from database
  const reloadCustomerData = useCallback(async () => {
    if (!customer || !isSupabaseConfigured || !supabase) return
    
    setReloading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          contacts (*),
          sales (*)
        `)
        .eq('id', customer.id)
        .single()
      
      if (error) throw error
      
      if (data) {
        // Update form with fresh data
        setFormData({
          kundnr: data.kundnr,
          aktiv: data.aktiv,
          foretagsnamn: data.foretagsnamn,
          adress: data.adress || '',
          postnummer: data.postnummer || '',
          stad: data.stad || '',
          telefon: data.telefon || '',
          bokat_besok: data.bokat_besok,
          anteckningar: data.anteckningar || '',
        })

        const ordf = data.contacts?.find((c: any) => c.role === 'ordforande')
        const kass = data.contacts?.find((c: any) => c.role === 'kassor')

        setOrdforande({
          namn: ordf?.namn || '',
          telefon: ordf?.telefon || '',
          mobil: ordf?.mobil || '',
          email: ordf?.email || '',
          senast_kontakt: ordf?.senast_kontakt || '',
          aterkom: ordf?.aterkom || '',
          erbjudanden: ordf?.erbjudanden || false,
        })

        setKassor({
          namn: kass?.namn || '',
          telefon: kass?.telefon || '',
          mobil: kass?.mobil || '',
          email: kass?.email || '',
          senast_kontakt: kass?.senast_kontakt || '',
          aterkom: kass?.aterkom || '',
          erbjudanden: kass?.erbjudanden || false,
        })

        if (data.sales && data.sales.length > 0) {
          setSales(data.sales)
        } else {
          setSales([{ datum: '', belopp: 0, sald_konst: '' }])
        }

        // Update the reference timestamp and clear stale state
        originalUpdatedAt.current = data.updated_at
        setIsStale(false)
        setStaleMessage('')
      }
    } catch (err) {
      console.error('Failed to reload customer:', err)
      alert('Kunde inte ladda om data. Försök igen.')
    } finally {
      setReloading(false)
    }
  }, [customer])

  // Store original updated_at for conflict detection
  useEffect(() => {
    if (customer) {
      originalUpdatedAt.current = customer.updated_at
    }
  }, [customer])

  // Real-time subscription to detect changes while editing
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !customer) return

    const channel = supabase
      .channel(`customer-${customer.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'customers',
          filter: `id=eq.${customer.id}`
        },
        (payload: any) => {
          // Someone else updated this customer
          if (payload.new.updated_at !== originalUpdatedAt.current) {
            setIsStale(true)
            setStaleMessage(`Denna kund uppdaterades av en annan användare kl ${new Date(payload.new.updated_at).toLocaleTimeString('sv-SE')}`)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [customer])

  useEffect(() => {
    if (customer) {
      setFormData({
        kundnr: customer.kundnr,
        aktiv: customer.aktiv,
        foretagsnamn: customer.foretagsnamn,
        adress: customer.adress || '',
        postnummer: customer.postnummer || '',
        stad: customer.stad || '',
        telefon: customer.telefon || '',
        bokat_besok: customer.bokat_besok,
        anteckningar: customer.anteckningar || '',
      })

      const ordf = customer.contacts?.find((c) => c.role === 'ordforande')
      const kass = customer.contacts?.find((c) => c.role === 'kassor')

      if (ordf) {
        setOrdforande({
          namn: ordf.namn || '',
          telefon: ordf.telefon || '',
          mobil: ordf.mobil || '',
          email: ordf.email || '',
          senast_kontakt: ordf.senast_kontakt || '',
          aterkom: ordf.aterkom || '',
          erbjudanden: (ordf as any).erbjudanden || false,
        })
      }

      if (kass) {
        setKassor({
          namn: kass.namn || '',
          telefon: kass.telefon || '',
          mobil: kass.mobil || '',
          email: kass.email || '',
          senast_kontakt: kass.senast_kontakt || '',
          aterkom: kass.aterkom || '',
          erbjudanden: (kass as any).erbjudanden || false,
        })
      }

      if (customer.sales && customer.sales.length > 0) {
        setSales(customer.sales)
      }
    }
  }, [customer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check for stale data before saving
    if (isStale) {
      const confirmSave = confirm(
        'Varning: Denna kund har uppdaterats av en annan användare. ' +
        'Vill du skriva över deras ändringar med dina?\n\n' +
        'Klicka OK för att spara dina ändringar, eller Avbryt för att ladda om sidan.'
      )
      if (!confirmSave) {
        onClose()
        return
      }
    }
    
    setLoading(true)

    try {
      if (!isSupabaseConfigured || !supabase) {
        // Demo mode - save to localStorage
        const stored = localStorage.getItem('galleri-customers')
        const customers: CustomerWithContacts[] = stored ? JSON.parse(stored) : []
        
        if (customer) {
          // Update existing
          const index = customers.findIndex(c => c.id === customer.id)
          if (index !== -1) {
            customers[index] = {
              ...customers[index],
              ...formData,
              updated_at: new Date().toISOString(),
              contacts: [
                { ...ordforande, role: 'ordforande' as const, customer_id: customer.id, id: `${customer.id}-ord`, created_at: '', updated_at: '', namn: ordforande.namn || null, telefon: ordforande.telefon || null, mobil: ordforande.mobil || null, email: ordforande.email || null, senast_kontakt: ordforande.senast_kontakt || null, aterkom: ordforande.aterkom || null, erbjudanden: ordforande.erbjudanden || false },
                { ...kassor, role: 'kassor' as const, customer_id: customer.id, id: `${customer.id}-kas`, created_at: '', updated_at: '', namn: kassor.namn || null, telefon: kassor.telefon || null, mobil: kassor.mobil || null, email: kassor.email || null, senast_kontakt: kassor.senast_kontakt || null, aterkom: kassor.aterkom || null, erbjudanden: kassor.erbjudanden || false },
              ].filter(c => c.namn) as any,
              sales: sales.filter(s => s.datum || s.belopp) as Sale[],
            }
          }
        } else {
          // Create new
          const newId = `local-${Date.now()}`
          customers.push({
            id: newId,
            ...formData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            contacts: [
              { ...ordforande, role: 'ordforande' as const, customer_id: newId, id: `${newId}-ord`, created_at: '', updated_at: '', namn: ordforande.namn || null, telefon: ordforande.telefon || null, mobil: ordforande.mobil || null, email: ordforande.email || null, senast_kontakt: ordforande.senast_kontakt || null, aterkom: ordforande.aterkom || null, erbjudanden: ordforande.erbjudanden || false },
              { ...kassor, role: 'kassor' as const, customer_id: newId, id: `${newId}-kas`, created_at: '', updated_at: '', namn: kassor.namn || null, telefon: kassor.telefon || null, mobil: kassor.mobil || null, email: kassor.email || null, senast_kontakt: kassor.senast_kontakt || null, aterkom: kassor.aterkom || null, erbjudanden: kassor.erbjudanden || false },
            ].filter(c => c.namn) as any,
            sales: sales.filter(s => s.datum || s.belopp) as Sale[],
          } as CustomerWithContacts)
        }
        
        localStorage.setItem('galleri-customers', JSON.stringify(customers))
        onClose()
        return
      }

      let customerId = customer?.id

      // Upsert customer
      if (customer) {
        const { error } = await supabase
          .from('customers')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', customer.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('customers')
          .insert([formData])
          .select()
          .single()
        if (error) throw error
        customerId = data.id
      }

      // Update contacts
      if (customerId) {
        // Helper function to prepare contact data for database
        const prepareContactData = (contact: typeof ordforande) => ({
          namn: contact.namn || null,
          telefon: contact.telefon || null,
          mobil: contact.mobil || null,
          email: contact.email || null,
          senast_kontakt: contact.senast_kontakt || null,
          aterkom: contact.aterkom || null,
          erbjudanden: contact.erbjudanden || false,
          updated_at: new Date().toISOString(),
        })

        // Ordförande - uppdatera om befintlig eller skapa om namn finns
        const existingOrdforande = customer?.contacts?.find((c) => c.role === 'ordforande')
        if (existingOrdforande) {
          // Alltid uppdatera befintlig kontakt (även om bara datum ändras)
          const { error } = await supabase
            .from('contacts')
            .update(prepareContactData(ordforande))
            .eq('id', existingOrdforande.id)
          if (error) console.error('Error updating ordforande:', error)
        } else if (ordforande.namn) {
          // Skapa ny endast om namn finns
          const { error } = await supabase.from('contacts').insert([{
            ...prepareContactData(ordforande),
            customer_id: customerId,
            role: 'ordforande' as const,
          }])
          if (error) console.error('Error inserting ordforande:', error)
        }

        // Kassör - uppdatera om befintlig eller skapa om namn finns
        const existingKassor = customer?.contacts?.find((c) => c.role === 'kassor')
        if (existingKassor) {
          // Alltid uppdatera befintlig kontakt (även om bara datum ändras)
          const { error } = await supabase
            .from('contacts')
            .update(prepareContactData(kassor))
            .eq('id', existingKassor.id)
          if (error) console.error('Error updating kassor:', error)
        } else if (kassor.namn) {
          // Skapa ny endast om namn finns
          const { error } = await supabase.from('contacts').insert([{
            ...prepareContactData(kassor),
            customer_id: customerId,
            role: 'kassor' as const,
          }])
          if (error) console.error('Error inserting kassor:', error)
        }

        // Sales - hantera uppdateringar, nya och borttagna
        const existingSales = customer?.sales || []
        const validSales = sales.filter(s => s.datum && s.belopp)
        
        // Hitta sales att uppdatera, skapa eller ta bort
        const existingSaleIds = new Set(existingSales.map(s => s.id))
        const currentSaleIds = new Set(validSales.filter(s => s.id).map(s => s.id))
        
        // Ta bort sales som inte längre finns
        const salesToDelete = existingSales.filter(s => !currentSaleIds.has(s.id))
        for (const sale of salesToDelete) {
          await supabase.from('sales').delete().eq('id', sale.id)
        }
        
        // Uppdatera eller skapa sales
        for (const sale of validSales) {
          if (sale.id && existingSaleIds.has(sale.id)) {
            // Uppdatera befintlig
            await supabase
              .from('sales')
              .update({
                datum: sale.datum,
                belopp: sale.belopp,
                sald_konst: sale.sald_konst || null,
              })
              .eq('id', sale.id)
          } else {
            // Skapa ny
            await supabase.from('sales').insert([{
              customer_id: customerId,
              datum: sale.datum!,
              belopp: sale.belopp!,
              sald_konst: sale.sald_konst || null,
            }])
          }
        }
      }

      // Mark as local change to prevent self-notification
      if (customerId && onLocalChange) {
        onLocalChange(customerId)
      }

      onClose()
    } catch (error: any) {
      alert('Fel: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!customer) return

    setLoading(true)
    try {
      if (!isSupabaseConfigured || !supabase) {
        // Demo mode - delete from localStorage
        const stored = localStorage.getItem('galleri-customers')
        const customers: CustomerWithContacts[] = stored ? JSON.parse(stored) : []
        const filtered = customers.filter(c => c.id !== customer.id)
        localStorage.setItem('galleri-customers', JSON.stringify(filtered))
        onClose()
        return
      }

      // Soft delete - set deleted_at instead of actually deleting
      const { error } = await supabase
        .from('customers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', customer.id)
      if (error) throw error
      
      // Mark as local change to prevent self-notification
      if (onLocalChange) {
        onLocalChange(customer.id)
      }
      
      onClose()
    } catch (error: any) {
      alert('Fel: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <ConfirmationModal
      isOpen={showDeleteConfirm}
      onClose={() => setShowDeleteConfirm(false)}
      onConfirm={handleDeleteConfirmed}
      title="Radera kund"
      message={`Vill du radera kunden "${formData.foretagsnamn}"? Kunden flyttas till papperskorgen och kan återställas senare.`}
      confirmText="Radera"
      cancelText="Avbryt"
      level="normal"
    />
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Stale data warning - fixed center screen */}
      {isStale && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none">
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3 shadow-xl max-w-md pointer-events-auto">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Data har ändrats</p>
              <p className="text-sm text-amber-700">{staleMessage}</p>
              <p className="text-sm text-amber-600 mt-1">
                Om du sparar kommer dina ändringar att skriva över de andra.
              </p>
              <button
                type="button"
                onClick={reloadCustomerData}
                disabled={reloading}
                className="mt-2 text-sm text-amber-800 underline hover:text-amber-900 inline-flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`} />
                {reloading ? 'Laddar om...' : 'Ladda om för att se senaste versionen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kundnr <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.kundnr}
            onChange={(e) => setFormData({ ...formData, kundnr: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="aktiv" className="block text-sm font-medium text-gray-700 mb-1">
            Aktiv Status
          </label>
          <select
            id="aktiv"
            value={formData.aktiv}
            onChange={(e) => setFormData({ ...formData, aktiv: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="JAA">JAA - Aktiv</option>
            <option value="NJA">NJA - Delvis aktiv</option>
            <option value="NEJ">NEJ - Inaktiv</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Företagsnamn <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.foretagsnamn}
          onChange={(e) => setFormData({ ...formData, foretagsnamn: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Adress</label>
        <input
          type="text"
          value={formData.adress}
          onChange={(e) => setFormData({ ...formData, adress: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Postnummer</label>
          <input
            type="text"
            value={formData.postnummer}
            onChange={(e) => setFormData({ ...formData, postnummer: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stad</label>
          <input
            type="text"
            value={formData.stad}
            onChange={(e) => setFormData({ ...formData, stad: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Telefon företag</label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={formData.telefon}
            onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {formData.telefon && (
            <a
              href={`tel:${formData.telefon}`}
              className="flex items-center justify-center px-3 py-2 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              title="Ring"
            >
              <Phone className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>

      {/* Contact Sections */}
      <div className="border-t pt-6">
        <ContactSection
          title="Ordförande"
          contact={ordforande}
          onChange={setOrdforande}
        />
      </div>

      <div className="border-t pt-6">
        <ContactSection
          title="Kassör"
          contact={kassor}
          onChange={setKassor}
        />
      </div>

      {/* Notes */}
      <div className="border-t pt-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Anteckningar</label>
        <textarea
          rows={4}
          value={formData.anteckningar}
          onChange={(e) => setFormData({ ...formData, anteckningar: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Fritext anteckningar om kunden..."
        />
      </div>

      {/* Sales Section */}
      <div className="border-t pt-6">
        <SalesSection sales={sales} onChange={setSales} />
      </div>

      {/* Bokat Besök */}
      <div className="flex items-center gap-2 border-t pt-6">
        <input
          type="checkbox"
          id="bokat_besok"
          checked={formData.bokat_besok}
          onChange={(e) => setFormData({ ...formData, bokat_besok: e.target.checked })}
          className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
        />
        <label htmlFor="bokat_besok" className="text-sm font-medium text-gray-700">
          Bokat besök
        </label>
      </div>

    </form>
    </>
  )
})

CustomerForm.displayName = 'CustomerForm'

export default CustomerForm