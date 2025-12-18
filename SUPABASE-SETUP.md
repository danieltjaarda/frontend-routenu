# Supabase API Keys Ophalen - Stap voor Stap

## Stap 1: Log in op Supabase

1. Ga naar [supabase.com](https://supabase.com)
2. Log in met je account (of maak een account aan)

## Stap 2: Maak een Project aan (als je dat nog niet hebt gedaan)

1. Klik op "New Project" of "Start your project"
2. Vul in:
   - **Name**: RouteNu
   - **Database Password**: Kies een sterk wachtwoord (bewaar dit goed!)
   - **Region**: Kies `West Europe (Ireland)` of `North Europe (Frankfurt)`
3. Klik "Create new project"
4. Wacht 2-3 minuten tot het project klaar is

## Stap 3: Haal je API Keys op

1. In je Supabase dashboard, klik op het **⚙️ Settings** icoon (linksonder in de sidebar)
2. Klik op **API** in het settings menu
3. Je ziet nu twee belangrijke secties:

### Project URL
- **Waar**: Bovenaan onder "Project URL"
- **Voorbeeld**: `https://abcdefghijklmnop.supabase.co`
- **Dit is je**: `REACT_APP_SUPABASE_URL`

### Project API keys
- Je ziet meerdere keys, maar je hebt alleen de **`anon` `public`** key nodig
- **Waar**: Onder "Project API keys" → de key met label **`anon` `public`**
- **Voorbeeld**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzgyMCwiZXhwIjoxOTU0NTQzODIwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Dit is je**: `REACT_APP_SUPABASE_ANON_KEY`

## Stap 4: Voeg toe aan je .env bestand

Maak een `.env` bestand in de root van je project (naast `package.json`):

```env
REACT_APP_SUPABASE_URL=https://jouw-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
REACT_APP_MAPBOX_PUBLIC_TOKEN=pk.eyJ1Ijoi...
```

## Belangrijk:

- ✅ De **anon public** key is veilig om in je frontend code te gebruiken
- ✅ Deze key heeft alleen toegang tot data waar de gebruiker rechten voor heeft (via Row Level Security)
- ❌ Deel deze keys NIET publiekelijk (bijv. in GitHub zonder .env in .gitignore)
- ✅ Zorg dat `.env` in je `.gitignore` staat

## Visual Guide:

```
Supabase Dashboard
├── ⚙️ Settings
    └── API
        ├── Project URL: https://xxxxx.supabase.co  ← REACT_APP_SUPABASE_URL
        └── Project API keys
            ├── anon public: eyJ...  ← REACT_APP_SUPABASE_ANON_KEY (deze heb je nodig!)
            ├── service_role: eyJ...  ← NIET gebruiken in frontend!
            └── ...
```

## Test je configuratie:

Na het toevoegen van de keys, start je app opnieuw:

```bash
npm start
```

Als alles goed is, zou je moeten kunnen:
- Registreren op `/register`
- Inloggen op `/login`
- Data opslaan en ophalen

