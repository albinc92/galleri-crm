-- System settings table for app-wide configuration
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read settings
CREATE POLICY "Allow read for authenticated users" ON system_settings
  FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to update settings
CREATE POLICY "Allow update for authenticated users" ON system_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow all authenticated users to insert settings
CREATE POLICY "Allow insert for authenticated users" ON system_settings
  FOR INSERT TO authenticated WITH CHECK (true);

-- Insert initial backup setting
INSERT INTO system_settings (key, value, updated_at) 
VALUES ('last_backup_date', NULL, NOW())
ON CONFLICT (key) DO NOTHING;
