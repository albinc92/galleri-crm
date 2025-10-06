import { Sale } from '../types'
import { Plus, Trash2 } from 'lucide-react'

interface SalesSectionProps {
  sales: Partial<Sale>[]
  onChange: (sales: Partial<Sale>[]) => void
}

export default function SalesSection({ sales, onChange }: SalesSectionProps) {
  const addSale = () => {
    onChange([...sales, { datum: '', belopp: 0, sald_konst: '' }])
  }

  const removeSale = (index: number) => {
    onChange(sales.filter((_, i) => i !== index))
  }

  const updateSale = (index: number, field: keyof Sale, value: string | number) => {
    const newSales = [...sales]
    newSales[index] = { ...newSales[index], [field]: value }
    onChange(newSales)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Försäljningshistorik</h3>
        <button
          type="button"
          onClick={addSale}
          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
        >
          <Plus className="w-4 h-4" />
          Lägg till
        </button>
      </div>

      <div className="space-y-3">
        {sales.map((sale, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Datum
              </label>
              <input
                type="date"
                value={sale.datum || ''}
                onChange={(e) => updateSale(index, 'datum', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Belopp (kr)
              </label>
              <input
                type="number"
                value={sale.belopp || ''}
                onChange={(e) => updateSale(index, 'belopp', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="col-span-5">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Såld konst
              </label>
              <input
                type="text"
                value={sale.sald_konst || ''}
                onChange={(e) => updateSale(index, 'sald_konst', e.target.value)}
                placeholder="Beskriv konstverk..."
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="col-span-1">
              <button
                type="button"
                onClick={() => removeSale(index)}
                className="w-full p-1.5 text-red-600 hover:bg-red-50 rounded"
                title="Ta bort"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {sales.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            Ingen försäljningshistorik ännu. Klicka "Lägg till" för att lägga till en försäljning.
          </p>
        )}
      </div>
    </div>
  )
}
