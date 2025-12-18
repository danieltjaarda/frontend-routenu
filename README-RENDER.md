# RouteNu Backend - Render Deployment

## Stappen om de backend te deployen naar Render:

### 1. Push code naar GitHub
Zorg dat je laatste wijzigingen gepusht zijn naar je GitHub repository.

### 2. Maak een nieuwe Web Service op Render

1. Ga naar https://dashboard.render.com/
2. Klik op **"New +"** → **"Web Service"**
3. Selecteer je GitHub repository (verbind eerst je GitHub account als dat nog niet gebeurd is)
4. Kies de repository: **Routenu**

### 3. Configureer de Web Service

Vul de volgende instellingen in:

- **Name**: `routenu-backend` (of `App Routenu Backend`)
- **Region**: Europe (Frankfurt) of Europe (Amsterdam)
- **Branch**: `main` (of je huidige branch)
- **Root Directory**: Laat leeg (of `.` voor root)
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm run server`
- **Plan**: Free (of kies een betaald plan voor betere performance)

### 4. Environment Variables toevoegen

Klik op **"Advanced"** en voeg de volgende environment variables toe:

| Key | Value |
|-----|-------|
| `PORT` | `8001` |
| `RESEND_API_KEY` | `re_iDLLL1LU_NKoUQ1R5oReCnu4AJawE8Sy3` |
| `MAPBOX_SECRET_TOKEN` | `jouw-mapbox-secret-token` |
| `NODE_ENV` | `production` |

### 5. Deploy

Klik op **"Create Web Service"**. Render zal automatisch:
- Je code ophalen van GitHub
- Dependencies installeren
- De server starten
- Een publieke URL genereren (bijv. `https://routenu-backend.onrender.com`)

### 6. Update Vercel Environment Variable

Na deployment, voeg de backend URL toe aan je Vercel frontend:

1. Ga naar https://vercel.com/
2. Selecteer je **routenu** project
3. Ga naar **Settings** → **Environment Variables**
4. Voeg toe:
   - **Key**: `REACT_APP_API_URL`
   - **Value**: `https://routenu-backend.onrender.com` (of je Render URL)
   - **Environments**: Production, Preview, Development
5. Klik **Save**
6. Ga naar **Deployments** en klik **Redeploy** om de wijziging toe te passen

### 7. Test de volledige stack

Bezoek https://routenu.vercel.app en test de route-optimalisatie functie. De app zou nu de backend API moeten gebruiken voor optimale route-berekeningen!

## Automatische deploys

Render zal automatisch opnieuw deployen wanneer je wijzigingen pusht naar je GitHub repository (op de geselecteerde branch).

## Troubleshooting

Als de deployment faalt:
1. Check de logs op Render dashboard
2. Zorg dat `server.js` in de root directory staat
3. Verifieer dat alle environment variables correct zijn ingesteld

## CORS configuratie

De server is al geconfigureerd met CORS om verzoeken van je Vercel frontend te accepteren.





