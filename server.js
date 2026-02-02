const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const https = require('https');
const http = require('http');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 8001;
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_iDLLL1LU_NKoUQ1R5oReCnu4AJawE8Sy3';
const MAPBOX_SECRET_TOKEN = process.env.MAPBOX_SECRET_TOKEN || 'sk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhqdXdjMDExcDNkczZrNmN6ZGtkcCJ9._qbrsDUZpEOR97cAI17-hA';

// Google Ads Configuration
const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;

const resend = new Resend(RESEND_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    const { from, to, subject, html } = req.body;

    // Validation
    if (!from || !to || !subject || !html) {
      console.error('Missing required fields:', { from: !!from, to: !!to, subject: !!subject, html: !!html });
      return res.status(400).json({ 
        error: 'Missing required fields: from, to, subject, html' 
      });
    }

    // Debug logging
    console.log('Sending email:', {
      from,
      to,
      subject,
      htmlLength: html ? html.length : 0,
      htmlPreview: html ? html.substring(0, 100) : 'null'
    });

    // Send email via Resend
    const data = await resend.emails.send({
      from,
      to,
      subject,
      html
    });

    console.log('Email sent successfully:', data);

    res.json({ 
      success: true, 
      data,
      message: 'E-mail succesvol verzonden!' 
    });
  } catch (error) {
    console.error('Email send error:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(500).json({ 
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het verzenden van de e-mail' 
    });
  }
});

// Webhook sending endpoint
app.post('/api/send-webhook', async (req, res) => {
  try {
    const { webhookUrl, templateType, data } = req.body;

    // Validation
    if (!webhookUrl || !templateType) {
      return res.status(400).json({ 
        error: 'Missing required fields: webhookUrl, templateType' 
      });
    }

    // Bereid webhook payload voor op basis van template type
    let payload = {
      template_type: templateType,
      timestamp: new Date().toISOString(),
      ...data
    };

    // Voeg specifieke data toe op basis van template type
    if (templateType === 'klant-aangemeld') {
      payload = {
        ...payload,
        event: 'customer_registered',
        customer_name: data.stopName || data.name || '',
        customer_email: data.email || '',
        customer_phone: data.phone || '',
        customer_address: data.stopAddress || data.address || '',
        route_name: data.routeName || '',
        route_date: data.routeDate || '',
        route_link: data.routeLink || '',
        live_route_link: data.liveRouteLink || data.routeLink || ''
      };
    } else if (templateType === 'klanten-informeren') {
      // Check if this is individual customer data (like klant-aangemeld) or bulk data
      if (data.stopName || data.name || data.email) {
        // Individual customer webhook - same structure as klant-aangemeld
        payload = {
          ...payload,
          event: 'customers_informed',
          customer_name: data.stopName || data.name || '',
          customer_email: data.email || '',
          customer_phone: data.phone || '',
          customer_address: data.stopAddress || data.address || '',
          route_name: data.routeName || '',
          route_date: data.routeDate || '',
          route_link: data.routeLink || '',
          live_route_link: data.liveRouteLink || data.routeLink || ''
        };
      } else {
        // Bulk webhook with customers array (backwards compatibility)
        payload = {
          ...payload,
          event: 'customers_informed',
          route_name: data.routeName || '',
          route_date: data.routeDate || '',
          route_link: data.routeLink || '',
          stops_count: data.stopsCount || 0,
          customers: data.customers || []
        };
      }
    } else if (templateType === 'route-gestart') {
      payload = {
        ...payload,
        event: 'route_started',
        route_name: data.routeName || '',
        route_date: data.routeDate || '',
        route_link: data.routeLink || '',
        live_route_link: data.liveRouteLink || data.routeLink || '',
        route_id: data.routeId || '',
        route_started_at: data.routeStartedAt || new Date().toISOString(),
        stops_count: data.stopsCount || 0,
        driver_name: data.driverName || '',
        vehicle_info: data.vehicleInfo || '',
        stops: data.stops || []
      };
    } else if (templateType === 'user-registered') {
      payload = {
        ...payload,
        event: 'user_registered',
        user_id: data.user_id || data.userId || '',
        user_name: data.user_name || data.name || data.displayName || '',
        user_email: data.user_email || data.email || '',
        user_phone: data.user_phone || data.phone || '',
        start_address: data.start_address || data.startAddress || '',
        start_coordinates: data.start_coordinates || data.startCoordinates || null,
        registration_date: data.registration_date || data.registrationDate || new Date().toISOString()
      };
    } else if (templateType === 'fiets-opgehaald') {
      payload = {
        ...payload,
        event: 'bike_picked_up',
        route_id: data.route_id || '',
        route_name: data.route_name || '',
        route_date: data.route_date || '',
        stop_index: data.stop_index !== undefined ? data.stop_index : null,
        stop_name: data.stop_name || '',
        stop_email: data.stop_email || '',
        stop_phone: data.stop_phone || '',
        stop_address: data.stop_address || '',
        stop_coordinates: data.stop_coordinates || null,
        driver_id: data.driver_id || '',
        driver_name: data.driver_name || '',
        picked_up_at: data.picked_up_at || new Date().toISOString()
      };
    }

    console.log('Sending webhook to:', webhookUrl, 'with payload:', payload);

    // Verstuur webhook naar Zapier
    // Gebruik native fetch als beschikbaar (Node 18+), anders gebruik http/https
    let response;
    try {
      if (typeof fetch !== 'undefined') {
        // Node.js 18+ heeft native fetch
        response = await fetch(webhookUrl.trim(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        // Fallback voor oudere Node.js versies
        const url = new URL(webhookUrl.trim());
        const client = url.protocol === 'https:' ? https : http;
        const postData = JSON.stringify(payload);
        
        response = await new Promise((resolve, reject) => {
          const req = client.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          }, (res) => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage
            });
          });
          
          req.on('error', reject);
          req.write(postData);
          req.end();
        });
      }

      if (!response.ok) {
        console.warn('Webhook response not OK:', response.status, response.statusText);
        return res.status(500).json({ 
          success: false,
          error: `Webhook failed: ${response.status} ${response.statusText}` 
        });
      }

      console.log('Webhook sent successfully');
      res.json({ 
        success: true, 
        message: 'Webhook succesvol verzonden!' 
      });
    } catch (fetchError) {
      console.error('Error in webhook fetch:', fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error('Webhook send error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het verzenden van de webhook' 
    });
  }
});


// Route optimization endpoint using Mapbox Optimization API
app.post('/api/optimize-route', async (req, res) => {
  try {
    const { waypoints, profile = 'driving' } = req.body;

    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({ 
        error: 'Waypoints array with at least 2 points is required' 
      });
    }

    // Check waypoint limit (Mapbox Optimization API supports max 12 waypoints)
    if (waypoints.length > 12) {
      return res.status(400).json({ 
        error: 'Maximum 12 waypoints supported' 
      });
    }

    // Format waypoints for Mapbox Optimization API
    const formattedWaypoints = waypoints.map(wp => ({
      coordinates: wp.coordinates || [wp.longitude || wp[0], wp.latitude || wp[1]]
    }));

    // Build Optimization API request
    const optimizationUrl = `https://api.mapbox.com/optimized-trips/v1/mapbox/${profile}`;
    const coordinates = formattedWaypoints.map(wp => 
      `${wp.coordinates[0]},${wp.coordinates[1]}`
    ).join(';');

    const url = `${optimizationUrl}/${coordinates}?` +
      `access_token=${MAPBOX_SECRET_TOKEN}&` +
      `roundtrip=true&` +
      `source=first&` +
      `geometries=geojson&` +
      `overview=full&` +
      `steps=true&` +
      `annotations=duration,distance`;

    console.log('Calling Mapbox Optimization API:', {
      waypointsCount: waypoints.length,
      profile
    });

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('Mapbox Optimization API error:', data);
      return res.status(response.status).json({ 
        error: data.message || 'Route optimization failed',
        details: data 
      });
    }

    if (data.code === 'Ok' && data.trips && data.trips.length > 0) {
      const trip = data.trips[0];
      
      // IMPORTANT: Waypoints are on the main response object (data.waypoints), NOT on trip!
      // Each waypoint has: location [lng, lat], waypoint_index (position in optimized trip), trips_index
      const optimizedWaypoints = (data.waypoints || []).map((wp) => ({
        location: wp.location || [wp.coordinates?.[0], wp.coordinates?.[1]],
        coordinates: wp.location || [wp.coordinates?.[0], wp.coordinates?.[1]],
        waypoint_index: wp.waypoint_index !== undefined ? wp.waypoint_index : -1,
        trips_index: wp.trips_index !== undefined ? wp.trips_index : 0,
        name: wp.name || ''
      }));
      
      // Convert Optimization API response to Directions API format for compatibility
      const routeResponse = {
        code: 'Ok',
        routes: [{
          geometry: trip.geometry,
          distance: trip.distance,
          duration: trip.duration,
          weight: trip.weight,
          weight_name: trip.weight_name
        }],
        waypoints: optimizedWaypoints
      };

      console.log('Route optimized successfully:', {
        distance: trip.distance,
        duration: trip.duration,
        waypointsCount: optimizedWaypoints.length,
        waypoints: optimizedWaypoints.map(wp => ({
          location: wp.location,
          waypoint_index: wp.waypoint_index,
          trips_index: wp.trips_index
        }))
      });

      return res.json(routeResponse);
    } else {
      console.error('Mapbox Optimization API returned no route:', data);
      return res.status(400).json({ 
        error: data.message || 'No optimized route found',
        details: data 
      });
    }
  } catch (error) {
    console.error('Error optimizing route:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// ============================================
// Google Ads API Endpoints
// ============================================

// Google Ads OAuth2 Authorization Flow
app.get('/api/google-ads-auth', async (req, res) => {
  // Always use https in production (Render uses reverse proxy)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const REDIRECT_URI = process.env.GOOGLE_ADS_REDIRECT_URI || `https://${req.get('host')}/api/google-ads-auth`;

  if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET) {
    return res.status(500).json({
      error: 'Missing Google OAuth credentials',
      message: 'Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET environment variables'
    });
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET,
    REDIRECT_URI
  );

  const { action, code } = req.query;

  // Step 1: Start OAuth flow
  if (action === 'authorize') {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/adwords']
    });
    return res.redirect(authUrl);
  }

  // Step 2: Handle callback with authorization code
  if (code) {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      return res.json({
        success: true,
        message: 'OAuth successful! Save the refresh_token below in your environment variables.',
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date,
        instructions: 'Add GOOGLE_ADS_REFRESH_TOKEN to your environment variables with the refresh_token value above.'
      });
    } catch (error) {
      console.error('OAuth token exchange error:', error);
      return res.status(500).json({
        error: 'Failed to exchange authorization code',
        message: error.message
      });
    }
  }

  // Default: Show instructions
  return res.json({
    message: 'Google Ads OAuth2 Authorization',
    instructions: 'Visit /api/google-ads-auth?action=authorize to start the OAuth flow',
    status: 'ready'
  });
});

// Google Ads Costs Endpoint (using REST API)
app.get('/api/google-ads-costs', async (req, res) => {
  try {
    // Validate configuration
    if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET || !GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CUSTOMER_ID || !GOOGLE_ADS_REFRESH_TOKEN) {
      const missing = [];
      if (!GOOGLE_ADS_CLIENT_ID) missing.push('GOOGLE_ADS_CLIENT_ID');
      if (!GOOGLE_ADS_CLIENT_SECRET) missing.push('GOOGLE_ADS_CLIENT_SECRET');
      if (!GOOGLE_ADS_DEVELOPER_TOKEN) missing.push('GOOGLE_ADS_DEVELOPER_TOKEN');
      if (!GOOGLE_ADS_CUSTOMER_ID) missing.push('GOOGLE_ADS_CUSTOMER_ID');
      if (!GOOGLE_ADS_REFRESH_TOKEN) missing.push('GOOGLE_ADS_REFRESH_TOKEN');
      
      return res.status(500).json({
        error: 'Missing Google Ads configuration',
        missing_variables: missing
      });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_ADS_CLIENT_ID,
      GOOGLE_ADS_CLIENT_SECRET
    );
    
    oauth2Client.setCredentials({
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN
    });

    // Get fresh access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    const accessToken = credentials.access_token;

    // Format customer ID (remove dashes)
    const customerId = GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '');

    // Use Google Ads REST API
    const query = `
      SELECT
        segments.date,
        metrics.cost_micros
      FROM customer
      WHERE segments.date DURING LAST_30_DAYS
      ORDER BY segments.date DESC
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': GOOGLE_ADS_DEVELOPER_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Ads API error response:', errorData);
      return res.status(response.status).json({
        error: 'Google Ads API error',
        message: errorData.error?.message || 'Unknown error',
        details: errorData
      });
    }

    const data = await response.json();
    
    // Parse results - REST API returns array of result batches
    const costs = [];
    if (data && Array.isArray(data)) {
      for (const batch of data) {
        if (batch.results) {
          for (const row of batch.results) {
            costs.push({
              date: row.segments?.date || 'unknown',
              cost: ((row.metrics?.costMicros || 0) / 1000000).toFixed(2)
            });
          }
        }
      }
    }

    // Calculate total
    const totalCost = costs.reduce((sum, row) => sum + parseFloat(row.cost), 0);

    return res.json({
      success: true,
      period: 'LAST_30_DAYS',
      total_cost: totalCost.toFixed(2),
      currency: 'EUR',
      daily_costs: costs
    });

  } catch (error) {
    console.error('Google Ads API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch Google Ads costs',
      message: error.message,
      details: error.errors || null
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

