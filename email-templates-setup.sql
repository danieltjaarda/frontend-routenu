-- ============================================
-- Email Templates Database Setup
-- Voer dit uit in Supabase SQL Editor
-- ============================================

-- Tabel voor email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('klanten-informeren', 'klant-aangemeld', 'route-live-bekijken', 'route-gestart')),
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  from_email TEXT DEFAULT 'noreply@routenu.nl',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, template_type)
);

-- Index voor betere performance
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);

-- Trigger voor auto-update updated_at
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS ENABLEN
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see and manage their own templates
CREATE POLICY "Users can view own templates" ON email_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates" ON email_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON email_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" ON email_templates
  FOR DELETE USING (auth.uid() = user_id);

