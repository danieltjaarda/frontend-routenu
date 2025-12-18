# Supabase Setup Instructies

## Stap 1: Supabase Project Aanmaken

1. Ga naar [supabase.com](https://supabase.com)
2. Klik op "Start your project" of log in
3. Klik op "New Project"
4. Vul project details in:
   - **Name**: RouteNu (of je eigen naam)
   - **Database Password**: Kies een sterk wachtwoord (bewaar dit!)
   - **Region**: Kies `West Europe (Ireland)` of `North Europe (Frankfurt)` voor beste performance in Nederland
5. Klik op "Create new project"
6. Wacht tot het project klaar is (2-3 minuten)

## Stap 2: API Keys Ophalen

1. In je Supabase project dashboard, ga naar **Settings** (⚙️ icoon linksonder)
2. Klik op **API** in het menu
3. Kopieer de volgende waarden:
   - **Project URL** (onder "Project URL")
   - **anon public** key (onder "Project API keys")

## Stap 3: Database Schema Aanmaken

1. Ga naar **SQL Editor** in het Supabase dashboard
2. Voer het volgende SQL script uit:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Routes table
CREATE TABLE routes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE,
  stops JSONB,
  route_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles table
CREATE TABLE vehicles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  license_plate TEXT,
  description TEXT,
  fixed_color TEXT,
  fuel_type TEXT,
  consumption TEXT,
  co2_emission TEXT,
  driver TEXT,
  start_time TIME,
  end_time TIME,
  speed TEXT,
  planned_break TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  coordinates JSONB,
  address TEXT,
  email TEXT,
  phone TEXT,
  order_type TEXT,
  customer_info JSONB,
  added_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies: Users can only access their own data
CREATE POLICY "Users can view own routes" ON routes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own routes" ON routes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routes" ON routes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own routes" ON routes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own vehicles" ON vehicles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicles" ON vehicles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicles" ON vehicles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicles" ON vehicles
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders" ON orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own orders" ON orders
  FOR DELETE USING (auth.uid() = user_id);
```

3. Klik op **Run** om het script uit te voeren

## Stap 4: Authentication Instellen

1. Ga naar **Authentication** in het Supabase dashboard
2. Klik op **Providers**
3. Zorg dat **Email** provider is ingeschakeld (standaard aan)
4. Optioneel: Configureer email templates onder **Email Templates**

## Stap 5: Environment Variables Instellen

Maak een `.env` bestand in de root van je project:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
REACT_APP_MAPBOX_PUBLIC_TOKEN=your-mapbox-token
```

## Stap 6: Testen

1. Start de app: `npm start`
2. Ga naar `/register` om een account aan te maken
3. Check je email voor verificatie (als email verificatie is ingeschakeld)
4. Log in met je nieuwe account
5. Alle data wordt nu opgeslagen in Supabase PostgreSQL database

## Data Structuur

Supabase gebruikt PostgreSQL tabellen:

- **routes** - Alle routes van gebruikers
- **vehicles** - Alle voertuigen van gebruikers  
- **orders** - Alle opdrachten van gebruikers

Elke tabel heeft een `user_id` kolom die linkt naar `auth.users`, en Row Level Security (RLS) zorgt ervoor dat gebruikers alleen hun eigen data kunnen zien.

## Voordelen van Supabase

- ✅ PostgreSQL database (SQL, niet NoSQL)
- ✅ Real-time subscriptions mogelijk
- ✅ Built-in authentication
- ✅ Row Level Security voor data privacy
- ✅ Open source
- ✅ Gratis tier met goede limieten

