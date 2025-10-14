import { CustomerWithContacts } from '../types'

const STORAGE_KEY = 'galleri-customers'

export const storageService = {
  saveCustomers(customers: CustomerWithContacts[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customers))
  },

  getCustomers(): CustomerWithContacts[] {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  },

  clearCustomers() {
    localStorage.removeItem(STORAGE_KEY)
  },
}
