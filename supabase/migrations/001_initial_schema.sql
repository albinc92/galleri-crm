-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kundnr TEXT NOT NULL UNIQUE,
  aktiv BOOLEAN DEFAULT true,
  foretagsnamn TEXT NOT NULL,
  adress TEXT,
  postnummer TEXT,
  stad TEXT,
  telefon TEXT,
  bokat_besok BOOLEAN DEFAULT false,
  anteckningar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contact_role enum
CREATE TYPE contact_role AS ENUM ('ordforande', 'kassor', 'ansvarig');

-- Create contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  role contact_role NOT NULL,
  namn TEXT,
  telefon TEXT,
  mobil TEXT,
  email TEXT,
  senast_kontakt DATE,
  aterkom DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, role)
);

-- Create sales table
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  datum DATE NOT NULL,
  belopp DECIMAL(10, 2) NOT NULL,
  sald_konst TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_customers_foretagsnamn ON customers(foretagsnamn);
CREATE INDEX idx_customers_kundnr ON customers(kundnr);
CREATE INDEX idx_customers_aktiv ON customers(aktiv);
CREATE INDEX idx_contacts_customer_id ON contacts(customer_id);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_datum ON sales(datum);

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Enable read access for authenticated users" ON customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON customers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON customers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON customers
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" ON contacts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON contacts
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON contacts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON contacts
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" ON sales
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON sales
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON sales
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON sales
  FOR DELETE TO authenticated USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
