import { Contact } from '../types'

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
          <input
            type="email"
            value={contact.email || ''}
            onChange={(e) => onChange({ ...contact, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
          <input
            type="tel"
            value={contact.telefon || ''}
            onChange={(e) => onChange({ ...contact, telefon: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mobil</label>
          <input
            type="tel"
            value={contact.mobil || ''}
            onChange={(e) => onChange({ ...contact, mobil: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
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
    </div>
  )
}
