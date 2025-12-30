# Google Ads API Integratie - Setup Guide

## Overzicht

Deze integratie haalt advertentiekosten op van Google Ads via de Google Ads API.

## Benodigde Credentials

Je hebt de volgende credentials nodig:

| Credential | Beschrijving | Waar te vinden |
|------------|-------------|----------------|
| `GOOGLE_ADS_CLIENT_ID` | OAuth2 Client ID | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth2 Client Secret | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads Developer Token | Google Ads → Tools & Settings → API Center |
| `GOOGLE_ADS_CUSTOMER_ID` | Google Ads Account ID | Google Ads account (bijv. 123-456-7890) |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth2 Refresh Token | Wordt gegenereerd via OAuth flow |

## Stap 1: Environment Variables Instellen in Vercel

Ga naar Vercel Dashboard → Project → Settings → Environment Variables

Voeg toe:

```
GOOGLE_ADS_CLIENT_ID=160718909144-01q33816dobmb7q8m1vh2846d0itpk9s.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=[jouw client secret]
GOOGLE_ADS_DEVELOPER_TOKEN=oMWDJP5JsJfkBT9EUR-R0g
GOOGLE_ADS_CUSTOMER_ID=[jouw customer ID, bijv. 1234567890]
```

## Stap 2: Authorized Redirect URI Instellen

In Google Cloud Console:
1. Ga naar APIs & Services → Credentials
2. Klik op je OAuth 2.0 Client ID
3. Voeg toe bij "Authorized redirect URIs":
   ```
   https://app.routenu.nl/api/google-ads-auth
   ```

## Stap 3: Refresh Token Verkrijgen

1. Deploy eerst de app naar Vercel (met de environment variables ingesteld)
2. Bezoek: `https://app.routenu.nl/api/google-ads-auth?action=authorize`
3. Log in met je Google account (dat toegang heeft tot Google Ads)
4. Je krijgt een JSON response met de `refresh_token`
5. Kopieer de `refresh_token` en voeg toe in Vercel:
   ```
   GOOGLE_ADS_REFRESH_TOKEN=[de refresh token]
   ```
6. Redeploy de app

## Stap 4: Testen

Bezoek: `https://app.routenu.nl/api/google-ads-costs`

Je krijgt een response zoals:

```json
{
  "success": true,
  "customer_id": "1234567890",
  "period": "LAST_30_DAYS",
  "total_cost": 1234.56,
  "days": 30,
  "costs": [
    { "date": "2025-01-01", "cost": 45.67 },
    { "date": "2025-01-02", "cost": 52.30 },
    ...
  ]
}
```

## API Endpoints

### GET /api/google-ads-auth

OAuth2 authorization flow.

**Query Parameters:**
- `action=authorize` - Start OAuth flow, redirect naar Google login

**Response (na succesvolle login):**
```json
{
  "success": true,
  "refresh_token": "1//...",
  "message": "Save this refresh_token!"
}
```

### GET /api/google-ads-costs

Haal advertentiekosten op.

**Response:**
```json
{
  "success": true,
  "customer_id": "1234567890",
  "period": "LAST_30_DAYS",
  "total_cost": 1234.56,
  "days": 30,
  "costs": [
    { "date": "2025-01-01", "cost": 45.67 },
    { "date": "2025-01-02", "cost": 52.30 }
  ]
}
```

## Troubleshooting

### "Missing required environment variables"
- Controleer of alle 5 environment variables zijn ingesteld in Vercel
- Redeploy na het toevoegen van variables

### "Authentication failed"
- De refresh_token is mogelijk verlopen
- Ga opnieuw naar `/api/google-ads-auth?action=authorize`

### "Permission denied"
- Het Google account heeft geen toegang tot het Google Ads account
- Controleer of je de juiste Customer ID gebruikt

### "Invalid developer token"
- De developer token moet zijn goedgekeurd door Google
- TEST tokens werken alleen met test accounts

## Belangrijk: TEST vs PRODUCTION Developer Token

Met een **TEST** developer token:
- Kun je alleen TEST Google Ads accounts benaderen
- Krijg je mogelijk geen echte data terug

Voor productie data heb je een **APPROVED** developer token nodig:
- Vraag aan via Google Ads API Center
- Vereist OAuth consent screen verificatie

