const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
        route_link: data.routeLink || ''
      };
    } else if (templateType === 'klanten-informeren') {
      payload = {
        ...payload,
        event: 'customers_informed',
        route_name: data.routeName || '',
        route_date: data.routeDate || '',
        route_link: data.routeLink || '',
        stops_count: data.stopsCount || 0,
        customers: data.customers || []
      };
    } else if (templateType === 'route-live-bekijken') {
      payload = {
        ...payload,
        event: 'route_live_view',
        route_name: data.routeName || '',
        route_date: data.routeDate || '',
        route_link: data.routeLink || '',
        stops_count: data.stopsCount || 0
      };
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
        stops: data.stops || [],
        stop_name: data.stopName || '',
        stop_email: data.stopEmail || '',
        stop_phone: data.stopPhone || '',
        stop_address: data.stopAddress || '',
        stop_personal_route_link: data.stopPersonalRouteLink || '',
        stop_index: data.stopIndex !== undefined ? data.stopIndex : null
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
    }

    console.log('Sending webhook to:', webhookUrl, 'with payload:', payload);

    // Verstuur webhook
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
};

