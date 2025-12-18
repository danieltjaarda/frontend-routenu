# Vercel Deployment Guide

Dit project kan direct naar Vercel worden gedeployed zonder Next.js.

## Stappen voor deployment:

### 1. Installeer Vercel CLI (optioneel)
```bash
npm i -g vercel
```

### 2. Environment Variables instellen

In Vercel dashboard, voeg de volgende environment variables toe:

- `REACT_APP_MAPBOX_PUBLIC_TOKEN` - Je Mapbox public token
- `RESEND_API_KEY` - Je Resend API key (`re_iDLLL1LU_NKoUQ1R5oReCnu4AJawE8Sy3`)

### 3. Deploy via Vercel Dashboard

1. Ga naar [vercel.com](https://vercel.com)
2. Import je GitHub/GitLab/Bitbucket repository
3. Vercel detecteert automatisch dat het een React app is
4. Voeg de environment variables toe in de project settings
5. Klik op "Deploy"

### 4. Of deploy via CLI

```bash
vercel
```

Volg de instructies en voeg de environment variables toe.

## Project Structuur voor Vercel:

- **React App**: Wordt gebouwd met `npm run build` en geserveerd als static files
- **API Routes**: Serverless functions in `/api` folder
  - `/api/send-email.js` - Handles email sending via Resend

## Belangrijk:

- De Express server (`server.js`) wordt niet gebruikt op Vercel
- In plaats daarvan gebruiken we Vercel serverless functions in `/api`
- De frontend maakt calls naar `/api/send-email` (relatief pad)
- In productie wordt dit automatisch gerouteerd naar de serverless function

## Build Command:

Vercel gebruikt automatisch: `npm run build`

## Output Directory:

`build` (standaard voor Create React App)

