// Google Ads Costs API Endpoint
// Returns advertising costs per day for the last 30 days
//
// Required environment variables:
// - GOOGLE_ADS_CLIENT_ID: OAuth2 Client ID
// - GOOGLE_ADS_CLIENT_SECRET: OAuth2 Client Secret
// - GOOGLE_ADS_DEVELOPER_TOKEN: Google Ads Developer Token
// - GOOGLE_ADS_CUSTOMER_ID: Google Ads Customer ID (without dashes)
// - GOOGLE_ADS_REFRESH_TOKEN: OAuth2 Refresh Token (obtained via /api/google-ads-auth)

const { GoogleAdsApi } = require('google-ads-api');

module.exports = async (req, res) => {
  try {
    // Get configuration from environment variables
    const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
    const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    // Validate required environment variables
    const missing = [];
    if (!CLIENT_ID) missing.push('GOOGLE_ADS_CLIENT_ID');
    if (!CLIENT_SECRET) missing.push('GOOGLE_ADS_CLIENT_SECRET');
    if (!DEVELOPER_TOKEN) missing.push('GOOGLE_ADS_DEVELOPER_TOKEN');
    if (!CUSTOMER_ID) missing.push('GOOGLE_ADS_CUSTOMER_ID');
    if (!REFRESH_TOKEN) missing.push('GOOGLE_ADS_REFRESH_TOKEN');

    if (missing.length > 0) {
      return res.status(500).json({
        error: 'Missing required environment variables',
        missing: missing,
        help: 'Set these in your Vercel environment variables. For REFRESH_TOKEN, visit /api/google-ads-auth?action=authorize first.'
      });
    }

    // Initialize Google Ads API client
    const client = new GoogleAdsApi({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      developer_token: DEVELOPER_TOKEN
    });

    // Get customer with refresh token
    const customer = client.Customer({
      customer_id: CUSTOMER_ID.replace(/-/g, ''), // Remove dashes if present
      refresh_token: REFRESH_TOKEN
    });

    // Query for costs in the last 30 days
    const query = `
      SELECT
        segments.date,
        metrics.cost_micros
      FROM customer
      WHERE segments.date DURING LAST_30_DAYS
      ORDER BY segments.date DESC
    `;

    console.log('Fetching Google Ads costs for customer:', CUSTOMER_ID);

    const results = await customer.query(query);

    // Transform results to simple JSON format
    // cost_micros is in micros (1/1,000,000 of the currency unit)
    const costs = results.map(row => ({
      date: row.segments.date,
      cost: row.metrics.cost_micros / 1_000_000 // Convert micros to euros
    }));

    // Sort by date ascending
    costs.sort((a, b) => a.date.localeCompare(b.date));

    console.log(`Retrieved ${costs.length} days of cost data`);

    return res.status(200).json({
      success: true,
      customer_id: CUSTOMER_ID,
      period: 'LAST_30_DAYS',
      total_cost: costs.reduce((sum, day) => sum + day.cost, 0),
      days: costs.length,
      costs: costs
    });

  } catch (error) {
    console.error('Google Ads API error:', error);

    // Handle specific error types
    if (error.message?.includes('UNAUTHENTICATED') || error.message?.includes('INVALID_CREDENTIALS')) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Refresh token may be expired or invalid. Visit /api/google-ads-auth?action=authorize to get a new one.',
        details: error.message
      });
    }

    if (error.message?.includes('PERMISSION_DENIED')) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'The authenticated user does not have access to this Google Ads account.',
        details: error.message
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch Google Ads costs',
      message: error.message,
      details: error.errors || error.details || null
    });
  }
};

