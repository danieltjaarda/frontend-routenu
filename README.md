# RouteNu - Route Optimalisatie App

Een React applicatie voor route optimalisatie in Nederland met Mapbox.

## ⚠️ Belangrijk: Mapbox Tokens

Deze app gebruikt **twee verschillende Mapbox tokens**:

1. **Public Token (pk.*)** - Voor Mapbox GL JS (kaart) en Geocoding API
   - Moet beginnen met `pk.`
   - Veilig om in frontend code te gebruiken
   - Maak aan op: https://account.mapbox.com/access-tokens/

2. **Secret Token (sk.*)** - Voor Optimization API en Directions API
   - Moet beginnen met `sk.`
   - Al geconfigureerd in de code
   - Gebruikt voor server-side API calls

### Token configuratie

Voeg je public token toe via environment variable:

```bash
# Maak .env bestand
echo "REACT_APP_MAPBOX_PUBLIC_TOKEN=pk.jouw_public_token_hier" > .env
```

Of pas de tokens aan in:
- `src/App.js` - `MAPBOX_PUBLIC_TOKEN`
- `src/components/Map.js` - `MAPBOX_PUBLIC_TOKEN`
- `src/components/RoutePlanner.js` - `MAPBOX_PUBLIC_TOKEN`

## Features

- 🗺️ Interactieve kaart met Mapbox GL JS
- 📍 Adres zoeken in Nederland (Geocoding)
- 🚗 Route optimalisatie met Mapbox Optimization API
- 📊 Route details (afstand en tijd)
- 🎯 Meerdere stops toevoegen en beheren

## Installatie

1. Installeer dependencies:
```bash
npm install
```

2. Configureer je public token (zie boven)

3. Start de development server:
```bash
npm start
```

De app opent automatisch op [http://localhost:8000](http://localhost:8000)

## Gebruik

1. **Stop toevoegen**: Gebruik de zoekbalk om een adres in Nederland te zoeken en toe te voegen
2. **Route optimaliseren**: Klik op "Route optimaliseren" wanneer je minimaal 2 stops hebt toegevoegd
3. **Stop verwijderen**: Klik op de × knop naast een stop om deze te verwijderen
4. **Alles wissen**: Gebruik de "Alles wissen" knop om alle stops en de route te verwijderen

## Mapbox API

De app gebruikt verschillende Mapbox API's:

### API Endpoints gebruikt:
- **Geocoding API**: Voor adres zoeken (vereist public token)
- **Optimization API**: Voor route optimalisatie (Vehicle Routing Problem) - gebruikt secret token
- **Directions API**: Fallback voor route berekening - gebruikt secret token
- **Mapbox GL JS**: Voor kaartweergave (vereist public token)

## Technologie Stack

- React 18
- Mapbox GL JS
- Mapbox Geocoder
- React Map GL
- Axios

## Troubleshooting

### Error: "Use a public access token (pk.*) with Mapbox GL"
- **Oplossing**: Zorg dat je een public token (pk.*) gebruikt voor Mapbox GL JS
- Maak een public token aan op https://account.mapbox.com/access-tokens/
- Voeg deze toe via environment variable of pas de code aan

### Kaart laadt niet
- Controleer of je public token geldig is
- Controleer browser console voor errors
- Zorg dat je token de juiste scopes heeft (zoals `styles:read`, `fonts:read`)

## Licentie

MIT
