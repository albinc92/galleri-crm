export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          kundnr: string
          aktiv: boolean
          foretagsnamn: string
          adress: string | null
          postnummer: string | null
          stad: string | null
          telefon: string | null
          bokat_besok: boolean
          anteckningar: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kundnr: string
          aktiv?: boolean
          foretagsnamn: string
          adress?: string | null
          postnummer?: string | null
          stad?: string | null
          telefon?: string | null
          bokat_besok?: boolean
          anteckningar?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          kundnr?: string
          aktiv?: boolean
          foretagsnamn?: string
          adress?: string | null
          postnummer?: string | null
          stad?: string | null
          telefon?: string | null
          bokat_besok?: boolean
          anteckningar?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          customer_id: string
          role: 'ordforande' | 'kassor' | 'ansvarig'
          namn: string | null
          telefon: string | null
          mobil: string | null
          email: string | null
          senast_kontakt: string | null
          aterkom: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          role: 'ordforande' | 'kassor' | 'ansvarig'
          namn?: string | null
          telefon?: string | null
          mobil?: string | null
          email?: string | null
          senast_kontakt?: string | null
          aterkom?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          role?: 'ordforande' | 'kassor' | 'ansvarig'
          namn?: string | null
          telefon?: string | null
          mobil?: string | null
          email?: string | null
          senast_kontakt?: string | null
          aterkom?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          customer_id: string
          datum: string
          belopp: number
          sald_konst: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          datum: string
          belopp: number
          sald_konst?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          datum?: string
          belopp?: number
          sald_konst?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      contact_role: 'ordforande' | 'kassor' | 'ansvarig'
    }
  }
}
