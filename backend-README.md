# RouteNu Backend API

Backend API server voor RouteNu route optimalisatie applicatie.

## Features

- 📧 Email service via Resend
- 🗺️ Mapbox route optimization API
- 🔄 Webhook handling

## Environment Variables

Zorg dat je de volgende environment variables instelt:

```
PORT=8001
RESEND_API_KEY=your_resend_api_key
MAPBOX_SECRET_TOKEN=your_mapbox_secret_token
NODE_ENV=production
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production

```bash
npm start
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Email
- `POST /api/send-email` - Send email via Resend

### Route Optimization
- `POST /api/optimize-route` - Optimize route using Mapbox Optimization API

### Webhooks
- `POST /api/send-webhook` - Send webhook to external URL

## Deployment

### Render.com

1. Connect this GitHub repository to Render
2. Create new Web Service
3. Set environment variables
4. Deploy!

See `render.yaml` for automatic configuration.

## License

Private - All rights reserved





