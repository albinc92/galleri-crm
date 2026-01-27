-- Add erbjudanden (offers) column to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS erbjudanden BOOLEAN DEFAULT FALSE;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_contacts_erbjudanden ON contacts(erbjudanden) WHERE erbjudanden = TRUE;
