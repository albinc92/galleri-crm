import { Contact } from '../types'
import { Phone, Mail } from 'lucide-react'

interface ContactSectionProps {
  title: string
  contact: Partial<Contact>
  onChange: (contact: Partial<Contact>) => void
}

export default function ContactSection({ title, contact, onChange }: ContactSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
        {title}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Namn</label>
          <input
            type="text"
            value={contact.namn || ''}
            onChange={(e) => onChange({ ...contact, namn: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={contact.email || ''}
              onChange={(e) => onChange({ ...contact, email: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center justify-center px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                title="Skicka e-post"
              >
                <Mail className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={contact.telefon || ''}
              onChange={(e) => onChange({ ...contact, telefon: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {contact.telefon && (
              <a
                href={`tel:${contact.telefon}`}
                className="flex items-center justify-center px-3 py-2 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                title="Ring"
              >
                <Phone className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mobil</label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={contact.mobil || ''}
              onChange={(e) => onChange({ ...contact, mobil: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {contact.mobil && (
              <a
                href={`tel:${contact.mobil}`}
                className="flex items-center justify-center px-3 py-2 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                title="Ring"
              >
                <Phone className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Senast kontakt
          </label>
          <input
            type="date"
            value={contact.senast_kontakt || ''}
            onChange={(e) => onChange({ ...contact, senast_kontakt: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Återkom
          </label>
          <input
            type="date"
            value={contact.aterkom || ''}
            onChange={(e) => onChange({ ...contact, aterkom: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Erbjudanden checkbox */}
      <div className="flex items-center gap-2 mt-3 p-3 bg-blue-50 rounded-lg">
        <input
          type="checkbox"
          id={`erbjudanden-${title}`}
          checked={(contact as any).erbjudanden || false}
          onChange={(e) => onChange({ ...contact, erbjudanden: e.target.checked } as any)}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor={`erbjudanden-${title}`} className="text-sm font-medium text-gray-700">
          ✉️ Skicka erbjudanden till denna kontakt
        </label>
      </div>
    </div>
  )
}
