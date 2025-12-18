# Database Setup Instructies

## 📋 Compleet SQL Script

Dit document bevat alle SQL queries die nodig zijn om de RouteNu applicatie volledig werkend te maken.

## 🚀 Stap-voor-stap Setup

### Stap 1: Ga naar Supabase SQL Editor

1. Log in op [app.supabase.com](https://app.supabase.com)
2. Selecteer je project: `jmdgowgmgztuhtxrujsc`
3. Klik op **SQL Editor** in de sidebar (links)
4. Klik op **New query**

### Stap 2: Kopieer en voer het script uit

1. Open het bestand `database-setup.sql` in dit project
2. Kopieer **alle** SQL code
3. Plak het in de SQL Editor in Supabase
4. Klik op **Run** (of druk op `Ctrl+Enter` / `Cmd+Enter`)

### Stap 3: Verificatie

Na het uitvoeren zou je moeten zien:
- ✅ "Database setup voltooid!" bericht
- Geen errors in de console

## 📊 Wat wordt aangemaakt?

### Tabellen

1. **`routes`** - Alle routes van gebruikers
   - `id` - Unieke ID
   - `user_id` - Link naar gebruiker
   - `date` - Datum van de route
   - `name` - Naam van de route
   - `stops` - JSON array met alle stops
   - `route_data` - Route berekening data (afstand, duur, etc.)
   - `selected_driver` - Geselecteerde chauffeur
   - `created_at` / `updated_at` - Timestamps

2. **`vehicles`** - Alle voertuigen van gebruikers
   - `id` - Unieke ID
   - `user_id` - Link naar gebruiker
   - `license_plate` - Kenteken
   - `description` - Beschrijving
   - `fixed_color` - Vaste kleur
   - `fuel_type` - Brandstoftype
   - `consumption` - Verbruik
   - `co2_emission` - CO2 uitstoot
   - `driver` - Chauffeur naam
   - `start_time` / `end_time` - Werk tijden
   - `speed` - Snelheid
   - `planned_break` - Geplande pauze
   - `created_at` / `updated_at` - Timestamps

3. **`orders`** - Alle opdrachten/stops van gebruikers
   - `id` - Unieke ID
   - `user_id` - Link naar gebruiker
   - `name` - Volledige naam klant
   - `coordinates` - JSON met [longitude, latitude]
   - `address` - Volledig adres
   - `email` - Email adres
   - `phone` - Telefoonnummer
   - `order_type` - Type opdracht (Bezorgen, Ophalen, Zending)
   - `customer_info` - JSON met extra klant informatie
   - `added_at` - Wanneer toegevoegd
   - `created_at` / `updated_at` - Timestamps

### Security (Row Level Security)

- ✅ Alle tabellen hebben RLS ingeschakeld
- ✅ Gebruikers kunnen alleen hun eigen data zien/bewerken
- ✅ Automatische beveiliging per gebruiker

### Performance

- ✅ Indexes op `user_id` voor snelle queries
- ✅ Indexes op `date` en `address` voor filtering
- ✅ Auto-update van `updated_at` timestamps

## 🔍 Testen

Na het uitvoeren van het script:

1. **Test registratie**: Maak een account aan op `/register`
2. **Test data opslaan**: 
   - Voeg een voertuig toe op `/chauffeurs`
   - Voeg een stop toe op `/route-aanmaken`
3. **Test data ophalen**: 
   - Refresh de pagina - je data zou moeten blijven staan
   - Log uit en in - je data zou nog steeds zichtbaar moeten zijn

## 🛠️ Troubleshooting

### Error: "relation already exists"
- Dit betekent dat de tabellen al bestaan
- Je kunt het script opnieuw uitvoeren (IF NOT EXISTS voorkomt errors)
- Of verwijder eerst de tabellen als je opnieuw wilt beginnen

### Error: "permission denied"
- Zorg dat je ingelogd bent als project owner
- Check of je de juiste database hebt geselecteerd

### Data niet zichtbaar
- Check of RLS policies correct zijn aangemaakt
- Verifieer dat je ingelogd bent met het juiste account
- Check de browser console voor errors

## 📝 Handmatige Queries (optioneel)

### Alle routes van een gebruiker bekijken
```sql
SELECT * FROM routes WHERE user_id = auth.uid() ORDER BY created_at DESC;
```

### Alle voertuigen van een gebruiker bekijken
```sql
SELECT * FROM vehicles WHERE user_id = auth.uid() ORDER BY created_at DESC;
```

### Alle opdrachten van een gebruiker bekijken
```sql
SELECT * FROM orders WHERE user_id = auth.uid() ORDER BY created_at DESC;
```

### Totaal aantal items per gebruiker
```sql
SELECT 
  (SELECT COUNT(*) FROM routes WHERE user_id = auth.uid()) as total_routes,
  (SELECT COUNT(*) FROM vehicles WHERE user_id = auth.uid()) as total_vehicles,
  (SELECT COUNT(*) FROM orders WHERE user_id = auth.uid()) as total_orders;
```

## ✅ Klaar!

Na het uitvoeren van dit script is je database volledig geconfigureerd en klaar voor gebruik. Alle functionaliteiten van de RouteNu app zouden nu moeten werken!

