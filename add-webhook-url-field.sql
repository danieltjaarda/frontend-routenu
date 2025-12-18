-- ============================================
-- Add Webhook URL Field to Email Templates
-- Voer dit uit in Supabase SQL Editor
-- ============================================

-- Voeg webhook_url kolom toe aan email_templates tabel
ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Optionele index voor betere performance (als je vaak op webhook_url filtert)
CREATE INDEX IF NOT EXISTS idx_email_templates_webhook_url ON email_templates(webhook_url) 
WHERE webhook_url IS NOT NULL;

-- Comment toevoegen aan kolom
COMMENT ON COLUMN email_templates.webhook_url IS 'Zapier webhook URL voor dit template type. Wordt automatisch aangeroepen wanneer een e-mail wordt verzonden.';











