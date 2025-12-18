# Google Cloud Console API's gebruikt door RouteLogic

## Onderzoeksresultaten

Na analyse van de RouteLogic applicatie (https://app.routelogic.io) via browser inspectie en network monitoring, zijn de volgende Google services geïdentificeerd:

### Gevonden Google Services:

1. **Google Analytics 4 (GA4)**
   - Endpoint: `region1.analytics.google.com/g/collect`
   - Tracking ID: `G-BY100R4G77`
   - Gebruik: Web analytics en gebruikersgedrag tracking

2. **Google Tag Manager (GTM)**
   - Endpoint: `www.googletagmanager.com`
   - Container ID: `GTM-PWCSKZT`
   - Gebruik: Tag management voor marketing en analytics

3. **Google Universal Analytics (Legacy)**
   - Endpoint: `www.google-analytics.com/analytics.js`
   - Tracking ID: `UA-76562111-4`
   - Gebruik: Legacy analytics tracking

4. **Google Ads Conversion Tracking**
   - Endpoint: `www.google.com/pagead/form-data/614229666`
   - Gebruik: Conversie tracking voor Google Ads campagnes

5. **Google DoubleClick**
   - Endpoint: `stats.g.doubleclick.net/g/collect`
   - Gebruik: Display advertising en remarketing

6. **Google Ads Audience Targeting**
   - Endpoint: `www.google.nl/ads/ga-audiences`
   - Gebruik: Audience targeting voor Google Ads

### Belangrijke bevindingen:

- **Geen directe Google Cloud Platform (GCP) API's gevonden** in de frontend
- Alle gevonden Google services zijn **marketing/analytics tools**, geen infrastructure services
- De backend API (`api.routelogic.io`) kan mogelijk Google Cloud services gebruiken, maar deze zijn niet zichtbaar vanuit de frontend
- Voor mapping gebruikt RouteLogic **Mapbox** (niet Google Maps)

### Aanbevelingen voor verder onderzoek:

1. Backend API inspectie: De backend API (`api.routelogic.io`) zou Google Cloud services kunnen gebruiken zoals:
   - Cloud Storage (voor bestandsopslag)
   - Cloud Functions (voor serverless functies)
   - Cloud SQL (voor databases)
   - Cloud Run (voor containerized services)
   - Cloud Pub/Sub (voor messaging)

2. Server-side inspectie: Deze services zijn alleen zichtbaar via:
   - Server logs
   - Google Cloud Console
   - Backend code inspectie
   - API response headers (mogelijk hints)

3. DNS/Infrastructure inspectie: DNS records kunnen hints geven over gebruik van Google Cloud services

## Conclusie

RouteLogic gebruikt **geen directe Google Cloud Console API's** in de frontend applicatie. Alle gevonden Google services zijn marketing en analytics tools. Voor een volledig beeld van Google Cloud Platform gebruik zou backend/server-side inspectie nodig zijn.

---

## Hoe de kaart wordt geladen (Mapbox implementatie)

### Belangrijk: RouteLogic gebruikt **Mapbox**, niet Google Maps!

### Mapbox implementatie details:

1. **Library loading:**
   - Mapbox GL JS wordt **gebundeld** in de main JavaScript bundle (`main.20b828cd.js`)
   - Geen aparte `<script>` tag voor Mapbox (gebundeld met React app)

2. **Access Token:**
   - Access token: `pk.eyJ1Ijoicm91dGVsb2dpYyIsImEiOiJja3d4YjRlcDMwY2RhMnBxdGY2czBoOGFrIn0.2HP8p_wHK1_t81aRDGwA6A`
   - Token wordt gebruikt in alle Mapbox API requests

3. **Mapbox API endpoints die worden aangeroepen:**
   - `/styles/v1/mapbox/streets-v11` - Kaartstijl (streets-v11)
   - `/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2.json` - Vector tiles configuratie
   - `/styles/v1/mapbox/streets-v11/sprite.json` - Sprite metadata
   - `/styles/v1/mapbox/streets-v11/sprite.png` - Sprite afbeelding (47 KB)
   - `/fonts/v1/mapbox/...` - Font bestanden voor labels
   - `/events/v2` - Event tracking
   - `/map-sessions/v1` - Session tracking

4. **DOM structuur:**
   - Container: `.mapboxgl-map` met class `map-container`
   - Canvas element: `.mapboxgl-canvas` voor rendering
   - Markers: `.mapboxgl-marker` voor route markers (Start, Tasks, End)
   - Controls: `.mapboxgl-ctrl-*` voor attributie en controls

5. **Initialisatie:**
   - Mapbox wordt geïnitialiseerd via React component
   - Gebruikt Mapbox GL JS library (waarschijnlijk `react-map-gl` wrapper)
   - Kaart wordt geladen met `streets-v11` style
   - Toegangstoken wordt waarschijnlijk via environment variables of config gezet

6. **Network requests:**
   - Totaal ~24 Mapbox API requests bij het laden van een route
   - Vector tiles worden dynamisch geladen op basis van zoom level en viewport
   - Fonts worden lazy-loaded wanneer nodig

### Conclusie kaart implementatie:
RouteLogic gebruikt **Mapbox GL JS** (niet Google Maps API) voor kaartweergave. De implementatie is gebundeld in de React applicatie en gebruikt vector tiles voor snelle rendering en interactiviteit.

---

## Route berekening en optimalisatie

### Belangrijk: Route berekening gebeurt server-side via eigen backend API

### Route berekening API:

1. **API Endpoint:**
   - **POST** `https://api.routelogic.io/spa-api/schedule-route/{schedule_uuid}`
   - Deze endpoint wordt aangeroepen wanneer gebruiker op "Route berekenen" klikt
   - Opties: "Optimale route" of "Volgorde behouden"

2. **Geen externe routing services gevonden:**
   - ❌ **Geen Google Maps Directions API** - Geen calls naar `maps.googleapis.com/maps/api/directions`
   - ❌ **Geen Mapbox Directions API** - Geen calls naar `api.mapbox.com/directions`
   - ❌ **Geen GraphHopper** - Geen calls naar GraphHopper routing service
   - ❌ **Geen OSRM** - Geen calls naar Open Source Routing Machine
   - ❌ **Geen externe routing API's** - Alle routing gebeurt via eigen backend

3. **Route berekening flow:**
   ```
   Frontend (React App)
   ↓
   POST /spa-api/schedule-route/{uuid}
   ↓
   Backend API (api.routelogic.io)
   ↓
   [Route optimalisatie engine - server-side]
   ↓
   Response met geoptimaliseerde route
   ↓
   Frontend update kaart en route details
   ```

4. **Observaties:**
   - Route berekening is **asynchroon** - gebruiker ziet progress indicator (1/1, 100%)
   - Na berekening wordt route data opgehaald via: `GET /spa-api/schedules/{uuid}`
   - Route wordt getoond op Mapbox kaart met markers voor start, stops, en eindpunt
   - Route details tonen: totale afstand (km), totale tijd (uur), aantal stops

5. **Mogelijke routing engines (server-side, niet zichtbaar):**
   - Eigen implementatie met routing algoritmes
   - Google OR-Tools (Google's optimization library - server-side)
   - VROOM (Vehicle Routing Open-source Optimization Machine)
   - Jsprit (Java-based vehicle routing problem solver)
   - Andere open-source of commerciële routing engines

6. **API calls tijdens route berekening:**
   - `POST /spa-api/schedule-route/{uuid}` - Start route berekening
   - `GET /spa-api/schedules/{uuid}` - Haal route data op na berekening
   - `GET /spa-api/vehicle-locations` - Haal voertuig locaties op
   - `GET /spa-api/tasks-for-schedule?schedule_uuid={uuid}` - Haal opdrachten op
   - `GET /spa-api/vehicles-for-schedule?schedule_uuid={uuid}` - Haal voertuigen op

### Conclusie route berekening:
RouteLogic gebruikt **geen externe routing API's** (zoals Google Maps Directions API of Mapbox Directions API) voor route berekening. De route optimalisatie gebeurt volledig **server-side** via hun eigen backend API (`api.routelogic.io`). 

De backend kan mogelijk gebruik maken van:
- **Google OR-Tools** (server-side, niet zichtbaar in frontend)
- Eigen routing algoritmes
- Andere open-source routing/optimization libraries

**Belangrijk:** Om te bepalen welke routing engine precies wordt gebruikt, zou server-side inspectie nodig zijn (backend code, server logs, of Google Cloud Console als ze OR-Tools via GCP gebruiken).

---

## Backend technologie stack

### Belangrijk: RouteLogic gebruikt **Laravel (PHP)**, niet Node.js!

### Bewijs voor Laravel/PHP backend:

1. **Laravel Sanctum authenticatie:**
   - API endpoint: `/spa-api/sanctum/csrf-cookie`
   - Laravel Sanctum is een **PHP Laravel package** voor SPA authenticatie
   - Dit is een duidelijk teken dat de backend Laravel gebruikt

2. **Laravel Broadcasting:**
   - API endpoint: `/broadcasting/auth`
   - Laravel Broadcasting wordt gebruikt voor real-time features (WebSockets)
   - Dit is een standaard Laravel feature

3. **Response headers:**
   - Headers zoals `cache-control: no-cache, private` zijn typisch voor Laravel responses
   - Content-type: `application/json` (standaard Laravel JSON responses)

4. **API structuur:**
   - API endpoints volgen Laravel conventies (`/spa-api/...`)
   - Sanctum CSRF cookie endpoint is specifiek voor Laravel Sanctum

5. **Web search resultaten:**
   - Foutmeldingen in documentatie verwijzen naar PHP bestanden
   - Geen vermelding van Node.js in beschikbare bronnen

### Conclusie backend technologie:

RouteLogic gebruikt **Laravel (PHP)** als backend framework, **niet Node.js**. 

**Backend stack:**
- **Backend Framework:** Laravel (PHP)
- **Authenticatie:** Laravel Sanctum
- **Real-time:** Laravel Broadcasting (waarschijnlijk met Pusher of Laravel Echo)
- **Frontend:** React (SPA)
- **API structuur:** RESTful API via Laravel routes

**Waarom geen Node.js:**
- Geen hints naar Node.js/Express in API responses
- Laravel Sanctum is exclusief een Laravel package
- Laravel Broadcasting is een Laravel feature
- Response headers en structuur wijzen op Laravel/PHP

