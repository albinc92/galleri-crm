import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CustomerWithContacts, Contact, Sale } from '../types'
import ContactSection from './ContactSection'
import SalesSection from './SalesSection'
import { Save, Trash2 } from 'lucide-react'

interface CustomerFormProps {
  customer: CustomerWithContacts | null
  onClose: () => void
}

export default function CustomerForm({ customer, onClose }: CustomerFormProps) {
  const [loading, setLoading] = useState(false)
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

  const [ordforande, setOrdforande] = useState<Partial<Contact>>({
    namn: '',
    telefon: '',
    mobil: '',
    email: '',
    senast_kontakt: '',
    aterkom: '',
  })

  const [kassor, setKassor] = useState<Partial<Contact>>({
    namn: '',
    telefon: '',
    mobil: '',
    email: '',
    senast_kontakt: '',
    aterkom: '',
  })

  const [sales, setSales] = useState<Partial<Sale>[]>([
    { datum: '', belopp: 0, sald_konst: '' },
  ])

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
        })
      }

      if (customer.sales && customer.sales.length > 0) {
        setSales(customer.sales)
      }
    }
  }, [customer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
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
        // Ordförande
        if (ordforande.namn) {
          const existing = customer?.contacts?.find((c) => c.role === 'ordforande')
          if (existing) {
            await supabase
              .from('contacts')
              .update({ ...ordforande, updated_at: new Date().toISOString() })
              .eq('id', existing.id)
          } else {
            await supabase.from('contacts').insert([
              { ...ordforande, customer_id: customerId, role: 'ordforande' as const },
            ])
          }
        }

        // Kassör
        if (kassor.namn) {
          const existing = customer?.contacts?.find((c) => c.role === 'kassor')
          if (existing) {
            await supabase
              .from('contacts')
              .update({ ...kassor, updated_at: new Date().toISOString() })
              .eq('id', existing.id)
          } else {
            await supabase.from('contacts').insert([
              { ...kassor, customer_id: customerId, role: 'kassor' as const },
            ])
          }
        }

        // Sales - simplified for now
        // In production, you'd want to handle individual sale updates
      }

      onClose()
    } catch (error: any) {
      alert('Fel: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!customer || !confirm('Är du säker på att du vill radera denna kund?')) return

    setLoading(true)
    try {
      const { error } = await supabase.from('customers').delete().eq('id', customer.id)
      if (error) throw error
      onClose()
    } catch (error: any) {
      alert('Fel: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
        <input
          type="tel"
          value={formData.telefon}
          onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
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

      {/* Actions */}
      <div className="flex justify-between items-center border-t pt-6">
        <div>
          {customer && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              Radera
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </form>
  )
}
