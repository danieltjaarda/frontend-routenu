# Supabase API Keys - Belangrijk!

## ⚠️ Probleem met de huidige keys

De "Publishable key" die je hebt gegeven (`sb_publishable_...`) is mogelijk niet de juiste key voor Supabase Auth.

## ✅ Juiste keys ophalen:

1. **Ga naar je Supabase Dashboard**: [app.supabase.com](https://app.supabase.com)
2. **Selecteer je project**: `jmdgowgmgztuhtxrujsc`
3. **Ga naar Settings** (⚙️ icoon linksonder)
4. **Klik op "API"** in het menu
5. **Zoek naar "Project API keys"** sectie

## 🔑 Welke key heb je nodig?

Je hebt de **`anon` `public`** key nodig, die er zo uitziet:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZGdvd2dtZ3p0dWh0eHJ1anNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAxNTY3NjAwMH0.xxxxxxxxxxxxx
```

**Niet** de "Publishable key" of "Secret key" - die zijn voor andere doeleinden.

## 📝 Update je .env bestand:

Vervang `REACT_APP_SUPABASE_ANON_KEY` met de **anon public** key uit je Supabase dashboard.

## 🔍 Waar vind je het?

In Supabase Dashboard → Settings → API → Project API keys:
- ✅ Gebruik: **`anon` `public`** (deze begint meestal met `eyJ...`)
- ❌ Gebruik NIET: `sb_publishable_...` (dit is voor Supabase Studio)
- ❌ Gebruik NIET: `sb_secret_...` (dit is voor server-side)

## 🚀 Na het updaten:

1. Stop de app (Ctrl+C)
2. Start opnieuw: `npm start`
3. Probeer opnieuw te registreren

