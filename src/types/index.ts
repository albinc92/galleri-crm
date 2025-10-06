import { Database } from './database'

export type Customer = Database['public']['Tables']['customers']['Row']
export type Contact = Database['public']['Tables']['contacts']['Row']
export type Sale = Database['public']['Tables']['sales']['Row']

export type CustomerInsert = Database['public']['Tables']['customers']['Insert']
export type ContactInsert = Database['public']['Tables']['contacts']['Insert']
export type SaleInsert = Database['public']['Tables']['sales']['Insert']

export type CustomerUpdate = Database['public']['Tables']['customers']['Update']
export type ContactUpdate = Database['public']['Tables']['contacts']['Update']

export type ContactRole = 'ordforande' | 'kassor' | 'ansvarig'

export interface CustomerWithContacts extends Customer {
  contacts?: Contact[]
  sales?: Sale[]
}
