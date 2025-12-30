-- ============================================
-- Add Webhook URL to All Email Templates
-- Voer dit uit in Supabase SQL Editor
-- ============================================

-- Update alle bestaande email templates met de webhook URL
UPDATE email_templates
SET webhook_url = 'https://hooks.zapier.com/hooks/catch/20451847/uaroeja/',
    updated_at = NOW()
WHERE webhook_url IS NULL OR webhook_url = '';

-- Als er nog geen templates zijn, kunnen we ze niet updaten
-- Maar we kunnen wel controleren of de update is gelukt
SELECT 
    template_type,
    COUNT(*) as count,
    COUNT(webhook_url) as with_webhook,
    COUNT(*) - COUNT(webhook_url) as without_webhook
FROM email_templates
GROUP BY template_type;



